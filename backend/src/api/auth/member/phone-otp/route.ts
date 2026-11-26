import { ContainerRegistrationKeys, Modules, type AuthModuleService, type ConfigModule } from '@traiku/framework';
import { generateJwtToken, type TraikuRequest, type TraikuResponse } from '@traiku/framework/http';
import type { Infer, VerifyOtp } from '../../../utils/validators';

/**
 * Checks the SMS code. Known phone: a token for the member. New phone: a registration token (no
 * actor yet), to send with POST /app/members, then POST /auth/token/refresh — as Medusa's flow.
 */
export const POST = async (req: TraikuRequest<Infer<typeof VerifyOtp>>, res: TraikuResponse) => {
  const { identity } = await req.scope.resolve<AuthModuleService>(Modules.AUTH).verifyOtp(req.validatedBody.phone, req.validatedBody.code);
  const memberId = (identity.app_metadata?.member_id as string | undefined) ?? '';
  const token = generateJwtToken(
    { actor_id: memberId, actor_type: 'member', auth_identity_id: identity.id, app_metadata: identity.app_metadata ?? {} },
    req.scope.resolve<ConfigModule>(ContainerRegistrationKeys.CONFIG_MODULE)
  );
  res.json({ token, registered: !!memberId });
};
