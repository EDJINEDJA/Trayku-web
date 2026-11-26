import { Modules, type UserModuleService } from '@traiku/framework';
import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';

export const GET = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  res.json({ user: await req.scope.resolve<UserModuleService>(Modules.USER).retrieveUser(req.auth_context.actor_id) });
};
