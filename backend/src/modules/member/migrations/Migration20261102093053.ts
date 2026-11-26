import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("create table if not exists \"member\" (\"id\" text not null, \"phone\" text not null, \"email\" text, \"first_name\" text not null, \"last_name\" text, \"civility\" text constraint \"member_civility_check\" check (\"civility\" in ('mme', 'm')), \"avatar_color\" text not null default '#7C3AED', \"bio\" text, \"vehicle\" text constraint \"member_vehicle_check\" check (\"vehicle\" in ('car', 'bike', 'foot', 'transit', 'plane')), \"professions\" text[] not null default '{}'::text[], \"verified_phone\" boolean not null default false, \"verified_id\" boolean not null default false, \"verifier\" jsonb, \"rating_avg\" double precision not null default 0, \"rating_count\" integer not null default 0, \"missions_done\" integer not null default 0, \"withdrawals\" jsonb not null default '[]'::jsonb, \"status\" text not null default 'active' constraint \"member_status_check\" check (\"status\" in ('active', 'suspended')), \"suspended_until\" timestamptz, \"metadata\" jsonb, \"created_at\" timestamptz not null default now(), \"updated_at\" timestamptz not null default now(), \"deleted_at\" timestamptz, constraint \"member_pkey\" primary key (\"id\"));");
    await db.raw("create unique index if not exists \"IDX_member_phone_unique\" on \"member\" (\"phone\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_member_deleted_at\" on \"member\" (\"deleted_at\") where deleted_at IS NOT NULL;");
  },

  async down(db) {
    await db.raw("drop table if exists \"member\" cascade;");
  },
} satisfies Migration;
