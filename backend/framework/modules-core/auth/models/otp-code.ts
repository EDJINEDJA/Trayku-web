import { model } from '../../../dml';

/** A code sent by SMS to sign in: only its hash is kept, 10 minutes, 3 tries. */
const OtpCode = model.define('otp_code', {
  id: model.id({ prefix: 'otp' }).primaryKey(),
  phone: model.text().index(),
  code_hash: model.text(),
  expires_at: model.dateTime(),
  attempts: model.number().default(0),
  consumed_at: model.dateTime().nullable(),
});

export default OtpCode;
