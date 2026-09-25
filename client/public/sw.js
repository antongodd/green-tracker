// Green Tracker service worker — just enough to open when offline and say so
// (brief §3: online is required; no offline editing). It must never leave a phone
// stuck on an old build:
//  - it is registered as /sw.js?v=<build>, so every deploy installs a new worker,
//    which takes over at once and deletes every other version's cache;
//  - pages are fetched network-first: online, you always get the latest build;
//    the cached copy is only used when the network fails;
//  - the API is never touched (always live, never cached here);
//  - the background remover (D26) lives in its own `gt-ai-<model>` cache, filled by the
//    app after asking (client/src/cutout/): it survives new builds (its files are
//    named by version) and /ai/ files are served from it, so it's downloaded once.
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = `gt-shell-${VERSION}`;

self.addEventListener('install', (event) => {
  // Precache the app shell *and* this build's code and styles (read from the page),
  // so the first offline launch after installing still has a working app.
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const page = await fetch('/', { cache: 'no-store' });
      const html = await page.clone().text();
      const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
      await cache.put('/', page);
      await cache.addAll([...new Set(assets), '/manifest.webmanifest', '/icons/icon-192.png']);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && !k.startsWith('gt-ai-')).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Hashed build files never change: cache first.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  // The background remover's files: from its cache when it's on the phone, else the network (not cached here).
  if (url.pathname.startsWith('/ai/')) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
    return;
  }

  // Pages: network first; offline → the cached app shell (the app shows it's offline).
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put('/', res.clone()));
          return res;
        })
        .catch(() => caches.match('/').then((hit) => hit || Response.error())),
    );
    return;
  }

  // Anything else (icons, manifest): network first, cache as a fallback.
  event.respondWith(fetch(req).catch(() => caches.match(req).then((hit) => hit || Response.error())));
});
