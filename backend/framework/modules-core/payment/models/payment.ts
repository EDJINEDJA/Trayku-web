import { model } from '../../../dml';

/**
 * A payment, as Medusa's payment session and payment together: what is reserved on the payer's
 * card (or PayPal), then captured in full or in part, cancelled, or refunded. `resource_id` is what
 * it pays for (a mission). Amounts in the currency's main unit (euros), as the rest of the base.
 */
const Payment = model.define('payment', {
  id: model.id({ prefix: 'pay' }).primaryKey(),
  resource_id: model.text().index(),
  payer_id: model.text().nullable(),
  /** system (test, no money moves), stripe, paypal. */
  provider_id: model.text(),
  /** test: the provider's sandbox; live: real money. */
  mode: model.enum(['test', 'live']),
  amount: model.bigNumber(),
  currency_code: model.text(),
  status: model.enum(['pending', 'authorized', 'captured', 'canceled', 'error']).default('pending').index(),
  captured_amount: model.bigNumber().default(0),
  refunded_amount: model.bigNumber().default(0),
  /** The provider's ids (Checkout session, PaymentIntent, PayPal order, authorization, capture). */
  data: model.json<Record<string, unknown>>().default({}),
  error: model.text().nullable(),
  authorized_at: model.dateTime().nullable(),
  captured_at: model.dateTime().nullable(),
  canceled_at: model.dateTime().nullable(),
});

export default Payment;
