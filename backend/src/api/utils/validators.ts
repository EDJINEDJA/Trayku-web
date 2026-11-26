import { z } from 'zod';
import { MISSION_CATEGORIES, MISSION_MODES, MISSION_TYPES, PROFESSIONS, SIZES } from '../../modules/mission';
import { ID_DOCUMENT_IDS } from '../../lib/identity';
import { PricingSchema } from '../../lib/pricing';

/** The bodies and queries of the API, validated before the routes run (strict: unknown fields are refused). */

const text = (max: number) => z.string().trim().min(1).max(max);
const latLng = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) });
const place = latLng.extend({ label: text(300), city: z.string().trim().max(100).optional() });
const date = z.coerce.date();
const money = z.number().min(0).max(100000);
const phone = z.string().trim().min(6).max(30);

export const proofPhoto = z.strictObject({ file_id: text(60), at: z.iso.datetime({ offset: true }), coords: latLng.optional(), live: z.boolean() });

export const RequestOtp = z.strictObject({ phone });
export const VerifyOtp = z.strictObject({ phone, code: z.string().trim().regex(/^\d{6}$/, 'Le code fait 6 chiffres.') });
export const EmailPass = z.strictObject({ email: z.email(), password: z.string().min(1).max(200) });

export const CreateMember = z.strictObject({
  first_name: text(60),
  last_name: z.string().trim().max(60).nullish(),
  email: z.email().nullish(),
  civility: z.enum(['mme', 'm']).nullish(),
  birth_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La date de naissance est au format AAAA-MM-JJ.')
    .refine((d) => {
      const t = new Date(`${d}T00:00:00Z`);
      return !isNaN(+t) && t.toISOString().startsWith(d) && t < new Date() && t.getUTCFullYear() > 1900;
    }, 'Cette date de naissance n’existe pas.')
    .nullish(),
  vehicle: z.enum(['car', 'bike', 'foot', 'transit', 'plane']).nullish(),
  /** Postal address, geocoded by the app. Private. */
  address: z.strictObject({ ...place.shape }).nullish(),
  /** ISO code of the phone's country: the member's region (currency, prices). */
  country: z.string().trim().regex(/^[A-Za-z]{2}$/).transform((c) => c.toUpperCase()).nullish(),
});

export const UpdateMe = CreateMember.partial().extend({
  bio: z.string().trim().max(500).nullish(),
  avatar_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  /** The profile photo: a file sent first (uploads); null removes it. */
  avatar_file_id: z.string().trim().min(1).max(80).nullish(),
  /** From the list (its id) or written by the member; empty: no particular trade. */
  professions: z.array(z.string().trim().min(2).max(60)).max(3).optional(),
  obd_reader: z.boolean().optional(),
  /** Where they're active: missions are looked for around it. */
  zone: z.strictObject({ label: text(200), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), radius_km: z.number().min(1).max(500) }).nullish(),
  /** As a Traikeur: the lowest price of a mission they want to see. */
  price_prefs: z.strictObject({ min_price: z.number().min(0).max(1000) }).nullish(),
  /** Adresses favorites, 10 at most. */
  saved_places: z
    .array(z.strictObject({ id: text(40), name: text(40), place: z.strictObject({ label: text(200), city: z.string().trim().max(80).optional(), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }) }))
    .max(10)
    .optional(),
  /** The tax details the earnings are declared with (DAC7). */
  tax_info: z
    .strictObject({
      status: z.enum(['individual', 'business']),
      birth_date: z.iso.date(),
      tax_number: z.string().trim().regex(/^\d{13}$/, 'Le numéro fiscal compte 13 chiffres.'),
      siret: z.string().trim().regex(/^\d{14}$/, 'Le SIRET compte 14 chiffres.').nullish(),
    })
    .refine((t) => t.status !== 'business' || !!t.siret, { message: 'Indiquez votre SIRET.', path: ['siret'] })
    .nullish(),
});

export const SubmitIdentity = z.strictObject({
  document_type: z.enum(ID_DOCUMENT_IDS),
  front_file_id: text(60),
  back_file_id: z.string().max(60).nullish(),
  selfie_file_id: text(60),
  /** The other photos of the live selfie: the head turned left, right, the chin up, straight on again. */
  pose_file_ids: z.strictObject({ left: text(60), right: text(60), up: text(60), front: text(60) }, 'Il manque des photos du selfie : recommencez-le.'),
  /** Explicit consent to the comparison of the photos (biometric data). */
  consent: z.literal(true, 'Acceptez la comparaison de vos photos pour continuer.'),
});
export const LICENCE_CATEGORIES = ['AM', 'A1', 'A2', 'A', 'B'] as const;
export const SubmitCredential = z
  .strictObject({
    kind: z.enum(['trade', 'licence']).default('trade'),
    profession: text(60),
    title: z.string().trim().max(120).nullish(),
    file_ids: z.array(text(60)).min(1).max(5),
  })
  // A licence says its categories (« B, A2 »), each one known.
  .refine((c) => c.kind !== 'licence' || (!!c.title && c.title.split(',').every((x) => (LICENCE_CATEGORIES as readonly string[]).includes(x.trim()))), {
    message: 'Indiquez les catégories de votre permis.',
    path: ['title'],
  });
export const Review = z.strictObject({ approve: z.boolean(), reason: z.string().trim().max(500).nullish() });

export const CreateMission = z.strictObject({
  mode: z.enum(MISSION_MODES).optional(),
  type: z.enum(MISSION_TYPES),
  category: z.enum(MISSION_CATEGORIES),
  catalog_id: z.string().trim().max(80).nullish(),
  title: text(120),
  description: z.string().trim().max(2000).optional(),
  size: z.enum(SIZES).optional(),
  weight_kg: z.number().min(0).max(1000).optional(),
  declared_value: money.optional(),
  fragile: z.boolean().optional(),
  frozen: z.boolean().optional(),
  photos: z.array(text(60)).max(10).optional(),
  pickup: place,
  dropoff: place.nullish(),
  pickup_note: z.string().trim().max(500).nullish(),
  dropoff_note: z.string().trim().max(500).nullish(),
  deadline: date,
  window_start: date.nullish(),
  onsite_minutes: z.number().int().min(5).max(24 * 60).nullish(),
  proof: z.enum(['photo', 'code']).nullish(),
  profession: z.enum(PROFESSIONS).nullish(),
  recipient_name: z.string().trim().max(80).nullish(),
  recipient_phone: phone.nullish(),
  dropoff_floor: z.number().int().min(-5).max(100).nullish(),
  dropoff_elevator: z.boolean().nullish(),
  pickup_floor: z.number().int().min(-5).max(100).nullish(),
  pickup_elevator: z.boolean().nullish(),
  sender_name: z.string().trim().max(80).nullish(),
  sender_email: z.email().max(254).nullish(),
  recipient_email: z.email().max(254).nullish(),
  handler_phone: phone.nullish(),
  chat_open: z.boolean().optional(),
  order: z
    .strictObject({
      store: text(120),
      name: text(80),
      first_name: z.string().trim().max(40).optional(),
      last_name: z.string().trim().max(40).optional(),
      ref: z.string().trim().max(80).optional(),
      bags: z.enum(['1', '2-5', '6-9', '10+']),
      heavy: z.boolean(),
      ready_at: z.iso.datetime({ offset: true }).optional(),
      method: z.enum(['scan', 'code', 'number']).default('number'),
      /** All the message holds: a capture, a pickup code, an order number, often two of them. */
      methods: z.array(z.enum(['scan', 'code', 'number'])).max(3).optional(),
      pickup_code: z.string().trim().max(40).optional(),
      /** The captures of the « commande prête » message (uploaded files). */
      proofs: z.array(z.string().max(64)).max(4).default([]),
      id_required: z.boolean().default(false),
      /** The requester allows the chosen Traikeur to collect in their name. */
      mandate: z.boolean().optional(),
      last_day: z.iso.datetime({ offset: true }).optional(),
    })
    .nullish(),
  /** Transport de colis: where the parcel is taken and how it is left. */
  handoff: z
    .strictObject({ pickup: z.enum(['street', 'door', 'room']), dropoff: z.enum(['street', 'door', 'room', 'letterbox', 'counter']), help: z.boolean().default(false) })
    .nullish(),
  /** Dropped at a relay point or brought back to a store. */
  deposit: z
    .strictObject({
      // Relay points only: a return to a store would hand the receipt (and its refund) to the Traikeur.
      kind: z.enum(['relay']),
      store: text(120),
      label_on: z.boolean().optional(),
      code: z.string().trim().max(40).optional(),
      proofs: z.array(z.string().max(64)).max(4).default([]),
      first_name: z.string().trim().max(40).optional(),
      last_name: z.string().trim().max(40).optional(),
      // Dropped only: a refund to the account, or a repair; nothing to bring back.
      reason: z.enum(['refund', 'repair']).optional(),
    })
    .nullish(),
  /** Transport de colis: the number of pieces, and the dimensions when known (all three, in cm). */
  parcel: z
    .strictObject({
      quantity: z.number().int().min(1).max(50),
      length_cm: z.number().positive().max(500).optional(),
      width_cm: z.number().positive().max(500).optional(),
      height_cm: z.number().positive().max(500).optional(),
    })
    .refine((p) => [p.length_cm, p.width_cm, p.height_cm].every((v) => v === undefined) || [p.length_cm, p.width_cm, p.height_cm].every((v) => v !== undefined), {
      message: 'Indiquez la longueur, la largeur et la hauteur.',
    })
    .nullish(),
  // The purchase is finalised by the requester on the listing's platform: price and payment no longer asked (kept for older missions).
  // The listing's link opens in the app's browser: web links to a real domain only (no javascript:, no localhost).
  purchase: z.strictObject({ url: z.url({ protocol: /^https?$/, hostname: z.regexes.domain }).max(500).optional(), price: money.optional(), payment: z.enum(['platform', 'transfer', 'paid']).optional() }).nullish(),
  seller: z.strictObject({ pseudo: text(80).optional(), phone, email: z.email().max(200).optional() }).nullish(),
  listing: z
    .strictObject({
      brand: z.string().trim().max(80).optional(),
      model: z.string().trim().max(80).optional(),
      serial: z.string().trim().max(80).optional(),
      condition: z.enum(['new', 'very_good', 'good', 'fair', 'parts']).optional(),
      defects: z.string().trim().max(500).optional(),
      description: z.string().trim().max(2000).optional(),
      specs: z.array(z.strictObject({ id: text(40), label: text(60), value: text(200) })).max(40).optional(),
    })
    .nullish(),
  subject: z.string().trim().max(120).nullish(),
  inspect_kind: z.string().trim().max(40).nullish(),
  crew: z.number().int().min(1).max(3).optional(),
  checklist: z.array(text(200)).max(20).nullish(),
  min_photos: z.number().int().min(0).max(50).nullish(),
  live_call: z.boolean().optional(),
  obd_diagnostic: z.boolean().optional(),
  appointment: date.nullish(),
  appointment_end: date.nullish(),
  seller_windows: z.array(z.strictObject({ from: z.iso.datetime({ offset: true }), to: z.iso.datetime({ offset: true }) })).max(10).nullish(),
  verify_only_price: money.nullish(),
  urgent: z.boolean().optional(),
  /** The transport of an item checked and bought (Vérification et retrait closed). */
  from_mission_id: z.string().trim().max(60).nullish(),
  price: money,
});

const pagination = { limit: z.coerce.number().int().min(1).max(100).default(20), offset: z.coerce.number().int().min(0).default(0) };

export const ListMissions = z.object({
  category: z.enum(MISSION_CATEGORIES).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius_km: z.coerce.number().min(1).max(500).default(30),
  ...pagination,
});

export const ListQuery = z.object({ ...pagination });
export const AdminListQuery = z.object({ status: z.string().max(40).optional(), q: z.string().trim().max(100).optional(), requester_id: z.string().max(60).optional(), ...pagination });

export const AcceptMission = z.strictObject({ trip_id: z.string().max(60).nullish() });

const coords = { coords: latLng.nullish() };
export const StartLeg = z.strictObject({ leg: z.enum(['pickup', 'dropoff']), ...coords });
export const FaceCheck = z.strictObject({ file_id: text(60), ...coords });
export const CodeBody = z.strictObject({ code: z.string().trim().regex(/^\d{4}$/, 'Le code fait 4 chiffres.'), ...coords });
export const SendReport = z.strictObject({
  report: z.looseObject({ verdict: z.enum(['ok', 'reserves', 'refuse']), photos: z.array(proofPhoto).max(60), signature: z.unknown().optional(), summary: z.string().max(2000).optional() }),
  ...coords,
});
/** Paying a mission: the provider, and the app's address to come back to (its own scheme only). */
export const PayMission = z.strictObject({
  provider_id: z.string().trim().min(1).max(40),
  return_to: z
    .string()
    .max(300)
    .regex(/^(trayku|traiku|exps?):\/\//, 'Adresse de retour invalide.')
    .optional(),
});
export const Decide = z.strictObject({ decision: z.enum(['accepted', 'refused']) });
export const ConfirmPickup = z.strictObject({ code: z.string().trim().regex(/^\d{4}$/).optional(), photo: proofPhoto.nullish(), ...coords });
export const ConfirmDropoff = z.strictObject({ code: z.string().trim().regex(/^\d{4}$/, 'Le code fait 4 chiffres.').optional(), photo: proofPhoto.nullish(), ...coords });
export const OnsitePhotos = z.strictObject({ kind: z.enum(['before', 'work']), photos: z.array(proofPhoto).max(60), ...coords });
export const CompleteOnsite = z.strictObject({ checks: z.array(text(200)).max(30), code: z.string().trim().regex(/^\d{4}$/).optional(), ...coords });
export const Release = z.strictObject({ ...coords });
export const PickupCode = z.strictObject({ code: z.string().trim().regex(/^\d{4}$/, 'Le code fait 4 chiffres.'), ...coords });
export const SetTip = z.strictObject({ tip: z.number().min(0).max(200).nullable() });
export const RequestExtraTime = z.strictObject({ minutes: z.number().int().min(1).max(240), reason: z.string().trim().max(300).nullish() });
export const AnswerExtraTime = z.strictObject({ accept: z.boolean() });
export const ProposeTime = z.strictObject({ at: z.coerce.date() });
export const ChooseProposal = z.strictObject({ proposal_id: z.string().max(60).nullable() });

export const CreateTrip = z.strictObject({
  origin: place,
  destination: place,
  stops: z.array(place.extend({ stop_minutes: z.number().int().min(0).max(240) })).max(5).default([]),
  route: z.strictObject({
    distance_m: z.number().min(0),
    duration_s: z.number().min(0),
    coordinates: z.array(latLng).min(2).max(5000),
    label: z.string().max(80).optional(),
    via: z.array(z.string().max(40)).max(10).optional(),
    motorway: z.boolean().optional(),
    /** An estimate (train, plane), not computed on the roads. */
    estimated: z.boolean().optional(),
  }),
  depart_at: date,
  flex_minutes: z.number().int().min(0).max(240).default(15),
  round_trip: z.boolean().default(false),
  recurring_days: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  vehicle: z.enum(['car', 'bike', 'foot', 'transit', 'plane']),
  max_size: z.enum(SIZES).default('M'),
  max_weight_kg: z.number().min(0).max(1000).default(10),
  prefs: z.strictObject({
    max_detour_min: z.number().int().min(0).max(120),
    accepted_categories: z.array(z.enum(MISSION_CATEGORIES)),
    min_price: money,
    auto_accept_score: z.number().min(0).max(100).nullable(),
  }),
});

export const CreateReview = z.strictObject({ mission_id: text(60), rating: z.number().int().min(1).max(5), comment: z.string().trim().max(1000).nullish() });
export const OpenDispute = z.strictObject({ mission_id: text(60), reason: z.enum(['absent', 'not_conform', 'damaged', 'late', 'payment', 'behaviour', 'other']), message: text(2000) });
export const SendMessage = z.strictObject({ body: z.string().trim().max(2000).default(''), file_id: z.string().max(60).nullish() }).refine((b) => b.body.length > 0 || !!b.file_id, 'Message vide.');

export const CreateApiKey = z.strictObject({ title: text(80), type: z.enum(['publishable', 'secret']) });
export const ReviewMission = z.strictObject({ approve: z.boolean(), note: z.string().trim().max(500).nullish() });
export const UpdateMemberAdmin = z.strictObject({
  verified_id: z.boolean().optional(),
  status: z.enum(['active', 'suspended']).optional(),
  suspended_until: date.nullish(),
  verifier: z.strictObject({ via: z.enum(['test', 'pro']), since: z.iso.datetime({ offset: true }), in_review: z.boolean().optional() }).nullish(),
});
/** The price scale from the dashboard (Tarifs): every field, checked. */
export const SavePricing = z.strictObject({ region_id: text(60), pricing: PricingSchema, note: z.string().trim().max(200).nullish() });

/** A region, as Medusa's: name, currency (one of the currency module's), countries (ISO), and the start of its scale. */
const regionMetadata = z.strictObject({
  area: z.enum(['europe', 'afrique', 'monde-arabe', 'asie', 'ameriques']).optional(),
  /** Local minimum wage per hour, in the currency. */
  minimum_wage: z.number().positive().max(10_000_000).optional(),
  /** Step suggested prices are rounded to. */
  rounding: z.number().positive().max(100_000).optional(),
  wage_note: z.string().trim().max(300).optional(),
});
export const CreateRegion = z.strictObject({
  name: text(80),
  currency_code: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Devise : 3 lettres (EUR, XOF…).'),
  countries: z.array(z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/)).max(250).default([]),
  metadata: regionMetadata.nullish(),
});
export const UpdateRegion = CreateRegion.partial().extend({ countries: CreateRegion.shape.countries.removeDefault().optional() });
export const ResolveDispute = z.strictObject({ status: z.enum(['resolved', 'rejected']), resolution: text(2000) });

// Ads: the picture sent first (POST /admin/uploads), then its id here; the link in https only.
export const CreateAd = z.strictObject({
  placement: z.enum(['messages']).default('messages'),
  sponsor: text(120),
  title: text(200),
  image_file_id: text(100),
  url: z.url({ protocol: /^https$/, error: 'Le lien doit commencer par https://' }).max(500),
  starts_at: date.nullish(),
  ends_at: date.nullish(),
  active: z.boolean().default(true),
});
export const UpdateAd = z.strictObject({
  placement: CreateAd.shape.placement.removeDefault().optional(),
  sponsor: CreateAd.shape.sponsor.optional(),
  title: CreateAd.shape.title.optional(),
  image_file_id: CreateAd.shape.image_file_id.optional(),
  url: CreateAd.shape.url.optional(),
  starts_at: date.nullish(),
  ends_at: date.nullish(),
  active: z.boolean().optional(),
});
export const TrackAd = z.strictObject({ type: z.enum(['view', 'click']) });

export const CreateSupportRequest = z.strictObject({ topic: z.enum(['mission', 'payment', 'account', 'safety', 'other']), message: text(2000) });
export const AnswerSupportRequest = z.strictObject({ answer: text(2000), close: z.boolean().default(false) });

/** The IBAN's own check (ISO 13616): its first four characters moved to the end, letters as numbers, modulo 97 is 1. */
const ibanChecksum = (iban: string) => {
  const digits = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rest = 0;
  for (const d of digits) rest = (rest * 10 + Number(d)) % 97;
  return rest === 1;
};

// Payouts: the account where earnings go (Stripe's page, or the IBAN typed for the test provider), the team's actions.
const appAddress = z.string().regex(/^(trayku|traiku|exps?):\/\//, 'Adresse de retour invalide').max(500);
export const SetupPayoutAccount = z.strictObject({ return_to: appAddress.nullish() });
export const SavePayoutBank = z.strictObject({
  holder: text(120),
  iban: z
    .string()
    .transform((v) => v.replace(/\s+/g, '').toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/, 'Cet IBAN ne semble pas correct').refine(ibanChecksum, 'Cet IBAN ne semble pas correct')),
});
export const HoldPayouts = z.strictObject({ hold: z.boolean(), reason: text(500).nullish() });
export const AdminPayoutsQuery = z.object({
  status: z.enum(['pending', 'paid', 'failed', 'canceled', 'all']).default('all'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export const PayoutsExportQuery = z.object({ from: z.string().date(), to: z.string().date() });

export type Infer<T extends z.ZodType> = z.infer<T>;

/** Certificat Traiku: for each question id, the text of the option chosen. */
export const CertificateAnswers = z.strictObject({ answers: z.record(z.string().max(10), z.string().max(400)) });

/** General Verifier Test: answers by question id or index (option text or index). */
export const VerifierTestAnswers = z.strictObject({
  answers: z.record(z.string().max(20), z.union([z.string().max(400), z.number().int().min(0).max(10)])),
});
