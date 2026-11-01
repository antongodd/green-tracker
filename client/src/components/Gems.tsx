// Leaderboard colours (D48, 0.41.0): a row's colour is earned by its score, in your preset
// (ten since D69), and your #1 can wear a crown and a halo. A product page carries
// its row's colour: a holo badge, a haze and a flowing score; Rainbow and the 9.0 band also
// sweep the photo as it opens; Metals' Diamond twinkles, and D69's sets each have an effect
// of their own (Effects). Styled in styles.css.
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

/** Extra classes for a row: `tier band3 pal-gems` for a colour, `first` for the #1 mark. */
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

function effectDots(effect: Effect, band: Band, where: Where): JSX.Element[] {
  switch (effect) {
    case 'sun':
      return [<i key="s" />];
    case 'plankton':
      return range(band === 4 ? 10 : 6).map((i) => <i key={i} style={at(where, i, { '--d': `${6 + (i % 3) * 2}s` })} />);
    case 'stars': {
      const stars = range([0, 0, 5, 8, 12][band]!).map((i) => <i key={i} class={i % 4 === 1 ? 'big' : undefined} style={at(where, i)} />);
      return band === 4 ? [<i key="n" class="nebula" />, ...stars] : stars;
    }
    case 'sparks':
      return [
        <i key="h" class="heat" />,
        ...range(10).map((i) => {
          const [x] = DOTS[where][i]!;
          return <i key={i} style={{ left: `${x}%`, top: where === 'page' ? '96%' : 'calc(100% - 4px)', '--d': `${1.6 + (i % 4) * 0.5}s`, '--dl': `-${((i * 0.7) % 2.4).toFixed(1)}s`, '--dx': `${(i % 5) * 3 - 6}px` }} />;
        }),
      ];
    case 'grid':
      return band === 4 ? [<i key="s" class="sun" />, <i key="f" class="floor" />] : [<i key="f" class="floor" />];
    default:
      return [];
  }
}

/**
 * What a coloured card shows besides its colours (bandEffect): Metals' Diamond twinkles (three
 * glints in the corners), and D69's sets draw their sun, plankton, sparks, stars or grid, all clear
 * of the words. Reduce Motion holds them still (the glints, which only twinkle, go).
 */
export function Effects(p: { band: Band | null; appearance: Appearance; where?: Where }) {
  const effect = bandEffect(p.appearance.preset, p.band);
  if (!effect || !p.band) return null;
  if (effect === 'glints')
    return (
      <>
        <span class="glint g1" aria-hidden="true" />
        <span class="glint g2" aria-hidden="true" />
        <span class="glint g3" aria-hidden="true" />
      </>
    );
  return (
    <span class={`tfx tfx-${effect}`} aria-hidden="true">
      {effectDots(effect, p.band, p.where ?? 'row')}
    </span>
  );
}

/** The crown above #1's rank number (D48). */
export function RankCrown(p: { look: Look; appearance: Appearance }) {
  return marked(p.look, p.appearance) ? <CrownIcon class="rank-crown" label="Number 1" /> : null;
}

/** Classes for a product page's <main>: its row's colour (`tiered band3 pal-gems`) and the #1 mark. */
export function pageClass(place: Look | null, a: Appearance): string {
  if (!place) return '';
  return `${place.band ? ` tiered band${place.band} pal-${a.preset}` : ''}${marked(place, a) ? ' first' : ''}`;
}

/** "Amethyst · #3 on your Leaderboard", or "#1 by Price" for an uncoloured #1. The crown goes on #1. */
export function PlaceBadge(p: { place: Pick<RankedRow<RankableProduct>, 'rank' | 'band' | 'first'> | null; view: ViewState; whose: 'your' | 'their'; appearance: Appearance }) {
  if (!p.place) return null;
  const text = placeBadge(p.place, p.view, p.whose, p.appearance);
  if (!text) return null;
  // The colour's name and the place number flow through the colours; the rest stays plain.
  const [gem, where] = text.includes(' · ') ? text.split(' · ') : [null, text];
  const [n, ...rest] = where!.split(' ');
  return (
    <span class={`gem-badge${p.place.band ? '' : ' plain'}`}>
      {marked(p.place, p.appearance) && <CrownIcon />}
      <span>
        {gem && (
          <>
            <span class="gem">{gem}</span>
            {' · '}
          </>
        )}
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
