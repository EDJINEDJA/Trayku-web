import { stripeForm, toMinor, verifyStripeSignature, type PaymentMode } from '@traiku/framework';

/**
 * Where the Traikeurs' earnings go: one provider for the whole platform, in test or live mode as the
 * payments. Stripe Connect keeps each Traikeur's IBAN and identity checks on its own pages; the test
 * provider takes the holder and the IBAN in the app and moves no money.
 */

export type AccountData = Record<string, unknown>;
export type AccountState = { status: 'pending' | 'active' | 'restricted'; bank_last4: string | null; holder: string | null; data?: AccountData };

export type PayoutMember = { id: string; email: string | null; country: string | null; first_name: string; last_name: string | null };
export type PayoutAccountRef = { external_id: string | null; data: AccountData };

export interface PayoutProvider {
  id: string;
  mode: PaymentMode;
  /** The test provider: the holder and the IBAN are typed in the app (only the last digits kept). */
  takesBankDetails: boolean;
  createAccount(member: PayoutMember): Promise<{ external_id: string | null; data?: AccountData }>;
  /** The provider's page where the Traikeur gives their IBAN and identity; null when there is none. */
  onboardingLink(account: PayoutAccountRef, urls: { return_url: string; refresh_url: string }): Promise<string | null>;
  /** Where the account stands at the provider. */
  refreshAccount(account: PayoutAccountRef): Promise<AccountState | null>;
  /** The provider's page where the Traikeur sees their transfers to the bank; null when there is none. */
  dashboardLink(account: PayoutAccountRef): Promise<string | null>;
  /** Sends `amount` to the account; the same payout_id never sends twice. */
  transfer(input: { payout_id: string; amount: number; currency_code: string; account: PayoutAccountRef }): Promise<{ external_id: string }>;
  /** A notification from the provider, checked: the account it is about, to look at again. */
  webhook?(raw: Buffer, headers: Record<string, string | string[] | undefined>): Promise<{ external_id: string | null }>;
}

/** Development and tests: the account is active once the IBAN is typed, every transfer is done at once. */
export class SystemPayoutProvider implements PayoutProvider {
  id = 'system';
  mode: PaymentMode = 'test';
  takesBankDetails = true;
  async createAccount() {
    return { external_id: null };
  }
  async onboardingLink() {
    return null;
  }
  async refreshAccount() {
    return null;
  }
  async dashboardLink() {
    return null;
  }
  async transfer(input: { payout_id: string }) {
    return { external_id: `test_${input.payout_id}` };
  }
}

export type StripeConnectOptions = { apiKey: string; webhookSecret?: string; mode: PaymentMode };

/**
 * Stripe Connect, Express accounts: the Traikeur gives their identity and IBAN on Stripe's pages,
 * Trayku sends their earnings with a transfer, and Stripe pays them out to the bank on its schedule.
 * The transfers come from the platform's Stripe balance.
 */
export class StripeConnectPayoutProvider implements PayoutProvider {
  id = 'stripe';
  takesBankDetails = false;
  readonly mode: PaymentMode;
  constructor(private readonly options: StripeConnectOptions) {
    const keyMode: PaymentMode = options.apiKey.startsWith('sk_live_') || options.apiKey.startsWith('rk_live_') ? 'live' : 'test';
    if (keyMode !== options.mode) throw new Error(`Stripe Connect : la clé est une clé ${keyMode === 'live' ? 'réelle' : 'de test'} alors que le mode est « ${options.mode} »`);
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

  async createAccount(member: PayoutMember) {
    const account = await this.call<{ id: string }>(
      'POST',
      '/accounts',
      {
        type: 'express',
        country: (member.country ?? 'FR').toUpperCase(),
        email: member.email ?? undefined,
        business_type: 'individual',
        individual: { first_name: member.first_name, last_name: member.last_name ?? undefined, email: member.email ?? undefined },
        capabilities: { transfers: { requested: true } },
        metadata: { member_id: member.id },
      },
      `account-${member.id}`
    );
    return { external_id: account.id };
  }

  async onboardingLink(account: PayoutAccountRef, urls: { return_url: string; refresh_url: string }) {
    if (!account.external_id) return null;
    const link = await this.call<{ url: string }>('POST', '/account_links', { account: account.external_id, type: 'account_onboarding', ...urls });
    return link.url;
  }

  async refreshAccount(account: PayoutAccountRef): Promise<AccountState | null> {
    if (!account.external_id) return null;
    const a = await this.call<{
      payouts_enabled: boolean;
      details_submitted: boolean;
      requirements?: { currently_due?: string[]; disabled_reason?: string | null };
      external_accounts?: { data?: { last4?: string; account_holder_name?: string | null }[] };
    }>('GET', `/accounts/${account.external_id}`);
    const bank = a.external_accounts?.data?.[0];
    const status = a.payouts_enabled ? 'active' : a.details_submitted ? 'restricted' : 'pending';
    return {
      status,
      bank_last4: bank?.last4 ?? null,
      holder: bank?.account_holder_name ?? null,
      data: { ...account.data, currently_due: a.requirements?.currently_due ?? [], disabled_reason: a.requirements?.disabled_reason ?? null },
    };
  }

  async dashboardLink(account: PayoutAccountRef) {
    if (!account.external_id) return null;
    const link = await this.call<{ url: string }>('POST', `/accounts/${account.external_id}/login_links`);
    return link.url;
  }

  async transfer(input: { payout_id: string; amount: number; currency_code: string; account: PayoutAccountRef }) {
    if (!input.account.external_id) throw new Error('Stripe Connect : compte sans identifiant');
    const t = await this.call<{ id: string }>(
      'POST',
      '/transfers',
      {
        amount: toMinor(input.amount, input.currency_code),
        currency: input.currency_code.toLowerCase(),
        destination: input.account.external_id,
        transfer_group: input.payout_id,
        metadata: { payout_id: input.payout_id },
      },
      `payout-${input.payout_id}`
    );
    return { external_id: t.id };
  }

  /** Checked with the Connect endpoint's secret: an account updated, looked at again. */
  async webhook(raw: Buffer, headers: Record<string, string | string[] | undefined>) {
    const secret = this.options.webhookSecret;
    if (!secret) throw new Error('Stripe Connect : STRIPE_*_CONNECT_WEBHOOK_SECRET manquant');
    verifyStripeSignature(raw, String(headers['stripe-signature'] ?? ''), secret);
    const event = JSON.parse(raw.toString('utf8')) as { type: string; account?: string; data: { object: { id?: string; object?: string } } };
    if (event.type === 'account.updated') return { external_id: event.data.object.id ?? null };
    // An event about something of a connected account (its bank, a payout to the bank): that account.
    return { external_id: event.account ?? null };
  }
}
