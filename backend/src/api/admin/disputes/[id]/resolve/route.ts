import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { resolveDisputeWorkflow } from '../../../../../workflows/disputes';
import type { Infer, ResolveDispute } from '../../../../utils/validators';

export const POST = async (req: AuthenticatedTraikuRequest<Infer<typeof ResolveDispute>>, res: TraikuResponse) => {
  const { result } = await resolveDisputeWorkflow(req.scope).run({ input: { ...req.validatedBody, dispute_id: String(req.params.id), user_id: req.auth_context.actor_id } });
  res.json({ dispute: result });
};
