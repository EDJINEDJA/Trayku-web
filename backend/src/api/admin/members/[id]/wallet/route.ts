import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { walletOf } from '../../../../utils/payouts';

/** A member's wallet, as they see it: their account, balances, earnings and payouts. */
export const GET = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  res.json(await walletOf(req.scope, String(req.params.id)));
};
