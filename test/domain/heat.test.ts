import { describe, expect, it } from 'vitest';
import { scoreHeat } from '../../shared/domain/heat';

describe('Leaderboard heat (D30)', () => {
  it('is amber at 4 and below and mint at 9 and above', () => {
    expect(scoreHeat('overall', 4)).toBe('rgb(224, 163, 92)');
    expect(scoreHeat('overall', 1)).toBe('rgb(224, 163, 92)');
    expect(scoreHeat('overall', 9)).toBe('rgb(141, 243, 182)');
    expect(scoreHeat('taste', 10)).toBe('rgb(141, 243, 182)');
  });
  it('passes through each stop and blends smoothly between them', () => {
    expect(scoreHeat('overall', 5.5)).toBe('rgb(240, 196, 106)');
    expect(scoreHeat('overall', 6.8)).toBe('rgb(200, 228, 106)');
    expect(scoreHeat('overall', 8)).toBe('rgb(111, 227, 154)');
    // Halfway between 8 (111, 227, 154) and 9 (141, 243, 182).
    expect(scoreHeat('overall', 8.5)).toBe('rgb(126, 235, 168)');
    // The hue never moves back towards amber as the score rises (8 → 9 lightens green to mint at
    // almost the same hue, within a degree).
    const hue = (v: number) => {
      const [r, g, b] = scoreHeat('overall', v)!.match(/\d+/g)!.map((n) => Number(n) / 255) as [number, number, number];
      const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
      const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return (h * 60 + 360) % 360;
    };
    for (let v = 4; v < 9; v += 0.1) expect(hue(v + 0.1)).toBeGreaterThanOrEqual(hue(v) - 1);
  });
  it('follows any rating category, but never price, value for money or an unrated row', () => {
    expect(scoreHeat('look', 7)).toBe(scoreHeat('overall', 7));
    expect(scoreHeat('price', 7)).toBeNull();
    expect(scoreHeat('vfm', 7)).toBeNull();
    expect(scoreHeat('used', 7)).toBeNull(); // Most used is a count, not a score (D44)
    expect(scoreHeat('overall', null)).toBeNull();
  });
});
