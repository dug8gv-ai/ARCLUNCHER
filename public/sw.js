// ═══════════════════════════════════════════════════════════════
// ArcOmni PWA Service Worker
// Network-First with Offline Shell Fallback
// Version-gated cache for safe deployments
// ═══════════════════════════════════════════════════════════════

const CACHE_VERSION = 'arcomni-v1';
const OFFLINE_URL = '/offline.html';

// App shell assets to pre-cache on install
const PRECACHE_ASSETS = [
  OFFLINE_URL,
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/main-logo.jpg',
];

// ── INSTALL ──────────────────────────────────────────────────
// Pre-cache the offline fallback and critical brand assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  // Activate immediately without waiting for existing clients to close
  self.skipWaiting();
});

// ── ACTIVATE ─────────────────────────────────────────────────
// Purge stale caches from previous versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      );
    })
  );
  // Take control of all open clients immediately
  self.clients.claim();
});

// ── FETCH ────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ── BYPASS: Never intercept non-GET requests ──
  if (request.method !== 'GET') return;

  // ── BYPASS: Never cache API routes, Supabase, RPC, or wallet providers ──
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase') ||
    url.hostname.includes('rpc.testnet.arc') ||
    url.hostname.includes('walletconnect') ||
    url.hostname.includes('infura') ||
    url.hostname.includes('alchemy') ||
    url.hostname.includes('metamask') ||
    url.hostname.includes('rainbow') ||
    url.hostname.includes('circle') ||
    url.hostname.includes('blockaid') ||
    url.protocol === 'chrome-extension:'
  ) {
    return;
  }

  // ── STATIC ASSETS: Cache-first (icons, fonts, images, JS/CSS chunks) ──
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            // Only cache valid responses
            if (response && response.status === 200 && response.type === 'basic') {
              const clone = response.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => {
            // For images, return nothing rather than offline page
            return new Response('', { status: 408, statusText: 'Offline' });
          });
      })
    );
    return;
  }

  // ── NAVIGATION REQUESTS: Network-first with offline fallback ──
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the latest navigation response for faster subsequent loads
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Network failed — serve offline page
          return caches.match(OFFLINE_URL).then((cached) => {
            return cached || new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/html' },
            });
          });
        })
    );
    return;
  }

  // ── ALL OTHER REQUESTS: Network-first, cache fallback ──
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});
