import { useEffect, useState } from 'preact/hooks';
import { backToRowWithPhoto, openProductWithPhoto } from './transitions';

// A small history router: the app has a handful of flat paths.
// Each entry records its depth, so Back can tell whether there is an in-app
// page to go back to (a deep link has none).

const listeners = new Set<() => void>();
const scrollByPath = new Map<string, number>();
let previousPath: string | null = null;

const depth = (): number => (history.state as { depth?: number } | null)?.depth ?? 0;

function changed(from: string) {
  previousPath = from;
  listeners.forEach((l) => l());
}

/** Adds (or replaces) the history entry for `path` without showing it yet. Returns the path we left, or null if already there. */
function record(path: string, replace = false): string | null {
  const from = location.pathname;
  if (path === from) return null;
  scrollByPath.set(from, window.scrollY);
  if (replace) history.replaceState({ depth: depth() }, '', path);
  else history.pushState({ depth: depth() + 1 }, '', path);
  return from;
}

export function navigate(path: string, opts: { replace?: boolean } = {}): void {
  const from = record(path, opts.replace);
  if (from === null) return;
  // New screens and tab switches start at the top (brief §10.1).
  window.scrollTo(0, 0);
  arrived();
  changed(from);
}

/** Rewrites the current history entry's path without showing a new screen. */
export function replaceHistory(path: string): void {
  history.replaceState({ depth: depth() }, '', path);
}

/** Back within the app when possible; otherwise replace with `fallback`. */
export function back(fallback: string): void {
  if (depth() > 0) {
    scrollByPath.set(location.pathname, window.scrollY);
    ownBack = true;
    if (!backToRowWithPhoto(() => history.back())) history.back();
  } else navigate(fallback, { replace: true });
}

// A swipe from the screen's edge (or the browser's own Back) is animated by the phone
// itself, so the screen it lands on appears as it is, without the usual entrance fade
// (0.19.1: after the phone's slide, the fade showed as a dark flash). The app's own
// Back button, and every other change of screen, keep the fade.
let ownBack = false;
function arrivedStill(): void {
  document.documentElement.classList.add('arrived-still');
}
/** Puts the entrance fade back for the next screen, without restarting it on the one showing. */
function arrived(): void {
  const root = document.documentElement;
  if (!root.classList.contains('arrived-still')) return;
  document.querySelectorAll<HTMLElement>('.screen, .fullscreen').forEach((el) => (el.style.animation = 'none'));
  root.classList.remove('arrived-still');
}

// The app decides where each screen starts (top, or a restored position), not the browser.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

let lastPath = location.pathname;
window.addEventListener('popstate', () => {
  const from = lastPath;
  lastPath = location.pathname;
  if (ownBack) arrived();
  else arrivedStill();
  ownBack = false;
  window.scrollTo(0, 0);
  changed(from);
});

export function usePath(): string {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const update = () => {
      lastPath = location.pathname;
      setPath(location.pathname);
    };
    listeners.add(update);
    return () => void listeners.delete(update);
  }, []);
  return path;
}

/** The path we arrived from, for screens that restore their scroll on return. */
export const cameFrom = (): string | null => previousPath;
export const savedScroll = (path: string): number | undefined => scrollByPath.get(path);

/** Opens a product from a list row: with the photo animation where available (D20). */
export function openRow(e: MouseEvent, path: string): void {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  const shown = openProductWithPhoto(
    e.currentTarget as HTMLElement,
    () => record(path),
    (from) => {
      arrived();
      changed(from);
    },
  );
  if (!shown) navigate(path);
}

/** Click handler for in-app links: keeps modifier-clicks and new tabs working. */
export function linkTo(path: string) {
  return (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(path);
  };
}
