import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("alter table if exists \"mission\" add column if not exists \"region_id\" text;");
    await db.raw("alter table if exists \"mission\" drop column if exists \"region\";");
  },

  async down(db) {
    await db.raw("alter table if exists \"mission\" add column if not exists \"region\" text default 'eur';");
    await db.raw("alter table if exists \"mission\" drop column if exists \"region_id\";");
  },
} satisfies Migration;
