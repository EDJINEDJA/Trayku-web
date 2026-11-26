import type { TraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { MEMBER_MODULE, type MemberModuleService } from '../../../../modules/member';
import { REVIEW_MODULE, type ReviewModuleService } from '../../../../modules/review';
import { publicMembers } from '../../../utils/serialize';

/** A public profile: first name, rating, checks, and the latest reviews. */
export const GET = async (req: TraikuRequest<unknown, { limit: number; offset: number }>, res: TraikuResponse) => {
  const member = await req.scope.resolve<MemberModuleService>(MEMBER_MODULE).retrieveMember(String(req.params.id));
  const [reviews, count] = await req.scope.resolve<ReviewModuleService>(REVIEW_MODULE).listAndCountReviews({ target_id: member.id }, { take: req.validatedQuery.limit, skip: req.validatedQuery.offset });
  const authors = await publicMembers(req.scope, reviews.map((r) => r.author_id));
  res.json({
    member: req.scope.resolve<MemberModuleService>(MEMBER_MODULE).toPublic(member),
    bio: member.bio,
    reviews: reviews.map((r) => ({ id: r.id, rating: r.rating, comment: r.comment, role: r.role, created_at: r.created_at, author: authors[r.author_id] ?? null })),
    count,
  });
};
