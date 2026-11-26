import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { walletOf } from '../../../utils/payouts';

/** My wallet: where my earnings go, what I have, my earnings and my payouts. */
export const GET = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  res.json(await walletOf(req.scope, req.auth_context.actor_id));
};
