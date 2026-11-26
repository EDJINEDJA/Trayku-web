import type { Migration } from '@traiku/framework/migrations';

export default {
  async up(db) {
    await db.raw("create table if not exists \"workflow_execution\" (\"id\" text not null, \"workflow_id\" text not null, \"transaction_id\" text not null, \"parent_transaction_id\" text, \"state\" text not null constraint \"workflow_execution_state_check\" check (\"state\" in ('running', 'done', 'compensating', 'compensated', 'failed')), \"input\" jsonb, \"steps\" jsonb not null default '[]'::jsonb, \"error\" text, \"owner\" text not null, \"finished_at\" timestamptz, \"created_at\" timestamptz not null default now(), \"updated_at\" timestamptz not null default now(), \"deleted_at\" timestamptz, constraint \"workflow_execution_pkey\" primary key (\"id\"));");
    await db.raw("create index if not exists \"IDX_workflow_execution_workflow_id\" on \"workflow_execution\" (\"workflow_id\") where deleted_at IS NULL;");
    await db.raw("create unique index if not exists \"IDX_workflow_execution_transaction_id_unique\" on \"workflow_execution\" (\"transaction_id\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_workflow_execution_parent_transaction_id\" on \"workflow_execution\" (\"parent_transaction_id\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_workflow_execution_state\" on \"workflow_execution\" (\"state\") where deleted_at IS NULL;");
    await db.raw("create index if not exists \"IDX_workflow_execution_deleted_at\" on \"workflow_execution\" (\"deleted_at\") where deleted_at IS NOT NULL;");
  },

  async down(db) {
    await db.raw("drop table if exists \"workflow_execution\" cascade;");
  },
} satisfies Migration;
