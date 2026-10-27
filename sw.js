// Offline support for Žebírka na čas.
// Strategy: precache the whole app shell on install, then serve stale-while-revalidate,
// so the game starts instantly (and offline) while files refresh in the background.
// Bump VERSION to force a clean cache and show the "new version" notice in the page.
const VERSION = 'v1';
const CACHE = `zebirka-${VERSION}`;
const SHELL = [
  './', './index.html', './style.css', './manifest.webmanifest',
  './src/main.js', './src/game.js', './src/render.js', './src/audio.js', './src/scores.js',
  './fonts/alfa-slab-one-latin.woff2', './fonts/alfa-slab-one-latin-ext.woff2', './fonts/rubik-latin.woff2', './fonts/rubik-latin-ext.woff2',
  './icons/favicon-32.png', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png',
  './icons/icon-192-maskable.png', './icons/icon-512-maskable.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('zebirka-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
// The page asks a waiting worker to take over when the player taps "OBNOVIT".
self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // only our own files
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    const refresh = fetch(req).then(res => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { e.waitUntil(refresh); return cached; }
    const fresh = await refresh;
    if (fresh) return fresh;
    if (req.mode === 'navigate') { const shell = await cache.match('./index.html'); if (shell) return shell; }
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  })());
});
