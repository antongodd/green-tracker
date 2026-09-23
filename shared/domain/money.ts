import { unitFor } from './productTypes';
import { overall, type Ratings } from './ratings';

export interface Purchase {
  /** ISO date, YYYY-MM-DD. */
  date: string | null;
  /** Grams, or mg of THC for edibles. Optional. */
  amount: number | null;
  /** Plain £ for every type. A purchase without it is discarded on save. */
  totalPaid: number;
  supplier: string | null;
  /** Insertion order; breaks ties between purchases on the same date. */
  seq: number;
}

function hasAmount(amount: number | null | undefined): amount is number {
  return typeof amount === 'number' && Number.isFinite(amount) && amount > 0;
}

/** Price per unit = total paid ÷ amount. Full precision; null when there is no amount. */
export function unitPrice(p: Pick<Purchase, 'amount' | 'totalPaid'>): number | null {
  return hasAmount(p.amount) ? p.totalPaid / p.amount : null;
}

/** Purchases newest first: by date (undated last), then latest entered. */
export function purchasesNewestFirst<P extends Pick<Purchase, 'date' | 'seq'>>(purchases: readonly P[]): P[] {
  return [...purchases].sort((a, b) => {
    if (a.date !== b.date) {
      if (a.date === null) return 1;
      if (b.date === null) return -1;
      return a.date < b.date ? 1 : -1;
    }
    return b.seq - a.seq;
  });
}

export function latestPurchase<P extends Pick<Purchase, 'date' | 'seq'>>(purchases: readonly P[]): P | null {
  return purchasesNewestFirst(purchases)[0] ?? null;
}

/**
 * Headline price: the most recent purchase's per-unit price. If that purchase
 * has no amount there is no headline price — it does not fall back to an older one.
 */
export function headlinePrice(purchases: readonly Purchase[]): number | null {
  const latest = latestPurchase(purchases);
  return latest ? unitPrice(latest) : null;
}

/**
 * Value for money: Overall ÷ latest price per gram (per 100mg for edibles).
 * A raw ratio; needs both an Overall and a priced latest purchase with an amount.
 */
export function valueForMoney(typeKey: string, ratings: Ratings, purchases: readonly Purchase[]): number | null {
  const o = overall(typeKey, ratings);
  const price = headlinePrice(purchases);
  if (o === null || price === null || price === 0) return null;
  return o / (price * unitFor(typeKey).vfmPriceMultiplier);
}

/** Sum of purchase amounts that count towards the weight TOTAL (never edibles). Blank amounts count 0. */
export function purchasedWeight(typeKey: string, purchases: readonly Pick<Purchase, 'amount'>[]): number {
  if (!unitFor(typeKey).countsTowardsWeightTotal) return 0;
  return purchases.reduce((n, p) => n + (hasAmount(p.amount) ? p.amount : 0), 0);
}

/** A loose log entry's amount towards the Log TOTAL (never edibles). */
export function looseWeight(typeKey: string, amount: number | null): number {
  return unitFor(typeKey).countsTowardsWeightTotal && hasAmount(amount) ? amount : 0;
}
