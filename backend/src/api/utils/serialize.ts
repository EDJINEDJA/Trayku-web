import type { AwilixContainer } from 'awilix';
import { Modules, type FileModuleService } from '@traiku/framework';
import { MEMBER_MODULE, type MemberModuleService } from '../../modules/member';
import type { MemberRow } from '../../modules/member/service';
import type { Place, ProofPhoto } from '../../modules/mission';
import type { MissionRow, RunRow } from '../../modules/mission/service';
import { reportFileIds } from '../../lib/report';
import { recentWithdrawals } from '../../lib/rules';
import { bagsOf, currencyDigits, payout } from '../../lib/pricing';
import { getPricing, regionOfMember } from '../../lib/regions';
import { MISSION_MODULE, type MissionModuleService } from '../../modules/mission';

/**
 * What each one may see. Before acceptance, the Traikeurs see the area (city, position rounded to
 * about 1 km), never the phones, the order number or the codes. The Traikeur of the mission sees the
 * exact places and the contacts, the order number once their face is checked, and never the codes.
 * The requester sees everything of their mission, codes included (they give them, or their recipient).
 */

export type Role = 'public' | 'traveler' | 'requester' | 'admin';

const area = (p: Place): Place => ({ label: p.city ?? '', city: p.city, latitude: Math.round(p.latitude * 100) / 100, longitude: Math.round(p.longitude * 100) / 100 });

/** Signed links for the files a set of rows points to. */
export async function fileUrls(scope: AwilixContainer, ids: (string | null | undefined)[]) {
  return scope.resolve<FileModuleService>(Modules.FILE).urls([...new Set(ids.filter((i): i is string => !!i))]);
}

const withUrl = (urls: Record<string, string>) => (p: ProofPhoto | null) => (p ? { ...p, url: urls[p.file_id] ?? null } : null);

/** The report with a fresh link on each photo: links expire, the stored report keeps the ids. */
function reportWithUrls(v: unknown, urls: Record<string, string>, depth = 0): unknown {
  if (!v || typeof v !== 'object' || depth > 6) return v;
  if (Array.isArray(v)) return v.map((x) => reportWithUrls(x, urls, depth + 1));
  const o = Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, reportWithUrls(x, urls, depth + 1)]));
  return typeof o.file_id === 'string' ? { ...o, url: urls[o.file_id] ?? null } : o;
}

export function photoIdsOf(mission: MissionRow, run?: RunRow | null) {
  return [
    ...mission.photos,
    ...(mission.order?.proofs ?? []),
    ...(mission.deposit?.proofs ?? []),
    ...(run
      ? [run.pickup_photo?.file_id, run.dropoff_photo?.file_id, ...run.before_photos.map((p) => p.file_id), ...run.work_photos.map((p) => p.file_id), ...run.faces.map((f) => f.file_id), ...reportFileIds(run.report)]
      : []),
  ];
}

/** The name on the order as shown before the counter: the first name and the initial (« Rihad A. »). */
const holderOf = (o: NonNullable<MissionRow['order']>) => {
  const first = o.first_name?.trim() || o.name.trim().split(/\s+/)[0] || '';
  const last = o.last_name?.trim() || o.name.trim().split(/\s+/).slice(1).join(' ');
  return last ? `${first} ${last.charAt(0).toUpperCase()}.` : first;
};

/** The whole order, its captures as links: for the requester, and the Traikeur once at the counter. */
const fullOrder = (o: MissionRow['order'], urls: Record<string, string>) => (o ? { ...o, holder: holderOf(o), methods: o.methods ?? [o.method ?? 'number'], bags: bagsOf(o.bags), proofs: (o.proofs ?? []).map((id) => urls[id]).filter(Boolean) } : null);

export function serializeMission(m: MissionRow, role: Role, urls: Record<string, string>, extra: { run?: RunRow | null; requester?: unknown; unlocked?: boolean } = {}) {
  const base = {
    id: m.id,
    mode: m.mode,
    type: m.type,
    category: m.category,
    catalog_id: m.catalog_id,
    title: m.title,
    description: m.description,
    size: m.size,
    weight_kg: m.weight_kg,
    fragile: m.fragile,
    frozen: m.frozen,
    photos: m.photos.map((id) => urls[id]).filter(Boolean),
    pickup: area(m.pickup),
    dropoff: area(m.dropoff),
    /** The road between the two places above, as precise as they are. */
    road_path: m.road_path ?? null,
    deadline: m.deadline,
    window_start: m.window_start,
    onsite_minutes: m.onsite_minutes,
    proof: m.proof,
    profession: m.profession,
    dropoff_floor: m.dropoff_floor,
    dropoff_elevator: m.dropoff_elevator,
    pickup_floor: m.pickup_floor,
    pickup_elevator: m.pickup_elevator,
    chat_open: m.chat_open,
    handoff: m.handoff ?? null,
    // The counter's chain for everyone; what to show there, for the Traikeur of the mission and the requester.
    deposit: m.deposit ? { kind: m.deposit.kind, store: m.deposit.store, reason: m.deposit.reason } : null,
    parcel: m.parcel ?? null,
    order: m.order ? { store: m.order.store, holder: holderOf(m.order), bags: bagsOf(m.order.bags), heavy: m.order.heavy, ready_at: m.order.ready_at, method: m.order.method ?? 'number', methods: m.order.methods ?? [m.order.method ?? 'number'], id_required: !!m.order.id_required, last_day: m.order.last_day } : null,
    purchase: m.purchase ? { price: m.purchase.price, payment: m.purchase.payment, url: m.purchase.url } : null,
    listing: m.listing,
    subject: m.subject,
    inspect_kind: m.inspect_kind,
    checklist: m.checklist,
    min_photos: m.min_photos,
    live_call: m.live_call,
    obd_diagnostic: m.obd_diagnostic,
    appointment: m.appointment,
    appointment_end: m.appointment_end,
    seller_windows: m.seller_windows,
    seller_confirmed: m.seller_confirmed,
    urgent: m.urgent,
    price: m.price,
    /** Several Traikeurs: how many, how many places taken; each gets an equal share of the price. */
    crew: m.crew ?? 1,
    seats_taken: m.seats_taken ?? 0,
    price_each: Math.round((m.price / (m.crew || 1)) * 100) / 100,
    /** What one Traikeur receives (their share of the price), Traiku's commission taken. */
    payout: payout(m.price / (m.crew || 1), m.traikeur_rate, currencyDigits(m.currency_code)),
    currency_code: m.currency_code,
    traikeur_rate: m.traikeur_rate,
    verify_only_price: m.verify_only_price,
    status: m.status,
    republished_at: m.republished_at,
    created_at: m.created_at,
    requester: extra.requester ?? null,
  };
  if (role === 'public') return base;

  const exact = {
    ...base,
    pickup: m.pickup,
    dropoff: m.dropoff,
    pickup_note: m.pickup_note,
    dropoff_note: m.dropoff_note,
    recipient_name: m.recipient_name,
    sender_name: m.sender_name,
    handler_phone: m.handler_phone,
    deposit: m.deposit ? { ...m.deposit, proofs: m.deposit.proofs.map((id) => urls[id]).filter(Boolean) } : null,
    seller: m.seller,
  };
  if (role === 'traveler') return { ...exact, order: m.order && extra.unlocked ? fullOrder(m.order, urls) : base.order };

  return {
    ...exact,
    order: fullOrder(m.order, urls),
    recipient_phone: m.recipient_phone,
    sender_email: m.sender_email,
    recipient_email: m.recipient_email,
    declared_value: m.declared_value,
    seller_code: m.seller_code,
    review_note: m.review_note,
    cancel_fee: m.cancel_fee,
    // Why it closed, to its requester: « no_show » (absent on arrival), « expired », « verify_only ».
    outcome: role === 'requester' || role === 'admin' ? ((m.metadata as { outcome?: string } | null)?.outcome ?? null) : null,
    // What the requester pays on top of the Traikeur's price.
    service_fee: m.service_fee,
    insurance_fee: m.insurance_fee,
    cancelled_at: m.cancelled_at,
    from_mission_id: m.from_mission_id,
    follow_up_id: m.follow_up_id,
    ...(role === 'admin' && { requester_id: m.requester_id, metadata: m.metadata }),
  };
}

export function serializeRun(r: RunRow, role: Exclude<Role, 'public'>, urls: Record<string, string>, traveler?: unknown) {
  const url = withUrl(urls);
  const run = {
    id: r.id,
    mission_id: r.mission_id,
    step: r.step,
    status: r.status,
    accepted_at: r.accepted_at,
    pickup_unlocked_at: r.pickup_unlocked_at,
    pickup_code_at: r.pickup_code_at,
    seller_checked_at: r.seller_checked_at,
    picked_at: r.picked_at,
    delivered_at: r.delivered_at,
    cancelled_at: r.cancelled_at,
    locked: !!r.locked_at,
    code_attempts: r.code_attempts,
    pickup_photo: url(r.pickup_photo),
    dropoff_photo: url(r.dropoff_photo),
    before_photos: r.before_photos.map(url),
    work_photos: r.work_photos.map(url),
    report: reportWithUrls(r.report, urls),
    report_sent_at: r.report_sent_at,
    decision: r.decision,
    decided_at: r.decided_at,
    leg_started_at: r.leg_started_at,
    leg_from: r.leg_from,
    tip: r.tip,
    extra_minutes: r.extra_minutes,
    extra_amount: r.extra_amount,
    extra_request: r.extra_request,
    traveler: traveler ?? null,
  };
  if (role === 'traveler') return { ...run, trip_id: r.trip_id };
  return {
    ...run,
    // The requester gives these, or sends them to whoever hands over and to the recipient.
    pickup_code: r.pickup_code,
    dropoff_code: r.dropoff_code,
    faces: role === 'admin' ? r.faces.map((f) => ({ ...f, url: urls[f.file_id] ?? null })) : r.faces.map((f) => ({ at: f.at, url: urls[f.file_id] ?? null })),
    ...(role === 'admin' && { traveler_id: r.traveler_id, trip_id: r.trip_id, inspection: r.inspection }),
  };
}

/** The public profile of several members at once, by id. */
export async function publicMembers(scope: AwilixContainer, ids: (string | null | undefined)[]) {
  const svc = scope.resolve<MemberModuleService>(MEMBER_MODULE);
  const list = [...new Set(ids.filter((i): i is string => !!i))];
  const rows: MemberRow[] = list.length ? await svc.listMembers({ id: list }) : [];
  return Object.fromEntries(rows.map((m) => [m.id, svc.toPublic(m)]));
}

export function serializeMe(m: MemberRow) {
  return {
    id: m.id,
    phone: m.phone,
    email: m.email,
    first_name: m.first_name,
    last_name: m.last_name,
    tax_info: m.tax_info ?? null,
    saved_places: m.saved_places ?? [],
    deletion_requested_at: m.deletion_requested_at ?? null,
    civility: m.civility,
    birth_date: m.birth_date,
    address: m.address ?? null,
    zone: m.zone,
    price_prefs: m.price_prefs ?? null,
    /** ISO code of the phone's country: the member's region, and the country the phone fields start with. */
    country: m.country ?? null,
    professions_answered_at: m.professions_answered_at,
    avatar_color: m.avatar_color,
    bio: m.bio,
    vehicle: m.vehicle,
    professions: m.professions,
    obd_reader: m.obd_reader,
    verified_phone: m.verified_phone,
    verified_id: m.verified_id,
    verifier: m.verifier,
    rating: Math.round(m.rating_avg * 10) / 10,
    rating_count: m.rating_count,
    missions_done: m.missions_done,
    /** Missions given back after the free minutes, in the last 30 days: suspended a week at the limit. */
    withdrawals: recentWithdrawals(m.withdrawals),
    /** Certificat Traiku obtained, by trade: when, with what score. */
    certificates: ((m.metadata ?? {}) as { certificates?: Record<string, { at: string; score: number }> }).certificates ?? {},
    /** A failed test, by trade: when it was (the next try opens 7 days later). */
    certificate_fails: ((m.metadata ?? {}) as { certificate_fails?: Record<string, string> }).certificate_fails ?? {},
    status: m.status,
    suspended_until: m.suspended_until,
    created_at: m.created_at,
  };
}

/**
 * The signed-in member with where their sign-up stands: the identity check, the trade question and
 * the zone are required before the app opens.
 */
/** Km as the crow flies between two places (haversine). */
const kmBetween = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

/** The km of the missions the member did as a Traikeur, from pickup to drop-off: the header of Mon compte. */
async function kmShared(scope: AwilixContainer, member_id: string) {
  const svc = scope.resolve<MissionModuleService>(MISSION_MODULE);
  const runs = await svc.listRuns({ traveler_id: member_id, status: 'done' }, { select: ['mission_id'], take: 10000 });
  if (!runs.length) return 0;
  const missions = await svc.listMissions({ id: [...new Set(runs.map((r) => r.mission_id))] }, { select: ['id', 'pickup', 'dropoff'] });
  const km = missions.reduce((s, x) => (x.pickup && x.dropoff ? s + kmBetween(x.pickup as Place, x.dropoff as Place) : s), 0);
  return Math.round(km * 10) / 10;
}

export async function meView(scope: AwilixContainer, m: MemberRow) {
  const [check] = await scope.resolve<MemberModuleService>(MEMBER_MODULE).listIdentityChecks({ member_id: m.id, status: { $ne: 'replaced' } }, { take: 1, order: { created_at: 'DESC' } });
  const identity: 'none' | 'pending' | 'verified' | 'refused' = m.verified_id ? 'verified' : check?.status === 'pending' || check?.status === 'refused' ? check.status : 'none';
  const onboarding = { identity: identity !== 'none' && identity !== 'refused', profession: !!m.professions_answered_at, zone: !!m.zone };
  // The driving licence sent, the newest: to bring back a car or a motorbike once approved.
  const [lic] = await scope.resolve<MemberModuleService>(MEMBER_MODULE).listCredentials({ member_id: m.id, kind: 'licence' }, { take: 1, order: { created_at: 'DESC' } });
  const licence = lic ? { status: lic.status, categories: (lic.title ?? '').split(',').map((c) => c.trim()).filter(Boolean), reason: lic.status === 'refused' ? lic.reason : null } : null;
  // A new Traikeur: one mission at a time until this many are done.
  const needed = (await getPricing(scope, (await regionOfMember(scope, m))?.id)).newcomers.one_at_a_time;
  // The profile photo: a link that expires, asked again with the profile.
  const avatar_url = m.avatar_file_id ? await scope.resolve<FileModuleService>(Modules.FILE).url(m.avatar_file_id).catch(() => null) : null;
  return {
    newcomer: m.missions_done < needed ? { done: m.missions_done, needed } : null,
    ...serializeMe(m),
    km_shared: await kmShared(scope, m.id),
    avatar_url,
    identity: { status: identity, document_type: check?.document_type ?? null, reason: identity === 'refused' ? (check?.reason ?? null) : null, at: check?.created_at ?? null },
    onboarding: { ...onboarding, done: onboarding.identity && onboarding.profession && onboarding.zone },
    licence,
  };
}
