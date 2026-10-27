import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bandEffect, bandName, bandRange, BOARD_TOP_KEYS, DEFAULT_APPEARANCE, LOOK_KEYS, LOOKS, NEW_LOOKS, PRESET_KEYS, READY_LOOKS, LOOK_BG, NEW_PRESETS, scoreBand, validateAppearance } from '../../shared/domain/gems';

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
    expect([1, 2, 3, 4].map((b) => bandName('sunset', b as 1))).toEqual(['Peach', 'Coral', 'Magenta', 'Golden hour']);
    expect([1, 2, 3, 4].map((b) => bandName('deepsea', b as 1))).toEqual(['Seafoam', 'Reef', 'Abyss', 'Glow']);
    expect([1, 2, 3, 4].map((b) => bandName('ember', b as 1))).toEqual(['Ember', 'Flame', 'Blue flame', 'Inferno']);
    expect([1, 2, 3, 4].map((b) => bandName('cosmos', b as 1))).toEqual(['Moonlight', 'Stardust', 'Nebula', 'Supernova']);
    expect([1, 2, 3, 4].map((b) => bandName('synthwave', b as 1))).toEqual(['Arcade', 'Laser', 'Chrome', 'Synthwave']);
    expect([1, 2, 3, 4].map((b) => bandRange(b as 1))).toEqual(['8.0 – 8.4', '8.5 – 8.9', '9.0 – 9.4', '9.5 – 10']);
  });

  it('everyone starts on Aurora Glass, the glass hero and Aurora colours, with #1 marked (D64)', () => {
    expect(DEFAULT_APPEARANCE).toEqual({ look: 'aurora', top: 'hero', preset: 'aurora', markFirst: true });
    expect(PRESET_KEYS).toEqual(['aurora', 'neon', 'gems', 'prism', 'metals', 'sunset', 'deepsea', 'ember', 'cosmos', 'synthwave']);
  });

  it('D69: five more sets, last in the list and the only ones marked New', () => {
    expect(NEW_PRESETS).toEqual(PRESET_KEYS.slice(5));
  });

  it('each band\'s effect: Diamond\'s glints, and the five new sets each from their own band', () => {
    const effects = (p: (typeof PRESET_KEYS)[number]) => [null, 1, 2, 3, 4].map((b) => bandEffect(p, b as 1 | null));
    expect(effects('metals')).toEqual([null, null, null, 'glints', null]);
    expect(effects('sunset')).toEqual([null, null, null, null, 'sun']);
    expect(effects('deepsea')).toEqual([null, null, null, 'plankton', 'plankton']);
    expect(effects('ember')).toEqual([null, null, null, null, 'sparks']);
    expect(effects('cosmos')).toEqual([null, null, 'stars', 'stars', 'stars']);
    expect(effects('synthwave')).toEqual([null, null, null, 'grid', 'grid']);
    for (const p of ['aurora', 'neon', 'gems', 'prism'] as const) expect(effects(p), p).toEqual([null, null, null, null, null]);
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

  it('all twelve looks can be chosen since D70, the eight new ones marked New; anything else is refused', () => {
    expect(READY_LOOKS).toEqual(['aurora', 'neon', 'pearl', 'forest', 'sakura', 'fireflies', 'deepsea', 'frost', 'nebula', 'outrun', 'lava', 'haze']);
    expect(NEW_LOOKS).toEqual(LOOK_KEYS.slice(4));
    for (const look of LOOK_KEYS) expect(validateAppearance({ ...DEFAULT_APPEARANCE, look })).toEqual({ ok: true, value: { ...DEFAULT_APPEARANCE, look } });
    expect(LOOK_KEYS.map((l) => LOOK_BG[l])).toEqual(['#03070a', '#06041a', '#08080c', '#050807', '#130a13', '#040b0b', '#020a14', '#060b12', '#05040c', '#0a0420', '#12060c', '#0c0b10']);
    expect(new Set(LOOK_KEYS.map((l) => LOOKS[l].label)).size).toBe(LOOK_KEYS.length);
  });

  it('the phone remembers every look (look.js knows each name and background), and the database allows each', () => {
    const js = readFileSync(new URL('../../client/public/look.js', import.meta.url), 'utf8');
    const bgs = Object.fromEntries([...js.matchAll(/(\w+): '(#[0-9a-f]{6})'/g)].map((m) => [m[1], m[2]]));
    expect(bgs).toEqual(LOOK_BG);
    const sql = readFileSync(new URL('../../migrations/0014_more_looks.sql', import.meta.url), 'utf8');
    expect(sql.match(/look IN \(([^)]*)\)/)![1]!.match(/'(\w+)'/g)!.map((q) => q.slice(1, -1))).toEqual([...LOOK_KEYS]);
  });

  it('a backup or an open app from before 0.54.0 has no look or top: they take the defaults', () => {
    expect(validateAppearance({ preset: 'gems', markFirst: false })).toEqual({ ok: true, value: { look: 'aurora', top: 'hero', preset: 'gems', markFirst: false } });
  });
});
