import { model } from '../../../dml';

/** The team: support, moderation, identity checks. Signs in to the admin with an email and a password. */
const User = model.define('user', {
  id: model.id({ prefix: 'user' }).primaryKey(),
  email: model.text().unique(),
  first_name: model.text().nullable(),
  last_name: model.text().nullable(),
  metadata: model.json().nullable(),
});

export default User;
