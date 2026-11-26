import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("create table if not exists \"user\" (\"id\" text not null, \"email\" text not null, \"first_name\" text, \"last_name\" text, \"metadata\" jsonb, \"created_at\" timestamptz not null default now(), \"updated_at\" timestamptz not null default now(), \"deleted_at\" timestamptz, constraint \"user_pkey\" primary key (\"id\"));");
    await db.raw("create unique index if not exists \"IDX_user_email_unique\" on \"user\" (\"email\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_user_deleted_at\" on \"user\" (\"deleted_at\") where deleted_at IS NOT NULL;");
  },

  async down(db) {
    await db.raw("drop table if exists \"user\" cascade;");
  },
} satisfies Migration;
