import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("create table if not exists \"api_key\" (\"id\" text not null, \"token\" text not null, \"redacted\" text not null, \"title\" text not null, \"type\" text not null constraint \"api_key_type_check\" check (\"type\" in ('publishable', 'secret')), \"last_used_at\" timestamptz, \"created_by\" text not null, \"revoked_by\" text, \"revoked_at\" timestamptz, \"created_at\" timestamptz not null default now(), \"updated_at\" timestamptz not null default now(), \"deleted_at\" timestamptz, constraint \"api_key_pkey\" primary key (\"id\"));");
    await db.raw("create unique index if not exists \"IDX_api_key_token_unique\" on \"api_key\" (\"token\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_api_key_type\" on \"api_key\" (\"type\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_api_key_deleted_at\" on \"api_key\" (\"deleted_at\") where deleted_at IS NOT NULL;");
  },

  async down(db) {
    await db.raw("drop table if exists \"api_key\" cascade;");
  },
} satisfies Migration;
