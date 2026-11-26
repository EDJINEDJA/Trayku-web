import { model } from '../../../dml';

/**
 * As Medusa's API keys. Publishable (pk_…): in the apps, identifies the client, stored as is.
 * Secret (sk_…): server to server, full access, stored hashed; shown once at creation.
 */
const ApiKey = model.define('api_key', {
  id: model.id({ prefix: 'apk' }).primaryKey(),
  token: model.text().unique(),
  /** "pk_1a2b…9f" or "sk_***9f": what the admin shows. */
  redacted: model.text(),
  title: model.text(),
  type: model.enum(['publishable', 'secret']).index(),
  last_used_at: model.dateTime().nullable(),
  created_by: model.text(),
  revoked_by: model.text().nullable(),
  revoked_at: model.dateTime().nullable(),
});

export default ApiKey;
