import { Modules, type ApiKeyModuleService } from '@traiku/framework';
import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import type { CreateApiKey, Infer } from '../../utils/validators';

const view = (k: Awaited<ReturnType<ApiKeyModuleService['retrieveApiKey']>>) => ({
  id: k.id,
  title: k.title,
  type: k.type,
  // Publishable keys are meant to be copied into the apps; secret ones are shown once, at creation.
  token: k.type === 'publishable' ? k.token : k.redacted,
  redacted: k.redacted,
  last_used_at: k.last_used_at,
  created_by: k.created_by,
  revoked_at: k.revoked_at,
  created_at: k.created_at,
});

export const GET = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const keys = await req.scope.resolve<ApiKeyModuleService>(Modules.API_KEY).listApiKeys();
  res.json({ api_keys: keys.map(view) });
};

export const POST = async (req: AuthenticatedTraikuRequest<Infer<typeof CreateApiKey>>, res: TraikuResponse) => {
  const { key, token } = await req.scope.resolve<ApiKeyModuleService>(Modules.API_KEY).generate({ ...req.validatedBody, created_by: req.auth_context.actor_id });
  res.status(201).json({ api_key: { ...view(key), token } });
};
