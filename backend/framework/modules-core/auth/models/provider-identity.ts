import { model } from '../../../dml';
import AuthIdentity from './auth-identity';

/** How they sign in: "phone-otp" with the phone number, "emailpass" with the email (and the password hash). */
const ProviderIdentity = model
  .define('provider_identity', {
    id: model.id({ prefix: 'provid' }).primaryKey(),
    entity_id: model.text(),
    provider: model.text(),
    auth_identity: model.belongsTo(() => AuthIdentity),
    provider_metadata: model.json().nullable(),
  })
  .indexes([{ on: ['entity_id', 'provider'], unique: true }]);

export default ProviderIdentity;
