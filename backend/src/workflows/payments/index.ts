import type { AwilixContainer } from 'awilix';
import { emitEventStep } from '@traiku/framework/core-flows';
import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse } from '@traiku/framework/workflows';
import { ContainerRegistrationKeys, Modules, TraikuError, type Logger, type PaymentModuleService } from '@traiku/framework';
import type { MissionRow, RunRow } from '../../modules/mission/service';
import { missionService } from '../steps';
import { statusAfterPayment } from '../missions/create-mission';

/**
 * The requester's payment, as Medusa's payment collection on a cart: at publication the whole
 * amount (price, service fee, reserve) is reserved on their card or PayPal; the mission is only
 * shown once it is. At the end, what is due is captured and the rest released: the price when
 * delivered, the « verification only » price when the item is refused, the fee of a late
 * cancellation, nothing when cancelled for free or expired.
 */

const payments = (ctx: { container: AwilixContainer }) => ctx.container.resolve<PaymentModuleService>(Modules.PAYMENT);
const num = (v: unknown) => Number(v ?? 0);

/** What is reserved at publication: the price and Traiku's fees. */
export const missionTotal = (m: Pick<MissionRow, 'price' | 'service_fee' | 'insurance_fee'>) => num(m.price) + num(m.service_fee) + num(m.insurance_fee);

/**
 * What the requester owes once the mission is closed; null while it isn't. The tip and the extra
 * time come on top of the price, within what was reserved.
 */
export function amountDue(m: Pick<MissionRow, 'status' | 'price' | 'service_fee' | 'insurance_fee' | 'cancel_fee' | 'verify_only_price' | 'metadata'>, runs: Pick<RunRow, 'status' | 'tip' | 'extra_amount'>[] = []): number | null {
  const fees = num(m.service_fee) + num(m.insurance_fee);
  if (m.status === 'cancelled') return num(m.cancel_fee);
  if (m.status !== 'delivered') return null;
  if ((m.metadata as { outcome?: string } | null)?.outcome === 'verify_only') return num(m.verify_only_price) + fees;
  const extras = runs.filter((r) => r.status === 'done').reduce((s, r) => s + num(r.tip) + num(r.extra_amount), 0);
  return num(m.price) + fees + extras;
}

type PayInput = { mission_id: string; requester_id: string; provider_id: string; base_url: string; return_to?: string | null };

const validatePayStep = createStep('validate-pay-mission', async (input: PayInput, ctx) => {
  const mission = await missionService(ctx).retrieveMission(input.mission_id).catch(() => null);
  if (!mission || mission.requester_id !== input.requester_id) throw new TraikuError(TraikuError.Types.NOT_FOUND, 'Mission introuvable.');
  if (mission.status !== 'awaiting_payment') throw new TraikuError(TraikuError.Types.CONFLICT, 'Cette mission est déjà payée.', 'payment_done');
  if (mission.deadline.getTime() < Date.now()) throw new TraikuError(TraikuError.Types.NOT_ALLOWED, 'L’échéance est passée : publiez la mission de nouveau.', 'mission_expired');
  return new StepResponse(mission);
});

/** Opens the payment at the provider; dropped if what follows fails. */
const initiatePaymentStep = createStep(
  'initiate-mission-payment',
  async (input: { mission: MissionRow; input: PayInput }, ctx) => {
    const { mission } = input;
    const back = (id: string, cancelled: boolean) => {
      const q = new URLSearchParams({ payment_id: id, ...(cancelled && { cancelled: '1' }), ...(input.input.return_to && { to: input.input.return_to }) });
      return `${input.input.base_url}/hooks/payment/${input.input.provider_id}/return?${q}`;
    };
    const res = await payments(ctx).initiatePayment({
      resource_id: mission.id,
      payer_id: mission.requester_id,
      provider_id: input.input.provider_id,
      amount: missionTotal(mission),
      currency_code: mission.currency_code,
      description: `Traiku · ${mission.title}`,
      urls: (id) => ({ return_url: back(id, false), cancel_url: back(id, true) }),
    });
    return new StepResponse(res, res.payment.id);
  },
  async (id, ctx) => {
    if (id) await payments(ctx).cancelPayment(id).catch(() => undefined);
  }
);

/** Reserved: the mission is shown (or goes to the team for a free title). */
const markPaidStep = createStep(
  'mark-mission-paid',
  async (input: { mission_id: string; authorized: boolean }, ctx) => {
    const svc = missionService(ctx);
    const mission = await svc.retrieveMission(input.mission_id);
    if (!input.authorized || mission.status !== 'awaiting_payment') return new StepResponse(mission, null);
    const updated = await svc.updateMissions({ id: mission.id, status: statusAfterPayment(mission) });
    return new StepResponse(updated, mission.id);
  },
  async (id, ctx) => {
    if (id) await missionService(ctx).updateMissions({ id, status: 'awaiting_payment' });
  }
);

/** The requester pays: the test payment is reserved at once, the others give the provider's page to open. */
export const payMissionWorkflow = createWorkflow('pay-mission', (input: PayInput) => {
  const mission = validatePayStep(input);
  const started = initiatePaymentStep(transform({ mission, input }, (d) => d));
  const paid = markPaidStep(transform({ started, input }, ({ started, input }) => ({ mission_id: input.mission_id, authorized: started.payment.status === 'authorized' })));
  emitEventStep({ eventName: 'mission.paid', data: transform({ paid }, ({ paid }) => ({ id: paid.id, status: paid.status })) });
  return new WorkflowResponse(transform({ started, paid }, ({ started, paid }) => ({ payment: started.payment, redirect_url: started.redirect_url, mission: paid })));
});

const syncPaymentStep = createStep('sync-mission-payment', async (input: { mission_id: string }, ctx) => {
  const current = await payments(ctx).paymentOf(input.mission_id);
  const payment = current?.status === 'pending' ? await payments(ctx).syncPayment(current.id) : current;
  return new StepResponse({ mission_id: input.mission_id, payment, authorized: payment?.status === 'authorized' });
});

/** Back from the provider's page (or on its webhook): reserved, the mission is shown. */
export const confirmMissionPaymentWorkflow = createWorkflow('confirm-mission-payment', (input: { mission_id: string }) => {
  const synced = syncPaymentStep(input);
  const mission = markPaidStep(transform({ synced }, ({ synced }) => ({ mission_id: synced.mission_id, authorized: synced.authorized })));
  emitEventStep({ eventName: 'mission.paid', data: transform({ mission }, ({ mission }) => ({ id: mission.id, status: mission.status })) });
  return new WorkflowResponse(transform({ synced, mission }, ({ synced, mission }) => ({ payment: synced.payment, mission })));
});

/**
 * A closed mission's payment: what is due captured, the rest released. Called on the events that
 * close a mission (subscribers/mission-settle.ts) and by the expiry job; does nothing twice.
 */
export async function settleMissionPayment(container: AwilixContainer, missionId: string) {
  const svc = container.resolve<PaymentModuleService>(Modules.PAYMENT);
  const missions = missionService({ container });
  const mission = await missions.retrieveMission(missionId);
  const payment = await svc.paymentOf(mission.id);
  if (!payment) return null;
  // Abandoned on the provider's page: dropped with the mission.
  if (payment.status === 'pending') return mission.status === 'cancelled' ? svc.cancelPayment(payment.id) : null;
  if (payment.status !== 'authorized') return null;
  const due = amountDue(mission, await missions.listRuns({ mission_id: mission.id }));
  if (due === null) return null;
  const reserved = Number(payment.amount);
  if (due > reserved)
    container.resolve<Logger>(ContainerRegistrationKeys.LOGGER).warn(`mission ${mission.id} : ${due} dû, ${reserved} réservé ; ${(due - reserved).toFixed(2)} reste à encaisser (pourboire, temps en plus)`);
  return svc.capturePayment(payment.id, Math.min(due, reserved));
}
