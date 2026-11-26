import { model, type AnyDmlEntity } from '@traiku/framework';
import { RUN_STEPS, type FaceCheck, type LatLng, type ProofPhoto } from '../types';
import Mission from './mission';
import RunEvent from './run-event';

/**
 * A mission once accepted: one Traikeur, the steps and their proofs. The codes are never shown to
 * the Traikeur: the pickup one goes to whoever hands over, the dropoff one to the recipient or the
 * requester. 3 wrong tries lock the run until the support steps in.
 */
const Run = model.define('run', {
  id: model.id({ prefix: 'run' }).primaryKey(),
  mission: model.belongsTo(() => Mission),
  traveler_id: model.text().index(),
  trip_id: model.text().nullable(),
  step: model.enum(RUN_STEPS).default('confirmed'),
  status: model.enum(['active', 'done', 'cancelled']).default('active').index(),
  pickup_code: model.text(),
  dropoff_code: model.text(),
  code_attempts: model.number().default(0),
  locked_at: model.dateTime().nullable(),
  accepted_at: model.dateTime(),
  /** Face check passed: the exact pickup details and the contact open. */
  pickup_unlocked_at: model.dateTime().nullable(),
  pickup_code_at: model.dateTime().nullable(),
  seller_checked_at: model.dateTime().nullable(),
  picked_at: model.dateTime().nullable(),
  delivered_at: model.dateTime().nullable(),
  cancelled_at: model.dateTime().nullable(),
  cancelled_by: model.text().nullable(),
  pickup_photo: model.json<ProofPhoto>().nullable(),
  dropoff_photo: model.json<ProofPhoto>().nullable(),
  faces: model.json<FaceCheck[]>().default([]),
  before_photos: model.json<ProofPhoto[]>().default([]),
  work_photos: model.json<ProofPhoto[]>().default([]),
  /** Vérification: the draft on the Traikeur's phone, then the signed report. */
  inspection: model.json().nullable(),
  report: model.json().nullable(),
  report_sent_at: model.dateTime().nullable(),
  decision: model.enum(['accepted', 'refused', 'expired']).nullable(),
  decided_at: model.dateTime().nullable(),
  leg_started_at: model.dateTime().nullable(),
  leg_from: model.json<LatLng>().nullable(),
  tip: model.bigNumber().default(0),
  /** On site: extra time the requester accepted, paid on top of the price (see lib/pricing.ts). */
  extra_minutes: model.number().default(0),
  extra_amount: model.bigNumber().default(0),
  /** The Traikeur's request waiting for the requester's answer. */
  extra_request: model.json<{ minutes: number; amount: number; reason: string | null; at: string }>().nullable(),
  events: model.hasMany((): AnyDmlEntity => RunEvent),
});

export default Run;
