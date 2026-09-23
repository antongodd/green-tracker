import { countryDisplay } from './countries';
import { purchasedWeight, looseWeight, type Purchase } from './money';
import { matchesFilter, type TypeFilter } from './leaderboard';

/**
 * A row in the Log. Product rows are projections drawn from the product when
 * the Log is rendered — never stored copies.
 */
export type LogRow =
  | {
      kind: 'product';
      id: string;
      name: string;
      productType: string;
      country: string | null;
      countryOther: string | null;
      hasPhoto: boolean;
      /** ms since epoch; tie-break only. */
      createdAt: number;
      purchases: readonly Pick<Purchase, 'amount'>[];
    }
  | {
      kind: 'loose';
      id: string;
      name: string;
      productType: string;
      country: string | null;
      countryOther: string | null;
      hasPhoto: boolean;
      createdAt: number;
      amount: number | null;
    };

export interface LogGroup {
  /** null = "No country". */
  country: { key: string; name: string; flag: string | null } | null;
  rows: LogRow[];
}

function compareNames(a: string, b: string): number {
  return a.localeCompare(b, 'en-GB', { sensitivity: 'accent' });
}

/** Within a group: has a photo first, then name (case-insensitive), then newest first. */
function compareRows(a: LogRow, b: LogRow): number {
  if (a.hasPhoto !== b.hasPhoto) return a.hasPhoto ? -1 : 1;
  return compareNames(a.name, b.name) || b.createdAt - a.createdAt;
}

/**
 * Group rows (non-archived products and loose entries) by country. Groups:
 * most rows first, ties alphabetical, "No country" always last. Empty groups
 * are not produced.
 */
export function groupLog(rows: readonly LogRow[], filter: TypeFilter): LogGroup[] {
  const groups = new Map<string, LogGroup>();
  for (const row of rows) {
    if (!matchesFilter(row.productType, filter)) continue;
    const country = countryDisplay(row.country, row.countryOther);
    const key = country?.key ?? '';
    let group = groups.get(key);
    if (!group) groups.set(key, (group = { country, rows: [] }));
    group.rows.push(row);
  }
  for (const g of groups.values()) g.rows.sort(compareRows);
  return [...groups.values()].sort((a, b) => {
    if (!a.country) return 1;
    if (!b.country) return -1;
    return b.rows.length - a.rows.length || compareNames(a.country.name, b.country.name);
  });
}

export interface LogTiles {
  /** Distinct names, case-insensitive, across groups and row kinds. */
  products: number;
  /** Distinct countries with a row; "No country" excluded. */
  countries: number;
  /** Grams across the whole Log, not deduped; edibles excluded. */
  totalGrams: number;
}

export function logTiles(groups: readonly LogGroup[]): LogTiles {
  const names = new Set<string>();
  let countries = 0;
  let totalGrams = 0;
  for (const g of groups) {
    if (g.country) countries++;
    for (const row of g.rows) {
      names.add(row.name.trim().toLocaleLowerCase('en-GB'));
      totalGrams +=
        row.kind === 'product' ? purchasedWeight(row.productType, row.purchases) : looseWeight(row.productType, row.amount);
    }
  }
  return { products: names.size, countries, totalGrams };
}
