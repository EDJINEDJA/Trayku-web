import { emitEventStep } from '@traiku/framework/core-flows';
import { createStep, createWorkflow, StepResponse, WorkflowResponse } from '@traiku/framework/workflows';
import { TraikuError } from '@traiku/framework';
import { missionService } from '../steps';

export type ReviewMissionInput = { mission_id: string; user_id: string; approve: boolean; note?: string | null };

/** The team approves a free title (the mission opens) or refuses it (cancelled, with the reason). */
const reviewMissionStep = createStep(
  'review-mission',
  async (input: ReviewMissionInput, ctx) => {
    const svc = missionService(ctx);
    const prev = await svc.retrieveMission(input.mission_id);
    if (prev.status !== 'review') throw new TraikuError(TraikuError.Types.NOT_ALLOWED, 'Cette mission n’attend pas de validation.');
    const mission = await svc.updateMissions({ id: prev.id, status: input.approve ? 'open' : 'cancelled', review_note: input.note ?? null, ...(!input.approve && { cancelled_at: new Date() }) });
    return new StepResponse(mission, prev);
  },
  async (prev, ctx) => {
    await missionService(ctx).updateMissions({ id: prev.id, status: prev.status, review_note: prev.review_note, cancelled_at: prev.cancelled_at });
  }
);

export const reviewMissionWorkflow = createWorkflow('review-mission', (input: ReviewMissionInput) => {
  const mission = reviewMissionStep(input);
  emitEventStep({ eventName: 'mission.reviewed', data: { id: input.mission_id, approved: input.approve } });
  return new WorkflowResponse(mission);
});
