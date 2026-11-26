import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("alter table if exists \"member\" add column if not exists \"professions_answered_at\" timestamptz;");
    await db.raw("alter table if exists \"member\" add column if not exists \"zone\" jsonb;");
    await db.raw("create table if not exists \"identity_check\" (\"id\" text not null, \"member_id\" text not null, \"document_type\" text not null, \"front_file_id\" text not null, \"back_file_id\" text, \"selfie_file_id\" text not null, \"status\" text not null default 'pending' constraint \"identity_check_status_check\" check (\"status\" in ('pending', 'verified', 'refused', 'replaced')), \"reason\" text, \"provider\" text not null default 'manual', \"provider_ref\" text, \"reviewed_by\" text, \"reviewed_at\" timestamptz, \"consent_at\" timestamptz not null, \"created_at\" timestamptz not null default now(), \"updated_at\" timestamptz not null default now(), \"deleted_at\" timestamptz, constraint \"identity_check_pkey\" primary key (\"id\"));");
    await db.raw("create index if not exists \"IDX_identity_check_member_id\" on \"identity_check\" (\"member_id\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_identity_check_status\" on \"identity_check\" (\"status\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_identity_check_deleted_at\" on \"identity_check\" (\"deleted_at\") where deleted_at IS NOT NULL;");
    await db.raw("create table if not exists \"credential\" (\"id\" text not null, \"member_id\" text not null, \"profession\" text not null, \"title\" text, \"file_ids\" jsonb not null, \"status\" text not null default 'pending' constraint \"credential_status_check\" check (\"status\" in ('pending', 'approved', 'refused')), \"reason\" text, \"reviewed_by\" text, \"reviewed_at\" timestamptz, \"created_at\" timestamptz not null default now(), \"updated_at\" timestamptz not null default now(), \"deleted_at\" timestamptz, constraint \"credential_pkey\" primary key (\"id\"));");
    await db.raw("create index if not exists \"IDX_credential_member_id\" on \"credential\" (\"member_id\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_credential_status\" on \"credential\" (\"status\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_credential_deleted_at\" on \"credential\" (\"deleted_at\") where deleted_at IS NOT NULL;");
  },

  async down(db) {
    await db.raw("drop table if exists \"credential\" cascade;");
    await db.raw("drop table if exists \"identity_check\" cascade;");
    await db.raw("alter table if exists \"member\" drop column if exists \"zone\";");
    await db.raw("alter table if exists \"member\" drop column if exists \"professions_answered_at\";");
  },
} satisfies Migration;
