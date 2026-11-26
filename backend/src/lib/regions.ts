import type { AwilixContainer } from 'awilix';
import { COUNTRIES, DEFAULT_COUNTRY } from './countries';
import { DEFAULT_PRICING, grossFor, merge, upgradeScale, type Pricing } from './pricing';
import { PRICING_MODULE, type PricingModuleService } from '../modules/pricing';
import { REGION_MODULE, type RegionModuleService } from '../modules/region';

/**
 * Regions, as Medusa's (module region): a name, a currency (module currency) and countries, each in
 * one region at most. A member belongs to the region of their country (chosen with the phone at
 * sign-up); their missions are priced and paid in its currency, on its price scale (module pricing,
 * by region_id, as Medusa's price rules). A country in no region falls back on France's region.
 *
 * A region's `metadata` is the starting point of its scale: { area, minimum_wage, rounding,
 * wage_note }. Its default scale is the euro one scaled to that minimum wage: every amount ×
 * (local minimum wage ÷ French SMIC), rounded to `rounding`; shares (%), minutes and coefficients
 * stay. The minimum wages of the seed are starting points with their source: check each region
 * before opening it. Where there is no legal minimum (Emirates, Singapore, Switzerland nationally),
 * a reference chosen for Traiku.
 */

export type Area = 'europe' | 'afrique' | 'monde-arabe' | 'asie' | 'ameriques';
export const AREAS: Record<Area, string> = { europe: 'Europe', afrique: 'Afrique', 'monde-arabe': 'Monde arabe', asie: 'Asie', ameriques: 'Amériques' };

export type RegionMetadata = { area?: Area; minimum_wage?: number; rounding?: number; wage_note?: string };
export type RegionSeed = { name: string; currency_code: string; countries: string[]; metadata: RegionMetadata };
/** A region as the API sends it: its countries as ISO codes. */
export type RegionView = { id: string; name: string; currency_code: string; countries: string[]; metadata: RegionMetadata | null };

const r = (_code: string, name: string, area: Area, currency_code: string, countries: string[], minimum_wage: number, rounding: number, wage_note: string): RegionSeed => ({
  name,
  currency_code,
  countries,
  metadata: { area, minimum_wage, rounding, wage_note },
});

/** The regions the seed creates (src/scripts/seed.ts), as Medusa's seed does; then changed in the dashboard. */
export const REGION_SEED: RegionSeed[] = [
  // ── Europe ──
  r('eur', 'Europe (euro)', 'europe', 'EUR', ['FR', 'BE', 'LU', 'MC', 'DE', 'AT', 'NL', 'ES', 'PT', 'IT', 'IE', 'FI', 'GR', 'SK', 'SI', 'EE', 'LV', 'LT', 'MT', 'CY', 'HR', 'AD'], 12.31, 0.5, 'SMIC français, 12,31 € brut de l’heure depuis le 1er juin 2026'),
  r('gbp', 'Royaume-Uni', 'europe', 'GBP', ['GB'], 12.71, 0.5, 'National Living Wage, 12,71 £ de l’heure en avril 2026 (21 ans et plus)'),
  r('chf', 'Suisse', 'europe', 'CHF', ['CH'], 24.32, 0.5, 'Pas de minimum national : celui du canton de Genève, 24,32 CHF de l’heure (2025)'),
  // ── Afrique ──
  r('xof', 'Afrique de l’Ouest (FCFA UEMOA)', 'afrique', 'XOF', ['CI', 'SN', 'BJ', 'BF', 'ML', 'NE', 'TG', 'GW'], 433, 25, 'SMIG ivoirien, 75 000 FCFA par mois ÷ 173 h ; varie d’un pays à l’autre'),
  r('xaf', 'Afrique centrale (FCFA CEMAC)', 'afrique', 'XAF', ['CM', 'GA', 'CG', 'CF', 'TD', 'GQ'], 242, 25, 'SMIG camerounais, 41 875 FCFA par mois ÷ 173 h ; le Gabon paie bien plus'),
  // ── Monde arabe ──
  r('mad', 'Maroc', 'monde-arabe', 'MAD', ['MA'], 17.1, 1, 'SMIG, environ 17,10 MAD de l’heure (2025, hors agriculture)'),
  r('dzd', 'Algérie', 'monde-arabe', 'DZD', ['DZ'], 115, 10, 'SNMG, 20 000 DA par mois ÷ 173 h (2024) : vérifier la dernière hausse'),
  r('tnd', 'Tunisie', 'monde-arabe', 'TND', ['TN'], 2.65, 0.5, 'SMIG, environ 2,65 TND de l’heure (régime 40 h)'),
  r('egp', 'Égypte', 'monde-arabe', 'EGP', ['EG'], 34, 5, 'Minimum du privé, 7 000 EGP par mois ÷ 208 h (2025)'),
  r('sar', 'Arabie saoudite', 'monde-arabe', 'SAR', ['SA'], 23, 1, 'Pas de minimum légal général : 4 000 SAR par mois, le seuil retenu pour les Saoudiens ÷ 173 h'),
  r('aed', 'Émirats arabes unis', 'monde-arabe', 'AED', ['AE'], 15, 1, 'Pas de minimum légal : référence Traiku, 15 AED de l’heure'),
  r('qar', 'Qatar', 'monde-arabe', 'QAR', ['QA'], 8.65, 1, 'Minimum, 1 000 QAR + 800 de logement et repas par mois ÷ 208 h'),
  r('kwd', 'Koweït', 'monde-arabe', 'KWD', ['KW'], 0.36, 0.05, 'Minimum du privé, 75 KWD par mois ÷ 208 h'),
  r('jod', 'Jordanie', 'monde-arabe', 'JOD', ['JO'], 1.39, 0.05, 'Minimum, 290 JOD par mois ÷ 208 h (2025)'),
  // ── Asie ──
  r('cny', 'Chine', 'asie', 'CNY', ['CN'], 24, 1, 'Minimum horaire de Shanghai (temps partiel), 24 CNY ; chaque ville a le sien'),
  r('jpy', 'Japon', 'asie', 'JPY', ['JP'], 1121, 50, 'Moyenne nationale, 1 121 JPY de l’heure (octobre 2025) ; chaque préfecture a le sien'),
  r('krw', 'Corée du Sud', 'asie', 'KRW', ['KR'], 10320, 500, 'Minimum national, 10 320 KRW de l’heure (2026)'),
  r('inr', 'Inde', 'asie', 'INR', ['IN'], 22, 5, 'Plancher national, 178 INR par jour ÷ 8 h ; les États paient plus'),
  r('idr', 'Indonésie', 'asie', 'IDR', ['ID'], 31200, 1000, 'Minimum de Jakarta, environ 5,4 millions IDR par mois ÷ 173 h (2025)'),
  r('vnd', 'Viêt Nam', 'asie', 'VND', ['VN'], 23800, 1000, 'Minimum horaire de la zone I (Hanoï, Hô Chi Minh-Ville), 23 800 VND'),
  r('thb', 'Thaïlande', 'asie', 'THB', ['TH'], 50, 5, 'Minimum de Bangkok, 400 THB par jour ÷ 8 h (2025)'),
  r('php', 'Philippines', 'asie', 'PHP', ['PH'], 87, 5, 'Minimum de Manille, 695 PHP par jour ÷ 8 h (2025)'),
  r('myr', 'Malaisie', 'asie', 'MYR', ['MY'], 8.72, 0.5, 'Minimum, 1 700 MYR par mois, soit 8,72 MYR de l’heure (2025)'),
  r('hkd', 'Hong Kong', 'asie', 'HKD', ['HK'], 42.1, 1, 'Minimum légal, 42,10 HKD de l’heure (mai 2025)'),
  r('sgd', 'Singapour', 'asie', 'SGD', ['SG'], 12, 0.5, 'Pas de minimum légal général : référence Traiku, 12 SGD de l’heure'),
  r('try', 'Turquie', 'asie', 'TRY', ['TR'], 116, 5, 'Minimum brut, 26 005 TRY par mois ÷ 225 h (2025) : forte inflation, à revoir souvent'),
  // ── Amériques ──
  r('usd', 'États-Unis', 'ameriques', 'USD', ['US'], 7.25, 0.5, 'Minimum fédéral, 7,25 $ de l’heure ; beaucoup d’États paient plus'),
  r('cad', 'Canada', 'ameriques', 'CAD', ['CA'], 17.75, 0.5, 'Minimum fédéral, 17,75 $ de l’heure ; chaque province a le sien'),
];

// ── Reading ─────────────────────────────────────────────────────────────────

type Scope = Pick<AwilixContainer, 'resolve'>;
const regions = (scope: Scope) => scope.resolve<RegionModuleService>(REGION_MODULE);

/** The regions with their countries, by name. */
export async function listRegions(scope: Scope, filters: { id?: string | string[] } = {}): Promise<RegionView[]> {
  const svc = regions(scope);
  const rows = await svc.listRegions(filters, { order: { name: 'ASC' } });
  const countries = rows.length ? await svc.listCountries({ region_id: rows.map((r) => r.id) }, { select: ['iso_2', 'region_id'] }) : [];
  return rows.map((r) => ({ id: r.id, name: r.name, currency_code: r.currency_code, metadata: (r.metadata as RegionMetadata | null) ?? null, countries: countries.filter((c) => c.region_id === r.id).map((c) => c.iso_2) }));
}

export async function retrieveRegion(scope: Scope, id: string) {
  const [region] = await listRegions(scope, { id });
  return region ?? null;
}

/** The country of a phone number, by its calling code (the longest that matches; +1: the United States). */
export function countryFromPhone(phone: string | null | undefined) {
  if (!phone) return null;
  const match = COUNTRIES.filter((c) => phone.startsWith(c.dial)).sort((a, b) => b.dial.length - a.dial.length || (a.code === 'US' ? -1 : 1))[0];
  return match?.code ?? null;
}

/** A country's region; France's for a country in none; null when there is no region at all. */
export async function regionOfCountry(scope: Scope, country: string | null | undefined): Promise<RegionView | null> {
  const svc = regions(scope);
  const codes = [country?.toUpperCase(), DEFAULT_COUNTRY].filter((c): c is string => !!c);
  const rows = await svc.listCountries({ iso_2: codes }, { select: ['iso_2', 'region_id'] });
  const id = rows.find((c) => c.iso_2 === codes[0] && c.region_id)?.region_id ?? rows.find((c) => c.iso_2 === DEFAULT_COUNTRY)?.region_id;
  return id ? retrieveRegion(scope, id) : null;
}

/** A member's region: from the country given at sign-up, else their phone's. */
export const regionOfMember = (scope: Scope, m: { country?: string | null; phone: string }) => regionOfCountry(scope, m.country ?? countryFromPhone(m.phone));

/** The currency of a region; the euro without one. */
export const currencyOf = (region: RegionView | null) => region?.currency_code ?? 'EUR';

// ── A region's default scale ─────────────────────────────────────────────────

/** To the step, without the float's dust (0,15 and not 0,15000000000000002). */
const roundTo = (v: number, step: number) => Number((Math.round(v / step) * step).toFixed(6));
const rates = (v: number) => Math.round(v * 100) / 100;

/** The euro scale, scaled to the region's minimum wage (its metadata); the euro one as it is otherwise. */
export function regionDefaults(region: Pick<RegionView, 'metadata'> | null): Pricing {
  const wage = Number(region?.metadata?.minimum_wage) || DEFAULT_PRICING.smic_hourly;
  const r = Number(region?.metadata?.rounding) || DEFAULT_PRICING.rounding;
  if (wage === DEFAULT_PRICING.smic_hourly && r === DEFAULT_PRICING.rounding) return DEFAULT_PRICING;
  const k = wage / DEFAULT_PRICING.smic_hourly;
  /** A flat amount, to the currency's step (never 0 when it wasn't). */
  const flat = (v: number) => (v ? Math.max(r, roundTo(v * k, r)) : 0);
  const d = structuredClone(DEFAULT_PRICING);
  d.smic_hourly = wage;
  d.rounding = r;
  d.min_price = flat(d.min_price);
  d.fees.service_min = flat(d.fees.service_min);
  d.fees.insurance = flat(d.fees.insurance);
  for (const s of Object.values(d.services)) if (s.price !== undefined) s.price = flat(s.price);
  d.urgent = flat(d.urgent);
  d.trade_urgent = flat(d.trade_urgent);
  const t = d.transport;
  t.pickup = flat(t.pickup);
  t.per_km = rates(t.per_km * k);
  t.per_km_beyond = rates(t.per_km_beyond * k);
  for (const s of ['S', 'M', 'L', 'XL', 'XXL'] as const) t.sizes[s] = flat(t.sizes[s]);
  t.weights = t.weights.map((w) => ({ ...w, extra: flat(w.extra) }));
  t.fragile = flat(t.fragile);
  t.handling = { door: flat(t.handling.door), room: flat(t.handling.room), floor: flat(t.handling.floor) };
  t.urgent = flat(t.urgent);
  const c = d.clickcollect;
  c.pickup = flat(c.pickup);
  c.per_km = rates(c.per_km * k);
  for (const b of ['1', '2-5', '6-9', '10+'] as const) c.bags[b] = flat(c.bags[b]);
  c.heavy = flat(c.heavy);
  c.urgent = flat(c.urgent);
  const o = d.onsite;
  o.travel = flat(o.travel);
  o.per_minute = rates(o.per_minute * k);
  o.per_check = flat(o.per_check);
  o.photos = o.photos.map((p) => ({ ...p, extra: flat(p.extra) }));
  o.urgent = flat(o.urgent);
  o.live_call = flat(o.live_call);
  o.obd = flat(o.obd);
  o.verify_only_min = flat(o.verify_only_min);
  o.drive = { pickup: flat(o.drive.pickup), per_km: rates(o.drive.per_km * k) };
  d.cancellation.min_fee = flat(d.cancellation.min_fee);
  return d;
}

// ── The scale in force ───────────────────────────────────────────────────────

const cache = new Map<string, { value: Pricing; at: number }>();
const CACHE_MS = 30_000;

/** A region's scale in force: its newest saved version over its defaults (kept 30 s in memory). */
export async function getPricing(scope: Scope, regionId: string | null | undefined): Promise<Pricing> {
  const key = regionId ?? '';
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const region = regionId ? await retrieveRegion(scope, regionId) : null;
  const [latest] = regionId ? await scope.resolve<PricingModuleService>(PRICING_MODULE).listPriceScales({ region_id: regionId }, { take: 1, order: { created_at: 'DESC' } }) : [];
  const value = latest ? merge(regionDefaults(region), upgradeScale(latest.data)) : regionDefaults(region);
  cache.set(key, { value, at: Date.now() });
  return value;
}

/** After a save: the next reads take the new version. */
export const forgetPricing = () => cache.clear();

/** A minimum the Traikeur set on what they receive, as a minimum on the price paid, in their region. */
export async function minimumFor(scope: Scope, m: { country?: string | null; phone: string }, net: number) {
  const region = await regionOfMember(scope, m);
  return grossFor(await getPricing(scope, region?.id), net, currencyOf(region));
}
