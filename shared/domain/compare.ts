// You against them (D82): "You've had this too" and Compare boards. Worked out only from what a
// friend already shares (their SharedProducts, D45) and your own products; nothing new is shared.
import { leaderboardTiles, rankProducts, type RankableProduct } from './leaderboard';
import { nameKey } from './names';
import { productType, type ProductTypeKey } from './productTypes';
import { overall, type Ratings } from './ratings';

/** What the same-product rule needs from a product: yours (Product) or theirs (SharedProduct). */
export interface MatchableProduct {
  id: string;
  name: string;
  productType: ProductTypeKey;
  productTypeOther: string | null;
  concentrateType: string | null;
  concentrateTypeOther: string | null;
  source: string | null;
  ratings: Ratings;
}

/**
 * Two products are the same product when this matches (Anton, 2026-11-03): the same name AND the
 * same brand (Source) AND the same type, with capitals, accents, spaces and punctuation not counting
 * (D59's nameKey). A concentrate also needs the same kind (shatter ≠ rosin); "Other" types the same
 * words. No Source (theirs not shared, or never filled in) → null: the same name alone is never the
 * same product.
 */
export function sameProductKey(p: MatchableProduct): string | null {
  const name = nameKey(p.name);
  const brand = p.source ? nameKey(p.source) : '';
  if (!name || !brand) return null;
  const def = productType(p.productType);
  const parts: string[] = [p.productType];
  if (def.freeText) parts.push(nameKey(p.productTypeOther ?? ''));
  if (def.subtypes) {
    const kind = p.concentrateType ?? def.subtypes.default;
    parts.push(kind, kind === 'other' ? nameKey(p.concentrateTypeOther ?? '') : '');
  }
  return [...parts, name, brand].join('|');
}

/** Your side of a match: your product (it opens for you) and your Overall. */
export interface YourScore {
  id: string;
  score: number | null;
}

/** Your products by same-product key; where you have two of the same, the higher Overall wins. */
export function yoursByKey(mine: readonly MatchableProduct[]): Map<string, YourScore> {
  const out = new Map<string, YourScore>();
  for (const p of mine) {
    const key = sameProductKey(p);
    if (!key) continue;
    const score = overall(p.productType, p.ratings);
    const had = out.get(key);
    if (!had || (score ?? -1) > (had.score ?? -1)) out.set(key, { id: p.id, score });
  }
  return out;
}

/** Your score for their product, or null when you haven't had the same product. */
export function yoursFor(theirs: MatchableProduct, mine: Map<string, YourScore>): YourScore | null {
  const key = sameProductKey(theirs);
  return key ? (mine.get(key) ?? null) : null;
}

/** A product as Compare shows it: name, type, brand and Overall. Never a price, supplier or date. */
export interface ComparedProduct {
  id: string;
  name: string;
  productType: ProductTypeKey;
  productTypeOther: string | null;
  source: string | null;
  score: number | null;
}

export interface CompareSide {
  products: number;
  average: number | null;
  /** Their #1 (or yours), under All and Overall; null when nothing is rated. */
  top: ComparedProduct | null;
  /** The type with the most products (a tie: the higher average, then the list's order). */
  favouriteType: ProductTypeKey | null;
  /** The Source with the most products (a tie: the higher average, then A to Z); null when not shared. */
  favouriteBrand: string | null;
}

export interface Comparison {
  you: CompareSide;
  them: CompareSide;
  /** Their Source is shared, so the same-product and brand parts can be worked out. */
  sourceShared: boolean;
  /** Products you've both had, their score highest first. Empty when Source isn't shared. */
  both: { name: string; productType: ProductTypeKey; productTypeOther: string | null; source: string | null; yours: YourScore; theirs: { id: string; score: number | null } }[];
  /** Brands you've both tried, with each side's count and average; most products between you first. */
  brands: { name: string; you: { products: number; average: number | null }; them: { products: number; average: number | null } }[];
  /** Their best rated products (up to 5) that you haven't had; with Source not shared, simply their best. */
  picks: ComparedProduct[];
}

export const PICKS = 5;

type Comparable = MatchableProduct & RankableProduct;

const compared = (p: MatchableProduct): ComparedProduct => ({
  id: p.id,
  name: p.name,
  productType: p.productType,
  productTypeOther: p.productTypeOther,
  source: p.source,
  score: overall(p.productType, p.ratings),
});

const avg = (list: readonly MatchableProduct[]) => leaderboardTiles(list as unknown as RankableProduct[]).average;

/** The group with the most products; a tie goes to the higher average, then to `order`. */
function favourite<K>(groups: Map<K, MatchableProduct[]>, order: (a: K, b: K) => number): K | null {
  let best: { key: K; n: number; avg: number } | null = null;
  for (const key of [...groups.keys()].sort(order)) {
    const list = groups.get(key)!;
    const cand = { key, n: list.length, avg: avg(list) ?? -1 };
    if (!best || cand.n > best.n || (cand.n === best.n && cand.avg > best.avg)) best = cand;
  }
  return best?.key ?? null;
}

function byBrand(list: readonly MatchableProduct[]): Map<string, MatchableProduct[]> {
  const m = new Map<string, MatchableProduct[]>();
  for (const p of list) {
    const k = p.source ? nameKey(p.source) : '';
    if (k) m.set(k, [...(m.get(k) ?? []), p]);
  }
  return m;
}

function side(list: readonly Comparable[], withBrand: boolean): CompareSide {
  const ranked = rankProducts(list, { filter: 'all', rankBy: 'overall' });
  const types = new Map<ProductTypeKey, MatchableProduct[]>();
  for (const p of list) types.set(p.productType, [...(types.get(p.productType) ?? []), p]);
  const typeOrder = (a: ProductTypeKey, b: ProductTypeKey) => ranked.findIndex((r) => r.product.productType === a) - ranked.findIndex((r) => r.product.productType === b);
  const brands = byBrand(list);
  const brandKey = withBrand ? favourite(brands, (a, b) => (a < b ? -1 : a > b ? 1 : 0)) : null;
  return {
    products: list.length,
    average: avg(list),
    top: ranked[0]?.first ? compared(ranked[0].product) : null,
    favouriteType: favourite(types, typeOrder),
    favouriteBrand: brandKey ? brandName(brands.get(brandKey)!) : null,
  };
}

/** A brand's name as written most often in this list (first in the list on a tie). */
function brandName(list: readonly MatchableProduct[]): string {
  const counts = new Map<string, number>();
  for (const p of list) counts.set(p.source!.trim(), (counts.get(p.source!.trim()) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
}

/**
 * The whole comparison. `mine`: your products as your own Leaderboard has them (not archived, not
 * returned to the Log; your private ones too, since only you see this). `theirs`: exactly what their
 * Privacy shares with you (server: shareProducts), so nothing else can show. `sourceShared`: their
 * Privacy's Source switch (when off, their products' Source is already blank).
 */
export function compareBoards(mine: readonly Comparable[], theirs: readonly Comparable[], sourceShared: boolean): Comparison {
  const yours = yoursByKey(mine);
  const theirRanked = rankProducts(theirs, { filter: 'all', rankBy: 'overall' }).map((r) => r.product);

  const both: Comparison['both'] = [];
  const hadIds = new Set<string>();
  for (const p of theirRanked) {
    const y = yoursFor(p, yours);
    if (!y || hadIds.has(y.id)) continue;
    hadIds.add(y.id);
    both.push({ name: p.name, productType: p.productType, productTypeOther: p.productTypeOther, source: p.source, yours: y, theirs: { id: p.id, score: overall(p.productType, p.ratings) } });
  }
  const matched = new Set(theirRanked.filter((p) => yoursFor(p, yours)).map((p) => p.id));

  const myBrands = byBrand(mine);
  const theirBrands = byBrand(theirs);
  const brands: Comparison['brands'] = [];
  for (const [k, list] of theirBrands) {
    const my = myBrands.get(k);
    if (!my) continue;
    brands.push({ name: brandName(list), you: { products: my.length, average: avg(my) }, them: { products: list.length, average: avg(list) } });
  }
  brands.sort((a, b) => b.you.products + b.them.products - (a.you.products + a.them.products) || a.name.localeCompare(b.name, 'en-GB'));

  const picks = theirRanked
    .filter((p) => overall(p.productType, p.ratings) !== null && !matched.has(p.id))
    .slice(0, PICKS)
    .map(compared);

  return { you: side(mine, true), them: side(theirs, sourceShared), sourceShared, both, brands, picks };
}
