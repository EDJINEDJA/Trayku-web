import { Modules, type NotificationModuleService } from '@traiku/framework';
import type { SubscriberArgs, SubscriberConfig } from '@traiku/framework/events';
import { MISSION_MODULE, type MissionModuleService } from '../modules/mission';

/**
 * At a seller's (not on Traiku): once the Traikeur's face is checked on arrival, the seller gets the
 * code by SMS. They give it to the Traikeur, which proves the visit and opens the check.
 */
export default async function runFaceChecked({ event, container }: SubscriberArgs<{ id: string; mission_id: string }>) {
  const missions = container.resolve<MissionModuleService>(MISSION_MODULE);
  const [mission, run] = await Promise.all([missions.retrieveMission(event.data.mission_id), missions.retrieveRun(event.data.id)]);
  if (!mission.seller_code || !mission.seller?.phone || run.seller_checked_at) return;
  await container.resolve<NotificationModuleService>(Modules.NOTIFICATION).send({
    to: mission.seller.phone,
    channel: 'sms',
    template: 'seller-code',
    text: `Traiku : le Traikeur est arrivé pour « ${mission.title} ». Donnez-lui ce code : ${mission.seller_code}.`,
    data: { mission_id: mission.id, run_id: run.id },
  });
}

export const config: SubscriberConfig = { event: 'run.face_checked' };
