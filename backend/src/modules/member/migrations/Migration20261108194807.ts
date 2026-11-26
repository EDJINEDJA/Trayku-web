import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("alter table if exists \"member\" add column if not exists \"saved_places\" jsonb not null default '[]'::jsonb;");
    await db.raw("alter table if exists \"member\" add column if not exists \"deletion_requested_at\" timestamptz;");
    await db.raw("create table if not exists \"support_request\" (\"id\" text not null, \"member_id\" text not null, \"topic\" text not null default 'other' constraint \"support_request_topic_check\" check (\"topic\" in ('mission', 'payment', 'account', 'safety', 'other')), \"message\" text not null, \"status\" text not null default 'open' constraint \"support_request_status_check\" check (\"status\" in ('open', 'answered', 'closed')), \"answer\" text, \"answered_by\" text, \"answered_at\" timestamptz, \"created_at\" timestamptz not null default now(), \"updated_at\" timestamptz not null default now(), \"deleted_at\" timestamptz, constraint \"support_request_pkey\" primary key (\"id\"));");
    await db.raw("create index if not exists \"IDX_support_request_member_id\" on \"support_request\" (\"member_id\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_support_request_status\" on \"support_request\" (\"status\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_support_request_deleted_at\" on \"support_request\" (\"deleted_at\") where deleted_at IS NOT NULL;");
  },

  async down(db) {
    await db.raw("drop table if exists \"support_request\" cascade;");
    await db.raw("alter table if exists \"member\" drop column if exists \"deletion_requested_at\";");
    await db.raw("alter table if exists \"member\" drop column if exists \"saved_places\";");
  },
} satisfies Migration;
