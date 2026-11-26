import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { ConfigModule } from '../config';
import type { Db } from '../database';
import type { DmlEntity, Schema } from '../dml';
import type { Logger } from '../logger';
import type { MigratableModule } from '../migrations';
import { lowerCaseFirst } from '../utils';
import type { AnyModuleServiceClass, BaseModuleService, ModuleDeps } from './service-factory';

export * from './service-factory';
export { Repository } from './repository';

/** What a link points to: a model of a module, as Medusa's `Module.linkable.x`. */
export type Linkable = { serviceName: string; entity: string; model: string; primaryKey: string };

export type ModuleLoader = (deps: ModuleDeps & { service: BaseModuleService }) => Promise<void> | void;

type Linkables<M> = { [K in keyof M & string as Uncapitalize<K>]: Linkable };

export type ModuleDefinition<K extends string = string, S extends AnyModuleServiceClass = AnyModuleServiceClass> = {
  key: K;
  service: S;
  loaders: ModuleLoader[];
  linkable: Linkables<S['$models']>;
};

/** As Medusa's Module(): `export default Module(MISSION_MODULE, { service: MissionModuleService })`. */
export function Module<const K extends string, S extends AnyModuleServiceClass>(key: K, exports: { service: S; loaders?: ModuleLoader[] }): ModuleDefinition<K, S> {
  const linkable = {} as Record<string, Linkable>;
  for (const [name, entity] of Object.entries(exports.service.$models)) {
    linkable[lowerCaseFirst(name)] = { serviceName: key, entity: entity.name, model: name, primaryKey: entity.primaryKey() };
  }
  return { key, service: exports.service, loaders: exports.loaders ?? [], linkable: linkable as Linkables<S['$models']> };
}

export type LoadedModule = {
  key: string;
  dir: string;
  definition: ModuleDefinition;
  service: BaseModuleService;
  entities: DmlEntity<string, Schema>[];
};

/** "./src/modules/mission" from the project; "@traiku/framework/…" from the framework. */
export function resolvePath(rootDir: string, resolve: string): string {
  const frameworkDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  if (resolve.startsWith('@traiku/framework/')) return path.join(frameworkDir, resolve.slice('@traiku/framework/'.length));
  return path.resolve(rootDir, resolve);
}

async function importModule(dir: string): Promise<ModuleDefinition> {
  const file = ['index.ts', 'index.js'].map((f) => path.join(dir, f)).find((f) => fs.existsSync(f));
  if (!file) throw new Error(`Module introuvable : ${dir}`);
  const mod = await import(pathToFileURL(file).href);
  if (!mod.default?.service) throw new Error(`${file} doit exporter par défaut Module(…)`);
  return mod.default as ModuleDefinition;
}

/** Imports each module, builds its service with its own deps (no access to other modules), runs its loaders. */
export async function loadModules(config: ConfigModule, rootDir: string, db: Db, logger: Logger): Promise<LoadedModule[]> {
  const out: LoadedModule[] = [];
  for (const m of config.modules) {
    const dir = resolvePath(rootDir, m.resolve);
    const definition = await importModule(dir);
    const key = m.key || definition.key;
    if (out.some((o) => o.key === key)) throw new Error(`Deux modules ont la clé "${key}"`);
    const deps: ModuleDeps = { __pg_connection__: db, logger, options: { ...m.options, projectConfig: config.projectConfig } };
    const service = new definition.service(deps);
    for (const loader of definition.loaders) await loader({ ...deps, service });
    out.push({ key, dir, definition, service, entities: Object.values(definition.service.$models) });
  }
  return out;
}

export const toMigratable = (modules: LoadedModule[]): MigratableModule[] => modules.map((m) => ({ key: m.key, dir: m.dir, entities: m.entities }));
