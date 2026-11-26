import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { MISSION_MODULE, type MissionModuleService } from '../../../modules/mission';
import { publicMembers } from '../../utils/serialize';

type Query = { status?: string; limit: number; offset: number };

/** The files to handle, oldest first, with their mission and who opened them. Open ones by default. */
export const GET = async (req: AuthenticatedTraikuRequest<unknown, Query>, res: TraikuResponse) => {
  const { status = 'open', limit, offset } = req.validatedQuery;
  const wanted = (['open', 'resolved', 'rejected'] as const).find((s) => s === status);
  const svc = req.scope.resolve<MissionModuleService>(MISSION_MODULE);
  const [disputes, count] = await svc.listAndCountDisputes(wanted ? { status: wanted } : {}, { take: limit, skip: offset, order: { created_at: 'ASC' } });
  const missions = disputes.length ? await svc.listMissions({ id: disputes.map((d) => d.mission_id) }, { select: ['id', 'title', 'status'] }) : [];
  const people = await publicMembers(
    req.scope,
    disputes.map((d) => d.opened_by)
  );
  res.json({ disputes: disputes.map((d) => ({ ...d, mission: missions.find((m) => m.id === d.mission_id) ?? null, opener: people[d.opened_by] ?? null })), count });
};
