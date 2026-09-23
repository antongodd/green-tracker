import { useEffect, useState } from 'preact/hooks';

// A small history router: the app has a handful of flat paths.

const listeners = new Set<() => void>();

export function navigate(path: string, opts: { replace?: boolean } = {}): void {
  if (path === location.pathname) return;
  if (opts.replace) history.replaceState(null, '', path);
  else history.pushState(null, '', path);
  // Tab switches and new screens start at the top (brief §10.1).
  window.scrollTo(0, 0);
  listeners.forEach((l) => l());
}

export function usePath(): string {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const update = () => setPath(location.pathname);
    listeners.add(update);
    window.addEventListener('popstate', update);
    return () => {
      listeners.delete(update);
      window.removeEventListener('popstate', update);
    };
  }, []);
  return path;
}

/** Click handler for in-app links: keeps modifier-clicks and new tabs working. */
export function linkTo(path: string) {
  return (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(path);
  };
}
