import { TraikuError } from '@traiku/framework';
import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { MEMBER_MODULE, type MemberModuleService } from '../../../../../modules/member';
import { MISSION_MODULE, type MissionModuleService } from '../../../../../modules/mission';
import { TRIP_MODULE, type TripModuleService } from '../../../../../modules/trip';
import { missionViews } from '../../../../utils/views';
import { minimumFor } from '../../../../../lib/regions';

const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
/** How far from the route a pickup or a dropoff may be. */
const CORRIDOR_M = 3000;
/** By train, bus or plane: how far from a station (where the Traikeur gets off). */
const STATION_M = 3000;

/**
 * The open missions on a trip's way, computed by PostGIS: pickup and dropoff in the corridor, the
 * pickup first along the route (by train, bus or plane: near the departure, the stops or the arrival), taken by the trip's categories, size, weight and minimum price,
 * still open at departure. The smallest detour first (an estimate before a routing API).
 */
export const GET = async (req: AuthenticatedTraikuRequest<unknown, { limit: number; offset: number }>, res: TraikuResponse) => {
  const trip = await req.scope.resolve<TripModuleService>(TRIP_MODULE).retrieveTrip(String(req.params.id));
  if (trip.member_id !== req.auth_context.actor_id) throw new TraikuError(TraikuError.Types.NOT_FOUND, 'Trajet introuvable.');
  const me = await req.scope.resolve<MemberModuleService>(MEMBER_MODULE).retrieveMember(req.auth_context.actor_id);
  const { rows, count } = await req.scope.resolve<MissionModuleService>(MISSION_MODULE).searchOpen({
    deadlineAfter: trip.depart_at,
    excludeRequester: me.id,
    categories: trip.prefs.accepted_categories,
    professions: me.professions,
    obdReader: !!me.obd_reader,
    // The trip's minimum is on what the Traikeur receives.
    minPrice: trip.prefs.min_price ? await minimumFor(req.scope, me, trip.prefs.min_price) : undefined,
    maxWeightKg: trip.max_weight_kg,
    sizes: SIZES.slice(0, SIZES.indexOf(trip.max_size) + 1),
    // Driving, cycling, walking: along the road. By train, bus or plane, only where one gets off.
    ...(trip.vehicle === 'transit' || trip.vehicle === 'plane'
      ? { stations: { points: [trip.origin, ...(trip.vehicle === 'plane' ? [] : trip.stops), trip.destination], radiusM: STATION_M } }
      : { route: { coordinates: trip.route.coordinates, corridorM: CORRIDOR_M } }),
    take: req.validatedQuery.limit,
    skip: req.validatedQuery.offset,
  });
  const views = await missionViews(req.scope, rows, me.id);
  res.json({ missions: views.map((v, i) => ({ ...v, detour_m: rows[i].detour_m })), count });
};
