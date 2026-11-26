import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("alter table if exists \"mission\" add column if not exists \"service_fee\" numeric not null default 0;");
    await db.raw("alter table if exists \"mission\" add column if not exists \"insurance_fee\" numeric not null default 0;");
  },

  async down(db) {
    await db.raw("alter table if exists \"mission\" drop column if exists \"insurance_fee\";");
    await db.raw("alter table if exists \"mission\" drop column if exists \"service_fee\";");
  },
} satisfies Migration;
