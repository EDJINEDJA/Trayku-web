import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import type { Workflow } from '@traiku/framework/workflows';
import { MISSION_MODULE, type MissionModuleService } from '../../modules/mission';
import { missionView } from './views';

/**
 * A step of the run: the workflow with the run id, the member (as its Traikeur or its requester) and
 * the validated body; then the mission as they now see it.
 */
export function runStepRoute<I extends { run_id: string }, O>(workflow: Workflow<I, O>, actor: 'traveler_id' | 'requester_id' = 'traveler_id') {
  return async (req: AuthenticatedTraikuRequest<object>, res: TraikuResponse) => {
    const runId = String(req.params.id);
    const { result } = await workflow(req.scope).run({ input: { ...req.validatedBody, run_id: runId, [actor]: req.auth_context.actor_id } as I });
    const svc = req.scope.resolve<MissionModuleService>(MISSION_MODULE);
    const run = await svc.retrieveRun(runId);
    const withdrawal = result && typeof result === 'object' && 'suspended' in result ? (result as unknown as { free: boolean; suspended: boolean }) : null;
    res.json({
      mission: await missionView(req.scope, await svc.retrieveMission(run.mission_id), req.auth_context.actor_id),
      ...(withdrawal && { free: withdrawal.free, suspended: withdrawal.suspended }),
    });
  };
}
