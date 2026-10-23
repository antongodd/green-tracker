import {
  FILTER_TYPES,
  PRODUCT_TYPES,
  RATING_CATEGORIES,
  RATING_LABELS,
  productType,
  type RatingKey,
} from './productTypes';
import { headlinePrice, pricePerGramEquivalent, purchasedWeight, valueForMoney, type Purchase } from './money';
import { categoryValue, overall, type Ratings } from './ratings';
import { bandName, scoreBand, type Appearance, type Band } from './gems';

export interface RankableProduct {
  id: string;
  name: string;
  productType: string;
  ratings: Ratings;
  /** ISO date, YYYY-MM-DD. Absent in a follower's view (D3) — `tieRank` stands in. */
  dateTried?: string | null;
  /** A follower's view: the owner's tie-break order, precomputed by the server (D3). */
  tieRank?: number;
  /** Absent in a follower's view — money is never sent to followers. */
  purchases?: readonly Purchase[];
}

export type TypeFilter = 'all' | (typeof FILTER_TYPES)[number]['key'];
export type RankBy = 'overall' | 'price' | 'vfm' | RatingKey;

export interface Option<K extends string> {
  key: K;
  label: string;
}

export function filterOptions(): Option<TypeFilter>[] {
  return [{ key: 'all', label: 'All' }, ...FILTER_TYPES.map((t) => ({ key: t.key, label: t.label }))];
}

function isTypeFilter(value: unknown): value is TypeFilter {
  return value === 'all' || FILTER_TYPES.some((t) => t.key === value);
}

/**
 * Rank by options, derived from the rating sets and the filter.
 * All: Overall, price and value for money (D67: compared as the same effect as a gram of
 * flower), then the de-duplicated union of every type's categories (canonical order).
 * A type: Overall, price (by unit), value for money, then that type's categories.
 * `money: false` (a followed person's view) never offers price or VFM.
 * Hit time is never offered. (Most used went with Smokes, D60.)
 */
export function rankByOptions(filter: TypeFilter, { money }: { money: boolean }): Option<RankBy>[] {
  const options: Option<RankBy>[] = [{ key: 'overall', label: 'Overall' }];
  if (filter === 'all') {
    if (money) options.push({ key: 'price', label: 'Price' }, { key: 'vfm', label: 'Value for money' });
    // Every type's set counts towards the union, including Other/Not set.
    const union = new Set(PRODUCT_TYPES.flatMap((t) => t.ratingSet.map((s) => s.key)));
    for (const key of RATING_CATEGORIES) if (union.has(key)) options.push({ key, label: RATING_LABELS[key] });
    return options;
  }
  const type = productType(filter);
  if (money) {
    options.push({ key: 'price', label: type.unit.priceLabel }, { key: 'vfm', label: 'Value for money' });
  }
  for (const slot of type.ratingSet) options.push({ key: slot.key, label: RATING_LABELS[slot.key] });
  return options;
}

/** Caption under a row's score: OVERALL, TASTE, PRICE, VFM… */
export function rankByCaption(rankBy: RankBy): string {
  if (rankBy === 'overall') return 'OVERALL';
  if (rankBy === 'price') return 'PRICE';
  if (rankBy === 'vfm') return 'VFM';
  return RATING_LABELS[rankBy].toUpperCase();
}

export interface ViewState {
  filter: TypeFilter;
  rankBy: RankBy;
}

/**
 * Validate stored view state. An invalid filter → All. A Rank by that doesn't
 * exist under the filter (a stored Most used, D60, too) → Overall; `changed` tells the caller to
 * overwrite the stored setting.
 */
export function resolveViewState(stored: { filter?: unknown; rankBy?: unknown }, { money }: { money: boolean }) {
  const filter: TypeFilter = isTypeFilter(stored.filter) ? stored.filter : 'all';
  const valid = rankByOptions(filter, { money }).some((o) => o.key === stored.rankBy);
  const rankBy = valid ? (stored.rankBy as RankBy) : 'overall';
  return { filter, rankBy, changed: filter !== stored.filter || rankBy !== stored.rankBy };
}

/**
 * The value a product is ranked on, at full precision. null = unrated / unrankable. Price under
 * All is for the same effect as a gram of flower (D67: an edible's is the price of 20mg);
 * under one type it's that type's own unit.
 */
export function rankValue(p: RankableProduct, rankBy: RankBy, filter: TypeFilter = 'all'): number | null {
  switch (rankBy) {
    case 'overall':
      return overall(p.productType, p.ratings);
    case 'price':
      if (!p.purchases) return null;
      return filter === 'all' ? pricePerGramEquivalent(p.productType, p.purchases) : headlinePrice(p.purchases);
    case 'vfm':
      return p.purchases ? valueForMoney(p.productType, p.ratings, p.purchases) : null;
    default:
      return categoryValue(p.productType, p.ratings, rankBy);
  }
}

export interface RankedRow<P extends RankableProduct> {
  product: P;
  /** 1-based, renumbered over the visible list. */
  rank: number;
  value: number | null;
  /** Its colour band, earned by the score (D48): null below 8, unrated, or not ranked by a score. */
  band: Band | null;
  /** The top of the visible list, with something to rank it by: the row your #1 mark (crown and halo) goes on (D48). */
  first: boolean;
}

export function matchesFilter(typeKey: string, filter: TypeFilter): boolean {
  return filter === 'all' || typeKey === filter;
}

/**
 * Most recent date tried first; undated after dated; then name, then id for a stable
 * order. A follower's view has no dates: it uses the server's precomputed `tieRank`.
 */
export function tieBreak(a: RankableProduct, b: RankableProduct): number {
  if (a.tieRank !== undefined && b.tieRank !== undefined) return a.tieRank - b.tieRank;
  const da = a.dateTried ?? null;
  const db = b.dateTried ?? null;
  if (da !== db) {
    if (da === null) return 1;
    if (db === null) return -1;
    return da < db ? 1 : -1;
  }
  return a.name.localeCompare(b.name, 'en-GB', { sensitivity: 'accent' }) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * Rank a list (the caller passes non-archived products only). Highest first
 * for everything, including price. Under Overall, unrated products sort to the
 * bottom; under any other Rank by, products that can't be ranked are hidden.
 */
export function rankProducts<P extends RankableProduct>(products: readonly P[], view: ViewState): RankedRow<P>[] {
  const scored = products
    .filter((p) => matchesFilter(p.productType, view.filter))
    .map((product) => ({ product, value: rankValue(product, view.rankBy, view.filter) }))
    .filter((r) => view.rankBy === 'overall' || r.value !== null);
  scored.sort((a, b) => {
    if (a.value !== b.value) {
      if (a.value === null) return 1;
      if (b.value === null) return -1;
      return b.value - a.value;
    }
    return tieBreak(a.product, b.product);
  });
  return scored.map((r, i) => ({ ...r, rank: i + 1, band: scoreBand(view.rankBy, r.value), first: i === 0 && r.value !== null }));
}

/**
 * A product's row on the Leaderboard under this view (same filter, same Rank by), so its
 * page always matches the row (D22, D48). null when it isn't in the list (archived, or
 * hidden because it can't be ranked by this).
 */
export function boardPlace<P extends RankableProduct>(products: readonly P[], id: string, view: ViewState): RankedRow<P> | null {
  return rankProducts(products, view).find((r) => r.product.id === id) ?? null;
}

/**
 * Where a product stands: "#1 on your Leaderboard" under All and Overall, otherwise the
 * list it's in — "#2 in Flower", "#1 by Taste", "#3 in Flower by Taste".
 */
export function placeText(rank: number, view: ViewState, whose: 'your' | 'their'): string {
  if (view.filter === 'all' && view.rankBy === 'overall') return `#${rank} on ${whose} Leaderboard`;
  const parts = [`#${rank}`];
  if (view.filter !== 'all') parts.push(`in ${productType(view.filter).label}`);
  if (view.rankBy !== 'overall') {
    const label = rankByOptions(view.filter, { money: true }).find((o) => o.key === view.rankBy)?.label ?? RATING_LABELS[view.rankBy as RatingKey];
    parts.push(`by ${label}`);
  }
  return parts.join(' ');
}

/**
 * The badge on a product's page (D48), or null for none: a product in a band names its
 * colour and place ("Amethyst · #3 on your Leaderboard"); your #1 without a band (below 8,
 * or ranked by price or value for money) gets its place when #1 is marked.
 */
export function placeBadge(place: Pick<RankedRow<RankableProduct>, 'rank' | 'band' | 'first'>, view: ViewState, whose: 'your' | 'their', appearance: Appearance): string | null {
  const where = placeText(place.rank, view, whose);
  if (place.band) return `${bandName(appearance.preset, place.band)} · ${where}`;
  return place.first && appearance.markFirst ? where : null;
}

export interface LeaderboardTiles {
  products: number;
  /** Mean Overall across rated visible products; null when none rated. */
  average: number | null;
  /** Lifetime grams purchased across visible products (edibles excluded). null in a follower's view. */
  totalGrams: number | null;
}

export function leaderboardTiles(visible: readonly RankableProduct[]): LeaderboardTiles {
  const overalls = visible.map((p) => overall(p.productType, p.ratings)).filter((o): o is number => o !== null);
  const money = visible.every((p) => p.purchases !== undefined);
  return {
    products: visible.length,
    average: overalls.length ? overalls.reduce((a, b) => a + b, 0) / overalls.length : null,
    totalGrams: money ? visible.reduce((n, p) => n + purchasedWeight(p.productType, p.purchases!), 0) : null,
  };
}

export type LeaderboardEmptyState = 'empty' | 'filtered-empty' | 'rank-empty' | null;

/** Which empty state to show. Never claims the app is empty when it isn't; rank-empty wins over filtered-empty. */
export function leaderboardEmptyState(totalProducts: number, visibleRows: number, view: ViewState): LeaderboardEmptyState {
  if (totalProducts === 0) return 'empty';
  if (visibleRows > 0) return null;
  return view.rankBy !== 'overall' ? 'rank-empty' : 'filtered-empty';
}
