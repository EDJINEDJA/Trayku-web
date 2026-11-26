import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("create table if not exists \"brand\" (\"id\" text not null, \"name\" text not null, \"key\" text not null, \"kind\" text not null default 'other' constraint \"brand_kind_check\" check (\"kind\" in ('store', 'relay', 'drive', 'pressing', 'other')), \"uses\" integer not null default 0, \"listed\" boolean not null default false, \"created_at\" timestamptz not null default now(), \"updated_at\" timestamptz not null default now(), \"deleted_at\" timestamptz, constraint \"brand_pkey\" primary key (\"id\"));");
    await db.raw("create unique index if not exists \"IDX_brand_key_unique\" on \"brand\" (\"key\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_brand_deleted_at\" on \"brand\" (\"deleted_at\") where deleted_at IS NOT NULL;");
  },

  async down(db) {
    await db.raw("drop table if exists \"brand\" cascade;");
  },
} satisfies Migration;
