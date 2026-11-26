import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("alter table if exists \"mission\" add column if not exists \"pickup_floor\" integer;");
    await db.raw("alter table if exists \"mission\" add column if not exists \"pickup_elevator\" boolean;");
  },

  async down(db) {
    await db.raw("alter table if exists \"mission\" drop column if exists \"pickup_elevator\";");
    await db.raw("alter table if exists \"mission\" drop column if exists \"pickup_floor\";");
  },
} satisfies Migration;
