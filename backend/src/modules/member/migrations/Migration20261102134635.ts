import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("alter table if exists \"member\" add column if not exists \"birth_date\" text;");
  },

  async down(db) {
    await db.raw("alter table if exists \"member\" drop column if exists \"birth_date\";");
  },
} satisfies Migration;
