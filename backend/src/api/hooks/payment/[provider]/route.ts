import { Modules, type PaymentModuleService } from '@traiku/framework';
import type { TraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { confirmMissionPaymentWorkflow } from '../../../../workflows/payments';

/**
 * A provider's webhook, as Medusa's /hooks/payment/{provider}: checked by the provider's signature,
 * then the payment looked at again (the payer may never have come back to the app).
 */
export const POST = async (req: TraikuRequest, res: TraikuResponse) => {
  const payment = await req.scope.resolve<PaymentModuleService>(Modules.PAYMENT).handleWebhook(String(req.params.provider), req.rawBody ?? Buffer.from(''), req.headers);
  if (payment?.status === 'authorized') await confirmMissionPaymentWorkflow(req.scope).run({ input: { mission_id: payment.resource_id } });
  res.json({ received: true });
};
