import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("create table if not exists \"region\" (\"id\" text not null, \"name\" text not null, \"currency_code\" text not null, \"metadata\" jsonb, \"created_at\" timestamptz not null default now(), \"updated_at\" timestamptz not null default now(), \"deleted_at\" timestamptz, constraint \"region_pkey\" primary key (\"id\"));");
    await db.raw("create index if not exists \"IDX_region_deleted_at\" on \"region\" (\"deleted_at\") where deleted_at IS NOT NULL;");
    await db.raw("create table if not exists \"country\" (\"iso_2\" text not null, \"name\" text not null, \"display_name\" text not null, \"dial\" text, \"region_id\" text, \"created_at\" timestamptz not null default now(), \"updated_at\" timestamptz not null default now(), \"deleted_at\" timestamptz, constraint \"country_pkey\" primary key (\"iso_2\"));");
    await db.raw("create index if not exists \"IDX_country_region_id\" on \"country\" (\"region_id\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_country_deleted_at\" on \"country\" (\"deleted_at\") where deleted_at IS NOT NULL;");
    await db.raw("alter table \"country\" add constraint \"country_region_id_foreign\" foreign key (\"region_id\") references \"region\" (\"id\") on update cascade on delete set null;");
  },

  async down(db) {
    await db.raw("drop table if exists \"country\" cascade;");
    await db.raw("drop table if exists \"region\" cascade;");
  },
} satisfies Migration;
