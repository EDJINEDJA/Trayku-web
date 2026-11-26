import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw('alter table if exists "mission" add column if not exists "obd_diagnostic" boolean not null default false;');
  },

  async down(db) {
    await db.raw('alter table if exists "mission" drop column if exists "obd_diagnostic";');
  },
} satisfies Migration;
