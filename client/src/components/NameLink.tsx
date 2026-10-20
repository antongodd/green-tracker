import { ChevronRight } from '../icons';
import { linkTo } from '../router';

/** A brand or supplier's own page (D59): yours under /brands, a friend's under their board. */
export const brandPath = (name: string, board?: string): string => `${board ?? ''}/brands/${encodeURIComponent(name.trim())}`;

/** A Source or Supplier on a product page, in green: tap to see everything with that name (D59). */
export function NameLink(p: { name: string; to: string }) {
  return (
    <a class="namelink" href={p.to} onClick={linkTo(p.to)}>
      {p.name}
      <ChevronRight class="chev" />
    </a>
  );
}
