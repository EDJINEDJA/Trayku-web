import { Module } from '../../modules';
import { Modules } from '../../utils';
import { PaypalPaymentProvider, StripePaymentProvider, SystemPaymentProvider, type PaymentMode } from './providers';
import PaymentModuleService from './service';

type ProviderConfig = { resolve: 'system' | 'stripe' | 'paypal'; options?: Record<string, string | undefined> };
type Options = { mode?: PaymentMode; providers?: ProviderConfig[] };

/**
 * traiku-config.ts: `{ key: 'payment', options: { mode: 'test' | 'live', providers: [...] } }`.
 * Test: the system provider (nothing charged) and the providers' sandboxes. Live: real money only,
 * the system provider refused.
 */
export default Module(Modules.PAYMENT, {
  service: PaymentModuleService,
  loaders: [
    ({ service, options, logger }) => {
      const s = service as PaymentModuleService;
      const o = options as Options;
      s.mode = o.mode === 'live' ? 'live' : 'test';
      for (const p of o.providers ?? [{ resolve: 'system' }]) {
        const opt = p.options ?? {};
        if (p.resolve === 'system') {
          if (s.mode === 'live') throw new Error('Paiement : le paiement test (system) est refusé en mode live');
          s.registerProvider(new SystemPaymentProvider());
        } else if (p.resolve === 'stripe') {
          if (!opt.apiKey) throw new Error('Stripe : apiKey est requis');
          s.registerProvider(new StripePaymentProvider({ apiKey: opt.apiKey, webhookSecret: opt.webhookSecret, mode: s.mode }));
        } else if (p.resolve === 'paypal') {
          if (!opt.clientId || !opt.clientSecret) throw new Error('PayPal : clientId et clientSecret sont requis');
          s.registerProvider(new PaypalPaymentProvider({ clientId: opt.clientId, clientSecret: opt.clientSecret, mode: s.mode }));
        } else throw new Error(`Paiement : fournisseur inconnu ${(p as ProviderConfig).resolve}`);
      }
      logger.info(`paiement en mode ${s.mode === 'live' ? 'réel' : 'test'} : ${s.listProviders().map((p) => p.id).join(', ') || 'aucun fournisseur'}`);
    },
  ],
});
export { PaymentModuleService };
export * from './providers';
