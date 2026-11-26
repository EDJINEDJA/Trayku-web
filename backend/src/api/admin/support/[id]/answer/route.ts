import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { answerSupportRequestWorkflow } from '../../../../../workflows/members/support';
import type { AnswerSupportRequest, Infer } from '../../../../utils/validators';

export const POST = async (req: AuthenticatedTraikuRequest<Infer<typeof AnswerSupportRequest>>, res: TraikuResponse) => {
  const { result } = await answerSupportRequestWorkflow(req.scope).run({ input: { id: String(req.params.id), user_id: req.auth_context.actor_id, ...req.validatedBody } });
  res.json({ request: result });
};
