import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("alter table if exists \"member\" add column if not exists \"tax_info\" jsonb;");
  },

  async down(db) {
    await db.raw("alter table if exists \"member\" drop column if exists \"tax_info\";");
  },
} satisfies Migration;
