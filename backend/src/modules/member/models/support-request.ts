import { model } from '@traiku/framework';

/** « Aide et support »: a member's question to the team, and its answer (also sent as a notice). */
const SupportRequest = model.define('support_request', {
  id: model.id({ prefix: 'sup' }).primaryKey(),
  member_id: model.text().index(),
  topic: model.enum(['mission', 'payment', 'account', 'safety', 'other']).default('other'),
  message: model.text(),
  status: model.enum(['open', 'answered', 'closed']).default('open').index(),
  answer: model.text().nullable(),
  answered_by: model.text().nullable(),
  answered_at: model.dateTime().nullable(),
});

export default SupportRequest;
