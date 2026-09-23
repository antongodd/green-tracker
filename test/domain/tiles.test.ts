import { describe, expect, it } from 'vitest';
import {
  formatWeightTotal,
  groupLog,
  leaderboardTiles,
  logTiles,
  rankProducts,
  type LogRow,
  type Purchase,
  type RankableProduct,
} from '../../shared/domain';

let seq = 0;
const buy = (amount: number | null): Purchase => ({ totalPaid: 10, amount, date: '2026-01-01', supplier: null, seq: seq++ });
const product = (id: string, type: string, purchases: Purchase[], ratings = {}): RankableProduct => ({
  id,
  name: id,
  productType: type,
  ratings,
  dateTried: null,
  purchases,
});

const productRow = (name: string, type: string, country: string | null, amounts: number[]): LogRow => ({
  kind: 'product',
  id: name + country,
  name,
  productType: type,
  country,
  countryOther: null,
  hasPhoto: false,
  createdAt: 0,
  purchases: amounts.map((amount) => ({ amount })),
});
const looseRow = (name: string, type: string, country: string | null, amount: number | null): LogRow => ({
  kind: 'loose',
  id: name + country,
  name,
  productType: type,
  country,
  countryOther: null,
  hasPhoto: false,
  createdAt: 0,
  amount,
});

describe('TOTAL formatting (§17 Tiles)', () => {
  it('7g, 3.5g, 3.5g on one product + 1g on another → 15g', () => {
    const tiles = leaderboardTiles([product('a', 'flower', [buy(7), buy(3.5), buy(3.5)]), product('b', 'flower', [buy(1)])]);
    expect(formatWeightTotal(tiles.totalGrams!)).toBe('15g');
  });

  it('1234g → 1.2kg; 1000g → 1kg; 0 → 0g; drops trailing .0', () => {
    expect(formatWeightTotal(1234)).toBe('1.2kg');
    expect(formatWeightTotal(1000)).toBe('1kg');
    expect(formatWeightTotal(999.96)).toBe('1kg');
    expect(formatWeightTotal(0)).toBe('0g');
    expect(formatWeightTotal(15)).toBe('15g');
    expect(formatWeightTotal(3.5)).toBe('3.5g');
  });

  it('floating-point sums display cleanly', () => {
    const sum = [1.1, 2.2, 1.9].reduce((a, b) => a + b, 0); // 5.200000000000001
    expect(formatWeightTotal(sum)).toBe('5.2g');
  });

  it('rounds the final sum, not the parts', () => {
    // 0.04 × 3 = 0.12 → 0.1g (rounding each part first would give 0g)
    const tiles = leaderboardTiles([product('a', 'flower', [buy(0.04), buy(0.04), buy(0.04)])]);
    expect(formatWeightTotal(tiles.totalGrams!)).toBe('0.1g');
  });

  it('edibles-only → 0g, but PRODUCTS and AVERAGE still count them', () => {
    const tiles = leaderboardTiles([product('a', 'edibles', [buy(100)], { taste: 6, high: 9 })]);
    expect(formatWeightTotal(tiles.totalGrams!)).toBe('0g');
    expect(tiles.products).toBe(1);
    expect(tiles.average).toBe(8);
  });

  it('archiving a product lowers TOTAL (archived products are simply not passed in)', () => {
    const a = product('a', 'flower', [buy(7)]);
    const b = product('b', 'flower', [buy(3)]);
    expect(leaderboardTiles([a, b]).totalGrams).toBe(10);
    expect(leaderboardTiles([a]).totalGrams).toBe(7);
  });

  it('AVERAGE excludes unrated products', () => {
    const tiles = leaderboardTiles([product('a', 'flower', [], { look: 8 }), product('b', 'flower', [])]);
    expect(tiles.average).toBe(8);
    expect(tiles.products).toBe(2);
  });

  it('a follower view (no purchases sent) has no TOTAL', () => {
    const { purchases: _, ...noMoney } = product('a', 'flower', [], { look: 8 });
    expect(leaderboardTiles([noMoney]).totalGrams).toBeNull();
  });

  it('tiles recalculate against the visible (filtered/ranked) list', () => {
    const all = [product('a', 'flower', [buy(7)], { look: 8 }), product('b', 'concentrate', [buy(1)], { look: 4, consistency: 6 })];
    const visible = rankProducts(all, { filter: 'all', rankBy: 'consistency' }).map((r) => r.product);
    expect(leaderboardTiles(visible)).toEqual({ products: 1, average: 5, totalGrams: 1 });
  });
});

describe('Log tiles (§17 Tiles)', () => {
  it('Log TOTAL = Leaderboard TOTAL + non-edible loose amounts', () => {
    const rows = [
      productRow('A', 'flower', 'GB', [7, 3.5]),
      productRow('B', 'edibles', 'GB', [100]),
      looseRow('C', 'flower', 'GB', 2),
      looseRow('D', 'edibles', null, 50),
    ];
    expect(logTiles(groupLog(rows, 'all')).totalGrams).toBe(12.5);
  });

  it('"RS11" loose (UK) + "rs11" product (Thailand) → 1 product; both amounts in TOTAL', () => {
    const tiles = logTiles(groupLog([looseRow('RS11', 'flower', 'GB', 1), productRow('rs11', 'flower', 'TH', [2])], 'all'));
    expect(tiles.products).toBe(1);
    expect(tiles.countries).toBe(2);
    expect(tiles.totalGrams).toBe(3);
  });

  it('"No country" is excluded from COUNTRIES; empty Log is 0 / 0 / 0g', () => {
    expect(logTiles(groupLog([looseRow('A', 'flower', null, 1)], 'all')).countries).toBe(0);
    expect(logTiles(groupLog([], 'all'))).toEqual({ products: 0, countries: 0, totalGrams: 0 });
  });
});
