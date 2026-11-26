import { currencyDigits, TraikuError, TraikuService, type Context } from '@traiku/framework';
import Earning from './models/earning';
import Payout from './models/payout';
import PayoutAccount from './models/payout-account';
import type { PayoutMember, PayoutProvider } from './providers';

export type AccountRow = Awaited<ReturnType<PayoutModuleService['retrievePayoutAccount']>>;
export type EarningRow = Awaited<ReturnType<PayoutModuleService['retrieveEarning']>>;
export type PayoutRow = Awaited<ReturnType<PayoutModuleService['retrievePayout']>>;

export type NewEarning = { member_id: string; mission_id: string; run_id: string | null; kind: EarningRow['kind']; amount: number; currency_code: string };
export type Balance = { currency_code: string; pending: number; available: number; paid: number };

/** Hours an earning waits before it can be withdrawn: time for the requester to report a problem. */
export const EARNING_HOLD_HOURS = 48;
/** Under this, in the currency's main unit, nothing is sent (the provider's fees and minimums). */
export const PAYOUT_MIN_AMOUNT = 1;

const round = (v: number, currency: string) => Number(v.toFixed(currencyDigits(currency)));
const notAllowed = (message: string, code: string) => new TraikuError(TraikuError.Types.NOT_ALLOWED, message, code);

/**
 * The Traikeurs' earnings and their transfers. Each mission closed and paid gives an earning per
 * Traikeur; it can be withdrawn EARNING_HOLD_HOURS later unless a dispute is open on the mission
 * (the caller passes those missions as `blocked`: this module never reads the missions). A payout
 * takes all that is available, in one currency, and sends it through the provider.
 */
export default class PayoutModuleService extends TraikuService({ PayoutAccount, Earning, Payout }) {
  provider!: PayoutProvider;

  /** The member's account, or null before they set one up. */
  async accountOf(member_id: string) {
    const [account] = await this.listPayoutAccounts({ member_id }, { take: 1 });
    return account ?? null;
  }

  /** The member's account, made at the provider the first time. */
  async ensureAccount(member: PayoutMember) {
    const existing = await this.accountOf(member.id);
    if (existing) return existing;
    const created = await this.provider.createAccount(member);
    return this.createPayoutAccounts({ member_id: member.id, provider_id: this.provider.id, external_id: created.external_id, status: 'pending', data: created.data ?? {} });
  }

  /** The provider's page to give the IBAN and identity (null for the test provider: the app asks them). */
  onboardingLink(account: AccountRow, urls: { return_url: string; refresh_url: string }) {
    return this.provider.onboardingLink(account, urls);
  }

  /** The provider's page of the Traikeur's transfers to the bank. */
  dashboardLink(account: AccountRow) {
    return account.status === 'active' ? this.provider.dashboardLink(account) : Promise.resolve(null);
  }

  /** Looks at the account again at the provider (back from its page, or on its webhook). */
  async syncAccount(id: string) {
    const account = await this.retrievePayoutAccount(id);
    const state = await this.provider.refreshAccount(account);
    if (!state) return account;
    return this.updatePayoutAccounts({ id, status: state.status, bank_last4: state.bank_last4, holder: state.holder ?? account.holder, data: state.data ?? account.data });
  }

  /** The account a provider's webhook is about. */
  async accountByExternalId(external_id: string) {
    const [account] = await this.listPayoutAccounts({ external_id }, { take: 1 });
    return account ?? null;
  }

  /** The test provider only: the holder and the last digits of the IBAN typed in the app; the account is then active. */
  async saveBankDetails(account_id: string, holder: string, iban: string) {
    if (!this.provider.takesBankDetails) throw notAllowed('Le compte se renseigne sur la page sécurisée de notre prestataire.', 'payout_bank_on_provider');
    const clean = iban.replace(/\s+/g, '').toUpperCase();
    return this.updatePayoutAccounts({ id: account_id, holder: holder.trim(), bank_last4: clean.slice(-4), status: 'active' });
  }

  /** The team stops (or allows again) the transfers of an account. */
  setHold(account_id: string, hold: boolean, reason: string | null) {
    return this.updatePayoutAccounts({ id: account_id, hold, hold_reason: hold ? reason : null });
  }

  /** Records what a mission earned; what is already recorded (same Traikeur, mission and kind) is left. */
  async recordEarnings(list: NewEarning[], now = new Date()) {
    const made: EarningRow[] = [];
    for (const e of list) {
      const amount = round(e.amount, e.currency_code);
      if (!(amount > 0)) continue;
      const [existing] = await this.listEarnings({ mission_id: e.mission_id, member_id: e.member_id, kind: e.kind }, { take: 1 });
      if (existing) continue;
      made.push(
        await this.createEarnings({
          ...e,
          amount,
          currency_code: e.currency_code.toUpperCase(),
          status: 'pending',
          available_at: new Date(now.getTime() + EARNING_HOLD_HOURS * 3600_000),
        })
      );
    }
    return made;
  }

  /** The earnings whose wait is over become available, except those of `blocked` missions (a dispute open). */
  async releaseEarnings(blocked: string[] = [], now = new Date()) {
    const due = await this.listEarnings({ status: 'pending', available_at: { $lte: now } }, { take: 500 });
    const ready = due.filter((e) => !blocked.includes(e.mission_id));
    if (ready.length) await this.updateEarnings(ready.map((e) => ({ id: e.id, status: 'available' as const })));
    return ready.length;
  }

  /** A mission's earnings not yet paid, cancelled (the team settled a dispute against the Traikeur). */
  async cancelMissionEarnings(mission_id: string) {
    const open = (await this.listEarnings({ mission_id })).filter((e) => e.status === 'pending' || (e.status === 'available' && !e.payout_id));
    if (open.length) await this.updateEarnings(open.map((e) => ({ id: e.id, status: 'canceled' as const })));
    return open.length;
  }

  /** What the member has: waiting, available to withdraw, already paid; one line per currency. */
  async balances(member_id: string): Promise<Balance[]> {
    const rows = await this.listEarnings({ member_id }, { take: 5000 });
    const by = new Map<string, Balance>();
    for (const e of rows) {
      if (e.status === 'canceled') continue;
      const b = by.get(e.currency_code) ?? { currency_code: e.currency_code, pending: 0, available: 0, paid: 0 };
      const amount = Number(e.amount);
      // Taken by a payout still being sent: no longer available, not paid yet.
      if (e.status === 'paid') b.paid += amount;
      else if (e.status === 'available' && !e.payout_id) b.available += amount;
      else b.pending += amount;
      by.set(e.currency_code, b);
    }
    return [...by.values()].map((b) => ({ ...b, pending: round(b.pending, b.currency_code), available: round(b.available, b.currency_code), paid: round(b.paid, b.currency_code) }));
  }

  /**
   * Sends all that is available to the member's account, one payout per currency. The earnings are
   * taken in one transaction, under a lock on the member: two requests at once never send twice.
   * A transfer refused by the provider: the payout is failed and its earnings available again.
   */
  async payMember(member_id: string, opts: { created_by?: string | null; blocked?: string[] } = {}) {
    const account = await this.accountOf(member_id);
    if (!account || account.status !== 'active') throw notAllowed('Ajoutez d’abord le compte où recevoir vos gains.', 'payout_no_account');
    if (account.hold) throw notAllowed('Les virements de ce compte sont suspendus. Contactez le support.', 'payout_on_hold');

    const reserved = await this.transaction(async (ctx: Context) => {
      await ctx.transactionManager!.raw('select pg_advisory_xact_lock(hashtext(?))', [`payout:${member_id}`]);
      const available = (await this.listEarnings({ member_id, status: 'available', payout_id: null }, { take: 5000 }, ctx)).filter((e) => !opts.blocked?.includes(e.mission_id));
      const byCurrency = new Map<string, EarningRow[]>();
      for (const e of available) byCurrency.set(e.currency_code, [...(byCurrency.get(e.currency_code) ?? []), e]);
      const made: { payout: PayoutRow; earnings: EarningRow[] }[] = [];
      for (const [currency_code, earnings] of byCurrency) {
        const amount = round(
          earnings.reduce((s, e) => s + Number(e.amount), 0),
          currency_code
        );
        if (amount < PAYOUT_MIN_AMOUNT) continue;
        const payout = await this.createPayouts(
          { member_id, account_id: account.id, provider_id: account.provider_id, amount, currency_code, status: 'pending', created_by: opts.created_by ?? null },
          ctx
        );
        await this.updateEarnings(
          earnings.map((e) => ({ id: e.id, payout_id: payout.id })),
          ctx
        );
        made.push({ payout, earnings });
      }
      return made;
    });
    if (!reserved.length) throw notAllowed(`Rien à retirer pour l’instant : il faut au moins ${PAYOUT_MIN_AMOUNT} de gains disponibles.`, 'payout_nothing');

    const done: PayoutRow[] = [];
    for (const r of reserved) done.push(await this.send(r.payout.id, account));
    return done;
  }

  /** Sends one pending payout; on failure, its earnings are available again. */
  private async send(payout_id: string, account: AccountRow) {
    const payout = await this.retrievePayout(payout_id);
    const earnings = await this.listEarnings({ payout_id });
    try {
      const t = await this.provider.transfer({ payout_id, amount: Number(payout.amount), currency_code: payout.currency_code, account });
      await this.updateEarnings(earnings.map((e) => ({ id: e.id, status: 'paid' as const })));
      return this.updatePayouts({ id: payout_id, status: 'paid', external_id: t.external_id, paid_at: new Date(), error: null });
    } catch (e) {
      this.logger.error(`virement ${payout_id} (${account.provider_id}) : ${(e as Error).message}`);
      await this.updateEarnings(earnings.map((x) => ({ id: x.id, payout_id: null })));
      return this.updatePayouts({ id: payout_id, status: 'failed', error: (e as Error).message, failed_at: new Date() });
    }
  }

  /** A failed payout sent again: its earnings were made available, so a new payout takes them. */
  async retryPayout(payout_id: string, created_by: string | null, blocked: string[] = []) {
    const payout = await this.retrievePayout(payout_id);
    if (payout.status !== 'failed') throw notAllowed('Seul un virement échoué peut être relancé.', 'payout_not_failed');
    await this.updatePayouts({ id: payout_id, status: 'canceled' });
    return this.payMember(payout.member_id, { created_by, blocked });
  }
}
