import { TraikuError } from '@traiku/framework';
import type { TraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { MISSION_MODULE, type MissionModuleService } from '../../../../modules/mission';
import { missionView } from '../../../utils/views';

/** A mission: open to all, otherwise only to its requester and its Traikeur. */
export const GET = async (req: TraikuRequest, res: TraikuResponse) => {
  const mission = await req.scope.resolve<MissionModuleService>(MISSION_MODULE).retrieveMission(String(req.params.id));
  const view = await missionView(req.scope, mission, req.auth_context?.actor_id || null);
  if (view.role === 'public' && mission.status !== 'open') throw new TraikuError(TraikuError.Types.NOT_FOUND, 'Mission introuvable.');
  res.json({ mission: view });
};
