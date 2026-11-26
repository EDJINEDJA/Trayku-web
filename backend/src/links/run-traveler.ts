import { defineLink } from '@traiku/framework';
import MemberModule from '../modules/member';
import MissionModule from '../modules/mission';

/** run.traveler: the Traikeur doing it (run.traveler_id). */
export default defineLink({ linkable: MissionModule.linkable.run, field: 'traveler_id' }, { linkable: MemberModule.linkable.member, alias: 'traveler' }, { readOnly: true });
