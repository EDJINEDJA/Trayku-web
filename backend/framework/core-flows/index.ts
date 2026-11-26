import type { GraphArgs, LinkService, Query } from '../links';
import type { AuthModuleService } from '../modules-core/auth';
import { createStep, StepResponse } from '../workflows';
import { ContainerRegistrationKeys, Modules } from '../utils';

/** Steps shared by the workflows, as Medusa's core-flows. */

/** Keeps the event until the workflow succeeds; dropped if it fails. */
export const emitEventStep = createStep('emit-event', (input: { eventName: string; data: Record<string, unknown> | Record<string, unknown>[] }, { context }) => {
  const list = Array.isArray(input.data) ? input.data : [input.data];
  for (const data of list) context.eventGroup.push({ name: input.eventName, data });
  return new StepResponse(undefined);
});

/** Reads with Query inside a workflow. */
export const useQueryGraphStep = createStep('use-query-graph', async (input: GraphArgs, { container }) => {
  const query = container.resolve<Query>(ContainerRegistrationKeys.QUERY);
  return new StepResponse(await query.graph(input));
});

/** Ties an auth identity to the record it signs in as ({ member_id } or { user_id }). */
export const setAuthAppMetadataStep = createStep(
  'set-auth-app-metadata',
  async (input: { authIdentityId: string; actorType: string; value: string }, { container }) => {
    const auth = container.resolve<AuthModuleService>(Modules.AUTH);
    const key = `${input.actorType}_id`;
    const identity = await auth.retrieveAuthIdentity(input.authIdentityId);
    if (identity.app_metadata?.[key]) throw new Error(`Cette identité est déjà liée à un ${input.actorType}.`);
    await auth.setAppMetadata(input.authIdentityId, key, input.value);
    return new StepResponse(identity, { id: input.authIdentityId, key });
  },
  async (prev, { container }) => {
    await container.resolve<AuthModuleService>(Modules.AUTH).setAppMetadata(prev.id, prev.key, null);
  }
);

type LinkInput = Record<string, Record<string, string>>;

export const createLinksStep = createStep(
  'create-links',
  async (input: LinkInput[], { container }) => {
    await container.resolve<LinkService>(ContainerRegistrationKeys.LINK).create(input);
    return new StepResponse(input);
  },
  async (input, { container }) => {
    await container.resolve<LinkService>(ContainerRegistrationKeys.LINK).dismiss(input);
  }
);
