import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { CONVERSATION_MODULE, type ConversationModuleService } from '../../../../modules/conversation';
import { fileUrls } from '../../../utils/serialize';

/** A conversation in full, for a dispute or a report. */
export const GET = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const svc = req.scope.resolve<ConversationModuleService>(CONVERSATION_MODULE);
  const conversation = await svc.retrieveConversation(String(req.params.id), { relations: ['messages'] });
  const messages = (conversation.messages ?? []) as { file_id?: string | null }[];
  const urls = await fileUrls(
    req.scope,
    messages.map((m) => m.file_id)
  );
  res.json({ conversation, urls });
};
