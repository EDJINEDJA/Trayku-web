import { TraikuError, TraikuService } from '@traiku/framework';
import Conversation from './models/conversation';
import Message from './models/message';

export type ConversationRow = Awaited<ReturnType<ConversationModuleService['retrieveConversation']>>;

export default class ConversationModuleService extends TraikuService({ Conversation, Message }) {
  /** The conversation, if the member is one of its two people. */
  async forMember(id: string, memberId: string) {
    const c = await this.retrieveConversation(id);
    if (c.member_a !== memberId && c.member_b !== memberId) throw new TraikuError(TraikuError.Types.NOT_FOUND, 'Conversation introuvable.');
    return c;
  }

  /** The existing conversation of a mission with this Traikeur, or a new one. */
  async open(missionId: string, requesterId: string, travelerId: string) {
    const [existing] = await this.listConversations({ mission_id: missionId, member_b: travelerId }, { take: 1 });
    return { conversation: existing ?? (await this.createConversations({ mission_id: missionId, member_a: requesterId, member_b: travelerId })), created: !existing };
  }
}
