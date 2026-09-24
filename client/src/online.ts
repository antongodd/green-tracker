import { useEffect, useState } from 'preact/hooks';

// Online = the browser says so AND the server was reachable last time we tried.
// navigator.onLine alone isn't enough: it stays true on Wi-Fi with no internet,
// behind a hotel login page, and in some browsers' offline emulation. So a request
// that fails to reach the server also counts as offline, and while it does, the
// server is checked every few seconds so the app notices when it's back.
let reachable = true;
let probe: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();
const PROBE_MS = 5_000;

const isOnline = () => navigator.onLine && reachable;

/** Called by the API client: did this request reach the server? */
export function reportNetwork(reached: boolean): void {
  if (reached === reachable) return;
  reachable = reached;
  if (reached) {
    clearInterval(probe);
    probe = undefined;
  } else {
    probe ??= setInterval(checkServer, PROBE_MS);
  }
  listeners.forEach((l) => l());
}

async function checkServer(): Promise<void> {
  if (!navigator.onLine) return;
  try {
    await fetch('/api/version', { cache: 'no-store', credentials: 'same-origin' });
    reportNetwork(true);
  } catch {
    // still unreachable
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    listeners.forEach((l) => l());
    if (!reachable) void checkServer();
  });
  window.addEventListener('offline', () => listeners.forEach((l) => l()));
}

/** Online or not: the browser's online/offline events plus whether the server answers. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(isOnline);
  useEffect(() => {
    const update = () => setOnline(isOnline());
    listeners.add(update);
    update();
    return () => void listeners.delete(update);
  }, []);
  return online;
}

declare const __APP_VERSION__: string;

/**
 * Registers the service worker for this build (sw.js?v=<build>): a new deploy is a
 * new worker, which replaces the old one and its cache (see client/public/sw.js).
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(__APP_VERSION__)}`, { scope: '/' }).catch(() => {
      // Not fatal: the app works online without it.
    });
  });
}
