import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw('alter table if exists "member" add column if not exists "obd_reader" boolean not null default false;');
  },

  async down(db) {
    await db.raw('alter table if exists "member" drop column if exists "obd_reader";');
  },
} satisfies Migration;
