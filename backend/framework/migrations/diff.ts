import { quote, type ColumnSnapshot, type DatabaseSnapshot, type IndexSnapshot, type TableSnapshot } from '../dml/schema';

const id = (s: string) => `"${s.replace(/"/g, '""')}"`;
const checkName = (table: string, column: string) => `${table}_${column}_check`;
const fkName = (table: string, column: string) => `${table}_${column}_foreign`;

function columnSql(table: string, name: string, c: ColumnSnapshot): string {
  let sql = `${id(name)} ${c.type}`;
  if (!c.nullable) sql += ' not null';
  if (c.default !== undefined) sql += ` default ${c.default}`;
  if (c.enum) sql += ` constraint ${id(checkName(table, name))} check (${id(name)} in (${c.enum.map(quote).join(', ')}))`;
  return sql;
}

function indexSql(table: string, name: string, i: IndexSnapshot): string {
  return `create ${i.unique ? 'unique ' : ''}index if not exists ${id(name)} on ${id(table)} (${i.columns.map(id).join(', ')})${i.where ? ` where ${i.where}` : ''};`;
}

function fkSql(table: string, name: string, c: ColumnSnapshot): string {
  const r = c.references!;
  return `alter table ${id(table)} add constraint ${id(fkName(table, name))} foreign key (${id(name)}) references ${id(r.table)} (${id(r.column)}) on update cascade on delete ${r.onDelete};`;
}

function createTable(table: string, t: TableSnapshot): { create: string[]; foreign: string[] } {
  const cols = Object.entries(t.columns).map(([n, c]) => columnSql(table, n, c));
  const pk = Object.entries(t.columns)
    .filter(([, c]) => c.primary)
    .map(([n]) => id(n));
  if (pk.length) cols.push(`constraint ${id(`${table}_pkey`)} primary key (${pk.join(', ')})`);
  return {
    create: [`create table if not exists ${id(table)} (${cols.join(', ')});`, ...Object.entries(t.indexes).map(([n, i]) => indexSql(table, n, i))],
    foreign: Object.entries(t.columns)
      .filter(([, c]) => c.references)
      .map(([n, c]) => fkSql(table, n, c)),
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The SQL that takes the database from `prev` to `next`, and back. */
export function diffSnapshots(prev: DatabaseSnapshot, next: DatabaseSnapshot): { up: string[]; down: string[] } {
  const up: string[] = [];
  const upForeign: string[] = [];
  const down: string[] = [];
  const downForeign: string[] = [];

  for (const [table, t] of Object.entries(next)) {
    const before = prev[table];
    if (!before) {
      const { create, foreign } = createTable(table, t);
      up.push(...create);
      upForeign.push(...foreign);
      down.push(`drop table if exists ${id(table)} cascade;`);
      continue;
    }

    for (const [name, c] of Object.entries(t.columns)) {
      const old = before.columns[name];
      if (!old) {
        up.push(`alter table if exists ${id(table)} add column if not exists ${columnSql(table, name, c)};`);
        if (c.references) upForeign.push(fkSql(table, name, c));
        down.push(`alter table if exists ${id(table)} drop column if exists ${id(name)};`);
        continue;
      }
      alterColumn(table, name, old, c, up, upForeign);
      // down is reversed at the end: the statements of one column keep their own order.
      const back: string[] = [];
      alterColumn(table, name, c, old, back, downForeign);
      down.push(...back.reverse());
    }
    for (const [name, old] of Object.entries(before.columns)) {
      if (t.columns[name]) continue;
      up.push(`alter table if exists ${id(table)} drop column if exists ${id(name)};`);
      down.push(`alter table if exists ${id(table)} add column if not exists ${columnSql(table, name, { ...old, nullable: true })};`);
    }

    for (const [name, i] of Object.entries(t.indexes)) {
      const old = before.indexes[name];
      if (old && same(old, i)) continue;
      if (old) up.push(`drop index if exists ${id(name)};`);
      up.push(indexSql(table, name, i));
      down.push(`drop index if exists ${id(name)};`);
      if (old) down.push(indexSql(table, name, old));
    }
    for (const [name, old] of Object.entries(before.indexes)) {
      if (t.indexes[name]) continue;
      up.push(`drop index if exists ${id(name)};`);
      down.push(indexSql(table, name, old));
    }
  }

  for (const [table, t] of Object.entries(prev)) {
    if (next[table]) continue;
    up.push(`drop table if exists ${id(table)} cascade;`);
    const { create, foreign } = createTable(table, t);
    down.push(...create);
    downForeign.push(...foreign);
  }

  // Foreign keys last, once every table exists; on the way down, tables are dropped first (cascade).
  return { up: [...up, ...upForeign], down: [...down.reverse(), ...downForeign] };
}

function alterColumn(table: string, name: string, from: ColumnSnapshot, to: ColumnSnapshot, out: string[], foreign: string[]) {
  const t = id(table);
  const c = id(name);
  if (from.type !== to.type) out.push(`alter table if exists ${t} alter column ${c} type ${to.type} using ${c}::${to.type};`);
  if (from.nullable !== to.nullable) out.push(`alter table if exists ${t} alter column ${c} ${to.nullable ? 'drop' : 'set'} not null;`);
  if (from.default !== to.default) out.push(to.default === undefined ? `alter table if exists ${t} alter column ${c} drop default;` : `alter table if exists ${t} alter column ${c} set default ${to.default};`);
  if (!same(from.enum, to.enum)) {
    if (from.enum) out.push(`alter table if exists ${t} drop constraint if exists ${id(checkName(table, name))};`);
    if (to.enum) out.push(`alter table if exists ${t} add constraint ${id(checkName(table, name))} check (${c} in (${to.enum.map(quote).join(', ')}));`);
  }
  if (!same(from.references, to.references)) {
    if (from.references) out.push(`alter table if exists ${t} drop constraint if exists ${id(fkName(table, name))};`);
    if (to.references) foreign.push(fkSql(table, name, to));
  }
}
