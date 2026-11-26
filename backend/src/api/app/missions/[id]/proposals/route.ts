import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { MISSION_MODULE, type MissionModuleService } from '../../../../../modules/mission';
import { proposeTimeWorkflow } from '../../../../../workflows/missions/proposals';
import type { Infer, ProposeTime } from '../../../../utils/validators';
import { missionView } from '../../../../utils/views';

/** A Traikeur proposes a time to go to the seller's; it replaces theirs. */
export const POST = async (req: AuthenticatedTraikuRequest<Infer<typeof ProposeTime>>, res: TraikuResponse) => {
  await proposeTimeWorkflow(req.scope).run({ input: { mission_id: String(req.params.id), traveler_id: req.auth_context.actor_id, at: req.validatedBody.at } });
  const mission = await req.scope.resolve<MissionModuleService>(MISSION_MODULE).retrieveMission(String(req.params.id));
  res.status(201).json({ mission: await missionView(req.scope, mission, req.auth_context.actor_id) });
};
