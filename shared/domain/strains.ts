// Strainz (D92): your products grouped by strain. A strain is a product's Name (the owner: "you put
// Zkittlez as the name, and live rosin as the type"), matched like Sources' names (nameKey: capitals,
// accents, spaces and punctuation don't count), so "Zkittlez" and "zkittlez " are one strain and
// "Cookies Zkittlez" another. Worked out from the products themselves; nothing new is stored.
import { pricePerGramEquivalent, valueForMoney, type Purchase } from './money';
import { nameKey } from './names';
import { productType, STRAIN_TYPES, type StrainTypeKey } from './productTypes';
import { overall, type Ratings } from './ratings';
import { autoCapitalise } from './capitalise';

/** What a strain is worked out from: one of your products. */
export interface StrainProduct {
  id: string;
  name: string;
  productType: string;
  strainType: StrainTypeKey | null;
  ratings: Ratings;
  source: string | null;
  dateTried: string | null;
  createdAt: number;
  purchases: readonly Purchase[];
  archived?: boolean;
}

/** A Log entry with no Leaderboard product of its name: "Unranked" (D92, the Log folded in; "Tried, not rated" until 0.82.0). */
export interface StrainEntry {
  id: string;
  name: string;
  country: string | null;
  createdAt: number;
  /** D50: an entry returned from the Leaderboard keeps its product; it still counts as not rated. */
  kept?: unknown;
}

export interface Strain<P extends StrainProduct = StrainProduct> {
  key: string;
  /** The spelling shown: the one used most (ties: one starting with a capital, then A–Z). */
  name: string;
  /** Best first (by Overall; unrated last). */
  products: P[];
  /** The average Overall of its rated products; null when none is rated. */
  average: number | null;
  best: { product: P; score: number } | null;
  lowest: { product: P; score: number } | null;
  /** The strain type most of its products have, or null. */
  strainType: StrainTypeKey | null;
  /** Its products' types, most used first (labels: Flower, Live rosin…). */
  kinds: string[];
  /** Its products' Sources, most used first. */
  sources: string[];
  /** YYYY-MM-DD: Date tried, or the day it was added when there's none. */
  firstTried: string;
  lastTried: string;
  /** The average latest price for the same effect as a gram of flower (D67), of those with one. */
  pricePerGram: number | null;
  /** The average value for money (D67), of those with one. */
  valueForMoney: number | null;
}

const day = (p: Pick<StrainProduct, 'dateTried' | 'createdAt'>) => p.dateTried ?? new Date(p.createdAt).toISOString().slice(0, 10);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const capital = (s: string) => (autoCapitalise(s) === s ? 0 : 1);

/** The spelling used most (ties: one starting with a capital, then A–Z). */
function shownSpelling(names: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n.trim(), (counts.get(n.trim()) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || capital(a[0]) - capital(b[0]) || a[0].localeCompare(b[0]))[0]![0];
}

/** Values most used first, then A–Z. */
function mostUsed(values: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([v]) => v);
}

/** The label a product's type shows as, the concentrate's own kind for concentrates (Live rosin, Hash…). */
export function kindLabel(p: { productType: string; concentrateType?: string | null }): string {
  const def = productType(p.productType);
  const sub = def.subtypes?.options.find((s) => s.key === p.concentrateType);
  return sub && sub.key !== 'other' && sub.key !== 'not_set' ? sub.label : def.label;
}

/** Your strains (archived products left out), in no particular order: sort them with `sortStrains`. */
export function strainsOf<P extends StrainProduct & { concentrateType?: string | null }>(products: readonly P[]): Strain<P>[] {
  const byKey = new Map<string, P[]>();
  for (const p of products) {
    if (p.archived) continue;
    const key = nameKey(p.name);
    if (!key) continue;
    byKey.set(key, [...(byKey.get(key) ?? []), p]);
  }
  return [...byKey].map(([key, list]) => {
    const scored = list.map((p) => ({ product: p, score: overall(p.productType, p.ratings) }));
    const rated = scored.filter((s): s is { product: P; score: number } => s.score !== null).sort((a, b) => b.score - a.score);
    const products = [...rated.map((r) => r.product), ...scored.filter((s) => s.score === null).map((s) => s.product)];
    const types = mostUsed(list.flatMap((p) => (p.strainType ? [p.strainType] : [])));
    const days = list.map(day).sort();
    return {
      key,
      name: shownSpelling(list.map((p) => p.name)),
      products,
      average: mean(rated.map((r) => r.score)),
      best: rated[0] ?? null,
      lowest: rated.length > 1 ? rated.at(-1)! : null,
      strainType: (types[0] as StrainTypeKey | undefined) ?? null,
      kinds: mostUsed(list.map((p) => kindLabel(p))),
      sources: mostUsed(list.flatMap((p) => (p.source?.trim() ? [p.source.trim()] : []))),
      firstTried: days[0]!,
      lastTried: days.at(-1)!,
      pricePerGram: mean(list.flatMap((p) => pricePerGramEquivalent(p.productType, p.purchases) ?? [])),
      valueForMoney: mean(list.flatMap((p) => valueForMoney(p.productType, p.ratings, p.purchases) ?? [])),
    };
  });
}

export const strainTypeLabel = (k: StrainTypeKey | null): string | null => STRAIN_TYPES.find((s) => s.key === k)?.label ?? null;

export type StrainSort = 'average' | 'tried' | 'recent' | 'az';
export const STRAIN_SORTS: { key: StrainSort; label: string }[] = [
  { key: 'average', label: 'Best average' },
  { key: 'tried', label: 'Most tried' },
  { key: 'recent', label: 'Recently tried' },
  { key: 'az', label: 'A–Z' },
];

/** Strains in the order asked for; ties (and unrated strains, last under Best average) A–Z. */
export function sortStrains<S extends Strain<StrainProduct>>(list: readonly S[], by: StrainSort): S[] {
  const az = (a: S, b: S) => a.name.localeCompare(b.name);
  const byAverage = (a: S, b: S) => (a.average === b.average ? 0 : a.average === null ? 1 : b.average === null ? -1 : b.average - a.average);
  const out = [...list];
  if (by === 'average') out.sort((a, b) => byAverage(a, b) || b.products.length - a.products.length || az(a, b));
  if (by === 'tried') out.sort((a, b) => b.products.length - a.products.length || byAverage(a, b) || az(a, b));
  if (by === 'recent') out.sort((a, b) => b.lastTried.localeCompare(a.lastTried) || az(a, b));
  if (by === 'az') out.sort(az);
  return out;
}

/** A strain's place among your rated strains by average (1 = your favourite), or null when it's unrated. */
export function strainRank(list: readonly Strain<StrainProduct>[], key: string): number | null {
  const rated = sortStrains(
    list.filter((s) => s.average !== null),
    'average',
  );
  const i = rated.findIndex((s) => s.key === key);
  return i < 0 ? null : i + 1;
}

/**
 * Log entries with no product of their name (D92): "Unranked", one per name (the newest entry
 * opens), newest first. An entry whose name is also a product's counts towards nothing: the strain
 * already shows.
 */
export function notRated<E extends StrainEntry>(entries: readonly E[], strains: readonly Strain<StrainProduct>[]): { key: string; name: string; entry: E; count: number }[] {
  const rated = new Set(strains.map((s) => s.key));
  const byKey = new Map<string, E[]>();
  for (const e of entries) {
    const key = nameKey(e.name);
    if (!key || rated.has(key)) continue;
    byKey.set(key, [...(byKey.get(key) ?? []), e]);
  }
  return [...byKey]
    .map(([key, list]) => {
      const newest = [...list].sort((a, b) => b.createdAt - a.createdAt);
      return { key, name: shownSpelling(list.map((e) => e.name)), entry: newest[0]!, count: list.length };
    })
    .sort((a, b) => b.entry.createdAt - a.entry.createdAt || a.name.localeCompare(b.name));
}

/** The address of a strain's page. */
export const strainPath = (name: string): string => `/strainz/${encodeURIComponent(name.trim())}`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** A day as "2 Jun 2026" (the same on every phone, whatever its language). */
export function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m! - 1]} ${y}`;
}

// Friends on Strainz (D94) -----------------------------------------------------------------------------------------

/** What a friend's strain is worked out from: one of the products they share with you (social.ts's allow-list). */
export interface ScoredProduct {
  id: string;
  name: string;
  productType: string;
  ratings: Ratings;
  concentrateType?: string | null;
}

/** One strain's score: its average Overall (of rated products), how many products, and its best one. */
export interface StrainScore {
  key: string;
  name: string;
  average: number | null;
  count: number;
  best: { id: string; score: number } | null;
  /** The product to open (its best, else its first). */
  productId: string;
  productType: string;
}

/** Products by strain (the name, by nameKey), each with its average and best; the spelling used most is shown. */
export function strainScores(products: readonly ScoredProduct[]): StrainScore[] {
  const byKey = new Map<string, ScoredProduct[]>();
  for (const p of products) {
    const key = nameKey(p.name);
    if (key) byKey.set(key, [...(byKey.get(key) ?? []), p]);
  }
  return [...byKey].map(([key, list]) => {
    const rated = list.flatMap((p) => {
      const score = overall(p.productType, p.ratings);
      return score === null ? [] : [{ p, score }];
    });
    rated.sort((a, b) => b.score - a.score);
    const top = rated[0]?.p ?? list[0]!;
    return {
      key,
      name: shownSpelling(list.map((p) => p.name)),
      average: mean(rated.map((r) => r.score)),
      count: list.length,
      best: rated[0] ? { id: rated[0].p.id, score: rated[0].score } : null,
      productId: top.id,
      productType: top.productType,
    };
  });
}

export interface StrainsAgainst {
  /** Strains you've both had: your average and theirs (best first by theirs), and their product to open. */
  both: { name: string; yours: number | null; theirs: number | null; count: number; productId: string }[];
  /** Strains only they've had (best first). */
  onlyThem: { name: string; average: number | null; count: number; productId: string; productType: string }[];
}

/**
 * Your strains against a friend's (D94): `mine` is your board (only you see what's worked out from it), `theirs` what
 * they share with you. Unrated strains sort last.
 */
export function compareStrains(mine: readonly ScoredProduct[], theirs: readonly ScoredProduct[]): StrainsAgainst {
  const yours = new Map(strainScores(mine).map((s) => [s.key, s]));
  const byScore = (a: { average: number | null }, b: { average: number | null }) => (a.average === b.average ? 0 : a.average === null ? 1 : b.average === null ? -1 : b.average - a.average);
  const them = strainScores(theirs).sort((a, b) => byScore(a, b) || a.name.localeCompare(b.name));
  return {
    both: them.filter((s) => yours.has(s.key)).map((s) => ({ name: s.name, yours: yours.get(s.key)!.average, theirs: s.average, count: s.count, productId: s.productId })),
    onlyThem: them.filter((s) => !yours.has(s.key)).map((s) => ({ name: s.name, average: s.average, count: s.count, productId: s.productId, productType: s.productType })),
  };
}
