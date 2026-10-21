// Leaderboard heat (D30): rows without a colour band (D48) glow in their score's colour
// (shared/domain/heat.ts), styled by `.row[data-heat]` in styles.css.
import { scoreHeat } from '../../shared/domain/heat';
import type { Band } from '../../shared/domain/gems';
import type { RankBy } from '../../shared/domain/leaderboard';

/** Extra props for a row: the heat colour, or nothing (a colour band, price, VFM, unrated). */
export function heatStyle(band: Band | null, rankBy: RankBy, value: number | null): { 'data-heat'?: string; style?: Record<string, string> } {
  const colour = band ? null : scoreHeat(rankBy, value);
  return colour ? { 'data-heat': colour, style: { '--heat': colour } } : {};
}
