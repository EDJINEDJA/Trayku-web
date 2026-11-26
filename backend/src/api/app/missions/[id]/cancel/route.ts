import { TraikuError } from '@traiku/framework';
import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { getPricing } from '../../../../../lib/regions';
import { cancelTerms } from '../../../../../lib/rules';
import { MISSION_MODULE, type MissionModuleService } from '../../../../../modules/mission';
import { cancelMissionWorkflow } from '../../../../../workflows/missions/cancel-mission';

/** What cancelling would cost now, to show before confirming. */
export const GET = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const svc = req.scope.resolve<MissionModuleService>(MISSION_MODULE);
  const mission = await svc.retrieveMission(String(req.params.id));
  if (mission.requester_id !== req.auth_context.actor_id) throw new TraikuError(TraikuError.Types.NOT_FOUND, 'Mission introuvable.');
  res.json({ terms: cancelTerms(mission, await svc.activeRun(mission.id), await getPricing(req.scope, mission.region_id)) });
};

export const POST = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const { result } = await cancelMissionWorkflow(req.scope).run({ input: { mission_id: String(req.params.id), requester_id: req.auth_context.actor_id } });
  res.json({ terms: result });
};
