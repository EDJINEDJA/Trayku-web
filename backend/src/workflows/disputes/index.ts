import { emitEventStep } from '@traiku/framework/core-flows';
import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse } from '@traiku/framework/workflows';
import { TraikuError } from '@traiku/framework';
import { missionService } from '../steps';

type Reason = 'absent' | 'not_conform' | 'damaged' | 'late' | 'payment' | 'behaviour' | 'other';
export type OpenDisputeInput = { mission_id: string; member_id: string; reason: Reason; message: string };

/** "Un problème ?": the requester or the Traikeur of the mission opens a file for the support. */
const openDisputeStep = createStep(
  'open-dispute',
  async (input: OpenDisputeInput, ctx) => {
    const svc = missionService(ctx);
    const mission = await svc.retrieveMission(input.mission_id);
    const [run] = await svc.listRuns({ mission_id: mission.id, status: { $ne: 'cancelled' } }, { take: 1 });
    if (mission.requester_id !== input.member_id && run?.traveler_id !== input.member_id) throw new TraikuError(TraikuError.Types.NOT_FOUND, 'Mission introuvable.');
    const [open] = await svc.listDisputes({ mission_id: mission.id, opened_by: input.member_id, status: 'open' }, { take: 1 });
    if (open) throw new TraikuError(TraikuError.Types.DUPLICATE_ERROR, 'Vous avez déjà signalé un problème sur cette mission : le support vous répond dans la conversation.');
    const dispute = await svc.createDisputes({ mission_id: mission.id, reason: input.reason, message: input.message.trim(), opened_by: input.member_id, run_id: run?.id ?? null });
    if (run) await svc.logEvent(run.id, 'dispute_opened', input.member_id, null, { dispute_id: dispute.id, reason: input.reason });
    return new StepResponse(dispute, dispute.id);
  },
  async (id, ctx) => {
    await missionService(ctx).deleteDisputes(id);
  }
);

export const openDisputeWorkflow = createWorkflow('open-dispute', (input: OpenDisputeInput) => {
  const dispute = openDisputeStep(input);
  emitEventStep({ eventName: 'dispute.opened', data: transform({ dispute }, ({ dispute }) => ({ id: dispute.id })) });
  return new WorkflowResponse(dispute);
});

export type ResolveDisputeInput = { dispute_id: string; user_id: string; status: 'resolved' | 'rejected'; resolution: string };

const resolveDisputeStep = createStep(
  'resolve-dispute',
  async (input: ResolveDisputeInput, ctx) => {
    const svc = missionService(ctx);
    const prev = await svc.retrieveDispute(input.dispute_id);
    if (prev.status !== 'open') throw new TraikuError(TraikuError.Types.NOT_ALLOWED, 'Ce dossier est déjà clos.');
    const dispute = await svc.updateDisputes({ id: prev.id, status: input.status, resolution: input.resolution, resolved_by: input.user_id, resolved_at: new Date() });
    return new StepResponse(dispute, prev.id);
  },
  async (id, ctx) => {
    await missionService(ctx).updateDisputes({ id, status: 'open', resolution: null, resolved_by: null, resolved_at: null });
  }
);

export const resolveDisputeWorkflow = createWorkflow('resolve-dispute', (input: ResolveDisputeInput) => {
  const dispute = resolveDisputeStep(input);
  emitEventStep({ eventName: 'dispute.resolved', data: { id: input.dispute_id } });
  return new WorkflowResponse(dispute);
});
