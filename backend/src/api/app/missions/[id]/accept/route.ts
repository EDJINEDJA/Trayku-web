import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { MISSION_MODULE, type MissionModuleService } from '../../../../../modules/mission';
import { acceptMissionWorkflow } from '../../../../../workflows/missions/accept-mission';
import type { AcceptMission, Infer } from '../../../../utils/validators';
import { missionView } from '../../../../utils/views';

export const POST = async (req: AuthenticatedTraikuRequest<Infer<typeof AcceptMission>>, res: TraikuResponse) => {
  await acceptMissionWorkflow(req.scope).run({ input: { mission_id: String(req.params.id), traveler_id: req.auth_context.actor_id, trip_id: req.validatedBody.trip_id } });
  const mission = await req.scope.resolve<MissionModuleService>(MISSION_MODULE).retrieveMission(String(req.params.id));
  res.json({ mission: await missionView(req.scope, mission, req.auth_context.actor_id) });
};
