import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("create table if not exists \"file\" (\"id\" text not null, \"key\" text not null, \"filename\" text not null, \"mime_type\" text not null, \"size\" integer not null, \"owner_id\" text, \"visibility\" text not null default 'private' constraint \"file_visibility_check\" check (\"visibility\" in ('private', 'public')), \"created_at\" timestamptz not null default now(), \"updated_at\" timestamptz not null default now(), \"deleted_at\" timestamptz, constraint \"file_pkey\" primary key (\"id\"));");
    await db.raw("create unique index if not exists \"IDX_file_key_unique\" on \"file\" (\"key\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_file_owner_id\" on \"file\" (\"owner_id\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_file_deleted_at\" on \"file\" (\"deleted_at\") where deleted_at IS NOT NULL;");
  },

  async down(db) {
    await db.raw("drop table if exists \"file\" cascade;");
  },
} satisfies Migration;
