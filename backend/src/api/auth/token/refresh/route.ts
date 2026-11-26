import { ContainerRegistrationKeys, Modules, type AuthModuleService, type ConfigModule } from '@traiku/framework';
import { generateJwtToken, type AuthenticatedTraikuRequest, type TraikuResponse } from '@traiku/framework/http';

/** A fresh token from a valid one, with the identity as it is now (after registration, the member id). */
export const POST = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const { actor_type, auth_identity_id } = req.auth_context;
  const identity = await req.scope.resolve<AuthModuleService>(Modules.AUTH).retrieveAuthIdentity(auth_identity_id);
  const actorId = (identity.app_metadata?.[`${actor_type}_id`] as string | undefined) ?? '';
  const token = generateJwtToken({ actor_id: actorId, actor_type, auth_identity_id, app_metadata: identity.app_metadata ?? {} }, req.scope.resolve<ConfigModule>(ContainerRegistrationKeys.CONFIG_MODULE));
  res.json({ token, registered: !!actorId });
};
