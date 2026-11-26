import os from 'node:os';
import { TraikuService } from '../../modules';
import { ulid } from '../../utils';
import WorkflowExecution from './models/workflow-execution';

/** This server, for the executions it runs. */
export const OWNER = `${os.hostname()}:${process.pid}:${ulid().slice(-6)}`;

const SECRET_KEYS = /code|password|token|secret/i;

/** The input as stored: no code, password or token in clear. */
function mask(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(mask);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, SECRET_KEYS.test(k) ? '***' : mask(v)]));
  }
  return value;
}

/** JSON-safe: what can't be stored (a function, a cycle) is dropped rather than failing the workflow. */
function storable(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch {
    return null;
  }
}

export type StepRecord = { id: string; name: string; compensate_input: unknown };

export default class WorkflowEngineModuleService extends TraikuService({ WorkflowExecution }) {
  async begin(input: { workflow_id: string; transaction_id: string; parent_transaction_id?: string | null; input: unknown }) {
    await this.createWorkflowExecutions({ ...input, input: storable(mask(input.input)) as Record<string, unknown>, state: 'running', owner: OWNER, steps: [] });
  }

  async stepDone(transactionId: string, steps: StepRecord[]) {
    await this.updateWorkflowExecutions({ selector: { transaction_id: transactionId }, data: { steps: steps.map((s) => ({ ...s, compensate_input: storable(s.compensate_input) })) } });
  }

  async end(transactionId: string, state: 'done' | 'compensating' | 'compensated' | 'failed', error?: string) {
    await this.updateWorkflowExecutions({
      selector: { transaction_id: transactionId },
      data: { state, error: error ?? null, ...(state !== 'compensating' && { finished_at: new Date() }) },
    });
  }

  /**
   * Takes the executions left "running" by a server that stopped (no update for `idleMs`), atomically:
   * of two servers recovering, one gets each.
   */
  async claimAbandoned(idleMs: number) {
    return this.updateWorkflowExecutions({
      selector: { state: 'running', parent_transaction_id: null, updated_at: { $lt: new Date(Date.now() - idleMs) } },
      data: { state: 'compensating', owner: OWNER },
    });
  }

  /** Done executions are kept `days` days, failed ones stay for the team to read. */
  async purge(days: number) {
    const old = await this.listWorkflowExecutions({ state: ['done', 'compensated'], finished_at: { $lt: new Date(Date.now() - days * 86400000) } }, { select: ['id'], take: 5000 });
    await this.deleteWorkflowExecutions(old.map((e) => e.id));
    return old.length;
  }
}
