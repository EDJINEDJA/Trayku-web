import { emitEventStep } from '@traiku/framework/core-flows';
import { createStep, createWorkflow, StepResponse, WorkflowResponse } from '@traiku/framework/workflows';
import { TraikuError } from '@traiku/framework';
import { memberService } from '../steps';

// ── Aide et support ─────────────────────────────────────────────────────────

export type SupportInput = { member_id: string; topic: 'mission' | 'payment' | 'account' | 'safety' | 'other'; message: string };

const createSupportStep = createStep(
  'create-support-request',
  async (input: SupportInput, ctx) => {
    const svc = memberService(ctx);
    const open = await svc.listSupportRequests({ member_id: input.member_id, status: 'open' });
    if (open.length >= 5) throw new TraikuError(TraikuError.Types.NOT_ALLOWED, 'Vous avez déjà plusieurs demandes en cours. L’équipe vous répond au plus vite.');
    const request = await svc.createSupportRequests({ member_id: input.member_id, topic: input.topic, message: input.message.trim() });
    return new StepResponse(request, request.id);
  },
  async (id, ctx) => {
    if (id) await memberService(ctx).deleteSupportRequests(id);
  }
);

/** A member writes to the team. */
export const createSupportRequestWorkflow = createWorkflow('create-support-request', (input: SupportInput) => {
  const request = createSupportStep(input);
  emitEventStep({ eventName: 'support.created', data: { member_id: input.member_id } });
  return new WorkflowResponse(request);
});

export type AnswerInput = { id: string; user_id: string; answer: string; close: boolean };

const answerSupportStep = createStep(
  'answer-support-request',
  async (input: AnswerInput, ctx) => {
    const svc = memberService(ctx);
    const before = await svc.retrieveSupportRequest(input.id);
    const request = await svc.updateSupportRequests({ id: before.id, answer: input.answer.trim(), answered_by: input.user_id, answered_at: new Date(), status: input.close ? 'closed' : 'answered' });
    return new StepResponse(request, { id: before.id, answer: before.answer, answered_by: before.answered_by, answered_at: before.answered_at, status: before.status });
  },
  async (before, ctx) => {
    if (before) await memberService(ctx).updateSupportRequests(before);
  }
);

/** The team answers (admin, Support). */
export const answerSupportRequestWorkflow = createWorkflow('answer-support-request', (input: AnswerInput) => {
  const request = answerSupportStep(input);
  emitEventStep({ eventName: 'support.answered', data: { id: input.id } });
  return new WorkflowResponse(request);
});

// ── Supprimer mon compte ────────────────────────────────────────────────────

const requestDeletionStep = createStep(
  'request-deletion',
  async (input: { member_id: string }, ctx) => {
    const svc = memberService(ctx);
    const m = await svc.retrieveMember(input.member_id);
    await svc.updateMembers({ id: m.id, deletion_requested_at: m.deletion_requested_at ?? new Date() });
    return new StepResponse(undefined, { id: m.id, deletion_requested_at: m.deletion_requested_at });
  },
  async (prev, ctx) => {
    if (prev) await memberService(ctx).updateMembers(prev);
  }
);

/** « Supprimer mon compte »: recorded; the team erases the account within 30 days (missions under way finished first). */
export const requestDeletionWorkflow = createWorkflow('request-deletion', (input: { member_id: string }) => {
  requestDeletionStep(input);
  emitEventStep({ eventName: 'member.deletion_requested', data: { id: input.member_id } });
  return new WorkflowResponse(undefined);
});
