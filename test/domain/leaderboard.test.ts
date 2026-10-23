import { describe, expect, it } from 'vitest';
import {
  DEFAULT_APPEARANCE,
  leaderboardEmptyState,
  boardPlace,
  placeBadge,
  placeText,
  rankByOptions,
  rankProducts,
  resolveViewState,
  type Purchase,
  type RankableProduct,
} from '../../shared/domain';

let seq = 0;
const buy = (totalPaid: number, amount: number): Purchase => ({ totalPaid, amount, date: '2026-01-01', supplier: null, seq: seq++ });
const p = (id: string, productType: string, ratings: RankableProduct['ratings'], extra: Partial<RankableProduct> = {}): RankableProduct => ({
  id,
  name: id,
  productType,
  ratings,
  dateTried: null,
  purchases: [],
  ...extra,
});

describe('Default ranking (§17 Leaderboard)', () => {
  it('highest Overall first; unrated at the bottom; bands by score and #1 marked, not a podium by place (D48)', () => {
    const rows = rankProducts(
      [p('low', 'flower', { look: 5 }), p('unrated', 'flower', {}), p('high', 'flower', { look: 9 }), p('mid', 'flower', { look: 7 }), p('x', 'flower', { look: 6 }), p('lowest', 'flower', { look: 2 })],
      { filter: 'all', rankBy: 'overall' },
    );
    expect(rows.map((r) => r.product.id)).toEqual(['high', 'mid', 'x', 'low', 'lowest', 'unrated']);
    expect(rows.map((r) => r.band)).toEqual([3, null, null, null, null, null]); // only the 9 earns a colour
    expect(rows.map((r) => r.first)).toEqual([true, false, false, false, false, false]);
  });

  it('an unrated product never gets a band or the #1 mark, even at the top (D48)', () => {
    const rows = rankProducts([p('a', 'flower', { look: 8 }), p('b', 'flower', {}), p('c', 'flower', { look: 6 }), p('d', 'flower', {})], { filter: 'all', rankBy: 'overall' });
    expect(rows.map((r) => r.product.id)).toEqual(['a', 'c', 'b', 'd']);
    expect(rows.map((r) => r.band)).toEqual([1, null, null, null]);
    const none = rankProducts([p('u1', 'flower', {}), p('u2', 'flower', {})], { filter: 'all', rankBy: 'overall' });
    expect(none.map((r) => [r.band, r.first])).toEqual([[null, false], [null, false]]);
  });

  it('ties broken by most recent date tried', () => {
    const rows = rankProducts(
      [p('old', 'flower', { look: 8 }, { dateTried: '2025-01-01' }), p('new', 'flower', { look: 8 }, { dateTried: '2026-01-01' }), p('undated', 'flower', { look: 8 })],
      { filter: 'all', rankBy: 'overall' },
    );
    expect(rows.map((r) => r.product.id)).toEqual(['new', 'old', 'undated']);
  });

  it('filtering to a type renumbers ranks from 1 and the #1 mark follows', () => {
    const rows = rankProducts([p('f', 'flower', { look: 9 }), p('e', 'edibles', { taste: 5 })], { filter: 'edibles', rankBy: 'overall' });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ rank: 1, first: true, band: null });
  });

  it('under a rating, the bands follow that rating, not Overall', () => {
    const rows = rankProducts(
      [9.6, 9.1, 8.6, 8.1, 7].map((n, i) => p(`t${i}`, 'flower', { taste: n, look: 5 })),
      { filter: 'all', rankBy: 'taste' },
    );
    expect(rows.map((r) => [r.product.id, r.band, r.first])).toEqual([['t0', 4, true], ['t1', 3, false], ['t2', 2, false], ['t3', 1, false], ['t4', null, false]]);
  });

  it('Other and Not set products appear under All', () => {
    const rows = rankProducts([p('o', 'other', { look: 5 }), p('n', 'not_set', {})], { filter: 'all', rankBy: 'overall' });
    expect(rows).toHaveLength(2);
  });
});

describe('Rank by (§10.1)', () => {
  it('Rank by Consistency under All → only rated concentrates shown', () => {
    const rows = rankProducts(
      [p('c1', 'concentrate', { consistency: 7 }), p('c2', 'concentrate', { look: 7 }), p('f', 'flower', { consistency: 9, look: 9 })],
      { filter: 'all', rankBy: 'consistency' },
    );
    expect(rows.map((r) => r.product.id)).toEqual(['c1']);
  });

  it('price ranks highest first on the unrounded figure', () => {
    // £1.434/g vs £1.426/g both display £1.43/g
    const rows = rankProducts(
      [p('cheap', 'flower', {}, { purchases: [buy(9.98, 7)] }), p('dear', 'flower', {}, { purchases: [buy(10.04, 7)] })],
      { filter: 'flower', rankBy: 'price' },
    );
    expect(rows.map((r) => r.product.id)).toEqual(['dear', 'cheap']);
  });

  it('options under All: Overall, Price, VFM (D67), then the category union in canonical order; no hit time', () => {
    expect(rankByOptions('all', { money: true }).map((o) => o.key)).toEqual([
      'overall', 'price', 'vfm', 'look', 'consistency', 'smell', 'taste', 'burn', 'high',
    ]);
    expect(rankByOptions('all', { money: true })[1]!.label).toBe('Price');
  });

  it('under All, price and VFM compare an edible\'s 20mg with a gram (D67); one type keeps its own unit', () => {
    const list = [
      p('flower', 'flower', { look: 8 }, { purchases: [buy(5, 1)] }), // £5/g → 1.6
      p('edible', 'edibles', { taste: 8, high: 8 }, { purchases: [buy(10, 100)] }), // £0.10/mg → £2 per 20mg → 4
      p('rosin', 'concentrate', { look: 9 }, { purchases: [buy(30, 1)] }), // £30/g → 0.3
    ];
    const price = rankProducts(list, { filter: 'all', rankBy: 'price' });
    expect(price.map((r) => [r.product.id, r.value])).toEqual([['rosin', 30], ['flower', 5], ['edible', 2]]);
    const vfm = rankProducts(list, { filter: 'all', rankBy: 'vfm' });
    expect(vfm.map((r) => r.product.id)).toEqual(['edible', 'flower', 'rosin']);
    expect(vfm[0]!.value).toBeCloseTo(4, 12);
    expect(vfm.every((r) => r.band === null)).toBe(true);
    expect(vfm[0]!.first).toBe(true);
    expect(rankProducts(list, { filter: 'edibles', rankBy: 'price' })[0]!.value).toBeCloseTo(0.1, 12);
    expect(placeText(1, { filter: 'all', rankBy: 'vfm' }, 'your')).toBe('#1 by Value for money');
    expect(placeText(2, { filter: 'all', rankBy: 'price' }, 'your')).toBe('#2 by Price');
    expect(resolveViewState({ filter: 'all', rankBy: 'vfm' }, { money: true })).toMatchObject({ rankBy: 'vfm', changed: false });
    expect(resolveViewState({ filter: 'all', rankBy: 'vfm' }, { money: false })).toMatchObject({ rankBy: 'overall', changed: true });
  });

  it('options under a type include price by unit and VFM, then its categories', () => {
    expect(rankByOptions('edibles', { money: true })).toEqual([
      { key: 'overall', label: 'Overall' },
      { key: 'price', label: 'Price per mg' },
      { key: 'vfm', label: 'Value for money' },
      { key: 'taste', label: 'Taste' },
      { key: 'high', label: 'High' },
    ]);
    expect(rankByOptions('flower', { money: true })[1]!.label).toBe('Price per gram');
    expect(rankByOptions('pre_roll', { money: true }).map((o) => o.key)).not.toContain('look');
  });

  it('a followed person’s view never offers price or VFM; nobody gets Most used any more (D60)', () => {
    for (const filter of ['all', 'flower'] as const) {
      const keys = rankByOptions(filter, { money: false }).map((o) => o.key);
      expect(keys).not.toContain('price');
      expect(keys).not.toContain('vfm');
      expect(rankByOptions(filter, { money: true }).map((o) => o.key)).not.toContain('used');
    }
    // A Most used stored before Smokes went shows Overall, and is overwritten.
    expect(resolveViewState({ filter: 'all', rankBy: 'used' }, { money: false })).toMatchObject({ rankBy: 'overall', changed: true });
    expect(resolveViewState({ filter: 'flower', rankBy: 'used' }, { money: true })).toMatchObject({ filter: 'flower', rankBy: 'overall', changed: true });
  });

  it('Rank by Look, then filter to Edibles → falls back to Overall and the stored setting is overwritten', () => {
    expect(resolveViewState({ filter: 'edibles', rankBy: 'look' }, { money: true })).toEqual({
      filter: 'edibles',
      rankBy: 'overall',
      changed: true,
    });
  });

  it('an invalid stored filter → All', () => {
    expect(resolveViewState({ filter: 'other', rankBy: 'overall' }, { money: true }).filter).toBe('all');
    expect(resolveViewState({}, { money: true })).toMatchObject({ filter: 'all', rankBy: 'overall' });
  });

  it('a stored price ranking is dropped in a follower view', () => {
    expect(resolveViewState({ filter: 'flower', rankBy: 'price' }, { money: false }).rankBy).toBe('overall');
  });
});

describe('Empty states (§10.1)', () => {
  it('genuinely empty, filtered-empty, rank-empty (rank wins)', () => {
    expect(leaderboardEmptyState(0, 0, { filter: 'all', rankBy: 'overall' })).toBe('empty');
    expect(leaderboardEmptyState(3, 0, { filter: 'edibles', rankBy: 'overall' })).toBe('filtered-empty');
    expect(leaderboardEmptyState(3, 0, { filter: 'all', rankBy: 'consistency' })).toBe('rank-empty');
    expect(leaderboardEmptyState(3, 0, { filter: 'edibles', rankBy: 'taste' })).toBe('rank-empty');
    expect(leaderboardEmptyState(3, 2, { filter: 'all', rankBy: 'taste' })).toBeNull();
  });
});

describe('Product pages: place and badge (D22, D48)', () => {
  const list = [
    p('a', 'flower', { look: 9 }),
    p('b', 'flower', { look: 8, taste: 5 }),
    p('c', 'edibles', { taste: 9.5, high: 9.5 }),
    p('d', 'flower', { look: 7, taste: 9 }),
    p('e', 'flower', { look: 6 }),
    p('f', 'flower', { look: 5.5 }),
    p('u', 'flower', {}),
  ];
  const gems = { ...DEFAULT_APPEARANCE, preset: 'gems', markFirst: true } as const;
  const at = (id: string, view: { filter: any; rankBy: any }) => {
    const r = boardPlace(list, id, view);
    return r && [r.rank, r.band, r.first];
  };

  it('a page gets the row it has, under the same filter and Rank by', () => {
    const all = { filter: 'all', rankBy: 'overall' } as const;
    expect(['c', 'a', 'd', 'b', 'e', 'f', 'u'].map((id) => at(id, all))).toEqual([[1, 4, true], [2, 3, false], [3, 1, false], [4, null, false], [5, null, false], [6, null, false], [7, null, false]]);
    // Filtered to Flower the edible drops out and the rest move up; Rank by Taste reorders.
    expect(at('a', { filter: 'flower', rankBy: 'overall' })).toEqual([1, 3, true]);
    expect(at('c', { filter: 'flower', rankBy: 'overall' })).toBeNull();
    expect(at('d', { filter: 'all', rankBy: 'taste' })).toEqual([2, 3, false]); // after the edible's 9.5
    expect(at('a', { filter: 'all', rankBy: 'taste' })).toBeNull(); // no Taste: hidden, so no place
  });

  it('a product not in the list (archived) has no place', () => {
    expect(boardPlace(list, 'gone', { filter: 'all', rankBy: 'overall' })).toBeNull();
  });

  it('the place names the list it is in', () => {
    expect(placeText(1, { filter: 'all', rankBy: 'overall' }, 'your')).toBe('#1 on your Leaderboard');
    expect(placeText(3, { filter: 'all', rankBy: 'overall' }, 'their')).toBe('#3 on their Leaderboard');
    expect(placeText(2, { filter: 'flower', rankBy: 'overall' }, 'your')).toBe('#2 in Flower');
    expect(placeText(1, { filter: 'all', rankBy: 'taste' }, 'your')).toBe('#1 by Taste');
    expect(placeText(3, { filter: 'flower', rankBy: 'taste' }, 'their')).toBe('#3 in Flower by Taste');
    expect(placeText(3, { filter: 'edibles', rankBy: 'price' }, 'your')).toBe('#3 in Edibles by Price per mg');
    expect(placeText(2, { filter: 'concentrate', rankBy: 'vfm' }, 'your')).toBe('#2 in Concentrate by Value for money');
    expect(placeText(1, { filter: 'pre_roll', rankBy: 'burn' }, 'your')).toBe('#1 in Pre roll by Burn');
  });

  it('the badge: a band names its colour in your preset; #1 without one gets its place only when marked', () => {
    const all = { filter: 'all', rankBy: 'overall' } as const;
    expect(placeBadge({ rank: 3, band: 3, first: false }, all, 'your', gems)).toBe('Amethyst · #3 on your Leaderboard');
    expect(placeBadge({ rank: 1, band: 4, first: true }, all, 'their', gems)).toBe('Rainbow · #1 on their Leaderboard');
    expect(placeBadge({ rank: 2, band: 2, first: false }, { filter: 'flower', rankBy: 'overall' }, 'your', { ...DEFAULT_APPEARANCE, preset: 'metals', markFirst: true })).toBe('Rose gold · #2 in Flower');
    expect(placeBadge({ rank: 4, band: 1, first: false }, all, 'your', { ...DEFAULT_APPEARANCE, preset: 'prism', markFirst: false })).toBe('Prism · #4 on your Leaderboard');
    expect(placeBadge({ rank: 5, band: null, first: false }, all, 'your', gems)).toBeNull();
    expect(placeBadge({ rank: 1, band: null, first: true }, { filter: 'flower', rankBy: 'price' }, 'your', gems)).toBe('#1 in Flower by Price per gram');
    expect(placeBadge({ rank: 1, band: null, first: true }, all, 'your', { ...DEFAULT_APPEARANCE, preset: 'gems', markFirst: false })).toBeNull();
  });
});
