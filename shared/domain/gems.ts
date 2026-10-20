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

export type Preset = 'gems' | 'prism' | 'metals';
export const PRESET_KEYS = ['gems', 'prism', 'metals'] as const satisfies readonly Preset[];

export const PRESETS: Record<Preset, { label: string; description: string; bands: readonly [string, string, string, string] }> = {
  gems: { label: 'Gems', description: 'Emerald, Sapphire, Amethyst, Rainbow', bands: ['Emerald', 'Sapphire', 'Amethyst', 'Rainbow'] },
  prism: { label: 'Prism', description: 'One rainbow that grows stronger', bands: ['Prism', 'Prism', 'Prism', 'Prism'] },
  metals: { label: 'Metals', description: 'Emerald, Rose gold, Diamond, Rainbow', bands: ['Emerald', 'Rose gold', 'Diamond', 'Rainbow'] },
};

/** A band's name in a preset: "Amethyst", "Rose gold", "Prism". */
export const bandName = (preset: Preset, band: Band): string => PRESETS[preset].bands[band - 1]!;

/** "8.0 – 8.4" … "9.5 – 10", for the key. */
export const bandRange = (band: Band): string => (band === 4 ? '9.5 – 10' : `${BAND_FLOORS[band - 1]!.toFixed(1)} – ${(BAND_FLOORS[band]! - 0.1).toFixed(1)}`);

export interface Appearance {
  preset: Preset;
  /** The crown and halo on your #1 (D48). */
  markFirst: boolean;
}

/** Where everyone starts (the owner's choice): Gems, with #1 marked. */
export const DEFAULT_APPEARANCE: Appearance = { preset: 'gems', markFirst: true };

/** A whole Appearance object, checked: a known preset and a boolean. Anything else is refused. */
export function validateAppearance(raw: unknown): { ok: true; value: Appearance } | { ok: false; message: string } {
  const bad = { ok: false, message: 'The appearance settings could not be read.' } as const;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return bad;
  const r = raw as Record<string, unknown>;
  if (!PRESET_KEYS.includes(r.preset as Preset) || typeof r.markFirst !== 'boolean') return bad;
  return { ok: true, value: { preset: r.preset as Preset, markFirst: r.markFirst } };
}

/** The line under More → Appearance: "Leaderboard colours: Gems". */
export const appearanceSummary = (a: Appearance): string => `Leaderboard colours: ${PRESETS[a.preset].label}`;
