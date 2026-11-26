import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { MISSION_MODULE, type MissionModuleService } from '../../../../../modules/mission';

/** After 3 wrong codes: the support checks with both sides, then gives the tries back. */
export const POST = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const svc = req.scope.resolve<MissionModuleService>(MISSION_MODULE);
  const run = await svc.updateRuns({ id: String(req.params.id), locked_at: null, code_attempts: 0 });
  await svc.logEvent(run.id, 'unlocked_by_support', req.auth_context.actor_id);
  res.json({ run: { id: run.id, locked: false } });
};
