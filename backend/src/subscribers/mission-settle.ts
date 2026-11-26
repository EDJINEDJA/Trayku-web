import { ContainerRegistrationKeys, type Logger } from '@traiku/framework';
import type { SubscriberArgs, SubscriberConfig } from '@traiku/framework/events';
import { settleMissionPayment } from '../workflows/payments';
import { recordMissionEarnings } from '../workflows/payouts/earnings';

/**
 * A mission closes (delivered, item refused after the check, cancelled, the requester absent, refused by the team): what is
 * due is captured from the reservation, the rest released; then what each Traikeur earned is
 * recorded (payouts). Run events carry the mission in
 * mission_id, the mission's own in id.
 */
export default async function missionSettle({ event, container }: SubscriberArgs<{ id: string; mission_id?: string }>) {
  const missionId = event.data.mission_id ?? event.data.id;
  try {
    await settleMissionPayment(container, missionId);
  } catch (e) {
    // Not lost: the team sees the reservation still open in the payments.
    container.resolve<Logger>(ContainerRegistrationKeys.LOGGER).error(`paiement de la mission ${missionId} non réglé : ${(e as Error).message}`);
  }
  try {
    await recordMissionEarnings(container, missionId);
  } catch (e) {
    // Recorded again on the next closing event or by the team: settling twice adds nothing.
    container.resolve<Logger>(ContainerRegistrationKeys.LOGGER).error(`gains de la mission ${missionId} non enregistrés : ${(e as Error).message}`);
  }
}

export const config: SubscriberConfig = { event: ['mission.cancelled', 'mission.reviewed', 'run.delivered', 'run.decided', 'run.report_sent', 'run.no_show'] };
