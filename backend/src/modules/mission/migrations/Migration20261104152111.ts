import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("alter table if exists \"run\" add column if not exists \"extra_minutes\" integer not null default 0;");
    await db.raw("alter table if exists \"run\" add column if not exists \"extra_amount\" numeric not null default 0;");
    await db.raw("alter table if exists \"run\" add column if not exists \"extra_request\" jsonb;");
  },

  async down(db) {
    await db.raw("alter table if exists \"run\" drop column if exists \"extra_request\";");
    await db.raw("alter table if exists \"run\" drop column if exists \"extra_amount\";");
    await db.raw("alter table if exists \"run\" drop column if exists \"extra_minutes\";");
  },
} satisfies Migration;
