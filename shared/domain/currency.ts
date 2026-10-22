// Currencies (D66, 0.56.0). Each purchase is in the currency you paid in; your account has a main
// currency, and every price shown together or compared is converted into it with the rate saved on
// the purchase (looked up for its day, or typed). The list is the European Central Bank's daily
// reference rates, where the rates come from (server/lib/fx.ts).

export interface CurrencyDef {
  code: string;
  name: string;
  /** Written before the amount. Codes that share "$" say whose; codes without a well-known sign use the code and a space. */
  symbol: string;
  /** Decimal places shown: 0 for currencies without pennies in everyday use. */
  decimals: number;
}

const def = (code: string, name: string, symbol: string, decimals = 2): CurrencyDef => ({ code, name, symbol, decimals });

/** The usual ones first (the order of the picker), then the rest A–Z by name. */
export const CURRENCIES: readonly CurrencyDef[] = [
  def('GBP', 'Pound sterling', '£'),
  def('EUR', 'Euro', '€'),
  def('USD', 'US dollar', 'US$'),
  def('CAD', 'Canadian dollar', 'CA$'),
  def('CHF', 'Swiss franc', 'CHF '),
  def('AUD', 'Australian dollar', 'A$'),
  def('BRL', 'Brazilian real', 'R$'),
  def('CNY', 'Chinese yuan', 'CN¥'),
  def('CZK', 'Czech koruna', 'CZK '),
  def('DKK', 'Danish krone', 'DKK '),
  def('HKD', 'Hong Kong dollar', 'HK$'),
  def('HUF', 'Hungarian forint', 'HUF ', 0),
  def('ISK', 'Icelandic króna', 'ISK ', 0),
  def('INR', 'Indian rupee', '₹'),
  def('IDR', 'Indonesian rupiah', 'IDR ', 0),
  def('ILS', 'Israeli shekel', '₪'),
  def('JPY', 'Japanese yen', '¥', 0),
  def('MYR', 'Malaysian ringgit', 'RM'),
  def('MXN', 'Mexican peso', 'MX$'),
  def('NZD', 'New Zealand dollar', 'NZ$'),
  def('NOK', 'Norwegian krone', 'NOK '),
  def('PHP', 'Philippine peso', '₱'),
  def('PLN', 'Polish złoty', 'PLN '),
  def('RON', 'Romanian leu', 'RON '),
  def('SGD', 'Singapore dollar', 'S$'),
  def('ZAR', 'South African rand', 'ZAR '),
  def('KRW', 'South Korean won', '₩', 0),
  def('SEK', 'Swedish krona', 'SEK '),
  def('THB', 'Thai baht', '฿'),
  def('TRY', 'Turkish lira', '₺'),
];

/** The usual ones, shown first in the pickers. */
export const COMMON_CURRENCIES = ['GBP', 'EUR', 'USD', 'CAD', 'CHF'] as const;

/** Where every account starts, and what every purchase made before 0.56.0 is in. */
export const DEFAULT_CURRENCY = 'GBP';

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

export function isCurrencyCode(v: unknown): v is string {
  return typeof v === 'string' && BY_CODE.has(v);
}

export function currency(code: string): CurrencyDef {
  return BY_CODE.get(code) ?? BY_CODE.get(DEFAULT_CURRENCY)!;
}

/** The short sign for a currency on its own (a picker, a tag): `£`, `€`, `US$`, `CHF`. */
export const currencySign = (code: string): string => currency(code).symbol.trim();

/** Rates go from 1 unit of the purchase's currency to the main currency; this covers the rupiah to the pound and back. */
export const RATE_LIMITS = { min: 1e-7, max: 1e7 } as const;

export function isValidRate(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= RATE_LIMITS.min && v <= RATE_LIMITS.max;
}

/** A rate as shown and typed: 4 significant figures, at least 2 decimals (`0.8612`, `1.17`, `0.005214`). */
export function formatRate(rate: number): string {
  if (rate >= 1000) return String(Math.round(rate));
  const s = rate.toPrecision(4);
  const n = Number(s);
  const decimals = Math.max(2, (s.split('.')[1] ?? '').length);
  return n.toFixed(Math.min(decimals, 10)).replace(/(\.\d\d\d*?)0+$/, '$1');
}
