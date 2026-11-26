import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { TRIP_MODULE, type TripModuleService } from '../../../../modules/trip';

export const GET = async (req: AuthenticatedTraikuRequest<unknown, { limit: number; offset: number }>, res: TraikuResponse) => {
  const [trips, count] = await req.scope.resolve<TripModuleService>(TRIP_MODULE).listAndCountTrips({ member_id: req.auth_context.actor_id, status: 'active' }, { take: req.validatedQuery.limit, skip: req.validatedQuery.offset, order: { depart_at: 'ASC' } });
  res.json({ trips, count });
};
