import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { reviewMissionWorkflow } from '../../../../../workflows/missions/review-mission';
import type { Infer, ReviewMission } from '../../../../utils/validators';

/** Approves a free title (the mission opens to Traikeurs) or refuses it with a note. */
export const POST = async (req: AuthenticatedTraikuRequest<Infer<typeof ReviewMission>>, res: TraikuResponse) => {
  const { result } = await reviewMissionWorkflow(req.scope).run({ input: { ...req.validatedBody, mission_id: String(req.params.id), user_id: req.auth_context.actor_id } });
  res.json({ mission: { id: result.id, status: result.status, review_note: result.review_note } });
};
