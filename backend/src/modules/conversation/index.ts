import { Module } from '@traiku/framework';
import ConversationModuleService from './service';

export const CONVERSATION_MODULE = 'conversation';

export default Module(CONVERSATION_MODULE, { service: ConversationModuleService });
export { ConversationModuleService };
