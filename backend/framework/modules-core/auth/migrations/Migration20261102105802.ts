import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("alter table if exists \"auth_identity\" add column if not exists \"tokens_revoked_at\" timestamptz;");
  },

  async down(db) {
    await db.raw("alter table if exists \"auth_identity\" drop column if exists \"tokens_revoked_at\";");
  },
} satisfies Migration;
