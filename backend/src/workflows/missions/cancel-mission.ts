import { emitEventStep } from '@traiku/framework/core-flows';
import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse } from '@traiku/framework/workflows';
import { TraikuError } from '@traiku/framework';
import { getPricing } from '../../lib/regions';
import { cancelTerms } from '../../lib/rules';
import { applyChangesStep, logRunEventStep, missionService, type Planned } from '../steps';

export type CancelMissionInput = { mission_id: string; requester_id: string };

/** The requester cancels: free until a Traikeur accepts (and in the minutes after), then a fee, refused once they set off. */
const validateCancelStep = createStep('validate-cancel', async (input: CancelMissionInput, ctx) => {
  const svc = missionService(ctx);
  const mission = await svc.retrieveMission(input.mission_id);
  if (mission.requester_id !== input.requester_id) throw new TraikuError(TraikuError.Types.NOT_FOUND, 'Mission introuvable.');
  const run = await svc.activeRun(mission.id);
  const terms = cancelTerms(mission, run, await getPricing(ctx.container, mission.region_id));
  if (!terms.allowed) throw new TraikuError(TraikuError.Types.NOT_ALLOWED, terms.why, 'cancel_refused');
  const now = new Date();
  const planned: Planned = {
    mission_id: mission.id,
    mission: { status: 'cancelled', cancelled_at: now, cancel_fee: terms.fee || null },
    ...(run && { run_id: run.id, run: { status: 'cancelled' as const, cancelled_at: now, cancelled_by: input.requester_id }, event: { type: 'cancelled_by_requester', actor_id: input.requester_id, payload: { fee: terms.fee } } }),
  };
  return new StepResponse({ planned, terms });
});

/** A crew: the other Traikeurs' runs cancelled too (the first one goes with the mission). */
const cancelOtherRunsStep = createStep(
  'cancel-other-runs',
  async (input: { mission_id: string; except?: string; by: string }, ctx) => {
    const svc = missionService(ctx);
    const others = (await svc.activeRuns(input.mission_id)).filter((r) => r.id !== input.except);
    const now = new Date();
    for (const r of others) {
      await svc.updateRuns({ id: r.id, status: 'cancelled', cancelled_at: now, cancelled_by: input.by });
      await svc.logEvent(r.id, 'cancelled_by_requester', input.by);
    }
    return new StepResponse(undefined, others.map((r) => r.id));
  },
  async (ids, ctx) => {
    for (const id of ids ?? []) await missionService(ctx).updateRuns({ id, status: 'active', cancelled_at: null, cancelled_by: null });
  }
);

export const cancelMissionWorkflow = createWorkflow('cancel-mission', (input: CancelMissionInput) => {
  const v = validateCancelStep(input);
  applyChangesStep(v.planned);
  cancelOtherRunsStep(transform({ v, input }, ({ v, input }) => ({ mission_id: input.mission_id, except: v.planned.run_id, by: input.requester_id })));
  logRunEventStep(v.planned);
  emitEventStep({ eventName: 'mission.cancelled', data: { id: input.mission_id, run_id: v.planned.run_id } });
  return new WorkflowResponse(v.terms);
});
