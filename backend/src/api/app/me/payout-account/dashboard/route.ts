import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { PAYOUT_MODULE, type PayoutModuleService } from '../../../../../modules/payout';

/** The provider's page where I follow my transfers to the bank, or change my IBAN; null without one. */
export const GET = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const svc = req.scope.resolve<PayoutModuleService>(PAYOUT_MODULE);
  const account = await svc.accountOf(req.auth_context.actor_id);
  res.json({ url: account ? await svc.dashboardLink(account) : null });
};
