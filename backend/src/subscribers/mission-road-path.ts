import { ContainerRegistrationKeys, type Logger } from '@traiku/framework';
import type { SubscriberArgs, SubscriberConfig } from '@traiku/framework/events';
import { computeRoadPath } from '../workflows/missions/road-path';

/** A mission just published: its road computed once, for every card that shows it. */
export default async function missionRoadPath({ event, container }: SubscriberArgs<{ id: string }>) {
  await computeRoadPath(container, event.data.id).catch((e: Error) =>
    container.resolve<Logger>(ContainerRegistrationKeys.LOGGER).warn(`tracé de la mission ${event.data.id} non calculé : ${e.message}`)
  );
}

export const config: SubscriberConfig = { event: 'mission.created' };
