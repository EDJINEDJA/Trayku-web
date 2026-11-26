import { model } from '@traiku/framework';

/**
 * Where a Traikeur receives their earnings: their account at the payout provider (a Stripe Connect
 * account, which keeps the IBAN and the identity checks), or the test account. Trayku never keeps the
 * IBAN, only its last digits, to recognise it. `hold`: the team stopped the transfers.
 */
const PayoutAccount = model.define('payout_account', {
  id: model.id({ prefix: 'pacc' }).primaryKey(),
  member_id: model.text().unique(),
  /** system (test, no money moves), stripe. */
  provider_id: model.text(),
  /** The provider's id (acct_… at Stripe). */
  external_id: model.text().nullable(),
  /** pending: details still asked; active: transfers possible; restricted: the provider asks for more. */
  status: model.enum(['pending', 'active', 'restricted']).default('pending').index(),
  bank_last4: model.text().nullable(),
  holder: model.text().nullable(),
  hold: model.boolean().default(false),
  hold_reason: model.text().nullable(),
  data: model.json<Record<string, unknown>>().default({}),
});

export default PayoutAccount;
