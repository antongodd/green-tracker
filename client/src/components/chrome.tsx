import type { ComponentChildren } from 'preact';
import { BackIcon, BoardIcon, BoardLineIcon, FlameIcon, FlameLineIcon, LeafGlass, LogIcon, LogLineIcon, MoreIcon, MoreLineIcon, PeopleIcon, PeopleLineIcon } from '../icons';
import { back, linkTo } from '../router';
import { useSession, useSmokesOn } from '../session';
import { Tick } from './Tick';

/**
 * Header (brief §8): equal-width side slots keep the title optically centred.
 * Empty slots keep their space (visibility: hidden). `icon` replaces the leaf before
 * the title (a friend's photo beside @username, D23); the main tabs put your own
 * photo on the right (MeButton, D25).
 */
export function Header(p: { title?: string; leaf?: boolean; icon?: ComponentChildren; left?: ComponentChildren; right?: ComponentChildren }) {
  // D47: on the dev site an orange DEV label sits after the title on every screen.
  const dev = useSession().me.site === 'dev';
  return (
    <header class="hdr">
      <div class="bar">
        <div class={`slot${p.left ? '' : ' hidden'}`}>{p.left}</div>
        <div class="title">
          {p.icon ?? (p.leaf !== false && <LeafGlass />)}
          <span>{p.title ?? 'Green Tracker'}</span>
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

export type Tab = 'leaderboard' | 'smokes' | 'log' | 'people' | 'more';

/** Each tab: its solid icon (the tab you're on) and its outline (the others), D35. */
const TABS: { key: Tab; label: string; path: string; Icon: typeof BoardIcon; Line: typeof BoardIcon }[] = [
  { key: 'leaderboard', label: 'Leaderboard', path: '/', Icon: BoardIcon, Line: BoardLineIcon },
  { key: 'smokes', label: 'Smokes', path: '/smokes', Icon: FlameIcon, Line: FlameLineIcon },
  { key: 'log', label: 'Log', path: '/log', Icon: LogIcon, Line: LogLineIcon },
  { key: 'people', label: 'People', path: '/people', Icon: PeopleIcon, Line: PeopleLineIcon },
  { key: 'more', label: 'More', path: '/more', Icon: MoreIcon, Line: MoreLineIcon },
];

/** Tab bar (D6, P1; five tabs since 0.36.0, D43; four where Smokes is off, D46). The active tab is the only indicator of the main screen. */
export function TabBar(p: { active: Tab | null }) {
  const requests = useSession().me.pendingRequests ?? 0;
  const tabs = useSmokesOn() ? TABS : TABS.filter((t) => t.key !== 'smokes');
  return (
    <nav class="nav" aria-label="Main">
      <div class="tabs">
        {tabs.map(({ key, label, path, Icon, Line }) => (
          <a key={key} class="tab" href={path} onClick={linkTo(path)} aria-current={p.active === key ? 'page' : undefined}>
            {p.active === key ? <Icon class="tab-on" /> : <Line class="tab-off" />}
            <span class="tab-l">{label}</span>
            {key === 'people' && requests > 0 && (
              <span class="badge" aria-label={`${requests} follow ${requests === 1 ? 'request' : 'requests'}`}>
                {requests}
              </span>
            )}
          </a>
        ))}
      </div>
    </nav>
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

/** The glowing leaf tile above the headings of the sign-up and recovery screens (D36, 0.29.0). */
export function AuthMark() {
  return (
    <div class="auth-mark" aria-hidden="true">
      <LeafGlass />
    </div>
  );
}
