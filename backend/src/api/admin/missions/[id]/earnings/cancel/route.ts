import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { cancelMissionEarningsWorkflow } from '../../../../../../workflows/payouts';

/** The mission's earnings not yet paid, cancelled (a dispute settled against the Traikeur). */
export const POST = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const { result } = await cancelMissionEarningsWorkflow(req.scope).run({ input: { mission_id: String(req.params.id) } });
  res.json({ canceled: result });
};
