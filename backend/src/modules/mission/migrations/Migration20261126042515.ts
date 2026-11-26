import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("alter table if exists \"mission\" add column if not exists \"road_path\" jsonb;");
  },

  async down(db) {
    await db.raw("alter table if exists \"mission\" drop column if exists \"road_path\";");
  },
} satisfies Migration;
