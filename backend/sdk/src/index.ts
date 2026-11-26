import { App } from './app';
import { Auth } from './auth';
import { Client, type ClientConfig } from './client';

/**
 * The Traiku SDK, as @medusajs/js-sdk:
 *
 *   const sdk = new Traiku({ baseUrl, publishableKey, auth: { storage } })
 *   await sdk.auth.requestCode(phone)
 *   const { registered } = await sdk.auth.verifyCode(phone, code)
 *   if (!registered) await sdk.auth.register({ first_name })
 *   const { member } = await sdk.app.me.retrieve()
 */
export default class Traiku {
  readonly client: Client;
  readonly auth: Auth;
  readonly app: App;

  constructor(config: ClientConfig) {
    this.client = new Client(config);
    this.auth = new Auth(this.client);
    this.app = new App(this.client);
  }
}

export { Client, TraikuApiError } from './client';
export type { ClientConfig, FetchOptions, Query, TokenStorage } from './client';
export type * from './types';
