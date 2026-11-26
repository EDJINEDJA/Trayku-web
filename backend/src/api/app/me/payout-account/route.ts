import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { PAYOUT_MODULE, type PayoutModuleService } from '../../../../modules/payout';
import { setupPayoutAccountWorkflow } from '../../../../workflows/payouts';
import { accountView, payoutReturnUrl } from '../../../utils/payouts';
import type { Infer, SetupPayoutAccount } from '../../../utils/validators';

/**
 * Sets up the account where my earnings go: the provider's page to open (url), where I give my
 * identity and IBAN; back from it, the browser returns into the app (return_to). No page for the test
 * provider: the app asks the IBAN (./bank).
 */
export const POST = async (req: AuthenticatedTraikuRequest<Infer<typeof SetupPayoutAccount>>, res: TraikuResponse) => {
  const base = `${req.protocol}://${req.get('host')}`;
  const svc = req.scope.resolve<PayoutModuleService>(PAYOUT_MODULE);
  const back = (refresh: boolean) => payoutReturnUrl(req.scope, base, svc.provider.id, req.auth_context.actor_id, refresh, req.validatedBody.return_to ?? null);
  const { result } = await setupPayoutAccountWorkflow(req.scope).run({ input: { member_id: req.auth_context.actor_id, return_url: back(false), refresh_url: back(true) } });
  res.json({ account: accountView(result.account, svc), url: result.url });
};
