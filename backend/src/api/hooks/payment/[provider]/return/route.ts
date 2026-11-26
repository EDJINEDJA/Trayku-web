import { Modules, type PaymentModuleService } from '@traiku/framework';
import type { TraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { confirmMissionPaymentWorkflow } from '../../../../../workflows/payments';

/** Only the app's own addresses: never sent elsewhere from here. */
const appAddress = (to: unknown) => (typeof to === 'string' && /^(trayku|traiku|exps?):\/\//.test(to) ? to : null);

/**
 * The payer back from Stripe's or PayPal's page, in the phone's browser: the payment is looked at,
 * then the browser is sent back into the app, which shows the result.
 */
export const GET = async (req: TraikuRequest, res: TraikuResponse) => {
  const svc = req.scope.resolve<PaymentModuleService>(Modules.PAYMENT);
  const id = String(req.query.payment_id ?? '');
  const [row] = id ? await svc.listPayments({ id, provider_id: String(req.params.provider) }, { take: 1 }) : [];
  let status = row?.status ?? 'error';
  if (row && !req.query.cancelled) {
    const { result } = await confirmMissionPaymentWorkflow(req.scope).run({ input: { mission_id: row.resource_id } }).catch(() => ({ result: null }));
    status = result?.payment?.status ?? status;
  }
  const to = appAddress(req.query.to);
  if (to) return res.redirect(303, `${to}${to.includes('?') ? '&' : '?'}${new URLSearchParams({ payment_id: id, status: req.query.cancelled ? 'canceled' : status })}`);
  res.type('html').send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Traiku</title><p style="font:16px system-ui;padding:24px">${status === 'authorized' ? 'Paiement enregistré.' : 'Paiement non abouti.'} Vous pouvez revenir dans l’app Traiku.</p>`);
};
