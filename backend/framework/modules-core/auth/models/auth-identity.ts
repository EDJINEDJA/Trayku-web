import { model, type AnyDmlEntity } from '../../../dml';
import ProviderIdentity from './provider-identity';

/**
 * One person's way in, as Medusa's auth identities. `app_metadata` says who it is in the app:
 * { member_id } for a member, { user_id } for the team.
 */
const AuthIdentity = model.define('auth_identity', {
  id: model.id({ prefix: 'authid' }).primaryKey(),
  app_metadata: model.json().nullable(),
  /** Tokens issued before this are refused: sign out everywhere, suspension. */
  tokens_revoked_at: model.dateTime().nullable(),
  provider_identities: model.hasMany((): AnyDmlEntity => ProviderIdentity, { mappedBy: 'auth_identity' }),
});

export default AuthIdentity;
