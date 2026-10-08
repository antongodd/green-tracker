import { describe, expect, it } from 'vitest';
import {
  leaderboardEmptyState,
  podiumBadge,
  podiumPlace,
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
  it('highest Overall first; unrated at the bottom; podium on the top three (D19, D39)', () => {
    const rows = rankProducts(
      [p('low', 'flower', { look: 5 }), p('unrated', 'flower', {}), p('high', 'flower', { look: 9 }), p('mid', 'flower', { look: 7 }), p('x', 'flower', { look: 6 }), p('lowest', 'flower', { look: 2 })],
      { filter: 'all', rankBy: 'overall' },
    );
    expect(rows.map((r) => r.product.id)).toEqual(['high', 'mid', 'x', 'low', 'lowest', 'unrated']);
    expect(rows.map((r) => r.podium)).toEqual([1, 2, 3, null, null, null]); // 4th is an ordinary row (D39)
  });

  it('an unrated product never gets a tier, even within the top three (D19)', () => {
    const rows = rankProducts([p('a', 'flower', { look: 8 }), p('b', 'flower', {}), p('c', 'flower', { look: 6 }), p('d', 'flower', {})], { filter: 'all', rankBy: 'overall' });
    expect(rows.map((r) => r.product.id)).toEqual(['a', 'c', 'b', 'd']);
    expect(rows.map((r) => r.podium)).toEqual([1, 2, null, null]);
    const none = rankProducts([p('u1', 'flower', {}), p('u2', 'flower', {})], { filter: 'all', rankBy: 'overall' });
    expect(none.map((r) => r.podium)).toEqual([null, null]);
  });

  it('ties broken by most recent date tried', () => {
    const rows = rankProducts(
      [p('old', 'flower', { look: 8 }, { dateTried: '2025-01-01' }), p('new', 'flower', { look: 8 }, { dateTried: '2026-01-01' }), p('undated', 'flower', { look: 8 })],
      { filter: 'all', rankBy: 'overall' },
    );
    expect(rows.map((r) => r.product.id)).toEqual(['new', 'old', 'undated']);
  });

  it('filtering to a type renumbers ranks from 1 and the podium follows', () => {
    const rows = rankProducts([p('f', 'flower', { look: 9 }), p('e', 'edibles', { taste: 5 })], { filter: 'edibles', rankBy: 'overall' });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ rank: 1, podium: 1 });
  });

  it('under another Rank by, the three tiers follow that order', () => {
    const rows = rankProducts(
      [1, 2, 3, 4, 5].map((n) => p(`t${n}`, 'flower', { taste: n, look: 10 - n })),
      { filter: 'all', rankBy: 'taste' },
    );
    expect(rows.map((r) => [r.product.id, r.podium])).toEqual([['t5', 1], ['t4', 2], ['t3', 3], ['t2', null], ['t1', null]]);
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

  it('options under All: Overall then the category union in canonical order; no price, VFM or hit time', () => {
    expect(rankByOptions('all', { money: true }).map((o) => o.key)).toEqual([
      'overall', 'used', 'look', 'consistency', 'smell', 'taste', 'burn', 'high',
    ]);
  });

  it('options under a type include price by unit and VFM, then its categories', () => {
    expect(rankByOptions('edibles', { money: true })).toEqual([
      { key: 'overall', label: 'Overall' },
      { key: 'used', label: 'Most used' },
      { key: 'price', label: 'Price per mg' },
      { key: 'vfm', label: 'Value for money' },
      { key: 'taste', label: 'Taste' },
      { key: 'high', label: 'High' },
    ]);
    expect(rankByOptions('flower', { money: true })[2]!.label).toBe('Price per gram');
    expect(rankByOptions('pre_roll', { money: true }).map((o) => o.key)).not.toContain('look');
  });

  it('a followed person’s view never offers price, VFM or Most used (D44)', () => {
    for (const filter of ['all', 'flower'] as const) {
      const keys = rankByOptions(filter, { money: false }).map((o) => o.key);
      expect(keys).not.toContain('price');
      expect(keys).not.toContain('vfm');
      expect(keys).not.toContain('used');
    }
    expect(resolveViewState({ filter: 'all', rankBy: 'used' }, { money: false })).toMatchObject({ rankBy: 'overall', changed: true });
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

describe('Podium product pages (D22)', () => {
  const list = [
    p('a', 'flower', { look: 9 }),
    p('b', 'flower', { look: 8, taste: 5 }),
    p('c', 'edibles', { taste: 9.5, high: 9.5 }),
    p('d', 'flower', { look: 7, taste: 9 }),
    p('e', 'flower', { look: 6 }),
    p('f', 'flower', { look: 5.5 }),
    p('u', 'flower', {}),
  ];

  it('a page gets the place its row has, under the same filter and Rank by', () => {
    const all = { filter: 'all', rankBy: 'overall' } as const;
    expect(['c', 'a', 'd', 'b', 'e', 'f', 'u'].map((id) => podiumPlace(list, id, all))).toEqual([1, 2, 3, null, null, null, null]);
    // Filtered to Flower the edible drops out and the rest move up; Rank by Taste reorders.
    expect(podiumPlace(list, 'a', { filter: 'flower', rankBy: 'overall' })).toBe(1);
    expect(podiumPlace(list, 'b', { filter: 'flower', rankBy: 'overall' })).toBe(3); // a 9 · d 8 · b 6.5 · e 6
    expect(podiumPlace(list, 'e', { filter: 'flower', rankBy: 'overall' })).toBeNull(); // 4th: no place (D39)
    expect(podiumPlace(list, 'c', { filter: 'flower', rankBy: 'overall' })).toBeNull();
    expect(podiumPlace(list, 'd', { filter: 'all', rankBy: 'taste' })).toBe(2); // after the edible's 9.5
    expect(podiumPlace(list, 'a', { filter: 'all', rankBy: 'taste' })).toBeNull(); // no Taste: hidden, so no place
  });

  it('an unrated product or one not in the list (archived) never gets a place', () => {
    const few = [p('x', 'flower', { look: 8 }), p('u', 'flower', {})];
    expect(podiumPlace(few, 'u', { filter: 'all', rankBy: 'overall' })).toBeNull();
    expect(podiumPlace(few, 'gone', { filter: 'all', rankBy: 'overall' })).toBeNull();
  });

  it('the badge names the list it tops', () => {
    expect(podiumBadge(1, { filter: 'all', rankBy: 'overall' }, 'your')).toBe('#1 on your Leaderboard');
    expect(podiumBadge(3, { filter: 'all', rankBy: 'overall' }, 'their')).toBe('#3 on their Leaderboard');
    expect(podiumBadge(2, { filter: 'flower', rankBy: 'overall' }, 'your')).toBe('#2 in Flower');
    expect(podiumBadge(1, { filter: 'all', rankBy: 'taste' }, 'your')).toBe('#1 by Taste');
    expect(podiumBadge(3, { filter: 'flower', rankBy: 'taste' }, 'their')).toBe('#3 in Flower by Taste');
    expect(podiumBadge(3, { filter: 'edibles', rankBy: 'price' }, 'your')).toBe('#3 in Edibles by Price per mg');
    expect(podiumBadge(2, { filter: 'concentrate', rankBy: 'vfm' }, 'your')).toBe('#2 in Concentrate by Value for money');
    expect(podiumBadge(1, { filter: 'pre_roll', rankBy: 'burn' }, 'your')).toBe('#1 in Pre roll by Burn');
  });
});

describe('Most used (D44)', () => {
  const view = { filter: 'all', rankBy: 'used' } as const;
  it('most first; never smoked is left out; the top three get the tiers', () => {
    const rows = rankProducts(
      [p('a', 'flower', { look: 7 }, { smokeCount: 3 }), p('never', 'flower', { look: 9 }, { smokeCount: 0 }), p('b', 'edibles', {}, { smokeCount: 12 }), p('c', 'flower', { look: 8 }, { smokeCount: 5 }), p('d', 'flower', { look: 6 }, { smokeCount: 1 }), p('nocount', 'flower', { look: 9 })],
      view,
    );
    expect(rows.map((r) => [r.product.id, r.value, r.podium])).toEqual([
      ['b', 12, 1],
      ['c', 5, 2],
      ['a', 3, 3],
      ['d', 1, null],
    ]);
  });

  it('a tie goes to the higher Overall, unrated after rated, then the usual order', () => {
    const rows = rankProducts(
      [p('rated6', 'flower', { look: 6 }, { smokeCount: 4 }), p('unrated', 'flower', {}, { smokeCount: 4 }), p('rated9', 'flower', { look: 9 }, { smokeCount: 4 }), p('also9', 'flower', { look: 9 }, { smokeCount: 4, dateTried: '2026-09-01' })],
      view,
    );
    expect(rows.map((r) => r.product.id)).toEqual(['also9', 'rated9', 'rated6', 'unrated']);
  });

  it('follows the Type filter; nothing smoked → rank-empty; a page’s place and badge', () => {
    const list = [p('f1', 'flower', { look: 5 }, { smokeCount: 2 }), p('e1', 'edibles', { taste: 5 }, { smokeCount: 9 }), p('f2', 'flower', { look: 5 }, { smokeCount: 0 })];
    expect(rankProducts(list, { filter: 'flower', rankBy: 'used' }).map((r) => r.product.id)).toEqual(['f1']);
    expect(podiumPlace(list, 'e1', view)).toBe(1);
    expect(podiumPlace(list, 'f2', view)).toBeNull();
    expect(podiumBadge(1, view, 'your')).toBe('#1 by Most used');
    expect(podiumBadge(2, { filter: 'flower', rankBy: 'used' }, 'your')).toBe('#2 in Flower by Most used');
    const none = [p('x', 'flower', { look: 5 }, { smokeCount: 0 })];
    expect(leaderboardEmptyState(1, rankProducts(none, view).length, view)).toBe('rank-empty');
  });
});
