import type { AwilixContainer } from 'awilix';
import { ContainerRegistrationKeys, Modules, type Logger, type PaymentModuleService } from '@traiku/framework';
import type { MissionRow, RunRow } from '../../modules/mission/service';
import { PAYOUT_MODULE, type NewEarning, type PayoutModuleService } from '../../modules/payout';
import { currencyDigits, payout } from '../../lib/pricing';
import { getPricing } from '../../lib/regions';
import { missionService } from '../steps';

const num = (v: unknown) => Number(v ?? 0);
/** Two runs cancelled by the same action share its time (a second apart at most). */
const sameMoment = (a: Date | null, b: Date | null) => !!a && !!b && Math.abs(a.getTime() - b.getTime()) < 1000;

/**
 * What each Traikeur earned on a closed mission, as the requester paid it (lib/rules.ts):
 * - delivered: their share of the price less Traiku's commission, with the extra time, and the tip in full;
 * - the item refused after the check: the « verification only » price, less the commission;
 * - cancelled late by the requester, or the requester absent: `to_traikeur` of the fee, shared
 *   between the Traikeurs it was for.
 * Nothing when cancelled for free, expired, refused by the team, or given back by the Traikeur.
 */
export function earningsFor(m: MissionRow, runs: RunRow[], toTraikeur: number): NewEarning[] {
  const digits = currencyDigits(m.currency_code);
  const rate = num(m.traikeur_rate);
  const base = { mission_id: m.id, currency_code: m.currency_code };
  const outcome = (m.metadata as { outcome?: string } | null)?.outcome;

  if (m.status === 'delivered') {
    const done = runs.filter((r) => r.status === 'done');
    if (outcome === 'verify_only') {
      return done.map((r) => ({ ...base, member_id: r.traveler_id, run_id: r.id, kind: 'verify_only' as const, amount: payout(num(m.verify_only_price) / (done.length || 1), rate, digits) }));
    }
    const each = num(m.price) / (m.crew || 1);
    return done.map((r) => ({ ...base, member_id: r.traveler_id, run_id: r.id, kind: 'mission' as const, amount: payout(each + num(r.extra_amount), rate, digits) + num(r.tip) }));
  }

  if (m.status === 'cancelled' && num(m.cancel_fee) > 0) {
    const share = num(m.cancel_fee) * toTraikeur;
    // The requester absent: the Traikeur who stopped, at the moment the mission was cancelled.
    // Cancelled late: the Traikeurs whose run the requester cancelled.
    const kind = outcome === 'no_show' ? ('no_show' as const) : ('cancellation' as const);
    const paid = runs.filter((r) =>
      r.status === 'cancelled' && (kind === 'no_show' ? r.cancelled_by === r.traveler_id && sameMoment(r.cancelled_at, m.cancelled_at) : r.cancelled_by === m.requester_id)
    );
    return paid.map((r) => ({ ...base, member_id: r.traveler_id, run_id: r.id, kind, amount: Number((share / paid.length).toFixed(digits)) }));
  }
  return [];
}

/**
 * A closed mission's earnings, recorded once its payment is captured (settleMissionPayment). Called
 * after it on the same events; recording twice adds nothing.
 */
export async function recordMissionEarnings(container: AwilixContainer, missionId: string) {
  const payment = await container.resolve<PaymentModuleService>(Modules.PAYMENT).paymentOf(missionId);
  if (payment?.status !== 'captured') return [];
  const missions = missionService({ container });
  const mission = await missions.retrieveMission(missionId);
  const runs = await missions.listRuns({ mission_id: mission.id });
  const pricing = await getPricing(container, mission.region_id);
  const list = earningsFor(mission, runs, pricing.cancellation.to_traikeur);
  // Never more than what was captured, minus Traiku's fees: a sign the rules and the payment disagree.
  const total = list.reduce((s, e) => s + e.amount, 0);
  if (total > Number(payment.captured_amount)) {
    container.resolve<Logger>(ContainerRegistrationKeys.LOGGER).warn(`mission ${mission.id} : ${total} de gains pour ${payment.captured_amount} encaissé, non enregistrés`);
    return [];
  }
  return container.resolve<PayoutModuleService>(PAYOUT_MODULE).recordEarnings(list);
}

/** The missions with a dispute still open: their earnings wait. */
export async function blockedMissions(container: AwilixContainer) {
  const open = await missionService({ container }).listDisputes({ status: 'open' }, { select: ['mission_id'], take: 5000 });
  return [...new Set(open.map((d) => d.mission_id))];
}
