import type { AwilixContainer } from 'awilix';
import type { JobConfig } from '@traiku/framework/jobs';
import { ContainerRegistrationKeys, type Logger } from '@traiku/framework';
import { PAYOUT_MODULE, type PayoutModuleService } from '../modules/payout';
import { blockedMissions } from '../workflows/payouts/earnings';

/** The earnings whose wait is over become available to withdraw, except those of a mission in dispute. */
export default async function releaseEarnings(container: AwilixContainer) {
  const count = await container.resolve<PayoutModuleService>(PAYOUT_MODULE).releaseEarnings(await blockedMissions(container));
  if (count) container.resolve<Logger>(ContainerRegistrationKeys.LOGGER).info(`${count} gain(s) disponible(s)`);
}

export const config: JobConfig = { name: 'release-earnings', schedule: '*/10 * * * *' };
