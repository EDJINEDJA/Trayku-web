import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { payMemberWorkflow } from '../../../../workflows/payouts';
import { payoutView, walletOf } from '../../../utils/payouts';

/** I withdraw all that is available: sent to my account, then my wallet as it now is. */
export const POST = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const { result } = await payMemberWorkflow(req.scope).run({ input: { member_id: req.auth_context.actor_id } });
  res.status(201).json({ payouts: result.map(payoutView), wallet: await walletOf(req.scope, req.auth_context.actor_id) });
};
