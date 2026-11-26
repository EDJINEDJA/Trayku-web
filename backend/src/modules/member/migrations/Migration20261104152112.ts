import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("alter table if exists \"member\" add column if not exists \"price_prefs\" jsonb;");
  },

  async down(db) {
    await db.raw("alter table if exists \"member\" drop column if exists \"price_prefs\";");
  },
} satisfies Migration;
