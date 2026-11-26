import type { AwilixContainer } from 'awilix';
import type { JobConfig } from '@traiku/framework/jobs';
import { MISSION_MODULE, type MissionModuleService } from '../modules/mission';
import { computeRoadPath } from '../workflows/missions/road-path';

/**
 * The open missions still without a road (the router didn't answer at publication, or published
 * before): a few at a time, one after the other, so the free router isn't flooded.
 */
export default async function fillRoadPaths(container: AwilixContainer) {
  const missing = await container
    .resolve<MissionModuleService>(MISSION_MODULE)
    .listMissions({ status: ['open', 'review', 'accepted', 'picked_up'], road_path: null, mode: { $nin: ['onsite', 'pro'] } }, { select: ['id'], take: 20, order: { created_at: 'DESC' } });
  for (const m of missing) await computeRoadPath(container, m.id).catch(() => false);
}

export const config: JobConfig = { name: 'fill-road-paths', schedule: '*/5 * * * *' };
