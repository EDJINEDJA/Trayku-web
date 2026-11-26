import { Module, type PaymentMode } from '@traiku/framework';
import { StripeConnectPayoutProvider, SystemPayoutProvider } from './providers';
import PayoutModuleService from './service';

export const PAYOUT_MODULE = 'payout';

type Options = { mode?: PaymentMode; provider?: { resolve: 'system' } | { resolve: 'stripe'; options: { apiKey?: string; webhookSecret?: string } } };

/**
 * traiku-config.ts: `{ resolve: './src/modules/payout', options: { mode, provider } }`, the same mode
 * as the payments. Test: Stripe Connect's sandbox, or the test provider without a Stripe key. Live:
 * Stripe Connect only.
 */
export default Module(PAYOUT_MODULE, {
  service: PayoutModuleService,
  loaders: [
    ({ service, options, logger }) => {
      const s = service as PayoutModuleService;
      const o = options as Options;
      const mode: PaymentMode = o.mode === 'live' ? 'live' : 'test';
      const p = o.provider ?? { resolve: 'system' };
      if (p.resolve === 'stripe') {
        if (!p.options.apiKey) throw new Error('Virements : la clé Stripe est requise');
        s.provider = new StripeConnectPayoutProvider({ apiKey: p.options.apiKey, webhookSecret: p.options.webhookSecret, mode });
      } else {
        if (mode === 'live') throw new Error('Virements : le fournisseur test (system) est refusé en mode live');
        s.provider = new SystemPayoutProvider();
      }
      logger.info(`virements en mode ${mode === 'live' ? 'réel' : 'test'} : ${s.provider.id}`);
    },
  ],
});
export { PayoutModuleService };
export * from './providers';
export { EARNING_HOLD_HOURS, PAYOUT_MIN_AMOUNT } from './service';
export type { AccountRow, Balance, EarningRow, NewEarning, PayoutRow } from './service';
