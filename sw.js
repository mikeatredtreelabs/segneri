/* ═══════════════════════════════════════════════════════════════════
   Italiano Vocab Trainer — Service Worker
   Caches all pack files + app shell for full offline use
   ═══════════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'sengeri-v2';

const SHELL_FILES = [
  './app.html',
  './app.js',
  './manifest.json',
];

const PACK_FILES = [
  './pack-greet.js',
  './pack-food.js',
  './pack-travel.js',
  './pack-verbs.js',
  './pack-adjectives.js',
  './pack-numbers.js',
  './pack-family.js',
  './pack-body.js',
  './pack-health.js',
  './pack-shopping.js',
  './pack-clothing.js',
  './pack-home.js',
  './pack-nature.js',
  './pack-animals.js',
  './pack-work.js',
  './pack-tech.js',
  './pack-sports.js',
  './pack-arts.js',
  './pack-emotions.js',
  './pack-advverbs.js',
];

const ALL_FILES = [...SHELL_FILES, ...PACK_FILES];

/* ── Install: cache everything upfront ──────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ALL_FILES))
      .then(() => self.skipWaiting())
  );
});

/* ── Activate: clean up old caches ─────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch: cache-first strategy ────────────────────────────────── */
self.addEventListener('fetch', event => {
  // Only handle GET requests for our own files
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      // Not in cache — fetch and cache it
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for navigation
        if (event.request.mode === 'navigate') {
          return caches.match('./app.html');
        }
      });
    })
  );
});
