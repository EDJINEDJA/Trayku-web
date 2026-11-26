import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("alter table if exists \"member\" add column if not exists \"country\" text;");
  },

  async down(db) {
    await db.raw("alter table if exists \"member\" drop column if exists \"country\";");
  },
} satisfies Migration;
