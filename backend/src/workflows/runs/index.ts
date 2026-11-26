import { emitEventStep } from '@traiku/framework/core-flows';
import { createStep, createWorkflow, StepResponse, transform, when, WorkflowResponse, type StepExecutionContext } from '@traiku/framework/workflows';
import { distanceM, Modules, TraikuError, type FileModuleService } from '@traiku/framework';
import type { LatLng, ProofPhoto } from '../../modules/mission';
import { reportFileIds } from '../../lib/report';
import { extraAmount } from '../../lib/pricing';
import { getPricing } from '../../lib/regions';
import { DECISION_MIN, EXTRA_ANSWER_MIN, isIntervention, isOnsite, locationChecked, NO_SHOW_MIN, noShowTerms, PICKUP_RADIUS_M, recentWithdrawals, WITHDRAW_LIMIT, withdrawTerms } from '../../lib/rules';
import { applyChangesStep, assertActive, incrementMissionsDoneStep, loadRun, logRunEventStep, memberService, missionService, type Planned } from '../steps';

/**
 * The steps of a mission once accepted, as the app shows them (mobile: app/run/[id].tsx). Each
 * workflow checks, then changes the run and the mission together, writes the history, and emits
 * the event. The codes are only checked here: the Traikeur never receives them.
 */

type Ctx = Pick<StepExecutionContext, 'container'>;
type Result = Planned & { finished?: { traveler_id: string } };

const notAllowed = (m: string, code?: string) => new TraikuError(TraikuError.Types.NOT_ALLOWED, m, code);

async function assertPhotos(ctx: Ctx, photos: ProofPhoto[], ownerId: string) {
  await ctx.container.resolve<FileModuleService>(Modules.FILE).assertOwned(
    photos.map((p) => p.file_id),
    ownerId
  );
}

function runAction<I extends { run_id: string }>(name: string, eventName: string, validate: (input: I, ctx: Ctx) => Promise<Result>) {
  const validateStep = createStep(`validate-${name}`, async (input: I, ctx) => new StepResponse(await validate(input, ctx)));
  return createWorkflow(name, (input: I) => {
    const planned = validateStep(input);
    const result = applyChangesStep(planned);
    when({ planned }, ({ planned }) => !!planned.finished).then(() => {
      incrementMissionsDoneStep({ member_id: planned.finished!.traveler_id });
    });
    logRunEventStep(planned);
    emitEventStep({ eventName, data: { id: input.run_id, mission_id: planned.mission_id } });
    return new WorkflowResponse(result);
  });
}

type Base = { run_id: string; traveler_id: string; coords?: LatLng | null };

/** The Traikeur at the address (within PICKUP_RADIUS_M), when positions are checked: on arrival, and to declare the requester absent. */
function assertThere(coords: LatLng | null | undefined, place: LatLng) {
  if (!locationChecked()) return;
  if (!coords) throw new TraikuError(TraikuError.Types.INVALID_DATA, 'Activez la localisation, elle confirme que vous êtes sur place.', 'location_required');
  if (distanceM(coords, place) > PICKUP_RADIUS_M) throw notAllowed(`Vous êtes à plus de ${PICKUP_RADIUS_M} m de l’adresse. Rendez-vous sur place pour continuer.`, 'too_far');
}

/** A request for more time left unanswered too long: refused. */
const extraExpired = (request: { at: string }) => Date.now() - new Date(request.at).getTime() > EXTRA_ANSWER_MIN * 60000;

/** "Je pars": towards the pickup, or towards the dropoff once picked up. */
export const startLegWorkflow = runAction('start-leg', 'run.leg_started', async (input: Base & { leg: 'pickup' | 'dropoff' }, ctx) => {
  const { run, mission } = await loadRun(ctx, input.run_id, input.traveler_id);
  assertActive(run);
  // A crew sets off together: not before every place is taken.
  if (mission.status === 'open' && (mission.crew ?? 1) > 1) {
    const missing = mission.crew - mission.seats_taken;
    throw notAllowed(`La mission commence quand l’équipe est au complet. Il manque encore ${missing} Traikeur${missing > 1 ? 's' : ''}.`, 'crew_incomplete');
  }
  const expected = input.leg === 'pickup' ? ['confirmed', 'to_pickup'] : ['picked_up', 'to_dropoff'];
  if (!expected.includes(run.step) || (input.leg === 'dropoff' && isOnsite(mission))) throw notAllowed('Cette étape n’est pas la suivante.');
  return {
    run_id: run.id,
    mission_id: mission.id,
    run: { step: input.leg === 'pickup' ? 'to_pickup' : 'to_dropoff', leg_started_at: new Date(), leg_from: input.coords ?? null },
    event: { type: `leg_${input.leg}`, actor_id: input.traveler_id, coords: input.coords },
  };
});

/**
 * Face check on arrival: at the parcel's or the store's, at the seller's door, at the place of an
 * on-site mission. Opens the exact details and keeps who was there. Not at the delivery.
 */
export const faceCheckWorkflow = runAction('face-check', 'run.face_checked', async (input: Base & { file_id: string }, ctx) => {
  const { run, mission } = await loadRun(ctx, input.run_id, input.traveler_id);
  assertActive(run);
  if (!['confirmed', 'to_pickup'].includes(run.step)) throw notAllowed('La vérification du visage se fait en arrivant, avant de commencer.');
  if (mission.category === 'checkpickup' && run.decision === 'accepted') throw notAllowed('Votre visage a déjà été vérifié à l’arrivée.');
  await ctx.container.resolve<FileModuleService>(Modules.FILE).assertOwned([input.file_id], input.traveler_id);
  assertThere(input.coords, mission.pickup);
  const face = { file_id: input.file_id, at: new Date().toISOString(), member_id: input.traveler_id, coords: input.coords ?? undefined };
  return {
    run_id: run.id,
    mission_id: mission.id,
    run: { faces: [...run.faces, face], pickup_unlocked_at: run.pickup_unlocked_at ?? new Date(), step: run.step === 'confirmed' ? 'to_pickup' : run.step },
    event: { type: 'face_checked', actor_id: input.traveler_id, coords: input.coords, payload: { file_id: input.file_id } },
  };
});

/** Vérification: the seller gives the code the requester sent them; it proves the visit. */
export const sellerCodeWorkflow = runAction('seller-code', 'run.seller_checked', async (input: Base & { code: string }, ctx) => {
  const { run, mission } = await loadRun(ctx, input.run_id, input.traveler_id);
  assertActive(run);
  if (mission.category !== 'check' && mission.category !== 'checkpickup') throw notAllowed('Cette mission n’a pas de vendeur.');
  if (!run.pickup_unlocked_at) throw notAllowed('Vérifiez d’abord votre visage en arrivant.', 'face_required');
  if (run.seller_checked_at) throw notAllowed('Le code du vendeur est déjà validé.');
  await missionService(ctx).checkCode(run, mission.seller_code, input.code, input.traveler_id);
  return { run_id: run.id, mission_id: mission.id, run: { seller_checked_at: new Date() }, event: { type: 'seller_checked', actor_id: input.traveler_id, coords: input.coords } };
});

/**
 * Vérification: the signed report. Verification only: the mission ends there. Vérification et
 * retrait: the requester has DECISION_MIN minutes to accept (and pay the seller) or refuse.
 */
export const sendReportWorkflow = runAction('send-report', 'run.report_sent', async (input: Base & { report: Record<string, unknown> & { verdict: string; photos: ProofPhoto[] } }, ctx) => {
  const { run, mission } = await loadRun(ctx, input.run_id, input.traveler_id);
  assertActive(run);
  if (!run.seller_checked_at) throw notAllowed('Validez d’abord le code du vendeur.', 'seller_code_required');
  if (run.report) throw notAllowed('Le rapport est déjà envoyé.');
  // No count of photos here: the protocol asks each one at its point (« Photo obligatoire »), and a count
  // fixed at publication goes wrong as soon as the protocol changes.
  await assertPhotos(ctx, input.report.photos, input.traveler_id);
  // Every photo the report points to, step by step, is one of its own (checked above): no one else's file.
  const own = new Set(input.report.photos.map((p) => p.file_id));
  if (reportFileIds(input.report).some((id) => !own.has(id))) throw new TraikuError(TraikuError.Types.INVALID_DATA, 'Le rapport cite une photo qui n’est pas dans sa liste.');
  const only = mission.category === 'check';
  const now = new Date();
  return {
    run_id: run.id,
    mission_id: mission.id,
    run: { report: input.report, report_sent_at: now, inspection: null, step: only ? 'delivered' : 'inspected', ...(only && { status: 'done' as const, delivered_at: now }) },
    mission: only ? { status: 'delivered' } : {},
    event: { type: 'report_sent', actor_id: input.traveler_id, coords: input.coords, payload: { verdict: input.report.verdict } },
    ...(only && { finished: { traveler_id: input.traveler_id } }),
  };
});

/** Vérification et retrait: the requester's answer to the report. Refused: the Traikeur is paid the verification only. */
export const decideReportWorkflow = runAction('decide-report', 'run.decided', async (input: { run_id: string; requester_id: string; decision: 'accepted' | 'refused' }, ctx) => {
  const { run, mission } = await loadRun(ctx, input.run_id, input.requester_id, 'requester');
  assertActive(run);
  if (run.step !== 'inspected' || run.decision) throw notAllowed('Il n’y a pas de rapport en attente de votre réponse.');
  if (run.report_sent_at && Date.now() - run.report_sent_at.getTime() > DECISION_MIN * 60000) throw notAllowed(`Les ${DECISION_MIN} minutes pour répondre sont passées.`, 'decision_expired');
  const now = new Date();
  if (input.decision === 'accepted') {
    return { run_id: run.id, mission_id: mission.id, run: { decision: 'accepted', decided_at: now }, event: { type: 'decision_accepted', actor_id: input.requester_id } };
  }
  return {
    run_id: run.id,
    mission_id: mission.id,
    run: { decision: 'refused', decided_at: now, step: 'delivered', status: 'done', delivered_at: now },
    mission: { status: 'delivered', metadata: { ...(mission.metadata ?? {}), outcome: 'verify_only' } },
    event: { type: 'decision_refused', actor_id: input.requester_id },
    finished: { traveler_id: run.traveler_id },
  };
});

/**
 * Parcel from a person: the code they give, typed on arrival, before the photo. Checked here; the
 * person handing over is told by SMS that it is the right Traikeur.
 */
export const pickupCodeWorkflow = runAction('pickup-code', 'run.pickup_code_checked', async (input: Base & { code: string }, ctx) => {
  const { run, mission } = await loadRun(ctx, input.run_id, input.traveler_id);
  assertActive(run);
  // An assistance service: the presence code, given by the requester once the face is checked; the time starts.
  const presence = isIntervention(mission);
  if (!presence && (isOnsite(mission) || mission.category === 'clickcollect' || mission.category === 'check' || mission.category === 'checkpickup'))
    throw notAllowed('Cette mission n’a pas de code de remise.');
  if (!run.pickup_unlocked_at) throw notAllowed('Vérifiez d’abord votre visage en arrivant.', 'face_required');
  if (run.pickup_code_at) throw notAllowed('Le code est déjà validé.');
  await missionService(ctx).checkCode(run, run.pickup_code, input.code, input.traveler_id);
  return {
    run_id: run.id,
    mission_id: mission.id,
    run: { pickup_code_at: new Date() },
    event: { type: presence ? 'presence_checked' : 'pickup_code_checked', actor_id: input.traveler_id, coords: input.coords },
  };
});

/**
 * Pickup. Parcel from a person: the code they got by SMS. Clic & Collect: the store hands over on the
 * order number. Vérification et retrait accepted: already on site. No photo asked: the face check and
 * the code already prove it; an older app may still send one, kept then.
 */
export const confirmPickupWorkflow = runAction('confirm-pickup', 'run.picked_up', async (input: Base & { code?: string; photo?: ProofPhoto | null }, ctx) => {
  const { run, mission } = await loadRun(ctx, input.run_id, input.traveler_id);
  assertActive(run);
  if (isOnsite(mission)) throw notAllowed('Une mission sur place se termine avec « Mission faite ».');
  if (run.picked_at) throw notAllowed('L’objet est déjà pris en charge.');
  const retrait = mission.category === 'checkpickup';
  if (retrait && run.decision !== 'accepted') throw notAllowed('Attendez que le demandeur valide l’achat.', 'decision_pending');
  if (!retrait && mission.category === 'check') throw notAllowed('Une vérification sans retrait se termine avec le rapport.');
  if (!run.pickup_unlocked_at) throw notAllowed('Vérifiez d’abord votre visage en arrivant.', 'face_required');
  // The code may have been checked on arrival already (pickupCodeWorkflow).
  const needsCode = !retrait && mission.category !== 'clickcollect' && !run.pickup_code_at;
  if (needsCode) {
    if (!input.code) throw new TraikuError(TraikuError.Types.INVALID_DATA, 'Demandez le code à la personne qui vous remet l’objet.', 'code_required');
    await missionService(ctx).checkCode(run, run.pickup_code, input.code, input.traveler_id);
  }
  if (input.photo) await assertPhotos(ctx, [input.photo], input.traveler_id);
  const now = new Date();
  return {
    run_id: run.id,
    mission_id: mission.id,
    run: { step: 'picked_up', picked_at: now, pickup_photo: input.photo ?? null, ...(needsCode && { pickup_code_at: now }) },
    mission: { status: 'picked_up' },
    event: { type: 'picked_up', actor_id: input.traveler_id, coords: input.coords, payload: { with_code: needsCode } },
  };
});

/**
 * Delivery: the recipient's code (no face check here); the photo is optional. Left in the letterbox:
 * no one to give a code, the photo of the parcel in it is the proof. The payment is released.
 */
export const confirmDropoffWorkflow = runAction('confirm-dropoff', 'run.delivered', async (input: Base & { code?: string; photo?: ProofPhoto | null }, ctx) => {
  const { run, mission } = await loadRun(ctx, input.run_id, input.traveler_id);
  assertActive(run);
  if (!['picked_up', 'to_dropoff'].includes(run.step)) throw notAllowed('Prenez d’abord l’objet en charge.');
  if (mission.handoff?.dropoff === 'letterbox' || mission.handoff?.dropoff === 'counter') {
    const what = mission.handoff.dropoff === 'counter' ? 'le reçu de dépôt' : 'le colis dans la boîte aux lettres';
    if (!input.photo) throw new TraikuError(TraikuError.Types.INVALID_DATA, `Photographiez ${what}.`, 'photo_required');
  } else {
    if (!input.code) throw new TraikuError(TraikuError.Types.INVALID_DATA, 'Le code fait 4 chiffres.');
    await missionService(ctx).checkCode(run, run.dropoff_code, input.code, input.traveler_id);
  }
  if (input.photo) await assertPhotos(ctx, [input.photo], input.traveler_id);
  const now = new Date();
  return {
    run_id: run.id,
    mission_id: mission.id,
    run: { step: 'delivered', status: 'done', delivered_at: now, dropoff_photo: input.photo ?? null },
    mission: { status: 'delivered' },
    event: { type: 'delivered', actor_id: input.traveler_id, coords: input.coords },
    finished: { traveler_id: input.traveler_id },
  };
});

/** On site: the photos on arrival ("before") and once done ("work"), the same views. Replaces the list. */
export const onsitePhotosWorkflow = runAction('onsite-photos', 'run.photos_updated', async (input: Base & { kind: 'before' | 'work'; photos: ProofPhoto[] }, ctx) => {
  const { run, mission } = await loadRun(ctx, input.run_id, input.traveler_id);
  assertActive(run);
  if (!isOnsite(mission)) throw notAllowed('Les photos de travail sont pour les missions sur place.');
  if (!run.pickup_unlocked_at) throw notAllowed('Vérifiez d’abord votre visage en arrivant.', 'face_required');
  await assertPhotos(ctx, input.photos, input.traveler_id);
  return {
    run_id: run.id,
    mission_id: mission.id,
    run: input.kind === 'before' ? { before_photos: input.photos } : { work_photos: input.photos },
    event: { type: `photos_${input.kind}`, actor_id: input.traveler_id, coords: input.coords, payload: { count: input.photos.length } },
  };
});

/** On site, "Mission faite": the list ticked and the photos, or the requester's code when they're there. */
export const completeOnsiteWorkflow = runAction('complete-onsite', 'run.delivered', async (input: Base & { checks: string[]; code?: string }, ctx) => {
  const { run, mission } = await loadRun(ctx, input.run_id, input.traveler_id);
  assertActive(run);
  if (!isOnsite(mission)) throw notAllowed('Cette mission se termine à la remise.');
  if (!run.pickup_unlocked_at) throw notAllowed('Vérifiez d’abord votre visage en arrivant.', 'face_required');
  const timed = isIntervention(mission);
  if (timed) {
    // An assistance service: started with the presence code, ended with the end code; no photos.
    if (!run.pickup_code_at) throw notAllowed('Saisissez d’abord le code de présence.', 'presence_required');
    if (!input.code) throw new TraikuError(TraikuError.Types.INVALID_DATA, 'Demandez le code de fin de mission au demandeur.', 'code_required');
    await missionService(ctx).checkCode(run, run.dropoff_code, input.code, input.traveler_id);
  } else if (mission.proof === 'code') {
    if (!input.code) throw new TraikuError(TraikuError.Types.INVALID_DATA, 'Demandez son code au demandeur.', 'code_required');
    await missionService(ctx).checkCode(run, run.dropoff_code, input.code, input.traveler_id);
  } else if (!run.work_photos.length) {
    throw new TraikuError(TraikuError.Types.INVALID_DATA, 'Ajoutez les photos une fois fini.', 'photos_required');
  }
  const now = new Date();
  // A crew: the mission is done when the last one is.
  const others = (await missionService(ctx).activeRuns(mission.id)).filter((r) => r.id !== run.id);
  return {
    run_id: run.id,
    mission_id: mission.id,
    run: { step: 'delivered', status: 'done', delivered_at: now, dropoff_photo: run.work_photos[0] ?? null, ...(timed && { extra_request: null }) },
    mission: others.length ? {} : { status: 'delivered' },
    event: { type: 'delivered', actor_id: input.traveler_id, coords: input.coords, payload: { checks: input.checks } },
    finished: { traveler_id: input.traveler_id },
  };
});

const countWithdrawalStep = createStep(
  'count-withdrawal',
  async (input: { traveler_id: string; free: boolean }, ctx) => {
    const members = memberService(ctx);
    const m = await members.retrieveMember(input.traveler_id);
    if (input.free) return new StepResponse({ suspended: false }, null);
    const withdrawals = [...recentWithdrawals(m.withdrawals), new Date().toISOString()];
    const suspended = withdrawals.length >= WITHDRAW_LIMIT;
    await members.updateMembers({ id: m.id, withdrawals, ...(suspended && { suspended_until: new Date(Date.now() + 7 * 86400000) }) });
    return new StepResponse({ suspended }, { id: m.id, withdrawals: m.withdrawals, suspended_until: m.suspended_until });
  },
  async (prev, ctx) => {
    if (prev) await memberService(ctx).updateMembers(prev);
  }
);

/**
 * The Traikeur gives the mission back, before setting off: it opens again for the others, first in
 * the list. Free in the first minutes; otherwise counted, and the third in 30 days suspends a week.
 */
const validateReleaseStep = createStep('validate-release', async (input: Base, ctx) => {
  const { run, mission } = await loadRun(ctx, input.run_id, input.traveler_id);
  assertActive(run);
  if (!['confirmed', 'to_pickup'].includes(run.step) || run.picked_at || run.seller_checked_at) throw notAllowed('Vous êtes déjà sur la mission : allez jusqu’au bout, ou contactez le support.');
  const traveler = await memberService(ctx).retrieveMember(input.traveler_id);
  const terms = withdrawTerms(run, traveler.withdrawals, await getPricing(ctx.container, mission.region_id));
  const now = new Date();
  return new StepResponse({
    planned: {
      run_id: run.id,
      mission_id: mission.id,
      run: { status: 'cancelled' as const, cancelled_at: now, cancelled_by: input.traveler_id },
      // Its place opens again (a crew keeps the others).
      mission: { status: 'open' as const, republished_at: now, seats_taken: Math.max(0, (mission.seats_taken ?? 1) - 1) },
      event: { type: 'released', actor_id: input.traveler_id, coords: input.coords, payload: { free: terms.free } },
    },
    free: terms.free,
  });
});

export const releaseRunWorkflow = createWorkflow('release-run', (input: Base) => {
  const v = validateReleaseStep(input);
  const result = applyChangesStep(v.planned);
  const withdrawal = countWithdrawalStep({ traveler_id: input.traveler_id, free: v.free });
  logRunEventStep(v.planned);
  emitEventStep({ eventName: 'run.released', data: { id: input.run_id, mission_id: v.planned.mission_id } });
  return new WorkflowResponse(transform({ result, v, withdrawal }, ({ result, v, withdrawal }) => ({ ...result, free: v.free, suspended: withdrawal.suspended })));
});

/** The requester's tip for the Traikeur, paid to them in full (null takes it back before the payment). */
export const setTipWorkflow = runAction('set-tip', 'run.tip_set', async (input: { run_id: string; requester_id: string; tip: number | null }, ctx) => {
  const { run, mission } = await loadRun(ctx, input.run_id, input.requester_id, 'requester');
  if (run.status === 'cancelled') throw notAllowed('Cette mission n’est plus en cours.', 'run_closed');
  return { run_id: run.id, mission_id: mission.id, run: { tip: input.tip ?? 0 }, event: { type: 'tip_set', actor_id: input.requester_id, payload: { tip: input.tip } } };
});

/**
 * On site, the task takes longer: the Traikeur asks for more time, by steps of 15 minutes, 45 at most
 * on the mission. The amount is set here, at the mission's rate; the requester accepts or refuses.
 */
export const requestExtraTimeWorkflow = runAction('request-extra-time', 'run.extra_requested', async (input: { run_id: string; traveler_id: string; minutes: number; reason?: string | null }, ctx) => {
  const { run, mission } = await loadRun(ctx, input.run_id, input.traveler_id);
  assertActive(run);
  if (!isOnsite(mission)) throw notAllowed('Le temps en plus ne concerne que les missions sur place.');
  if (isIntervention(mission) && !run.pickup_code_at) throw notAllowed('Le temps compte à partir du code de présence.', 'presence_required');
  // Unanswered after EXTRA_ANSWER_MIN minutes: refused, a new request may be made.
  if (run.extra_request && !extraExpired(run.extra_request)) throw notAllowed('Une demande attend déjà la réponse du demandeur.', 'extra_pending');
  const PRICING = await getPricing(ctx.container, mission.region_id);
  if (input.minutes % PRICING.step_minutes) throw new TraikuError(TraikuError.Types.INVALID_DATA, `Le temps en plus se demande par tranches de ${PRICING.step_minutes} min.`);
  const left = PRICING.max_extra_minutes - run.extra_minutes;
  if (input.minutes > left) throw notAllowed(left > 0 ? `Vous pouvez encore demander ${left} min au plus.` : `Le temps en plus est limité à ${PRICING.max_extra_minutes} min par mission.`, 'extra_limit');
  const request = { minutes: input.minutes, amount: extraAmount(PRICING, mission.price, mission.onsite_minutes, input.minutes), reason: input.reason || null, at: new Date().toISOString() };
  return { run_id: run.id, mission_id: mission.id, run: { extra_request: request }, event: { type: 'extra_requested', actor_id: input.traveler_id, payload: request } };
});

/** The requester's answer: accepted, the time and its amount are added to what the Traikeur is paid. */
export const answerExtraTimeWorkflow = runAction('answer-extra-time', 'run.extra_answered', async (input: { run_id: string; requester_id: string; accept: boolean }, ctx) => {
  const { run, mission } = await loadRun(ctx, input.run_id, input.requester_id, 'requester');
  assertActive(run);
  const request = run.extra_request;
  if (!request) throw notAllowed('Aucune demande de temps en plus en attente.', 'extra_none');
  if (extraExpired(request)) throw notAllowed(`Les ${EXTRA_ANSWER_MIN} minutes pour répondre sont passées : la demande est refusée.`, 'extra_expired');
  const accepted = input.accept ? { extra_minutes: run.extra_minutes + request.minutes, extra_amount: Number(run.extra_amount) + request.amount } : {};
  return {
    run_id: run.id,
    mission_id: mission.id,
    run: { extra_request: null, ...accepted },
    event: { type: input.accept ? 'extra_accepted' : 'extra_refused', actor_id: input.requester_id, payload: { minutes: request.minutes, amount: request.amount } },
  };
});

/**
 * An assistance service, the requester absent: NO_SHOW_MIN minutes after the face check on arrival and still
 * no presence code, the Traikeur stops. The mission is cancelled; the requester pays as for a late
 * cancellation, most of it to the Traikeur for the trip. Not counted as a withdrawal.
 */
export const noShowWorkflow = runAction('no-show', 'run.no_show', async (input: Base, ctx) => {
  const { run, mission } = await loadRun(ctx, input.run_id, input.traveler_id);
  assertActive(run);
  if (!isIntervention(mission)) throw notAllowed('Seulement pour une intervention sur place.');
  if (!run.pickup_unlocked_at) throw notAllowed('Vérifiez d’abord votre identité en arrivant.', 'face_required');
  if (run.pickup_code_at) throw notAllowed('Le code de présence est déjà saisi : la mission a commencé.');
  // Still at the address when stopping: not from home after a quarter of an hour.
  assertThere(input.coords, mission.pickup);
  const waited = Date.now() - run.pickup_unlocked_at.getTime();
  if (waited < NO_SHOW_MIN * 60000) {
    const left = Math.ceil((NO_SHOW_MIN * 60000 - waited) / 60000);
    throw notAllowed(`Attendez encore ${left} min avant de pouvoir arrêter.`, 'no_show_early');
  }
  const terms = noShowTerms(mission, await getPricing(ctx.container, mission.region_id));
  const now = new Date();
  // A crew: only this Traikeur stops, the mission goes on for the others (nothing charged).
  const others = (await missionService(ctx).activeRuns(mission.id)).filter((r) => r.id !== run.id);
  return {
    run_id: run.id,
    mission_id: mission.id,
    run: { status: 'cancelled', cancelled_at: now, cancelled_by: input.traveler_id },
    mission: others.length ? {} : { status: 'cancelled', cancelled_at: now, cancel_fee: terms.fee, metadata: { ...(mission.metadata ?? {}), outcome: 'no_show' } },
    event: { type: 'no_show', actor_id: input.traveler_id, coords: input.coords, payload: { waited_minutes: Math.round(waited / 60000), ...(others.length ? {} : terms) } },
  };
});
