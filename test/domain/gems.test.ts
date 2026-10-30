import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bandEffect, bandName, bandRange, BOARD_TOP_KEYS, DEFAULT_APPEARANCE, LIGHT_LOOKS, LOOK_KEYS, LOOKS, NEW_LOOKS, PRESET_KEYS, PRESETS, READY_LOOKS, LOOK_BG, NEW_PRESETS, scoreBand, validateAppearance } from '../../shared/domain/gems';

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

  it('an account starts on Aurora Glass, the slim strip and Gems, with #1 marked (D71; D64 had the glass hero and Aurora)', () => {
    expect(DEFAULT_APPEARANCE).toEqual({ look: 'aurora', top: 'strip', preset: 'gems', markFirst: true });
  });

  it('D71: the default first in each list, then A to Z by name; the default top first', () => {
    expect(PRESET_KEYS).toEqual(['gems', 'aurora', 'cosmos', 'deepsea', 'ember', 'metals', 'neon', 'prism', 'sunset', 'synthwave']);
    expect(PRESET_KEYS[0]).toBe(DEFAULT_APPEARANCE.preset);
    const names = PRESET_KEYS.slice(1).map((k) => PRESETS[k].label);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(LOOK_KEYS[0]).toBe(DEFAULT_APPEARANCE.look);
    // D73: the dark looks, then the light ones at the end (Appearance's Dark mode and Light mode), each A to Z.
    const dark = LOOK_KEYS.filter((k) => !LIGHT_LOOKS.includes(k));
    expect(LOOK_KEYS).toEqual([...dark, ...LIGHT_LOOKS]);
    const looks = dark.slice(1).map((k) => LOOKS[k].label);
    expect(looks).toEqual([...looks].sort((a, b) => a.localeCompare(b)));
    const light = LIGHT_LOOKS.map((k) => LOOKS[k].label);
    expect(light).toEqual([...light].sort((a, b) => a.localeCompare(b)));
    expect(BOARD_TOP_KEYS[0]).toBe(DEFAULT_APPEARANCE.top);
  });

  it('D69: five sets marked New', () => {
    expect(NEW_PRESETS).toEqual(['sunset', 'deepsea', 'ember', 'cosmos', 'synthwave']);
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

  it('all fifteen looks can be chosen since D72 (eight more in D70, three light ones in D72), the new ones marked New; anything else is refused', () => {
    expect(READY_LOOKS).toEqual(LOOK_KEYS);
    expect(LOOK_KEYS).toHaveLength(15);
    expect(LIGHT_LOOKS).toEqual(['daymint', 'daypearl', 'daysky']);
    expect([...NEW_LOOKS].sort()).toEqual(['daymint', 'daypearl', 'daysky', 'deepsea', 'fireflies', 'frost', 'haze', 'lava', 'nebula', 'outrun', 'sakura']);
    for (const look of LOOK_KEYS) expect(validateAppearance({ ...DEFAULT_APPEARANCE, look })).toEqual({ ok: true, value: { ...DEFAULT_APPEARANCE, look } });
    expect(LOOK_BG).toEqual({ aurora: '#03070a', neon: '#06041a', pearl: '#08080c', forest: '#050807', sakura: '#130a13', fireflies: '#040b0b', deepsea: '#020a14', frost: '#060b12', nebula: '#05040c', outrun: '#0a0420', lava: '#12060c', haze: '#0c0b10', daymint: '#eef4f0', daypearl: '#f5f4f8', daysky: '#eef3fa' });
    expect(new Set(LOOK_KEYS.map((l) => LOOKS[l].label)).size).toBe(LOOK_KEYS.length);
  });

  it('the phone remembers every look (look.js knows each name and background), and the database allows each', () => {
    const js = readFileSync(new URL('../../client/public/look.js', import.meta.url), 'utf8');
    const bgs = Object.fromEntries([...js.matchAll(/(\w+): '(#[0-9a-f]{6})'/g)].map((m) => [m[1], m[2]]));
    expect(bgs).toEqual(LOOK_BG);
    const sql = readFileSync(new URL('../../migrations/0015_daylight.sql', import.meta.url), 'utf8');
    expect(sql.match(/look IN \(([^)]*)\)/)![1]!.match(/'(\w+)'/g)!.map((q) => q.slice(1, -1)).sort()).toEqual([...LOOK_KEYS].sort());
  });

  it('a backup or an open app from before 0.54.0 has no look or top: they take the defaults', () => {
    expect(validateAppearance({ preset: 'gems', markFirst: false })).toEqual({ ok: true, value: { look: 'aurora', top: 'strip', preset: 'gems', markFirst: false } });
  });
});
