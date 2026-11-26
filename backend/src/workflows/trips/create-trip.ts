import { emitEventStep } from '@traiku/framework/core-flows';
import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse } from '@traiku/framework/workflows';
import { TraikuError } from '@traiku/framework';
import { TRIP_MODULE, type TripModuleService } from '../../modules/trip';
import type { TripRow } from '../../modules/trip/service';
import { memberService } from '../steps';

export type CreateTripInput = Omit<TripRow, 'id' | 'status' | 'created_at' | 'updated_at' | 'deleted_at'>;

const createTripStep = createStep(
  'create-trip',
  async (input: CreateTripInput, ctx) => {
    const member = await memberService(ctx).retrieveMember(input.member_id);
    memberService(ctx).assertActive(member);
    if (input.depart_at.getTime() < Date.now() - 3600_000 && !input.recurring_days.length) throw new TraikuError(TraikuError.Types.INVALID_DATA, 'Le départ est déjà passé.');
    if (input.route.coordinates.length < 2) throw new TraikuError(TraikuError.Types.INVALID_DATA, 'L’itinéraire est vide.');
    const trip = await ctx.container.resolve<TripModuleService>(TRIP_MODULE).createTrips(input);
    return new StepResponse(trip, trip.id);
  },
  async (id, ctx) => {
    await ctx.container.resolve<TripModuleService>(TRIP_MODULE).deleteTrips(id);
  }
);

export const createTripWorkflow = createWorkflow('create-trip', (input: CreateTripInput) => {
  const trip = createTripStep(input);
  emitEventStep({ eventName: 'trip.created', data: transform({ trip }, ({ trip }) => ({ id: trip.id })) });
  return new WorkflowResponse(trip);
});
