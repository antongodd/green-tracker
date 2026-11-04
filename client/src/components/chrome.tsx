import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { BackIcon, BoardIcon, BoardLineIcon, FeedIcon, FeedLineIcon, LeafGlass, PlusIcon, SourcesIcon, SourcesLineIcon, StrainzIcon, StrainzLineIcon } from '../icons';
import { back, linkTo, navigate } from '../router';
import { useSession } from '../session';
import { Tick } from './Tick';

/**
 * Header (brief §8): equal-width side slots keep the title optically centred.
 * Empty slots keep their space (visibility: hidden). `icon` goes before the title (a friend's photo
 * beside @username, D23); the main screens put your own photo on the right (MeButton, D25: Settings
 * since D87).
 *
 * D87: the main screens have Apple's large title (`LargeTitle`, first in their `<main>`). With `large`
 * the bar is clear at the top; as you scroll the big title slides under it, the bar turns to glass and
 * the small title fades in (`.hdr.top` while you're at the top). The leaf is gone from the bar (`leaf`
 * brings it back where it's wanted).
 */
export function Header(p: { title?: string; leaf?: boolean; icon?: ComponentChildren; left?: ComponentChildren; right?: ComponentChildren; large?: boolean }) {
  // D47: on the dev site an orange DEV label sits after the title on every screen.
  const dev = useSession().me.site === 'dev';
  const atTop = useAtTop(!!p.large);
  return (
    <header class={`hdr${p.large ? ' large' : ''}${p.large && atTop ? ' top' : ''}`}>
      <div class="bar">
        <div class={`slot${p.left ? '' : ' hidden'}`}>{p.left}</div>
        <div class="title">
          {p.icon ?? (p.leaf === true && <LeafGlass />)}
          <span aria-hidden={p.large ? 'true' : undefined}>{p.title ?? 'Green Tracker'}</span>
          {dev && (
            <b class="dev-badge" aria-label="Dev site">
              DEV
            </b>
          )}
        </div>
        <div class={`slot r${p.right ? '' : ' hidden'}`}>{p.right}</div>
      </div>
    </header>
  );
}

/** True while the page is scrolled (nearly) to the top: the large title is showing (D87). */
function useAtTop(on: boolean): boolean {
  const [top, setTop] = useState(true);
  useEffect(() => {
    if (!on) return;
    const check = () => setTop(window.scrollY < 36);
    check();
    window.addEventListener('scroll', check, { passive: true });
    return () => window.removeEventListener('scroll', check);
  }, [on]);
  return top;
}

/** A main screen's large title (D87): its name, big on the left, first in its `<main>`. */
export function LargeTitle(p: { title: string }) {
  return <h1 class="ltitle">{p.title}</h1>;
}

/** Goes back in the app's history when there is some (so screens can restore); otherwise to `to`. */
export function BackButton(p: { to: string; label?: string }) {
  const onClick = (e: MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    back(p.to);
  };
  return (
    <a class="hbtn" href={p.to} onClick={onClick} aria-label={p.label ? undefined : 'Back'}>
      <BackIcon />
      {p.label}
    </a>
  );
}

/** `more` is Settings (D61): no tab since D87 (your photo, top right, opens it); its screens keep their /more
 *  addresses. `feed` took People's place (D77). */
export type Tab = 'leaderboard' | 'strainz' | 'sources' | 'feed' | 'more';

/** Each tab: its solid icon (the tab you're on) and its outline (the others), D35. */
const TABS: { key: Tab; label: string; path: string; Icon: typeof BoardIcon; Line: typeof BoardIcon }[] = [
  { key: 'leaderboard', label: 'Leaderboard', path: '/', Icon: BoardIcon, Line: BoardLineIcon },
  { key: 'strainz', label: 'Strainz', path: '/strainz', Icon: StrainzIcon, Line: StrainzLineIcon },
  { key: 'sources', label: 'Sources', path: '/sources', Icon: SourcesIcon, Line: SourcesLineIcon },
  { key: 'feed', label: 'Feed', path: '/feed', Icon: FeedIcon, Line: FeedLineIcon },
];

/**
 * Tab bar (D6, P1; Smokes went in D60; Sources and Settings since D61; Feed in People's place since D77). The
 * active tab is the only indicator of the main screen. The Feed carries one mark at a time (D77): the follow
 * requests number, which needs you to act; otherwise a dot when there's something new.
 */
/**
 * The tab you're on, tapped again: on its own page that's a `gt-tab-again` event (the Feed goes to the top
 * and fetches what's new, 0.69.9); deeper in (a post, a product), it goes there as usual.
 */
function again(key: Tab, path: string) {
  const go = linkTo(path);
  return (e: MouseEvent) => {
    if (location.pathname !== path) return go(e);
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('gt-tab-again', { detail: key }));
  };
}

/** What the + beside the bar does on a screen (D92): its label (read out) and what it opens. */
export interface AddAction {
  label: string;
  onAdd: () => void;
}
/** Anywhere without a + of its own (Settings, a friend's page…), the + adds a product (D92, the owner). */
const ADD_PRODUCT: AddAction = { label: 'Add a product', onAdd: () => navigate('/products/new') };

/**
 * D87: a floating glass bar of four tabs, and the + beside it as its own round button. D92: the + is on every screen
 * with the bar, always in the same place, so the bar never changes width (it once widened on Sources and Settings).
 * Each main tab's + does its own thing (`add`); everywhere else it adds a product.
 */
export function TabBar(p: { active: Tab | null; add?: AddAction }) {
  const { me } = useSession();
  const requests = me.pendingRequests ?? 0;
  const fresh = !requests && !!me.feedNew && p.active !== 'feed';
  const add = p.add ?? ADD_PRODUCT;
  return (
    <>
      <nav class="nav" aria-label="Main">
        <div class="tabs">
          {TABS.map(({ key, label, path, Icon, Line }) => (
            <a key={key} class="tab" href={path} onClick={p.active === key ? again(key, path) : linkTo(path)} aria-current={p.active === key ? 'page' : undefined}>
              {p.active === key ? <Icon class="tab-on" /> : <Line class="tab-off" />}
              <span class="tab-l">{label}</span>
              {key === 'feed' && requests > 0 && (
                <span class="badge" aria-label={`${requests} follow ${requests === 1 ? 'request' : 'requests'}`}>
                  {requests}
                </span>
              )}
              {key === 'feed' && fresh && <span class="badge dot" aria-label="Something new" />}
            </a>
          ))}
        </div>
      </nav>
      <button type="button" class="fab" aria-label={add.label} onClick={add.onAdd}>
        <PlusIcon />
      </button>
    </>
  );
}

export interface SheetOption {
  label: string;
  danger?: boolean;
  /** A light tick as you tap it (D56): deleting, Return to Log. */
  tick?: boolean;
  onSelect: () => void;
}

/** Action / confirmation sheet (P6). Cancel is always last and bold. */
export function Sheet(p: { title?: string; message?: string; options: SheetOption[]; onCancel: () => void; cancelLabel?: string }) {
  return (
    <>
      <div class="scrim" onClick={p.onCancel} />
      <div class="sheet" role="dialog" aria-modal="true" aria-label={p.title ?? 'Options'}>
        <div class="grp">
          {(p.title || p.message) && (
            <div class="ttl">
              {p.title && <strong>{p.title}</strong>}
              {p.message}
            </div>
          )}
          {p.options.map((o) => (
            <button type="button" key={o.label} class={`opt${o.danger ? ' dng' : ''}${o.tick ? ' has-tick' : ''}`} onClick={o.onSelect}>
              {o.label}
              {o.tick && <Tick />}
            </button>
          ))}
        </div>
        <div class="grp">
          <button type="button" class="opt bold" onClick={p.onCancel} autoFocus>
            {p.cancelLabel ?? 'Cancel'}
          </button>
        </div>
      </div>
    </>
  );
}

/** The glowing leaf tile above the headings of the sign-in and sign-up screens (D36, 0.29.0). */
export function AuthMark() {
  return (
    <div class="auth-mark" aria-hidden="true">
      <LeafGlass />
    </div>
  );
}
