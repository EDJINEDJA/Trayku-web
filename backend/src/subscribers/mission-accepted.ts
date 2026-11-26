import { Modules, type NotificationModuleService } from '@traiku/framework';
import type { SubscriberArgs, SubscriberConfig } from '@traiku/framework/events';
import { MEMBER_MODULE, type MemberModuleService } from '../modules/member';
import { MISSION_MODULE, type MissionModuleService } from '../modules/mission';

/**
 * The codes go to the people who aren't on Traiku: whoever hands the parcel over gets the pickup
 * code, the recipient the delivery code. Without a phone, the requester sees them in the app.
 */
export default async function missionAccepted({ event, container }: SubscriberArgs<{ id: string; run_id: string }>) {
  const missions = container.resolve<MissionModuleService>(MISSION_MODULE);
  const mission = await missions.retrieveMission(event.data.id);
  const run = await missions.retrieveRun(event.data.run_id);
  const members = container.resolve<MemberModuleService>(MEMBER_MODULE);
  const [traveler, requester] = await Promise.all([members.retrieveMember(run.traveler_id), members.retrieveMember(mission.requester_id)]);
  const sms = container.resolve<NotificationModuleService>(Modules.NOTIFICATION);

  if (mission.handler_phone) {
    await sms.send({
      to: mission.handler_phone,
      channel: 'sms',
      template: 'pickup-code',
      text: `Traiku : ${traveler.first_name} vient chercher « ${mission.title} » de la part de ${requester.first_name}. À son arrivée, donnez-lui ce code : ${run.pickup_code}. Ne le donnez qu’à la personne qui prend l’objet.`,
      data: { mission_id: mission.id, run_id: run.id },
    });
  }
  if (mission.recipient_phone && mission.mode === 'transport') {
    await sms.send({
      to: mission.recipient_phone,
      channel: 'sms',
      template: 'dropoff-code',
      text: `Traiku : « ${mission.title} » va vous être remis par ${traveler.first_name}. À la remise, donnez ce code : ${run.dropoff_code}. Ne le donnez qu’une fois l’objet en main.`,
      data: { mission_id: mission.id, run_id: run.id },
    });
  }
}

export const config: SubscriberConfig = { event: 'mission.accepted' };
