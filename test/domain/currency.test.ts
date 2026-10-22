import { describe, expect, it } from 'vitest';
import { checkExportFile, validateRestore } from '../../shared/domain/backup';
import { COMMON_CURRENCIES, CURRENCIES, currencySign, DEFAULT_CURRENCY, formatRate, isCurrencyCode, isValidRate } from '../../shared/domain/currency';
import { formatMoney, formatUnitPrice } from '../../shared/domain/format';
import { headlinePrice, paidInMain, unitPrice, unitPricePaid, valueForMoney, type Purchase } from '../../shared/domain/money';
import { emptyProductInput, settleCurrencies, validateProductInput } from '../../shared/domain/product';
import { fxDay, parseRates } from '../../server/lib/fx';

// Currencies (D66, 0.56.0).

describe('the currencies', () => {
  it('are the ECB’s, each once, the usual ones first, £ where everyone starts', () => {
    const codes = CURRENCIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.slice(0, COMMON_CURRENCIES.length)).toEqual([...COMMON_CURRENCIES]);
    expect(DEFAULT_CURRENCY).toBe('GBP');
    expect(codes).toHaveLength(30);
    for (const c of CURRENCIES) expect(c.code).toMatch(/^[A-Z]{3}$/);
    expect(isCurrencyCode('EUR')).toBe(true);
    expect(isCurrencyCode('eur')).toBe(false);
    expect(isCurrencyCode('BGN')).toBe(false); // Bulgaria uses the euro since 2026
  });

  it('show their sign and decimals; dollars say whose', () => {
    expect(formatMoney(34.4, 'GBP')).toBe('£34.40');
    expect(formatMoney(40, 'EUR')).toBe('€40.00');
    expect(formatMoney(12, 'USD')).toBe('US$12.00');
    expect(formatMoney(12, 'CAD')).toBe('CA$12.00');
    expect(formatMoney(12.5, 'CHF')).toBe('CHF 12.50');
    expect(formatMoney(4999.6, 'JPY')).toBe('¥5000');
    expect(formatMoney(1.005, 'GBP')).toBe('£1.01');
    expect(currencySign('CHF')).toBe('CHF');
    // Per unit always 2 decimals (D13), even in yen.
    expect(formatUnitPrice('flower', 11.428571, 'EUR')).toBe('€11.43/g');
    expect(formatUnitPrice('edibles', 0.3, 'JPY')).toBe('¥0.30/mg');
  });

  it('rates: 4 figures, at least 2 decimals; only positive numbers', () => {
    expect(formatRate(0.86)).toBe('0.86');
    expect(formatRate(0.8612345)).toBe('0.8612');
    expect(formatRate(1.171234)).toBe('1.171');
    expect(formatRate(0.0052141)).toBe('0.005214');
    expect(formatRate(1)).toBe('1.00');
    expect(formatRate(21345.6)).toBe('21346');
    for (const ok of [0.86, 1, 21000]) expect(isValidRate(ok)).toBe(true);
    for (const bad of [0, -1, NaN, Infinity, '0.86', null, 1e9]) expect(isValidRate(bad)).toBe(false);
  });
});

describe('prices in your main currency', () => {
  const eur = (totalPaid: number, amount: number, rate: number, date = '2026-10-20', seq = 1): Purchase => ({ totalPaid, amount, date, seq, supplier: null, currency: 'EUR', rate });
  it('a purchase in € counts at its saved rate; shown as paid too', () => {
    const p = eur(40, 3.5, 0.86);
    expect(paidInMain(p)).toBeCloseTo(34.4, 12);
    expect(unitPrice(p)).toBeCloseTo(34.4 / 3.5, 12);
    expect(unitPricePaid(p)).toBeCloseTo(40 / 3.5, 12);
    expect(paidInMain({ totalPaid: 10 })).toBe(10); // before 0.56.0: £, rate 1
  });

  it('the headline price and value for money compare £ and € fairly', () => {
    const purchases = [{ totalPaid: 35, amount: 3.5, date: '2026-08-02', seq: 0, supplier: null }, eur(40, 3.5, 0.86)];
    expect(headlinePrice(purchases)).toBeCloseTo(34.4 / 3.5, 12);
    expect(valueForMoney('flower', { look: 8.6 }, purchases)).toBeCloseTo(8.6 / (34.4 / 3.5), 12);
  });
});

describe('a purchase’s currency, checked and settled', () => {
  const one = (p: Record<string, unknown>) => validateProductInput({ ...emptyProductInput(), name: 'X', purchases: [{ date: null, amount: 1, totalPaid: 10, supplier: null, ...p }] });
  it('the editor’s checks: a known currency, a rate that is a positive number', () => {
    const plain = one({});
    expect(plain.ok && plain.value.purchases[0]).toEqual({ date: null, amount: 1, totalPaid: 10, supplier: null });
    const ok = one({ currency: 'EUR', rate: 0.86 });
    expect(ok.ok && ok.value.purchases[0]).toMatchObject({ currency: 'EUR', rate: 0.86 });
    expect(one({ currency: 'XYZ' })).toEqual({ ok: false, message: 'Choose a currency from the list.' });
    expect(one({ currency: 'EUR', rate: 0 })).toEqual({ ok: false, message: 'An exchange rate must be a number more than 0.' });
    expect(one({ totalPaid: -1 })).toEqual({ ok: false, message: 'Total paid must be an amount of money.' });
  });

  it('settled against your main currency: none given is it, it is always 1, another needs a rate', () => {
    expect(settleCurrencies([{ date: null, amount: 1, totalPaid: 1, supplier: null }], 'EUR')).toEqual({ ok: true, value: [{ date: null, amount: 1, totalPaid: 1, supplier: null, currency: 'EUR', rate: 1 }] });
    expect(settleCurrencies([{ date: null, amount: 1, totalPaid: 1, supplier: null, currency: 'EUR', rate: 3 }], 'EUR')).toMatchObject({ ok: true, value: [{ rate: 1 }] });
    expect(settleCurrencies([{ date: null, amount: 1, totalPaid: 1, supplier: null, currency: 'USD', rate: 0.9 }], 'EUR')).toMatchObject({ ok: true, value: [{ currency: 'USD', rate: 0.9 }] });
    expect(settleCurrencies([{ date: null, amount: 1, totalPaid: 1, supplier: null, currency: 'USD' }], 'EUR')).toEqual({ ok: false, message: 'A purchase in US$ needs an exchange rate.' });
  });
});

describe('backups with currencies', () => {
  const file = (extra: Record<string, unknown>) => ({ format: 'green-tracker-export', version: 1, exportedAt: '', appVersion: '', username: 'a', products: [], logEntries: [], ...extra });
  it('a file’s main currency is checked; files from before 0.56.0 have none', () => {
    expect(checkExportFile(file({})).ok).toBe(true);
    expect(checkExportFile(file({ money: { currency: 'EUR' } })).ok).toBe(true);
    expect(checkExportFile(file({ money: { currency: 'XYZ' } }))).toEqual({ ok: false, message: 'The main currency in the file couldn’t be read.' });
    expect(validateRestore({ products: [], logEntries: [], money: { currency: 'EUR' } })).toEqual({ ok: true, value: { products: [], logEntries: [], money: { currency: 'EUR' } } });
    expect(validateRestore({ products: [], logEntries: [] })).toEqual({ ok: true, value: { products: [], logEntries: [] } });
    expect(validateRestore({ products: [], logEntries: [], money: { currency: 'xyz' } }).ok).toBe(false);
  });
});

describe('the rate service’s answers (server/lib/fx.ts)', () => {
  it('reads v2’s rows and v1’s table, per euro, oldest first; ignores anything else', () => {
    const v2 = parseRates([
      { date: '2026-10-20', base: 'EUR', quote: 'GBP', rate: 0.87 },
      { date: '2026-10-19', base: 'EUR', quote: 'GBP', rate: 0.86 },
      { date: '2026-10-19', base: 'USD', quote: 'GBP', rate: 0.7 },
      { date: '2026-10-19', base: 'EUR', quote: 'USD', rate: 'x' },
    ]);
    expect([...v2]).toEqual([['GBP', [['2026-10-19', 0.86], ['2026-10-20', 0.87]]]]);
    const v1 = parseRates({ base: 'EUR', rates: { '2026-10-19': { GBP: 0.86, USD: 1.12 } } });
    expect(v1.get('USD')).toEqual([['2026-10-19', 1.12]]);
    expect(parseRates(null).size).toBe(0);
    expect(parseRates({ message: 'not found' }).size).toBe(0);
  });

  it('looks a rate up for the purchase’s day: today when undated or later, never before 1999', () => {
    expect(fxDay('2026-10-20', '2026-10-22')).toBe('2026-10-20');
    expect(fxDay(null, '2026-10-22')).toBe('2026-10-22');
    expect(fxDay('2027-01-01', '2026-10-22')).toBe('2026-10-22');
    expect(fxDay('1990-01-01', '2026-10-22')).toBe('1999-01-04');
  });
});
