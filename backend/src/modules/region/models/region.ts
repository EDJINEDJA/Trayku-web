import { model, type AnyDmlEntity } from '@traiku/framework';
import Country from './country';

/**
 * A region, as Medusa's: a name, a currency and its countries (each country in one region at most).
 * Its price scale is in the pricing module, by region_id. `metadata`: { area, minimum_wage,
 * wage_note, rounding }, the starting point of its scale (lib/regions.ts).
 */
const Region = model.define('region', {
  id: model.id({ prefix: 'reg' }).primaryKey(),
  name: model.text(),
  /** ISO 4217, a currency of the currency module. */
  currency_code: model.text(),
  metadata: model.json<Record<string, unknown>>().nullable(),
  countries: model.hasMany((): AnyDmlEntity => Country),
});

export default Region;
