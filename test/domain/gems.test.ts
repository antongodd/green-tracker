import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bandEffect, bandName, bandRange, BOARD_TOP_KEYS, DEFAULT_APPEARANCE, LIGHT_LOOKS, LOOK_KEYS, LOOKS, NEW_LOOKS, PRESET_KEYS, PRESETS, READY_LOOKS, LOOK_BG, LOOKS_MOVED, movedLook, movedPreset, NEW_PRESETS, PRESETS_MOVED, EFFECTS, scoreBand, validateAppearance } from '../../shared/domain/gems';

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
    expect([1, 2, 3, 4].map((b) => bandName('prism', b as 1))).toEqual(['Prism', 'Prism', 'Prism', 'Prism']);
    expect([1, 2, 3, 4].map((b) => bandName('aurora', b as 1))).toEqual(['Jade', 'Lagoon', 'Violet', 'Aurora']);
    expect([1, 2, 3, 4].map((b) => bandName('neon', b as 1))).toEqual(['Lime', 'Electric', 'Hot pink', 'Neon']);
    expect([1, 2, 3, 4].map((b) => bandName('sunset', b as 1))).toEqual(['Peach', 'Coral', 'Magenta', 'Golden hour']);
    expect([1, 2, 3, 4].map((b) => bandName('deepsea', b as 1))).toEqual(['Seafoam', 'Reef', 'Abyss', 'Glow']);
    expect([1, 2, 3, 4].map((b) => bandName('ember', b as 1))).toEqual(['Ember', 'Flame', 'Gold', 'Inferno']);
    expect([1, 2, 3, 4].map((b) => bandName('cosmos', b as 1))).toEqual(['Moonlight', 'Stardust', 'Nebula', 'Supernova']);
    expect([1, 2, 3, 4].map((b) => bandName('synthwave', b as 1))).toEqual(['Arcade', 'Laser', 'Chrome', 'Synthwave']);
    // D91: four new sets.
    expect([1, 2, 3, 4].map((b) => bandName('toxic', b as 1))).toEqual(['Sour', 'Acid', 'Radioactive', 'Toxic']);
    expect([1, 2, 3, 4].map((b) => bandName('medals', b as 1))).toEqual(['Bronze', 'Silver', 'Gold', '24 carat']);
    expect([1, 2, 3, 4].map((b) => bandName('storm', b as 1))).toEqual(['Drizzle', 'Rain', 'Thunder', 'Lightning']);
    expect([1, 2, 3, 4].map((b) => bandName('candy', b as 1))).toEqual(['Bubblegum', 'Mint', 'Lemon', 'Sugar rush']);
    expect([1, 2, 3, 4].map((b) => bandRange(b as 1))).toEqual(['8.0 – 8.4', '8.5 – 8.9', '9.0 – 9.4', '9.5 – 10']);
  });

  it('an account starts on Aurora Glass, the slim strip and Aurora, with #1 marked (D91; D71 had Gems)', () => {
    expect(DEFAULT_APPEARANCE).toEqual({ look: 'aurora', top: 'strip', preset: 'aurora', markFirst: true });
  });

  it('D71: the default first in each list, then A to Z by name; the default top first', () => {
    expect(PRESET_KEYS).toEqual(['aurora', 'candy', 'cosmos', 'deepsea', 'ember', 'medals', 'neon', 'prism', 'storm', 'sunset', 'synthwave', 'toxic']);
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

  it('D91: the four new sets marked New', () => {
    expect(NEW_PRESETS).toEqual(['candy', 'medals', 'storm', 'toxic']);
  });

  it('D91: every set has an effect of its own, on every band (none without one)', () => {
    const effects = (p: (typeof PRESET_KEYS)[number]) => [null, 1, 2, 3, 4].map((b) => bandEffect(p, b as 1 | null));
    expect(EFFECTS).toEqual({
      aurora: 'ribbons', candy: 'sprinkles', cosmos: 'stars', deepsea: 'plankton', ember: 'sparks', medals: 'glitter',
      neon: 'tubes', prism: 'beams', storm: 'rain', sunset: 'sun', synthwave: 'grid', toxic: 'goo',
    });
    for (const p of PRESET_KEYS) expect(effects(p), p).toEqual([null, EFFECTS[p], EFFECTS[p], EFFECTS[p], EFFECTS[p]]);
    expect(new Set(Object.values(EFFECTS)).size).toBe(PRESET_KEYS.length);
  });

  it('D91: Gems and Metals went; saved ones show as Aurora, and the app refuses to save them', () => {
    expect(PRESETS_MOVED).toEqual({ gems: 'aurora', metals: 'aurora' });
    expect(['gems', 'metals', 'sunset', 'gold'].map(movedPreset)).toEqual(['aurora', 'aurora', 'sunset', null]);
    for (const preset of ['gems', 'metals']) expect(validateAppearance({ ...DEFAULT_APPEARANCE, preset }).ok, preset).toBe(false);
  });

  it('a backup being restored reads a look or set that went as its replacement (D90, D91); still refuses an unknown one', () => {
    expect(validateAppearance({ look: 'pearl', top: 'hero', preset: 'metals', markFirst: false }, { moved: true })).toEqual({ ok: true, value: { look: 'aurora', top: 'hero', preset: 'aurora', markFirst: false } });
    expect(validateAppearance({ look: 'daymint', top: 'hero', preset: 'gems', markFirst: true }, { moved: true })).toEqual({ ok: true, value: { look: 'daysky', top: 'hero', preset: 'aurora', markFirst: true } });
    expect(validateAppearance({ ...DEFAULT_APPEARANCE, preset: 'gold' }, { moved: true }).ok).toBe(false);
    expect(validateAppearance({ ...DEFAULT_APPEARANCE, look: 'sepia' }, { moved: true }).ok).toBe(false);
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

  it('eleven looks since D90 (Holo Pearl, Haze, Daylight Mint and Pearl went; Daylight is the one light look), Daylight marked New; anything else is refused', () => {
    expect(READY_LOOKS).toEqual(LOOK_KEYS);
    expect(LOOK_KEYS).toHaveLength(11);
    expect(LIGHT_LOOKS).toEqual(['daysky']);
    expect(LOOKS.daysky.label).toBe('Daylight');
    expect([...NEW_LOOKS]).toEqual(['daysky']);
    for (const look of LOOK_KEYS) expect(validateAppearance({ ...DEFAULT_APPEARANCE, look })).toEqual({ ok: true, value: { ...DEFAULT_APPEARANCE, look } });
    for (const look of ['pearl', 'haze', 'daymint', 'daypearl']) expect(validateAppearance({ ...DEFAULT_APPEARANCE, look }).ok, look).toBe(false);
    expect(LOOK_BG).toEqual({ aurora: '#03070a', neon: '#06041a', forest: '#050807', sakura: '#130a13', fireflies: '#040b0b', deepsea: '#020a14', frost: '#060b12', nebula: '#05040c', outrun: '#0a0420', lava: '#12060c', daysky: '#eef3fa' });
    expect(new Set(LOOK_KEYS.map((l) => LOOKS[l].label)).size).toBe(LOOK_KEYS.length);
  });

  it('a look that went shows as its replacement (D90): Holo Pearl and Haze as Aurora Glass, Mint and Pearl as Daylight', () => {
    expect(['pearl', 'haze', 'daymint', 'daypearl', 'sakura', 'daysky', 'sepia'].map(movedLook)).toEqual(['aurora', 'aurora', 'daysky', 'daysky', 'sakura', 'daysky', null]);
    for (const look of Object.values(LOOKS_MOVED)) expect(LOOK_KEYS).toContain(look);
    // The phone's memory (look.js) moves them the same way.
    const js = readFileSync(new URL('../../client/public/look.js', import.meta.url), 'utf8');
    const moved = Object.fromEntries([...js.match(/var moved = \{([^}]*)\}/)![1]!.matchAll(/(\w+): '(\w+)'/g)].map((m) => [m[1], m[2]]));
    expect(moved).toEqual(LOOKS_MOVED);
  });

  it('the phone remembers every look (look.js knows each name and background); the database no longer lists them (D76)', () => {
    const js = readFileSync(new URL('../../client/public/look.js', import.meta.url), 'utf8');
    const bgs = Object.fromEntries([...js.matchAll(/(\w+): '(#[0-9a-f]{6})'/g)].map((m) => [m[1], m[2]]));
    expect(bgs).toEqual(LOOK_BG);
    const sql = readFileSync(new URL('../../migrations/0016_open_looks.sql', import.meta.url), 'utf8');
    expect(sql).not.toMatch(/look IN|preset IN/); // migrations.test.ts runs it
  });

  it('a backup or an open app from before 0.54.0 has no look or top: they take the defaults', () => {
    expect(validateAppearance({ preset: 'sunset', markFirst: false })).toEqual({ ok: true, value: { look: 'aurora', top: 'strip', preset: 'sunset', markFirst: false } });
    // An old backup like that, on Gems (D91), is still restored, on Aurora.
    expect(validateAppearance({ preset: 'gems', markFirst: false }, { moved: true })).toEqual({ ok: true, value: { look: 'aurora', top: 'strip', preset: 'aurora', markFirst: false } });
  });
});
