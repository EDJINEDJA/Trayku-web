import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { payMemberWorkflow } from '../../../../../workflows/payouts';
import { payoutView } from '../../../../utils/payouts';

/** The team sends all that is available to the member now (their tax details not required, as the team decides). */
export const POST = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const { result } = await payMemberWorkflow(req.scope).run({ input: { member_id: String(req.params.id), created_by: req.auth_context.actor_id } });
  res.json({ payouts: result.map(payoutView) });
};
