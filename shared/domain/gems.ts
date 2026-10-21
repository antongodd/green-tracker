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

export type Preset = 'aurora' | 'neon' | 'gems' | 'prism' | 'metals';
/** In the order Appearance lists them: the two made for the new look (D64) first. */
export const PRESET_KEYS = ['aurora', 'neon', 'gems', 'prism', 'metals'] as const satisfies readonly Preset[];

export const PRESETS: Record<Preset, { label: string; description: string; bands: readonly [string, string, string, string] }> = {
  aurora: { label: 'Aurora', description: 'Jade, Lagoon, Violet, Aurora', bands: ['Jade', 'Lagoon', 'Violet', 'Aurora'] },
  neon: { label: 'Neon', description: 'Lime, Electric, Hot pink, Neon', bands: ['Lime', 'Electric', 'Hot pink', 'Neon'] },
  gems: { label: 'Gems', description: 'Emerald, Sapphire, Amethyst, Rainbow', bands: ['Emerald', 'Sapphire', 'Amethyst', 'Rainbow'] },
  prism: { label: 'Prism', description: 'One rainbow that grows stronger', bands: ['Prism', 'Prism', 'Prism', 'Prism'] },
  metals: { label: 'Metals', description: 'Emerald, Rose gold, Diamond, Rainbow', bands: ['Emerald', 'Rose gold', 'Diamond', 'Rainbow'] },
};

/** A band's name in a preset: "Amethyst", "Rose gold", "Prism". */
export const bandName = (preset: Preset, band: Band): string => PRESETS[preset].bands[band - 1]!;

/** "8.0 – 8.4" … "9.5 – 10", for the key. */
export const bandRange = (band: Band): string => (band === 4 ? '9.5 – 10' : `${BAND_FLOORS[band - 1]!.toFixed(1)} – ${(BAND_FLOORS[band]! - 0.1).toFixed(1)}`);

/** The whole app's look (D64; all four built since D65). */
export type Look = 'aurora' | 'neon' | 'pearl' | 'forest';
export const LOOK_KEYS = ['aurora', 'neon', 'pearl', 'forest'] as const satisfies readonly Look[];
/** The looks you can choose (a look not listed would show as "Coming next"). All four since D65. */
export const READY_LOOKS: readonly Look[] = LOOK_KEYS;
/** Each look's background, for the Home Screen app's top bar (theme-color) and look.js. */
export const LOOK_BG: Record<Look, string> = { aurora: '#03070a', neon: '#06041a', pearl: '#08080c', forest: '#050807' };
export const LOOKS: Record<Look, { label: string; description: string }> = {
  aurora: { label: 'Aurora Glass', description: 'Drifting green, teal and violet lights, frosted glass' },
  neon: { label: 'Neon Night', description: 'Deep indigo with violet, pink and cyan lights' },
  pearl: { label: 'Holo Pearl', description: 'Near-black with pearly rainbow edges' },
  forest: { label: 'Deep Forest', description: 'The green look, tidied' },
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
