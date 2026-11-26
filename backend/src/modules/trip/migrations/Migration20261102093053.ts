import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("create table if not exists \"trip\" (\"id\" text not null, \"member_id\" text not null, \"origin\" jsonb not null, \"destination\" jsonb not null, \"stops\" jsonb not null default '[]'::jsonb, \"route\" jsonb not null, \"depart_at\" timestamptz not null, \"flex_minutes\" integer not null default 15, \"round_trip\" boolean not null default false, \"recurring_days\" jsonb not null default '[]'::jsonb, \"vehicle\" text not null constraint \"trip_vehicle_check\" check (\"vehicle\" in ('car', 'bike', 'foot', 'transit', 'plane')), \"max_size\" text not null default 'M' constraint \"trip_max_size_check\" check (\"max_size\" in ('S', 'M', 'L', 'XL')), \"max_weight_kg\" double precision not null default 10, \"prefs\" jsonb not null, \"status\" text not null default 'active' constraint \"trip_status_check\" check (\"status\" in ('active', 'done', 'cancelled')), \"created_at\" timestamptz not null default now(), \"updated_at\" timestamptz not null default now(), \"deleted_at\" timestamptz, constraint \"trip_pkey\" primary key (\"id\"));");
    await db.raw("create index if not exists \"IDX_trip_member_id\" on \"trip\" (\"member_id\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_trip_depart_at\" on \"trip\" (\"depart_at\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_trip_status\" on \"trip\" (\"status\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_trip_deleted_at\" on \"trip\" (\"deleted_at\") where deleted_at IS NOT NULL;");
  },

  async down(db) {
    await db.raw("drop table if exists \"trip\" cascade;");
  },
} satisfies Migration;
