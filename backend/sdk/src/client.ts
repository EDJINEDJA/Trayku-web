/**
 * The HTTP client, as @medusajs/js-sdk's Client: the publishable key and the member's token are
 * added to each call, errors come back as TraikuApiError, and the token is kept in the storage given
 * (the phone's secure storage in the app).
 */

/** Where the token is kept: async (expo-secure-store) or not (localStorage). */
export type TokenStorage = {
  getItem: (key: string) => Promise<string | null> | string | null;
  setItem: (key: string, value: string) => Promise<void> | void;
  removeItem: (key: string) => Promise<void> | void;
};

export type ClientConfig = {
  /** The API's address, without a trailing slash: "https://api.traiku.fr". */
  baseUrl: string;
  /** The app's pk_ key, sent on /app/* as x-publishable-api-key. */
  publishableKey: string;
  auth?: {
    /** Defaults to memory: the member signs in again at each launch. */
    storage?: TokenStorage;
    /** The storage key. */
    storageKey?: string;
  };
  /** Gives up after this long (ms); 30 s by default. */
  timeoutMs?: number;
  /** For tests, or a fetch with extras. */
  fetch?: typeof fetch;
};

export type Query = Record<string, string | number | boolean | null | undefined | (string | number)[]>;

export type FetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Sent as JSON, or as is for FormData (photos). */
  body?: unknown;
  query?: Query;
  headers?: Record<string, string>;
  /** Overrides the stored token for this call (the registration token). */
  token?: string | null;
  signal?: AbortSignal;
  /** Overrides the client's timeout for this call (photos take longer). */
  timeoutMs?: number;
};

/** An error from the API: `message` is written for the member, in French. */
export class TraikuApiError extends Error {
  /** 0 when the API could not be reached. */
  readonly status: number;
  /** "invalid_data", "not_found", "not_allowed", "unauthorized", "too_many_requests"… */
  readonly type: string;
  /** A finer reason when there is one ("member_suspended", "publishable_key_required"…). */
  readonly code?: string;
  /** Seconds to wait, after too many calls. */
  readonly retryAfter?: number;

  constructor(status: number, type: string, message: string, code?: string, retryAfter?: number) {
    super(message);
    this.name = 'TraikuApiError';
    this.status = status;
    this.type = type;
    this.code = code;
    this.retryAfter = retryAfter;
  }

  /** The API could not be reached (no network, server down, timeout). */
  get offline() {
    return this.status === 0;
  }
}

const memory = (): TokenStorage => {
  const values = new Map<string, string>();
  return { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => void values.set(k, v), removeItem: (k) => void values.delete(k) };
};

const isFormData = (b: unknown): b is FormData => typeof FormData !== 'undefined' && b instanceof FormData;

function queryString(query?: Query) {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) v.forEach((x) => params.append(k, String(x)));
    else params.append(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export class Client {
  readonly config: Required<Pick<ClientConfig, 'baseUrl' | 'publishableKey' | 'timeoutMs'>>;
  private readonly storage: TokenStorage;
  private readonly storageKey: string;
  private readonly fetchImpl: typeof fetch;
  private token: string | null = null;
  private loaded: Promise<void> | null = null;
  private listeners = new Set<(token: string | null) => void>();

  constructor(config: ClientConfig) {
    if (!config.baseUrl) throw new Error('@traiku/sdk : baseUrl manquant.');
    if (!config.publishableKey?.startsWith('pk_')) throw new Error('@traiku/sdk : publishableKey doit être une clé pk_.');
    this.config = { baseUrl: config.baseUrl.replace(/\/+$/, ''), publishableKey: config.publishableKey, timeoutMs: config.timeoutMs ?? 30_000 };
    this.storage = config.auth?.storage ?? memory();
    this.storageKey = config.auth?.storageKey ?? 'traiku_auth_token';
    this.fetchImpl = config.fetch ?? ((...args) => fetch(...args));
  }

  /** The stored token, read once from the storage. */
  async getToken(): Promise<string | null> {
    this.loaded ??= Promise.resolve(this.storage.getItem(this.storageKey))
      .then((t) => {
        this.token = t;
      })
      .catch(() => {
        this.token = null;
      });
    await this.loaded;
    return this.token;
  }

  async setToken(token: string | null) {
    await this.getToken();
    if (token === this.token) return;
    this.token = token;
    try {
      if (token) await this.storage.setItem(this.storageKey, token);
      else await this.storage.removeItem(this.storageKey);
    } finally {
      this.listeners.forEach((l) => l(token));
    }
  }

  /** Called when the token changes: signed in, refreshed, signed out or refused by the API. */
  onTokenChange(listener: (token: string | null) => void): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  /** A call to the API; the JSON answer, or a TraikuApiError. */
  async fetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
    const { method = 'GET', body, query, signal } = options;
    const token = options.token !== undefined ? options.token : await this.getToken();
    const headers: Record<string, string> = { accept: 'application/json', ...options.headers };
    if (path.startsWith('/app')) headers['x-publishable-api-key'] = this.config.publishableKey;
    if (token) headers.authorization = `Bearer ${token}`;
    let payload: BodyInit | undefined;
    if (body !== undefined) {
      if (isFormData(body)) payload = body;
      else {
        headers['content-type'] = 'application/json';
        payload = JSON.stringify(body);
      }
    }

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => ((timedOut = true), controller.abort()), options.timeoutMs ?? this.config.timeoutMs);
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort);
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.config.baseUrl}${path}${queryString(query)}`, { method, headers, body: payload, signal: controller.signal });
    } catch (e) {
      if (signal?.aborted) throw new TraikuApiError(0, 'aborted', 'Requête annulée.');
      if (timedOut) throw new TraikuApiError(0, 'timeout', 'Traiku met trop de temps à répondre. Réessayez.');
      // A network failure is "offline"; anything else (a file that can't be read…) says what it is.
      const message = e instanceof Error ? e.message : String(e);
      if (/network|failed to fetch|load failed|internet|offline|connect/i.test(message)) throw new TraikuApiError(0, 'offline', 'Pas de connexion à Traiku. Vérifiez votre réseau et réessayez.');
      throw new TraikuApiError(0, 'client_error', `Envoi impossible : ${message}`);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }

    const data = (await res.json().catch(() => null)) as (T & { type?: string; code?: string; message?: string }) | null;
    if (res.ok) return data as T;
    // The stored token no longer works (expired, revoked, account suspended): signed out.
    if (res.status === 401 && token && options.token === undefined) await this.setToken(null);
    const retry = Number(res.headers.get('retry-after')) || undefined;
    throw new TraikuApiError(res.status, data?.type ?? 'unknown_error', data?.message ?? 'Une erreur est survenue. Réessayez.', data?.code, retry);
  }
}
