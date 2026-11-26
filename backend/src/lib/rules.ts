import type { MissionRow, RunRow } from '../modules/mission/service';
import type { Pricing } from './pricing';

/**
 * The rules the app shows (mobile: services/cancellation.ts, data/rules.ts), enforced here: the app
 * explains them, the backend decides.
 */

// The cancellation's numbers (free minutes, shares, minimum) are in the price scale: lib/pricing.ts.
/** A Traikeur who gives back this many missions in 30 days is suspended for a week. */
export const WITHDRAW_LIMIT = 3;
/** Vérification et retrait: minutes the requester has to answer the report and pay the seller. */
export const DECISION_MIN = 30;
/** Face check: how far from the pickup the Traikeur may be (when the location check is on). */
export const PICKUP_RADIUS_M = 150;
/**
 * The Traikeur's position checked against the address (arrival, requester absent): always in production;
 * elsewhere unless CHECK_PICKUP_LOCATION=false, for testing from a desk.
 */
export const locationChecked = () => process.env.NODE_ENV === 'production' || process.env.CHECK_PICKUP_LOCATION !== 'false';
/** Requester absent declared by a Traikeur this many times in 30 days: flagged to the team. */
export const NO_SHOW_FLAG = 3;

const half = (v: number) => Math.round(v * 2) / 2;

export type CancelTerms = { allowed: boolean; fee: number; toTraikeur: number; toTraiku: number; refund: number; why: string };

/** What cancelling costs the requester. Free until someone accepts, then part of the price. */
export function cancelTerms(m: MissionRow, run: RunRow | null, p: Pricing, now = Date.now()): CancelTerms {
  const c = p.cancellation;
  // Traiku's fees (service, insurance) are given back with the price, whatever the case.
  const fees = Number(m.service_fee ?? 0) + Number(m.insurance_fee ?? 0);
  const free = (why: string): CancelTerms => ({ allowed: true, fee: 0, toTraikeur: 0, toTraiku: 0, refund: m.price + fees, why });
  if (m.status === 'awaiting_payment') return free('Le paiement n’est pas encore fait : rien ne vous sera débité.');
  if (m.status === 'open' || m.status === 'review') return free('Aucun Traikeur n’a encore accepté : la réservation sur votre carte est levée.');
  if (m.status === 'cancelled' || m.status === 'delivered') return { allowed: false, fee: 0, toTraikeur: 0, toTraiku: 0, refund: 0, why: 'Cette mission est déjà terminée.' };
  const step = run?.step ?? 'confirmed';
  if (step !== 'confirmed') {
    return { allowed: false, fee: 0, toTraikeur: 0, toTraiku: 0, refund: 0, why: 'Le Traikeur est déjà parti : la mission va jusqu’au bout. En cas de souci, écrivez-lui ou contactez le support.' };
  }
  if (run?.accepted_at && now - run.accepted_at.getTime() < c.grace_minutes * 60000) return free(`Moins de ${c.grace_minutes} minutes après l’acceptation : c’est encore gratuit.`);
  const start = (m.appointment ?? m.window_start ?? m.deadline).getTime();
  const early = start - now > c.late_hours * 3600000;
  const share = early ? c.share_early : c.share_late;
  const fee = Math.min(m.price, Math.max(c.min_fee, half(m.price * share)));
  const toTraikeur = half(fee * c.to_traikeur);
  const why = `Un Traikeur a accepté et prévu son trajet. ${early ? 'Plus' : 'Moins'} de ${c.late_hours} h avant : ${Math.round(share * 100)} % du prix.`;
  return { allowed: true, fee, toTraikeur, toTraiku: fee - toTraikeur, refund: m.price + fees - fee, why };
}

/** A Traikeur giving a mission back: free in the first minutes, otherwise counted over 30 days. */
export function withdrawTerms(run: RunRow, withdrawals: string[], p: Pricing, now = Date.now()) {
  const free = now - run.accepted_at.getTime() < p.cancellation.grace_minutes * 60000;
  return { free, count: recentWithdrawals(withdrawals, now).length + 1 };
}

/** The withdrawals of the last 30 days. */
export const recentWithdrawals = (withdrawals: string[], now = Date.now()) => withdrawals.filter((w) => now - new Date(w).getTime() < 30 * 86400000);

/** Verification missions: the Traikeur needs the Traiku certificate (test passed or pro proof checked). */
export const needsVerifier = (m: MissionRow) => m.category === 'check' || m.category === 'checkpickup';

/** The face check opens the pickup: parcels and stores, the seller's door, the place of an on-site mission. */
export const isOnsite = (m: MissionRow) => m.mode === 'onsite' || m.mode === 'pro';

/**
 * An assistance service at someone's (a pro's repair, a small job at home): timed between two codes the
 * requester gives, the presence code on arrival (after the face) and the end code; no photos.
 */
export const isIntervention = (m: Pick<MissionRow, 'mode' | 'catalog_id'>) => m.mode === 'pro' || !!m.catalog_id?.startsWith('job-');
/** The requester's answer to a request for more time: after this, it counts as refused. */
export const EXTRA_ANSWER_MIN = 5;
/** Waiting on arrival for the presence code: after this, the Traikeur may stop, paid for the trip. */
export const NO_SHOW_MIN = 15;
/** Over the time planned, what is not counted: a quarter of it, 5 to 15 minutes. */
export const overtimeTolerance = (minutes: number) => Math.min(15, Math.max(5, Math.round(minutes * 0.25)));
/** The requester absent on arrival: what they pay, as a late cancellation; most of it to the Traikeur. */
export function noShowTerms(m: MissionRow, p: Pricing) {
  const c = p.cancellation;
  const fee = Math.min(m.price, Math.max(c.min_fee, half(m.price * c.share_late)));
  const toTraikeur = half(fee * c.to_traikeur);
  return { fee, toTraikeur, toTraiku: fee - toTraikeur };
}
