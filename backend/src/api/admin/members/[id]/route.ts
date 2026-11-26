import { Modules, type AuthModuleService } from '@traiku/framework';
import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { MEMBER_MODULE, type MemberModuleService } from '../../../../modules/member';
import { MISSION_MODULE, type MissionModuleService } from '../../../../modules/mission';
import { REVIEW_MODULE, type ReviewModuleService } from '../../../../modules/review';
import { serializeMe } from '../../../utils/serialize';
import { credentialViews, identityCheckViews } from '../../../utils/identity-views';
import type { Infer, UpdateMemberAdmin } from '../../../utils/validators';

/** A member for the team: the profile, the missions published and taken, the reviews received. */
export const GET = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const member = await req.scope.resolve<MemberModuleService>(MEMBER_MODULE).retrieveMember(String(req.params.id));
  const missions = req.scope.resolve<MissionModuleService>(MISSION_MODULE);
  const [published, runs, reviews] = await Promise.all([
    missions.listMissions({ requester_id: member.id }, { take: 50, select: ['id', 'title', 'status', 'price', 'currency_code', 'created_at'] }),
    missions.listRuns({ traveler_id: member.id }, { take: 50, select: ['id', 'mission_id', 'step', 'status', 'accepted_at', 'locked_at'], order: { accepted_at: 'DESC' } }),
    req.scope.resolve<ReviewModuleService>(REVIEW_MODULE).listReviews({ target_id: member.id }, { take: 20 }),
  ]);
  const members = req.scope.resolve<MemberModuleService>(MEMBER_MODULE);
  const [checks, credentials] = await Promise.all([
    members.listIdentityChecks({ member_id: member.id }, { order: { created_at: 'DESC' }, take: 10 }),
    members.listCredentials({ member_id: member.id }, { order: { created_at: 'DESC' }, take: 10 }),
  ]);
  const taken = runs.length ? await missions.listMissions({ id: runs.map((r) => r.mission_id) }, { select: ['id', 'title', 'price', 'currency_code'] }) : [];
  res.json({
    member: serializeMe(member),
    withdrawals: member.withdrawals,
    // Requester absent declared by this Traikeur (run-no-show): many in 30 days, to look at.
    no_shows: ((member.metadata ?? {}) as { no_shows?: string[] }).no_shows ?? [],
    published,
    taken: runs.map((r) => ({ ...r, mission: taken.find((m) => m.id === r.mission_id) ?? null })),
    reviews,
    identity_checks: await identityCheckViews(req.scope, checks),
    credentials: await credentialViews(req.scope, credentials),
  });
};

/** The team's decisions on a member: identity checked, certificate granted, suspension (which signs them out). */
export const POST = async (req: AuthenticatedTraikuRequest<Infer<typeof UpdateMemberAdmin>>, res: TraikuResponse) => {
  const member = await req.scope.resolve<MemberModuleService>(MEMBER_MODULE).updateMembers({ id: String(req.params.id), ...req.validatedBody });
  if (req.validatedBody.status === 'suspended') {
    const auth = req.scope.resolve<AuthModuleService>(Modules.AUTH);
    const identity = await auth.findIdentity('phone-otp', member.phone);
    if (identity) await auth.revokeTokens(identity.id);
  }
  res.json({ member: serializeMe(member) });
};
