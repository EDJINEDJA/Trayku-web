import { defineLink } from '@traiku/framework';
import ConversationModule from '../modules/conversation';
import MissionModule from '../modules/mission';

/** conversation.mission: the mission it's about. */
export default defineLink({ linkable: ConversationModule.linkable.conversation, field: 'mission_id' }, MissionModule.linkable.mission, { readOnly: true });
