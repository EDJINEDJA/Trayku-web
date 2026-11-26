import { z } from 'zod';

/**
 * The price scale: every number the prices, Traiku's fees and the cancellations are computed from.
 * The defaults are here, in euros; each region (lib/regions.ts) starts from them scaled to its minimum
 * wage, and the team changes them from the dashboard (Tarifs), each save a new version kept in the
 * database (module pricing), merged onto the region's defaults. The app reads the scale in force
 * from GET /app/reference and computes the same way; the backend decides.
 *
 * Who pays what, for a mission at price P:
 *  - the requester pays P + Traiku's service fee (service_rate × P, at least service_min) + the insurance;
 *  - the Traikeur receives P less Traiku's commission (traikeur_rate × P); the same on the extra time;
 *  - Traiku keeps the service fee, the commission and the insurance (which pays the insurer).
 *
 * SMIC: 12,31 € gross per hour since 1 June 2026 (info.gouv.fr).
 */

export type PriceLevel = 'simple' | 'skilled' | 'expert';

const num = (min = 0, max = 100000) => z.number().min(min).max(max);
/** An amount, in any currency (100 000 FCFA as well as 100 €). */
const money = z.number().min(0).max(10_000_000);
const rate = z.number().min(0).max(0.9);
const level = z.enum(['simple', 'skilled', 'expert']);

/** The whole scale, as the dashboard saves it (strict: every field, nothing else). */
export const PricingSchema = z.strictObject({
  // ── Base: a mission is 30 min of a private person's time on the SMIC ──
  smic_hourly: z.number().min(0.01).max(10_000_000),
  /** Prices are suggested to this step of the currency: 0,50 €, 25 FCFA. */
  rounding: z.number().min(0.01).max(1000),
  /** No mission under this, whatever the requester chooses. */
  min_price: money,
  base_minutes: z.number().int().min(5).max(240),
  /** Extra time on site, asked for by steps of this many minutes… */
  step_minutes: z.number().int().min(5).max(120),
  /** …up to this many on one mission. */
  max_extra_minutes: z.number().int().min(0).max(480),
  /** Times the SMIC, by how much know-how the task asks for. */
  levels: z.strictObject(Object.fromEntries((['simple', 'skilled', 'expert'] as const).map((l) => [l, z.strictObject({ label: z.string().trim().min(1).max(40), factor: num(0.1, 10), examples: z.string().trim().max(200) })])) as Record<PriceLevel, z.ZodObject<{ label: z.ZodString; factor: z.ZodNumber; examples: z.ZodString }>>),

  // ── What Traiku earns ──
  fees: z.strictObject({
    /** Paid by the requester on top of the price: this share of it, at least service_min. */
    service_rate: rate,
    service_min: money,
    /** Paid by the requester, per mission. */
    insurance: money,
    /** Kept from what the Traikeur earns (price and extra time). */
    traikeur_rate: rate,
  }),

  // ── Small jobs and services, by family and one by one ──
  families: z.record(z.string(), z.strictObject({ label: z.string().trim().min(1).max(60), level })),
  /**
   * Catalogue entries: a small job (job-…) takes its family's level unless its own is given, and a
   * bonus (+10 = 10 % more on its suggested price); a fixed service, its price.
   */
  services: z.record(
    z.string(),
    z.strictObject({ title: z.string().max(120), family: z.string().max(40).optional(), group: z.string().max(60).optional(), level: level.optional(), bonus: z.number().min(-50).max(300).optional(), price: money.optional() })
  ),
  /** "Dès que possible": on a small job, and on a trade's call-out. */
  urgent: money,
  trade_urgent: money,

  // ── Parcels (Transfert) ──
  transport: z.strictObject({
    pickup: money,
    per_km: money,
    /** Past this many km, per_km_beyond. */
    km_threshold: money,
    per_km_beyond: money,
    sizes: z.strictObject({ S: money, M: money, L: money, XL: money, XXL: money }),
    /** Over each weight (kg), this extra; the highest that applies. */
    weights: z.array(z.strictObject({ over_kg: money, extra: money })).max(10),
    fragile: money,
    urgent: money,
    /**
     * Carrying, all for the Traikeur, at each end: up to the door, or inside (to the room chosen),
     * and per floor climbed without a lift. In front of the house, at the car: included.
     */
    handling: z.strictObject({ door: money, room: money, floor: money }),
  }),

  // ── Click & Collect ──
  clickcollect: z.strictObject({
    pickup: money,
    per_km: money,
    /** The km counted at most. */
    max_km: money,
    bags: z.strictObject({ '1': money, '2-5': money, '6-9': money, '10+': money }),
    heavy: money,
    urgent: money,
  }),

  // ── Vérifications and photos on site ──
  onsite: z.strictObject({
    travel: money,
    per_minute: money,
    /** Points to check included; each one more, per_check. */
    free_checks: z.number().int().min(0).max(50),
    per_check: money,
    /** From each number of photos, this extra; the highest that applies. */
    photos: z.array(z.strictObject({ from: z.number().int().min(0).max(200), extra: money })).max(10),
    urgent: money,
    live_call: money,
    /** A car's electronic diagnosis, with the Traikeur's OBD reader. */
    obd: money,
    /** Vérification et retrait refused: this share of the price for the verification alone, at least verify_only_min. */
    verify_only_share: rate,
    verify_only_min: money,
    /**
     * Vérification et retrait of a car or a motorbike: the Traikeur drives it back. Taking it in hand
     * (the papers, the checks before leaving), then each km driven; no size nor weight.
     */
    drive: z.strictObject({ pickup: money, per_km: money }),
  }),

  // ── Cancellations ──
  cancellation: z.strictObject({
    /** Free for both sides this many minutes after the acceptance. */
    grace_minutes: z.number().int().min(0).max(120),
    /** Share of the price charged when cancelling more than late_hours before… */
    share_early: rate,
    /** …and less than that. */
    share_late: rate,
    late_hours: num(0, 168),
    min_fee: money,
    /** Of the cancellation fee, the Traikeur's share (the rest to Traiku). */
    to_traikeur: z.number().min(0).max(1),
  }),

  // ── New Traikeurs ──
  newcomers: z.strictObject({
    /** Until this many missions done, one mission at a time: the next one once the current is done. */
    one_at_a_time: z.number().int().min(0).max(50),
  }),
});

export type Pricing = z.infer<typeof PricingSchema>;

export const DEFAULT_PRICING: Pricing = {
  smic_hourly: 12.31,
  rounding: 0.5,
  min_price: 5,
  base_minutes: 30,
  step_minutes: 15,
  max_extra_minutes: 45,
  levels: {
    simple: { label: 'Simple', factor: 1, examples: 'Porter, nourrir un animal, attendre, relever une info' },
    skilled: { label: 'Savoir-faire', factor: 1.2, examples: 'Monter un meuble, fixer au mur, jardiner' },
    expert: { label: 'Compétence', factor: 1.5, examples: 'Informatique, petite électricité, réparation' },
  },
  fees: { service_rate: 0.15, service_min: 1, insurance: 0.5, traikeur_rate: 0.1 },
  families: {
    bricolage: { label: 'Bricolage', level: 'skilled' },
    menage: { label: 'Ménage', level: 'simple' },
    demenagement: { label: 'Déménagement', level: 'simple' },
    jardinage: { label: 'Jardinage', level: 'skilled' },
    enfants: { label: 'Garde d’enfants', level: 'skilled' },
    cours: { label: 'Cours particuliers', level: 'expert' },
    aide: { label: 'Aide à la personne', level: 'simple' },
    animaux: { label: 'Garde d’animaux', level: 'simple' },
    informatique: { label: 'Informatique', level: 'expert' },
  },
  services: {
    'job-montage-meuble': { title: 'Monter un meuble', family: 'bricolage', bonus: 0 },
    'job-demontage-meuble': { title: 'Démonter un meuble', family: 'bricolage', bonus: 0 },
    'job-tv-mur': { title: 'Accrocher une TV au mur', family: 'bricolage', bonus: 0 },
    'job-fixation': { title: 'Fixer au mur', family: 'bricolage', bonus: 0 },
    'job-luminaire': { title: 'Poser un luminaire', family: 'bricolage', level: 'expert', bonus: 0 },
    'job-deboucher': { title: 'Déboucher un évier', family: 'bricolage', bonus: 0 },
    'job-robinet': { title: 'Changer un robinet', family: 'bricolage', level: 'expert', bonus: 0 },
    'job-reparation': { title: 'Petite réparation', family: 'bricolage', bonus: 0 },
    'job-menage': { title: 'Ménage', family: 'menage', bonus: 0 },
    'job-menage-depart': { title: 'Ménage de départ', family: 'menage', bonus: 0 },
    'job-repassage': { title: 'Repassage', family: 'menage', bonus: 0 },
    'job-vitres': { title: 'Nettoyer les vitres', family: 'menage', bonus: 0 },
    'job-voiture-interieur': { title: 'Nettoyer une voiture', family: 'menage', bonus: 0 },
    'job-aide-demenagement': { title: 'Aide au déménagement', family: 'demenagement', bonus: 0 },
    'job-deplacer-meuble': { title: 'Déplacer un meuble', family: 'demenagement', bonus: 0 },
    'job-electromenager': { title: 'Déplacer de l’électroménager', family: 'demenagement', bonus: 0 },
    'job-encombrants': { title: 'Débarrasser des encombrants', family: 'demenagement', bonus: 0 },
    'job-cartons': { title: 'Faire ses cartons', family: 'demenagement', bonus: 0 },
    'job-porter-affaires': { title: 'Descendre ou monter des affaires', family: 'demenagement', bonus: 0 },
    'job-tonte': { title: 'Tondre la pelouse', family: 'jardinage', bonus: 0 },
    'job-haie': { title: 'Tailler une haie', family: 'jardinage', bonus: 0 },
    'job-desherbage': { title: 'Désherber', family: 'jardinage', bonus: 0 },
    'job-feuilles': { title: 'Ramasser les feuilles', family: 'jardinage', bonus: 0 },
    'job-arrosage': { title: 'Arroser les plantes', family: 'jardinage', level: 'simple', bonus: 0 },
    'job-baby-sitting': { title: 'Baby-sitting', family: 'enfants', bonus: 0 },
    'job-sortie-ecole': { title: 'Sortie d’école', family: 'enfants', bonus: 0 },
    'job-soutien': { title: 'Soutien scolaire', family: 'cours', bonus: 0 },
    'job-langue': { title: 'Cours de langue', family: 'cours', bonus: 0 },
    'job-file-attente': { title: 'Faire la queue', family: 'aide', bonus: 0 },
    'job-rdv-medical': { title: 'Accompagner à un rendez-vous', family: 'aide', bonus: 0 },
    'job-compagnie': { title: 'Compagnie, promenade', family: 'aide', bonus: 0 },
    'job-repas': { title: 'Préparer un repas', family: 'aide', bonus: 0 },
    'job-promenade-chien': { title: 'Promener un chien', family: 'animaux', bonus: 0 },
    'job-garde-chat': { title: 'Nourrir un chat', family: 'animaux', bonus: 0 },
    'job-autres-animaux': { title: 'Nourrir d’autres animaux', family: 'animaux', bonus: 0 },
    'job-depannage-pc': { title: 'Dépanner un ordinateur', family: 'informatique', bonus: 0 },
    'job-box-imprimante': { title: 'Installer une box, une imprimante', family: 'informatique', bonus: 0 },
    'job-telephone': { title: 'Régler un téléphone', family: 'informatique', bonus: 0 },
    'job-cours-info': { title: 'Cours d’informatique', family: 'informatique', bonus: 0 },
    'photos-logement': { title: 'Photos d’un logement', group: 'Photos et infos sur place', price: 15 },
    'photos-lieu': { title: 'Photos d’un lieu', group: 'Photos et infos sur place', price: 8 },
    'relever-info': { title: 'Relever une info', group: 'Photos et infos sur place', price: 5 },
    'batterie': { title: 'Batterie à plat', group: 'Mécanique', price: 30 },
    'roue': { title: 'Changer une roue', group: 'Mécanique', price: 25 },
    'diagnostic': { title: 'Diagnostic panne', group: 'Mécanique', price: 35 },
    'crevaison-velo': { title: 'Crevaison vélo', group: 'Vélo', price: 15 },
    'box-imprimante': { title: 'Installer une box', group: 'Informatique (pro)', price: 25 },
  },
  urgent: 2,
  trade_urgent: 10,
  transport: {
    pickup: 4,
    per_km: 0.06,
    km_threshold: 100,
    per_km_beyond: 0.03,
    sizes: { S: 0, M: 1.5, L: 4, XL: 9, XXL: 14 },
    weights: [
      { over_kg: 5, extra: 1 },
      { over_kg: 10, extra: 2 },
      { over_kg: 20, extra: 4 },
    ],
    fragile: 1,
    urgent: 3,
    handling: { door: 5, room: 12, floor: 2 },
  },
  clickcollect: { pickup: 4, per_km: 0.2, max_km: 30, bags: { '1': 0, '2-5': 1, '6-9': 2.5, '10+': 4 }, heavy: 1.5, urgent: 2 },
  onsite: {
    travel: 4,
    per_minute: 0.35,
    free_checks: 3,
    per_check: 0.5,
    photos: [
      { from: 10, extra: 1 },
      { from: 20, extra: 3 },
    ],
    urgent: 2,
    live_call: 3,
    obd: 30,
    verify_only_share: 0.5,
    verify_only_min: 5,
    // A pro car delivery costs about 1 € a km plus a fixed fee; the Traikeur is already there.
    drive: { pickup: 12, per_km: 0.6 },
  },
  cancellation: { grace_minutes: 5, share_early: 0.1, share_late: 0.25, late_hours: 24, min_fee: 2, to_traikeur: 0.8 },
  newcomers: { one_at_a_time: 3 },
};

// ── Versions ─────────────────────────────────────────────────────────────────

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** The saved values over the defaults, key by key: a field added later keeps its default. */
/** Bag ranges before they were 1 / 2-5 / 6-9 / 10+: old scales and missions read as the new ones. */
export const LEGACY_BAGS: Record<string, '1' | '2-5' | '6-9' | '10+'> = { '2-3': '2-5', '4-6': '6-9', '7+': '10+' };
export const bagsOf = (b: string) => LEGACY_BAGS[b] ?? b;

/** A saved scale with the old bag keys, renamed. */
export function upgradeScale(data: unknown): unknown {
  if (!isObject(data) || !isObject(data.clickcollect) || !isObject(data.clickcollect.bags)) return data;
  const bags = Object.fromEntries(Object.entries(data.clickcollect.bags).map(([k, v]) => [bagsOf(k), v]));
  return { ...data, clickcollect: { ...data.clickcollect, bags } };
}

export function merge<T>(base: T, over: unknown): T {
  if (!isObject(base) || !isObject(over)) return (over === undefined ? base : (over as T));
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = k in base ? merge((base as Record<string, unknown>)[k], v) : v;
  return out as T;
}

// ── Computations ─────────────────────────────────────────────────────────────

/** To the scale's step (0,50 €, 25 FCFA). */
const step = (p: Pricing, v: number) => Number((Math.round(v / p.rounding) * p.rounding).toFixed(6));
/** Digits after the point a currency has: 2 for the euro, 0 for the CFA franc. */
export const currencyDigits = (currency: string) => {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
};
/** To the currency's smallest unit: the cent, the franc. */
const minor = (v: number, digits: number) => Math.round(v * 10 ** digits) / 10 ** digits;

/**
 * The extra time asked for on an on-site mission: at the mission's own rate (its price over its
 * planned minutes, so a raised price pays the extra more too), never under the SMIC.
 */
export function extraAmount(p: Pricing, price: number, plannedMinutes: number | null, minutes: number) {
  const perMinute = Math.max(price / Math.max(plannedMinutes ?? p.base_minutes, 1), p.smic_hourly / 60);
  return step(p, perMinute * minutes);
}

/**
 * What the requester pays on top of the price: Traiku's service fee and the reserve (`insurance`),
 * shown to them together as the service fee. The reserve pays for the incidents until a real
 * insurance covers the missions.
 */
/** `currency`: the mission's, for its smallest unit (0 decimals for the yen, 3 for the Kuwaiti dinar). */
export function missionFees(p: Pricing, price: number, currency: string) {
  const d = currencyDigits(currency);
  const service = minor(Math.max(p.fees.service_min, price * p.fees.service_rate), d);
  return { service_fee: service, insurance_fee: p.fees.insurance, total: minor(price + service + p.fees.insurance, d) };
}

/** What the Traikeur receives of an amount (the price, the extra time), at the mission's rate. */
export const payout = (amount: number, rate: number, digits = 2) => minor(amount * (1 - rate), digits);

/** A minimum the Traikeur set on what they receive, as a minimum on the price paid. */
export const grossFor = (p: Pricing, net: number, currency: string) => minor(net / (1 - p.fees.traikeur_rate), currencyDigits(currency));
