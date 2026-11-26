import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("create table if not exists \"payout_account\" (\"id\" text not null, \"member_id\" text not null, \"provider_id\" text not null, \"external_id\" text, \"status\" text not null default 'pending' constraint \"payout_account_status_check\" check (\"status\" in ('pending', 'active', 'restricted')), \"bank_last4\" text, \"holder\" text, \"hold\" boolean not null default false, \"hold_reason\" text, \"data\" jsonb not null default '{}'::jsonb, \"created_at\" timestamptz not null default now(), \"updated_at\" timestamptz not null default now(), \"deleted_at\" timestamptz, constraint \"payout_account_pkey\" primary key (\"id\"));");
    await db.raw("create unique index if not exists \"IDX_payout_account_member_id_unique\" on \"payout_account\" (\"member_id\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_payout_account_status\" on \"payout_account\" (\"status\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_payout_account_deleted_at\" on \"payout_account\" (\"deleted_at\") where deleted_at IS NOT NULL;");
    await db.raw("create table if not exists \"earning\" (\"id\" text not null, \"member_id\" text not null, \"mission_id\" text not null, \"run_id\" text, \"kind\" text not null constraint \"earning_kind_check\" check (\"kind\" in ('mission', 'verify_only', 'cancellation', 'no_show')), \"amount\" numeric not null, \"currency_code\" text not null, \"status\" text not null default 'pending' constraint \"earning_status_check\" check (\"status\" in ('pending', 'available', 'paid', 'canceled')), \"available_at\" timestamptz not null, \"payout_id\" text, \"created_at\" timestamptz not null default now(), \"updated_at\" timestamptz not null default now(), \"deleted_at\" timestamptz, constraint \"earning_pkey\" primary key (\"id\"));");
    await db.raw("create index if not exists \"IDX_earning_member_id\" on \"earning\" (\"member_id\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_earning_mission_id\" on \"earning\" (\"mission_id\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_earning_status\" on \"earning\" (\"status\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_earning_payout_id\" on \"earning\" (\"payout_id\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_earning_deleted_at\" on \"earning\" (\"deleted_at\") where deleted_at IS NOT NULL;");
    await db.raw("create unique index if not exists \"IDX_earning_mission_id_member_id_kind_unique\" on \"earning\" (\"mission_id\", \"member_id\", \"kind\") where deleted_at IS NULL;");
    await db.raw("create table if not exists \"payout\" (\"id\" text not null, \"member_id\" text not null, \"account_id\" text not null, \"provider_id\" text not null, \"amount\" numeric not null, \"currency_code\" text not null, \"status\" text not null default 'pending' constraint \"payout_status_check\" check (\"status\" in ('pending', 'paid', 'failed', 'canceled')), \"external_id\" text, \"error\" text, \"created_by\" text, \"paid_at\" timestamptz, \"failed_at\" timestamptz, \"created_at\" timestamptz not null default now(), \"updated_at\" timestamptz not null default now(), \"deleted_at\" timestamptz, constraint \"payout_pkey\" primary key (\"id\"));");
    await db.raw("create index if not exists \"IDX_payout_member_id\" on \"payout\" (\"member_id\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_payout_status\" on \"payout\" (\"status\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_payout_deleted_at\" on \"payout\" (\"deleted_at\") where deleted_at IS NOT NULL;");
  },

  async down(db) {
    await db.raw("drop table if exists \"payout\" cascade;");
    await db.raw("drop table if exists \"earning\" cascade;");
    await db.raw("drop table if exists \"payout_account\" cascade;");
  },
} satisfies Migration;
