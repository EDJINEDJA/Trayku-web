import crypto from 'node:crypto';
import type { AwilixContainer } from 'awilix';
import { ContainerRegistrationKeys, type ConfigModule } from '@traiku/framework';
import { MISSION_MODULE, type MissionModuleService } from '../../modules/mission';
import { EARNING_HOLD_HOURS, PAYOUT_MIN_AMOUNT, PAYOUT_MODULE, type AccountRow, type PayoutModuleService, type PayoutRow } from '../../modules/payout';

/** The account as the app and the team see it: never the provider's data. */
export const accountView = (a: AccountRow | null, svc: PayoutModuleService) => ({
  provider_id: svc.provider.id,
  /** The test provider: the app asks the holder and the IBAN itself. */
  takes_bank_details: svc.provider.takesBankDetails,
  status: a?.status ?? 'none',
  bank_last4: a?.bank_last4 ?? null,
  holder: a?.holder ?? null,
  hold: a?.hold ?? false,
  hold_reason: a?.hold_reason ?? null,
  /** What the provider still asks for (Stripe's field names), for the team. */
  currently_due: ((a?.data as { currently_due?: string[] } | undefined)?.currently_due ?? []) as string[],
});

export const payoutView = (p: PayoutRow) => ({
  id: p.id,
  amount: Number(p.amount),
  currency_code: p.currency_code,
  status: p.status,
  error: p.error,
  by_team: !!p.created_by,
  created_at: p.created_at,
  paid_at: p.paid_at,
});

/**
 * A member's wallet: their account, what they have (waiting, available, paid), the earnings of the
 * last 3 years with each mission's title, and their payouts.
 */
export async function walletOf(scope: AwilixContainer, member_id: string) {
  const svc = scope.resolve<PayoutModuleService>(PAYOUT_MODULE);
  const since = new Date(Date.now() - 3 * 365 * 86400_000);
  const [account, balances, earnings, payouts] = await Promise.all([
    svc.accountOf(member_id),
    svc.balances(member_id),
    svc.listEarnings({ member_id, created_at: { $gte: since } }, { order: { created_at: 'DESC' }, take: 2000 }),
    svc.listPayouts({ member_id }, { order: { created_at: 'DESC' }, take: 100 }),
  ]);
  const ids = [...new Set(earnings.map((e) => e.mission_id))];
  const missions = ids.length ? await scope.resolve<MissionModuleService>(MISSION_MODULE).listMissions({ id: ids }, { select: ['id', 'title'] }) : [];
  const title = new Map(missions.map((m) => [m.id, m.title]));
  return {
    account: accountView(account, svc),
    balances,
    hold_hours: EARNING_HOLD_HOURS,
    min_amount: PAYOUT_MIN_AMOUNT,
    earnings: earnings
      .filter((e) => e.status !== 'canceled')
      .map((e) => ({
        id: e.id,
        mission_id: e.mission_id,
        title: title.get(e.mission_id) ?? null,
        kind: e.kind,
        amount: Number(e.amount),
        currency_code: e.currency_code,
        status: e.status === 'available' && e.payout_id ? 'pending' : e.status,
        available_at: e.available_at,
        created_at: e.created_at,
      })),
    payouts: payouts.filter((p) => p.status !== 'canceled').map(payoutView),
  };
}

/**
 * Signs the provider's return address for one member: only the link made for them opens their
 * account's page again (a new onboarding link lets one change the IBAN).
 */
const signature = (scope: AwilixContainer, member_id: string) =>
  crypto.createHmac('sha256', scope.resolve<ConfigModule>(ContainerRegistrationKeys.CONFIG_MODULE).projectConfig.http.jwtSecret).update(`payout-return:${member_id}`).digest('hex').slice(0, 32);

/** The provider's return address for a member: back into the app, or a new link when `refresh`. */
export function payoutReturnUrl(scope: AwilixContainer, base: string, provider_id: string, member_id: string, refresh: boolean, to: string | null) {
  const q = new URLSearchParams({ member: member_id, sig: signature(scope, member_id), ...(refresh && { refresh: '1' }), ...(to && { to }) });
  return `${base}/hooks/payout/${provider_id}/return?${q}`;
}

/** The return address was made by this server for this member. */
export function payoutReturnSigned(scope: AwilixContainer, member_id: string, sig: unknown) {
  const expected = signature(scope, member_id);
  return typeof sig === 'string' && sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

/** Only the app's own addresses: the browser is never sent elsewhere from the provider's return. */
export const appAddress = (to: unknown) => (typeof to === 'string' && /^(trayku|traiku|exps?):\/\//.test(to) ? to : null);
