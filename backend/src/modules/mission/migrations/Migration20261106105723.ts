import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("alter table if exists \"mission\" add column if not exists \"recipient_email\" text;");
  },

  async down(db) {
    await db.raw("alter table if exists \"mission\" drop column if exists \"recipient_email\";");
  },
} satisfies Migration;
