import { model } from '../../../dml';

/** What the team did in the admin (every change, never the bodies): who, what, when, from where. */
const UserAction = model.define('user_action', {
  id: model.id({ prefix: 'uact' }).primaryKey(),
  actor_id: model.text().index(),
  actor_type: model.text(),
  method: model.text(),
  path: model.text(),
  status: model.number(),
  ip: model.text().nullable(),
});

export default UserAction;
