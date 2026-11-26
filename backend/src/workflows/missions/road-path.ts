import type { AwilixContainer } from 'awilix';
import { MISSION_MODULE, type MissionModuleService } from '../../modules/mission';
import { isOnsite } from '../../lib/rules';
import { publicPoint, roadPath } from '../../lib/routing';

/**
 * A mission's road, between its places as the public sees them, kept on the mission: the cards draw
 * it at once instead of each phone asking a router. Nothing for a mission on the spot (one place).
 * True once kept.
 */
export async function computeRoadPath(container: AwilixContainer, missionId: string) {
  const svc = container.resolve<MissionModuleService>(MISSION_MODULE);
  const m = await svc.retrieveMission(missionId);
  if (m.road_path || isOnsite(m)) return false;
  const a = publicPoint(m.pickup);
  const b = publicPoint(m.dropoff);
  if (a.latitude === b.latitude && a.longitude === b.longitude) return false;
  const path = await roadPath(a, b);
  if (!path) return false;
  await svc.updateMissions({ id: m.id, road_path: path });
  return true;
}
