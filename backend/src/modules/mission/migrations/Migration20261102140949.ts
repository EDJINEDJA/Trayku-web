import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("alter table if exists \"mission\" drop constraint if exists \"mission_type_check\";");
    await db.raw("alter table if exists \"mission\" add constraint \"mission_type_check\" check (\"type\" in ('parcel', 'pickup', 'errand', 'handover', 'bulky', 'check', 'task', 'pro'));");
  },

  async down(db) {
    await db.raw("alter table if exists \"mission\" drop constraint if exists \"mission_type_check\";");
    await db.raw("alter table if exists \"mission\" add constraint \"mission_type_check\" check (\"type\" in ('parcel', 'pickup', 'handover', 'bulky', 'check', 'task', 'pro'));");
  },
} satisfies Migration;
