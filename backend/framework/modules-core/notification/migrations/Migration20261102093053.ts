import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("create table if not exists \"notification\" (\"id\" text not null, \"to\" text not null, \"channel\" text not null, \"template\" text not null, \"data\" jsonb, \"provider_id\" text not null, \"status\" text not null default 'pending' constraint \"notification_status_check\" check (\"status\" in ('pending', 'success', 'failure')), \"external_id\" text, \"error\" text, \"created_at\" timestamptz not null default now(), \"updated_at\" timestamptz not null default now(), \"deleted_at\" timestamptz, constraint \"notification_pkey\" primary key (\"id\"));");
    await db.raw("create index if not exists \"IDX_notification_to\" on \"notification\" (\"to\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_notification_deleted_at\" on \"notification\" (\"deleted_at\") where deleted_at IS NOT NULL;");
  },

  async down(db) {
    await db.raw("drop table if exists \"notification\" cascade;");
  },
} satisfies Migration;
