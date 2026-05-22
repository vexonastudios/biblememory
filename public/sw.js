/**
 * Inscribed — Service Worker
 * Caches the app shell for offline use + CDN-cached TTS audio.
 *
 * ⚠️  CACHE_NAME is auto-stamped with a build timestamp by scripts/stamp-sw.cjs
 *    (runs as "prebuild" hook). Every deployment gets a unique cache name,
 *    which causes the activate handler to wipe all old caches automatically.
 *
 * Strategy:
 *  - App shell (HTML/CSS/JS): Stale-while-revalidate
 *  - Bible API: Network-first with cache fallback (verses can change)
 *  - TTS API: Cache-first (audio is content-addressed, never stale)
 */

const CACHE_NAME = 'inscribed-1779454748850';
const OFFLINE_URL = '/';

// App shell — static assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/library',
  '/review',
  '/session',
  '/settings',
  '/manifest.webmanifest',
  '/logo.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

// ── Install ────────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // Don't fail install if some URLs aren't reachable yet
      });
    }).then(() => self.skipWaiting())
  );
});

// ── Activate ───────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ──────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin (ElevenLabs, Google Fonts etc.)
  if (request.method !== 'GET' || url.origin !== location.origin) return;

  // TTS audio: cache-first (content-addressed, never changes)
  if (url.pathname.startsWith('/api/tts')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Bible API: network-first, fallback to cache
  if (url.pathname.startsWith('/api/bible')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Other API routes: network only
  if (url.pathname.startsWith('/api/')) return;

  // App shell: stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// ── Strategies ─────────────────────────────────────────────────────────────────

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached ?? (await fetchPromise) ?? new Response('Offline', { status: 503 });
}
