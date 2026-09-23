import type { ComponentChildren } from 'preact';
import { BackIcon, BoardIcon, LeafGlass, LogIcon, MoreIcon, PeopleIcon } from '../icons';
import { back, linkTo } from '../router';

/**
 * Header (brief §8): equal-width side slots keep the title optically centred.
 * Empty slots keep their space (visibility: hidden).
 */
export function Header(p: { title?: string; leaf?: boolean; left?: ComponentChildren; right?: ComponentChildren }) {
  return (
    <header class="hdr">
      <div class="bar">
        <div class={`slot${p.left ? '' : ' hidden'}`}>{p.left}</div>
        <div class="title">
          {p.leaf !== false && <LeafGlass />}
          <span>{p.title ?? 'Green Tracker'}</span>
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

export type Tab = 'leaderboard' | 'log' | 'people' | 'more';

const TABS: { key: Tab; label: string; path: string; Icon: typeof BoardIcon }[] = [
  { key: 'leaderboard', label: 'Leaderboard', path: '/', Icon: BoardIcon },
  { key: 'log', label: 'Log', path: '/log', Icon: LogIcon },
  { key: 'people', label: 'People', path: '/people', Icon: PeopleIcon },
  { key: 'more', label: 'More', path: '/more', Icon: MoreIcon },
];

/** Tab bar (D6, P1). The active tab is the only indicator of the main screen. */
export function TabBar(p: { active: Tab | null; requests?: number }) {
  return (
    <nav class="nav" aria-label="Main">
      <div class="tabs">
        {TABS.map(({ key, label, path, Icon }) => (
          <a key={key} class="tab" href={path} onClick={linkTo(path)} aria-current={p.active === key ? 'page' : undefined}>
            <Icon />
            {label}
            {key === 'people' && !!p.requests && (
              <span class="badge" aria-label={`${p.requests} follow requests`}>
                {p.requests}
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
  onSelect: () => void;
}

/** Action / confirmation sheet (P6). Cancel is always last and bold. */
export function Sheet(p: { title?: string; message?: string; options: SheetOption[]; onCancel: () => void }) {
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
            <button type="button" key={o.label} class={`opt${o.danger ? ' dng' : ''}`} onClick={o.onSelect}>
              {o.label}
            </button>
          ))}
        </div>
        <div class="grp">
          <button type="button" class="opt bold" onClick={p.onCancel} autoFocus>
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
