import type { AwilixContainer } from 'awilix';
import type { EventBus, EventMessage } from '../events';
import type { Logger } from '../logger';
import type { WorkflowEngineModuleService } from '../modules-core/workflow-engine';
import type { StepRecord } from '../modules-core/workflow-engine/service';
import { ContainerRegistrationKeys, Modules, ulid } from '../utils';

/**
 * Workflows, as Medusa's workflows SDK. The function given to createWorkflow runs once, at load: it
 * doesn't get values but references to them, and only records the steps in order. The values exist
 * when the workflow runs. So, inside it: no `if`, no `await`, no computing on values; use transform()
 * and when(). If a step fails, the steps already done are undone (compensated) in reverse order.
 */

const REF = Symbol('traiku.workflow.ref');
type RefMeta = { source: string; path: PropertyKey[] };

function makeRef(source: string, path: PropertyKey[] = []): unknown {
  const meta: RefMeta = { source, path };
  return new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === REF) return meta;
        if (typeof prop === 'symbol' || prop === 'then' || prop === 'toJSON') return undefined;
        return makeRef(source, [...path, prop]);
      },
    }
  );
}

const refOf = (v: unknown): RefMeta | undefined => (v !== null && typeof v === 'object' ? ((v as Record<symbol, RefMeta>)[REF] ?? undefined) : undefined);

type State = Record<string, unknown>;

function resolve(value: unknown, state: State): unknown {
  const ref = refOf(value);
  if (ref) {
    let cur = state[ref.source];
    for (const p of ref.path) cur = cur == null ? undefined : (cur as Record<PropertyKey, unknown>)[p];
    return cur;
  }
  if (Array.isArray(value)) return value.map((v) => resolve(v, state));
  if (value !== null && typeof value === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v, state)]));
  }
  return value;
}

export type StepExecutionContext = {
  container: AwilixContainer;
  /** The run: its id, and the events kept until the workflow succeeds. */
  context: { transactionId: string; workflowId: string; eventGroup: EventMessage[]; children: string[] };
};

/** What a step returns: its output, and what its compensation needs (by default, the output). */
export class StepResponse<O, C = O> {
  readonly output: O;
  readonly compensateInput: C;
  constructor(output: O, ...compensateInput: [] | [C]) {
    this.output = output;
    this.compensateInput = (compensateInput.length ? compensateInput[0] : output) as C;
  }
}

/** What a workflow returns. */
export class WorkflowResponse<O> {
  constructor(readonly result: O) {}
}

type Invoke<I, O, C> = (input: I, ctx: StepExecutionContext) => Promise<StepResponse<O, C> | O> | StepResponse<O, C> | O;
type Compensate<C> = (input: C, ctx: StepExecutionContext) => Promise<void> | void;

type StepDefinition = {
  name: string;
  invoke: Invoke<unknown, unknown, unknown>;
  compensate?: Compensate<unknown>;
  maxRetries: number;
};

type Condition = { values: unknown; predicate: (v: never) => boolean };

type Node =
  | { kind: 'step'; id: string; step: StepDefinition; input: unknown; conditions: Condition[] }
  | { kind: 'transform'; id: string; values: unknown; fn: (v: never) => unknown; conditions: Condition[] };

class Composer {
  nodes: Node[] = [];
  conditions: Condition[] = [];
  private counts = new Map<string, number>();
  uniqueId(name: string) {
    const n = (this.counts.get(name) ?? 0) + 1;
    this.counts.set(name, n);
    return n === 1 ? name : `${name}-${n}`;
  }
}

let current: Composer | null = null;

function composer(what: string): Composer {
  if (!current) throw new Error(`${what} ne peut être appelé que dans createWorkflow`);
  return current;
}

export type StepFunction<I, O> = ((input: I) => O) & {
  stepName: string;
  config(c: { name?: string; maxRetries?: number }): StepFunction<I, O>;
};

/** `createStep("create-run", async (input, { container }) => new StepResponse(run, run.id), async (id, { container }) => {…})` */
export function createStep<I = void, O = void, C = O>(
  nameOrConfig: string | { name: string; maxRetries?: number },
  invoke: Invoke<I, O, C>,
  compensate?: Compensate<C>
): StepFunction<I, O> {
  const base = typeof nameOrConfig === 'string' ? { name: nameOrConfig } : nameOrConfig;
  const build = (def: StepDefinition): StepFunction<I, O> => {
    const fn = ((input: I) => {
      const c = composer(`L’étape ${def.name}`);
      const id = c.uniqueId(def.name);
      c.nodes.push({ kind: 'step', id, step: def, input, conditions: [...c.conditions] });
      return makeRef(id) as O;
    }) as StepFunction<I, O>;
    fn.stepName = def.name;
    fn.config = (o) => build({ ...def, name: o.name ?? def.name, maxRetries: o.maxRetries ?? def.maxRetries });
    return fn;
  };
  return build({ name: base.name, invoke: invoke as Invoke<unknown, unknown, unknown>, compensate: compensate as Compensate<unknown> | undefined, maxRetries: base.maxRetries ?? 0 });
}

/** Computes a value from others when the workflow runs: `transform({ mission }, ({ mission }) => mission.price * 0.8)`. */
export function transform<V, R>(values: V, fn: (v: V) => R | Promise<R>): R {
  const c = composer('transform');
  const id = c.uniqueId('transform');
  c.nodes.push({ kind: 'transform', id, values, fn: fn as (v: never) => unknown, conditions: [...c.conditions] });
  return makeRef(id) as R;
}

/** Runs the steps of `then` only when the predicate holds: `when({ mission }, ({ mission }) => !!mission.handler_phone).then(() => {…})`. */
export function when<V>(values: V, predicate: (v: V) => boolean) {
  return {
    then<R>(fn: () => R): R | undefined {
      const c = composer('when');
      c.conditions.push({ values, predicate: predicate as (v: never) => boolean });
      try {
        return fn();
      } finally {
        c.conditions.pop();
      }
    },
  };
}

type Definition = { name: string; nodes: Node[]; result: unknown };
type Execution = { result: unknown; compensate: () => Promise<void> };

/** Every workflow by name: to undo, after a restart, the steps of one that was interrupted. */
const registry = new Map<string, Definition>();
/** Sub-workflows (runAsStep) of the runs under way, undone in memory while the process lives. */
const live = new Map<string, Execution>();

const engineOf = (container: AwilixContainer) => (container.hasRegistration(Modules.WORKFLOW_ENGINE) ? container.resolve<WorkflowEngineModuleService>(Modules.WORKFLOW_ENGINE) : null);

async function execute(def: Definition, input: unknown, ctx: StepExecutionContext, transactionId: string, parentId: string | null): Promise<Execution> {
  const state: State = { input };
  const done: { step: StepDefinition; record: StepRecord; compensateInput: unknown }[] = [];
  const logger = ctx.container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const engine = engineOf(ctx.container);
  await engine?.begin({ workflow_id: def.name, transaction_id: transactionId, parent_transaction_id: parentId, input });

  const compensate = async () => {
    let failed = false;
    await engine?.end(transactionId, 'compensating');
    for (const d of [...done].reverse()) {
      if (!d.step.compensate) continue;
      try {
        await d.step.compensate(d.compensateInput, ctx);
      } catch (e) {
        failed = true;
        logger.error(`${def.name} : la compensation de ${d.step.name} a échoué : ${(e as Error).message}`);
      }
    }
    await engine?.end(transactionId, failed ? 'failed' : 'compensated', failed ? 'compensation incomplète' : undefined);
  };

  try {
    for (const node of def.nodes) {
      if (node.conditions.some((c) => !c.predicate(resolve(c.values, state) as never))) continue;
      if (node.kind === 'transform') {
        state[node.id] = await node.fn(resolve(node.values, state) as never);
        continue;
      }
      const stepInput = resolve(node.input, state);
      let attempt = 0;
      for (;;) {
        try {
          const res = await node.step.invoke(stepInput, ctx);
          const response = res instanceof StepResponse ? res : new StepResponse(res);
          state[node.id] = response.output;
          done.push({ step: node.step, compensateInput: response.compensateInput, record: { id: node.id, name: node.step.name, compensate_input: response.compensateInput } });
          // Written after each step: if the server stops now, this is what will be undone.
          if (node.step.compensate) await engine?.stepDone(transactionId, done.filter((d) => d.step.compensate).map((d) => d.record));
          break;
        } catch (e) {
          if (attempt++ >= node.step.maxRetries) throw e;
        }
      }
    }
    await engine?.end(transactionId, 'done');
    return { result: resolve(def.result, state), compensate };
  } catch (e) {
    await engine?.updateWorkflowExecutions({ selector: { transaction_id: transactionId }, data: { error: (e as Error).message?.slice(0, 1000) ?? 'erreur' } }).catch(() => {});
    await compensate();
    throw e;
  }
}

/**
 * Undoes, from what was written in the database, the steps of an execution interrupted by a
 * stopped server, then those of its sub-workflows still marked running.
 */
export async function compensateFromRecord(container: AwilixContainer, transactionId: string): Promise<void> {
  const engine = engineOf(container);
  if (!engine) return;
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const [record] = await engine.listWorkflowExecutions({ transaction_id: transactionId }, { take: 1 });
  if (!record) return;
  const def = registry.get(record.workflow_id);
  if (!def) {
    await engine.end(transactionId, 'failed', `workflow inconnu : ${record.workflow_id}`);
    return;
  }
  const ctx: StepExecutionContext = { container, context: { transactionId, workflowId: def.name, eventGroup: [], children: [] } };
  let failed = false;
  await engine.end(transactionId, 'compensating');
  for (const s of [...record.steps].reverse()) {
    const node = def.nodes.find((n) => n.kind === 'step' && n.id === s.id);
    const step = node?.kind === 'step' ? node.step : undefined;
    if (!step?.compensate) continue;
    try {
      await step.compensate(s.compensate_input, ctx);
    } catch (e) {
      failed = true;
      logger.error(`${def.name} (reprise) : la compensation de ${s.name} a échoué : ${(e as Error).message}`);
    }
  }
  const children = await engine.listWorkflowExecutions({ parent_transaction_id: transactionId, state: ['running', 'compensating'] }, { select: ['transaction_id'] });
  for (const c of children) await compensateFromRecord(container, c.transaction_id);
  await engine.end(transactionId, failed ? 'failed' : 'compensated', failed ? 'compensation incomplète (reprise)' : (record.error ?? 'serveur arrêté pendant le workflow'));
}

/** At start and every minute: the executions of a stopped server are undone; the old ones purged. */
export async function recoverWorkflows(container: AwilixContainer, { idleMs = 3 * 60_000 } = {}) {
  const engine = engineOf(container);
  if (!engine) return 0;
  const abandoned = await engine.claimAbandoned(idleMs);
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  for (const e of abandoned) {
    logger.warn(`workflow ${e.workflow_id} interrompu (${e.transaction_id}) : annulation des étapes faites`);
    await compensateFromRecord(container, e.transaction_id);
  }
  return abandoned.length;
}

export type WorkflowRunArgs<I> = { input: I; throwOnError?: boolean };
export type WorkflowRunResult<O> = { result: O; errors: Error[]; transactionId: string };

export type Workflow<I, O> = ((container: AwilixContainer) => { run(args: WorkflowRunArgs<I>): Promise<WorkflowRunResult<O>> }) & {
  workflowName: string;
  /** Runs this workflow as one step of another: undone with it if the other fails later. */
  runAsStep(args: { input: I }): O;
};

/**
 * `export const acceptMissionWorkflow = createWorkflow("accept-mission", (input: AcceptInput) => { … return new WorkflowResponse(run) })`
 * then `await acceptMissionWorkflow(req.scope).run({ input })`.
 */
export function createWorkflow<I, O>(name: string, compose: (input: I) => WorkflowResponse<O> | O | void): Workflow<I, O> {
  const previous = current;
  const c = new Composer();
  current = c;
  let out: unknown;
  try {
    out = compose(makeRef('input') as I);
  } finally {
    current = previous;
  }
  const def: Definition = { name, nodes: c.nodes, result: out instanceof WorkflowResponse ? out.result : out };

  if (registry.has(name)) throw new Error(`Deux workflows s’appellent « ${name} »`);
  registry.set(name, def);

  const workflow = ((container: AwilixContainer) => ({
    async run({ input, throwOnError = true }: WorkflowRunArgs<I>): Promise<WorkflowRunResult<O>> {
      const transactionId = ulid();
      const ctx: StepExecutionContext = { container, context: { transactionId, workflowId: name, eventGroup: [], children: [] } };
      const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
      try {
        const { result } = await execute(def, input, ctx, transactionId, null);
        // The events go out only once everything succeeded.
        if (ctx.context.eventGroup.length) await container.resolve<EventBus>(ContainerRegistrationKeys.EVENT_BUS).emit(ctx.context.eventGroup);
        return { result: result as O, errors: [], transactionId };
      } catch (e) {
        logger.debug(`workflow ${name} annulé : ${(e as Error).message}`);
        if (throwOnError) throw e;
        return { result: undefined as O, errors: [e as Error], transactionId };
      } finally {
        for (const id of ctx.context.children) live.delete(id);
      }
    },
  })) as Workflow<I, O>;

  workflow.workflowName = name;
  const asStep = createStep<I, O, { transaction_id: string }>(
    `${name}-as-step`,
    async (input, ctx) => {
      const transactionId = ulid();
      const execution = await execute(def, input, ctx, transactionId, ctx.context.transactionId);
      live.set(transactionId, execution);
      ctx.context.children.push(transactionId);
      return new StepResponse(execution.result as O, { transaction_id: transactionId });
    },
    async ({ transaction_id }, ctx) => {
      const execution = live.get(transaction_id);
      live.delete(transaction_id);
      if (execution) await execution.compensate();
      else await compensateFromRecord(ctx.container, transaction_id);
    }
  );
  workflow.runAsStep = ({ input }) => asStep(input);
  return workflow;
}
