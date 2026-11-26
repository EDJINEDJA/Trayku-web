import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AwilixContainer } from 'awilix';
import cron from 'node-cron';
import type { Logger } from '../logger';

/** src/jobs/*.ts: `export default async function (container) {}` and `export const config = { name, schedule: "*\/5 * * * *" }`. */
export type JobConfig = { name: string; schedule: string };

export async function loadJobs(dir: string, container: AwilixContainer, logger: Logger) {
  if (!fs.existsSync(dir)) return [];
  const tasks = [];
  for (const f of fs.readdirSync(dir).filter((f) => /\.(ts|js)$/.test(f))) {
    const mod = await import(pathToFileURL(path.join(dir, f)).href);
    const config = mod.config as JobConfig | undefined;
    if (typeof mod.default !== 'function' || !config?.schedule) {
      logger.warn(`tâche ignorée, il faut un export par défaut et config.schedule : ${f}`);
      continue;
    }
    let running = false;
    tasks.push(
      cron.schedule(
        config.schedule,
        async () => {
          // A run that lasts longer than the interval isn't started twice.
          if (running) return;
          running = true;
          try {
            await mod.default(container.createScope());
          } catch (e) {
            logger.error(`tâche ${config.name} : ${(e as Error).message}`, e);
          } finally {
            running = false;
          }
        },
        { name: config.name }
      )
    );
    logger.info(`tâche ${config.name} planifiée (${config.schedule})`);
  }
  return tasks;
}
