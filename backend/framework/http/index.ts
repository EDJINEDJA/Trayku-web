import type { AwilixContainer } from 'awilix';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { z } from 'zod';
import type { ConfigModule } from '../config';
import type { ApiKeyModuleService } from '../modules-core/api-key';
import type { AuthModuleService } from '../modules-core/auth';
import { ContainerRegistrationKeys, Modules, TraikuError } from '../utils';

export type AuthContext = {
  /** The member's or user's id; empty for a phone just verified, not registered yet. */
  actor_id: string;
  actor_type: string;
  auth_identity_id: string;
  app_metadata: Record<string, unknown>;
};

export type TraikuRequest<Body = unknown, Query = Record<string, unknown>> = Request & {
  scope: AwilixContainer;
  validatedBody: Body;
  validatedQuery: Query;
  auth_context?: AuthContext;
  publishable_key_context?: { key_id: string };
  /** /hooks/* only: the body exactly as received, for the webhook signatures. */
  rawBody?: Buffer;
};

export type AuthenticatedTraikuRequest<Body = unknown, Query = Record<string, unknown>> = TraikuRequest<Body, Query> & { auth_context: AuthContext };
export type TraikuResponse = Response;
export type TraikuNextFunction = NextFunction;
export type TraikuMiddleware = (req: TraikuRequest, res: Response, next: NextFunction) => unknown;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type MiddlewareRoute = {
  /** "/app/missions/:id", "/app/runs/*", or a RegExp. */
  matcher: string | RegExp;
  method?: HttpMethod | HttpMethod[];
  middlewares: (TraikuMiddleware | RequestHandler)[];
};

export type MiddlewaresConfig = { routes: MiddlewareRoute[] };

/** src/api/middlewares.ts: `export default defineMiddlewares({ routes: [...] })`. */
export const defineMiddlewares = (config: MiddlewaresConfig) => config;

const configOf = (req: TraikuRequest) => req.scope.resolve<ConfigModule>(ContainerRegistrationKeys.CONFIG_MODULE);

/** A signed token for an auth identity, as Medusa's generateJwtToken; shorter for the team. */
export function generateJwtToken(payload: AuthContext, config: ConfigModule): string {
  const { jwtSecret, jwtExpiresIn, adminJwtExpiresIn } = config.projectConfig.http;
  const expiresIn = (payload.actor_type === 'user' ? adminJwtExpiresIn : jwtExpiresIn) as jwt.SignOptions['expiresIn'];
  return jwt.sign(payload, jwtSecret, { algorithm: 'HS256', expiresIn });
}

type AuthType = 'bearer' | 'api-key' | 'session';

/** The team's session cookie, as Medusa's admin session: httpOnly, so the page's scripts can't read it. */
export const SESSION_COOKIE = 'traiku_session';

export function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

/**
 * Against CSRF with the cookie: a change must come from the site itself (Origin, or the browser's
 * Sec-Fetch-Site). The cookie is also SameSite=Strict; this is the second lock.
 */
function sameSite(req: Request, config: ConfigModule): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
  const origin = req.get('origin');
  if (origin) {
    const allowed = [new URL(config.projectConfig.http.backendUrl).origin, ...config.projectConfig.http.adminCors.split(',').map((o) => o.trim())];
    return allowed.includes(origin);
  }
  return req.get('sec-fetch-site') === 'same-origin';
}

/**
 * As Medusa's authenticate("customer", ["bearer"]). `allowUnregistered`: a verified phone without a
 * member yet (to register it); `allowUnauthenticated`: reads auth when there is some, without requiring it.
 */
export function authenticate(
  actorType: string | string[],
  authTypes: AuthType | AuthType[],
  options: { allowUnregistered?: boolean; allowUnauthenticated?: boolean } = {}
): TraikuMiddleware {
  const actors = Array.isArray(actorType) ? actorType : [actorType];
  const types = Array.isArray(authTypes) ? authTypes : [authTypes];
  return async (req, _res, next) => {
    if (req.auth_context && (actors.includes(req.auth_context.actor_type) || actors.includes('*'))) return next();
    const header = req.headers.authorization ?? '';
    const [scheme, credentials] = header.split(' ');
    let auth: AuthContext | undefined;

    const verify = async (token: string) => {
      try {
        // The algorithm is fixed: a token can't choose how it is checked ("none", another key type).
        const payload = jwt.verify(token, configOf(req).projectConfig.http.jwtSecret, { algorithms: ['HS256'] }) as AuthContext & { iat: number };
        const revoked = await req.scope.resolve<AuthModuleService>(Modules.AUTH).isRevoked(payload.auth_identity_id, payload.iat);
        if (!revoked && (actors.includes(payload.actor_type) || actors.includes('*'))) return { actor_id: payload.actor_id, actor_type: payload.actor_type, auth_identity_id: payload.auth_identity_id, app_metadata: payload.app_metadata };
      } catch {
        // Expired or forged: treated as no token.
      }
      return undefined;
    };

    if (types.includes('bearer') && scheme?.toLowerCase() === 'bearer' && credentials) auth = await verify(credentials);
    const cookie = types.includes('session') && !auth ? readCookie(req, SESSION_COOKIE) : undefined;
    if (cookie) {
      if (!sameSite(req, configOf(req))) return next(new TraikuError(TraikuError.Types.NOT_ALLOWED, 'Requête refusée : elle ne vient pas du site.', 'csrf'));
      auth = await verify(cookie);
    }
    if (!auth && types.includes('api-key') && scheme?.toLowerCase() === 'basic' && credentials) {
      const token = Buffer.from(credentials, 'base64').toString('utf8').split(':')[0];
      const key = await req.scope.resolve<ApiKeyModuleService>(Modules.API_KEY).authenticate(token, 'secret');
      if (key && 'created_by' in key) auth = { actor_id: key.created_by, actor_type: 'api-key', auth_identity_id: '', app_metadata: { api_key_id: key.id } };
    }

    if (auth && (auth.actor_id || options.allowUnregistered)) {
      req.auth_context = auth;
      return next();
    }
    if (options.allowUnauthenticated) return next();
    next(new TraikuError(TraikuError.Types.UNAUTHORIZED, 'Connectez-vous pour continuer.'));
  };
}

/** /app routes: the request must carry a valid publishable key (x-publishable-api-key), as Medusa's /store. */
export const requirePublishableKey: TraikuMiddleware = async (req, _res, next) => {
  const token = req.get('x-publishable-api-key');
  const key = token ? await req.scope.resolve<ApiKeyModuleService>(Modules.API_KEY).authenticate(token, 'publishable') : null;
  if (!key) return next(new TraikuError(TraikuError.Types.NOT_ALLOWED, 'Clé publique manquante ou révoquée : envoyez l’en-tête x-publishable-api-key.', 'publishable_key_required'));
  req.publishable_key_context = { key_id: key.id };
  next();
};

const issuesOf = (e: z.ZodError) => e.issues.map((i) => (i.path.length ? `${i.path.join('.')} : ${i.message}` : i.message)).join(' ; ');

/** Validates the JSON body with a zod schema; the result is in req.validatedBody. */
export function validateAndTransformBody(schema: z.ZodType): TraikuMiddleware {
  return (req, _res, next) => {
    const r = schema.safeParse(req.body ?? {});
    if (!r.success) return next(new TraikuError(TraikuError.Types.INVALID_DATA, issuesOf(r.error)));
    req.validatedBody = r.data;
    next();
  };
}

/** Validates the query string; the result is in req.validatedQuery. */
export function validateAndTransformQuery(schema: z.ZodType): TraikuMiddleware {
  return (req, _res, next) => {
    const r = schema.safeParse(req.query ?? {});
    if (!r.success) return next(new TraikuError(TraikuError.Types.INVALID_DATA, issuesOf(r.error)));
    req.validatedQuery = r.data as Record<string, unknown>;
    next();
  };
}

/** Limits the calls per key (IP by default) in a window; in memory, so per server. */
export function rateLimit(options: { windowMs: number; max: number; key?: (req: TraikuRequest) => string; message?: string }): TraikuMiddleware {
  const hits = new Map<string, { count: number; until: number }>();
  return (req, res, next) => {
    const now = Date.now();
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.until < now) hits.delete(k);
    const key = options.key?.(req) ?? req.ip ?? 'unknown';
    const hit = hits.get(key);
    const entry = hit && hit.until > now ? hit : { count: 0, until: now + options.windowMs };
    entry.count++;
    hits.set(key, entry);
    if (entry.count > options.max) {
      res.setHeader('Retry-After', Math.ceil((entry.until - now) / 1000));
      return next(new TraikuError(TraikuError.Types.TOO_MANY_REQUESTS, options.message ?? 'Trop de tentatives. Réessayez dans quelques minutes.'));
    }
    next();
  };
}

export { buildHttpApp } from './app';
