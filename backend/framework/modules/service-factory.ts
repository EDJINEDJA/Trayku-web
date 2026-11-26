import type { Db } from '../database';
import type { DmlEntity, InferColumns, InferEntity, Schema } from '../dml';
import type { Logger } from '../logger';
import { pluralize, TraikuError, type Plural } from '../utils';
import { Repository, type Context, type Filters, type FindConfig } from './repository';

/** What a module's service receives: the connection, the logger and the module's options. */
export type ModuleDeps = {
  __pg_connection__: Db;
  logger: Logger;
  options: Record<string, unknown>;
  [key: string]: unknown;
};

type AnyEntity = DmlEntity<string, Schema>;
type ModelsConfig = Record<string, AnyEntity>;

type Writable<E> = Omit<InferColumns<E>, 'created_at' | 'updated_at' | 'deleted_at'>;
export type CreateInput<E> = Partial<Writable<E>>;
export type UpdateInput<E> = Partial<Writable<E>> & { id: string };
export type UpdateSelector<E> = { selector: Filters<InferColumns<E>>; data: Partial<Writable<E>> };

type Methods<K extends string, E> = {
  [P in `retrieve${K}`]: (id: string, config?: FindConfig<InferColumns<E>>, ctx?: Context) => Promise<InferEntity<E>>;
} & {
  [P in `list${Plural<K>}`]: (filters?: Filters<InferColumns<E>>, config?: FindConfig<InferColumns<E>>, ctx?: Context) => Promise<InferEntity<E>[]>;
} & {
  [P in `listAndCount${Plural<K>}`]: (filters?: Filters<InferColumns<E>>, config?: FindConfig<InferColumns<E>>, ctx?: Context) => Promise<[InferEntity<E>[], number]>;
} & {
  [P in `create${Plural<K>}`]: {
    (data: CreateInput<E>, ctx?: Context): Promise<InferEntity<E>>;
    (data: CreateInput<E>[], ctx?: Context): Promise<InferEntity<E>[]>;
  };
} & {
  [P in `update${Plural<K>}`]: {
    (data: UpdateInput<E>, ctx?: Context): Promise<InferEntity<E>>;
    (data: UpdateInput<E>[], ctx?: Context): Promise<InferEntity<E>[]>;
    (data: UpdateSelector<E>, ctx?: Context): Promise<InferEntity<E>[]>;
  };
} & {
  [P in `delete${Plural<K>}` | `softDelete${Plural<K>}` | `restore${Plural<K>}`]: (ids: string | string[], ctx?: Context) => Promise<void>;
};

type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (x: infer I) => void ? I : never;

export type ServiceMethods<M extends ModelsConfig> = UnionToIntersection<{ [K in keyof M & string]: Methods<K, M[K]> }[keyof M & string]>;

export abstract class BaseModuleService {
  protected readonly __container: ModuleDeps;
  protected readonly db: Db;
  protected readonly logger: Logger;
  protected readonly options: Record<string, unknown>;

  constructor(deps: ModuleDeps) {
    this.__container = deps;
    this.db = deps.__pg_connection__;
    this.logger = deps.logger;
    this.options = deps.options ?? {};
  }

  /** Runs `fn` in one transaction, or in the caller's when there is one already. */
  protected async transaction<T>(fn: (ctx: Context) => Promise<T>, ctx?: Context): Promise<T> {
    if (ctx?.transactionManager) return fn(ctx);
    return this.db.transaction((trx) => fn({ transactionManager: trx }));
  }

  /** The data access of one of the module's models. */
  protected repo(name: string): Repository {
    const models = (this.constructor as unknown as { $models: ModelsConfig }).$models;
    const entity = models[name];
    if (!entity) throw new TraikuError(TraikuError.Types.UNEXPECTED_STATE, `Modèle inconnu : ${name}`);
    return new Repository(entity, this.db);
  }
}

export type ModuleServiceClass<M extends ModelsConfig = ModelsConfig> = {
  new (deps: ModuleDeps): BaseModuleService & ServiceMethods<M>;
  $models: M;
};

/** Any module's service class, whatever its models. */
export type AnyModuleServiceClass = { new (deps: ModuleDeps): BaseModuleService; $models: ModelsConfig };

/**
 * As MedusaService: one class with, for each model, retrieveX, listXs, listAndCountXs, createXs,
 * updateXs, deleteXs, softDeleteXs and restoreXs. The module's service extends it and adds its own methods.
 */
export function TraikuService<M extends ModelsConfig>(models: M): ModuleServiceClass<M> {
  class GeneratedService extends BaseModuleService {
    static $models = models;
  }
  const proto = GeneratedService.prototype as unknown as Record<string, unknown>;

  for (const name of Object.keys(models)) {
    const plural = pluralize(name);
    const repo = (self: BaseModuleService) => (self as unknown as { repo(n: string): Repository }).repo(name);

    proto[`retrieve${name}`] = function (this: BaseModuleService, id: string, config?: FindConfig<Record<string, unknown>>, ctx?: Context) {
      return repo(this).retrieve(id, config, ctx);
    };
    proto[`list${plural}`] = function (this: BaseModuleService, filters?: Record<string, unknown>, config?: FindConfig<Record<string, unknown>>, ctx?: Context) {
      return repo(this).list(filters, config, ctx);
    };
    proto[`listAndCount${plural}`] = async function (this: BaseModuleService, filters?: Record<string, unknown>, config?: FindConfig<Record<string, unknown>>, ctx?: Context) {
      const r = repo(this);
      const { take: _t, skip: _s, ...countConfig } = config ?? {};
      void _t;
      void _s;
      return Promise.all([r.list(filters, config, ctx), r.count(filters, countConfig, ctx)]);
    };
    proto[`create${plural}`] = async function (this: BaseModuleService, data: Record<string, unknown> | Record<string, unknown>[], ctx?: Context) {
      const rows = await repo(this).create(Array.isArray(data) ? data : [data], ctx);
      return Array.isArray(data) ? rows : rows[0];
    };
    proto[`update${plural}`] = async function (this: BaseModuleService, data: Record<string, unknown> | Record<string, unknown>[], ctx?: Context) {
      const r = repo(this);
      if (!Array.isArray(data) && 'selector' in data) {
        const { selector, data: values } = data as { selector: Record<string, unknown>; data: Record<string, unknown> };
        return r.updateWhere(selector, values, ctx);
      }
      const list = Array.isArray(data) ? data : [data];
      const run = (c?: Context) => Promise.all(list.map((d) => r.update(String(d[r.meta.primaryKey]), d, c)));
      const rows = list.length > 1 ? await this.transaction(run, ctx) : await run(ctx);
      return Array.isArray(data) ? rows : rows[0];
    };
    proto[`delete${plural}`] = function (this: BaseModuleService, ids: string | string[], ctx?: Context) {
      return repo(this).delete(Array.isArray(ids) ? ids : [ids], ctx);
    };
    proto[`softDelete${plural}`] = function (this: BaseModuleService, ids: string | string[], ctx?: Context) {
      return repo(this).softDelete(Array.isArray(ids) ? ids : [ids], ctx);
    };
    proto[`restore${plural}`] = function (this: BaseModuleService, ids: string | string[], ctx?: Context) {
      return repo(this).restore(Array.isArray(ids) ? ids : [ids], ctx);
    };
  }

  return GeneratedService as unknown as ModuleServiceClass<M>;
}

export type { Context, Filters, FindConfig };
