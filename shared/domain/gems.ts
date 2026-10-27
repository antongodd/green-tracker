// Leaderboard colours (D48, 0.41.0): a row's colour is earned by its score, not its place.
// Four bands from 8.0 up, each a little stronger than the one below (a still edge, a
// flowing edge, a holo card, the full holo card with the shine); below 8 the heat glow
// (D30) carries on. Each account picks a preset for the colours, saved to the account
// (More → Appearance). Your #1 can also wear a crown and a halo, whatever its colour.
import { round } from './format';
import type { RankBy } from './leaderboard';

/** 1: 8.0–8.4 · 2: 8.5–8.9 · 3: 9.0–9.4 · 4: 9.5–10. */
export type Band = 1 | 2 | 3 | 4;

/** The lowest score of each band, from band 1 up. */
export const BAND_FLOORS = [8, 8.5, 9, 9.5] as const;

/**
 * The band of a row's ranked value, or null. Worked out from the score as shown (one
 * decimal place), so a row that reads "8.5" is always in the 8.5 band. Only scores out of
 * 10 get one (Overall and the rating categories): price and value for money aren't
 * scores, and an unrated row has nothing to colour.
 */
export function scoreBand(rankBy: RankBy, value: number | null): Band | null {
  if (value === null || rankBy === 'price' || rankBy === 'vfm') return null;
  const shown = round(value, 1);
  for (let b = BAND_FLOORS.length; b >= 1; b--) if (shown >= BAND_FLOORS[b - 1]!) return b as Band;
  return null;
}

export type Preset = 'aurora' | 'neon' | 'gems' | 'prism' | 'metals' | 'sunset' | 'deepsea' | 'ember' | 'cosmos' | 'synthwave';
/** In the order Appearance lists them: the two made for the new look (D64) first, the five of D69 last. */
export const PRESET_KEYS = ['aurora', 'neon', 'gems', 'prism', 'metals', 'sunset', 'deepsea', 'ember', 'cosmos', 'synthwave'] as const satisfies readonly Preset[];
/** Marked New in Appearance (D69: only the newest five; Aurora and Neon lost theirs). */
export const NEW_PRESETS: readonly Preset[] = ['sunset', 'deepsea', 'ember', 'cosmos', 'synthwave'];

export const PRESETS: Record<Preset, { label: string; description: string; bands: readonly [string, string, string, string] }> = {
  aurora: { label: 'Aurora', description: 'Jade, Lagoon, Violet, Aurora', bands: ['Jade', 'Lagoon', 'Violet', 'Aurora'] },
  neon: { label: 'Neon', description: 'Lime, Electric, Hot pink, Neon', bands: ['Lime', 'Electric', 'Hot pink', 'Neon'] },
  gems: { label: 'Gems', description: 'Emerald, Sapphire, Amethyst, Rainbow', bands: ['Emerald', 'Sapphire', 'Amethyst', 'Rainbow'] },
  prism: { label: 'Prism', description: 'One rainbow that grows stronger', bands: ['Prism', 'Prism', 'Prism', 'Prism'] },
  metals: { label: 'Metals', description: 'Emerald, Rose gold, Diamond, Rainbow', bands: ['Emerald', 'Rose gold', 'Diamond', 'Rainbow'] },
  sunset: { label: 'Sunset', description: 'Peach, Coral, Magenta, Golden hour', bands: ['Peach', 'Coral', 'Magenta', 'Golden hour'] },
  deepsea: { label: 'Deep Sea', description: 'Seafoam, Reef, Abyss, Glow', bands: ['Seafoam', 'Reef', 'Abyss', 'Glow'] },
  ember: { label: 'Ember', description: 'Ember, Flame, Blue flame, Inferno', bands: ['Ember', 'Flame', 'Blue flame', 'Inferno'] },
  cosmos: { label: 'Cosmos', description: 'Moonlight, Stardust, Nebula, Supernova', bands: ['Moonlight', 'Stardust', 'Nebula', 'Supernova'] },
  synthwave: { label: 'Synthwave', description: 'Arcade, Laser, Chrome, Synthwave', bands: ['Arcade', 'Laser', 'Chrome', 'Synthwave'] },
};

/**
 * Something drawn on a coloured card besides its colours, kept clear of the words: Metals'
 * Diamond twinkles (D48), and each of D69's sets has its own. Sunset: a sun glowing behind the
 * photo at 9.5. Deep Sea: glowing plankton drifting by from 9.0 (more at 9.5). Ember: sparks
 * and a flicker of heat at 9.5. Cosmos: twinkling stars from 8.5, more band by band, and a
 * nebula at 9.5. Synthwave: a neon grid floor from 9.0 and a striped sun setting into it at 9.5.
 */
export type Effect = 'glints' | 'sun' | 'plankton' | 'sparks' | 'stars' | 'grid';
const EFFECTS: Partial<Record<Preset, { effect: Effect; from: Band }>> = {
  metals: { effect: 'glints', from: 3 },
  sunset: { effect: 'sun', from: 4 },
  deepsea: { effect: 'plankton', from: 3 },
  ember: { effect: 'sparks', from: 4 },
  cosmos: { effect: 'stars', from: 2 },
  synthwave: { effect: 'grid', from: 3 },
};

/** A band's effect in a preset, or null. Metals' glints are Diamond's alone (band 3, not Rainbow). */
export function bandEffect(preset: Preset, band: Band | null): Effect | null {
  const e = EFFECTS[preset];
  if (!e || band === null || band < e.from || (e.effect === 'glints' && band !== 3)) return null;
  return e.effect;
}

/** A band's name in a preset: "Amethyst", "Rose gold", "Prism". */
export const bandName = (preset: Preset, band: Band): string => PRESETS[preset].bands[band - 1]!;

/** "8.0 – 8.4" … "9.5 – 10", for the key. */
export const bandRange = (band: Band): string => (band === 4 ? '9.5 – 10' : `${BAND_FLOORS[band - 1]!.toFixed(1)} – ${(BAND_FLOORS[band]! - 0.1).toFixed(1)}`);

/**
 * The whole app's look (D64; all four built since D65; eight more since D70). A look changes only
 * colours and the background behind everything, never fonts, sizes or shapes (D70: the owner's rule;
 * Holo Pearl's and Deep Forest's title fonts are from before it).
 */
export type Look = 'aurora' | 'neon' | 'pearl' | 'forest' | 'sakura' | 'fireflies' | 'deepsea' | 'frost' | 'nebula' | 'outrun' | 'lava' | 'haze';
/** In the order Appearance lists them: the four of D64/D65, then D70's eight. */
export const LOOK_KEYS = ['aurora', 'neon', 'pearl', 'forest', 'sakura', 'fireflies', 'deepsea', 'frost', 'nebula', 'outrun', 'lava', 'haze'] as const satisfies readonly Look[];
/** The looks you can choose (a look not listed would show as "Coming next"). All of them. */
export const READY_LOOKS: readonly Look[] = LOOK_KEYS;
/** Marked New in Appearance (D70). */
export const NEW_LOOKS: readonly Look[] = ['sakura', 'fireflies', 'deepsea', 'frost', 'nebula', 'outrun', 'lava', 'haze'];
/** Each look's background, for the Home Screen app's top bar (theme-color) and look.js. */
export const LOOK_BG: Record<Look, string> = {
  aurora: '#03070a', neon: '#06041a', pearl: '#08080c', forest: '#050807',
  sakura: '#130a13', fireflies: '#040b0b', deepsea: '#020a14', frost: '#060b12', nebula: '#05040c', outrun: '#0a0420', lava: '#12060c', haze: '#0c0b10',
};
export const LOOKS: Record<Look, { label: string; description: string }> = {
  aurora: { label: 'Aurora Glass', description: 'Drifting green, teal and violet lights, frosted glass' },
  neon: { label: 'Neon Night', description: 'Deep indigo with violet, pink and cyan lights' },
  pearl: { label: 'Holo Pearl', description: 'Near-black with pearly rainbow edges' },
  forest: { label: 'Deep Forest', description: 'The green look, tidied' },
  sakura: { label: 'Sakura', description: 'Dusk pink with drifting blossom' },
  fireflies: { label: 'Fireflies', description: 'A summer night, little lights blinking' },
  deepsea: { label: 'Deep Sea', description: 'Light rays and glowing plankton' },
  frost: { label: 'Frost', description: 'Icy blue with snow falling' },
  nebula: { label: 'Nebula', description: 'Stars and slow-turning clouds of colour' },
  outrun: { label: 'Outrun', description: 'Neon grid and a setting sun' },
  lava: { label: 'Lava Lamp', description: 'Warm blobs that rise and melt together' },
  haze: { label: 'Haze', description: 'Slow curls of smoke over soft charcoal' },
};

/** The top of the Leaderboard (D64), also used by the Log, a friend's board and a name's page. */
export type BoardTop = 'hero' | 'tiles' | 'strip';
export const BOARD_TOP_KEYS = ['hero', 'tiles', 'strip'] as const satisfies readonly BoardTop[];
export const BOARD_TOPS: Record<BoardTop, { label: string; description: string }> = {
  hero: { label: 'Glass hero', description: 'One big card' },
  tiles: { label: 'Three tiles', description: 'Side by side' },
  strip: { label: 'Slim strip', description: 'One line, more rows' },
};

export interface Appearance {
  /** The whole app's look (D64). */
  look: Look;
  /** The top of the Leaderboard and the Log (D64). */
  top: BoardTop;
  preset: Preset;
  /** The crown and halo on your #1 (D48). */
  markFirst: boolean;
}

/** Where everyone starts (the owner's choice, D64): Aurora Glass, the glass hero, Aurora colours, #1 marked. */
export const DEFAULT_APPEARANCE: Appearance = { look: 'aurora', top: 'hero', preset: 'aurora', markFirst: true };

/**
 * A whole Appearance object, checked: a look you can choose, a known top and preset, and a boolean.
 * A look or top that's missing (a backup from before 0.54.0, or an app still open from before)
 * takes the default; anything else wrong is refused.
 */
export function validateAppearance(raw: unknown): { ok: true; value: Appearance } | { ok: false; message: string } {
  const bad = { ok: false, message: 'The appearance settings could not be read.' } as const;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return bad;
  const r = raw as Record<string, unknown>;
  const look = r.look === undefined ? DEFAULT_APPEARANCE.look : r.look;
  const top = r.top === undefined ? DEFAULT_APPEARANCE.top : r.top;
  if (!READY_LOOKS.includes(look as Look) || !BOARD_TOP_KEYS.includes(top as BoardTop)) return bad;
  if (!PRESET_KEYS.includes(r.preset as Preset) || typeof r.markFirst !== 'boolean') return bad;
  return { ok: true, value: { look: look as Look, top: top as BoardTop, preset: r.preset as Preset, markFirst: r.markFirst } };
}
