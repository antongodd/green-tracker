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

export type Preset = 'aurora' | 'neon' | 'prism' | 'sunset' | 'deepsea' | 'ember' | 'cosmos' | 'synthwave' | 'toxic' | 'medals' | 'storm' | 'candy';
/** In the order Appearance lists them (D91): Aurora, everyone's first colours, then A to Z by name. */
export const PRESET_KEYS = ['aurora', 'candy', 'cosmos', 'deepsea', 'ember', 'medals', 'neon', 'prism', 'storm', 'sunset', 'synthwave', 'toxic'] as const satisfies readonly Preset[];
/** Marked New in Appearance (D91: the four new sets). */
export const NEW_PRESETS: readonly Preset[] = ['candy', 'medals', 'storm', 'toxic'];
/**
 * The colour sets that went in D91 (the owner: Gems and Metals go) and the set each now shows as. Saved choices aren't
 * rewritten: they're read as their replacement (`movedPreset`), like the looks that went in D90.
 */
export const PRESETS_MOVED: Readonly<Record<string, Preset>> = { gems: 'aurora', metals: 'aurora' };
/** A saved preset as it shows today: itself, its replacement (D91), or null for one this build doesn't know. */
export function movedPreset(v: string): Preset | null {
  if ((PRESET_KEYS as readonly string[]).includes(v)) return v as Preset;
  return PRESETS_MOVED[v] ?? null;
}

export const PRESETS: Record<Preset, { label: string; description: string; bands: readonly [string, string, string, string] }> = {
  aurora: { label: 'Aurora', description: 'Ribbons of northern light under the stars', bands: ['Jade', 'Lagoon', 'Violet', 'Aurora'] },
  candy: { label: 'Candy', description: 'Sprinkles falling, a swirl of candy stripes', bands: ['Bubblegum', 'Mint', 'Lemon', 'Sugar rush'] },
  cosmos: { label: 'Cosmos', description: 'Stars, a shooting star and a nebula', bands: ['Moonlight', 'Stardust', 'Nebula', 'Supernova'] },
  deepsea: { label: 'Deep Sea', description: 'Bubbles, plankton and a jellyfish', bands: ['Seafoam', 'Reef', 'Abyss', 'Glow'] },
  ember: { label: 'Ember', description: 'Sparks rising, a glow of heat', bands: ['Ember', 'Flame', 'Gold', 'Inferno'] },
  medals: { label: 'Medals', description: 'Bronze to gold glitter, gold leaf falling', bands: ['Bronze', 'Silver', 'Gold', '24 carat'] },
  neon: { label: 'Neon', description: 'Neon tubes that hum and flicker', bands: ['Lime', 'Electric', 'Hot pink', 'Neon'] },
  prism: { label: 'Prism', description: 'Beams of light and sparkles', bands: ['Prism', 'Prism', 'Prism', 'Prism'] },
  storm: { label: 'Storm', description: 'Rain getting heavier, then lightning', bands: ['Drizzle', 'Rain', 'Thunder', 'Lightning'] },
  sunset: { label: 'Sunset', description: 'Golden dust, a rising sun and its stripes', bands: ['Peach', 'Coral', 'Magenta', 'Golden hour'] },
  synthwave: { label: 'Synthwave', description: 'Screen lines, a neon grid and a setting sun', bands: ['Arcade', 'Laser', 'Chrome', 'Synthwave'] },
  toxic: { label: 'Toxic', description: 'Acid green bubbles that drip', bands: ['Sour', 'Acid', 'Radioactive', 'Toxic'] },
};

/**
 * Something drawn on a coloured card besides its colours, kept clear of the words (D69; every set since D91, a hint at
 * 8.0 growing to a full show at 9.5). Aurora: ribbons of light, a curtain and stars at 9.5. Candy: sprinkles, a
 * turning swirl at 9.5. Cosmos: stars, a shooting star and a nebula at 9.5. Deep Sea: bubbles and plankton, a
 * jellyfish in a ray of light at 9.5. Ember: sparks, heat at 9.5. Medals: glitter, gold leaf at 9.5. Neon: tubes,
 * humming from 9.0, glowing and flickering at 9.5. Prism: beams of light, sparkles at 9.5. Storm: rain, lightning at
 * 9.5. Sunset: golden dust, the sun and its stripes at 9.5. Synthwave: screen lines, the grid from 8.5, stars from
 * 9.0, the sun at 9.5. Toxic: bubbles, drips at 9.5.
 */
export type Effect = 'ribbons' | 'sprinkles' | 'stars' | 'plankton' | 'sparks' | 'glitter' | 'tubes' | 'beams' | 'rain' | 'sun' | 'grid' | 'goo';
export const EFFECTS: Record<Preset, Effect> = {
  aurora: 'ribbons', candy: 'sprinkles', cosmos: 'stars', deepsea: 'plankton', ember: 'sparks', medals: 'glitter',
  neon: 'tubes', prism: 'beams', storm: 'rain', sunset: 'sun', synthwave: 'grid', toxic: 'goo',
};

/** A band's effect in a preset (every band has one since D91), or null without a band. */
export function bandEffect(preset: Preset, band: Band | null): Effect | null {
  return band === null ? null : EFFECTS[preset];
}

/** A band's name in a preset: "Amethyst", "Rose gold", "Prism". */
export const bandName = (preset: Preset, band: Band): string => PRESETS[preset].bands[band - 1]!;

/** "8.0 – 8.4" … "9.5 – 10", for the key. */
export const bandRange = (band: Band): string => (band === 4 ? '9.5 – 10' : `${BAND_FLOORS[band - 1]!.toFixed(1)} – ${(BAND_FLOORS[band]! - 0.1).toFixed(1)}`);

/**
 * The whole app's look (D64; all four built since D65; eight more since D70; three light ones since D72; eleven since D90). A look changes only
 * colours and the background behind everything, never fonts, sizes or shapes (D70: the owner's rule;
 * Holo Pearl's and Deep Forest's title fonts are from before it).
 */
export type Look = 'aurora' | 'neon' | 'forest' | 'sakura' | 'fireflies' | 'deepsea' | 'frost' | 'nebula' | 'outrun' | 'lava' | 'daysky';
/**
 * The looks that went in D90 (the owner: Holo Pearl and Haze go; one light look, Daylight, in place of three) and the
 * look each now shows as. Saved choices aren't rewritten: they're read as their replacement (`movedLook`), so a
 * friend's board, the phone's memory (look.js) and your Settings all agree. Daylight keeps Daylight Sky's name inside.
 */
export const LOOKS_MOVED: Readonly<Record<string, Look>> = { pearl: 'aurora', haze: 'aurora', daymint: 'daysky', daypearl: 'daysky' };
/** A saved look as it shows today: itself, its replacement (D90), or null for one this build doesn't know. */
export function movedLook(v: string): Look | null {
  if ((LOOK_KEYS as readonly string[]).includes(v)) return v as Look;
  return LOOKS_MOVED[v] ?? null;
}
/**
 * In the order Appearance lists them: under Dark mode, Aurora Glass (everyone's first look, D71), then A to Z by
 * name; under Light mode (D73), at the end, the light looks A to Z.
 */
export const LOOK_KEYS = ['aurora', 'forest', 'deepsea', 'fireflies', 'frost', 'lava', 'nebula', 'neon', 'outrun', 'sakura', 'daysky'] as const satisfies readonly Look[];
/** The looks you can choose (a look not listed would show as "Coming next"). All of them. */
export const READY_LOOKS: readonly Look[] = LOOK_KEYS;
/** Marked New in Appearance (D70; D90: Daylight, the one light look). */
export const NEW_LOOKS: readonly Look[] = ['daysky'];
/** The light look (D72; one since D90, Daylight): light colours, the iPhone's own parts in their light style, light cards. Everyone starts dark: a light look is only ever chosen. */
export const LIGHT_LOOKS: readonly Look[] = ['daysky'];
/** Each look's background, for the Home Screen app's top bar (theme-color) and look.js. */
export const LOOK_BG: Record<Look, string> = {
  aurora: '#03070a', neon: '#06041a', forest: '#050807',
  sakura: '#130a13', fireflies: '#040b0b', deepsea: '#020a14', frost: '#060b12', nebula: '#05040c', outrun: '#0a0420', lava: '#12060c',
  daysky: '#eef3fa',
};
export const LOOKS: Record<Look, { label: string; description: string }> = {
  aurora: { label: 'Aurora Glass', description: 'Northern lights waving over the stars' },
  neon: { label: 'Neon Night', description: 'A city in the rain, windows and neon signs' },
  forest: { label: 'Deep Forest', description: 'Sunbeams, pines and rolling fog' },
  sakura: { label: 'Sakura', description: 'Dusk pink, a swaying branch, petals falling' },
  fireflies: { label: 'Fireflies', description: 'A summer night, grass in the wind, little lights' },
  deepsea: { label: 'Deep Sea', description: 'Light rays, bubbles and a drifting jellyfish' },
  frost: { label: 'Frost', description: 'Icy blue, snow falling, crystals in the corners' },
  nebula: { label: 'Nebula', description: 'Turning clouds of colour and shooting stars' },
  outrun: { label: 'Outrun', description: 'A striped sunset and a neon grid racing by' },
  lava: { label: 'Lava Lamp', description: 'Warm blobs that rise and melt together' },
  daysky: { label: 'Daylight', description: 'Soft clouds drifting past a warm sun' },
};

/** The top of the Leaderboard (D64), also used by the Log, a friend's board and a name's page. D87 kept the saved
 *  names and gave them new tops: `strip` Compact, `hero` Showcase, `tiles` Summary. */
export type BoardTop = 'hero' | 'tiles' | 'strip';
export const BOARD_TOP_KEYS = ['strip', 'hero', 'tiles'] as const satisfies readonly BoardTop[];
export const BOARD_TOPS: Record<BoardTop, { label: string; description: string }> = {
  hero: { label: 'Showcase', description: 'Your top three as big photos' },
  tiles: { label: 'Summary', description: 'One card, how your scores spread' },
  strip: { label: 'Compact', description: 'One line, more rows' },
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

/** What an account has before it saves any choice (D91: Aurora's colours; D71's were the slim strip and Gems, D64's the glass hero and Aurora). */
export const DEFAULT_APPEARANCE: Appearance = { look: 'aurora', top: 'strip', preset: 'aurora', markFirst: true };

/**
 * A whole Appearance object, checked: a look you can choose, a known top and preset, and a boolean.
 * A look or top that's missing (a backup from before 0.54.0, or an app still open from before)
 * takes the default; anything else wrong is refused. With `moved` (a backup being restored), a look or colour set
 * that went (D90, D91) reads as its replacement; saving one through the app is refused.
 */
export function validateAppearance(raw: unknown, opts: { moved?: boolean } = {}): { ok: true; value: Appearance } | { ok: false; message: string } {
  const bad = { ok: false, message: 'The appearance settings couldn’t be read.' } as const;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return bad;
  const r = raw as Record<string, unknown>;
  let look = r.look === undefined ? DEFAULT_APPEARANCE.look : r.look;
  const top = r.top === undefined ? DEFAULT_APPEARANCE.top : r.top;
  let preset = r.preset;
  if (opts.moved) {
    if (typeof look === 'string') look = movedLook(look) ?? look;
    if (typeof preset === 'string') preset = movedPreset(preset) ?? preset;
  }
  if (!READY_LOOKS.includes(look as Look) || !BOARD_TOP_KEYS.includes(top as BoardTop)) return bad;
  if (!PRESET_KEYS.includes(preset as Preset) || typeof r.markFirst !== 'boolean') return bad;
  return { ok: true, value: { look: look as Look, top: top as BoardTop, preset: preset as Preset, markFirst: r.markFirst } };
}
