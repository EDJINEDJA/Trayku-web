import { BelongsTo, DmlEntity, HasMany, Property, type PropertyKind, type Schema } from './index';

/** What a table looks like, as stored in a module's migrations/.snapshot.json and compared by db:generate. */
export type ColumnSnapshot = {
  type: string;
  nullable: boolean;
  /** SQL expression. */
  default?: string;
  primary?: boolean;
  enum?: string[];
  references?: { table: string; column: string; onDelete: 'cascade' | 'set null' };
};

export type IndexSnapshot = { columns: string[]; unique: boolean; where?: string };

export type TableSnapshot = {
  columns: Record<string, ColumnSnapshot>;
  indexes: Record<string, IndexSnapshot>;
};

export type DatabaseSnapshot = Record<string, TableSnapshot>;

const SQL_TYPE: Record<PropertyKind, string> = {
  id: 'text',
  text: 'text',
  number: 'integer',
  float: 'double precision',
  bigNumber: 'numeric',
  boolean: 'boolean',
  dateTime: 'timestamptz',
  json: 'jsonb',
  enum: 'text',
  array: 'text[]',
};

export const quote = (s: string) => `'${s.replace(/'/g, "''")}'`;

function literal(p: Property<any>): string | undefined {
  const v = p.config.default;
  if (v === undefined) return undefined;
  if (v === null) return 'null';
  switch (p.kind) {
    case 'json':
      return `${quote(JSON.stringify(v))}::jsonb`;
    case 'array':
      return `${quote(`{${(v as string[]).map((s) => `"${s.replace(/"/g, '\\"')}"`).join(',')}}`)}::text[]`;
    case 'boolean':
      return v ? 'true' : 'false';
    case 'number':
    case 'float':
    case 'bigNumber':
      return String(v);
    case 'dateTime':
      return v instanceof Date ? quote(v.toISOString()) : quote(String(v));
    default:
      return quote(String(v));
  }
}

/** The relation's column: "mission" → "mission_id". */
export const foreignKeyOf = (relation: string) => `${relation}_id`;

export function entityToTable(entity: DmlEntity<string, Schema>): TableSnapshot {
  const table = entity.tableName;
  const columns: Record<string, ColumnSnapshot> = {};
  const indexes: Record<string, IndexSnapshot> = {};
  const live = 'deleted_at IS NULL';

  for (const [name, value] of Object.entries(entity.schema)) {
    if (value instanceof Property) {
      const c = value.config;
      columns[name] = {
        type: SQL_TYPE[value.kind],
        nullable: !!c.nullable && !c.primaryKey,
        ...(literal(value) !== undefined && { default: literal(value) }),
        ...(c.primaryKey && { primary: true }),
        ...(value.kind === 'enum' && { enum: [...(c.values ?? [])] }),
      };
      if (c.unique) indexes[`IDX_${table}_${name}_unique`] = { columns: [name], unique: true, where: live };
      else if (c.index) indexes[`IDX_${table}_${name}`] = { columns: [name], unique: false, where: live };
    } else if (value instanceof BelongsTo) {
      const fk = foreignKeyOf(name);
      const target = value.target();
      columns[fk] = {
        type: 'text',
        nullable: !!value.options.nullable,
        references: { table: target.tableName, column: target.primaryKey(), onDelete: value.options.nullable ? 'set null' : 'cascade' },
      };
      indexes[`IDX_${table}_${fk}`] = { columns: [fk], unique: false, where: live };
    } else if (!(value instanceof HasMany)) {
      throw new Error(`${entity.name}.${name} : propriété inconnue`);
    }
  }

  columns.created_at = { type: 'timestamptz', nullable: false, default: 'now()' };
  columns.updated_at = { type: 'timestamptz', nullable: false, default: 'now()' };
  columns.deleted_at = { type: 'timestamptz', nullable: true };
  indexes[`IDX_${table}_deleted_at`] = { columns: ['deleted_at'], unique: false, where: 'deleted_at IS NOT NULL' };

  for (const idx of entity.getIndexes()) {
    const name = idx.name ?? `IDX_${table}_${idx.on.join('_')}${idx.unique ? '_unique' : ''}`;
    indexes[name] = { columns: idx.on, unique: !!idx.unique, where: idx.where ?? live };
  }

  return { columns, indexes };
}

export function entitiesToSnapshot(entities: DmlEntity<string, Schema>[]): DatabaseSnapshot {
  const out: DatabaseSnapshot = {};
  for (const e of entities) out[e.tableName] = entityToTable(e);
  return out;
}

/** Column metadata the services need at runtime. */
export type EntityMeta = {
  table: string;
  primaryKey: string;
  prefix?: string;
  columns: Set<string>;
  json: Set<string>;
  relations: Record<string, { kind: 'belongsTo' | 'hasMany'; target: () => DmlEntity<string, Schema>; foreignKey: string }>;
};

const metaCache = new WeakMap<object, EntityMeta>();

export function metaOf(entity: DmlEntity<string, Schema>): EntityMeta {
  const cached = metaCache.get(entity);
  if (cached) return cached;
  const columns = new Set<string>(['created_at', 'updated_at', 'deleted_at']);
  const json = new Set<string>();
  const relations: EntityMeta['relations'] = {};
  for (const [name, value] of Object.entries(entity.schema)) {
    if (value instanceof Property) {
      columns.add(name);
      if (value.kind === 'json') json.add(name);
    } else if (value instanceof BelongsTo) {
      columns.add(foreignKeyOf(name));
      relations[name] = { kind: 'belongsTo', target: value.target, foreignKey: foreignKeyOf(name) };
    } else if (value instanceof HasMany) {
      relations[name] = { kind: 'hasMany', target: value.target, foreignKey: foreignKeyOf(value.options.mappedBy ?? entity.name) };
    }
  }
  const meta: EntityMeta = { table: entity.tableName, primaryKey: entity.primaryKey(), prefix: entity.idPrefix(), columns, json, relations };
  metaCache.set(entity, meta);
  return meta;
}
