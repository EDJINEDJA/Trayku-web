import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { MEMBER_MODULE, type MemberModuleService } from '../../../../../modules/member';
import { reviewCredentialWorkflow } from '../../../../../workflows/members/identity';
import { credentialViews } from '../../../../utils/identity-views';
import type { Infer, Review } from '../../../../utils/validators';

/** A valid proof in that trade: the member becomes a certified verifier. Otherwise refused, with the reason. */
export const POST = async (req: AuthenticatedTraikuRequest<Infer<typeof Review>>, res: TraikuResponse) => {
  await reviewCredentialWorkflow(req.scope).run({ input: { ...req.validatedBody, credential_id: String(req.params.id), user_id: req.auth_context.actor_id } });
  const credential = await req.scope.resolve<MemberModuleService>(MEMBER_MODULE).retrieveCredential(String(req.params.id));
  res.json({ credential: (await credentialViews(req.scope, [credential]))[0] });
};
