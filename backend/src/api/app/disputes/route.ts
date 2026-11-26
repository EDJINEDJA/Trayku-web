import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { openDisputeWorkflow } from '../../../workflows/disputes';
import type { Infer, OpenDispute } from '../../utils/validators';

/** "Un problème ?": opens a file; the support answers in the conversation. */
export const POST = async (req: AuthenticatedTraikuRequest<Infer<typeof OpenDispute>>, res: TraikuResponse) => {
  const { result } = await openDisputeWorkflow(req.scope).run({ input: { ...req.validatedBody, member_id: req.auth_context.actor_id } });
  res.status(201).json({ dispute: { id: result.id, status: result.status, reason: result.reason, created_at: result.created_at } });
};
