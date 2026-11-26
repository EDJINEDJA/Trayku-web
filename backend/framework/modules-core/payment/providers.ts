import crypto from 'node:crypto';

/**
 * As Medusa's payment providers: one per way of paying, each in test (the provider's sandbox) or
 * live mode. The payer is sent to the provider's page (redirect_url) and comes back; the amount is
 * only reserved there, then captured (in full or in part), cancelled or refunded.
 */

export type PaymentMode = 'test' | 'live';
export type ProviderData = Record<string, unknown>;
export type ProviderStatus = 'pending' | 'authorized' | 'canceled' | 'error';

export type InitiateInput = {
  payment_id: string;
  amount: number;
  currency_code: string;
  description: string;
  /** Where the provider sends the payer back, paid or not. */
  return_url: string;
  cancel_url: string;
};

export interface PaymentProvider {
  id: string;
  /** Shown to the payer. */
  label: string;
  mode: PaymentMode;
  /** Opens the payment; `authorized` at once for the test provider, else a page to send the payer to. */
  initiate(input: InitiateInput): Promise<{ data: ProviderData; status: ProviderStatus; redirect_url?: string }>;
  /** After the payer came back (or a webhook): where it stands at the provider. */
  getStatus(data: ProviderData, input: { amount: number; currency_code: string }): Promise<{ data: ProviderData; status: ProviderStatus }>;
  capture(data: ProviderData, amount: number, currency_code: string): Promise<ProviderData>;
  cancel(data: ProviderData): Promise<ProviderData>;
  refund(data: ProviderData, amount: number, currency_code: string): Promise<ProviderData>;
  /** A notification from the provider, checked: the payment it is about, to look at again. */
  webhook?(raw: Buffer, headers: Record<string, string | string[] | undefined>): Promise<{ payment_id: string | null }>;
}

/** Digits of a currency: 2 for the euro, 0 for the yen, 3 for the Kuwaiti dinar. */
export const currencyDigits = (currency: string) => new Intl.NumberFormat('en', { style: 'currency', currency: currency.toUpperCase() }).resolvedOptions().maximumFractionDigits ?? 2;
/** 12.5 € → 1250 (cents), as Stripe wants it. */
export const toMinor = (amount: number, currency: string) => Math.round(amount * 10 ** currencyDigits(currency));
/** 12.5 € → "12.50", as PayPal wants it. */
export const toDecimal = (amount: number, currency: string) => amount.toFixed(currencyDigits(currency));

/** Development and tests: nothing is charged, every payment is accepted at once. As Medusa's pp_system_default. */
export class SystemPaymentProvider implements PaymentProvider {
  id = 'system';
  label = 'Paiement test (aucun débit)';
  mode: PaymentMode = 'test';
  async initiate() {
    return { data: {}, status: 'authorized' as const };
  }
  async getStatus(data: ProviderData) {
    return { data, status: (data.canceled ? 'canceled' : 'authorized') as ProviderStatus };
  }
  async capture(data: ProviderData, amount: number) {
    return { ...data, captured: amount };
  }
  async cancel(data: ProviderData) {
    return { ...data, canceled: true };
  }
  async refund(data: ProviderData, amount: number) {
    return { ...data, refunded: Number(data.refunded ?? 0) + amount };
  }
}

/** { a: { b: 1 }, c: [x] } → a[b]=1&c[0]=x: the encoding of Stripe's API. */
export function stripeForm(obj: Record<string, unknown>, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === 'object' ? stripeForm(item as Record<string, unknown>, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(item))));
    else if (typeof v === 'object') stripeForm(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}

export type StripeOptions = { apiKey: string; webhookSecret?: string; mode: PaymentMode };

/**
 * Stripe Checkout: card, Apple Pay, Google Pay (and the methods turned on in the Stripe
 * dashboard), the amount reserved (capture_method manual), captured when the mission is done.
 * The mode follows the key: sk_test_… is the sandbox, sk_live_… real money.
 */
export class StripePaymentProvider implements PaymentProvider {
  id = 'stripe';
  label = 'Carte bancaire, Apple Pay, Google Pay';
  readonly mode: PaymentMode;
  constructor(private readonly options: StripeOptions) {
    const keyMode: PaymentMode = options.apiKey.startsWith('sk_live_') || options.apiKey.startsWith('rk_live_') ? 'live' : 'test';
    if (keyMode !== options.mode) throw new Error(`Stripe : la clé est une clé ${keyMode === 'live' ? 'réelle' : 'de test'} alors que le mode est « ${options.mode} »`);
    this.mode = options.mode;
  }

  private async call<T>(method: 'GET' | 'POST', path: string, params?: Record<string, unknown>, idempotencyKey?: string): Promise<T> {
    const body = params ? stripeForm(params) : undefined;
    const url = `https://api.stripe.com/v1${path}${method === 'GET' && body ? `?${body}` : ''}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(idempotencyKey && { 'Idempotency-Key': idempotencyKey }),
      },
      body: method === 'POST' ? body : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
    if (!res.ok) throw new Error(`Stripe ${res.status} : ${json.error?.message ?? 'erreur'}`);
    return json;
  }

  async initiate(input: InitiateInput) {
    const session = await this.call<{ id: string; url: string }>(
      'POST',
      '/checkout/sessions',
      {
        mode: 'payment',
        client_reference_id: input.payment_id,
        success_url: input.return_url,
        cancel_url: input.cancel_url,
        line_items: [{ quantity: 1, price_data: { currency: input.currency_code.toLowerCase(), unit_amount: toMinor(input.amount, input.currency_code), product_data: { name: input.description } } }],
        payment_intent_data: { capture_method: 'manual', metadata: { payment_id: input.payment_id } },
        metadata: { payment_id: input.payment_id },
      },
      `initiate-${input.payment_id}`
    );
    return { data: { session_id: session.id }, status: 'pending' as const, redirect_url: session.url };
  }

  async getStatus(data: ProviderData) {
    if (!data.session_id) return { data, status: 'error' as const };
    const s = await this.call<{ status: string; payment_intent: { id: string; status: string } | string | null }>('GET', `/checkout/sessions/${data.session_id}`, { expand: ['payment_intent'] });
    const pi = typeof s.payment_intent === 'object' ? s.payment_intent : null;
    const next = { ...data, ...(pi && { payment_intent_id: pi.id }) };
    if (pi?.status === 'requires_capture' || pi?.status === 'succeeded') return { data: next, status: 'authorized' as const };
    if (s.status === 'expired' || pi?.status === 'canceled') return { data: next, status: 'canceled' as const };
    return { data: next, status: 'pending' as const };
  }

  async capture(data: ProviderData, amount: number, currency: string) {
    const pi = await this.call<{ id: string; latest_charge: string | null }>('POST', `/payment_intents/${data.payment_intent_id}/capture`, { amount_to_capture: toMinor(amount, currency) }, `capture-${data.payment_intent_id}`);
    return { ...data, charge_id: pi.latest_charge };
  }

  async cancel(data: ProviderData) {
    if (data.payment_intent_id) await this.call('POST', `/payment_intents/${data.payment_intent_id}/cancel`, {}, `cancel-${data.payment_intent_id}`);
    else if (data.session_id) await this.call('POST', `/checkout/sessions/${data.session_id}/expire`).catch(() => undefined);
    return data;
  }

  async refund(data: ProviderData, amount: number, currency: string) {
    const r = await this.call<{ id: string }>('POST', '/refunds', { payment_intent: data.payment_intent_id, amount: toMinor(amount, currency) });
    return { ...data, refund_ids: [...((data.refund_ids as string[]) ?? []), r.id] };
  }

  /** Checked with the endpoint's secret (Stripe-Signature: t=…,v1=…), as Stripe's SDK does. */
  async webhook(raw: Buffer, headers: Record<string, string | string[] | undefined>) {
    const secret = this.options.webhookSecret;
    if (!secret) throw new Error('Stripe : STRIPE_*_WEBHOOK_SECRET manquant');
    verifyStripeSignature(raw, String(headers['stripe-signature'] ?? ''), secret);
    const event = JSON.parse(raw.toString('utf8')) as { type: string; data: { object: { metadata?: { payment_id?: string }; client_reference_id?: string } } };
    const o = event.data.object;
    return { payment_id: o.metadata?.payment_id ?? o.client_reference_id ?? null };
  }
}

/** Throws unless the signature is Stripe's, made less than `toleranceS` ago. */
export function verifyStripeSignature(raw: Buffer, header: string, secret: string, toleranceS = 300, now = Date.now()) {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]));
  const signatures = header
    .split(',')
    .filter((p) => p.startsWith('v1='))
    .map((p) => p.slice(3));
  const t = Number(parts.t);
  if (!t || !signatures.length) throw new Error('Signature Stripe absente');
  if (Math.abs(now / 1000 - t) > toleranceS) throw new Error('Signature Stripe trop ancienne');
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${raw.toString('utf8')}`).digest('hex');
  const ok = signatures.some((s) => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
  if (!ok) throw new Error('Signature Stripe invalide');
}

export type PaypalOptions = { clientId: string; clientSecret: string; mode: PaymentMode };

/**
 * PayPal Checkout (Orders v2): the payer approves on PayPal, the amount is then authorized and
 * captured at the end. Test mode uses PayPal's sandbox.
 */
export class PaypalPaymentProvider implements PaymentProvider {
  id = 'paypal';
  label = 'PayPal';
  readonly mode: PaymentMode;
  private token: { value: string; until: number } | null = null;
  constructor(private readonly options: PaypalOptions) {
    this.mode = options.mode;
  }
  private get base() {
    return this.mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  }

  private async accessToken() {
    if (this.token && this.token.until > Date.now()) return this.token.value;
    const res = await fetch(`${this.base}/v1/oauth2/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${this.options.clientId}:${this.options.clientSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
    if (!res.ok || !json.access_token) throw new Error(`PayPal ${res.status} : ${json.error_description ?? 'connexion refusée'}`);
    this.token = { value: json.access_token, until: Date.now() + ((json.expires_in ?? 300) - 60) * 1000 };
    return json.access_token;
  }

  private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown, requestId?: string): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: { Authorization: `Bearer ${await this.accessToken()}`, 'Content-Type': 'application/json', ...(requestId && { 'PayPal-Request-Id': requestId }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const json = (text ? JSON.parse(text) : {}) as T & { message?: string; details?: { description?: string }[] };
    if (!res.ok) throw new Error(`PayPal ${res.status} : ${json.details?.[0]?.description ?? json.message ?? 'erreur'}`);
    return json;
  }

  async initiate(input: InitiateInput) {
    const order = await this.call<{ id: string; links: { rel: string; href: string }[] }>(
      'POST',
      '/v2/checkout/orders',
      {
        intent: 'AUTHORIZE',
        purchase_units: [{ reference_id: input.payment_id, custom_id: input.payment_id, description: input.description.slice(0, 127), amount: { currency_code: input.currency_code.toUpperCase(), value: toDecimal(input.amount, input.currency_code) } }],
        payment_source: { paypal: { experience_context: { brand_name: 'Traiku', user_action: 'PAY_NOW', shipping_preference: 'NO_SHIPPING', return_url: input.return_url, cancel_url: input.cancel_url } } },
      },
      `initiate-${input.payment_id}`
    );
    const approve = order.links.find((l) => l.rel === 'payer-action' || l.rel === 'approve');
    return { data: { order_id: order.id }, status: 'pending' as const, redirect_url: approve?.href };
  }

  async getStatus(data: ProviderData) {
    if (data.authorization_id) return { data, status: 'authorized' as const };
    type Order = { status: string; purchase_units?: { payments?: { authorizations?: { id: string; status: string }[] } }[] };
    const order = await this.call<Order>('GET', `/v2/checkout/orders/${data.order_id}`);
    const authOf = (o: Order) => o.purchase_units?.[0]?.payments?.authorizations?.[0];
    if (order.status === 'APPROVED') {
      // Approved by the payer: the amount is reserved now.
      const done = await this.call<Order>('POST', `/v2/checkout/orders/${data.order_id}/authorize`, {}, `authorize-${data.order_id}`);
      const auth = authOf(done);
      return auth ? { data: { ...data, authorization_id: auth.id }, status: 'authorized' as const } : { data, status: 'error' as const };
    }
    const auth = authOf(order);
    if (order.status === 'COMPLETED' && auth) return { data: { ...data, authorization_id: auth.id }, status: 'authorized' as const };
    if (order.status === 'VOIDED') return { data, status: 'canceled' as const };
    return { data, status: 'pending' as const };
  }

  async capture(data: ProviderData, amount: number, currency: string) {
    const c = await this.call<{ id: string }>(
      'POST',
      `/v2/payments/authorizations/${data.authorization_id}/capture`,
      { amount: { currency_code: currency.toUpperCase(), value: toDecimal(amount, currency) }, final_capture: true },
      `capture-${data.authorization_id}`
    );
    return { ...data, capture_id: c.id };
  }

  async cancel(data: ProviderData) {
    if (data.authorization_id) await this.call('POST', `/v2/payments/authorizations/${data.authorization_id}/void`, undefined, `void-${data.authorization_id}`);
    return data;
  }

  async refund(data: ProviderData, amount: number, currency: string) {
    const r = await this.call<{ id: string }>('POST', `/v2/payments/captures/${data.capture_id}/refund`, { amount: { currency_code: currency.toUpperCase(), value: toDecimal(amount, currency) } });
    return { ...data, refund_ids: [...((data.refund_ids as string[]) ?? []), r.id] };
  }
}
