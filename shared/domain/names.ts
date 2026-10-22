// Brands and suppliers (D59): the names in Source (the brand) and in each purchase's Supplier
// (where it was bought), worked out from the products themselves; nothing new is stored.
// One list for both fields, since a coffeeshop with no brand is often both.
import { autoCapitalise } from './capitalise';
import { normaliseSearch } from './countries';
import { paidInMain } from './money';

/**
 * Two names are the same name when this matches: capitals, accents, spaces and punctuation
 * don't count ("Barney's", "barneys", "BARNEY S" → "barneys"; "Green House" = "Greenhouse").
 */
export const nameKey = (s: string): string => normaliseSearch(s).replace(/ /g, '');

/** What a name is worked out from: your products (Source, purchases) or a friend's (Source only). */
export interface NamedProduct {
  source: string | null;
  purchases?: readonly { supplier: string | null }[];
  archived?: boolean;
}

export interface UsedName {
  /** The spelling shown: the one used most (ties: one starting with a capital, then A–Z). */
  name: string;
  key: string;
  /** Products using it in either field, each counted once. */
  products: number;
  /** Of those, how many have it as their Source / bought there. */
  brand: number;
  shop: number;
}

/** Whether a product has this name as its Source (brand) and/or a purchase's Supplier (shop). */
export function nameRoles(p: NamedProduct, key: string): { brand: boolean; shop: boolean } {
  return {
    brand: !!p.source && nameKey(p.source) === key,
    shop: (p.purchases ?? []).some((x) => !!x.supplier && nameKey(x.supplier) === key),
  };
}

/** Every name on these products, most used first, then A–Z. Archived products are left out. */
export function usedNames(products: readonly NamedProduct[]): UsedName[] {
  const byKey = new Map<string, { spellings: Map<string, number>; products: number; brand: number; shop: number }>();
  for (const p of products) {
    if (p.archived) continue;
    const seen = new Map<string, { brand: boolean; shop: boolean }>();
    const use = (raw: string | null, role: 'brand' | 'shop') => {
      const name = raw?.trim();
      if (!name) return;
      const key = nameKey(name);
      if (!key) return;
      let n = byKey.get(key);
      if (!n) byKey.set(key, (n = { spellings: new Map(), products: 0, brand: 0, shop: 0 }));
      n.spellings.set(name, (n.spellings.get(name) ?? 0) + 1);
      const roles = seen.get(key) ?? { brand: false, shop: false };
      roles[role] = true;
      seen.set(key, roles);
    };
    use(p.source, 'brand');
    for (const x of p.purchases ?? []) use(x.supplier, 'shop');
    for (const [key, roles] of seen) {
      const n = byKey.get(key)!;
      n.products++;
      if (roles.brand) n.brand++;
      if (roles.shop) n.shop++;
    }
  }
  const capital = (s: string) => (autoCapitalise(s) === s ? 0 : 1);
  return [...byKey]
    .map(([key, n]) => ({
      key,
      name: [...n.spellings].sort((a, b) => b[1] - a[1] || capital(a[0]) - capital(b[0]) || a[0].localeCompare(b[0]))[0]![0],
      products: n.products,
      brand: n.brand,
      shop: n.shop,
    }))
    .sort((a, b) => b.products - a.products || a.name.localeCompare(b.name));
}

/** The name as it will be saved: the spelling you already use when it's the same name, else as typed (capitalised). */
export function canonicalName(typed: string, used: readonly UsedName[]): string {
  const t = typed.trim();
  if (!t) return '';
  const key = nameKey(t);
  return used.find((n) => n.key === key)?.name ?? autoCapitalise(t);
}

/** Letters apart (insertions, deletions, swaps of one letter for another). */
function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length]!;
}

/** Whether a name's words (or the whole name, ignoring spaces) start with what's typed. */
export function matchesName(name: string, typed: string): boolean {
  const q = nameKey(typed);
  if (!q) return true;
  return nameKey(name).startsWith(q) || ` ${normaliseSearch(name)}`.includes(` ${normaliseSearch(typed)}`);
}

export interface Suggestions {
  names: UsedName[];
  /** True when nothing matched and these are near misses ("Did you mean"). */
  typo: boolean;
  /** The spelling it will be saved as, when what's typed is a name you use, spelt differently. */
  savedAs: string | null;
}

export const SUGGESTION_LIMIT = 4;

/**
 * The names offered under a box as you type (D59). Nothing typed: the most used. Typed: names
 * whose words (or the whole name) start with it, most used first. Nothing starts with it and it's
 * 4+ letters: names a letter or two away (a typo). Nothing once it is exactly a name you use.
 * `first` (Supplier: the product's Source) goes first whenever it matches.
 */
export function suggestNames(used: readonly UsedName[], typed: string, opts: { first?: string | null; limit?: number } = {}): Suggestions {
  const limit = opts.limit ?? SUGGESTION_LIMIT;
  let list = [...used];
  const first = opts.first?.trim();
  if (first && nameKey(first)) {
    const key = nameKey(first);
    const known = list.find((n) => n.key === key);
    list = [known ?? { name: autoCapitalise(first), key, products: 0, brand: 0, shop: 0 }, ...list.filter((n) => n.key !== key)];
  }
  const t = typed.trim();
  const q = nameKey(t);
  if (!q) return { names: list.slice(0, limit), typo: false, savedAs: null };
  const exact = list.find((n) => n.key === q);
  if (exact) return { names: [], typo: false, savedAs: exact.name !== t ? exact.name : null };
  const starts = list.filter((n) => matchesName(n.name, t));
  if (starts.length) return { names: starts.slice(0, limit), typo: false, savedAs: null };
  if (q.length < 4) return { names: [], typo: false, savedAs: null };
  const allowed = q.length < 6 ? 1 : 2;
  const near = list
    .map((n) => ({ n, d: Math.min(distance(q, n.key), n.key.length > q.length ? distance(q, n.key.slice(0, q.length)) : Infinity) }))
    .filter((x) => x.d <= allowed)
    .sort((a, b) => a.d - b.d)
    .map((x) => x.n);
  return { names: near.slice(0, limit), typo: near.length > 0, savedAs: null };
}

/** The products with this name, as their Source and/or a purchase's Supplier; archived ones left out. */
export function productsNamed<P extends NamedProduct>(products: readonly P[], key: string): { product: P; brand: boolean; shop: boolean }[] {
  return products.filter((p) => !p.archived).map((product) => ({ product, ...nameRoles(product, key) })).filter((r) => r.brand || r.shop);
}

type Spending = NamedProduct & { purchases?: readonly { supplier: string | null; totalPaid: number; rate?: number }[] };

/**
 * What you spent on this name, as a brand and/or where you bought (D62): every purchase of a
 * product with it as its Source, and every purchase bought there, each counted once
 * (archived products left out). In the main currency: each purchase at its saved rate (D66).
 */
export function spentOn(products: readonly Spending[], key: string): number {
  let total = 0;
  for (const p of products) {
    if (p.archived) continue;
    const brand = !!p.source && nameKey(p.source) === key;
    for (const x of p.purchases ?? []) if (brand || (x.supplier && nameKey(x.supplier) === key)) total += paidInMain(x);
  }
  return Math.round(total * 100) / 100;
}
