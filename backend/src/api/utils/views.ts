import type { AwilixContainer } from 'awilix';
import { Modules, type PaymentModuleService } from '@traiku/framework';
import { MISSION_MODULE, type MissionModuleService } from '../../modules/mission';
import { REVIEW_MODULE, type ReviewModuleService } from '../../modules/review';
import type { MissionRow, RunRow } from '../../modules/mission/service';
import { MEMBER_MODULE, type MemberModuleService } from '../../modules/member';
import { isIntervention } from '../../lib/rules';
import { fileUrls, photoIdsOf, publicMembers, serializeMission, serializeRun, type Role } from './serialize';

/** Missions as a member sees them: their role on each, the run when they're part of it, the people. */
export async function missionViews(scope: AwilixContainer, missions: MissionRow[], viewerId: string | null, runs?: RunRow[]) {
  const svc = scope.resolve<MissionModuleService>(MISSION_MODULE);
  const ids = missions.map((m) => m.id);
  const allRuns = runs ?? (viewerId && ids.length ? await svc.listRuns({ mission_id: ids, status: { $ne: 'cancelled' } }) : []);
  // A crew has several runs: a Traikeur sees theirs, the requester the first (and the crew apart).
  const runOf = (m: MissionRow) =>
    allRuns.find((r) => r.mission_id === m.id && r.status !== 'cancelled' && r.traveler_id === viewerId) ?? allRuns.find((r) => r.mission_id === m.id && r.status !== 'cancelled') ?? null;
  const roleOf = (m: MissionRow, run: RunRow | null): Role => (viewerId && m.requester_id === viewerId ? 'requester' : viewerId && run?.traveler_id === viewerId ? 'traveler' : 'public');

  // With a seller: the times proposed. The requester sees them all, a Traikeur only theirs.
  const withSeller = missions.filter((m) => m.seller_windows?.length).map((m) => m.id);
  const proposals = withSeller.length ? await svc.listProposals({ mission_id: withSeller }, { order: { at: 'ASC' } }) : [];
  // The rating I gave on each, if any: the mission then shows as rated.
  const myReviews = viewerId && ids.length ? await scope.resolve<ReviewModuleService>(REVIEW_MODULE).listReviews({ author_id: viewerId, mission_id: ids }) : [];

  // The requester's payment on each of theirs: reserved, captured, released.
  const mineIds = missions.filter((m) => viewerId && m.requester_id === viewerId).map((m) => m.id);
  const pays = mineIds.length ? await scope.resolve<PaymentModuleService>(Modules.PAYMENT).listPayments({ resource_id: mineIds }, { order: { created_at: 'DESC' } }) : [];
  const paymentOf = (id: string) => {
    const list = pays.filter((p) => p.resource_id === id);
    const p = list.find((x) => x.status === 'authorized' || x.status === 'captured') ?? list[0];
    return p ? paymentView(p) : null;
  };

  // An assistance service: once arrived (face checked), the Traikeur may call the requester (absent, the door).
  const callable = missions.filter((m) => {
    const run = runOf(m);
    return isIntervention(m) && run?.traveler_id === viewerId && run.status === 'active' && !!run.pickup_unlocked_at;
  });
  const phones = callable.length
    ? Object.fromEntries(
        (await scope.resolve<MemberModuleService>(MEMBER_MODULE).listMembers({ id: callable.map((m) => m.requester_id) }, { select: ['id', 'phone'] })).map((p) => [p.id, p.phone])
      )
    : {};

  const people = await publicMembers(scope, [...missions.map((m) => m.requester_id), ...allRuns.map((r) => r.traveler_id), ...proposals.map((p) => p.member_id)]);
  const visible = missions.map((m) => ({ m, run: runOf(m) })).map((x) => ({ ...x, role: roleOf(x.m, x.run) }));
  const urls = await fileUrls(
    scope,
    visible.flatMap(({ m, run, role }) => photoIdsOf(m, role === 'public' ? null : run))
  );

  return visible.map(({ m, run, role }) => ({
    ...serializeMission(m, role, urls, { requester: people[m.requester_id], unlocked: !!run?.pickup_unlocked_at }),
    role,
    proposals: proposals
      .filter((p) => p.mission_id === m.id && (role === 'requester' || p.member_id === viewerId))
      .map((p) => ({ id: p.id, at: p.at, status: p.status, by: people[p.member_id] ?? null, mine: p.member_id === viewerId })),
    chosen_proposal_id: role === 'requester' ? m.chosen_proposal_id : null,
    requester_phone: role === 'traveler' ? (phones[m.requester_id] ?? null) : null,
    payment: role === 'requester' ? paymentOf(m.id) : null,
    my_rating: myReviews.find((r) => r.mission_id === m.id)?.rating ?? null,
    run: run && role !== 'public' ? serializeRun(run, role === 'requester' ? 'requester' : 'traveler', urls, people[run.traveler_id]) : null,
    // Several Traikeurs: who is on it and where each stands (the requester and the crew see it).
    team:
      (m.crew ?? 1) > 1 && role !== 'public'
        ? allRuns
            .filter((r) => r.mission_id === m.id && r.status !== 'cancelled')
            .map((r) => ({ run_id: r.id, traveler: people[r.traveler_id] ?? null, step: r.step, status: r.status, mine: r.traveler_id === viewerId }))
        : null,
  }));
}

export async function missionView(scope: AwilixContainer, mission: MissionRow, viewerId: string | null) {
  const [view] = await missionViews(scope, [mission], viewerId);
  return view;
}

type PaymentRow = Awaited<ReturnType<PaymentModuleService['retrievePayment']>>;

/** A payment as the payer sees it: never the provider's ids. */
export const paymentView = (p: PaymentRow) => ({
  id: p.id,
  provider_id: p.provider_id,
  mode: p.mode,
  status: p.status,
  amount: Number(p.amount),
  captured_amount: Number(p.captured_amount),
  refunded_amount: Number(p.refunded_amount),
  currency_code: p.currency_code,
});
