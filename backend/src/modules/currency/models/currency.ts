import { model } from '@traiku/framework';

/** A currency, as Medusa's: written at start-up from lib/currencies.ts, read-only. */
const Currency = model.define('currency', {
  /** ISO 4217: EUR, XOF, JPY… */
  code: model.text().primaryKey(),
  name: model.text(),
  symbol: model.text(),
  symbol_native: model.text(),
  /** 2 for the euro, 0 for the CFA franc and the yen, 3 for the Kuwaiti dinar. */
  decimal_digits: model.number(),
  /** Cash rounding (0,05 CHF), 0 when none. */
  rounding: model.float().default(0),
});

export default Currency;
