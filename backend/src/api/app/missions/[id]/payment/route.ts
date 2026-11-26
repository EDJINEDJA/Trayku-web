import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { payMissionWorkflow } from '../../../../../workflows/payments';
import type { Infer, PayMission } from '../../../../utils/validators';
import { missionView, paymentView } from '../../../../utils/views';

/**
 * Pays a mission just published: the test payment is reserved at once; Stripe and PayPal give the
 * page to open (redirect_url), then the app confirms (./confirm).
 */
export const POST = async (req: AuthenticatedTraikuRequest<Infer<typeof PayMission>>, res: TraikuResponse) => {
  const { result } = await payMissionWorkflow(req.scope).run({
    input: {
      mission_id: String(req.params.id),
      requester_id: req.auth_context.actor_id,
      provider_id: req.validatedBody.provider_id,
      return_to: req.validatedBody.return_to ?? null,
      // The address the phone reached this server at: the provider's page sends it back here.
      base_url: `${req.protocol}://${req.get('host')}`,
    },
  });
  res.json({ payment: paymentView(result.payment), redirect_url: result.redirect_url, mission: await missionView(req.scope, result.mission, req.auth_context.actor_id) });
};
