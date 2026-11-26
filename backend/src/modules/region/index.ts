import { Module } from '@traiku/framework';
import { COUNTRIES } from '../../lib/countries';
import RegionModuleService from './service';

export const REGION_MODULE = 'region';

export default Module(REGION_MODULE, {
  service: RegionModuleService,
  loaders: [
    // As Medusa's region module: the countries written at start-up, the missing ones added.
    async ({ service, logger }) => {
      const s = service as RegionModuleService;
      try {
        const known = new Set((await s.listCountries({}, { select: ['iso_2'] })).map((c) => c.iso_2));
        const missing = COUNTRIES.filter((c) => !known.has(c.code));
        if (missing.length) await s.createCountries(missing.map((c) => ({ iso_2: c.code, name: c.name.toUpperCase(), display_name: c.name, dial: c.dial })));
      } catch {
        // Before its migration (db:migrate): nothing to fill yet.
        logger.debug?.('region : table pas encore créée');
      }
    },
  ],
});
export { RegionModuleService };
