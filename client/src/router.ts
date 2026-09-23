import { useEffect, useState } from 'preact/hooks';

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

export function navigate(path: string, opts: { replace?: boolean } = {}): void {
  const from = location.pathname;
  if (path === from) return;
  scrollByPath.set(from, window.scrollY);
  if (opts.replace) history.replaceState({ depth: depth() }, '', path);
  else history.pushState({ depth: depth() + 1 }, '', path);
  // New screens and tab switches start at the top (brief §10.1).
  window.scrollTo(0, 0);
  changed(from);
}

/** Back within the app when possible; otherwise replace with `fallback`. */
export function back(fallback: string): void {
  if (depth() > 0) {
    scrollByPath.set(location.pathname, window.scrollY);
    history.back();
  } else navigate(fallback, { replace: true });
}

let lastPath = location.pathname;
window.addEventListener('popstate', () => {
  const from = lastPath;
  lastPath = location.pathname;
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

/** Click handler for in-app links: keeps modifier-clicks and new tabs working. */
export function linkTo(path: string) {
  return (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(path);
  };
}
