import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { PAYOUT_MODULE, type PayoutModuleService } from '../../../../../modules/payout';
import { syncPayoutAccountWorkflow } from '../../../../../workflows/payouts';
import { accountView } from '../../../../utils/payouts';

/** Back in the app from the provider's page: where my account stands now. */
export const POST = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const { result } = await syncPayoutAccountWorkflow(req.scope).run({ input: { member_id: req.auth_context.actor_id } });
  res.json({ account: accountView(result, req.scope.resolve<PayoutModuleService>(PAYOUT_MODULE)) });
};
