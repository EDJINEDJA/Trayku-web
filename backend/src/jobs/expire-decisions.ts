import type { AwilixContainer } from 'awilix';
import type { JobConfig } from '@traiku/framework/jobs';
import { MEMBER_MODULE, type MemberModuleService } from '../modules/member';
import { MISSION_MODULE, type MissionModuleService } from '../modules/mission';
import { ContainerRegistrationKeys, type Logger } from '@traiku/framework';
import { DECISION_MIN } from '../lib/rules';
import { settleMissionPayment } from '../workflows/payments';
import { recordMissionEarnings } from '../workflows/payouts/earnings';

/**
 * Vérification et retrait: without an answer DECISION_MIN minutes after the report, the Traikeur
 * leaves without the object and is paid the verification: captured, and recorded in their earnings.
 */
export default async function expireDecisions(container: AwilixContainer) {
  const svc = container.resolve<MissionModuleService>(MISSION_MODULE);
  const members = container.resolve<MemberModuleService>(MEMBER_MODULE);
  const late = await svc.listRuns({ step: 'inspected', status: 'active', decision: null, report_sent_at: { $lt: new Date(Date.now() - DECISION_MIN * 60000) } });
  for (const run of late) {
    const now = new Date();
    const mission = await svc.retrieveMission(run.mission_id);
    await svc.applyChanges({
      run_id: run.id,
      run: { decision: 'expired', decided_at: now, step: 'delivered', status: 'done', delivered_at: now },
      mission_id: mission.id,
      mission: { status: 'delivered', metadata: { ...(mission.metadata ?? {}), outcome: 'verify_only' } },
    });
    const traveler = await members.retrieveMember(run.traveler_id);
    await members.updateMembers({ id: traveler.id, missions_done: traveler.missions_done + 1 });
    await svc.logEvent(run.id, 'decision_expired', null);
    try {
      await settleMissionPayment(container, mission.id);
      await recordMissionEarnings(container, mission.id);
    } catch (e) {
      container.resolve<Logger>(ContainerRegistrationKeys.LOGGER).error(`paiement de la mission ${mission.id} non réglé : ${(e as Error).message}`);
    }
  }
}

export const config: JobConfig = { name: 'expire-decisions', schedule: '* * * * *' };
