/**
 * Calls to the backend, as Medusa's admin: the team's session is an httpOnly cookie the browser
 * sends by itself; this code never sees a token. JSON both ways (the Accept header tells the
 * backend it's the API, not a page of the dashboard).
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly type: string,
    message: string
  ) {
    super(message);
  }
}

type Options = { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown; query?: Record<string, string | number | undefined | null>; token?: string };

export async function api<T>(path: string, { method = 'GET', body, query, token }: Options = {}): Promise<T> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  const url = params.size ? `${path}?${params}` : path;
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: { Accept: 'application/json', ...(body !== undefined && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && path.startsWith('/admin') && !location.pathname.endsWith('/login')) location.assign('/admin/login');
    throw new ApiError(res.status, json.type ?? 'unknown_error', json.message ?? 'Une erreur est survenue.');
  }
  return json as T;
}
