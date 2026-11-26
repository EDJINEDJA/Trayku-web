import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("create table if not exists \"conversation\" (\"id\" text not null, \"mission_id\" text not null, \"member_a\" text not null, \"member_b\" text not null, \"blocked_by\" text, \"reported_at\" timestamptz, \"reported_by\" text, \"created_at\" timestamptz not null default now(), \"updated_at\" timestamptz not null default now(), \"deleted_at\" timestamptz, constraint \"conversation_pkey\" primary key (\"id\"));");
    await db.raw("create index if not exists \"IDX_conversation_mission_id\" on \"conversation\" (\"mission_id\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_conversation_member_a\" on \"conversation\" (\"member_a\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_conversation_member_b\" on \"conversation\" (\"member_b\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_conversation_deleted_at\" on \"conversation\" (\"deleted_at\") where deleted_at IS NOT NULL;");
    await db.raw("create unique index if not exists \"IDX_conversation_mission_id_member_b_unique\" on \"conversation\" (\"mission_id\", \"member_b\") where deleted_at IS NULL;");
    await db.raw("create table if not exists \"message\" (\"id\" text not null, \"conversation_id\" text not null, \"sender_id\" text, \"kind\" text not null default 'text' constraint \"message_kind_check\" check (\"kind\" in ('text', 'photo', 'system')), \"body\" text not null default '', \"file_id\" text, \"read_at\" timestamptz, \"created_at\" timestamptz not null default now(), \"updated_at\" timestamptz not null default now(), \"deleted_at\" timestamptz, constraint \"message_pkey\" primary key (\"id\"));");
    await db.raw("create index if not exists \"IDX_message_conversation_id\" on \"message\" (\"conversation_id\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_message_deleted_at\" on \"message\" (\"deleted_at\") where deleted_at IS NOT NULL;");
    await db.raw("alter table \"message\" add constraint \"message_conversation_id_foreign\" foreign key (\"conversation_id\") references \"conversation\" (\"id\") on update cascade on delete cascade;");
  },

  async down(db) {
    await db.raw("drop table if exists \"message\" cascade;");
    await db.raw("drop table if exists \"conversation\" cascade;");
  },
} satisfies Migration;
