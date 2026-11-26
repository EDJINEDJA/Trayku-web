import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { bootstrap } from '../app';
import { loadEnv } from '../config';
import { buildHttpApp } from '../http';
import { syncLinkTables } from '../links';
import { generateMigration, rollbackMigration, runMigrations } from '../migrations';
import { toMigratable } from '../modules';
import type { ApiKeyModuleService } from '../modules-core/api-key';
import type { AuthModuleService } from '../modules-core/auth';
import type { UserModuleService } from '../modules-core/user';
import { Modules } from '../utils';

/**
 * The commands, as Medusa's CLI:
 *   develop | start                 the server (subscribers and jobs included)
 *   db:migrate                      the migrations not run yet, then the link tables
 *   db:generate [module…]           a migration per changed module (all by default)
 *   db:rollback <module>            undoes the module's last migration
 *   user -e <email> -p <password>   a team account for the admin
 *   api-key -t publishable|secret --title <title>
 *   exec <script>                   runs a script: export default async ({ container }) => {}
 */

const rootDir = process.cwd();
loadEnv(process.env.NODE_ENV || 'development', rootDir);

const [command, ...args] = process.argv.slice(2);

function flag(names: string[]): string | undefined {
  for (let i = 0; i < args.length; i++) if (names.includes(args[i])) return args[i + 1];
  return undefined;
}

async function main() {
  switch (command) {
    case 'develop':
    case 'start': {
      const app = await bootstrap(rootDir, { subscribers: true, jobs: true });
      const http = await buildHttpApp(app.container, rootDir);
      const { port } = app.config.projectConfig.http;
      const server = http.listen(port, () => app.logger.info(`Traiku prêt sur http://localhost:${port}`));
      // Against slow clients holding connections (slowloris): headers within 10 s, the whole request
      // within 2 min (photos from a weak mobile network), idle connections closed after 5 s.
      server.headersTimeout = 10_000;
      server.requestTimeout = 120_000;
      server.keepAliveTimeout = 5_000;
      server.maxRequestsPerSocket = 1000;
      const stop = async () => {
        server.close();
        await app.shutdown();
        process.exit(0);
      };
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
      return;
    }

    case 'db:migrate': {
      const app = await bootstrap(rootDir, { migration: true });
      await runMigrations(app.db, toMigratable(app.modules), app.logger);
      await syncLinkTables(app.db, app.links, app.logger);
      app.logger.info('Base à jour.');
      return app.shutdown();
    }

    case 'db:generate': {
      const app = await bootstrap(rootDir);
      const wanted = args.filter((a) => !a.startsWith('-'));
      const list = toMigratable(app.modules).filter((m) => !wanted.length || wanted.includes(m.key));
      if (wanted.length && list.length !== wanted.length) throw new Error(`Module inconnu parmi : ${wanted.join(', ')}`);
      for (const m of list) generateMigration(m, app.logger);
      return app.shutdown();
    }

    case 'db:rollback': {
      const app = await bootstrap(rootDir, { migration: true });
      const m = toMigratable(app.modules).find((x) => x.key === args[0]);
      if (!m) throw new Error('Précisez le module : npm run db:rollback -- mission');
      await rollbackMigration(app.db, m, app.logger);
      return app.shutdown();
    }

    case 'user': {
      const email = flag(['-e', '--email']);
      const password = flag(['-p', '--password']);
      if (!email || !password) throw new Error('npm run user -- -e equipe@traiku.fr -p motdepasse');
      const app = await bootstrap(rootDir);
      const users = app.container.resolve<UserModuleService>(Modules.USER);
      const auth = app.container.resolve<AuthModuleService>(Modules.AUTH);
      const identity = await auth.registerEmailPass(email, password);
      try {
        const user = await users.createUsers({ email: email.trim().toLowerCase() });
        await auth.setAppMetadata(identity.id, 'user_id', user.id);
        app.logger.info(`Compte créé : ${user.email} (${user.id})`);
      } catch (e) {
        await auth.deleteAuthIdentities(identity.id);
        throw e;
      }
      return app.shutdown();
    }

    case 'api-key': {
      const type = flag(['-t', '--type']) ?? 'publishable';
      if (type !== 'publishable' && type !== 'secret') throw new Error('--type publishable ou secret');
      const app = await bootstrap(rootDir);
      const keys = app.container.resolve<ApiKeyModuleService>(Modules.API_KEY);
      const { key, token } = await keys.generate({ type, title: flag(['--title']) ?? (type === 'publishable' ? 'App mobile' : 'Serveur'), created_by: 'cli' });
      app.logger.info(`Clé ${key.type} « ${key.title} » : ${token}`);
      if (type === 'secret') app.logger.info('Gardez-la en lieu sûr : elle ne sera plus affichée.');
      return app.shutdown();
    }

    case 'exec': {
      if (!args[0]) throw new Error('npm run exec -- ./src/scripts/mon-script.ts');
      const app = await bootstrap(rootDir, { subscribers: true });
      const mod = await import(pathToFileURL(path.resolve(rootDir, args[0])).href);
      await mod.default({ container: app.container, args: args.slice(1) });
      return app.shutdown();
    }

    default:
      console.log('Commandes : develop, start, db:migrate, db:generate, db:rollback, user, api-key, exec');
      process.exitCode = command ? 1 : 0;
  }
}

main().catch((e) => {
  console.error((e as Error).message);
  if (process.env.LOG_LEVEL === 'debug') console.error(e);
  process.exit(1);
});
