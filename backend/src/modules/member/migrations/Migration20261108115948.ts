import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("alter table if exists \"credential\" add column if not exists \"kind\" text not null default 'trade' constraint \"credential_kind_check\" check (\"kind\" in ('trade', 'licence'));");
  },

  async down(db) {
    await db.raw("alter table if exists \"credential\" drop column if exists \"kind\";");
  },
} satisfies Migration;
