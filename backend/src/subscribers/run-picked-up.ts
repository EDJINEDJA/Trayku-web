import { Modules, type NotificationModuleService } from '@traiku/framework';
import type { SubscriberArgs, SubscriberConfig } from '@traiku/framework/events';
import { MISSION_MODULE, type MissionModuleService } from '../modules/mission';

/**
 * Whoever hands the parcel over is told the code was right, once: when it is typed on arrival, or
 * at the pickup when it was typed there.
 */
export default async function runPickedUp({ event, container }: SubscriberArgs<{ id: string; mission_id: string }>) {
  const missions = container.resolve<MissionModuleService>(MISSION_MODULE);
  const [mission, run] = await Promise.all([missions.retrieveMission(event.data.mission_id), missions.retrieveRun(event.data.id)]);
  if (!mission.handler_phone || !run.pickup_code_at) return;
  if (event.name === 'run.picked_up' && run.picked_at && run.pickup_code_at.getTime() !== run.picked_at.getTime()) return;
  await container.resolve<NotificationModuleService>(Modules.NOTIFICATION).send({
    to: mission.handler_phone,
    channel: 'sms',
    template: 'pickup-confirmed',
    text: `Traiku : le code est bon, « ${mission.title} » est bien pris en charge. Merci.`,
    data: { mission_id: mission.id, run_id: run.id },
  });
}

export const config: SubscriberConfig = { event: ['run.pickup_code_checked', 'run.picked_up'] };
