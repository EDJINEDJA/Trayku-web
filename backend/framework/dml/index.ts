/**
 * Data models, as Medusa's DML: `model.define("mission", { id: model.id({ prefix: "mis" }).primaryKey(), … })`.
 * Property names are the column names (snake_case). Each model gets created_at, updated_at and
 * deleted_at (soft delete). Types are inferred from the definition: see `InferEntity`.
 */

export type PropertyKind = 'id' | 'text' | 'number' | 'float' | 'bigNumber' | 'boolean' | 'dateTime' | 'json' | 'enum' | 'array';

export type PropertyConfig = {
  nullable?: boolean;
  default?: unknown;
  primaryKey?: boolean;
  unique?: boolean;
  index?: boolean;
  prefix?: string;
  values?: readonly string[];
};

export class Property<T> {
  declare readonly $type: T;
  readonly $kind = 'property' as const;

  constructor(
    readonly kind: PropertyKind,
    readonly config: PropertyConfig = {}
  ) {}

  nullable(): Property<T | null> {
    return new Property<T | null>(this.kind, { ...this.config, nullable: true });
  }

  default(value: T): Property<T> {
    return new Property<T>(this.kind, { ...this.config, default: value });
  }

  primaryKey(): Property<T> {
    return new Property<T>(this.kind, { ...this.config, primaryKey: true });
  }

  /** Unique among the rows not soft-deleted. */
  unique(): Property<T> {
    return new Property<T>(this.kind, { ...this.config, unique: true });
  }

  index(): Property<T> {
    return new Property<T>(this.kind, { ...this.config, index: true });
  }
}

type AnyEntity = DmlEntity<string, Schema>;
/** Annotate the thunk of one side of two models that point at each other: `model.hasMany((): AnyDmlEntity => Run)`. */
export type AnyDmlEntity = AnyEntity;

export class BelongsTo<Nullable extends boolean = false> {
  declare readonly $nullable: Nullable;
  readonly $kind = 'belongsTo' as const;

  constructor(
    readonly target: () => AnyEntity,
    readonly options: { mappedBy?: string; nullable?: boolean } = {}
  ) {}

  nullable(): BelongsTo<true> {
    return new BelongsTo<true>(this.target, { ...this.options, nullable: true });
  }
}

export class HasMany {
  readonly $kind = 'hasMany' as const;

  constructor(
    readonly target: () => AnyEntity,
    /** The belongsTo property on the target that points back here (default: this model's name). */
    readonly options: { mappedBy?: string } = {}
  ) {}
}

export type SchemaValue = Property<any> | BelongsTo<boolean> | HasMany;
export type Schema = Record<string, SchemaValue>;

export type EntityIndex = { on: string[]; unique?: boolean; where?: string; name?: string };

export class DmlEntity<Name extends string, S extends Schema> {
  readonly $kind = 'entity' as const;
  readonly tableName: string;
  private _indexes: EntityIndex[] = [];

  constructor(
    readonly name: Name,
    readonly schema: S,
    tableName?: string
  ) {
    this.tableName = tableName ?? name;
  }

  indexes(list: EntityIndex[]): this {
    this._indexes = list;
    return this;
  }

  getIndexes(): EntityIndex[] {
    return this._indexes;
  }

  primaryKey(): string {
    const pk = Object.entries(this.schema).find(([, v]) => v instanceof Property && v.config.primaryKey);
    return pk?.[0] ?? 'id';
  }

  /** The prefix of generated ids ("mis" → "mis_01J…"). */
  idPrefix(): string | undefined {
    const pk = this.schema[this.primaryKey()];
    return pk instanceof Property ? pk.config.prefix : undefined;
  }
}

export const model = {
  define<Name extends string, S extends Schema>(name: Name | { name: Name; tableName: string }, schema: S): DmlEntity<Name, S> {
    return typeof name === 'string' ? new DmlEntity(name, schema) : new DmlEntity(name.name, schema, name.tableName);
  },
  id: (options: { prefix?: string } = {}) => new Property<string>('id', { prefix: options.prefix }),
  text: () => new Property<string>('text'),
  /** Integer. */
  number: () => new Property<number>('number'),
  float: () => new Property<number>('float'),
  /** Exact decimal, for money (euros, two decimals). */
  bigNumber: () => new Property<number>('bigNumber'),
  boolean: () => new Property<boolean>('boolean'),
  dateTime: () => new Property<Date>('dateTime'),
  json: <T = Record<string, unknown>>() => new Property<T>('json'),
  enum: <const V extends readonly string[]>(values: V) => new Property<V[number]>('enum', { values }),
  /** A list of strings (text[]). */
  array: () => new Property<string[]>('array'),
  belongsTo: (target: () => AnyEntity, options: { mappedBy?: string } = {}) => new BelongsTo<false>(target, options),
  hasMany: (target: () => AnyEntity, options: { mappedBy?: string } = {}) => new HasMany(target, options),
};

type PropertyKeys<S> = { [K in keyof S]: S[K] extends { $kind: 'property' } ? K : never }[keyof S];
type BelongsToKeys<S> = { [K in keyof S]: S[K] extends BelongsTo<boolean> ? K : never }[keyof S] & string;
type HasManyKeys<S> = { [K in keyof S]: S[K] extends HasMany ? K : never }[keyof S] & string;

type Timestamps = { created_at: Date; updated_at: Date; deleted_at: Date | null };

/** The columns of a model: its properties, the `<relation>_id` of each belongsTo, and the timestamps. */
export type InferColumns<E> =
  E extends DmlEntity<string, infer S>
    ? { [K in PropertyKeys<S>]: S[K] extends { $type: infer T } ? T : never } & {
        [K in BelongsToKeys<S> as `${K}_id`]: S[K] extends BelongsTo<infer N> ? (N extends true ? string | null : string) : never;
      } & Timestamps
    : never;

/** A row as services return it: the columns, plus the relations when asked for. */
export type InferEntity<E> =
  E extends DmlEntity<string, infer S>
    ? InferColumns<E> & { [K in BelongsToKeys<S>]?: Record<string, unknown> } & { [K in HasManyKeys<S>]?: Record<string, unknown>[] }
    : never;

export type InferTypeOf<E> = InferEntity<E>;
