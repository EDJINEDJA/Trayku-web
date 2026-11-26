import { Modules, type AuthModuleService } from '@traiku/framework';
import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';

/** Signs out everywhere: every token of this account stops working (within 30 s on other servers). */
export const DELETE = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  await req.scope.resolve<AuthModuleService>(Modules.AUTH).revokeTokens(req.auth_context.auth_identity_id);
  res.json({ signed_out: true });
};
