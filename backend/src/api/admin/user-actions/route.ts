import { Modules, type UserModuleService } from '@traiku/framework';
import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';

/** The team's journal, newest first. */
export const GET = async (req: AuthenticatedTraikuRequest<unknown, { limit: number; offset: number }>, res: TraikuResponse) => {
  const users = req.scope.resolve<UserModuleService>(Modules.USER);
  const [actions, count] = await users.listAndCountUserActions({}, { take: req.validatedQuery.limit, skip: req.validatedQuery.offset });
  const people = actions.length ? await users.listUsers({ id: [...new Set(actions.map((a) => a.actor_id))] }, { select: ['id', 'email'] }) : [];
  res.json({ actions: actions.map((a) => ({ ...a, email: people.find((u) => u.id === a.actor_id)?.email ?? null })), count });
};
