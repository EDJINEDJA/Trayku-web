import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("alter table if exists \"trip\" drop constraint if exists \"trip_max_size_check\";");
    await db.raw("alter table if exists \"trip\" add constraint \"trip_max_size_check\" check (\"max_size\" in ('S', 'M', 'L', 'XL', 'XXL'));");
  },

  async down(db) {
    await db.raw("alter table if exists \"trip\" drop constraint if exists \"trip_max_size_check\";");
    await db.raw("alter table if exists \"trip\" add constraint \"trip_max_size_check\" check (\"max_size\" in ('S', 'M', 'L', 'XL'));");
  },
} satisfies Migration;
