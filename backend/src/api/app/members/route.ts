import { TraikuError, Modules, type AuthModuleService } from '@traiku/framework';
import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { createMemberWorkflow } from '../../../workflows/members/create-member';
import { meView } from '../../utils/serialize';
import type { CreateMember, Infer } from '../../utils/validators';

/** Registration, with the token from the SMS code; then POST /auth/token/refresh for a member token. */
export const POST = async (req: AuthenticatedTraikuRequest<Infer<typeof CreateMember>>, res: TraikuResponse) => {
  const { actor_id, auth_identity_id } = req.auth_context;
  if (actor_id) throw new TraikuError(TraikuError.Types.NOT_ALLOWED, 'Vous avez déjà un compte.');
  const phone = await req.scope.resolve<AuthModuleService>(Modules.AUTH).entityIdOf(auth_identity_id, 'phone-otp');
  if (!phone) throw new TraikuError(TraikuError.Types.UNAUTHORIZED, 'Vérifiez d’abord votre numéro.');
  const { result } = await createMemberWorkflow(req.scope).run({ input: { ...req.validatedBody, auth_identity_id, phone } });
  res.status(201).json({ member: await meView(req.scope, result) });
};
