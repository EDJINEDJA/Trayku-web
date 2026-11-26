import { model } from '../../../dml';

/**
 * One run of a workflow, as Medusa's workflow_execution: written at the start, after each step and
 * at the end. If the server stops in the middle, the steps done are known and are undone at the
 * next start (see recover), instead of leaving a half-made change.
 */
const WorkflowExecution = model.define('workflow_execution', {
  id: model.id({ prefix: 'wfex' }).primaryKey(),
  workflow_id: model.text().index(),
  transaction_id: model.text().unique(),
  /** The workflow this one runs inside (runAsStep), if any. */
  parent_transaction_id: model.text().nullable().index(),
  state: model.enum(['running', 'done', 'compensating', 'compensated', 'failed']).index(),
  /** The input, codes and passwords masked. */
  input: model.json().nullable(),
  /** The steps done, in order, with what their compensation needs. */
  steps: model.json<{ id: string; name: string; compensate_input: unknown }[]>().default([]),
  error: model.text().nullable(),
  /** The server running it; another one only recovers it once this one stopped updating it. */
  owner: model.text(),
  finished_at: model.dateTime().nullable(),
});

export default WorkflowExecution;
