import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { MEMBER_MODULE, type MemberModuleService } from '../../../../../modules/member';
import { reviewIdentityWorkflow } from '../../../../../workflows/members/identity';
import { identityCheckViews } from '../../../../utils/identity-views';
import type { Infer, Review } from '../../../../utils/validators';

/** Same person on the document and the selfie, document valid: verified. Otherwise refused, with the reason. */
export const POST = async (req: AuthenticatedTraikuRequest<Infer<typeof Review>>, res: TraikuResponse) => {
  await reviewIdentityWorkflow(req.scope).run({ input: { ...req.validatedBody, check_id: String(req.params.id), user_id: req.auth_context.actor_id } });
  const check = await req.scope.resolve<MemberModuleService>(MEMBER_MODULE).retrieveIdentityCheck(String(req.params.id));
  res.json({ identity_check: (await identityCheckViews(req.scope, [check]))[0] });
};
