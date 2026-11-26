import { TraikuError } from '@traiku/framework';
import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { MISSION_MODULE, type MissionModuleService } from '../../../../../../modules/mission';
import { confirmMissionPaymentWorkflow } from '../../../../../../workflows/payments';
import { missionView, paymentView } from '../../../../../utils/views';

/** Back from the provider's page: where the payment stands; reserved, the mission is shown. */
export const POST = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const mission = await req.scope.resolve<MissionModuleService>(MISSION_MODULE).retrieveMission(String(req.params.id)).catch(() => null);
  if (!mission || mission.requester_id !== req.auth_context.actor_id) throw new TraikuError(TraikuError.Types.NOT_FOUND, 'Mission introuvable.');
  const { result } = await confirmMissionPaymentWorkflow(req.scope).run({ input: { mission_id: mission.id } });
  res.json({ payment: result.payment ? paymentView(result.payment) : null, mission: await missionView(req.scope, result.mission, req.auth_context.actor_id) });
};
