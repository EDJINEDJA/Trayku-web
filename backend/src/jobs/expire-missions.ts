import type { AwilixContainer } from 'awilix';
import type { JobConfig } from '@traiku/framework/jobs';
import { ContainerRegistrationKeys, type Logger } from '@traiku/framework';
import { MISSION_MODULE, type MissionModuleService } from '../modules/mission';
import { settleMissionPayment } from '../workflows/payments';

/** Missions nobody took (or never paid) before their deadline close; the card reservation is lifted. */
export default async function expireMissions(container: AwilixContainer) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const expired = await container.resolve<MissionModuleService>(MISSION_MODULE).updateMissions({
    selector: { status: ['awaiting_payment', 'open', 'review'], deadline: { $lt: new Date() } },
    data: { status: 'cancelled', cancelled_at: new Date(), metadata: { outcome: 'expired' } },
  });
  for (const m of expired) await settleMissionPayment(container, m.id).catch((e: Error) => logger.error(`réservation de la mission ${m.id} non levée : ${e.message}`));
  if (expired.length) logger.info(`${expired.length} mission(s) expirée(s)`);
}

export const config: JobConfig = { name: 'expire-missions', schedule: '*/10 * * * *' };
