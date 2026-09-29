// Leaderboard heat (D30, 0.23.0): below the podium, a row glows in a colour set by its
// score, amber for 4 and below, through yellow-green, to mint for 9 and above, blended
// smoothly between these stops. Only for scores out of 10 (Overall and the rating
// categories): a higher price or value for money isn't "better", so those get none, and
// neither does an unrated row.
import type { RankBy } from './leaderboard';

export const HEAT_STOPS: readonly (readonly [number, string])[] = [
  [4, '#e0a35c'],
  [5.5, '#f0c46a'],
  [6.8, '#c8e46a'],
  [8, '#6fe39a'],
  [9, '#8df3b6'],
];

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** The heat colour for a row's ranked value, as `rgb(r, g, b)`, or null when it gets none. */
export function scoreHeat(rankBy: RankBy, value: number | null): string | null {
  if (value === null || rankBy === 'price' || rankBy === 'vfm') return null;
  const first = HEAT_STOPS[0]!;
  let [r, g, b] = rgb(first[1]);
  if (value > first[0]) {
    const upper = HEAT_STOPS.findIndex(([at]) => value <= at);
    if (upper === -1) [r, g, b] = rgb(HEAT_STOPS[HEAT_STOPS.length - 1]![1]);
    else {
      const [a, ca] = HEAT_STOPS[upper - 1]!;
      const [z, cz] = HEAT_STOPS[upper]!;
      const t = (value - a) / (z - a);
      const [x, y] = [rgb(ca), rgb(cz)];
      [r, g, b] = x.map((v, k) => Math.round(v + (y[k]! - v) * t));
    }
  }
  return `rgb(${r}, ${g}, ${b})`;
}
