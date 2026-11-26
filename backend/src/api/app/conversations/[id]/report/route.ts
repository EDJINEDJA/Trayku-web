import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { CONVERSATION_MODULE, type ConversationModuleService } from '../../../../../modules/conversation';

/** Reports the conversation to the team, who can read it in the admin. */
export const POST = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const svc = req.scope.resolve<ConversationModuleService>(CONVERSATION_MODULE);
  const c = await svc.forMember(String(req.params.id), req.auth_context.actor_id);
  await svc.updateConversations({ id: c.id, reported_at: new Date(), reported_by: req.auth_context.actor_id });
  res.json({ reported: true });
};
