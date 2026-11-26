import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { MEMBER_MODULE, type MemberModuleService } from '../../../modules/member';
import { credentialViews } from '../../utils/identity-views';

/** Trade proofs to review (pending by default), oldest first. */
export const GET = async (req: AuthenticatedTraikuRequest<unknown, { status?: string; limit: number; offset: number }>, res: TraikuResponse) => {
  const q = req.validatedQuery;
  const status = q.status && ['pending', 'approved', 'refused'].includes(q.status) ? (q.status as 'pending') : 'pending';
  const [rows, count] = await req.scope.resolve<MemberModuleService>(MEMBER_MODULE).listAndCountCredentials({ status }, { take: q.limit, skip: q.offset, order: { created_at: status === 'pending' ? 'ASC' : 'DESC' } });
  res.json({ credentials: await credentialViews(req.scope, rows), count });
};
