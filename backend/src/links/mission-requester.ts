import { defineLink } from '@traiku/framework';
import MemberModule from '../modules/member';
import MissionModule from '../modules/mission';

/** mission.requester: the member who published it (mission.requester_id). */
export default defineLink({ linkable: MissionModule.linkable.mission, field: 'requester_id' }, { linkable: MemberModule.linkable.member, alias: 'requester' }, { readOnly: true });
