import { model } from '@traiku/framework';

/**
 * A transfer of available earnings to a Traikeur's account, asked by them or by the team. pending
 * while it is sent, paid once the provider took it (it then reaches the bank in 2 to 3 working days),
 * failed with the provider's reason (the earnings are available again), canceled by the team.
 */
const Payout = model.define('payout', {
  id: model.id({ prefix: 'po' }).primaryKey(),
  member_id: model.text().index(),
  account_id: model.text(),
  provider_id: model.text(),
  amount: model.bigNumber(),
  currency_code: model.text(),
  status: model.enum(['pending', 'paid', 'failed', 'canceled']).default('pending').index(),
  /** The provider's id (tr_… at Stripe). */
  external_id: model.text().nullable(),
  error: model.text().nullable(),
  /** The team member who sent it; null when the Traikeur asked for it. */
  created_by: model.text().nullable(),
  paid_at: model.dateTime().nullable(),
  failed_at: model.dateTime().nullable(),
});

export default Payout;
