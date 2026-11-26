import { TraikuService } from '../../modules';
import type { ProjectConfig } from '../../config';
import { hashPassword, isSmsBlocked, normalizePhone, randomDigits, safeEqual, sha256, SMS_BLOCKED_MESSAGE, smsZone, TraikuError, verifyPassword } from '../../utils';
import AuthIdentity from './models/auth-identity';
import OtpCode from './models/otp-code';
import ProviderIdentity from './models/provider-identity';

const OTP_TTL_MS = 10 * 60_000;
const OTP_TRIES = 3;
const OTP_GAP_MS = 30_000;
const OTP_PER_HOUR = 5;
/** Team accounts: after this many wrong passwords in a row, locked for LOCK_MS. */
const PASSWORD_TRIES = 5;
const LOCK_MS = 15 * 60_000;
/** How long a revocation check is cached: a revoked token stops working within this. */
const REVOKED_CACHE_MS = 30_000;

type PasswordMeta = { password?: string; failures?: number; locked_until?: string };

export default class AuthModuleService extends TraikuService({ AuthIdentity, ProviderIdentity, OtpCode }) {
  private revokedCache = new Map<string, { at: number | null; until: number }>();

  /** The identity that signs in with this phone or email, if any. */
  async findIdentity(provider: string, entityId: string) {
    const p = await this.identityFor(provider, entityId);
    return p ? this.retrieveAuthIdentity(p.auth_identity_id) : null;
  }

  /** Refuses every token issued so far for this identity (sign out everywhere, suspension). */
  async revokeTokens(authIdentityId: string) {
    this.revokedCache.delete(authIdentityId);
    // A second before now: a token issued in the same second as the revocation is refused too.
    await this.updateAuthIdentities({ id: authIdentityId, tokens_revoked_at: new Date(Date.now() + 1000) });
  }

  /** Whether a token issued at `issuedAt` (seconds, the JWT's iat) was revoked since. */
  async isRevoked(authIdentityId: string, issuedAt: number) {
    let entry = this.revokedCache.get(authIdentityId);
    if (!entry || entry.until < Date.now()) {
      const [identity] = await this.listAuthIdentities({ id: authIdentityId }, { take: 1, select: ['id', 'tokens_revoked_at'] });
      // Deleted identity: every token refused.
      entry = { at: identity ? (identity.tokens_revoked_at?.getTime() ?? null) : Infinity, until: Date.now() + REVOKED_CACHE_MS };
      this.revokedCache.set(authIdentityId, entry);
    }
    return entry.at !== null && issuedAt * 1000 < entry.at;
  }

  private async identityFor(provider: string, entityId: string) {
    const [p] = await this.listProviderIdentities({ provider, entity_id: entityId }, { take: 1, relations: ['auth_identity'] });
    return p;
  }

  /** emailpass: a team account. */
  async registerEmailPass(email: string, password: string) {
    const entityId = email.trim().toLowerCase();
    if (password.length < 8) throw new TraikuError(TraikuError.Types.INVALID_DATA, 'Le mot de passe doit faire au moins 8 caractères.');
    if (await this.identityFor('emailpass', entityId)) throw new TraikuError(TraikuError.Types.DUPLICATE_ERROR, 'Un compte existe déjà avec cet email.');
    return this.transaction(async (ctx) => {
      const identity = await this.createAuthIdentities({ app_metadata: {} }, ctx);
      await this.createProviderIdentities({ provider: 'emailpass', entity_id: entityId, auth_identity_id: identity.id, provider_metadata: { password: await hashPassword(password) } }, ctx);
      return identity;
    });
  }

  async authenticateEmailPass(email: string, password: string) {
    const p = await this.identityFor('emailpass', email.trim().toLowerCase());
    const wrong = new TraikuError(TraikuError.Types.UNAUTHORIZED, 'Email ou mot de passe incorrect.');
    // Same answer whether the email exists or not; the hash is computed anyway, so the time doesn't tell either.
    if (!p) {
      await verifyPassword(password, 'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$' + 'A'.repeat(86) + '==');
      throw wrong;
    }
    const meta = (p.provider_metadata ?? {}) as PasswordMeta;
    if (meta.locked_until && new Date(meta.locked_until).getTime() > Date.now()) {
      throw new TraikuError(TraikuError.Types.TOO_MANY_REQUESTS, 'Trop d’essais : ce compte est bloqué 15 minutes.');
    }
    if (!meta.password || !(await verifyPassword(password, meta.password))) {
      const failures = (meta.failures ?? 0) + 1;
      const locked = failures >= PASSWORD_TRIES;
      await this.updateProviderIdentities({ id: p.id, provider_metadata: { ...meta, failures: locked ? 0 : failures, locked_until: locked ? new Date(Date.now() + LOCK_MS).toISOString() : undefined } });
      if (locked) this.logger.warn(`compte équipe ${p.entity_id} bloqué après ${PASSWORD_TRIES} mots de passe faux`);
      throw wrong;
    }
    if (meta.failures || meta.locked_until) await this.updateProviderIdentities({ id: p.id, provider_metadata: { password: meta.password } });
    return this.retrieveAuthIdentity(p.auth_identity_id);
  }

  /** phone-otp, first half: a 6-digit code to send by SMS. */
  async requestOtp(phoneInput: string) {
    const phone = normalizePhone(phoneInput);
    if (!phone) throw new TraikuError(TraikuError.Types.INVALID_DATA, 'Ce numéro de téléphone n’est pas valide.');
    const { blockedPrefixes, homePrefixes, otpMaxPerHour, otpMaxPerZonePerHour } = (this.options.projectConfig as ProjectConfig).sms;
    if (isSmsBlocked(phone, blockedPrefixes)) throw new TraikuError(TraikuError.Types.INVALID_DATA, SMS_BLOCKED_MESSAGE, 'sms_blocked');
    const hourAgo = new Date(Date.now() - 3600_000);
    const busy = new TraikuError(TraikuError.Types.TOO_MANY_REQUESTS, 'Le service de connexion est très demandé. Réessayez dans quelques minutes.');
    // Caps: past them something is wrong (an attack), better to stop sending.
    const [, lastHour] = await this.listAndCountOtpCodes({ created_at: { $gt: hourAgo } }, { take: 1 });
    if (lastHour >= otpMaxPerHour) {
      this.logger.error(`plafond de codes SMS atteint (${lastHour} dans l’heure) : envoi refusé`);
      throw busy;
    }
    if (!homePrefixes.some((p) => phone.startsWith(p))) {
      const zone = smsZone(phone);
      const [, inZone] = await this.listAndCountOtpCodes({ phone: { $like: `${zone}%` }, created_at: { $gt: hourAgo } }, { take: 1 });
      if (inZone >= otpMaxPerZonePerHour) {
        this.logger.error(`plafond de codes SMS atteint pour la zone ${zone} (${inZone} dans l’heure) : envoi refusé`);
        throw busy;
      }
    }
    const recent = await this.listOtpCodes({ phone, created_at: { $gt: new Date(Date.now() - 3600_000) } }, { order: { created_at: 'DESC' } });
    if (recent[0] && Date.now() - recent[0].created_at.getTime() < OTP_GAP_MS) throw new TraikuError(TraikuError.Types.TOO_MANY_REQUESTS, 'Patientez quelques secondes avant de demander un nouveau code.');
    if (recent.length >= OTP_PER_HOUR) throw new TraikuError(TraikuError.Types.TOO_MANY_REQUESTS, 'Trop de codes demandés. Réessayez dans une heure.');
    const code = randomDigits(6);
    const otp = await this.createOtpCodes({ phone, code_hash: sha256(`${phone}:${code}`), expires_at: new Date(Date.now() + OTP_TTL_MS) });
    return { phone, code, expires_at: otp.expires_at };
  }

  /** phone-otp, second half: the code typed back. Returns the identity, created on the first sign-in. */
  async verifyOtp(phoneInput: string, code: string) {
    const phone = normalizePhone(phoneInput);
    const invalid = new TraikuError(TraikuError.Types.UNAUTHORIZED, 'Code incorrect ou expiré. Demandez-en un nouveau.', 'otp_invalid');
    if (!phone) throw invalid;
    const [otp] = await this.listOtpCodes({ phone, consumed_at: null, expires_at: { $gt: new Date() } }, { take: 1, order: { created_at: 'DESC' } });
    if (!otp || otp.attempts >= OTP_TRIES) throw invalid;
    if (!safeEqual(otp.code_hash, sha256(`${phone}:${code}`))) {
      await this.updateOtpCodes({ id: otp.id, attempts: otp.attempts + 1 });
      throw invalid;
    }
    await this.updateOtpCodes({ id: otp.id, consumed_at: new Date() });
    const existing = await this.identityFor('phone-otp', phone);
    if (existing) return { identity: await this.retrieveAuthIdentity(existing.auth_identity_id), phone };
    return this.transaction(async (ctx) => {
      const identity = await this.createAuthIdentities({ app_metadata: {} }, ctx);
      await this.createProviderIdentities({ provider: 'phone-otp', entity_id: phone, auth_identity_id: identity.id }, ctx);
      return { identity, phone };
    });
  }

  /** The phone or email an identity signs in with. */
  async entityIdOf(authIdentityId: string, provider: string) {
    const [p] = await this.listProviderIdentities({ auth_identity_id: authIdentityId, provider }, { take: 1 });
    return p?.entity_id ?? null;
  }

  async setAppMetadata(authIdentityId: string, key: string, value: string | null) {
    const identity = await this.retrieveAuthIdentity(authIdentityId);
    const app_metadata = { ...(identity.app_metadata ?? {}), [key]: value };
    if (value === null) delete app_metadata[key];
    return this.updateAuthIdentities({ id: authIdentityId, app_metadata });
  }
}
