import { TraikuError } from '@traiku/framework';
import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { MISSION_MODULE, type MissionModuleService } from '../../../../modules/mission';
import { missionView } from '../../../utils/views';

/** The run and its mission, for its Traikeur or its requester. */
export const GET = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const svc = req.scope.resolve<MissionModuleService>(MISSION_MODULE);
  const run = await svc.retrieveRun(String(req.params.id));
  const view = await missionView(req.scope, await svc.retrieveMission(run.mission_id), req.auth_context.actor_id);
  if (view.role === 'public') throw new TraikuError(TraikuError.Types.NOT_FOUND, 'Mission introuvable.');
  res.json({ mission: view });
};
