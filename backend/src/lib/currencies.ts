/**
 * The currencies, as Medusa's defaultCurrencies: code, name, symbol, native symbol, decimal digits
 * and cash rounding, for every ISO 4217 currency the runtime knows (Intl). The currency module
 * writes them at start-up; a region picks one.
 */

export type CurrencyDef = { code: string; name: string; symbol: string; symbol_native: string; decimal_digits: number; rounding: number };

/** Paid in cash steps there (Medusa's `rounding`): 0,05 CHF. */
const CASH_ROUNDING: Record<string, number> = { CHF: 0.05 };

const names = new Intl.DisplayNames(['fr'], { type: 'currency' });
const symbolOf = (code: string, display: 'symbol' | 'narrowSymbol') =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: code, currencyDisplay: display })
    .formatToParts(0)
    .find((p) => p.type === 'currency')?.value ?? code;

export const CURRENCIES: CurrencyDef[] = Intl.supportedValuesOf('currency').map((code) => ({
  code,
  name: names.of(code) ?? code,
  symbol: symbolOf(code, 'symbol'),
  symbol_native: symbolOf(code, 'narrowSymbol'),
  decimal_digits: new Intl.NumberFormat('fr-FR', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits ?? 2,
  rounding: CASH_ROUNDING[code] ?? 0,
}));

export const isCurrency = (code: string) => CURRENCIES.some((c) => c.code === code.toUpperCase());
