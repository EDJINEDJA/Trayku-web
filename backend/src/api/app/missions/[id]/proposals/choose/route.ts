import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { MISSION_MODULE, type MissionModuleService } from '../../../../../../modules/mission';
import { chooseProposalWorkflow } from '../../../../../../workflows/missions/proposals';
import type { ChooseProposal, Infer } from '../../../../../utils/validators';
import { missionView } from '../../../../../utils/views';

/** The requester picks the time to send to the seller (null: picks again). */
export const POST = async (req: AuthenticatedTraikuRequest<Infer<typeof ChooseProposal>>, res: TraikuResponse) => {
  await chooseProposalWorkflow(req.scope).run({ input: { mission_id: String(req.params.id), requester_id: req.auth_context.actor_id, proposal_id: req.validatedBody.proposal_id } });
  const mission = await req.scope.resolve<MissionModuleService>(MISSION_MODULE).retrieveMission(String(req.params.id));
  res.json({ mission: await missionView(req.scope, mission, req.auth_context.actor_id) });
};
