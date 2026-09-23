import { unitFor } from './productTypes';

/** Round half away from zero to `dp` places, tolerant of binary floating-point error (1.005 → 1.01). */
export function round(value: number, dp: number): number {
  const factor = 10 ** dp;
  return (Math.sign(value) * Math.round(Math.abs(value) * factor + Number.EPSILON * factor)) / factor;
}

/** Scores: 1–10, one decimal place. */
export function formatScore(value: number): string {
  return round(value, 1).toFixed(1);
}

/** £ amounts to two decimal places. */
export function formatGBP(value: number): string {
  return `£${round(value, 2).toFixed(2)}`;
}

/** Per-unit price, labelled by the type's unit: `£2.86/g`, `£0.05/mg`. */
export function formatUnitPrice(typeKey: string, price: number): string {
  return `${formatGBP(price)}/${unitFor(typeKey).amount}`;
}

/** An amount, labelled by the type's unit — an edible never shows g, anything else never mg. */
export function formatAmount(typeKey: string, amount: number): string {
  return `${trimZero(round(amount, 2).toFixed(2))}${unitFor(typeKey).amount}`;
}

/** Value for money: a raw ratio, shown to two decimal places. */
export function formatVFM(value: number): string {
  return round(value, 2).toFixed(2);
}

/**
 * TOTAL tile weight. Round the final sum (not the parts) to 1dp, drop a
 * trailing `.0`, switch to kg from 1000g, `0g` when nothing.
 */
export function formatWeightTotal(grams: number): string {
  const g = round(grams, 1);
  if (g >= 1000) return `${trimZero(round(g / 1000, 1).toFixed(1))}kg`;
  return `${trimZero(g.toFixed(1))}g`;
}

function trimZero(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}
