import { emitEventStep } from '@traiku/framework/core-flows';
import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse } from '@traiku/framework/workflows';
import { Modules, TraikuError, type FileModuleService } from '@traiku/framework';
import { CONVERSATION_MODULE, type ConversationModuleService } from '../../modules/conversation';
import { missionService } from '../steps';

const conversations = (ctx: { container: { resolve<T>(k: string): T } }) => ctx.container.resolve<ConversationModuleService>(CONVERSATION_MODULE);

/**
 * Phone numbers (any country) and e-mails are hidden: everything goes through Traiku (safety,
 * insurance, no bypass). The app warns before; this holds for any client.
 */
const PHONE = /(?<![\w])(?:\+|00)?\d(?:[\s.\-()]*\d){7,14}(?![\w])/g;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
export const maskContacts = (text: string) => text.replace(EMAIL, '•• masqué ••').replace(PHONE, '•• masqué ••');

export type SendMessageInput = { conversation_id: string; sender_id: string; body: string; file_id?: string | null };

const sendMessageStep = createStep(
  'send-message',
  async (input: SendMessageInput, ctx) => {
    const svc = conversations(ctx);
    const c = await svc.forMember(input.conversation_id, input.sender_id);
    if (c.blocked_by) throw new TraikuError(TraikuError.Types.NOT_ALLOWED, 'Cette conversation est bloquée.');
    if (input.file_id) await ctx.container.resolve<FileModuleService>(Modules.FILE).assertOwned([input.file_id], input.sender_id);
    const message = await svc.createMessages({ conversation_id: c.id, sender_id: input.sender_id, kind: input.file_id ? 'photo' : 'text', body: maskContacts(input.body.trim()), file_id: input.file_id ?? null });
    return new StepResponse({ message, to: c.member_a === input.sender_id ? c.member_b : c.member_a }, message.id);
  },
  async (id, ctx) => {
    await conversations(ctx).deleteMessages(id);
  }
);

export const sendMessageWorkflow = createWorkflow('send-message', (input: SendMessageInput) => {
  const sent = sendMessageStep(input);
  emitEventStep({ eventName: 'message.created', data: transform({ sent }, ({ sent }) => ({ id: sent.message.id, to: sent.to })) });
  return new WorkflowResponse(sent.message);
});

export type AskQuestionInput = { mission_id: string; traveler_id: string };

/** Before accepting, when the requester allows questions: opens the chat with them. */
const askStep = createStep('open-question', async (input: AskQuestionInput, ctx) => {
  const mission = await missionService(ctx).retrieveMission(input.mission_id);
  if (mission.status !== 'open' || mission.requester_id === input.traveler_id) throw new TraikuError(TraikuError.Types.NOT_FOUND, 'Mission introuvable.');
  if (!mission.chat_open) throw new TraikuError(TraikuError.Types.NOT_ALLOWED, 'Le demandeur répond aux questions une fois la mission acceptée.');
  const { conversation } = await conversations(ctx).open(mission.id, mission.requester_id, input.traveler_id);
  return new StepResponse(conversation);
});

export const askQuestionWorkflow = createWorkflow('ask-question', (input: AskQuestionInput) => new WorkflowResponse(askStep(input)));
