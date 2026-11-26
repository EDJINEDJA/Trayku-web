import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { MISSION_MODULE, type MissionModuleService } from '../../../../modules/mission';
import { missionViews } from '../../../utils/views';

/** The missions I took as a Traikeur (under way first, then done), with their run. */
export const GET = async (req: AuthenticatedTraikuRequest<unknown, { limit: number; offset: number }>, res: TraikuResponse) => {
  const svc = req.scope.resolve<MissionModuleService>(MISSION_MODULE);
  const [runs, count] = await svc.listAndCountRuns({ traveler_id: req.auth_context.actor_id, status: { $ne: 'cancelled' } }, { take: req.validatedQuery.limit, skip: req.validatedQuery.offset, order: { status: 'ASC', accepted_at: 'DESC' } });
  const missions = runs.length ? await svc.listMissions({ id: runs.map((r) => r.mission_id) }) : [];
  const views = await missionViews(req.scope, missions, req.auth_context.actor_id, runs);
  res.json({ missions: runs.map((r) => views.find((v) => v.id === r.mission_id)).filter(Boolean), count });
};
