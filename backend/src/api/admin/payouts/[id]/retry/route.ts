import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { retryPayoutWorkflow } from '../../../../../workflows/payouts';
import { payoutView } from '../../../../utils/payouts';

/** A failed payout sent again (what is available now, its earnings included). */
export const POST = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const { result } = await retryPayoutWorkflow(req.scope).run({ input: { payout_id: String(req.params.id), user_id: req.auth_context.actor_id } });
  res.json({ payouts: result.map(payoutView) });
};
