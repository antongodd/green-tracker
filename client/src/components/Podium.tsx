// Podium product pages (D22): a product in the top four of the Leaderboard (under the
// current filter and Rank by) carries its row's tier onto its page, with a "descending
// shine": 1st rainbow gets every piece, Diamond everything plus glints, Platinum a
// frame, silver score and badge, Pewter a calm frame and badge. Styled in styles.css.
import { podiumBadge, type Podium, type ViewState } from '../../../shared/domain/leaderboard';
import { CrownIcon } from '../icons';

/** Classes for the page's <main>: `tiered p1`…`p4`, or nothing. */
export const podiumClass = (podium: Podium | null) => (podium ? ` tiered p${podium}` : '');

/** "#1 on your Leaderboard", "#2 in Flower"… Only first place wears the crown. */
export function PodiumBadge(p: { podium: Podium | null; view: ViewState; whose: 'your' | 'their' }) {
  if (!p.podium) return null;
  const [n, ...rest] = podiumBadge(p.podium, p.view, p.whose).split(' ');
  return (
    <span class="podium-badge">
      {p.podium === 1 && <CrownIcon />}
      <span>
        <span class="n">{n}</span> {rest.join(' ')}
      </span>
    </span>
  );
}

/** Diamond's glints on its page: the big photo's top corners (the card's corner is in the hero). */
export function PhotoGlints(p: { podium: Podium | null }) {
  if (p.podium !== 2) return null;
  return (
    <>
      <span class="glint g1" aria-hidden="true" />
      <span class="glint g2" aria-hidden="true" />
    </>
  );
}

export function CardGlint(p: { podium: Podium | null }) {
  return p.podium === 2 ? <span class="glint g3" aria-hidden="true" /> : null;
}
