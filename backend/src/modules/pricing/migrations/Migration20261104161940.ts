import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("create table if not exists \"price_scale\" (\"id\" text not null, \"region_id\" text not null, \"data\" jsonb not null, \"updated_by\" text, \"note\" text, \"created_at\" timestamptz not null default now(), \"updated_at\" timestamptz not null default now(), \"deleted_at\" timestamptz, constraint \"price_scale_pkey\" primary key (\"id\"));");
    await db.raw("create index if not exists \"IDX_price_scale_region_id\" on \"price_scale\" (\"region_id\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_price_scale_deleted_at\" on \"price_scale\" (\"deleted_at\") where deleted_at IS NOT NULL;");
  },

  async down(db) {
    await db.raw("drop table if exists \"price_scale\" cascade;");
  },
} satisfies Migration;
