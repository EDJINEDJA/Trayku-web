import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PaypalPaymentProvider, StripePaymentProvider, SystemPaymentProvider, stripeForm, toDecimal, toMinor, verifyStripeSignature } from '../framework/modules-core/payment/providers';

/** Replaces fetch: each call is recorded and answered by `reply`, in order. */
function mockFetch(...replies: unknown[]) {
  const calls: { url: string; method: string; headers: Record<string, string>; body: string }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url: String(url), method: init.method ?? 'GET', headers: (init.headers ?? {}) as Record<string, string>, body: String(init.body ?? '') });
    const reply = replies.shift() ?? {};
    return new Response(JSON.stringify(reply), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return calls;
}
const realFetch = globalThis.fetch;
const restore = () => void (globalThis.fetch = realFetch);
afterEach(() => restore());

describe('montants', () => {
  it('passe en centimes et en décimales selon la devise', () => {
    assert.equal(toMinor(12.5, 'EUR'), 1250);
    assert.equal(toMinor(0.1 + 0.2, 'EUR'), 30);
    assert.equal(toMinor(1200, 'JPY'), 1200);
    assert.equal(toDecimal(12.5, 'EUR'), '12.50');
  });
  it('encode les paramètres imbriqués comme l’API Stripe', () => {
    const f = stripeForm({ a: { b: 1 }, list: [{ q: 2 }], skip: undefined, tags: ['x'] });
    assert.equal(f.toString(), 'a%5Bb%5D=1&list%5B0%5D%5Bq%5D=2&tags%5B0%5D=x');
  });
});

describe('paiement test (system)', () => {
  it('est réservé tout de suite, sans rien débiter', async () => {
    const p = new SystemPaymentProvider();
    assert.equal(p.mode, 'test');
    const res = await p.initiate();
    assert.equal(res.status, 'authorized');
    assert.ok(!('redirect_url' in res));
  });
});

describe('Stripe', () => {
  const stripe = () => new StripePaymentProvider({ apiKey: 'sk_test_123', webhookSecret: 'whsec_abc', mode: 'test' });

  it('refuse une clé qui ne correspond pas au mode', () => {
    assert.throws(() => new StripePaymentProvider({ apiKey: 'sk_test_123', mode: 'live' }), /clé de test/);
    assert.throws(() => new StripePaymentProvider({ apiKey: 'sk_live_123', mode: 'test' }), /clé réelle/);
  });

  it('ouvre une page Checkout qui réserve le montant sans l’encaisser', async () => {
    const calls = mockFetch({ id: 'cs_1', url: 'https://checkout.stripe.com/c/cs_1' });
    const res = await stripe().initiate({ payment_id: 'pay_1', amount: 14.9, currency_code: 'EUR', description: 'Traiku · Test', return_url: 'https://b/ok', cancel_url: 'https://b/ko' });
    assert.equal(res.status, 'pending');
    assert.equal(res.redirect_url, 'https://checkout.stripe.com/c/cs_1');
    assert.deepEqual(res.data, { session_id: 'cs_1' });
    const body = new URLSearchParams(calls[0].body);
    assert.equal(calls[0].url, 'https://api.stripe.com/v1/checkout/sessions');
    assert.equal(calls[0].headers.Authorization, 'Bearer sk_test_123');
    assert.equal(body.get('payment_intent_data[capture_method]'), 'manual');
    assert.equal(body.get('line_items[0][price_data][unit_amount]'), '1490');
    assert.equal(body.get('line_items[0][price_data][currency]'), 'eur');
    assert.equal(body.get('metadata[payment_id]'), 'pay_1');
  });

  it('voit la réservation faite au retour du payeur', async () => {
    mockFetch({ status: 'complete', payment_intent: { id: 'pi_1', status: 'requires_capture' } });
    const res = await stripe().getStatus({ session_id: 'cs_1' });
    assert.equal(res.status, 'authorized');
    assert.equal(res.data.payment_intent_id, 'pi_1');
  });

  it('voit une page abandonnée', async () => {
    mockFetch({ status: 'expired', payment_intent: null });
    assert.equal((await stripe().getStatus({ session_id: 'cs_1' })).status, 'canceled');
  });

  it('encaisse une partie de la réservation', async () => {
    const calls = mockFetch({ id: 'pi_1', latest_charge: 'ch_1' });
    const data = await stripe().capture({ payment_intent_id: 'pi_1' }, 3.5, 'EUR');
    assert.equal(calls[0].url, 'https://api.stripe.com/v1/payment_intents/pi_1/capture');
    assert.equal(new URLSearchParams(calls[0].body).get('amount_to_capture'), '350');
    assert.equal(data.charge_id, 'ch_1');
  });

  it('accepte un webhook signé et refuse les autres', async () => {
    const raw = Buffer.from(JSON.stringify({ type: 'checkout.session.completed', data: { object: { metadata: { payment_id: 'pay_9' } } } }));
    const t = Math.floor(Date.now() / 1000);
    const sig = crypto.createHmac('sha256', 'whsec_abc').update(`${t}.${raw}`).digest('hex');
    assert.deepEqual(await stripe().webhook(raw, { 'stripe-signature': `t=${t},v1=${sig}` }), { payment_id: 'pay_9' });
    await assert.rejects(stripe().webhook(raw, { 'stripe-signature': `t=${t},v1=${'0'.repeat(64)}` }), /invalide/);
    assert.throws(() => verifyStripeSignature(raw, `t=${t - 3600},v1=${sig}`, 'whsec_abc'), /ancienne/);
  });
});

describe('PayPal', () => {
  const paypal = (mode: 'test' | 'live' = 'test') => new PaypalPaymentProvider({ clientId: 'id', clientSecret: 'secret', mode });
  const token = { access_token: 'tok', expires_in: 3600 };

  it('utilise le bac à sable en test et l’API réelle en live', async () => {
    let calls = mockFetch(token, { id: 'O1', links: [{ rel: 'payer-action', href: 'https://www.sandbox.paypal.com/checkoutnow?token=O1' }] });
    const res = await paypal().initiate({ payment_id: 'pay_1', amount: 12, currency_code: 'EUR', description: 'Traiku · Test', return_url: 'https://b/ok', cancel_url: 'https://b/ko' });
    assert.ok(calls[0].url.startsWith('https://api-m.sandbox.paypal.com/'));
    assert.equal(res.redirect_url, 'https://www.sandbox.paypal.com/checkoutnow?token=O1');
    const order = JSON.parse(calls[1].body);
    assert.equal(order.intent, 'AUTHORIZE');
    assert.deepEqual(order.purchase_units[0].amount, { currency_code: 'EUR', value: '12.00' });
    restore();
    calls = mockFetch(token, { id: 'O2', links: [] });
    await paypal('live').initiate({ payment_id: 'pay_2', amount: 1, currency_code: 'EUR', description: 'x', return_url: 'https://b', cancel_url: 'https://b' });
    assert.ok(calls[0].url.startsWith('https://api-m.paypal.com/'));
  });

  it('autorise la commande approuvée par le payeur', async () => {
    const calls = mockFetch(token, { status: 'APPROVED' }, { status: 'COMPLETED', purchase_units: [{ payments: { authorizations: [{ id: 'AUTH1', status: 'CREATED' }] } }] });
    const res = await paypal().getStatus({ order_id: 'O1' });
    assert.equal(res.status, 'authorized');
    assert.equal(res.data.authorization_id, 'AUTH1');
    assert.ok(calls[2].url.endsWith('/v2/checkout/orders/O1/authorize'));
  });

  it('encaisse et annule sur l’autorisation', async () => {
    const calls = mockFetch(token, { id: 'CAP1' });
    const p = paypal();
    const data = await p.capture({ authorization_id: 'AUTH1' }, 7.5, 'EUR');
    assert.equal(data.capture_id, 'CAP1');
    assert.deepEqual(JSON.parse(calls[1].body), { amount: { currency_code: 'EUR', value: '7.50' }, final_capture: true });
    mockFetch({});
    await p.cancel({ authorization_id: 'AUTH1' });
  });
});
