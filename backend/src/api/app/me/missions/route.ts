import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { MISSION_MODULE, type MissionModuleService } from '../../../../modules/mission';
import { missionViews } from '../../../utils/views';

/** The missions I published, newest first, with their run. */
export const GET = async (req: AuthenticatedTraikuRequest<unknown, { limit: number; offset: number }>, res: TraikuResponse) => {
  const [missions, count] = await req.scope.resolve<MissionModuleService>(MISSION_MODULE).listAndCountMissions({ requester_id: req.auth_context.actor_id }, { take: req.validatedQuery.limit, skip: req.validatedQuery.offset });
  res.json({ missions: await missionViews(req.scope, missions, req.auth_context.actor_id), count });
};
