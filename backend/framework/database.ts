import knex from 'knex';
import type { Knex } from 'knex';
import pg from 'pg';

// numeric (money) and bigint (counts) come back as numbers, not strings.
pg.types.setTypeParser(1700, (v) => parseFloat(v));
pg.types.setTypeParser(20, (v) => parseInt(v, 10));

export type Db = Knex;
export type Transaction = Knex.Transaction;

export function createDb(url: string, logging = false): Db {
  return knex({ client: 'pg', connection: url, pool: { min: 0, max: 10 }, debug: logging });
}
