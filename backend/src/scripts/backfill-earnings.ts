import type { AwilixContainer } from 'awilix';
import { ContainerRegistrationKeys, type Logger } from '@traiku/framework';
import { MISSION_MODULE, type MissionModuleService } from '../modules/mission';
import { recordMissionEarnings } from '../workflows/payouts/earnings';

/**
 * Records the earnings of the missions closed before the payouts existed (npm run exec --
 * ./src/scripts/backfill-earnings.ts). Only those whose payment is captured; running it twice adds nothing.
 */
export default async function backfillEarnings({ container }: { container: AwilixContainer }) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const closed = await container.resolve<MissionModuleService>(MISSION_MODULE).listMissions({ status: ['delivered', 'cancelled'] }, { select: ['id'], take: 100000 });
  let made = 0;
  for (const m of closed) {
    try {
      made += (await recordMissionEarnings(container, m.id)).length;
    } catch (e) {
      logger.error(`mission ${m.id} : ${(e as Error).message}`);
    }
  }
  logger.info(`${made} gain(s) enregistré(s) sur ${closed.length} mission(s) close(s)`);
}
