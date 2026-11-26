import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { MEMBER_MODULE, type MemberModuleService } from '../../../../modules/member';
import { submitIdentityWorkflow } from '../../../../workflows/members/identity';
import { meView } from '../../../utils/serialize';
import type { Infer, SubmitIdentity } from '../../../utils/validators';

/** The document (front, back) and the live selfie, sent once uploaded; the team or the provider checks them. */
export const POST = async (req: AuthenticatedTraikuRequest<Infer<typeof SubmitIdentity>>, res: TraikuResponse) => {
  await submitIdentityWorkflow(req.scope).run({ input: { ...req.validatedBody, member_id: req.auth_context.actor_id } });
  const member = await req.scope.resolve<MemberModuleService>(MEMBER_MODULE).retrieveMember(req.auth_context.actor_id);
  res.status(201).json({ member: await meView(req.scope, member) });
};
