import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { CONVERSATION_MODULE, type ConversationModuleService } from '../../../../../modules/conversation';
import { sendMessageWorkflow } from '../../../../../workflows/conversations';
import { fileUrls } from '../../../../utils/serialize';
import type { Infer, SendMessage } from '../../../../utils/validators';

type Msg = Awaited<ReturnType<ConversationModuleService['listMessages']>>[number];

const view = (m: Msg, me: string, urls: Record<string, string>) => ({ id: m.id, from: m.sender_id === null ? 'system' : m.sender_id === me ? 'me' : 'them', kind: m.kind, body: m.body, image: m.file_id ? (urls[m.file_id] ?? null) : null, created_at: m.created_at, read_at: m.read_at });

/** The messages, newest first (page with limit/offset); the other's are marked read. */
export const GET = async (req: AuthenticatedTraikuRequest<unknown, { limit: number; offset: number }>, res: TraikuResponse) => {
  const me = req.auth_context.actor_id;
  const svc = req.scope.resolve<ConversationModuleService>(CONVERSATION_MODULE);
  const c = await svc.forMember(String(req.params.id), me);
  const [messages, count] = await svc.listAndCountMessages({ conversation_id: c.id }, { take: req.validatedQuery.limit, skip: req.validatedQuery.offset, order: { created_at: 'DESC' } });
  await svc.updateMessages({ selector: { conversation_id: c.id, sender_id: { $ne: me }, read_at: null }, data: { read_at: new Date() } });
  const urls = await fileUrls(
    req.scope,
    messages.map((m) => m.file_id)
  );
  res.json({ messages: messages.map((m) => view(m, me, urls)), count, blocked: !!c.blocked_by });
};

export const POST = async (req: AuthenticatedTraikuRequest<Infer<typeof SendMessage>>, res: TraikuResponse) => {
  const me = req.auth_context.actor_id;
  const { result } = await sendMessageWorkflow(req.scope).run({ input: { ...req.validatedBody, conversation_id: String(req.params.id), sender_id: me } });
  res.status(201).json({ message: view(result, me, await fileUrls(req.scope, [result.file_id])) });
};
