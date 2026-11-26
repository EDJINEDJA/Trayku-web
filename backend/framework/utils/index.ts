export * from './errors';
export * from './id';
export * from './strings';
export * from './crypto';
export * from './geo';
export * from './phone';

/** Keys of the modules the framework registers itself, as Medusa's `Modules`. */
export const Modules = {
  API_KEY: 'api_key',
  AUTH: 'auth',
  USER: 'user',
  NOTIFICATION: 'notification',
  FILE: 'file',
  PAYMENT: 'payment',
  WORKFLOW_ENGINE: 'workflow_engine',
} as const;

/** What else the container holds, as Medusa's `ContainerRegistrationKeys`. */
export const ContainerRegistrationKeys = {
  PG_CONNECTION: '__pg_connection__',
  LOGGER: 'logger',
  CONFIG_MODULE: 'configModule',
  EVENT_BUS: 'event_bus',
  LINK: 'link',
  QUERY: 'query',
} as const;
