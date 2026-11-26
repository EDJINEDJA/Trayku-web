import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("create unique index if not exists \"IDX_review_mission_id_author_id_target_id_unique\" on \"review\" (\"mission_id\", \"author_id\", \"target_id\") where deleted_at IS NULL;");
    await db.raw("drop index if exists \"IDX_review_mission_id_author_id_unique\";");
  },

  async down(db) {
    await db.raw("create unique index if not exists \"IDX_review_mission_id_author_id_unique\" on \"review\" (\"mission_id\", \"author_id\") where deleted_at IS NULL;");
    await db.raw("drop index if exists \"IDX_review_mission_id_author_id_target_id_unique\";");
  },
} satisfies Migration;
