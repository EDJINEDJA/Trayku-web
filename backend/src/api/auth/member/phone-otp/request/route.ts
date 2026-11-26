import { ContainerRegistrationKeys, Modules, type AuthModuleService } from '@traiku/framework';
import type { EventBus } from '@traiku/framework/events';
import type { TraikuRequest, TraikuResponse } from '@traiku/framework/http';
import type { Infer, RequestOtp } from '../../../../utils/validators';

/** Sends a 6-digit code by SMS to sign in (or sign up). */
export const POST = async (req: TraikuRequest<Infer<typeof RequestOtp>>, res: TraikuResponse) => {
  const { phone, code, expires_at } = await req.scope.resolve<AuthModuleService>(Modules.AUTH).requestOtp(req.validatedBody.phone);
  await req.scope.resolve<EventBus>(ContainerRegistrationKeys.EVENT_BUS).emit({ name: 'auth.otp_requested', data: { phone, code } });
  res.json({ phone, expires_at });
};
