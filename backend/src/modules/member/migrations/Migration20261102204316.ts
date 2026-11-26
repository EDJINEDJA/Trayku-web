import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("alter table if exists \"identity_check\" add column if not exists \"pose_file_ids\" jsonb not null default '{}'::jsonb;");
  },

  async down(db) {
    await db.raw("alter table if exists \"identity_check\" drop column if exists \"pose_file_ids\";");
  },
} satisfies Migration;
