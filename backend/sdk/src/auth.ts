import type { Client } from './client';
import type { Me, RegisterMember } from './types';

/**
 * Signing in with the phone, as Medusa's sdk.auth: a code by SMS, then a token. A new phone gets a
 * registration token, kept here until `register` turns it into a member's token.
 */
export class Auth {
  /** The token of a phone just verified, without a member yet. */
  private registrationToken: string | null = null;

  constructor(private readonly client: Client) {}

  /** Sends a 6-digit code by SMS; `expires_at` is when it stops working. */
  requestCode(phone: string) {
    return this.client.fetch<{ phone: string; expires_at: string }>('/auth/member/phone-otp/request', { method: 'POST', body: { phone }, token: null });
  }

  /**
   * Checks the code. `registered: true`: signed in. `false`: a new phone, to finish with `register`.
   */
  async verifyCode(phone: string, code: string): Promise<{ registered: boolean }> {
    const { token, registered } = await this.client.fetch<{ token: string; registered: boolean }>('/auth/member/phone-otp', { method: 'POST', body: { phone, code }, token: null });
    if (registered) {
      this.registrationToken = null;
      await this.client.setToken(token);
    } else this.registrationToken = token;
    return { registered };
  }

  /** Creates the account of the phone just verified, then signs in. */
  async register(data: RegisterMember): Promise<Me> {
    const token = this.registrationToken;
    if (!token) throw new Error('@traiku/sdk : vérifiez d’abord le numéro avec verifyCode.');
    const { member } = await this.client.fetch<{ member: Me }>('/app/members', { method: 'POST', body: data, token });
    const fresh = await this.client.fetch<{ token: string }>('/auth/token/refresh', { method: 'POST', token });
    this.registrationToken = null;
    await this.client.setToken(fresh.token);
    return member;
  }

  /** A phone verified, waiting for `register`. */
  get pendingRegistration() {
    return !!this.registrationToken;
  }

  /** A fresh token (7 more days); signed out if the current one no longer works. */
  async refresh() {
    const { token } = await this.client.fetch<{ token: string }>('/auth/token/refresh', { method: 'POST' });
    await this.client.setToken(token);
  }

  /** Refreshes the token when it ends within `withinMs` (a day by default): at launch, for instance. */
  async refreshIfNeeded(withinMs = 24 * 3600_000) {
    const token = await this.client.getToken();
    const exp = token ? expiryOf(token) : null;
    if (exp && exp - Date.now() < withinMs) await this.refresh();
  }

  /** Signs out on every device (the API revokes the tokens), then forgets the token here. */
  async logout() {
    this.registrationToken = null;
    try {
      if (await this.client.getToken()) await this.client.fetch('/auth/token', { method: 'DELETE' });
    } finally {
      await this.client.setToken(null);
    }
  }
}

/** The token's end (ms), read from its payload; the signature is checked by the API, not here. */
function expiryOf(token: string): number | null {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), '='))) as { exp?: number };
    return exp ? exp * 1000 : null;
  } catch {
    return null;
  }
}
