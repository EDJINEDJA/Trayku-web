import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { asValue, createContainer, InjectionMode, type AwilixContainer } from 'awilix';
import type { ConfigModule } from './config';
import { createDb, type Db } from './database';
import { EventBus, loadSubscribers } from './events';
import { loadJobs } from './jobs';
import { LinkService, loadLinks, Query, type LinkDefinition } from './links';
import { createLogger, type Logger } from './logger';
import { loadModules, type LoadedModule } from './modules';
import type { WorkflowEngineModuleService } from './modules-core/workflow-engine';
import { ContainerRegistrationKeys, Modules } from './utils';
import { recoverWorkflows } from './workflows';

export type TraikuApp = {
  container: AwilixContainer;
  config: ConfigModule;
  db: Db;
  logger: Logger;
  modules: LoadedModule[];
  links: LinkDefinition[];
  shutdown(): Promise<void>;
};

/**
 * Loads the project as Medusa does: config, database, modules (each in the container under its key),
 * links, Query, then, if asked, the subscribers and the jobs.
 */
export async function bootstrap(rootDir: string, options: { subscribers?: boolean; jobs?: boolean; migration?: boolean } = {}): Promise<TraikuApp> {
  const logger = createLogger();
  const configFile = path.join(rootDir, 'traiku-config.ts');
  const config = (await import(pathToFileURL(configFile).href)).default as ConfigModule;
  const { databaseUrl, databaseMigrationUrl, databaseLogging } = config.projectConfig;
  // Migrations run as the owner of the tables; the server as a role that only touches rows.
  const db = createDb(options.migration ? (databaseMigrationUrl ?? databaseUrl) : databaseUrl, databaseLogging);

  const container = createContainer({ injectionMode: InjectionMode.PROXY, strict: false });
  const bus = new EventBus(logger);
  container.register({
    [ContainerRegistrationKeys.LOGGER]: asValue(logger),
    [ContainerRegistrationKeys.PG_CONNECTION]: asValue(db),
    [ContainerRegistrationKeys.CONFIG_MODULE]: asValue(config),
    [ContainerRegistrationKeys.EVENT_BUS]: asValue(bus),
  });

  const modules = await loadModules(config, rootDir, db, logger);
  for (const m of modules) container.register(m.key, asValue(m.service));

  const links = await loadLinks(path.join(rootDir, 'src', 'links'));
  container.register({
    [ContainerRegistrationKeys.LINK]: asValue(new LinkService(db, links)),
    [ContainerRegistrationKeys.QUERY]: asValue(new Query(db, modules, links)),
  });

  if (options.subscribers) await loadSubscribers(path.join(rootDir, 'src', 'subscribers'), bus, container, logger);
  const tasks = options.jobs ? await loadJobs(path.join(rootDir, 'src', 'jobs'), container, logger) : [];

  // The server's own housekeeping: undo the workflows a stopped server left half done (at start,
  // then every minute), and once an hour drop the finished executions older than 7 days.
  let timer: NodeJS.Timeout | undefined;
  if (options.jobs) {
    let ticks = 0;
    const tick = async () => {
      try {
        await recoverWorkflows(container);
        if (ticks++ % 60 === 0) await container.resolve<WorkflowEngineModuleService>(Modules.WORKFLOW_ENGINE).purge(7);
      } catch (e) {
        logger.error(`reprise des workflows : ${(e as Error).message}`);
      }
    };
    await tick();
    timer = setInterval(tick, 60_000);
    timer.unref();
  }

  return {
    container,
    config,
    db,
    logger,
    modules,
    links,
    async shutdown() {
      clearInterval(timer);
      for (const t of tasks) await t.stop();
      await bus.idle();
      await db.destroy();
    },
  };
}
