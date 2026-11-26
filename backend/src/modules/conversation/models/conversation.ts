import { model, type AnyDmlEntity } from '@traiku/framework';
import Message from './message';

/** The chat of a mission between the requester and the Traikeur (or a Traikeur asking before accepting). */
const Conversation = model
  .define('conversation', {
    id: model.id({ prefix: 'conv' }).primaryKey(),
    mission_id: model.text().index(),
    /** The requester. */
    member_a: model.text().index(),
    /** The Traikeur. */
    member_b: model.text().index(),
    blocked_by: model.text().nullable(),
    reported_at: model.dateTime().nullable(),
    reported_by: model.text().nullable(),
    messages: model.hasMany((): AnyDmlEntity => Message),
  })
  .indexes([{ on: ['mission_id', 'member_b'], unique: true }]);

export default Conversation;
