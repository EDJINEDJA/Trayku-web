import { Module } from '@traiku/framework';
import { BRANDS } from '../../lib/brands';
import BrandModuleService, { brandKey } from './service';

export const BRAND_MODULE = 'brand';

export default Module(BRAND_MODULE, {
  service: BrandModuleService,
  loaders: [
    // As the currencies: the known chains written at start-up, the missing ones added.
    async ({ service, logger }) => {
      const s = service as BrandModuleService;
      try {
        const known = new Set((await s.listBrands({}, { select: ['key'] })).map((b) => b.key));
        const missing = BRANDS.filter((b) => !known.has(brandKey(b.name))).map((b) => ({ ...b, key: brandKey(b.name), listed: true }));
        if (missing.length) await s.createBrands(missing);
      } catch {
        logger.debug?.('brand : table pas encore créée');
      }
    },
  ],
});
export { BrandModuleService, brandKey };
export type { BrandKind } from './service';
