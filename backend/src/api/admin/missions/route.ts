import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { MISSION_MODULE, MISSION_STATUSES, type MissionModuleService } from '../../../modules/mission';
import { fileUrls, publicMembers, serializeMission } from '../../utils/serialize';

type Query = { status?: string; q?: string; requester_id?: string; limit: number; offset: number };

/** All missions, by status ("review": free titles to approve), search on the title. */
export const GET = async (req: AuthenticatedTraikuRequest<unknown, Query>, res: TraikuResponse) => {
  const { status, q, requester_id, limit, offset } = req.validatedQuery;
  const filters = {
    ...(status && (MISSION_STATUSES as readonly string[]).includes(status) && { status: status as (typeof MISSION_STATUSES)[number] }),
    ...(q && { title: { $ilike: `%${q.replace(/[%_]/g, '')}%` } }),
    ...(requester_id && { requester_id }),
  };
  const [missions, count] = await req.scope.resolve<MissionModuleService>(MISSION_MODULE).listAndCountMissions(filters, { take: limit, skip: offset });
  const people = await publicMembers(
    req.scope,
    missions.map((m) => m.requester_id)
  );
  const urls = await fileUrls(
    req.scope,
    missions.flatMap((m) => m.photos)
  );
  res.json({ missions: missions.map((m) => serializeMission(m, 'admin', urls, { requester: people[m.requester_id] })), count });
};
