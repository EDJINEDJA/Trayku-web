import path from 'node:path';
import dotenv from 'dotenv';
import { DEFAULT_BLOCKED_SMS_PREFIXES, Modules } from './utils';

export type ModuleConfig = {
  /** Container key; for the core modules, the key of the one to configure. */
  key?: string;
  /** "./src/modules/mission", or a core module ("@traiku/framework/modules-core/notification"). */
  resolve?: string;
  options?: Record<string, unknown>;
  /** Leave a core module out. */
  disable?: boolean;
};

export type HttpConfig = {
  port: number;
  /** Proxies in front of the server (0: reached directly). Decides which IP the limits count. */
  trustProxy: number;
  backendUrl: string;
  jwtSecret: string;
  /** Members' tokens (the app refreshes them while valid). */
  jwtExpiresIn: string;
  /** The team's tokens: shorter, the admin can do more. */
  adminJwtExpiresIn: string;
  fileSecret: string;
  appCors: string;
  adminCors: string;
  authCors: string;
};

/**
 * Against SMS pumping (toll fraud): blocked premium ranges; caps on sign-in codes per hour, in total
 * and per zone of numbers. The home zones (the country with most members) only have the total cap.
 */
export type SmsConfig = { blockedPrefixes: string[]; homePrefixes: string[]; otpMaxPerHour: number; otpMaxPerZonePerHour: number };

export type ProjectConfig = {
  /** The server's connection: a role that reads and writes rows only. */
  databaseUrl: string;
  /** db:migrate's connection: the role that owns the tables. Defaults to databaseUrl. */
  databaseMigrationUrl?: string;
  databaseLogging?: boolean;
  http: HttpConfig;
  sms: SmsConfig;
};

/** The dashboard, as Medusa's `admin`: built into outDir, served under path. */
export type AdminConfig = { path: string; outDir: string; disable: boolean };

export type InputConfig = {
  projectConfig: Omit<ProjectConfig, 'http' | 'sms'> & { http?: Partial<HttpConfig>; sms?: Partial<SmsConfig> };
  admin?: Partial<AdminConfig>;
  modules?: ModuleConfig[];
};

export type ConfigModule = {
  projectConfig: ProjectConfig;
  admin: AdminConfig;
  modules: (ModuleConfig & { key: string; resolve: string })[];
};

const CORE: { key: string; resolve: string }[] = [
  { key: Modules.API_KEY, resolve: '@traiku/framework/modules-core/api-key' },
  { key: Modules.AUTH, resolve: '@traiku/framework/modules-core/auth' },
  { key: Modules.USER, resolve: '@traiku/framework/modules-core/user' },
  { key: Modules.NOTIFICATION, resolve: '@traiku/framework/modules-core/notification' },
  { key: Modules.FILE, resolve: '@traiku/framework/modules-core/file' },
  { key: Modules.PAYMENT, resolve: '@traiku/framework/modules-core/payment' },
  { key: Modules.WORKFLOW_ENGINE, resolve: '@traiku/framework/modules-core/workflow-engine' },
];

const DEV_SECRET = 'supersecret';

/** As Medusa's defineConfig: fills the defaults and adds the core modules, which the app may configure or disable. */
export function defineConfig(input: InputConfig): ConfigModule {
  const http: HttpConfig = {
    port: 9000,
    trustProxy: 0,
    backendUrl: 'http://localhost:9000',
    jwtSecret: DEV_SECRET,
    jwtExpiresIn: '7d',
    adminJwtExpiresIn: '12h',
    fileSecret: DEV_SECRET,
    appCors: '',
    adminCors: '',
    authCors: '',
    ...stripUndefined(input.projectConfig.http ?? {}),
  };
  const weak = (v: string) => v === DEV_SECRET || v === 'change-me' || v.length < 32;
  if (weak(http.jwtSecret) || weak(http.fileSecret)) {
    if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET et FILE_SECRET doivent faire au moins 32 caractères aléatoires en production.');
    console.warn('JWT_SECRET ou FILE_SECRET faible : à changer avant la mise en ligne.');
  }
  const sms: SmsConfig = { blockedPrefixes: DEFAULT_BLOCKED_SMS_PREFIXES, homePrefixes: ['+33'], otpMaxPerHour: 300, otpMaxPerZonePerHour: 20, ...stripUndefined(input.projectConfig.sms ?? {}) };

  const own = input.modules ?? [];
  const modules: ConfigModule['modules'] = [];
  for (const core of CORE) {
    const custom = own.find((m) => m.key === core.key);
    if (custom?.disable) continue;
    modules.push({ ...core, ...custom, key: core.key, resolve: custom?.resolve ?? core.resolve });
  }
  for (const m of own) {
    if (CORE.some((c) => c.key === m.key) || m.disable) continue;
    if (!m.resolve) throw new Error(`Module sans "resolve" dans traiku-config.ts : ${m.key ?? '(sans clé)'}`);
    modules.push({ ...m, key: m.key ?? '', resolve: m.resolve });
  }
  return { projectConfig: { ...input.projectConfig, http, sms }, admin: { path: '/admin', outDir: 'admin/dist', disable: false, ...stripUndefined(input.admin ?? {}) }, modules };
}

/** Loads .env, then .env.<environment> if there is one, as Medusa's loadEnv. */
export function loadEnv(environment: string, cwd: string) {
  dotenv.config({ path: path.join(cwd, '.env'), quiet: true });
  dotenv.config({ path: path.join(cwd, `.env.${environment}`), override: true, quiet: true });
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as Partial<T>;
}
