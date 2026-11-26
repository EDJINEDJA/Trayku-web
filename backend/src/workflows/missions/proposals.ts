import { emitEventStep } from '@traiku/framework/core-flows';
import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse } from '@traiku/framework/workflows';
import { TraikuError } from '@traiku/framework';
import { memberService, missionService } from '../steps';
import { acceptMissionWorkflow, assertCanTake, assertLicence, assertNewcomerFree } from './accept-mission';

/**
 * Vérification at a seller's who isn't on Traiku: Traikeurs passing by propose a time within the
 * seller's windows, the requester sends one to the seller (with the seller's code), and once the
 * seller agreed the mission goes to that Traikeur.
 */

const notAllowed = (m: string, code?: string) => new TraikuError(TraikuError.Types.NOT_ALLOWED, m, code);
const notFound = () => new TraikuError(TraikuError.Types.NOT_FOUND, 'Mission introuvable.');

type ProposeInput = { mission_id: string; traveler_id: string; at: Date };

const validateProposalStep = createStep('validate-proposal', async (input: ProposeInput, ctx) => {
  const mission = await missionService(ctx).retrieveMission(input.mission_id);
  const traveler = await memberService(ctx).retrieveMember(input.traveler_id);
  assertCanTake(mission, traveler, memberService(ctx));
  await assertLicence(mission, traveler, memberService(ctx));
  await assertNewcomerFree(ctx, mission, traveler, missionService(ctx));
  if (!mission.seller_windows?.length) throw notAllowed('Cette mission s’accepte directement.');
  if (mission.seller_confirmed) throw new TraikuError(TraikuError.Types.CONFLICT, 'Le vendeur a déjà confirmé un horaire.', 'mission_taken');
  const t = input.at.getTime();
  if (t < Date.now() + 15 * 60000) throw new TraikuError(TraikuError.Types.INVALID_DATA, 'Proposez un horaire dans au moins 15 minutes.');
  if (!mission.seller_windows.some((w) => t >= new Date(w.from).getTime() && t <= new Date(w.to).getTime())) throw new TraikuError(TraikuError.Types.INVALID_DATA, 'Choisissez un horaire où le vendeur est disponible.');
  const mine = await missionService(ctx).listProposals({ mission_id: mission.id, member_id: traveler.id });
  if (mine.some((p) => p.status === 'sent')) throw notAllowed('Le demandeur a déjà transmis votre horaire au vendeur.');
  return new StepResponse(mine.map((p) => p.id));
});

const replaceProposalStep = createStep(
  'replace-proposal',
  async (input: ProposeInput & { previous: string[] }, ctx) => {
    const svc = missionService(ctx);
    const previous = input.previous.length ? await svc.listProposals({ id: input.previous }) : [];
    if (previous.length) await svc.deleteProposals(input.previous);
    const proposal = await svc.createProposals({ mission_id: input.mission_id, member_id: input.traveler_id, at: input.at });
    return new StepResponse(proposal, { id: proposal.id, previous: previous.map(({ mission_id, member_id, at, status }) => ({ mission_id, member_id, at, status })) });
  },
  async (prev, ctx) => {
    const svc = missionService(ctx);
    await svc.deleteProposals(prev.id);
    for (const p of prev.previous) await svc.createProposals(p);
  }
);

/** A Traikeur proposes a time (one per Traikeur: a new one replaces theirs). */
export const proposeTimeWorkflow = createWorkflow('propose-time', (input: ProposeInput) => {
  const previous = validateProposalStep(input);
  const proposal = replaceProposalStep(transform({ input, previous }, ({ input, previous }) => ({ ...input, previous })));
  emitEventStep({ eventName: 'mission.time_proposed', data: transform({ proposal }, ({ proposal }) => ({ id: proposal.mission_id, proposal_id: proposal.id })) });
  return new WorkflowResponse(proposal);
});

type ChooseInput = { mission_id: string; requester_id: string; proposal_id: string | null };

/** The requester picks the proposal to send to the seller (null: picks again). */
const chooseProposalStep = createStep(
  'choose-proposal',
  async (input: ChooseInput, ctx) => {
    const svc = missionService(ctx);
    const mission = await svc.retrieveMission(input.mission_id);
    if (mission.requester_id !== input.requester_id) throw notFound();
    if (mission.seller_confirmed || mission.status !== 'open') throw notAllowed('Le vendeur a déjà confirmé un horaire.');
    if (input.proposal_id) {
      const [p] = await svc.listProposals({ id: input.proposal_id, mission_id: mission.id });
      if (!p) throw new TraikuError(TraikuError.Types.NOT_FOUND, 'Proposition introuvable.');
    }
    const before = { chosen: mission.chosen_proposal_id };
    if (before.chosen) await svc.updateProposals({ id: before.chosen, status: 'pending' });
    if (input.proposal_id) await svc.updateProposals({ id: input.proposal_id, status: 'sent' });
    await svc.updateMissions({ id: mission.id, chosen_proposal_id: input.proposal_id });
    return new StepResponse({ mission_id: mission.id, chosen_proposal_id: input.proposal_id }, { mission_id: mission.id, ...before, now: input.proposal_id });
  },
  async (prev, ctx) => {
    const svc = missionService(ctx);
    if (prev.now) await svc.updateProposals({ id: prev.now, status: 'pending' });
    if (prev.chosen) await svc.updateProposals({ id: prev.chosen, status: 'sent' });
    await svc.updateMissions({ id: prev.mission_id, chosen_proposal_id: prev.chosen });
  }
);

export const chooseProposalWorkflow = createWorkflow('choose-proposal', (input: ChooseInput) => {
  return new WorkflowResponse(chooseProposalStep(input));
});

type ConfirmInput = { mission_id: string; requester_id: string };

const validateSellerConfirmStep = createStep('validate-seller-confirm', async (input: ConfirmInput, ctx) => {
  const svc = missionService(ctx);
  const mission = await svc.retrieveMission(input.mission_id);
  if (mission.requester_id !== input.requester_id) throw notFound();
  if (mission.seller_confirmed) throw notAllowed('Le vendeur a déjà confirmé.');
  const [proposal] = mission.chosen_proposal_id ? await svc.listProposals({ id: mission.chosen_proposal_id }) : [];
  if (!proposal) throw notAllowed('Choisissez d’abord un horaire à transmettre au vendeur.', 'proposal_required');
  return new StepResponse(proposal);
});

const setAppointmentStep = createStep(
  'set-appointment',
  async (input: { mission_id: string; proposal_id: string; at: Date }, ctx) => {
    const svc = missionService(ctx);
    const others = await svc.listProposals({ mission_id: input.mission_id, id: { $ne: input.proposal_id } });
    await svc.updateMissions({ id: input.mission_id, appointment: input.at, seller_confirmed: true });
    await svc.updateProposals({ id: input.proposal_id, status: 'accepted' });
    for (const p of others) await svc.updateProposals({ id: p.id, status: 'declined' });
    return new StepResponse(undefined, { ...input, others: others.map((p) => ({ id: p.id, status: p.status })) });
  },
  async (prev, ctx) => {
    const svc = missionService(ctx);
    await svc.updateMissions({ id: prev.mission_id, appointment: null, seller_confirmed: false });
    await svc.updateProposals({ id: prev.proposal_id, status: 'sent' });
    for (const p of prev.others) await svc.updateProposals(p);
  }
);

/** The seller agreed to the time sent: the appointment is set, and the mission goes to that Traikeur. */
export const confirmSellerWorkflow = createWorkflow('confirm-seller', (input: ConfirmInput) => {
  const proposal = validateSellerConfirmStep(input);
  setAppointmentStep(transform({ proposal }, ({ proposal }) => ({ mission_id: proposal.mission_id, proposal_id: proposal.id, at: proposal.at })));
  const run = acceptMissionWorkflow.runAsStep({
    input: transform({ proposal }, ({ proposal }) => ({ mission_id: proposal.mission_id, traveler_id: proposal.member_id, via_proposal: true })),
  });
  return new WorkflowResponse(run);
});
