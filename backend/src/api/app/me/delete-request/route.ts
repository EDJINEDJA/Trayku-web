import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { requestDeletionWorkflow } from '../../../../workflows/members/support';

/** « Supprimer mon compte »: recorded, erased by the team within 30 days. */
export const POST = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  await requestDeletionWorkflow(req.scope).run({ input: { member_id: req.auth_context.actor_id } });
  res.json({ requested: true });
};
