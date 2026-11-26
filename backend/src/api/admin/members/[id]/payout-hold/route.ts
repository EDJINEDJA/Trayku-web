import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { PAYOUT_MODULE, type PayoutModuleService } from '../../../../../modules/payout';
import { holdPayoutAccountWorkflow } from '../../../../../workflows/payouts';
import { accountView } from '../../../../utils/payouts';
import type { HoldPayouts, Infer } from '../../../../utils/validators';

/** Stops the member's transfers (with the reason, for the team), or allows them again. */
export const POST = async (req: AuthenticatedTraikuRequest<Infer<typeof HoldPayouts>>, res: TraikuResponse) => {
  const { result } = await holdPayoutAccountWorkflow(req.scope).run({ input: { member_id: String(req.params.id), hold: req.validatedBody.hold, reason: req.validatedBody.reason ?? null } });
  res.json({ account: accountView(result, req.scope.resolve<PayoutModuleService>(PAYOUT_MODULE)) });
};
