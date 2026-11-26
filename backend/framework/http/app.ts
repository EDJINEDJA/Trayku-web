import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AwilixContainer } from 'awilix';
import cors from 'cors';
import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import helmet from 'helmet';
import type { ConfigModule } from '../config';
import type { Logger } from '../logger';
import { ContainerRegistrationKeys, isTraikuError, Modules, TraikuError, type ErrorType } from '../utils';
import type { UserModuleService } from '../modules-core/user';
import { authenticate, rateLimit, requirePublishableKey, type HttpMethod, type MiddlewaresConfig, type TraikuMiddleware, type TraikuRequest } from './index';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

const STATUS: Record<ErrorType, number> = {
  not_found: 404,
  invalid_data: 400,
  unauthorized: 401,
  not_allowed: 403,
  conflict: 409,
  duplicate_error: 422,
  unexpected_state: 500,
  too_many_requests: 429,
};

type RouteFile = { path: string; regex: RegExp; segments: string[]; module: Record<string, unknown> };

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : /^route\.(ts|js)$/.test(e.name) ? [path.join(dir, e.name)] : []));
}

const toRegex = (matcher: string) =>
  new RegExp(
    '^' +
      matcher
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\/:[A-Za-z0-9_]+/g, '/[^/]+')
        .replace(/\*/g, '.*') +
      '/?$'
  );

/**
 * src/api/**\/route.ts, as Medusa's file routing: the folders are the path, "[id]" a parameter, and
 * the file exports GET, POST… Static segments are matched before parameters.
 */
async function loadRoutes(apiDir: string): Promise<RouteFile[]> {
  const routes: RouteFile[] = [];
  for (const file of walk(apiDir)) {
    const rel = path.relative(apiDir, path.dirname(file));
    const segments = rel ? rel.split(path.sep) : [];
    const routePath = '/' + segments.map((s) => s.replace(/^\[(\w+)\]$/, ':$1')).join('/');
    routes.push({ path: routePath, regex: toRegex(routePath), segments, module: await import(pathToFileURL(file).href) });
  }
  const rank = (s: string) => (s.startsWith('[') ? 1 : 0);
  return routes.sort((a, b) => {
    for (let i = 0; i < Math.min(a.segments.length, b.segments.length); i++) {
      const d = rank(a.segments[i]) - rank(b.segments[i]);
      if (d) return d;
    }
    return b.segments.length - a.segments.length;
  });
}

const origins = (list: string) =>
  list
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const methodMatches = (method: string, wanted?: HttpMethod | HttpMethod[]) => !wanted || (Array.isArray(wanted) ? wanted : [wanted]).includes(method as HttpMethod);

export async function buildHttpApp(container: AwilixContainer, rootDir: string) {
  const config = container.resolve<ConfigModule>(ContainerRegistrationKeys.CONFIG_MODULE);
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const http = config.projectConfig.http;
  const apiDir = path.join(rootDir, 'src', 'api');
  const routes = await loadRoutes(apiDir);
  const middlewaresFile = ['middlewares.ts', 'middlewares.js'].map((f) => path.join(apiDir, f)).find((f) => fs.existsSync(f));
  const custom: MiddlewaresConfig = middlewaresFile ? (await import(pathToFileURL(middlewaresFile).href)).default : { routes: [] };

  const app = express();
  app.disable('x-powered-by');
  // Only the proxies really in front: otherwise X-Forwarded-For, sent by anyone, would choose the IP.
  app.set('trust proxy', http.trustProxy);

  // Security headers. The policy (CSP) is the dashboard's: its own scripts only, styles inline for
  // its components, images from here (signed links) and data/blob previews; no frame, no plugin.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
    })
  );

  app.use('/app', cors({ origin: origins(http.appCors), credentials: true }));
  app.use('/admin', cors({ origin: origins(http.adminCors), credentials: true }));
  app.use('/auth', cors({ origin: origins(http.authCors), credentials: true }));
  // The webhooks (/hooks/*) check the provider's signature on the body as sent: kept as is there.
  app.use(express.json({ limit: '2mb', verify: (req, _res, buf) => void ((req as TraikuRequest).url?.startsWith('/hooks/') && ((req as TraikuRequest).rawBody = Buffer.from(buf))) }));

  // Each request gets its own scope of the container, as req.scope in Medusa.
  app.use(((req, _res, next) => {
    (req as TraikuRequest).scope = container.createScope();
    next();
  }) as RequestHandler);

  app.get('/health', (_req, res) => {
    res.send('OK');
  });

  // The dashboard shares /admin with the team's API: the browser asking for a page gets the
  // dashboard, a JSON call goes on to the API.
  const dashboard = path.resolve(rootDir, config.admin.outDir);
  const index = path.join(dashboard, 'index.html');
  if (!config.admin.disable && fs.existsSync(index)) {
    const base = config.admin.path;
    app.use(`${base}/assets`, express.static(path.join(dashboard, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }));
    app.get([base, `${base}/*splat`], ((req, res, next) => (req.accepts(['json', 'html']) === 'html' && !req.get('authorization') ? res.sendFile(index) : next())) as RequestHandler);
    logger.info(`administration sur ${http.backendUrl}${base}`);
  } else if (!config.admin.disable) {
    logger.info('administration non construite : npm run admin:build');
  }

  // /admin is for the team: signed in, unless the route exports AUTHENTICATE = false.
  const open = routes.filter((r) => r.module.AUTHENTICATE === false).map((r) => r.regex);
  const adminAuth = authenticate('user', ['session', 'bearer', 'api-key']);
  app.use('/admin', ((req, res, next) => (open.some((re) => re.test('/admin' + req.path)) ? next() : adminAuth(req as TraikuRequest, res, next))) as RequestHandler);
  app.use('/app', requirePublishableKey as RequestHandler);

  // A ceiling per IP on each part, under the routes' own limits: one machine can't flood the server.
  app.use('/app', rateLimit({ windowMs: 60_000, max: 300 }) as RequestHandler);
  app.use('/auth', rateLimit({ windowMs: 60_000, max: 60 }) as RequestHandler);
  app.use('/admin', rateLimit({ windowMs: 60_000, max: 600 }) as RequestHandler);

  // The team's changes are written down once done (method, path, result; never the body).
  app.use('/admin', ((req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    res.on('finish', () => {
      const auth = (req as TraikuRequest).auth_context;
      if (!auth || res.statusCode >= 400) return;
      container
        .resolve<UserModuleService>(Modules.USER)
        .createUserActions({ actor_id: auth.actor_id, actor_type: auth.actor_type, method: req.method, path: req.originalUrl.split('?')[0], status: res.statusCode, ip: req.ip ?? null })
        .catch((e) => logger.error(`journal de l’équipe : ${(e as Error).message}`));
    });
    next();
  }) as RequestHandler);

  for (const route of custom.routes) {
    const regex = typeof route.matcher === 'string' ? toRegex(route.matcher) : route.matcher;
    app.use(((req, res, next) => {
      if (!regex.test(req.path) || !methodMatches(req.method, route.method)) return next();
      const chain = [...route.middlewares];
      const step = (err?: unknown): void => {
        if (err) return next(err);
        const mw = chain.shift();
        if (!mw) return next();
        Promise.resolve((mw as TraikuMiddleware)(req as TraikuRequest, res, step)).catch(next);
      };
      step();
    }) as RequestHandler);
  }

  for (const route of routes) {
    for (const method of METHODS) {
      const handler = route.module[method];
      if (typeof handler !== 'function') continue;
      app[method.toLowerCase() as 'get'](route.path, handler as RequestHandler);
      logger.debug(`${method} ${route.path}`);
    }
  }

  app.use(((_req, _res, next) => next(new TraikuError(TraikuError.Types.NOT_FOUND, 'Route introuvable.'))) as RequestHandler);

  app.use(((err, req, res, _next) => {
    void _next;
    const e = err as { type?: string; status?: number; code?: string; message?: string };
    if (isTraikuError(err)) {
      if (err.type === 'unexpected_state') logger.error(`${req.method} ${req.path} : ${err.message}`);
      return res.status(STATUS[err.type]).json({ type: err.type, code: err.code, message: err.message });
    }
    if (e.type === 'entity.parse.failed') return res.status(400).json({ type: 'invalid_data', message: 'Corps JSON invalide.' });
    if (e.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ type: 'invalid_data', message: 'Fichier trop lourd (10 Mo au plus).' });
    if (e.code?.startsWith?.('LIMIT_')) return res.status(400).json({ type: 'invalid_data', message: 'Envoi refusé : trop de fichiers ou champ inattendu.' });
    logger.error(`${req.method} ${req.path}`, err);
    res.status(500).json({ type: 'unknown_error', message: 'Une erreur est survenue. Réessayez.' });
  }) as ErrorRequestHandler);

  return app;
}
