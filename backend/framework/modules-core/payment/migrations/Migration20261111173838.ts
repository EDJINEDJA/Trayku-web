import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("create table if not exists \"payment\" (\"id\" text not null, \"resource_id\" text not null, \"payer_id\" text, \"provider_id\" text not null, \"mode\" text not null constraint \"payment_mode_check\" check (\"mode\" in ('test', 'live')), \"amount\" numeric not null, \"currency_code\" text not null, \"status\" text not null default 'pending' constraint \"payment_status_check\" check (\"status\" in ('pending', 'authorized', 'captured', 'canceled', 'error')), \"captured_amount\" numeric not null default 0, \"refunded_amount\" numeric not null default 0, \"data\" jsonb not null default '{}'::jsonb, \"error\" text, \"authorized_at\" timestamptz, \"captured_at\" timestamptz, \"canceled_at\" timestamptz, \"created_at\" timestamptz not null default now(), \"updated_at\" timestamptz not null default now(), \"deleted_at\" timestamptz, constraint \"payment_pkey\" primary key (\"id\"));");
    await db.raw("create index if not exists \"IDX_payment_resource_id\" on \"payment\" (\"resource_id\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_payment_status\" on \"payment\" (\"status\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_payment_deleted_at\" on \"payment\" (\"deleted_at\") where deleted_at IS NOT NULL;");
  },

  async down(db) {
    await db.raw("drop table if exists \"payment\" cascade;");
  },
} satisfies Migration;
