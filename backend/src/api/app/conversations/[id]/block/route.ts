import { TraikuError } from '@traiku/framework';
import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { CONVERSATION_MODULE, type ConversationModuleService } from '../../../../../modules/conversation';

/** Blocks the other person: nothing more is sent either way. */
export const POST = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const svc = req.scope.resolve<ConversationModuleService>(CONVERSATION_MODULE);
  const c = await svc.forMember(String(req.params.id), req.auth_context.actor_id);
  await svc.updateConversations({ id: c.id, blocked_by: c.blocked_by ?? req.auth_context.actor_id });
  res.json({ blocked: true });
};

/** Unblocks: only the one who blocked can. */
export const DELETE = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const svc = req.scope.resolve<ConversationModuleService>(CONVERSATION_MODULE);
  const c = await svc.forMember(String(req.params.id), req.auth_context.actor_id);
  if (c.blocked_by && c.blocked_by !== req.auth_context.actor_id) throw new TraikuError(TraikuError.Types.NOT_ALLOWED, 'C’est l’autre personne qui a bloqué la conversation.');
  await svc.updateConversations({ id: c.id, blocked_by: null });
  res.json({ blocked: false });
};
