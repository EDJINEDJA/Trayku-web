import { model } from '@traiku/framework';
import Conversation from './conversation';

const Message = model.define('message', {
  id: model.id({ prefix: 'msg' }).primaryKey(),
  conversation: model.belongsTo(() => Conversation),
  /** Null: a message from Traiku ("Mission acceptée"…). */
  sender_id: model.text().nullable(),
  kind: model.enum(['text', 'photo', 'system']).default('text'),
  body: model.text().default(''),
  file_id: model.text().nullable(),
  read_at: model.dateTime().nullable(),
});

export default Message;
