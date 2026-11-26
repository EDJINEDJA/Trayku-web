import type { AuthenticatedTraikuRequest, TraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { MEMBER_MODULE, type MemberModuleService } from '../../../modules/member';
import { MISSION_MODULE, type MissionModuleService } from '../../../modules/mission';
import { createMissionWorkflow } from '../../../workflows/missions/create-mission';
import type { CreateMission, Infer, ListMissions } from '../../utils/validators';
import { missionView, missionViews } from '../../utils/views';
import { minimumFor } from '../../../lib/regions';

/**
 * The open missions, for Traikeurs: not mine, not expired, pro ones only for their trade, not under
 * their minimum price. Near a
 * point when lat/lng are given, nearest first; otherwise the given-back ones first, then the newest.
 */
export const GET = async (req: TraikuRequest<unknown, Infer<typeof ListMissions>>, res: TraikuResponse) => {
  const q = req.validatedQuery;
  const viewerId = req.auth_context?.actor_id || null;
  const viewer = viewerId ? await req.scope.resolve<MemberModuleService>(MEMBER_MODULE).retrieveMember(viewerId) : null;
  const { rows, count } = await req.scope.resolve<MissionModuleService>(MISSION_MODULE).searchOpen({
    deadlineAfter: new Date(),
    excludeRequester: viewerId,
    categories: q.category ? [q.category] : undefined,
    professions: viewer?.professions ?? [],
    obdReader: !!viewer?.obd_reader,
    // The Traikeur's price preferences: what pays less is not shown.
    minPrice: viewer?.price_prefs?.min_price ? await minimumFor(req.scope, viewer, viewer.price_prefs.min_price) : undefined,
    near: q.lat !== undefined && q.lng !== undefined ? { latitude: q.lat, longitude: q.lng, radiusM: q.radius_km * 1000 } : undefined,
    take: q.limit,
    skip: q.offset,
  });
  const views = await missionViews(req.scope, rows, viewerId);
  res.json({ missions: views.map((v, i) => ({ ...v, distance_m: rows[i].distance_m })), count, limit: q.limit, offset: q.offset });
};

/** Publishes a mission. A free title (no catalog_id) waits for the team ("review"). */
export const POST = async (req: AuthenticatedTraikuRequest<Infer<typeof CreateMission>>, res: TraikuResponse) => {
  const { result } = await createMissionWorkflow(req.scope).run({ input: { ...req.validatedBody, requester_id: req.auth_context.actor_id } });
  res.status(201).json({ mission: await missionView(req.scope, result, req.auth_context.actor_id) });
};
