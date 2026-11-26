import type { TraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { trackAdWorkflow } from '../../../../../workflows/ads';
import type { Infer, TrackAd } from '../../../../utils/validators';

/** The app saw the ad (`view`, once per display) or opened it (`click`). */
export const POST = async (req: TraikuRequest<Infer<typeof TrackAd>>, res: TraikuResponse) => {
  await trackAdWorkflow(req.scope).run({ input: { id: String(req.params.id), type: req.validatedBody.type } });
  res.status(204).end();
};
