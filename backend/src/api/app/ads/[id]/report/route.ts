import type { TraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { reportAdWorkflow } from '../../../../../workflows/ads';

/** « Signaler cette publicité »: counted, shown to the team in the admin. */
export const POST = async (req: TraikuRequest, res: TraikuResponse) => {
  await reportAdWorkflow(req.scope).run({ input: { id: String(req.params.id), member_id: req.auth_context?.actor_id ?? null } });
  res.status(204).end();
};
