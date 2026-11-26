import { TraikuError } from '@traiku/framework';
import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { TRIP_MODULE, type TripModuleService } from '../../../../modules/trip';

async function own(req: AuthenticatedTraikuRequest) {
  const trip = await req.scope.resolve<TripModuleService>(TRIP_MODULE).retrieveTrip(String(req.params.id));
  if (trip.member_id !== req.auth_context.actor_id) throw new TraikuError(TraikuError.Types.NOT_FOUND, 'Trajet introuvable.');
  return trip;
}

export const GET = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  res.json({ trip: await own(req) });
};

/** Cancels the trip; the missions already accepted on it go on. */
export const DELETE = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const trip = await own(req);
  res.json({ trip: await req.scope.resolve<TripModuleService>(TRIP_MODULE).updateTrips({ id: trip.id, status: 'cancelled' }) });
};
