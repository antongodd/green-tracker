import { describe, expect, it } from 'vitest';
import { bandName, bandRange, BOARD_TOP_KEYS, DEFAULT_APPEARANCE, LOOK_KEYS, PRESET_KEYS, READY_LOOKS, LOOK_BG, scoreBand, validateAppearance } from '../../shared/domain/gems';

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

  it('only scores out of 10 get a band: any rating, never price, value for money or unrated', () => {
    expect(scoreBand('taste', 9.2)).toBe(3);
    expect(scoreBand('price', 9.6)).toBeNull();
    expect(scoreBand('vfm', 9.6)).toBeNull();
    expect(scoreBand('overall', null)).toBeNull();
  });

  it('each preset names its bands', () => {
    expect([1, 2, 3, 4].map((b) => bandName('gems', b as 1))).toEqual(['Emerald', 'Sapphire', 'Amethyst', 'Rainbow']);
    expect([1, 2, 3, 4].map((b) => bandName('metals', b as 1))).toEqual(['Emerald', 'Rose gold', 'Diamond', 'Rainbow']);
    expect([1, 2, 3, 4].map((b) => bandName('prism', b as 1))).toEqual(['Prism', 'Prism', 'Prism', 'Prism']);
    expect([1, 2, 3, 4].map((b) => bandName('aurora', b as 1))).toEqual(['Jade', 'Lagoon', 'Violet', 'Aurora']);
    expect([1, 2, 3, 4].map((b) => bandName('neon', b as 1))).toEqual(['Lime', 'Electric', 'Hot pink', 'Neon']);
    expect([1, 2, 3, 4].map((b) => bandRange(b as 1))).toEqual(['8.0 – 8.4', '8.5 – 8.9', '9.0 – 9.4', '9.5 – 10']);
  });

  it('everyone starts on Aurora Glass, the glass hero and Aurora colours, with #1 marked (D64)', () => {
    expect(DEFAULT_APPEARANCE).toEqual({ look: 'aurora', top: 'hero', preset: 'aurora', markFirst: true });
    expect(PRESET_KEYS).toEqual(['aurora', 'neon', 'gems', 'prism', 'metals']);
  });

  it('a settings object must have a ready look, a known top and preset and a true/false #1 mark; anything else is refused', () => {
    for (const preset of PRESET_KEYS) for (const top of BOARD_TOP_KEYS) {
      const a = { look: 'aurora', top, preset, markFirst: false };
      expect(validateAppearance(a)).toEqual({ ok: true, value: a });
    }
    // Unknown keys are dropped.
    expect(validateAppearance({ ...DEFAULT_APPEARANCE, extra: 1 })).toEqual({ ok: true, value: DEFAULT_APPEARANCE });
    for (const bad of [null, [], 'gems', {}, { preset: 'gold', markFirst: true }, { preset: 'gems' }, { preset: 'gems', markFirst: 1 }, { preset: 'GEMS', markFirst: true },
      { ...DEFAULT_APPEARANCE, look: 'sepia' }, { ...DEFAULT_APPEARANCE, top: 'side' }, { ...DEFAULT_APPEARANCE, look: null }]) {
      expect(validateAppearance(bad).ok, JSON.stringify(bad)).toBe(false);
    }
  });

  it('all four looks can be chosen since D65; anything else is refused', () => {
    expect(READY_LOOKS).toEqual(['aurora', 'neon', 'pearl', 'forest']);
    for (const look of LOOK_KEYS) expect(validateAppearance({ ...DEFAULT_APPEARANCE, look })).toEqual({ ok: true, value: { ...DEFAULT_APPEARANCE, look } });
    expect(LOOK_KEYS.map((l) => LOOK_BG[l])).toEqual(['#03070a', '#06041a', '#08080c', '#050807']);
  });

  it('a backup or an open app from before 0.54.0 has no look or top: they take the defaults', () => {
    expect(validateAppearance({ preset: 'gems', markFirst: false })).toEqual({ ok: true, value: { look: 'aurora', top: 'hero', preset: 'gems', markFirst: false } });
  });
});
