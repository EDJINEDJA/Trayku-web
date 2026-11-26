import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("alter table if exists \"mission\" add column if not exists \"region\" text not null default 'eur';");
    await db.raw("alter table if exists \"mission\" add column if not exists \"currency_code\" text not null default 'EUR';");
  },

  async down(db) {
    await db.raw("alter table if exists \"mission\" drop column if exists \"currency_code\";");
    await db.raw("alter table if exists \"mission\" drop column if exists \"region\";");
  },
} satisfies Migration;
