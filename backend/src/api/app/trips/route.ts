import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { createTripWorkflow } from '../../../workflows/trips/create-trip';
import type { CreateTrip, Infer } from '../../utils/validators';

export const POST = async (req: AuthenticatedTraikuRequest<Infer<typeof CreateTrip>>, res: TraikuResponse) => {
  const { result } = await createTripWorkflow(req.scope).run({ input: { ...req.validatedBody, member_id: req.auth_context.actor_id } });
  res.status(201).json({ trip: result });
};
