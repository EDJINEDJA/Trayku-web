import type { TraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { TraikuError } from '@traiku/framework';
import { PAYOUT_MODULE, type PayoutModuleService } from '../../../../modules/payout';

/** The provider's webhook (Stripe Connect): checked by its signature, then the account looked at again. */
export const POST = async (req: TraikuRequest, res: TraikuResponse) => {
  const svc = req.scope.resolve<PayoutModuleService>(PAYOUT_MODULE);
  if (svc.provider.id !== req.params.provider || !svc.provider.webhook) throw new TraikuError(TraikuError.Types.NOT_FOUND, 'Pas de webhook pour ce fournisseur.');
  const { external_id } = await svc.provider.webhook(req.rawBody ?? Buffer.from(''), req.headers).catch((e: Error) => {
    throw new TraikuError(TraikuError.Types.UNAUTHORIZED, e.message);
  });
  const account = external_id ? await svc.accountByExternalId(external_id) : null;
  if (account) await svc.syncAccount(account.id);
  res.json({ received: true });
};
