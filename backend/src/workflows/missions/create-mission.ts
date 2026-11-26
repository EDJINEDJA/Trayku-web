import { emitEventStep } from '@traiku/framework/core-flows';
import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse } from '@traiku/framework/workflows';
import { ContainerRegistrationKeys, isSmsBlocked, Modules, normalizePhone, randomDigits, SMS_BLOCKED_MESSAGE, TraikuError, type ConfigModule, type FileModuleService } from '@traiku/framework';
import type { MissionChanges } from '../../modules/mission/service';
import { memberService, missionService } from '../steps';
import { missionFees } from '../../lib/pricing';
import { currencyOf, getPricing, regionOfMember } from '../../lib/regions';
import { BRAND_MODULE, brandKey, type BrandKind, type BrandModuleService } from '../../modules/brand';

export type CreateMissionInput = Omit<MissionChanges, 'dropoff'> & {
  requester_id: string;
  title: string;
  type: NonNullable<MissionChanges['type']>;
  category: NonNullable<MissionChanges['category']>;
  pickup: NonNullable<MissionChanges['pickup']>;
  /** On site: none, the place is the pickup. */
  dropoff?: MissionChanges['dropoff'] | null;
  deadline: Date;
  price: number;
};

/** Once paid: a free title (no catalogue entry, not a follow-up) waits for the team before Traikeurs see it. */
export const statusAfterPayment = (m: { catalog_id?: string | null; from_mission_id?: string | null }) => (m.catalog_id || m.from_mission_id ? ('open' as const) : ('review' as const));

/** The rules of a new mission; returns the row to create. */
const validateNewMissionStep = createStep('validate-new-mission', async (input: CreateMissionInput, ctx) => {
  const invalid = (m: string) => new TraikuError(TraikuError.Types.INVALID_DATA, m);
  const requester = await memberService(ctx).retrieveMember(input.requester_id);
  memberService(ctx).assertActive(requester);
  // Publishing needs the identity check sent (verified, or waiting for the team).
  if (!requester.verified_id && !(await memberService(ctx).listIdentityChecks({ member_id: requester.id, status: 'pending' }, { take: 1 })).length)
    throw new TraikuError(TraikuError.Types.NOT_ALLOWED, 'Vérifiez votre identité avant de publier une mission.', 'identity_required');

  const mode = input.mode ?? (input.category === 'assistance' ? 'onsite' : 'transport');
  if (input.deadline.getTime() < Date.now() + 15 * 60000) throw invalid('L’échéance doit être dans au moins 15 minutes.');
  if (input.window_start && input.window_start > input.deadline) throw invalid('Le début du créneau doit être avant sa fin.');
  // Priced in the requester's region, in its currency.
  const region = await regionOfMember(ctx.container, requester);
  const pricing = await getPricing(ctx.container, region?.id);
  const currency = currencyOf(region);
  if (input.price < pricing.min_price) throw invalid(`La rémunération doit être d’au moins ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(pricing.min_price)}.`);
  if (mode === 'transport' && !input.dropoff) throw invalid('Indiquez où remettre l’objet.');
  if (mode === 'pro' && !input.profession) throw invalid('Précisez le métier demandé.');
  if ((input.category === 'check' || input.category === 'checkpickup') && !input.seller) throw invalid('Indiquez le téléphone du vendeur.');
  if (input.category === 'checkpickup' && (input.verify_only_price == null || input.verify_only_price >= input.price)) throw invalid('Le montant si l’objet est refusé doit être inférieur à la rémunération.');
  if (input.category === 'clickcollect' && !input.order) throw invalid('Indiquez la commande à retirer.');
  // Several Traikeurs: only for a small job on site.
  if ((input.crew ?? 1) > 1 && input.category !== 'assistance') throw invalid('Plusieurs Traikeurs, c’est pour l’assistance sur place.');
  // What the counter will ask for, so the Traikeur never comes back empty-handed.
  let order = input.order ?? null;
  if (order) {
    const { mandate, ...rest } = order as typeof order & { mandate?: boolean };
    const proofs = rest.proofs ?? [];
    const methods = [...new Set(rest.methods?.length ? rest.methods : [rest.method ?? 'number'])];
    if (methods.includes('scan') && !proofs.length) throw invalid('Ajoutez la capture du code-barres ou du QR code.');
    if (methods.includes('code') && !rest.pickup_code?.trim()) throw invalid('Indiquez le code de retrait.');
    if (methods.includes('number') && !rest.ref?.trim()) throw invalid('Indiquez le numéro de commande.');
    if (rest.id_required && !mandate) throw invalid('Autorisez le Traikeur à retirer la commande en votre nom.');
    if (rest.last_day && new Date(rest.last_day) < input.deadline) throw invalid('Le magasin garde la commande moins longtemps que votre créneau : choisissez une livraison plus tôt.');
    if (proofs.length) await ctx.container.resolve<FileModuleService>(Modules.FILE).assertOwned(proofs, input.requester_id);
    order = { ...rest, methods, method: methods[0], proofs, ...(rest.id_required && { mandate_at: new Date().toISOString() }) };
  }

  // These numbers get SMS (codes): no premium range, against SMS pumping.
  const { blockedPrefixes } = ctx.container.resolve<ConfigModule>(ContainerRegistrationKeys.CONFIG_MODULE).projectConfig.sms;
  const phone = (p?: string | null) => {
    if (!p) return null;
    const n = normalizePhone(p);
    if (!n) throw invalid(`Numéro invalide : ${p}`);
    if (isSmsBlocked(n, blockedPrefixes)) throw invalid(SMS_BLOCKED_MESSAGE);
    return n;
  };
  // The transport of an item checked and bought meanwhile (Vérification et retrait closed): once,
  // with the title already published (so no new review).
  let originTitle: string | null = null;
  if (input.from_mission_id) {
    const origin = await missionService(ctx).retrieveMission(input.from_mission_id).catch(() => null);
    if (!origin || origin.requester_id !== input.requester_id) throw new TraikuError(TraikuError.Types.NOT_FOUND, 'Mission introuvable.');
    if (origin.category !== 'checkpickup' || origin.status !== 'delivered') throw invalid('Le transport se publie après une vérification et retrait close.');
    if (origin.follow_up_id) throw new TraikuError(TraikuError.Types.CONFLICT, 'Le transport de cet objet est déjà publié.', 'follow_up_exists');
    originTitle = origin.title;
  }
  // The letterbox only takes a small parcel; a handoff is for parcels only.
  // A counter: what it asks for is there, and the drop is proven by its receipt.
  if (input.deposit) {
    const d = input.deposit;
    if (input.category !== 'transfer') throw invalid('Le dépôt est pour l’envoi de colis.');
    if (input.handoff?.dropoff !== 'counter') throw invalid('Un dépôt se fait au comptoir.');
    if (d.kind === 'relay' && !d.label_on && !d.proofs.length && !d.code) throw invalid('Ajoutez le QR code ou le code de dépôt.');
    if (d.kind === 'return' && (!d.proofs.length || !d.first_name || !d.last_name || !d.reason)) throw invalid('Ajoutez le ticket ou le bon de retour, le nom sur l’achat et le motif.');
    if (d.proofs.length) await ctx.container.resolve<FileModuleService>(Modules.FILE).assertOwned(d.proofs, input.requester_id);
  } else if (input.handoff?.dropoff === 'counter') throw invalid('Indiquez le point relais ou le magasin.');
  if (input.parcel && input.category !== 'transfer') throw invalid('Les dimensions sont pour le transport de colis.');
  if (input.handoff && input.category !== 'transfer') throw invalid('Le mode de remise est pour le transport de colis.');
  // Inside, the Traikeur carries alone: not an XXL one.
  if (input.size === 'XXL' && (input.handoff?.pickup === 'room' || input.handoff?.dropoff === 'room')) throw invalid('Un colis XXL ne se porte pas seul jusqu’à l’intérieur.');
  if (input.handoff?.dropoff === 'letterbox' && input.size !== 'S') throw invalid('Seul un colis de taille S tient dans une boîte aux lettres.');
  if (input.appointment_end && (!input.appointment || new Date(input.appointment_end) <= new Date(input.appointment))) throw invalid('Le créneau d’enlèvement finit après son début.');
  if (input.photos?.length) await ctx.container.resolve<FileModuleService>(Modules.FILE).assertOwned(input.photos, input.requester_id);

  return new StepResponse({
    ...input,
    title: originTitle ?? input.title,
    mode,
    order,
    dropoff: input.dropoff ?? input.pickup,
    recipient_phone: phone(input.recipient_phone),
    handler_phone: phone(input.handler_phone),
    seller: input.seller ? { ...input.seller, phone: phone(input.seller.phone)! } : null,
    seller_code: input.seller ? randomDigits(4) : null,
    // Set here, never by the app: on top of the price, which stays the Traikeur's.
    service_fee: missionFees(pricing, input.price, currency).service_fee,
    insurance_fee: missionFees(pricing, input.price, currency).insurance_fee,
    traikeur_rate: pricing.fees.traikeur_rate,
    region_id: region?.id ?? null,
    currency_code: currency,
    // Nobody sees it before the amount is reserved (workflows/payments): then open, or a free title
    // (no catalogue entry) waits for the team first (statusAfterPayment).
    status: 'awaiting_payment' as const,
  });
});

const createMissionStep = createStep(
  'create-mission',
  async (data: MissionChanges, ctx) => {
    const mission = await missionService(ctx).createMissions(data);
    return new StepResponse(mission, mission.id);
  },
  async (id, ctx) => {
    await missionService(ctx).deleteMissions(id);
  }
);

/** The closed mission points to its transport. */
const linkFollowUpStep = createStep(
  'link-follow-up',
  async (input: { from_mission_id?: string | null; id: string }, ctx) => {
    if (!input.from_mission_id) return new StepResponse(undefined, null);
    await missionService(ctx).updateMissions({ id: input.from_mission_id, follow_up_id: input.id });
    return new StepResponse(undefined, input.from_mission_id);
  },
  async (id, ctx) => {
    if (id) await missionService(ctx).updateMissions({ id, follow_up_id: null });
  }
);

/** Clic & Collect: the catalogue entry says what kind of place the chain is. */
const KIND_OF: Record<string, BrandKind> = { 'click-collect': 'store', relais: 'relay', drive: 'drive', pressing: 'pressing', 'depot-relais': 'relay', 'retour-magasin': 'store' };

/** The chain of a Clic & Collect, recorded (or counted once more): offered as others type it. */
const recordBrandStep = createStep(
  'record-brand',
  async (input: { store?: string | null; catalog_id?: string | null }, ctx) => {
    const name = input.store?.trim();
    const key = name ? brandKey(name) : '';
    // A private seller's name (Retrait d'un achat) is no chain.
    if (!name || key.length < 2 || input.catalog_id === 'occasion') return new StepResponse(undefined, null);
    const svc = ctx.container.resolve<BrandModuleService>(BRAND_MODULE);
    const [known] = await svc.listBrands({ key }, { take: 1 });
    if (known) {
      await svc.updateBrands({ id: known.id, uses: known.uses + 1 });
      return new StepResponse(undefined, { id: known.id, uses: known.uses, created: false });
    }
    const brand = await svc.createBrands({ name, key, kind: KIND_OF[input.catalog_id ?? ''] ?? 'other', uses: 1 });
    return new StepResponse(undefined, { id: brand.id, uses: 0, created: true });
  },
  async (prev, ctx) => {
    if (!prev) return;
    const svc = ctx.container.resolve<BrandModuleService>(BRAND_MODULE);
    if (prev.created) await svc.deleteBrands(prev.id);
    else await svc.updateBrands({ id: prev.id, uses: prev.uses });
  }
);

export const createMissionWorkflow = createWorkflow('create-mission', (input: CreateMissionInput) => {
  const data = validateNewMissionStep(input);
  const mission = createMissionStep(data);
  recordBrandStep(transform({ mission }, ({ mission }) => ({ store: mission.order?.store ?? mission.deposit?.store, catalog_id: mission.catalog_id })));
  linkFollowUpStep(transform({ mission }, ({ mission }) => ({ from_mission_id: mission.from_mission_id, id: mission.id })));
  emitEventStep({ eventName: 'mission.created', data: transform({ mission }, ({ mission }) => ({ id: mission.id, status: mission.status })) });
  return new WorkflowResponse(mission);
});
