import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { PAYOUT_MODULE, type PayoutModuleService } from '../../../../../modules/payout';
import { savePayoutBankWorkflow } from '../../../../../workflows/payouts';
import { accountView } from '../../../../utils/payouts';
import type { Infer, SavePayoutBank } from '../../../../utils/validators';

/** The test provider only: the holder and the IBAN, of which only the last digits are kept. */
export const POST = async (req: AuthenticatedTraikuRequest<Infer<typeof SavePayoutBank>>, res: TraikuResponse) => {
  const { result } = await savePayoutBankWorkflow(req.scope).run({ input: { member_id: req.auth_context.actor_id, ...req.validatedBody } });
  res.json({ account: accountView(result, req.scope.resolve<PayoutModuleService>(PAYOUT_MODULE)) });
};
