import { TraikuError } from '@traiku/framework';
import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse } from '@traiku/framework/workflows';
import { emitEventStep } from '@traiku/framework/core-flows';
import { PAYOUT_MODULE, type PayoutModuleService } from '../../modules/payout';
import { memberService } from '../steps';
import { blockedMissions } from './earnings';

/**
 * The Traikeurs' payouts: their account where earnings go, a withdrawal they ask for, and what the
 * team does (send, send again, stop an account's transfers, cancel a mission's earnings). A transfer
 * sent is money moved: no step undoes it, a failure leaves the earnings available again.
 */

const payouts = (ctx: { container: { resolve<T>(k: string): T } }) => ctx.container.resolve<PayoutModuleService>(PAYOUT_MODULE);

type SetupInput = { member_id: string; return_url: string; refresh_url: string };

/** The account made the first time, then the provider's page to give the IBAN (none for the test provider). */
const setupAccountStep = createStep('setup-payout-account', async (input: SetupInput, ctx) => {
  const member = await memberService(ctx).retrieveMember(input.member_id);
  const svc = payouts(ctx);
  const account = await svc.ensureAccount(member);
  const url = account.status === 'active' ? null : await svc.onboardingLink(account, { return_url: input.return_url, refresh_url: input.refresh_url });
  return new StepResponse({ account, url });
});

export const setupPayoutAccountWorkflow = createWorkflow('setup-payout-account', (input: SetupInput) => new WorkflowResponse(setupAccountStep(input)));

/** Back from the provider's page, or on its webhook: the account looked at again. */
const syncAccountStep = createStep('sync-payout-account', async (input: { member_id: string }, ctx) => {
  const svc = payouts(ctx);
  const account = await svc.accountOf(input.member_id);
  return new StepResponse(account ? await svc.syncAccount(account.id) : null);
});

export const syncPayoutAccountWorkflow = createWorkflow('sync-payout-account', (input: { member_id: string }) => new WorkflowResponse(syncAccountStep(input)));

type BankInput = { member_id: string; holder: string; iban: string };

/** The test provider: the holder and the IBAN typed in the app, only the last digits kept. */
const saveBankStep = createStep('save-payout-bank', async (input: BankInput, ctx) => {
  const member = await memberService(ctx).retrieveMember(input.member_id);
  const svc = payouts(ctx);
  const account = await svc.ensureAccount(member);
  return new StepResponse(await svc.saveBankDetails(account.id, input.holder, input.iban));
});

export const savePayoutBankWorkflow = createWorkflow('save-payout-bank', (input: BankInput) => new WorkflowResponse(saveBankStep(input)));

type PayInput = { member_id: string; created_by?: string | null };

/**
 * All that is available sent to the member's account. Asked by the member: their tax details first,
 * as the platforms must declare their users' earnings (DAC7). The team can send it in any case.
 */
const payMemberStep = createStep('pay-member', async (input: PayInput, ctx) => {
  const member = await memberService(ctx).retrieveMember(input.member_id);
  if (!input.created_by && !member.tax_info) throw new TraikuError(TraikuError.Types.NOT_ALLOWED, 'Complétez d’abord vos informations fiscales.', 'payout_tax_info');
  if (member.status !== 'active') throw new TraikuError(TraikuError.Types.NOT_ALLOWED, 'Ce compte est suspendu.', 'member_suspended');
  return new StepResponse(await payouts(ctx).payMember(member.id, { created_by: input.created_by ?? null, blocked: await blockedMissions(ctx.container) }));
});

export const payMemberWorkflow = createWorkflow('pay-member', (input: PayInput) => {
  const sent = payMemberStep(input);
  emitEventStep({ eventName: 'payout.created', data: transform({ sent }, ({ sent }) => sent.map((p) => ({ id: p.id, member_id: p.member_id, status: p.status }))) });
  return new WorkflowResponse(sent);
});

/** The team sends a failed payout again. */
const retryStep = createStep('retry-payout', async (input: { payout_id: string; user_id: string }, ctx) =>
  new StepResponse(await payouts(ctx).retryPayout(input.payout_id, input.user_id, await blockedMissions(ctx.container)))
);

export const retryPayoutWorkflow = createWorkflow('retry-payout', (input: { payout_id: string; user_id: string }) => new WorkflowResponse(retryStep(input)));

type HoldInput = { member_id: string; hold: boolean; reason: string | null };

/** The team stops an account's transfers (a dispute, a doubt), or allows them again. */
const holdStep = createStep(
  'hold-payout-account',
  async (input: HoldInput, ctx) => {
    const svc = payouts(ctx);
    const account = await svc.accountOf(input.member_id);
    if (!account) throw new TraikuError(TraikuError.Types.NOT_FOUND, 'Ce membre n’a pas encore de compte de versement.');
    const updated = await svc.setHold(account.id, input.hold, input.reason);
    return new StepResponse(updated, { id: account.id, hold: account.hold, reason: account.hold_reason });
  },
  async (before, ctx) => {
    if (before) await payouts(ctx).setHold(before.id, before.hold, before.reason);
  }
);

export const holdPayoutAccountWorkflow = createWorkflow('hold-payout-account', (input: HoldInput) => new WorkflowResponse(holdStep(input)));

/** The team cancels a mission's earnings not yet paid (a dispute settled against the Traikeur). */
const cancelEarningsStep = createStep('cancel-mission-earnings', async (input: { mission_id: string }, ctx) => new StepResponse(await payouts(ctx).cancelMissionEarnings(input.mission_id)));

export const cancelMissionEarningsWorkflow = createWorkflow('cancel-mission-earnings', (input: { mission_id: string }) => new WorkflowResponse(cancelEarningsStep(input)));
