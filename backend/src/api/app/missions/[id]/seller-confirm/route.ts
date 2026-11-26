import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { MISSION_MODULE, type MissionModuleService } from '../../../../../modules/mission';
import { confirmSellerWorkflow } from '../../../../../workflows/missions/proposals';
import { missionView } from '../../../../utils/views';

/** The seller agreed to the time sent: the mission goes to that Traikeur. */
export const POST = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  await confirmSellerWorkflow(req.scope).run({ input: { mission_id: String(req.params.id), requester_id: req.auth_context.actor_id } });
  const mission = await req.scope.resolve<MissionModuleService>(MISSION_MODULE).retrieveMission(String(req.params.id));
  res.json({ mission: await missionView(req.scope, mission, req.auth_context.actor_id) });
};
