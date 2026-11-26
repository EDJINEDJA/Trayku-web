import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("alter table if exists \"mission\" drop constraint if exists \"mission_size_check\";");
    await db.raw("alter table if exists \"mission\" add constraint \"mission_size_check\" check (\"size\" in ('S', 'M', 'L', 'XL', 'XXL'));");
  },

  async down(db) {
    await db.raw("alter table if exists \"mission\" drop constraint if exists \"mission_size_check\";");
    await db.raw("alter table if exists \"mission\" add constraint \"mission_size_check\" check (\"size\" in ('S', 'M', 'L', 'XL'));");
  },
} satisfies Migration;
