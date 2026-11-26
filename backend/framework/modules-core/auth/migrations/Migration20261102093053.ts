import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("create table if not exists \"auth_identity\" (\"id\" text not null, \"app_metadata\" jsonb, \"created_at\" timestamptz not null default now(), \"updated_at\" timestamptz not null default now(), \"deleted_at\" timestamptz, constraint \"auth_identity_pkey\" primary key (\"id\"));");
    await db.raw("create index if not exists \"IDX_auth_identity_deleted_at\" on \"auth_identity\" (\"deleted_at\") where deleted_at IS NOT NULL;");
    await db.raw("create table if not exists \"provider_identity\" (\"id\" text not null, \"entity_id\" text not null, \"provider\" text not null, \"auth_identity_id\" text not null, \"provider_metadata\" jsonb, \"created_at\" timestamptz not null default now(), \"updated_at\" timestamptz not null default now(), \"deleted_at\" timestamptz, constraint \"provider_identity_pkey\" primary key (\"id\"));");
    await db.raw("create index if not exists \"IDX_provider_identity_auth_identity_id\" on \"provider_identity\" (\"auth_identity_id\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_provider_identity_deleted_at\" on \"provider_identity\" (\"deleted_at\") where deleted_at IS NOT NULL;");
    await db.raw("create unique index if not exists \"IDX_provider_identity_entity_id_provider_unique\" on \"provider_identity\" (\"entity_id\", \"provider\") where deleted_at IS NULL;");
    await db.raw("create table if not exists \"otp_code\" (\"id\" text not null, \"phone\" text not null, \"code_hash\" text not null, \"expires_at\" timestamptz not null, \"attempts\" integer not null default 0, \"consumed_at\" timestamptz, \"created_at\" timestamptz not null default now(), \"updated_at\" timestamptz not null default now(), \"deleted_at\" timestamptz, constraint \"otp_code_pkey\" primary key (\"id\"));");
    await db.raw("create index if not exists \"IDX_otp_code_phone\" on \"otp_code\" (\"phone\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_otp_code_deleted_at\" on \"otp_code\" (\"deleted_at\") where deleted_at IS NOT NULL;");
    await db.raw("alter table \"provider_identity\" add constraint \"provider_identity_auth_identity_id_foreign\" foreign key (\"auth_identity_id\") references \"auth_identity\" (\"id\") on update cascade on delete cascade;");
  },

  async down(db) {
    await db.raw("drop table if exists \"otp_code\" cascade;");
    await db.raw("drop table if exists \"provider_identity\" cascade;");
    await db.raw("drop table if exists \"auth_identity\" cascade;");
  },
} satisfies Migration;
