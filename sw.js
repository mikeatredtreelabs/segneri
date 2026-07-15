/* ═══════════════════════════════════════════════════════════════════
   Segneri — Service Worker v2.9.0
   Network-first for shell, cache-first for pack files
   ═══════════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'sengeri-v24';

const SHELL_FILES = [
  './app.html',
  './app.js',
  './manifest.json',
  './whats-new.html',
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

/* ── Install: cache everything upfront ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll([...SHELL_FILES, ...PACK_FILES]))
      .then(() => self.skipWaiting())
  );
});

/* ── Activate: delete only OLD caches, keep current ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch: network-first for shell, cache-first for packs ── */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const filename = url.pathname.split('/').pop();

  const isShell = ['app.html', 'app.js', 'manifest.json', 'whats-new.html', ''].includes(filename);
  const isPack  = filename.startsWith('pack-') && filename.endsWith('.js');

  if (isShell) {
    // Network-first with no-cache header so browser HTTP cache is bypassed
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else if (isPack) {
    // Cache-first: pack files never change
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
  }
  // Everything else: pass through
});
