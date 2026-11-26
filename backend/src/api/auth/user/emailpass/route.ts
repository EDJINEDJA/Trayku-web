import { ContainerRegistrationKeys, Modules, TraikuError, type AuthModuleService, type ConfigModule } from '@traiku/framework';
import { generateJwtToken, type TraikuRequest, type TraikuResponse } from '@traiku/framework/http';
import type { EmailPass, Infer } from '../../../utils/validators';

/** The team signs in to the admin. */
export const POST = async (req: TraikuRequest<Infer<typeof EmailPass>>, res: TraikuResponse) => {
  const identity = await req.scope.resolve<AuthModuleService>(Modules.AUTH).authenticateEmailPass(req.validatedBody.email, req.validatedBody.password);
  const userId = identity.app_metadata?.user_id as string | undefined;
  if (!userId) throw new TraikuError(TraikuError.Types.UNAUTHORIZED, 'Email ou mot de passe incorrect.');
  const token = generateJwtToken({ actor_id: userId, actor_type: 'user', auth_identity_id: identity.id, app_metadata: identity.app_metadata ?? {} }, req.scope.resolve<ConfigModule>(ContainerRegistrationKeys.CONFIG_MODULE));
  res.json({ token });
};
