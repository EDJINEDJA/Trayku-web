import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("alter table if exists \"mission\" add column if not exists \"crew\" integer not null default 1;");
    await db.raw("alter table if exists \"mission\" add column if not exists \"seats_taken\" integer not null default 0;");
    // The missions already taken: their place counted, so a withdrawal opens them again.
    await db.raw("update \"mission\" m set \"seats_taken\" = (select count(*) from \"run\" r where r.\"mission_id\" = m.\"id\" and r.\"status\" <> 'cancelled' and r.\"deleted_at\" is null);");
  },

  async down(db) {
    await db.raw("alter table if exists \"mission\" drop column if exists \"seats_taken\";");
    await db.raw("alter table if exists \"mission\" drop column if exists \"crew\";");
  },
} satisfies Migration;
