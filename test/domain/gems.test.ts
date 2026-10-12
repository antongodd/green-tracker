import { describe, expect, it } from 'vitest';
import { appearanceSummary, bandName, bandRange, DEFAULT_APPEARANCE, PRESET_KEYS, scoreBand, validateAppearance } from '../../shared/domain/gems';

describe('Leaderboard colours by score (D48)', () => {
  it('four bands from 8.0 up; nothing below 8', () => {
    expect([7.9, 8, 8.4, 8.5, 8.9, 9, 9.4, 9.5, 10].map((v) => scoreBand('overall', v))).toEqual([null, 1, 1, 2, 2, 3, 3, 4, 4]);
    expect(scoreBand('overall', 1)).toBeNull();
  });

  it('goes by the score as shown, to one decimal place, so a row reading "8.5" is in the 8.5 band', () => {
    expect(scoreBand('overall', 8.45)).toBe(2); // shown as 8.5
    expect(scoreBand('overall', 8.44)).toBe(1); // shown as 8.4
    expect(scoreBand('overall', 7.95)).toBe(1); // shown as 8.0
    expect(scoreBand('overall', 9.449999)).toBe(3);
    expect(scoreBand('overall', 9.45)).toBe(4);
    // An average of ratings: 8.5 exactly, even with floating-point error.
    expect(scoreBand('overall', (8.3 + 8.7) / 2)).toBe(2);
  });

  it('only scores out of 10 get a band: any rating, never price, value for money, Most used or unrated', () => {
    expect(scoreBand('taste', 9.2)).toBe(3);
    expect(scoreBand('price', 9.6)).toBeNull();
    expect(scoreBand('vfm', 9.6)).toBeNull();
    expect(scoreBand('used', 12)).toBeNull();
    expect(scoreBand('overall', null)).toBeNull();
  });

  it('each preset names its bands', () => {
    expect([1, 2, 3, 4].map((b) => bandName('gems', b as 1))).toEqual(['Emerald', 'Sapphire', 'Amethyst', 'Rainbow']);
    expect([1, 2, 3, 4].map((b) => bandName('metals', b as 1))).toEqual(['Emerald', 'Rose gold', 'Diamond', 'Rainbow']);
    expect([1, 2, 3, 4].map((b) => bandName('prism', b as 1))).toEqual(['Prism', 'Prism', 'Prism', 'Prism']);
    expect([1, 2, 3, 4].map((b) => bandRange(b as 1))).toEqual(['8.0 – 8.4', '8.5 – 8.9', '9.0 – 9.4', '9.5 – 10']);
  });

  it('everyone starts on Gems with #1 marked', () => {
    expect(DEFAULT_APPEARANCE).toEqual({ preset: 'gems', markFirst: true });
    expect(appearanceSummary(DEFAULT_APPEARANCE)).toBe('Leaderboard colours: Gems');
    expect(appearanceSummary({ preset: 'metals', markFirst: false })).toBe('Leaderboard colours: Metals');
  });

  it('a settings object must have a known preset and a true/false #1 mark; anything else is refused', () => {
    for (const preset of PRESET_KEYS) expect(validateAppearance({ preset, markFirst: false })).toEqual({ ok: true, value: { preset, markFirst: false } });
    // Unknown keys are dropped.
    expect(validateAppearance({ preset: 'gems', markFirst: true, extra: 1 })).toEqual({ ok: true, value: { preset: 'gems', markFirst: true } });
    for (const bad of [null, [], 'gems', {}, { preset: 'gold', markFirst: true }, { preset: 'gems' }, { preset: 'gems', markFirst: 1 }, { preset: 'GEMS', markFirst: true }]) {
      expect(validateAppearance(bad).ok, JSON.stringify(bad)).toBe(false);
    }
  });
});
