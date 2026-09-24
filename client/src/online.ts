import { useEffect, useState } from 'preact/hooks';

/** Online or not, following the browser's online/offline events. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
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
