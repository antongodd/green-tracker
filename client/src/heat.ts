// Leaderboard heat (D30): rows below the podium glow in their score's colour
// (shared/domain/heat.ts), styled by `.row.heat` in styles.css.
import { scoreHeat } from '../../shared/domain/heat';
import type { Podium, RankBy } from '../../shared/domain/leaderboard';

/** Extra props for a row: the `heat` class and its colour, or nothing (podium, price, VFM, unrated). */
export function heatStyle(podium: Podium | null, rankBy: RankBy, value: number | null): { 'data-heat'?: string; style?: Record<string, string> } {
  const colour = podium ? null : scoreHeat(rankBy, value);
  return colour ? { 'data-heat': colour, style: { '--heat': colour } } : {};
}
