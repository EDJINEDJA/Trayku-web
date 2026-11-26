import { model } from '@traiku/framework';

/**
 * What a Traikeur earned on one mission, once the requester's payment is captured: their share of the
 * price (or of the verification only), of a late cancellation's fee, or of an absent requester's.
 * pending until available_at (time for a dispute), then available, then paid by a payout.
 */
const Earning = model
  .define('earning', {
    id: model.id({ prefix: 'earn' }).primaryKey(),
    member_id: model.text().index(),
    mission_id: model.text().index(),
    run_id: model.text().nullable(),
    kind: model.enum(['mission', 'verify_only', 'cancellation', 'no_show']),
    amount: model.bigNumber(),
    currency_code: model.text(),
    status: model.enum(['pending', 'available', 'paid', 'canceled']).default('pending').index(),
    available_at: model.dateTime(),
    payout_id: model.text().nullable().index(),
  })
  // Once per Traikeur and mission: settling twice records nothing more.
  .indexes([{ on: ['mission_id', 'member_id', 'kind'], unique: true }]);

export default Earning;
