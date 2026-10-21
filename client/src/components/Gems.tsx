// Leaderboard colours (D48, 0.41.0): a row's colour is earned by its score, in your preset
// (Gems, Prism, Metals), and your #1 can wear a crown and a halo. A product page carries
// its row's colour: a holo badge, a haze and a flowing score; Rainbow and the 9.0 band also
// sweep the photo as it opens; Metals' Diamond twinkles. Styled in styles.css.
import { bandName, bandRange, DEFAULT_APPEARANCE, PRESETS, type Appearance, type Band } from '../../../shared/domain/gems';
import { placeBadge, type RankableProduct, type RankedRow, type ViewState } from '../../../shared/domain/leaderboard';
import { CrownIcon } from '../icons';
import { linkTo } from '../router';
import { useSession } from '../session';

/** Your appearance settings (D48); the defaults until you've signed in. */
export const useAppearance = (): Appearance => useSession().me.appearance ?? DEFAULT_APPEARANCE;

type Look = Pick<RankedRow<RankableProduct>, 'band' | 'first'>;

/** Whether this row wears the #1 mark (crown and halo). */
export const marked = (look: Look, a: Appearance): boolean => look.first && a.markFirst;

/** Extra classes for a row: `tier band3 pal-gems` for a colour, `first` for the #1 mark. */
export function rowClass(look: Look, a: Appearance): string {
  return `${look.band ? ` tier band${look.band} pal-${a.preset}` : ''}${marked(look, a) ? ' first' : ''}`;
}

/** Only Metals' Diamond twinkles: three glints in the row's corners, clear of all text. */
export function Glints(p: { band: Band | null; appearance: Appearance }) {
  if (p.band !== 3 || p.appearance.preset !== 'metals') return null;
  return (
    <>
      <span class="glint g1" aria-hidden="true" />
      <span class="glint g2" aria-hidden="true" />
      <span class="glint g3" aria-hidden="true" />
    </>
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

/** Diamond's glints on its page: three in the photo's upper part, clear of all text. */
export function PhotoGlints(p: { band: Band | null; appearance: Appearance }) {
  return <Glints band={p.band} appearance={p.appearance} />;
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

/** The key (D48): each colour in your preset and the scores that earn it, top first. */
export function ColoursSheet(p: { onClose: () => void }) {
  const a = useAppearance();
  return (
    <>
      <div class="scrim" onClick={p.onClose} />
      <div class="sheet keysheet" role="dialog" aria-modal="true" aria-labelledby="key-title">
        <div class="grp">
          <div class="ttl">
            <strong id="key-title">Leaderboard colours</strong>
            A product’s colour comes from its score. Yours are {PRESETS[a.preset].label}.
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
                <span class="range">your #1</span>
              </li>
            )}
          </ul>
          <p class="key-note">Price and value for money aren’t scores, so they have no colours.</p>
          <a class="opt" href="/more/appearance" onClick={linkTo('/more/appearance')}>
            Change in Appearance
          </a>
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
