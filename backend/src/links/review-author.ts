import { defineLink } from '@traiku/framework';
import MemberModule from '../modules/member';
import ReviewModule from '../modules/review';

/** review.author: who wrote it. */
export default defineLink({ linkable: ReviewModule.linkable.review, field: 'author_id' }, { linkable: MemberModule.linkable.member, alias: 'author' }, { readOnly: true });
