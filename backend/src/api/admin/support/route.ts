import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { MEMBER_MODULE, type MemberModuleService } from '../../../modules/member';
import { publicMembers } from '../../utils/serialize';

/** The members' questions, open first, then the newest. */
export const GET = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const list = await req.scope.resolve<MemberModuleService>(MEMBER_MODULE).listSupportRequests({}, { order: { created_at: 'DESC' }, take: 200 });
  const people = await publicMembers(req.scope, list.map((r) => r.member_id));
  const sorted = [...list].sort((a, b) => Number(a.status !== 'open') - Number(b.status !== 'open'));
  res.json({ requests: sorted.map((r) => ({ ...r, member: people[r.member_id] ?? null })), count: list.length });
};
