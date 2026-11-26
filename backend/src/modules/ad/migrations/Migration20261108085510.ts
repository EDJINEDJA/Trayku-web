import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("create table if not exists \"ad\" (\"id\" text not null, \"placement\" text not null default 'messages' constraint \"ad_placement_check\" check (\"placement\" in ('messages')), \"sponsor\" text not null, \"title\" text not null, \"image_file_id\" text not null, \"url\" text not null, \"starts_at\" timestamptz, \"ends_at\" timestamptz, \"active\" boolean not null default true, \"views\" integer not null default 0, \"clicks\" integer not null default 0, \"reports\" integer not null default 0, \"created_at\" timestamptz not null default now(), \"updated_at\" timestamptz not null default now(), \"deleted_at\" timestamptz, constraint \"ad_pkey\" primary key (\"id\"));");
    await db.raw("create index if not exists \"IDX_ad_deleted_at\" on \"ad\" (\"deleted_at\") where deleted_at IS NOT NULL;");
    await db.raw("create table if not exists \"ad_report\" (\"id\" text not null, \"ad_id\" text not null, \"member_id\" text, \"created_at\" timestamptz not null default now(), \"updated_at\" timestamptz not null default now(), \"deleted_at\" timestamptz, constraint \"ad_report_pkey\" primary key (\"id\"));");
    await db.raw("create index if not exists \"IDX_ad_report_ad_id\" on \"ad_report\" (\"ad_id\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_ad_report_deleted_at\" on \"ad_report\" (\"deleted_at\") where deleted_at IS NOT NULL;");
  },

  async down(db) {
    await db.raw("drop table if exists \"ad_report\" cascade;");
    await db.raw("drop table if exists \"ad\" cascade;");
  },
} satisfies Migration;
