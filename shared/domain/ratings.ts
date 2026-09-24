import { productType, RATING_LABELS, type RatingKey } from './productTypes';

/** Stored ratings. A blank is absent, never zero. Ratings outside the current type's set are kept but ignored. */
export type Ratings = Partial<Record<RatingKey, number>>;

export const RATING_MIN = 1;
export const RATING_MAX = 10;

export function isValidRating(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= RATING_MIN && value <= RATING_MAX;
}

function rated(ratings: Ratings, key: RatingKey): number | null {
  const v = ratings[key];
  return isValidRating(v) ? v : null;
}

/**
 * Overall: weighted mean of the contributing categories that are rated,
 * renormalised across what's present. null when none are rated (sorts as unrated).
 */
export function overall(typeKey: string, ratings: Ratings): number | null {
  let sum = 0;
  let weights = 0;
  for (const slot of productType(typeKey).ratingSet) {
    if (slot.weight === 0) continue;
    const v = rated(ratings, slot.key);
    if (v === null) continue;
    sum += v * slot.weight;
    weights += slot.weight;
  }
  return weights === 0 ? null : sum / weights;
}

/** A single category's value for ranking — only if it belongs to this type's set and is rated. */
export function categoryValue(typeKey: string, ratings: Ratings, key: RatingKey): number | null {
  if (!productType(typeKey).ratingSet.some((s) => s.key === key)) return null;
  return rated(ratings, key);
}

/** "Rated N of N categories". High always counts; hit time never does. */
export function ratedCount(typeKey: string, ratings: Ratings): { rated: number; of: number } {
  const set = productType(typeKey).ratingSet;
  return { rated: set.filter((s) => rated(ratings, s.key) !== null).length, of: set.length };
}

/** Per-type editor text explaining how Overall is worked out. Never fixed text. */
export function overallExplanation(typeKey: string): string {
  const set = productType(typeKey).ratingSet;
  const feeding = set.filter((s) => s.weight > 0);
  const notFeeding = set.filter((s) => s.weight === 0).map((s) => RATING_LABELS[s.key]);
  const allEqual = feeding.every((s) => s.weight === feeding[0]!.weight);
  let text: string;
  if (allEqual) {
    text = `Overall is the average of ${list(feeding.map((s) => RATING_LABELS[s.key]))}.`;
  } else {
    const total = feeding.reduce((n, s) => n + s.weight, 0);
    text = `Overall is ${list(feeding.map((s) => `${RATING_LABELS[s.key]} ${fraction(s.weight, total)}`))}.`;
  }
  if (notFeeding.length) text += ` ${list(notFeeding)} ${notFeeding.length === 1 ? 'is' : 'are'} rated but doesn't count.`;
  return text + ' Blank categories are left out.';
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function fraction(n: number, d: number): string {
  const g = gcd(n, d);
  const glyphs: Record<string, string> = { '1/3': '⅓', '2/3': '⅔', '1/2': '½', '1/4': '¼', '3/4': '¾' };
  const key = `${n / g}/${d / g}`;
  return glyphs[key] ?? key;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Hit time (edibles only): 0–180 minutes in 15-minute steps. Not a rating. */
export const HIT_TIME_STEP = 15;
export const HIT_TIME_MAX = 180;

export function isValidHitTime(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= HIT_TIME_MAX && value % HIT_TIME_STEP === 0
  );
}

export function formatHitTime(minutes: number | null | undefined): string {
  if (minutes == null) return 'Not set';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
