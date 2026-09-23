import { describe, expect, it } from 'vitest';
import {
  formatHitTime,
  formatScore,
  isValidHitTime,
  overall,
  overallExplanation,
  productType,
  ratedCount,
  type Ratings,
} from '../../shared/domain';

const fullFlower: Ratings = { look: 8, smell: 7, taste: 9, burn: 6, high: 2 };

describe('Overall (§17 Ratings)', () => {
  it('flower Look 8, Smell 7, Taste 9, Burn 6, High 2 → 7.5; changing High alone changes nothing', () => {
    expect(overall('flower', fullFlower)).toBe(7.5);
    expect(overall('flower', { ...fullFlower, high: 10 })).toBe(7.5);
    expect(overall('flower', { ...fullFlower, high: undefined })).toBe(7.5);
  });

  it('edible Taste 6, High 9 → 8.0; only High 9 → 9.0; only Taste 6 → 6.0', () => {
    expect(formatScore(overall('edibles', { taste: 6, high: 9 })!)).toBe('8.0');
    expect(overall('edibles', { high: 9 })).toBe(9);
    expect(overall('edibles', { taste: 6 })).toBe(6);
  });

  it('flower rated only on High has no Overall', () => {
    expect(overall('flower', { high: 9 })).toBeNull();
  });

  it('pre roll ignores a Look value left from an earlier type', () => {
    expect(overall('pre_roll', { look: 1, smell: 8, taste: 8, burn: 8 })).toBe(8);
    expect(productType('pre_roll').ratingSet.some((s) => s.key === 'look')).toBe(false);
  });

  it('concentrate includes Consistency straight after Look', () => {
    expect(productType('concentrate').ratingSet.map((s) => s.key)).toEqual([
      'look', 'consistency', 'smell', 'taste', 'burn', 'high',
    ]);
    expect(overall('concentrate', { look: 5, consistency: 10, smell: 5, taste: 5, burn: 5, high: 1 })).toBe(6);
  });

  it('a blank is absent, never zero', () => {
    expect(overall('flower', { look: 8 })).toBe(8);
  });

  it('decimals are allowed and shown to one decimal place', () => {
    expect(formatScore(overall('flower', { look: 7.3, smell: 7.3, taste: 7.3, burn: 7.3 })!)).toBe('7.3');
    expect(formatScore(7.25)).toBe('7.3');
  });

  it('switching type keeps ratings: flower → edibles → flower returns every rating intact', () => {
    const stored = { ...fullFlower };
    // A type switch never touches stored ratings; only the set used to read them changes.
    expect(ratedCount('edibles', stored)).toEqual({ rated: 2, of: 2 });
    expect(overall('flower', stored)).toBe(7.5);
    expect(stored).toEqual(fullFlower);
  });
});

describe('Rated N of N (§8)', () => {
  it('denominators: Flower 5, Concentrate 6, Edibles 2, Pre roll 4', () => {
    expect(ratedCount('flower', {}).of).toBe(5);
    expect(ratedCount('concentrate', {}).of).toBe(6);
    expect(ratedCount('edibles', {}).of).toBe(2);
    expect(ratedCount('pre_roll', {}).of).toBe(4);
  });

  it('High counts', () => {
    expect(ratedCount('flower', { high: 5 })).toEqual({ rated: 1, of: 5 });
  });
});

describe('Hit time', () => {
  it('0–180 in 15-minute steps', () => {
    expect(isValidHitTime(0)).toBe(true);
    expect(isValidHitTime(180)).toBe(true);
    expect(isValidHitTime(195)).toBe(false);
    expect(isValidHitTime(20)).toBe(false);
  });

  it('is a duration, not a score', () => {
    expect(formatHitTime(null)).toBe('Not set');
    expect(formatHitTime(0)).toBe('0m');
    expect(formatHitTime(45)).toBe('45m');
    expect(formatHitTime(60)).toBe('1h');
    expect(formatHitTime(75)).toBe('1h 15m');
  });
});

describe('Editor guidance text is per type (§8)', () => {
  it('never tells an edible that High doesn’t count', () => {
    expect(overallExplanation('edibles')).toContain('Taste ⅓ and High ⅔');
    expect(overallExplanation('edibles')).not.toContain("doesn't count");
  });

  it('tells flower, concentrate and pre roll that High doesn’t count', () => {
    expect(overallExplanation('flower')).toBe(
      "Overall is the average of Look, Smell, Taste and Burn. High is rated but doesn't count. Blank categories are left out.",
    );
    expect(overallExplanation('concentrate')).toContain('Look, Consistency, Smell, Taste and Burn');
    expect(overallExplanation('pre_roll')).toContain('Smell, Taste and Burn');
  });
});
