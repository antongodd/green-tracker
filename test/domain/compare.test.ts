import { describe, expect, it } from 'vitest';
import { compareBoards, PICKS, sameProductKey, yoursByKey, yoursFor, type MatchableProduct } from '../../shared/domain/compare';
import type { ProductTypeKey } from '../../shared/domain/productTypes';

// You against them (D82): the same-product rule and the comparison, on plain lists.

let n = 0;
const p = (name: string, source: string | null, score: number | null, over: Partial<MatchableProduct> = {}): MatchableProduct & { tieRank: number } => ({
  id: `p${++n}`,
  name,
  productType: 'flower' as ProductTypeKey,
  productTypeOther: null,
  concentrateType: null,
  concentrateTypeOther: null,
  source,
  ratings: score === null ? {} : { look: score, smell: score, taste: score, burn: score },
  tieRank: n,
  ...over,
});

describe('the same product (D82)', () => {
  it('is the same name AND the same brand AND the same type; capitals, spaces and punctuation don’t count', () => {
    expect(sameProductKey(p("Barney's Kush", 'Cloud Nine', 8))).toBe(sameProductKey(p('barneys  kush', 'CLOUD-NINE!', 5)));
    expect(sameProductKey(p('Kush', 'Cloud Nine', 8))).not.toBe(sameProductKey(p('Kush', 'Other Co', 8)));
    expect(sameProductKey(p('Kush', 'Cloud Nine', 8))).not.toBe(sameProductKey(p('Kush', 'Cloud Nine', 8, { productType: 'pre_roll' })));
  });

  it('never matches on the name alone: no Source, no match', () => {
    expect(sameProductKey(p('Kush', null, 8))).toBeNull();
    expect(sameProductKey(p('Kush', '  ', 8))).toBeNull();
    expect(sameProductKey(p('', 'Cloud Nine', 8))).toBeNull();
  });

  it('a concentrate needs the same kind, and "Other" the same words', () => {
    const c = (kind: string, other: string | null = null) => p('Frost', 'Copper', 8, { productType: 'concentrate', concentrateType: kind, concentrateTypeOther: other });
    expect(sameProductKey(c('rosin'))).toBe(sameProductKey(c('rosin')));
    expect(sameProductKey(c('rosin'))).not.toBe(sameProductKey(c('hash')));
    expect(sameProductKey(c('other', 'Bubble'))).toBe(sameProductKey(c('other', 'bubble')));
    expect(sameProductKey(c('other', 'Bubble'))).not.toBe(sameProductKey(c('other', 'Sift')));
    const o = (words: string) => p('Thing', 'Brand', 8, { productType: 'other', productTypeOther: words });
    expect(sameProductKey(o('Tincture'))).toBe(sameProductKey(o('tincture')));
    expect(sameProductKey(o('Tincture'))).not.toBe(sameProductKey(o('Vape')));
  });

  it('where you have two of the same, your higher score is shown', () => {
    const low = p('Kush', 'Co', 6);
    const high = p('KUSH', 'co', 9);
    const yours = yoursByKey([low, high, p('Unrated', 'Co', null)]);
    expect(yoursFor(p('kush', 'Co', 7), yours)).toEqual({ id: high.id, score: 9 });
    expect(yoursFor(p('kush', null, 7), yours)).toBeNull();
  });
});

describe('Compare boards (D82)', () => {
  it('both had, brands, picks, favourites and the #1s', () => {
    const mine = [p('Gelato', 'Cloud Nine', 9), p('Frost', 'Copper', 7), p('Haze', 'Copper', 6), p('Gummy', 'Moon', 8, { productType: 'edibles' })];
    const theirs = [p('Blue', 'Moon', 9.5), p('gelato', 'cloud nine', 8), p('Frost', 'Copper', 8.5), p('Night', 'Moon', 7), p('Unrated', 'Moon', null)];
    const c = compareBoards(mine, theirs, true);
    expect(c.both).toEqual([expect.objectContaining({ name: 'Frost', yours: { id: mine[1]!.id, score: 7 } }), expect.objectContaining({ name: 'gelato', yours: { id: mine[0]!.id, score: 9 } })]);
    // Most products between you first (Moon: 1 + 3).
    expect(c.brands.map((b) => b.name)).toEqual(['Moon', 'Copper', 'cloud nine']);
    expect(c.brands[1]).toEqual({ name: 'Copper', you: { products: 2, average: 6.5 }, them: { products: 1, average: 8.5 } });
    // Rated, not had, best first.
    expect(c.picks.map((x) => x.name)).toEqual(['Blue', 'Night']);
    expect(c.you.top?.name).toBe('Gelato');
    expect(c.them.top?.name).toBe('Blue');
    expect(c.you.favouriteType).toBe('flower');
    // A tie on products (Copper 2, others 1 for me): most products wins.
    expect(c.you.favouriteBrand).toBe('Copper');
    expect(c.them.favouriteBrand).toBe('Moon');
  });

  it('a tie on the number of products goes to the higher average', () => {
    const c = compareBoards([p('A', 'Low', 5), p('B', 'High', 9)], [], true);
    expect(c.you.favouriteBrand).toBe('High');
    expect(c.them).toEqual({ products: 0, average: null, top: null, favouriteType: null, favouriteBrand: null });
    expect(c.picks).toEqual([]);
  });

  it('with their Source not shared: nothing is matched and their best are simply their best', () => {
    const theirs = [p('Gelato', null, 8), p('Blue', null, 9)];
    const c = compareBoards([p('Gelato', 'Cloud Nine', 9)], theirs, false);
    expect(c.both).toEqual([]);
    expect(c.brands).toEqual([]);
    expect(c.them.favouriteBrand).toBeNull();
    expect(c.picks.map((x) => x.name)).toEqual(['Blue', 'Gelato']);
  });

  it(`shows at most ${PICKS} picks`, () => {
    const theirs = Array.from({ length: 9 }, (_, i) => p(`P${i}`, 'B', 9 - i * 0.5));
    expect(compareBoards([], theirs, true).picks).toHaveLength(PICKS);
  });
});
