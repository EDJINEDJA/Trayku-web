import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Db } from '../database';
import type { Logger } from '../logger';
import type { Linkable, LoadedModule } from '../modules';
import { Repository, type Context } from '../modules';
import { generateEntityId, pluralize, toSnakeCase, TraikuError } from '../utils';

type Side = Linkable | { linkable: Linkable; isList?: boolean; field?: string; alias?: string };

export type LinkSide = Linkable & { isList: boolean; field?: string; alias: string };

export type LinkDefinition = {
  left: LinkSide;
  right: LinkSide;
  /** Read-only: no table, the left model holds the right id in `left.field` (as Medusa's readOnly links). */
  readOnly: boolean;
  table: string;
  leftColumn: string;
  rightColumn: string;
};

const side = (s: Side): LinkSide => {
  const l = 'linkable' in s ? s : { linkable: s };
  return { ...l.linkable, isList: !!l.isList, field: l.field, alias: l.alias ?? l.linkable.entity };
};

/**
 * As Medusa's defineLink. Two kinds:
 * - `defineLink(MemberModule.linkable.member, { linkable: TripModule.linkable.trip, isList: true })`:
 *   a link table, managed with the `link` service;
 * - `defineLink({ linkable: MissionModule.linkable.mission, field: "requester_id" }, { linkable: MemberModule.linkable.member, alias: "requester" }, { readOnly: true })`:
 *   the id is already a column of the left model, Query follows it.
 */
export function defineLink(left: Side, right: Side, options: { readOnly?: boolean; table?: string } = {}): LinkDefinition {
  const l = side(left);
  const r = side(right);
  if (options.readOnly && !l.field) throw new Error(`Lien en lecture seule ${l.entity} → ${r.entity} : "field" manquant`);
  const leftColumn = `${toSnakeCase(l.entity)}_id`;
  const rightColumn = `${toSnakeCase(r.entity)}_id`;
  return {
    left: l,
    right: r,
    readOnly: !!options.readOnly,
    table: options.table ?? `${l.serviceName}_${toSnakeCase(l.entity)}_${r.serviceName}_${toSnakeCase(r.entity)}`,
    leftColumn,
    rightColumn: rightColumn === leftColumn ? `${rightColumn}_2` : rightColumn,
  };
}

export async function loadLinks(dir: string): Promise<LinkDefinition[]> {
  if (!fs.existsSync(dir)) return [];
  const out: LinkDefinition[] = [];
  for (const f of fs.readdirSync(dir).filter((f) => /\.(ts|js)$/.test(f))) {
    const mod = await import(pathToFileURL(path.join(dir, f)).href);
    if (mod.default?.left) out.push(mod.default as LinkDefinition);
  }
  return out;
}

/** db:migrate creates the link tables, as Medusa's db:sync-links. */
export async function syncLinkTables(db: Db, links: LinkDefinition[], logger: Logger) {
  for (const l of links.filter((l) => !l.readOnly)) {
    await db.raw(
      `create table if not exists "${l.table}" ("id" text not null primary key, "${l.leftColumn}" text not null, "${l.rightColumn}" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null)`
    );
    await db.raw(`create unique index if not exists "IDX_${l.table}_pair" on "${l.table}" ("${l.leftColumn}", "${l.rightColumn}") where deleted_at is null`);
    await db.raw(`create index if not exists "IDX_${l.table}_right" on "${l.table}" ("${l.rightColumn}") where deleted_at is null`);
    logger.info(`lien ${l.table} prêt`);
  }
}

type LinkInput = Record<string, Record<string, string>>;

/** As Medusa's Link: `link.create({ member: { member_id }, trip: { trip_id } })`. */
export class LinkService {
  constructor(
    private readonly db: Db,
    private readonly links: LinkDefinition[]
  ) {}

  private find(input: LinkInput): { def: LinkDefinition; leftId: string; rightId: string } {
    const keys = Object.keys(input);
    for (const def of this.links.filter((l) => !l.readOnly)) {
      const [a, b] = [def.left.serviceName, def.right.serviceName];
      if (!(keys.includes(a) && keys.includes(b) && keys.length === 2)) continue;
      const leftId = input[a]?.[`${toSnakeCase(def.left.entity)}_id`];
      const rightId = input[b]?.[`${toSnakeCase(def.right.entity)}_id`];
      if (leftId && rightId) return { def, leftId, rightId };
    }
    throw new TraikuError(TraikuError.Types.INVALID_DATA, `Aucun lien défini entre ${keys.join(' et ')}`);
  }

  async create(input: LinkInput | LinkInput[], ctx?: Context) {
    const conn = ctx?.transactionManager ?? this.db;
    for (const i of Array.isArray(input) ? input : [input]) {
      const { def, leftId, rightId } = this.find(i);
      const pair = { [def.leftColumn]: leftId, [def.rightColumn]: rightId };
      const exists = await conn(def.table).where(pair).whereNull('deleted_at').first();
      if (!exists) await conn(def.table).insert({ id: generateEntityId('link'), ...pair });
    }
  }

  async dismiss(input: LinkInput | LinkInput[], ctx?: Context) {
    const conn = ctx?.transactionManager ?? this.db;
    for (const i of Array.isArray(input) ? input : [input]) {
      const { def, leftId, rightId } = this.find(i);
      await conn(def.table)
        .where({ [def.leftColumn]: leftId, [def.rightColumn]: rightId })
        .delete();
    }
  }
}

type Relation =
  | { kind: 'module'; repo: Repository; via: 'belongsTo' | 'hasMany'; foreignKey: string }
  | { kind: 'readOnly'; repo: Repository; direction: 'forward' | 'backward'; field: string; isList: boolean }
  | { kind: 'table'; repo: Repository; def: LinkDefinition; fromLeft: boolean; isList: boolean };

export type GraphArgs = {
  entity: string;
  fields: string[];
  filters?: Record<string, unknown>;
  pagination?: { take?: number; skip?: number; order?: Record<string, 'ASC' | 'DESC'> };
  withDeleted?: boolean;
};

/**
 * As Medusa's Query: reads one model and follows its relations, inside the module or across links,
 * without the modules knowing each other.
 * `query.graph({ entity: "mission", fields: ["id", "title", "requester.first_name", "runs.*"], filters: { status: "open" } })`
 */
export class Query {
  private readonly byEntity = new Map<string, Repository>();

  constructor(
    private readonly db: Db,
    modules: LoadedModule[],
    private readonly links: LinkDefinition[]
  ) {
    for (const m of modules) for (const e of m.entities) this.byEntity.set(e.name, new Repository(e, db));
  }

  private repoOf(entity: string): Repository {
    const r = this.byEntity.get(entity);
    if (!r) throw new TraikuError(TraikuError.Types.INVALID_DATA, `Modèle inconnu pour Query : ${entity}`);
    return r;
  }

  private relationOf(entity: string, alias: string): Relation {
    const repo = this.repoOf(entity);
    const own = repo.meta.relations[alias];
    if (own) return { kind: 'module', repo: this.repoOf(own.target().name), via: own.kind, foreignKey: own.foreignKey };
    for (const def of this.links) {
      const { left, right } = def;
      if (left.entity === entity && (right.isList ? pluralize(right.alias) : right.alias) === alias) {
        return def.readOnly
          ? { kind: 'readOnly', repo: this.repoOf(right.entity), direction: 'forward', field: left.field!, isList: false }
          : { kind: 'table', repo: this.repoOf(right.entity), def, fromLeft: true, isList: right.isList };
      }
      if (right.entity === entity && !def.readOnly && (left.isList ? pluralize(left.alias) : left.alias) === alias) {
        return { kind: 'table', repo: this.repoOf(left.entity), def, fromLeft: false, isList: left.isList };
      }
    }
    throw new TraikuError(TraikuError.Types.INVALID_DATA, `Relation inconnue pour ${entity} : ${alias}`);
  }

  async graph<T = Record<string, unknown>>(args: GraphArgs): Promise<{ data: T[]; metadata: { count: number; take?: number; skip?: number } }> {
    const repo = this.repoOf(args.entity);
    const { own, nested } = split(args.fields);
    const config = { select: selectFor(repo, own, nested, args.entity, this), take: args.pagination?.take, skip: args.pagination?.skip, order: args.pagination?.order, withDeleted: args.withDeleted };
    const [rows, count] = await Promise.all([repo.list(args.filters, config), args.pagination?.take !== undefined ? repo.count(args.filters, { withDeleted: args.withDeleted }) : Promise.resolve(-1)]);
    await this.expand(args.entity, rows, nested);
    trim(rows, own, repo);
    return { data: rows as T[], metadata: { count: count < 0 ? rows.length : count, take: args.pagination?.take, skip: args.pagination?.skip } };
  }

  /** The fields a relation needs on the parent row (its foreign key). */
  needs(entity: string, alias: string): string[] {
    const r = this.relationOf(entity, alias);
    if (r.kind === 'module' && r.via === 'belongsTo') return [r.foreignKey];
    if (r.kind === 'readOnly') return [r.field];
    return [];
  }

  private async expand(entity: string, rows: Record<string, unknown>[], nested: Map<string, string[]>) {
    for (const [alias, fields] of nested) {
      const rel = this.relationOf(entity, alias);
      const target = rel.repo;
      const pk = target.meta.primaryKey;
      const { own, nested: deeper } = split(fields);
      const parentPk = this.repoOf(entity).meta.primaryKey;
      let children: Record<string, unknown>[] = [];
      let assign: (row: Record<string, unknown>) => unknown;

      const listTarget = async (filters: Record<string, unknown>, extra: string[] = []) => {
        const select = selectFor(target, own, deeper, target.entity.name, this);
        return target.list(filters, { select: select ? [...new Set([...select, ...extra])] : undefined, order: { created_at: 'ASC' } });
      };

      if (rel.kind === 'module' && rel.via === 'belongsTo') {
        const ids = uniq(rows.map((r) => r[rel.foreignKey]));
        children = ids.length ? await listTarget({ [pk]: ids }) : [];
        assign = (r) => children.find((c) => c[pk] === r[rel.foreignKey]) ?? null;
      } else if (rel.kind === 'module') {
        const ids = uniq(rows.map((r) => r[parentPk]));
        children = ids.length ? await listTarget({ [rel.foreignKey]: ids }, [rel.foreignKey]) : [];
        assign = (r) => children.filter((c) => c[rel.foreignKey] === r[parentPk]);
      } else if (rel.kind === 'readOnly') {
        const ids = uniq(rows.map((r) => r[rel.field]));
        children = ids.length ? await listTarget({ [pk]: ids }) : [];
        assign = (r) => children.find((c) => c[pk] === r[rel.field]) ?? null;
      } else {
        const [from, to] = rel.fromLeft ? [rel.def.leftColumn, rel.def.rightColumn] : [rel.def.rightColumn, rel.def.leftColumn];
        const ids = uniq(rows.map((r) => r[parentPk]));
        const pairs = ids.length ? ((await this.db(rel.def.table).whereIn(from, ids).whereNull('deleted_at').select(from, to)) as Record<string, string>[]) : [];
        const targetIds = uniq(pairs.map((p) => p[to]));
        children = targetIds.length ? await listTarget({ [pk]: targetIds }) : [];
        assign = (r) => {
          const mine = pairs.filter((p) => p[from] === r[parentPk]).map((p) => children.find((c) => c[pk] === p[to])).filter(Boolean);
          return rel.isList ? mine : (mine[0] ?? null);
        };
      }

      await this.expand(target.entity.name, children, deeper);
      for (const r of rows) r[alias] = assign(r);
      trim(children, own, target);
    }
  }
}

const uniq = (values: unknown[]) => [...new Set(values.filter((v) => v !== null && v !== undefined))] as string[];

function split(fields: string[]) {
  const own: string[] = [];
  const nested = new Map<string, string[]>();
  for (const f of fields.length ? fields : ['*']) {
    const [head, ...rest] = f.split('.');
    if (!rest.length) own.push(head);
    else nested.set(head, [...(nested.get(head) ?? []), rest.join('.')]);
  }
  return { own, nested };
}

function selectFor(repo: Repository, own: string[], nested: Map<string, string[]>, entity: string, query: Query): string[] | undefined {
  if (!own.length || own.includes('*')) return undefined;
  const extra = [...nested.keys()].flatMap((alias) => query.needs(entity, alias));
  return [...new Set([...own, repo.meta.primaryKey, ...extra])];
}

/** Drops the keys only fetched to follow a relation, so rows have exactly the fields asked. */
function trim(rows: Record<string, unknown>[], own: string[], repo: Repository) {
  if (!own.length || own.includes('*')) return;
  const keep = new Set(own);
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (!keep.has(k) && repo.meta.columns.has(k)) delete r[k];
    }
  }
}
