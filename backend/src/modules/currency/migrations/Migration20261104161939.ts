import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("create table if not exists \"currency\" (\"code\" text not null, \"name\" text not null, \"symbol\" text not null, \"symbol_native\" text not null, \"decimal_digits\" integer not null, \"rounding\" double precision not null default 0, \"created_at\" timestamptz not null default now(), \"updated_at\" timestamptz not null default now(), \"deleted_at\" timestamptz, constraint \"currency_pkey\" primary key (\"code\"));");
    await db.raw("create index if not exists \"IDX_currency_deleted_at\" on \"currency\" (\"deleted_at\") where deleted_at IS NOT NULL;");
  },

  async down(db) {
    await db.raw("drop table if exists \"currency\" cascade;");
  },
} satisfies Migration;
