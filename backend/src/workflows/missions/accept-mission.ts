import { emitEventStep } from '@traiku/framework/core-flows';
import { createStep, createWorkflow, StepResponse, WorkflowResponse } from '@traiku/framework/workflows';
import { TraikuError } from '@traiku/framework';
import { CONVERSATION_MODULE, type ConversationModuleService } from '../../modules/conversation';
import { TRIP_MODULE, type TripModuleService } from '../../modules/trip';
import { needsVerifier } from '../../lib/rules';
import { getPricing } from '../../lib/regions';
import { logRunEventStep, memberService, missionService } from '../steps';
import type { MemberModuleService } from '../../modules/member';
import type { MemberRow } from '../../modules/member/service';
import type { MissionRow } from '../../modules/mission/service';
import type { MissionModuleService } from '../../modules/mission';

export type AcceptMissionInput = { mission_id: string; traveler_id: string; trip_id?: string | null; /** Set by the seller's confirmation (proposals). */ via_proposal?: boolean };

/** Who may take it: not their own, open, active account, the trade for pro, the certificate for verifications. */
export function assertCanTake(mission: MissionRow, traveler: MemberRow, members: MemberModuleService) {
  members.assertActive(traveler);
  // Someone who goes to strangers' homes: their identity checked first.
  if (!traveler.verified_id) throw new TraikuError(TraikuError.Types.NOT_ALLOWED, 'Votre identité est en cours de vérification : vous pourrez accepter des missions dès qu’elle est validée.', 'identity_required');
  const notAllowed = (m: string, code?: string) => new TraikuError(TraikuError.Types.NOT_ALLOWED, m, code);
  if (mission.requester_id === traveler.id) throw notAllowed('C’est votre mission : vous ne pouvez pas l’accepter.');
  if (mission.status !== 'open') throw new TraikuError(TraikuError.Types.CONFLICT, 'Cette mission n’est plus disponible.', 'mission_taken');
  if (mission.deadline < new Date()) throw notAllowed('Cette mission est expirée.');
  if (mission.obd_diagnostic && !traveler.obd_reader) throw notAllowed('Cette vérification demande un lecteur de diagnostic (OBD), que vous n’avez pas déclaré.');
  if (mission.mode === 'pro' && (!mission.profession || !traveler.professions.includes(mission.profession))) throw notAllowed('Cette mission demande un métier que vous n’avez pas déclaré.');
  if (needsVerifier(mission) && (!traveler.verifier || traveler.verifier.in_review)) throw notAllowed('Les vérifications demandent le certificat Traiku : passez le test d’abord.', 'verifier_required');
}

/** The categories a vehicle asks for: a car, the B; a motorbike or a scooter, a motorbike one (or the B, up to 125). */
const vehicleCategories = (mission: MissionRow) => (mission.catalog_id?.endsWith('moto') ? ['AM', 'A1', 'A2', 'A', 'B'] : ['B']);

/**
 * Vérification et retrait of a car or a motorbike: the Traikeur drives it back, so their driving
 * licence must have been sent and approved by the team, with a category that fits.
 */
export async function assertLicence(mission: MissionRow, traveler: MemberRow, members: MemberModuleService) {
  if (mission.category !== 'checkpickup' || mission.inspect_kind !== 'vehicle') return;
  const fits = vehicleCategories(mission);
  const approved = await members.listCredentials({ member_id: traveler.id, kind: 'licence', status: 'approved' });
  if (approved.some((c) => (c.title ?? '').split(',').some((x) => fits.includes(x.trim())))) return;
  const waiting = (await members.listCredentials({ member_id: traveler.id, kind: 'licence', status: 'pending' }, { take: 1 })).length > 0;
  throw new TraikuError(
    TraikuError.Types.NOT_ALLOWED,
    waiting
      ? 'Votre permis est en cours de vérification. Vous pourrez ramener des véhicules dès qu’il est validé.'
      : approved.length
        ? `Ce véhicule demande le permis ${fits.length === 1 ? 'B' : 'moto ou B'}, qui n’est pas sur votre permis validé.`
        : 'Pour ramener ce véhicule, envoyez d’abord votre permis de conduire. L’équipe le vérifie avant que vous puissiez accepter.',
    'licence_required'
  );
}

/**
 * A new Traikeur takes one mission at a time: the next one once the current is done, until they have
 * done as many as the scale says (newcomers.one_at_a_time). A time proposed to a seller counts too.
 */
export async function assertNewcomerFree(ctx: { container: Parameters<typeof getPricing>[0] }, mission: MissionRow, traveler: MemberRow, svc: MissionModuleService) {
  const needed = (await getPricing(ctx.container, mission.region_id)).newcomers.one_at_a_time;
  if (traveler.missions_done >= needed) return;
  const [run] = await svc.listRuns({ traveler_id: traveler.id, status: 'active' }, { take: 1 });
  const proposals = await svc.listProposals({ member_id: traveler.id, status: ['pending', 'sent'], mission_id: { $ne: mission.id } });
  if (!run && !proposals.length) return;
  const left = needed - traveler.missions_done;
  throw new TraikuError(
    TraikuError.Types.NOT_ALLOWED,
    `Pour vos ${needed} premières missions, c’est une à la fois : terminez ${run ? 'celle en cours' : 'celle où vous avez proposé un horaire'} avant d’en prendre une autre. Encore ${left} mission${left > 1 ? 's' : ''} et vous pourrez en accepter plusieurs.`,
    'one_at_a_time'
  );
}

const validateAcceptStep = createStep('validate-accept', async (input: AcceptMissionInput & { via_proposal?: boolean }, ctx) => {
  const mission = await missionService(ctx).retrieveMission(input.mission_id);
  const traveler = await memberService(ctx).retrieveMember(input.traveler_id);
  assertCanTake(mission, traveler, memberService(ctx));
  await assertLicence(mission, traveler, memberService(ctx));
  // A crew: one place each.
  if ((await missionService(ctx).listRuns({ mission_id: mission.id, traveler_id: traveler.id, status: { $ne: 'cancelled' } }, { take: 1 })).length)
    throw new TraikuError(TraikuError.Types.NOT_ALLOWED, 'Vous êtes déjà sur cette mission.', 'already_on_it');
  await assertNewcomerFree(ctx, mission, traveler, missionService(ctx));
  // With a seller to agree with, the Traikeur proposes a time; the mission is theirs once the seller said yes.
  if (mission.seller_windows?.length && !input.via_proposal) throw new TraikuError(TraikuError.Types.NOT_ALLOWED, 'Proposez un horaire : le demandeur le transmet au vendeur.', 'proposal_required');
  if (input.trip_id) {
    const trip = await ctx.container.resolve<TripModuleService>(TRIP_MODULE).retrieveTrip(input.trip_id);
    if (trip.member_id !== traveler.id) throw new TraikuError(TraikuError.Types.NOT_FOUND, 'Trajet introuvable.');
  }
  return new StepResponse(mission);
});

const claimMissionStep = createStep(
  'claim-mission',
  async (input: AcceptMissionInput, ctx) => {
    const mission = await missionService(ctx).claim(input.mission_id);
    return new StepResponse(mission, mission.id);
  },
  async (id, ctx) => {
    await missionService(ctx).unclaim(id);
  }
);

const createRunStep = createStep(
  'create-run',
  async (input: AcceptMissionInput, ctx) => {
    const svc = missionService(ctx);
    const run = await svc.createRuns({ mission_id: input.mission_id, traveler_id: input.traveler_id, trip_id: input.trip_id ?? null, accepted_at: new Date(), ...svc.newCodes() });
    return new StepResponse(run, run.id);
  },
  async (id, ctx) => {
    await missionService(ctx).deleteRuns(id);
  }
);

/** The chat opens on acceptance (or already exists if the Traikeur asked questions before). */
const openConversationStep = createStep(
  'open-conversation',
  async (input: { mission_id: string; requester_id: string; traveler_id: string }, ctx) => {
    const svc = ctx.container.resolve<ConversationModuleService>(CONVERSATION_MODULE);
    const { conversation, created } = await svc.open(input.mission_id, input.requester_id, input.traveler_id);
    const message = await svc.createMessages({ conversation_id: conversation.id, kind: 'system', body: 'Mission acceptée. Vous pouvez vous écrire ici jusqu’à la fin de la mission.' });
    return new StepResponse(conversation, { conversation_id: created ? conversation.id : null, message_id: message.id });
  },
  async (prev, ctx) => {
    const svc = ctx.container.resolve<ConversationModuleService>(CONVERSATION_MODULE);
    await svc.deleteMessages(prev.message_id);
    if (prev.conversation_id) await svc.deleteConversations(prev.conversation_id);
  }
);

export const acceptMissionWorkflow = createWorkflow('accept-mission', (input: AcceptMissionInput) => {
  const mission = validateAcceptStep(input);
  claimMissionStep(input);
  const run = createRunStep(input);
  openConversationStep({ mission_id: input.mission_id, requester_id: mission.requester_id, traveler_id: input.traveler_id });
  logRunEventStep({ run_id: run.id, event: { type: 'accepted', actor_id: input.traveler_id } });
  emitEventStep({ eventName: 'mission.accepted', data: { id: input.mission_id, run_id: run.id } });
  return new WorkflowResponse(run);
});
