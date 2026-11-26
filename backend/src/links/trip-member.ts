import { defineLink } from '@traiku/framework';
import MemberModule from '../modules/member';
import TripModule from '../modules/trip';

/** trip.member: the Traikeur who published it. */
export default defineLink({ linkable: TripModule.linkable.trip, field: 'member_id' }, MemberModule.linkable.member, { readOnly: true });
