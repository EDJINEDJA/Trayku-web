import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { MEMBER_MODULE, type MemberModuleService } from '../../../modules/member';
import { identityCheckViews } from '../../utils/identity-views';

/** The identity checks to review (pending by default), oldest first: the document beside the selfie. */
export const GET = async (req: AuthenticatedTraikuRequest<unknown, { status?: string; limit: number; offset: number }>, res: TraikuResponse) => {
  const q = req.validatedQuery;
  const status = q.status && ['pending', 'verified', 'refused'].includes(q.status) ? (q.status as 'pending') : 'pending';
  const [rows, count] = await req.scope.resolve<MemberModuleService>(MEMBER_MODULE).listAndCountIdentityChecks({ status }, { take: q.limit, skip: q.offset, order: { created_at: status === 'pending' ? 'ASC' : 'DESC' } });
  res.json({ identity_checks: await identityCheckViews(req.scope, rows), count });
};
