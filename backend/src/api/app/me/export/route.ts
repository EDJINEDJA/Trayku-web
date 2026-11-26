import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { MEMBER_MODULE, type MemberModuleService } from '../../../../modules/member';
import { MISSION_MODULE, type MissionModuleService } from '../../../../modules/mission';
import { TRIP_MODULE, type TripModuleService } from '../../../../modules/trip';
import { REVIEW_MODULE, type ReviewModuleService } from '../../../../modules/review';
import { serializeMe } from '../../../utils/serialize';

/**
 * « Télécharger mes données » (RGPD, right of access): what Traiku holds about me, as JSON. The
 * documents sent (identity, proofs) are listed, not copied.
 */
export const GET = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const id = req.auth_context.actor_id;
  const members = req.scope.resolve<MemberModuleService>(MEMBER_MODULE);
  const missions = req.scope.resolve<MissionModuleService>(MISSION_MODULE);
  const [me, published, runs, trips, reviews, identity, credentials, support] = await Promise.all([
    members.retrieveMember(id),
    missions.listMissions({ requester_id: id }),
    missions.listRuns({ traveler_id: id }),
    req.scope.resolve<TripModuleService>(TRIP_MODULE).listTrips({ member_id: id }),
    req.scope.resolve<ReviewModuleService>(REVIEW_MODULE).listReviews({ author_id: id }),
    members.listIdentityChecks({ member_id: id }),
    members.listCredentials({ member_id: id }),
    members.listSupportRequests({ member_id: id }),
  ]);
  res.setHeader('Content-Disposition', 'attachment; filename="traiku-mes-donnees.json"');
  res.json({
    exported_at: new Date().toISOString(),
    account: serializeMe(me),
    missions_published: published.map((m) => ({ id: m.id, title: m.title, category: m.category, status: m.status, price: m.price, created_at: m.created_at })),
    missions_done: runs.map((r) => ({ id: r.id, mission_id: r.mission_id, step: r.step, status: r.status, accepted_at: r.accepted_at, delivered_at: r.delivered_at })),
    trips: trips.map((t) => ({ id: t.id, created_at: t.created_at })),
    reviews_given: reviews.map((r) => ({ mission_id: r.mission_id, rating: r.rating, comment: r.comment, created_at: r.created_at })),
    identity_checks: identity.map((c) => ({ document_type: c.document_type, status: c.status, created_at: c.created_at })),
    proofs: credentials.map((c) => ({ kind: c.kind, profession: c.profession, title: c.title, status: c.status, created_at: c.created_at })),
    support_requests: support.map((s) => ({ topic: s.topic, message: s.message, answer: s.answer, created_at: s.created_at })),
  });
};
