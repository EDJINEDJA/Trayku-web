import { emitEventStep } from '@traiku/framework/core-flows';
import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse } from '@traiku/framework/workflows';
import { TraikuError } from '@traiku/framework';
import { REVIEW_MODULE, type ReviewModuleService } from '../../modules/review';
import { memberService, missionService } from '../steps';

export type CreateReviewInput = { mission_id: string; author_id: string; rating: number; comment?: string | null };

/**
 * Each side rates the other once, after the mission. The requester's rating closes the run ("rated");
 * with a crew, it goes to each Traikeur of it. A Traikeur of a crew rates the requester from their own run.
 */
const validateReviewStep = createStep('validate-review', async (input: CreateReviewInput, ctx) => {
  const svc = missionService(ctx);
  const mission = await svc.retrieveMission(input.mission_id);
  const done = await svc.listRuns({ mission_id: mission.id, status: 'done' });
  const notFound = new TraikuError(TraikuError.Types.NOT_FOUND, 'Mission introuvable.');
  if (!done.length) throw new TraikuError(TraikuError.Types.NOT_ALLOWED, 'La mission n’est pas encore terminée.');
  const byRequester = input.author_id === mission.requester_id;
  const runs = byRequester ? done : done.filter((r) => r.traveler_id === input.author_id);
  if (!runs.length) throw notFound;
  return new StepResponse({
    targets: runs.map((r) => ({ run_id: r.id, target_id: byRequester ? r.traveler_id : mission.requester_id })),
    role: byRequester ? ('traveler' as const) : ('requester' as const),
    byRequester,
  });
});

const createReviewStep = createStep(
  'create-review',
  async (input: CreateReviewInput & { targets: { target_id: string }[]; role: 'traveler' | 'requester' }, ctx) => {
    const svc = ctx.container.resolve<ReviewModuleService>(REVIEW_MODULE);
    const { targets, ...base } = input;
    const reviews = [];
    for (const t of targets) reviews.push(await svc.createReviews({ ...base, target_id: t.target_id }));
    return new StepResponse(reviews[0], reviews.map((r) => r.id));
  },
  async (ids, ctx) => {
    if (ids?.length) await ctx.container.resolve<ReviewModuleService>(REVIEW_MODULE).deleteReviews(ids);
  }
);

const rateStep = createStep('rate-member', async (input: { targets: { target_id: string; run_id: string }[]; rating: number; byRequester: boolean }, ctx) => {
  for (const t of input.targets) {
    await memberService(ctx).addRating(t.target_id, input.rating);
    if (input.byRequester) await missionService(ctx).updateRuns({ id: t.run_id, step: 'rated' });
  }
  return new StepResponse(undefined);
});

export const createReviewWorkflow = createWorkflow('create-review', (input: CreateReviewInput) => {
  const v = validateReviewStep(input);
  const data = transform({ input, v }, ({ input, v }) => ({ ...input, targets: v.targets, role: v.role }));
  const review = createReviewStep(data);
  // Last: an average is not undone, so nothing may fail after it.
  rateStep(transform({ input, v }, ({ input, v }) => ({ targets: v.targets, rating: input.rating, byRequester: v.byRequester })));
  emitEventStep({ eventName: 'review.created', data: transform({ review }, ({ review }) => ({ id: review.id })) });
  return new WorkflowResponse(review);
});
