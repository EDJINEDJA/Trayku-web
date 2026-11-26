import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { askQuestionWorkflow } from '../../../../../workflows/conversations';

/** Before accepting, when the requester allows it: opens the conversation to ask a question. */
export const POST = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const { result } = await askQuestionWorkflow(req.scope).run({ input: { mission_id: String(req.params.id), traveler_id: req.auth_context.actor_id } });
  res.json({ conversation: { id: result.id, mission_id: result.mission_id } });
};
