import { model } from '@traiku/framework';

/**
 * A trade's proof (diploma, certificate, professional card), sent to become a certified verifier
 * in that trade. The team checks it in the admin; approved, the member gets the certificate.
 * Or (kind licence) a driving licence, to bring back a car or a motorbike: its categories in `title`
 * (« B, A2 »); approved, it opens those missions, nothing else.
 */
const Credential = model.define('credential', {
  id: model.id({ prefix: 'cred' }).primaryKey(),
  member_id: model.text().index(),
  kind: model.enum(['trade', 'licence']).default('trade'),
  /** The trade, from the list or written by the member. */
  profession: model.text(),
  /** What the proof is ("CAP mécanique", "Carte professionnelle"…). */
  title: model.text().nullable(),
  file_ids: model.json<string[]>(),
  status: model.enum(['pending', 'approved', 'refused']).default('pending').index(),
  reason: model.text().nullable(),
  reviewed_by: model.text().nullable(),
  reviewed_at: model.dateTime().nullable(),
});

export default Credential;
