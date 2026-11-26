import type { Knex } from 'knex';
import type { Db } from '../database';
import type { DmlEntity, Schema } from '../dml';
import { metaOf, type EntityMeta } from '../dml/schema';
import { generateEntityId, TraikuError } from '../utils';

/** Shared across the calls of one operation: pass `{ transactionManager }` to run them in one transaction. */
export type Context = { transactionManager?: Knex.Transaction };

type Operators<V> = {
  $eq?: V | null;
  $ne?: V | null;
  $in?: V[];
  $nin?: V[];
  $gt?: V | string;
  $gte?: V | string;
  $lt?: V | string;
  $lte?: V | string;
  $like?: string;
  $ilike?: string;
  /** The array or json column contains the value. */
  $contains?: unknown;
};

export type Filters<T> = { [K in keyof T]?: T[K] | NonNullable<T[K]>[] | Operators<NonNullable<T[K]>> | null } & {
  $or?: Filters<T>[];
  $and?: Filters<T>[];
};

export type FindConfig<T> = {
  select?: (keyof T & string)[];
  /** Relations of the same module ("runs", "mission"), loaded with the rows. */
  relations?: string[];
  take?: number;
  skip?: number;
  order?: Partial<Record<keyof T & string, 'ASC' | 'DESC' | 'asc' | 'desc'>>;
  withDeleted?: boolean;
};

type Row = Record<string, unknown>;
type AnyFilters = Record<string, unknown>;
type AnyConfig = FindConfig<Row>;

const OPS: Record<string, string> = { $eq: '=', $ne: '<>', $gt: '>', $gte: '>=', $lt: '<', $lte: '<=', $like: 'like', $ilike: 'ilike' };

function isPlain(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);
}

function applyFilters(qb: Knex.QueryBuilder, meta: EntityMeta, filters: AnyFilters) {
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined) continue;
    if (key === '$or' || key === '$and') {
      const list = value as AnyFilters[];
      qb.where((b) => {
        for (const f of list) key === '$or' ? b.orWhere((x) => applyFilters(x, meta, f)) : b.andWhere((x) => applyFilters(x, meta, f));
      });
      continue;
    }
    if (!meta.columns.has(key)) throw new TraikuError(TraikuError.Types.INVALID_DATA, `Filtre inconnu sur ${meta.table} : ${key}`);
    const col = `${meta.table}.${key}`;
    if (value === null) qb.whereNull(col);
    else if (Array.isArray(value)) value.length ? qb.whereIn(col, value as Knex.Value[]) : qb.whereRaw('false');
    else if (isPlain(value)) {
      for (const [op, v] of Object.entries(value)) {
        if (v === undefined) continue;
        if (op === '$in') (v as unknown[]).length ? qb.whereIn(col, v as Knex.Value[]) : qb.whereRaw('false');
        else if (op === '$nin') (v as unknown[]).length && qb.whereNotIn(col, v as Knex.Value[]);
        else if (op === '$contains') qb.whereRaw('?? @> ?', [col, (meta.json.has(key) ? JSON.stringify(v) : v) as Knex.Value]);
        else if ((op === '$eq' || op === '$ne') && v === null) op === '$eq' ? qb.whereNull(col) : qb.whereNotNull(col);
        else if (OPS[op]) qb.where(col, OPS[op], v as Knex.Value);
        else throw new TraikuError(TraikuError.Types.INVALID_DATA, `Opérateur inconnu : ${op}`);
      }
    } else qb.where(col, value as Knex.Value);
  }
}

/** The generic data access of one model, used by the generated services and by Query. */
export class Repository {
  readonly meta: EntityMeta;

  constructor(
    readonly entity: DmlEntity<string, Schema>,
    private readonly db: Db
  ) {
    this.meta = metaOf(entity);
  }

  private conn(ctx?: Context) {
    return ctx?.transactionManager ?? this.db;
  }

  private base(filters: AnyFilters, config: AnyConfig, ctx?: Context) {
    const qb = this.conn(ctx)(this.meta.table);
    applyFilters(qb, this.meta, filters);
    if (!config.withDeleted) qb.whereNull(`${this.meta.table}.deleted_at`);
    return qb;
  }

  /** Only the model's columns, never `*`: a column added by hand (an index, a computed one) doesn't leak out. */
  get allColumns() {
    return [...this.meta.columns];
  }

  private columns(select?: string[]) {
    if (!select?.length || select.includes('*')) return this.allColumns;
    const cols = new Set(select);
    for (const c of cols) if (!this.meta.columns.has(c)) throw new TraikuError(TraikuError.Types.INVALID_DATA, `Champ inconnu sur ${this.meta.table} : ${c}`);
    cols.add(this.meta.primaryKey);
    return [...cols];
  }

  async list(filters: AnyFilters = {}, config: AnyConfig = {}, ctx?: Context): Promise<Row[]> {
    const qb = this.base(filters, config, ctx).select(this.columns(config.select as string[] | undefined));
    const order = config.order && Object.keys(config.order).length ? config.order : { created_at: 'DESC' };
    for (const [col, dir] of Object.entries(order)) {
      if (!this.meta.columns.has(col)) throw new TraikuError(TraikuError.Types.INVALID_DATA, `Tri inconnu sur ${this.meta.table} : ${col}`);
      qb.orderBy(col, String(dir).toLowerCase() as 'asc' | 'desc');
    }
    if (config.take !== undefined) qb.limit(config.take);
    if (config.skip) qb.offset(config.skip);
    const rows = (await qb) as Row[];
    if (config.relations?.length) await this.loadRelations(rows, config.relations, ctx);
    return rows;
  }

  async count(filters: AnyFilters = {}, config: AnyConfig = {}, ctx?: Context): Promise<number> {
    const r = await this.base(filters, config, ctx).count({ count: '*' }).first();
    return Number((r as { count?: number | string } | undefined)?.count ?? 0);
  }

  async retrieve(id: string, config: AnyConfig = {}, ctx?: Context): Promise<Row> {
    if (!id) throw new TraikuError(TraikuError.Types.NOT_FOUND, `${this.entity.name} : identifiant manquant`);
    const [row] = await this.list({ [this.meta.primaryKey]: id }, { ...config, take: 1 }, ctx);
    if (!row) throw new TraikuError(TraikuError.Types.NOT_FOUND, `${this.entity.name} introuvable : ${id}`);
    return row;
  }

  private prepare(data: Row, creating: boolean): Row {
    const out: Row = {};
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      if (!this.meta.columns.has(k)) throw new TraikuError(TraikuError.Types.INVALID_DATA, `Champ inconnu sur ${this.meta.table} : ${k}`);
      // pg would send a JS array as a Postgres array: json columns get their JSON text.
      out[k] = this.meta.json.has(k) && v !== null ? JSON.stringify(v) : v;
    }
    if (creating && !out[this.meta.primaryKey]) out[this.meta.primaryKey] = generateEntityId(this.meta.prefix);
    if (!creating) out.updated_at = new Date();
    return out;
  }

  async create(data: Row[], ctx?: Context): Promise<Row[]> {
    if (!data.length) return [];
    return translate(async () => (await this.conn(ctx)(this.meta.table).insert(data.map((d) => this.prepare(d, true))).returning(this.allColumns)) as Row[]);
  }

  async update(id: string, data: Row, ctx?: Context): Promise<Row> {
    const { [this.meta.primaryKey]: _pk, ...rest } = data;
    void _pk;
    const rows = await translate(
      async () =>
        (await this.conn(ctx)(this.meta.table)
          .where({ [this.meta.primaryKey]: id })
          .whereNull('deleted_at')
          .update(this.prepare(rest, false))
          .returning(this.allColumns)) as Row[]
    );
    if (!rows[0]) throw new TraikuError(TraikuError.Types.NOT_FOUND, `${this.entity.name} introuvable : ${id}`);
    return rows[0];
  }

  async updateWhere(filters: AnyFilters, data: Row, ctx?: Context): Promise<Row[]> {
    const qb = this.base(filters, {}, ctx);
    return translate(async () => (await qb.update(this.prepare(data, false)).returning(this.allColumns)) as Row[]);
  }

  async delete(ids: string[], ctx?: Context) {
    if (ids.length) await this.conn(ctx)(this.meta.table).whereIn(this.meta.primaryKey, ids).delete();
  }

  async softDelete(ids: string[], ctx?: Context) {
    if (ids.length) await this.conn(ctx)(this.meta.table).whereIn(this.meta.primaryKey, ids).update({ deleted_at: new Date() });
  }

  async restore(ids: string[], ctx?: Context) {
    if (ids.length) await this.conn(ctx)(this.meta.table).whereIn(this.meta.primaryKey, ids).update({ deleted_at: null });
  }

  /** The relations of the module itself: belongsTo (one row) and hasMany (a list). Nested with dots: "runs.events". */
  private async loadRelations(rows: Row[], relations: string[], ctx?: Context) {
    const tree = new Map<string, string[]>();
    for (const r of relations) {
      const [head, ...rest] = r.split('.');
      tree.set(head, [...(tree.get(head) ?? []), ...(rest.length ? [rest.join('.')] : [])]);
    }
    for (const [name, nested] of tree) {
      const rel = this.meta.relations[name];
      if (!rel) throw new TraikuError(TraikuError.Types.INVALID_DATA, `Relation inconnue sur ${this.meta.table} : ${name}`);
      const target = new Repository(rel.target(), this.db);
      if (rel.kind === 'belongsTo') {
        const ids = [...new Set(rows.map((r) => r[rel.foreignKey]).filter(Boolean))] as string[];
        const found = ids.length ? await target.list({ [target.meta.primaryKey]: ids }, { relations: nested }, ctx) : [];
        const byId = new Map(found.map((f) => [f[target.meta.primaryKey], f]));
        for (const r of rows) r[name] = byId.get(r[rel.foreignKey]) ?? null;
      } else {
        const ids = rows.map((r) => r[this.meta.primaryKey]) as string[];
        const found = ids.length ? await target.list({ [rel.foreignKey]: ids }, { relations: nested, order: { created_at: 'ASC' } }, ctx) : [];
        for (const r of rows) r[name] = found.filter((f) => f[rel.foreignKey] === r[this.meta.primaryKey]);
      }
    }
  }
}

/** Postgres errors the clients can act on. */
async function translate<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const err = e as { code?: string; detail?: string };
    if (err.code === '23505') throw new TraikuError(TraikuError.Types.DUPLICATE_ERROR, `Existe déjà${err.detail ? ` : ${err.detail}` : ''}`);
    if (err.code === '23503') throw new TraikuError(TraikuError.Types.NOT_FOUND, `Élément lié introuvable${err.detail ? ` : ${err.detail}` : ''}`);
    if (err.code === '23514' || err.code === '23502' || err.code === '22P02') throw new TraikuError(TraikuError.Types.INVALID_DATA, `Donnée invalide${err.detail ? ` : ${err.detail}` : ''}`);
    throw e;
  }
}
