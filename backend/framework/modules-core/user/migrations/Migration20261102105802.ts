import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("create table if not exists \"user_action\" (\"id\" text not null, \"actor_id\" text not null, \"actor_type\" text not null, \"method\" text not null, \"path\" text not null, \"status\" integer not null, \"ip\" text, \"created_at\" timestamptz not null default now(), \"updated_at\" timestamptz not null default now(), \"deleted_at\" timestamptz, constraint \"user_action_pkey\" primary key (\"id\"));");
    await db.raw("create index if not exists \"IDX_user_action_actor_id\" on \"user_action\" (\"actor_id\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_user_action_deleted_at\" on \"user_action\" (\"deleted_at\") where deleted_at IS NOT NULL;");
  },

  async down(db) {
    await db.raw("drop table if exists \"user_action\" cascade;");
  },
} satisfies Migration;
