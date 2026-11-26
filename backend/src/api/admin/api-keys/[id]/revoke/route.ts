import { Modules, type ApiKeyModuleService } from '@traiku/framework';
import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';

/** Revokes a key: the apps using it are refused within a minute (cache). */
export const POST = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const key = await req.scope.resolve<ApiKeyModuleService>(Modules.API_KEY).revoke(String(req.params.id), req.auth_context.actor_id);
  res.json({ api_key: { id: key.id, revoked_at: key.revoked_at } });
};
