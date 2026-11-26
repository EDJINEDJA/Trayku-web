import { Modules, type PaymentModuleService } from '@traiku/framework';
import type { TraikuRequest, TraikuResponse } from '@traiku/framework/http';

/** The ways to pay, and the mode (test: nothing real is charged). */
export const GET = async (req: TraikuRequest, res: TraikuResponse) => {
  const svc = req.scope.resolve<PaymentModuleService>(Modules.PAYMENT);
  res.json({ mode: svc.mode, providers: svc.listProviders() });
};
