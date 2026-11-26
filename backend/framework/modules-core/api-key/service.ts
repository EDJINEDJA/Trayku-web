import { TraikuService } from '../../modules';
import { randomToken, sha256, TraikuError } from '../../utils';
import ApiKey from './models/api-key';

export type ApiKeyType = 'publishable' | 'secret';

export default class ApiKeyModuleService extends TraikuService({ ApiKey }) {
  private cache = new Map<string, { id: string; until: number } | null>();

  /** Creates a key; `token` is returned in full only here. */
  async generate(input: { title: string; type: ApiKeyType; created_by: string }) {
    const token = `${input.type === 'publishable' ? 'pk' : 'sk'}_${randomToken(32)}`;
    const redacted = input.type === 'publishable' ? `${token.slice(0, 7)}…${token.slice(-4)}` : `sk_***${token.slice(-4)}`;
    const key = await this.createApiKeys({ ...input, token: input.type === 'publishable' ? token : sha256(token), redacted });
    return { key: { ...key, token: input.type === 'publishable' ? token : key.redacted }, token };
  }

  async revoke(id: string, by: string) {
    const key = await this.retrieveApiKey(id);
    if (key.revoked_at) throw new TraikuError(TraikuError.Types.NOT_ALLOWED, 'Cette clé est déjà révoquée.');
    this.cache.clear();
    return this.updateApiKeys({ id, revoked_at: new Date(), revoked_by: by });
  }

  /** The key behind a token, if valid and not revoked; publishable keys are cached a minute. */
  async authenticate(token: string, type: ApiKeyType) {
    if (!token.startsWith(type === 'publishable' ? 'pk_' : 'sk_')) return null;
    const stored = type === 'publishable' ? token : sha256(token);
    const cached = this.cache.get(stored);
    if (type === 'publishable' && cached !== undefined && (cached === null || cached.until > Date.now())) return cached ? { id: cached.id } : null;
    const [key] = await this.listApiKeys({ token: stored, type, revoked_at: null }, { take: 1 });
    if (type === 'publishable') this.cache.set(stored, key ? { id: key.id, until: Date.now() + 60_000 } : null);
    if (!key) return null;
    if (type === 'secret') await this.updateApiKeys({ id: key.id, last_used_at: new Date() });
    return key;
  }
}
