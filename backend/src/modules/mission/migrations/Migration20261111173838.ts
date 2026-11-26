import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("alter table if exists \"mission\" drop constraint if exists \"mission_status_check\";");
    await db.raw("alter table if exists \"mission\" add constraint \"mission_status_check\" check (\"status\" in ('awaiting_payment', 'review', 'open', 'accepted', 'picked_up', 'delivered', 'cancelled'));");
  },

  async down(db) {
    await db.raw("alter table if exists \"mission\" drop constraint if exists \"mission_status_check\";");
    await db.raw("alter table if exists \"mission\" add constraint \"mission_status_check\" check (\"status\" in ('review', 'open', 'accepted', 'picked_up', 'delivered', 'cancelled'));");
  },
} satisfies Migration;
