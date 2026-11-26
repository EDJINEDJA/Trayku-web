import { distanceM } from '@traiku/framework';
import type { SubscriberArgs, SubscriberConfig } from '@traiku/framework/events';
import { MEMBER_MODULE, type MemberModuleService } from '../modules/member';
import { MISSION_MODULE, type MissionModuleService } from '../modules/mission';
import { NO_SHOW_FLAG } from '../lib/rules';

const MONTH = 30 * 86400000;

/**
 * A Traikeur declared the requester absent: kept on their account (the last 30 days), and a case opened
 * for the support with what proves the visit (the run's face checks and positions). From NO_SHOW_FLAG
 * in 30 days, the case says so: the team looks at that Traikeur.
 */
export default async function runNoShow({ event, container }: SubscriberArgs<{ id: string; mission_id: string }>) {
  const missions = container.resolve<MissionModuleService>(MISSION_MODULE);
  const members = container.resolve<MemberModuleService>(MEMBER_MODULE);
  const [mission, run] = await Promise.all([missions.retrieveMission(event.data.mission_id), missions.retrieveRun(event.data.id)]);
  const traveler = await members.retrieveMember(run.traveler_id);
  const meta = (traveler.metadata ?? {}) as { no_shows?: string[] };
  const now = Date.now();
  const noShows = [...(meta.no_shows ?? []).filter((d) => now - new Date(d).getTime() < MONTH), new Date(now).toISOString()];
  await members.updateMembers({ id: traveler.id, metadata: { ...meta, no_shows: noShows } });

  const face = run.faces[run.faces.length - 1];
  const waited = run.pickup_unlocked_at ? Math.round((now - run.pickup_unlocked_at.getTime()) / 60000) : null;
  const where = face?.coords ? `, identité vérifiée à ${Math.round(distanceM(face.coords, mission.pickup))} m de l’adresse` : '';
  const flagged = noShows.length >= NO_SHOW_FLAG;
  await missions.createDisputes({
    mission_id: mission.id,
    run_id: run.id,
    opened_by: run.traveler_id,
    reason: 'absent',
    message: [
      `Client absent déclaré par ${traveler.first_name}${waited != null ? ` après ${waited} min d’attente` : ''}${where}.`,
      `${noShows.length} client${noShows.length > 1 ? 's' : ''} absent${noShows.length > 1 ? 's' : ''} déclaré${noShows.length > 1 ? 's' : ''} par ce Traikeur en 30 jours.`,
      flagged ? 'À surveiller : vérifiez les positions et les photos de ses arrivées.' : '',
    ]
      .filter(Boolean)
      .join(' '),
  });
}

export const config: SubscriberConfig = { event: 'run.no_show' };
