import { Module } from '@traiku/framework';
import { CURRENCIES } from '../../lib/currencies';
import CurrencyModuleService from './service';

export const CURRENCY_MODULE = 'currency';

export default Module(CURRENCY_MODULE, {
  service: CurrencyModuleService,
  loaders: [
    // As Medusa's currency module: the ISO currencies written at start-up, the missing ones added.
    async ({ service, logger }) => {
      const s = service as CurrencyModuleService;
      try {
        const known = new Set((await s.listCurrencies({}, { select: ['code'] })).map((c) => c.code));
        const missing = CURRENCIES.filter((c) => !known.has(c.code));
        if (missing.length) await s.createCurrencies(missing);
      } catch {
        // Before its migration (db:migrate): nothing to fill yet.
        logger.debug?.('currency : table pas encore créée');
      }
    },
  ],
});
export { CurrencyModuleService };
