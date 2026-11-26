import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Db } from '../database';
import { entitiesToSnapshot, type DatabaseSnapshot } from '../dml/schema';
import type { DmlEntity, Schema } from '../dml';
import type { Logger } from '../logger';
import { diffSnapshots } from './diff';

/** A migration file: `export default { up, down } satisfies Migration`. */
export type Migration = {
  up: (db: Db) => Promise<void>;
  down: (db: Db) => Promise<void>;
};

export type MigratableModule = { key: string; dir: string; entities: DmlEntity<string, Schema>[] };

const TABLE = 'traiku_migrations';
const SNAPSHOT = '.snapshot.json';
const FILE = /^Migration\d{14}\.ts$/;

const migrationsDir = (m: MigratableModule) => path.join(m.dir, 'migrations');

function readSnapshot(m: MigratableModule): DatabaseSnapshot {
  const file = path.join(migrationsDir(m), SNAPSHOT);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
}

const stamp = (d = new Date()) => d.toISOString().replace(/\D/g, '').slice(0, 14);

/** db:generate: compares the models to the last snapshot and writes the migration for the difference. */
export function generateMigration(m: MigratableModule, logger: Logger): string | null {
  const prev = readSnapshot(m);
  const next = entitiesToSnapshot(m.entities);
  const { up, down } = diffSnapshots(prev, next);
  if (!up.length) {
    logger.info(`${m.key} : aucun changement`);
    return null;
  }
  const dir = migrationsDir(m);
  fs.mkdirSync(dir, { recursive: true });
  const name = `Migration${stamp()}`;
  const lines = (sql: string[]) => sql.map((s) => `    await db.raw(${JSON.stringify(s)});`).join('\n');
  const content = `import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
${lines(up)}
  },

  async down(db) {
${lines(down)}
  },
} satisfies Migration;
`;
  fs.writeFileSync(path.join(dir, `${name}.ts`), content);
  fs.writeFileSync(path.join(dir, SNAPSHOT), JSON.stringify(next, null, 2) + '\n');
  logger.info(`${m.key} : ${name}.ts créée (${up.length} instructions)`);
  return name;
}

async function ensureTable(db: Db) {
  await db.raw(`create table if not exists "${TABLE}" ("id" serial primary key, "module" text not null, "name" text not null, "executed_at" timestamptz not null default now(), unique ("module", "name"))`);
}

const filesOf = (m: MigratableModule) => {
  const dir = migrationsDir(m);
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => FILE.test(f)).sort() : [];
};

async function load(m: MigratableModule, file: string): Promise<Migration> {
  const mod = await import(pathToFileURL(path.join(migrationsDir(m), file)).href);
  return mod.default as Migration;
}

/** db:migrate: runs, in order and each in its transaction, the migrations not run yet. */
export async function runMigrations(db: Db, modules: MigratableModule[], logger: Logger) {
  await ensureTable(db);
  for (const m of modules) {
    const done = new Set((await db(TABLE).where({ module: m.key }).select('name')).map((r: { name: string }) => r.name));
    for (const file of filesOf(m)) {
      const name = file.replace(/\.ts$/, '');
      if (done.has(name)) continue;
      const migration = await load(m, file);
      await db.transaction(async (trx) => {
        await migration.up(trx);
        await trx(TABLE).insert({ module: m.key, name });
      });
      logger.info(`${m.key} : ${name} exécutée`);
    }
  }
}

/** db:rollback: undoes the last migration of a module. */
export async function rollbackMigration(db: Db, m: MigratableModule, logger: Logger) {
  await ensureTable(db);
  const last = await db(TABLE).where({ module: m.key }).orderBy('id', 'desc').first();
  if (!last) return logger.info(`${m.key} : rien à annuler`);
  const migration = await load(m, `${last.name}.ts`);
  await db.transaction(async (trx) => {
    await migration.down(trx);
    await trx(TABLE).where({ id: last.id }).delete();
  });
  logger.info(`${m.key} : ${last.name} annulée`);
}
