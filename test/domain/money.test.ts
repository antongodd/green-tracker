import { describe, expect, it } from 'vitest';
import {
  formatAmount,
  formatUnitPrice,
  formatVFM,
  headlinePrice,
  purchasedWeight,
  purchasesNewestFirst,
  unitPrice,
  valueForMoney,
  type Purchase,
} from '../../shared/domain';

let seq = 0;
const buy = (totalPaid: number, amount: number | null, date: string | null = '2026-01-01'): Purchase => ({
  totalPaid,
  amount,
  date,
  supplier: null,
  seq: seq++,
});

describe('Derived price (§17 Money)', () => {
  it('£10 for 3.5g → £2.86/g', () => {
    expect(formatUnitPrice('flower', unitPrice(buy(10, 3.5))!)).toBe('£2.86/g');
  });

  it('£10 for 7g, Overall 10 → £1.43/g shown, VFM exactly 7.00 (full precision)', () => {
    const purchases = [buy(10, 7)];
    expect(formatUnitPrice('flower', headlinePrice(purchases)!)).toBe('£1.43/g');
    const vfm = valueForMoney('flower', { look: 10, smell: 10, taste: 10, burn: 10 }, purchases)!;
    expect(vfm).toBeCloseTo(7, 12);
    expect(formatVFM(vfm)).toBe('7.00');
  });

  it('edible Overall 8.0 at £0.05/mg → VFM 1.6 (per 100mg)', () => {
    const vfm = valueForMoney('edibles', { taste: 6, high: 9 }, [buy(5, 100)])!;
    expect(vfm).toBeCloseTo(1.6, 12);
  });

  it('a purchase with a total but no amount shows no per-unit figure and counts 0g', () => {
    const p = buy(20, null);
    expect(unitPrice(p)).toBeNull();
    expect(purchasedWeight('flower', [p])).toBe(0);
  });

  it('VFM needs both an Overall and a priced latest purchase', () => {
    expect(valueForMoney('flower', {}, [buy(10, 7)])).toBeNull();
    expect(valueForMoney('flower', { look: 8 }, [])).toBeNull();
    expect(valueForMoney('flower', { look: 8 }, [buy(10, 7, '2026-01-01'), buy(10, null, '2026-02-01')])).toBeNull();
  });

  it('headline price is the most recent purchase', () => {
    const purchases = [buy(10, 1, '2026-01-01'), buy(30, 1, '2026-03-01'), buy(20, 1, '2026-02-01')];
    expect(headlinePrice(purchases)).toBe(30);
    expect(purchasesNewestFirst(purchases).map((p) => p.totalPaid)).toEqual([30, 20, 10]);
  });

  it('same-date purchases: the later-entered one is latest', () => {
    expect(headlinePrice([buy(10, 1, '2026-01-01'), buy(15, 1, '2026-01-01')])).toBe(15);
  });
});

describe('Units follow the type (§9)', () => {
  it('an edible never shows g; a flower never shows mg', () => {
    expect(formatAmount('edibles', 100)).toBe('100mg');
    expect(formatUnitPrice('edibles', 0.05)).toBe('£0.05/mg');
    expect(formatAmount('flower', 3.5)).toBe('3.5g');
    expect(formatUnitPrice('flower', 2)).toBe('£2.00/g');
  });

  it('a type switch relabels but does not convert (100 stays 100)', () => {
    expect(formatAmount('edibles', 100)).toBe('100mg');
    expect(formatAmount('flower', 100)).toBe('100g');
  });

  it('edibles never count towards the weight total', () => {
    expect(purchasedWeight('edibles', [buy(10, 100)])).toBe(0);
  });
});
