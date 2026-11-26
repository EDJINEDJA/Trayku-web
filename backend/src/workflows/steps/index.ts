import { createStep, StepResponse, type StepExecutionContext } from '@traiku/framework/workflows';
import { TraikuError } from '@traiku/framework';
import { MISSION_MODULE, type LatLng, type MissionModuleService } from '../../modules/mission';
import type { Changes, MissionRow, RunRow } from '../../modules/mission/service';
import { MEMBER_MODULE, type MemberModuleService } from '../../modules/member';

export const missionService = (ctx: Pick<StepExecutionContext, 'container'>) => ctx.container.resolve<MissionModuleService>(MISSION_MODULE);
export const memberService = (ctx: Pick<StepExecutionContext, 'container'>) => ctx.container.resolve<MemberModuleService>(MEMBER_MODULE);

/** The run and its mission, if `actor_id` is its Traikeur (as) or its requester. Not found otherwise: nothing leaks. */
export async function loadRun(ctx: Pick<StepExecutionContext, 'container'>, runId: string, actorId: string, as: 'traveler' | 'requester' | 'either' = 'traveler') {
  const svc = missionService(ctx);
  const run = await svc.retrieveRun(runId).catch(() => null);
  const mission = run ? await svc.retrieveMission(run.mission_id) : null;
  const ok = run && mission && ((as !== 'requester' && run.traveler_id === actorId) || (as !== 'traveler' && mission.requester_id === actorId));
  if (!ok) throw new TraikuError(TraikuError.Types.NOT_FOUND, 'Mission introuvable.');
  return { run: run!, mission: mission! };
}

/** The run is still under way (not cancelled, delivered or locked). */
export function assertActive(run: RunRow) {
  if (run.status !== 'active') throw new TraikuError(TraikuError.Types.NOT_ALLOWED, 'Cette mission n’est plus en cours.', 'run_closed');
  if (run.locked_at) throw new TraikuError(TraikuError.Types.NOT_ALLOWED, 'Trop de codes faux : la mission est bloquée. Contactez le support.', 'run_locked');
}

export type Planned = Changes & { event?: { type: string; actor_id: string; coords?: LatLng | null; payload?: Record<string, unknown> } };

/** Applies the changes a validation step planned, run and mission together; undone with the values before. */
export const applyChangesStep = createStep(
  'apply-changes',
  async (input: Planned, ctx) => {
    const { before, after } = await missionService(ctx).applyChanges(input);
    return new StepResponse(after as { run?: RunRow; mission?: MissionRow }, before);
  },
  async (before, ctx) => {
    await missionService(ctx).applyChanges(before);
  }
);

/** Writes the event in the run's history (last, once the change is made). */
export const logRunEventStep = createStep('log-run-event', async (input: Planned, ctx) => {
  if (input.run_id && input.event) await missionService(ctx).logEvent(input.run_id, input.event.type, input.event.actor_id, input.event.coords, input.event.payload);
  return new StepResponse(undefined);
});

/** Adds to a member's count of missions done; undone if the workflow fails after. */
export const incrementMissionsDoneStep = createStep(
  'increment-missions-done',
  async (input: { member_id: string }, ctx) => {
    const m = await memberService(ctx).retrieveMember(input.member_id);
    await memberService(ctx).updateMembers({ id: m.id, missions_done: m.missions_done + 1 });
    return new StepResponse(undefined, { id: m.id, missions_done: m.missions_done });
  },
  async (prev, ctx) => {
    await memberService(ctx).updateMembers({ id: prev.id, missions_done: prev.missions_done });
  }
);
