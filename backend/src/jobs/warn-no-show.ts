import type { AwilixContainer } from 'awilix';
import type { JobConfig } from '@traiku/framework/jobs';
import { ContainerRegistrationKeys, Modules, type Logger, type NotificationModuleService } from '@traiku/framework';
import { MEMBER_MODULE, type MemberModuleService } from '../modules/member';
import { MISSION_MODULE, type MissionModuleService } from '../modules/mission';
import { getPricing } from '../lib/regions';
import { isIntervention, NO_SHOW_MIN, noShowTerms } from '../lib/rules';

/** « 4,50 € », in the mission's currency. */
const money = (v: number, currency: string) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency.toUpperCase() }).format(v);

/** How long into the wait the requester is warned: before the Traikeur may stop (NO_SHOW_MIN). */
const WARN_MIN = 10;

/**
 * An assistance service, the Traikeur arrived (face checked) and still no presence code after WARN_MIN
 * minutes: the requester is told by SMS what happens at NO_SHOW_MIN, with the amount. Once per run.
 */
export default async function warnNoShow(container: AwilixContainer) {
  const svc = container.resolve<MissionModuleService>(MISSION_MODULE);
  const now = Date.now();
  const waiting = await svc.listRuns({
    status: 'active',
    pickup_code_at: null,
    pickup_unlocked_at: { $lt: new Date(now - WARN_MIN * 60000), $gt: new Date(now - NO_SHOW_MIN * 60000) },
  });
  if (!waiting.length) return;
  const warned = new Set((await svc.listRunEvents({ run_id: waiting.map((r) => r.id), type: 'no_show_warned' })).map((e) => e.run_id));
  const members = container.resolve<MemberModuleService>(MEMBER_MODULE);
  const sms = container.resolve<NotificationModuleService>(Modules.NOTIFICATION);
  for (const run of waiting.filter((r) => !warned.has(r.id))) {
    try {
      const mission = await svc.retrieveMission(run.mission_id);
      if (!isIntervention(mission)) continue;
      const [requester, traveler] = await Promise.all([members.retrieveMember(mission.requester_id), members.retrieveMember(run.traveler_id)]);
      const { fee } = noShowTerms(mission, await getPricing(container, mission.region_id));
      const waited = Math.round((now - run.pickup_unlocked_at!.getTime()) / 60000);
      const left = Math.max(1, NO_SHOW_MIN - waited);
      await sms.send({
        to: requester.phone,
        channel: 'sms',
        template: 'no-show-warning',
        text: `Traiku : ${traveler.first_name} vous attend depuis ${waited} min pour « ${mission.title} ». Sans code de présence dans ${left} min, il pourra arrêter la mission et ${money(fee, mission.currency_code)} vous seront facturés.`,
        data: { mission_id: mission.id, run_id: run.id },
      });
      await svc.logEvent(run.id, 'no_show_warned', null);
    } catch (e) {
      container.resolve<Logger>(ContainerRegistrationKeys.LOGGER).error(`avertissement d’absence non envoyé (${run.id}) : ${(e as Error).message}`);
    }
  }
}

export const config: JobConfig = { name: 'warn-no-show', schedule: '* * * * *' };
