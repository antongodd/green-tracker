// Leaderboard colours (D48, 0.41.0): a row's colour is earned by its score, in your preset
// (twelve since D91), and your #1 can wear a crown and a halo. A product page carries
// its row's colour: a holo badge, a haze and a flowing score; the top two bands also
// sweep the photo as it opens; every set has an effect of its own (Effects, D91). Styled in styles.css.
import { createContext, type ComponentChildren, type JSX } from 'preact';
import { useContext, useLayoutEffect, useRef } from 'preact/hooks';
import { bandEffect, bandName, bandRange, DEFAULT_APPEARANCE, PRESETS, type Appearance, type Band, type Effect } from '../../../shared/domain/gems';
import { placeBadge, type RankableProduct, type RankedRow, type ViewState } from '../../../shared/domain/leaderboard';
import { CrownIcon } from '../icons';
import { linkTo } from '../router';
import { borrowLook } from '../screenLook';
import { useSession } from '../session';
import { useTheirLook } from '../theirLook';

const Theirs = createContext<Appearance | null>(null);

/** Your appearance settings (D48), or theirs inside InTheirLook (D74); the defaults until you've signed in. */
export function useAppearance(): Appearance {
  const theirs = useContext(Theirs);
  const own = useSession().me.appearance ?? DEFAULT_APPEARANCE;
  return theirs ?? own;
}

/**
 * The board and product pages of someone you follow, in their look, top and colours (D74), once
 * known. A look known when the screen opens is on before it's drawn (so going between their pages
 * never shows yours); one that arrives later fades in. Leaving puts yours back.
 */
export function InTheirLook(p: { username: string; children: ComponentChildren }) {
  const theirs = useTheirLook(p.username);
  const opened = useRef(false);
  useLayoutEffect(() => {
    if (theirs) borrowLook(theirs.look, opened.current);
    opened.current = true;
  }, [theirs?.look]);
  useLayoutEffect(() => () => borrowLook(null), []);
  return <Theirs.Provider value={theirs}>{p.children}</Theirs.Provider>;
}

type Look = Pick<RankedRow<RankableProduct>, 'band' | 'first'>;

/** Whether this row wears the #1 mark (crown and halo). */
export const marked = (look: Look, a: Appearance): boolean => look.first && a.markFirst;

/** Extra classes for a row: `tier band3 pal-aurora` for a colour, `first` for the #1 mark. */
export function rowClass(look: Look, a: Appearance): string {
  return `${look.band ? ` tier band${look.band} pal-${a.preset}` : ''}${marked(look, a) ? ' first' : ''}`;
}

type Where = 'row' | 'page';
/** [left, top] of each dot: on a row, % across and px from the top (negative: from the bottom),
 *  in the thin strips along its edges, clear of every word; on a page, % of the photo's upper part. */
const DOTS: Record<Where, readonly (readonly [number, number])[]> = {
  row: [[38, 3], [62, 4], [84, -5], [46, -4], [72, 2], [94, -3], [55, -6], [28, 2], [80, 5], [66, -5], [90, 3], [35, -3]],
  page: [[12, 20], [78, 14], [40, 60], [88, 52], [25, 82], [60, 30], [6, 55], [70, 78], [50, 8], [33, 40], [94, 30], [18, 66]],
};
const at = (where: Where, i: number, extra: Record<string, string> = {}): JSX.CSSProperties => {
  const [x, y] = DOTS[where][i]!;
  return { left: `${x}%`, top: where === 'page' ? `${y}%` : y < 0 ? `calc(100% + ${y - 3}px)` : `${y}px`, '--d': `${3 + (i % 4) * 0.9}s`, '--dl': `-${((i * 1.3) % 4).toFixed(1)}s`, ...extra };
};
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** How many little things each effect draws, band 1 (8.0) to band 4 (9.5): a hint growing to a full show (D91). */
const COUNTS: Record<Effect, readonly [number, number, number, number]> = {
  ribbons: [1, 2, 3, 3], sprinkles: [2, 4, 6, 9], stars: [2, 5, 8, 12], plankton: [2, 4, 6, 10], sparks: [2, 4, 7, 10], glitter: [2, 3, 5, 7],
  tubes: [1, 2, 3, 3], beams: [1, 2, 3, 3], rain: [3, 5, 8, 12], sun: [2, 3, 5, 6], grid: [0, 0, 3, 5], goo: [2, 4, 6, 8],
};

/** Dots at the strip positions (row) or across the photo's upper part (page). */
const dots = (n: number, where: Where, cls: (i: number) => string | undefined = () => undefined, extra: (i: number) => Record<string, string> = () => ({}), prefix = 'd', from = 0) =>
  range(n).map((i) => <i key={`${prefix}${i}`} class={cls(i)} style={at(where, from + i, extra(i))} />);
/** Things that rise from the bottom edge (sparks, goo), or fall from the top (rain). */
const fromEdge = (n: number, where: Where, edge: 'bottom' | 'top', cls?: string, from = 0) =>
  range(n).map((j) => {
    const i = from + j;
    const [x] = DOTS[where][i]!;
    const top = edge === 'top' ? (where === 'page' ? '-6%' : '-10px') : where === 'page' ? '96%' : 'calc(100% - 4px)';
    return <i key={`${edge}${i}`} class={cls} style={{ left: `${x}%`, top, '--d': `${1.6 + (i % 4) * 0.5}s`, '--dl': `-${((i * 0.7) % 2.4).toFixed(1)}s`, '--dx': `${(i % 5) * 3 - 6}px` }} />;
  });

/**
 * Every piece an effect draws (D91). Pieces with `glow` are faint washes that may pass behind words (the readability
 * tests judge them at every moment); every other piece keeps to the strips along a row's edges, clear of the words.
 */
function effectDots(effect: Effect, band: Band, where: Where): JSX.Element[] {
  const n = COUNTS[effect][band - 1]!;
  const full = band === 4;
  switch (effect) {
    case 'ribbons':
      return [...range(n).map((i) => <i key={`r${i}`} class={`rib r${i + 1}`} />), ...(full ? [<i key="c" class="glow curtain" />, ...dots(5, where, () => 'st', undefined, 's')] : [])];
    case 'sprinkles':
      return [...dots(n, where, (i) => `spr s${i % 3}`), ...(full ? [<i key="w" class="glow swirl" />] : [])];
    case 'stars': {
      const stars = dots(n, where, (i) => (i % 4 === 1 ? 'big' : undefined));
      return full ? [<i key="n" class="glow nebula" />, <i key="s" class="shoot" />, ...stars] : stars;
    }
    case 'plankton':
      return [...dots(n, where, (i) => (i % 3 === 0 ? 'bub' : undefined), (i) => ({ '--d': `${6 + (i % 3) * 2}s` })), ...(full ? [<i key="r" class="glow ray" />, <i key="j" class="glow jelly" />] : [])];
    case 'sparks':
      return [...(full ? [<i key="h" class="glow heat" />] : []), ...fromEdge(n, where, 'bottom')];
    case 'glitter':
      return [...dots(n, where, () => 'gl'), ...(full ? dots(3, where, () => 'leaf', (i) => ({ '--d': `${5 + i}s` }), 'l', 9) : [])];
    case 'tubes':
      return [...range(n).map((i) => <i key={`t${i}`} class={`tube t${i + 1}${band >= 3 ? ' hum' : ''}`} />), ...(full ? [<i key="b" class="glow buzz" />] : [])];
    case 'beams':
      return [...range(n).map((i) => <i key={`b${i}`} class={`glow beam b${i + 1}`} />), ...(full ? dots(4, where, () => 'spk', undefined, 'k') : [])];
    case 'rain': {
      // Drops along the top edge and splashes along the bottom; at 9.5 lightning round the edge (never over the words).
      const drops = Math.ceil((n * 2) / 3);
      return [...fromEdge(drops, where, 'top', 'drop'), ...fromEdge(n - drops, where, 'bottom', 'splash', drops), ...(full ? [<i key="f" class="glow flash" />, <i key="b" class="bolt" />] : [])];
    }
    case 'sun':
      return [...(full ? [<i key="s" class="glow sunball" />, <i key="h" class="horizon" />] : []), ...dots(n, where, () => 'mote', (i) => ({ '--d': `${5 + (i % 3) * 1.5}s` }))];
    case 'grid':
      return [
        <i key="l" class="glow scan" />,
        ...(band >= 2 ? [<i key="f" class="floor" />] : []),
        ...(full ? [<i key="s" class="sun" />] : []),
        ...dots(n, where, () => 'st'),
      ];
    case 'goo':
      return [...(full ? [<i key="o" class="glow ooze" />, <i key="d1" class="drip d1" />, <i key="d2" class="drip d2" />, <i key="d3" class="drip d3" />] : []), ...fromEdge(n, where, 'bottom', 'goo')];
  }
}

/**
 * What a coloured card shows besides its colours (bandEffect): since D91 every set draws its own, growing band by
 * band, all clear of the words (or faint enough to pass the readability tests). Reduce Motion holds them still.
 */
export function Effects(p: { band: Band | null; appearance: Appearance; where?: Where }) {
  const effect = bandEffect(p.appearance.preset, p.band);
  if (!effect || !p.band) return null;
  return (
    <span class={`tfx tfx-${effect} fb${p.band}`} aria-hidden="true">
      {effectDots(effect, p.band, p.where ?? 'row')}
    </span>
  );
}

/** The crown above #1's rank number (D48). */
export function RankCrown(p: { look: Look; appearance: Appearance }) {
  return marked(p.look, p.appearance) ? <CrownIcon class="rank-crown" label="Number 1" /> : null;
}

/** Classes for a product page's <main>: its row's colour (`tiered band3 pal-aurora`) and the #1 mark. */
export function pageClass(place: Look | null, a: Appearance): string {
  if (!place) return '';
  return `${place.band ? ` tiered band${place.band} pal-${a.preset}` : ''}${marked(place, a) ? ' first' : ''}`;
}

/** "#3 on your Leaderboard" in the band's colours, or "#1 by Price" for an uncoloured #1. The crown goes on #1. */
export function PlaceBadge(p: { place: Pick<RankedRow<RankableProduct>, 'rank' | 'band' | 'first'> | null; view: ViewState; whose: 'your' | 'their'; appearance: Appearance }) {
  if (!p.place) return null;
  const text = placeBadge(p.place, p.view, p.whose, p.appearance);
  if (!text) return null;
  // The place number flows through the colours; the rest stays plain.
  const [n, ...rest] = text.split(' ');
  return (
    <span class={`gem-badge${p.place.band ? '' : ' plain'}`}>
      {marked(p.place, p.appearance) && <CrownIcon />}
      <span>
        <span class="n">{n}</span> {rest.join(' ')}
      </span>
    </span>
  );
}

/** The effects on a product page: in the photo's upper part, clear of all text. */
export function PhotoEffects(p: { band: Band | null; appearance: Appearance }) {
  return <Effects band={p.band} appearance={p.appearance} where="page" />;
}

/** The Colours button beside Rank by (D48): your preset's four colours as dots; opens the key. */
export function ColoursButton(p: { onClick: () => void }) {
  const a = useAppearance();
  return (
    <button type="button" class="pill key" aria-label="What the colours mean" onClick={p.onClick}>
      <span class="kdots" aria-hidden="true">
        {BANDS.map((b) => (
          <i key={b} class={`kdot band${b} pal-${a.preset}`} />
        ))}
      </span>
    </button>
  );
}

const BANDS: Band[] = [1, 2, 3, 4];

/** The key (D48): each colour in your preset and the scores that earn it, top first; on a friend's board their preset (D74). */
export function ColoursSheet(p: { onClose: () => void; owner?: string }) {
  const a = useAppearance();
  return (
    <>
      <div class="scrim" onClick={p.onClose} />
      <div class="sheet keysheet" role="dialog" aria-modal="true" aria-labelledby="key-title">
        <div class="grp">
          <div class="ttl">
            <strong id="key-title">Leaderboard colours</strong>
            A product’s colour comes from its score. {p.owner ? `@${p.owner}’s are` : 'Yours are'} {PRESETS[a.preset].label}.
          </div>
          <ul class="key-list">
            {[...BANDS].reverse().map((b) => (
              <li key={b}>
                <span class={`swatch band${b} pal-${a.preset}`} aria-hidden="true" />
                <b>{bandName(a.preset, b)}</b>
                <span class="range">{bandRange(b)}</span>
              </li>
            ))}
            <li>
              <span class="swatch heat" aria-hidden="true" />
              <b>Green glow</b>
              <span class="range">below 8.0</span>
            </li>
            {a.markFirst && (
              <li>
                <span class="swatch crowned" aria-hidden="true">
                  <CrownIcon />
                </span>
                <b>Crown and halo</b>
                <span class="range">{p.owner ? 'their #1' : 'your #1'}</span>
              </li>
            )}
          </ul>
          <p class="key-note">Price and value for money aren’t scores, so they have no colours.</p>
          {!p.owner && (
            <a class="opt" href="/more/colours" onClick={linkTo('/more/colours')}>
              Change colours
            </a>
          )}
        </div>
        <div class="grp">
          <button type="button" class="opt bold" onClick={p.onClose} autoFocus>
            Done
          </button>
        </div>
      </div>
    </>
  );
}
