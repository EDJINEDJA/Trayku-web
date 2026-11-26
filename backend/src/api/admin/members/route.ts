import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { MEMBER_MODULE, type MemberModuleService } from '../../../modules/member';
import { serializeMe } from '../../utils/serialize';

type Query = { status?: string; q?: string; limit: number; offset: number };

/** Members; status "verifier_review": certificates to check. Search on first name or phone. */
export const GET = async (req: AuthenticatedTraikuRequest<unknown, Query>, res: TraikuResponse) => {
  const { status, q, limit, offset } = req.validatedQuery;
  const like = q ? `%${q.replace(/[%_]/g, '')}%` : null;
  const filters = {
    ...(status === 'active' && { status: 'active' as const }),
    ...(status === 'suspended' && { status: 'suspended' as const }),
    ...(status === 'verifier_review' && { verifier: { $contains: { in_review: true } } }),
    ...(like && { $or: [{ first_name: { $ilike: like } }, { phone: { $ilike: like } }] }),
  };
  const [members, count] = await req.scope.resolve<MemberModuleService>(MEMBER_MODULE).listAndCountMembers(filters, { take: limit, skip: offset });
  res.json({ members: members.map(serializeMe), count });
};
