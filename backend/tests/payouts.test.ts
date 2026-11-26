import { after, afterEach, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootstrap, type TraikuApp } from '../framework/app';
import { Modules, type PaymentModuleService } from '../framework';
import { MEMBER_MODULE, type MemberModuleService } from '../src/modules/member';
import { MISSION_MODULE, type MissionModuleService } from '../src/modules/mission';
import type { MissionRow, RunRow } from '../src/modules/mission/service';
import { PAYOUT_MODULE, StripeConnectPayoutProvider, SystemPayoutProvider, type PayoutModuleService, type PayoutProvider } from '../src/modules/payout';
import { createMissionWorkflow } from '../src/workflows/missions/create-mission';
import { acceptMissionWorkflow } from '../src/workflows/missions/accept-mission';
import { payMissionWorkflow, settleMissionPayment } from '../src/workflows/payments';
import { earningsFor, recordMissionEarnings } from '../src/workflows/payouts/earnings';
import { payMemberWorkflow } from '../src/workflows/payouts';
import { payout } from '../src/lib/pricing';
import { SavePayoutBank } from '../src/api/utils/validators';

/** Replaces fetch: each call is recorded and answered by `reply`, in order. */
function mockFetch(...replies: unknown[]) {
  const calls: { url: string; method: string; headers: Record<string, string>; body: string }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url: String(url), method: init.method ?? 'GET', headers: (init.headers ?? {}) as Record<string, string>, body: String(init.body ?? '') });
    return new Response(JSON.stringify(replies.shift() ?? {}), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return calls;
}
const realFetch = globalThis.fetch;
afterEach(() => void (globalThis.fetch = realFetch));

const mission = (over: Partial<MissionRow>) =>
  ({ id: 'mis_1', requester_id: 'mem_req', currency_code: 'EUR', traikeur_rate: 0.15, price: 20, crew: 1, verify_only_price: 10, cancel_fee: null, status: 'delivered', metadata: null, cancelled_at: null, ...over }) as MissionRow;
const run = (over: Partial<RunRow>) => ({ id: 'run_1', traveler_id: 'mem_k', status: 'done', tip: 0, extra_amount: 0, cancelled_by: null, cancelled_at: null, ...over }) as RunRow;

describe('gains d’une mission close', () => {
  it('livrée : le prix moins la commission, le temps en plus, le pourboire entier', () => {
    const [e] = earningsFor(mission({}), [run({ tip: 2, extra_amount: 4 })], 0.8);
    assert.equal(e.kind, 'mission');
    assert.equal(e.amount, payout(24, 0.15) + 2);
  });
  it('une équipe : la part de chacun', () => {
    const list = earningsFor(mission({ crew: 2 }), [run({}), run({ id: 'run_2', traveler_id: 'mem_l' })], 0.8);
    assert.deepEqual(
      list.map((e) => e.amount),
      [payout(10, 0.15), payout(10, 0.15)]
    );
  });
  it('objet refusé : la vérification seule', () => {
    const [e] = earningsFor(mission({ metadata: { outcome: 'verify_only' } }), [run({})], 0.8);
    assert.equal(e.kind, 'verify_only');
    assert.equal(e.amount, payout(10, 0.15));
  });
  it('annulée tard : la part des frais pour le Traikeur dont la course est annulée', () => {
    const at = new Date();
    const [e] = earningsFor(mission({ status: 'cancelled', cancel_fee: 5, cancelled_at: at }), [run({ status: 'cancelled', cancelled_by: 'mem_req', cancelled_at: at })], 0.8);
    assert.equal(e.kind, 'cancellation');
    assert.equal(e.amount, 4);
  });
  it('demandeur absent : la part des frais pour celui qui a attendu', () => {
    const at = new Date();
    const [e] = earningsFor(mission({ status: 'cancelled', cancel_fee: 5, cancelled_at: at, metadata: { outcome: 'no_show' } }), [run({ status: 'cancelled', cancelled_by: 'mem_k', cancelled_at: at })], 0.8);
    assert.equal(e.kind, 'no_show');
    assert.equal(e.amount, 4);
  });
  it('rien quand c’est gratuit, ou quand le Traikeur se désiste', () => {
    assert.deepEqual(earningsFor(mission({ status: 'cancelled', cancel_fee: null }), [run({ status: 'cancelled', cancelled_by: 'mem_req' })], 0.8), []);
    assert.deepEqual(earningsFor(mission({ status: 'cancelled', cancel_fee: 5 }), [run({ status: 'cancelled', cancelled_by: 'mem_k' })], 0.8), []);
  });
});

describe('IBAN', () => {
  it('accepte un IBAN valide, espaces et minuscules compris', () => {
    assert.equal(SavePayoutBank.parse({ holder: 'Karim B', iban: 'fr76 3000 6000 0112 3456 7890 189' }).iban, 'FR7630006000011234567890189');
  });
  it('refuse une clé de contrôle fausse', () => {
    assert.throws(() => SavePayoutBank.parse({ holder: 'Karim B', iban: 'FR7630006000011234567890188' }));
  });
});

describe('Stripe Connect', () => {
  const stripe = () => new StripeConnectPayoutProvider({ apiKey: 'sk_test_x', webhookSecret: 'whsec_x', mode: 'test' });
  it('refuse une clé du mauvais mode', () => {
    assert.throws(() => new StripeConnectPayoutProvider({ apiKey: 'sk_live_x', mode: 'test' }), /clé réelle/);
  });
  it('crée un compte Express qui reçoit des virements, une seule fois par membre', async () => {
    const calls = mockFetch({ id: 'acct_1' });
    const r = await stripe().createAccount({ id: 'mem_k', email: 'k@x.fr', country: 'fr', first_name: 'Karim', last_name: 'B' });
    assert.equal(r.external_id, 'acct_1');
    const body = new URLSearchParams(calls[0].body);
    assert.equal(body.get('type'), 'express');
    assert.equal(body.get('country'), 'FR');
    assert.equal(body.get('capabilities[transfers][requested]'), 'true');
    assert.equal(calls[0].headers['Idempotency-Key'], 'account-mem_k');
  });
  it('lit l’état du compte et les derniers chiffres de l’IBAN', async () => {
    mockFetch({ payouts_enabled: true, details_submitted: true, external_accounts: { data: [{ last4: '0189', account_holder_name: 'Karim B' }] } });
    const s = await stripe().refreshAccount({ external_id: 'acct_1', data: {} });
    assert.equal(s?.status, 'active');
    assert.equal(s?.bank_last4, '0189');
    mockFetch({ payouts_enabled: false, details_submitted: true, requirements: { currently_due: ['individual.id_number'] } });
    const r = await stripe().refreshAccount({ external_id: 'acct_1', data: {} });
    assert.equal(r?.status, 'restricted');
    assert.deepEqual(r?.data?.currently_due, ['individual.id_number']);
  });
  it('vire en centimes, une seule fois par virement', async () => {
    const calls = mockFetch({ id: 'tr_1' });
    const t = await stripe().transfer({ payout_id: 'po_1', amount: 12.5, currency_code: 'EUR', account: { external_id: 'acct_1', data: {} } });
    assert.equal(t.external_id, 'tr_1');
    const body = new URLSearchParams(calls[0].body);
    assert.equal(body.get('amount'), '1250');
    assert.equal(body.get('destination'), 'acct_1');
    assert.equal(calls[0].headers['Idempotency-Key'], 'payout-po_1');
  });
  it('n’accepte que les notifications signées par Stripe', async () => {
    const raw = Buffer.from(JSON.stringify({ type: 'account.updated', data: { object: { id: 'acct_1' } } }));
    const t = Math.floor(Date.now() / 1000);
    const sig = crypto.createHmac('sha256', 'whsec_x').update(`${t}.${raw}`).digest('hex');
    assert.deepEqual(await stripe().webhook(raw, { 'stripe-signature': `t=${t},v1=${sig}` }), { external_id: 'acct_1' });
    await assert.rejects(stripe().webhook(raw, { 'stripe-signature': `t=${t},v1=${'0'.repeat(64)}` }), /invalide/);
  });
});

/**
 * The money of a Traikeur, on the development base (after `npm run seed`): a mission delivered and
 * captured gives an earning, available after the wait, then withdrawn. With the test provider (no
 * money moves). Everything it creates is removed at the end.
 */
describe('cagnotte d’un Traikeur', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  let app: TraikuApp;
  let missions: MissionModuleService;
  let payments: PaymentModuleService;
  let svc: PayoutModuleService;
  let real: PayoutProvider;
  let chloe: string;
  let karim: string;
  let before_account: Awaited<ReturnType<PayoutModuleService['accountOf']>>;
  let tax: unknown;
  const created: string[] = [];
  const started = new Date();

  before(async () => {
    app = await bootstrap(root, { subscribers: false });
    missions = app.container.resolve(MISSION_MODULE);
    payments = app.container.resolve(Modules.PAYMENT);
    svc = app.container.resolve(PAYOUT_MODULE);
    real = svc.provider;
    svc.provider = new SystemPayoutProvider();
    const members = app.container.resolve<MemberModuleService>(MEMBER_MODULE);
    const idOf = async (phone: string) => {
      const [m] = await members.listMembers({ phone }, { take: 1 });
      assert.ok(m, `Compte ${phone} introuvable : lancez npm run seed`);
      return m;
    };
    chloe = (await idOf('+33600000001')).id;
    const k = await idOf('+33600000002');
    karim = k.id;
    tax = k.tax_info;
    // Karim's own account and earnings are put back as they were at the end.
    before_account = await svc.accountOf(karim);
    if (before_account) await svc.softDeletePayoutAccounts(before_account.id);
  });

  after(async () => {
    if (!app) return;
    const members = app.container.resolve<MemberModuleService>(MEMBER_MODULE);
    await members.updateMembers({ id: karim, tax_info: tax as never });
    if (created.length) {
      const earnings = await svc.listEarnings({ mission_id: created });
      if (earnings.length) await svc.deleteEarnings(earnings.map((e) => e.id));
      const runs = await missions.listRuns({ mission_id: created });
      if (runs.length) await missions.deleteRuns(runs.map((r) => r.id));
      const pays = await payments.listPayments({ resource_id: created });
      if (pays.length) await payments.deletePayments(pays.map((p) => p.id));
      await missions.deleteMissions(created);
    }
    // Karim's payouts made by these tests (the failed ones too, which hold no earnings).
    const sent = await svc.listPayouts({ member_id: karim, created_at: { $gte: started } });
    if (sent.length) await svc.deletePayouts(sent.map((p) => p.id));
    const mine = await svc.accountOf(karim);
    if (mine) await svc.deletePayoutAccounts(mine.id);
    if (before_account) await svc.restorePayoutAccounts(before_account.id);
    svc.provider = real;
    await app.shutdown();
  });

  /** A mission published by Chloé, paid, taken by Karim and delivered with a tip; its payment captured. */
  async function delivered(title: string) {
    const { result: m } = await createMissionWorkflow(app.container).run({
      input: {
        requester_id: chloe,
        type: 'parcel',
        category: 'transfer',
        catalog_id: 'colis-carton',
        title: `Test auto · ${title}`,
        description: 'Créée par les tests automatiques.',
        size: 'S',
        weight_kg: 1,
        pickup: { label: '12 rue Garibaldi, 69006 Lyon', city: 'Lyon 6e', latitude: 45.7701, longitude: 4.8519 },
        dropoff: { label: '4 place Bellecour, 69002 Lyon', city: 'Lyon 2e', latitude: 45.7578, longitude: 4.832 },
        deadline: new Date(Date.now() + 3 * 86400000),
        recipient_name: 'Léa',
        recipient_phone: '+33600000009',
        price: 10,
      },
    });
    created.push(m.id);
    await payMissionWorkflow(app.container).run({ input: { mission_id: m.id, requester_id: chloe, provider_id: 'system', base_url: 'http://localhost:9000' } });
    await acceptMissionWorkflow(app.container).run({ input: { mission_id: m.id, traveler_id: karim } });
    const r = await missions.activeRun(m.id);
    await missions.updateRuns({ id: r!.id, step: 'delivered', status: 'done', delivered_at: new Date(), tip: 1 });
    await missions.updateMissions({ id: m.id, status: 'delivered' });
    await settleMissionPayment(app.container, m.id);
    return missions.retrieveMission(m.id);
  }

  /** The wait over: the earnings of these missions available. */
  const release = async (ids: string[]) => {
    const list = await svc.listEarnings({ mission_id: ids, status: 'pending' });
    await svc.updateEarnings(list.map((e) => ({ id: e.id, available_at: new Date(Date.now() - 1000) })));
    await svc.releaseEarnings();
  };

  it('enregistre le gain une seule fois, en attente le temps d’un litige', async () => {
    const m = await delivered('gain');
    const [e] = await recordMissionEarnings(app.container, m.id);
    assert.equal(Number(e.amount), payout(Number(m.price), Number(m.traikeur_rate)) + 1);
    assert.equal(e.status, 'pending');
    assert.ok(e.available_at.getTime() > Date.now() + 47 * 3600_000);
    assert.deepEqual(await recordMissionEarnings(app.container, m.id), []);
  });

  it('garde en attente le gain d’une mission en litige', async () => {
    const [id] = created;
    const list = await svc.listEarnings({ mission_id: id });
    await svc.updateEarnings(list.map((e) => ({ id: e.id, available_at: new Date(Date.now() - 1000) })));
    await svc.releaseEarnings([id]);
    assert.equal((await svc.listEarnings({ mission_id: id }))[0].status, 'pending');
    await svc.releaseEarnings();
    assert.equal((await svc.listEarnings({ mission_id: id }))[0].status, 'available');
  });

  it('refuse le retrait sans compte, puis sans informations fiscales', async () => {
    await assert.rejects(svc.payMember(karim), /compte où recevoir/);
    const members = app.container.resolve<MemberModuleService>(MEMBER_MODULE);
    const k = await members.retrieveMember(karim);
    const account = await svc.ensureAccount(k);
    await svc.saveBankDetails(account.id, 'Karim B', 'FR7630006000011234567890189');
    await members.updateMembers({ id: karim, tax_info: null });
    await assert.rejects(payMemberWorkflow(app.container).run({ input: { member_id: karim } }), /informations fiscales/);
    await members.updateMembers({ id: karim, tax_info: { status: 'individual', birth_date: '1990-01-01', tax_number: '1234567890123' } });
  });

  it('vire tout le disponible, une seule fois même demandé deux fois en même temps', async () => {
    const mine = (await svc.balances(karim)).find((b) => b.currency_code === 'EUR')!;
    const results = await Promise.allSettled([svc.payMember(karim), svc.payMember(karim)]);
    const sent = results.filter((r) => r.status === 'fulfilled').flatMap((r) => (r as PromiseFulfilledResult<Awaited<ReturnType<typeof svc.payMember>>>).value);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].status, 'paid');
    assert.equal(Number(sent[0].amount), mine.available);
    assert.ok(results.some((r) => r.status === 'rejected'), 'le second ne vire rien');
    const after = (await svc.balances(karim)).find((b) => b.currency_code === 'EUR')!;
    assert.equal(after.available, 0);
  });

  it('un virement refusé par le fournisseur rend les gains disponibles', async () => {
    const m = await delivered('virement refusé');
    await recordMissionEarnings(app.container, m.id);
    await release([m.id]);
    const ok = svc.provider;
    svc.provider = Object.assign(Object.create(ok), {
      transfer: async () => {
        throw new Error('solde insuffisant');
      },
    });
    try {
      const [p] = await svc.payMember(karim);
      assert.equal(p.status, 'failed');
      assert.match(p.error ?? '', /solde insuffisant/);
      assert.equal((await svc.listEarnings({ mission_id: m.id }))[0].payout_id, null);
    } finally {
      svc.provider = ok;
    }
    const [failed] = await svc.listPayouts({ member_id: karim, status: 'failed' }, { order: { created_at: 'DESC' }, take: 1 });
    const [again] = await svc.retryPayout(failed.id, 'usr_test');
    assert.equal(again.status, 'paid');
    assert.equal((await svc.retrievePayout(failed.id)).status, 'canceled');
  });

  it('suspend les virements d’un compte', async () => {
    const m = await delivered('compte suspendu');
    await recordMissionEarnings(app.container, m.id);
    await release([m.id]);
    const account = (await svc.accountOf(karim))!;
    await svc.setHold(account.id, true, 'Vérification en cours');
    await assert.rejects(svc.payMember(karim), /suspendus/);
    await svc.setHold(account.id, false, null);
    const [p] = await svc.payMember(karim);
    assert.equal(p.status, 'paid');
  });
});
