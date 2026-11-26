import { model } from '@traiku/framework';
import type { SelfiePose } from '../../../lib/identity';

/**
 * Identity check at sign-up: the document (front, back) and a live selfie, sent by the member. The
 * provider (the team in the admin for now, a certified service later) compares the document's photo
 * with the face; the selfie then stays the reference the face checks of the missions are compared to.
 */
const IdentityCheck = model.define('identity_check', {
  id: model.id({ prefix: 'idc' }).primaryKey(),
  member_id: model.text().index(),
  /** cni, passport, driving_licence, residence_permit, eu_id… (see lib/identity.ts). */
  document_type: model.text(),
  front_file_id: model.text(),
  back_file_id: model.text().nullable(),
  selfie_file_id: model.text(),
  /** The other photos of the live selfie, one per pose (see SELFIE_POSES); empty for the older checks. */
  pose_file_ids: model.json<Partial<Record<SelfiePose, string>>>().default({}),
  status: model.enum(['pending', 'verified', 'refused', 'replaced']).default('pending').index(),
  /** Why it was refused, written for the member. */
  reason: model.text().nullable(),
  /** "manual" (the team) or the certified service, with its own reference. */
  provider: model.text().default('manual'),
  provider_ref: model.text().nullable(),
  reviewed_by: model.text().nullable(),
  reviewed_at: model.dateTime().nullable(),
  /** The member agreed to the comparison of their photos (biometric data: explicit consent). */
  consent_at: model.dateTime(),
});

export default IdentityCheck;
