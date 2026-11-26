import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("create table if not exists \"review\" (\"id\" text not null, \"mission_id\" text not null, \"author_id\" text not null, \"target_id\" text not null, \"role\" text not null constraint \"review_role_check\" check (\"role\" in ('traveler', 'requester')), \"rating\" integer not null, \"comment\" text, \"created_at\" timestamptz not null default now(), \"updated_at\" timestamptz not null default now(), \"deleted_at\" timestamptz, constraint \"review_pkey\" primary key (\"id\"));");
    await db.raw("create index if not exists \"IDX_review_mission_id\" on \"review\" (\"mission_id\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_review_target_id\" on \"review\" (\"target_id\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_review_deleted_at\" on \"review\" (\"deleted_at\") where deleted_at IS NOT NULL;");
    await db.raw("create unique index if not exists \"IDX_review_mission_id_author_id_unique\" on \"review\" (\"mission_id\", \"author_id\") where deleted_at IS NULL;");
  },

  async down(db) {
    await db.raw("drop table if exists \"review\" cascade;");
  },
} satisfies Migration;
