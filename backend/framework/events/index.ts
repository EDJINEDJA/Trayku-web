import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AwilixContainer } from 'awilix';
import type { Logger } from '../logger';

export type EventMessage<T = Record<string, unknown>> = { name: string; data: T; metadata?: Record<string, unknown> };

export type SubscriberArgs<T = Record<string, unknown>> = { event: EventMessage<T>; container: AwilixContainer };
export type SubscriberConfig = { event: string | string[]; context?: { subscriberId?: string } };
type Handler = (event: EventMessage) => Promise<void> | void;

/**
 * As Medusa's local event bus: subscribers run after the emit returns, one failing doesn't stop the
 * others. `idle()` waits for the ones under way (scripts, tests).
 */
export class EventBus {
  private readonly handlers = new Map<string, { id: string; fn: Handler }[]>();
  private pending = new Set<Promise<void>>();

  constructor(private readonly logger: Logger) {}

  subscribe(event: string, fn: Handler, id = fn.name || 'anonyme') {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), { id, fn }]);
  }

  async emit(messages: EventMessage | EventMessage[]) {
    for (const message of Array.isArray(messages) ? messages : [messages]) {
      const targets = [...(this.handlers.get(message.name) ?? []), ...(this.handlers.get('*') ?? [])];
      this.logger.debug(`événement ${message.name} → ${targets.length} abonné(s)`);
      for (const { id, fn } of targets) {
        const run = new Promise<void>((resolve) => setImmediate(resolve))
          .then(() => fn(message))
          .catch((e) => this.logger.error(`abonné ${id} sur ${message.name} : ${(e as Error).message}`, e))
          .finally(() => this.pending.delete(run));
        this.pending.add(run);
      }
    }
  }

  async idle() {
    while (this.pending.size) await Promise.all([...this.pending]);
  }
}

/** src/subscribers/*.ts: `export default async function ({ event, container }) {}` and `export const config = { event: "mission.accepted" }`. */
export async function loadSubscribers(dir: string, bus: EventBus, container: AwilixContainer, logger: Logger) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir).filter((f) => /\.(ts|js)$/.test(f))) {
    const mod = await import(pathToFileURL(path.join(dir, f)).href);
    const config = mod.config as SubscriberConfig | undefined;
    if (typeof mod.default !== 'function' || !config?.event) {
      logger.warn(`abonné ignoré, il faut un export par défaut et config.event : ${f}`);
      continue;
    }
    const id = config.context?.subscriberId ?? f.replace(/\.(ts|js)$/, '');
    for (const event of Array.isArray(config.event) ? config.event : [config.event]) {
      bus.subscribe(event, (message) => mod.default({ event: message, container: container.createScope() }), id);
    }
  }
}
