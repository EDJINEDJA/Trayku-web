import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("alter table if exists \"mission\" add column if not exists \"traikeur_rate\" double precision not null default 0;");
  },

  async down(db) {
    await db.raw("alter table if exists \"mission\" drop column if exists \"traikeur_rate\";");
  },
} satisfies Migration;
