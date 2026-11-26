import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { createReviewWorkflow } from '../../../workflows/reviews/create-review';
import type { CreateReview, Infer } from '../../utils/validators';

export const POST = async (req: AuthenticatedTraikuRequest<Infer<typeof CreateReview>>, res: TraikuResponse) => {
  const { result } = await createReviewWorkflow(req.scope).run({ input: { ...req.validatedBody, author_id: req.auth_context.actor_id } });
  res.status(201).json({ review: { id: result.id, rating: result.rating, comment: result.comment, created_at: result.created_at } });
};
