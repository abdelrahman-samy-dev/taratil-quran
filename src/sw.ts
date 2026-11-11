/// <reference lib="webworker" />
/**
 * Taratil service worker.
 * - Precaches the app shell (injected by vite-plugin-pwa).
 * - Quran text, mushaf layout and page fonts: cache-first, kept for offline reading.
 * - Recitations downloaded by the user: served from cache with Range support.
 * - Live APIs: stale-while-revalidate or network-first.
 */
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { RangeRequestsPlugin } from 'workbox-range-requests';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

const AUDIO_CACHE = 'taratil-audio-offline';
const LEGACY = [/^taratil-pwa-v\d+$/, /^taratil-api-cache-v\d+$/, /^mushaf-pages-v\d+$/];

self.addEventListener('install', (event) => {
  // Users coming from v3 have a cache-first worker serving the old shell; replace it right away.
  event.waitUntil(
    caches.keys().then((names) => {
      if (names.some((n) => LEGACY.some((re) => re.test(n)))) return self.skipWaiting();
    }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (names) => {
      const legacy = names.filter((n) => LEGACY.some((re) => re.test(n)));
      await Promise.all(legacy.map((n) => caches.delete(n)));
      if (legacy.length) {
        // Reload pages still running the v3 code so they pick up the new app.
        const clients = await self.clients.matchAll({ type: 'window' });
        for (const c of clients) void c.navigate(c.url);
      }
    }),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// SPA navigation → app shell (works offline).
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/data\//, /^\/sw\.js/] }));

const ok = new CacheableResponsePlugin({ statuses: [0, 200] });

// Static Quran data shipped with the app.
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/data/'),
  new CacheFirst({
    cacheName: 'taratil-quran-data-v1',
    plugins: [new CacheableResponsePlugin({ statuses: [200] }), new ExpirationPlugin({ maxEntries: 1000 })],
  }),
);

// QCF v2 per-page mushaf fonts.
registerRoute(
  ({ url }) => /(^|\.)qurancdn\.com$|quran\.foundation$/.test(url.hostname) && url.pathname.includes('/fonts/'),
  new CacheFirst({
    cacheName: 'taratil-mushaf-fonts-v1',
    plugins: [ok, new ExpirationPlugin({ maxEntries: 640, purgeOnQuotaError: true })],
  }),
);

// Verse timings never change for a given recitation.
registerRoute(
  ({ url }) => url.hostname.endsWith('mp3quran.net') && url.pathname.includes('/ayat_timing'),
  new CacheFirst({
    cacheName: 'taratil-timings-v1',
    plugins: [ok, new ExpirationPlugin({ maxEntries: 400, purgeOnQuotaError: true })],
  }),
);

// Reciter & radio lists.
registerRoute(
  ({ url }) => url.hostname.endsWith('mp3quran.net') && url.pathname.startsWith('/api/'),
  new StaleWhileRevalidate({ cacheName: 'taratil-api-v1', plugins: [ok] }),
);

// Tafsir texts.
registerRoute(
  ({ url }) => url.hostname === 'api.alquran.cloud',
  new CacheFirst({
    cacheName: 'taratil-tafsir-v1',
    plugins: [ok, new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 90, purgeOnQuotaError: true })],
  }),
);

// Hadith collections.
registerRoute(
  ({ url }) => url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('/hadith-api'),
  new CacheFirst({
    cacheName: 'taratil-hadith-v1',
    plugins: [ok, new ExpirationPlugin({ maxEntries: 30, purgeOnQuotaError: true })],
  }),
);

// City search.
registerRoute(
  ({ url }) => url.hostname === 'geocoding-api.open-meteo.com',
  new NetworkFirst({ cacheName: 'taratil-geo-v1', networkTimeoutSeconds: 6, plugins: [ok] }),
);

// Recitations the user downloaded: serve from cache (with Range for seeking); otherwise stream.
registerRoute(
  ({ url, request }) => request.destination === 'audio' || /\.mp3$/i.test(url.pathname),
  async ({ request }) => {
    const cache = await caches.open(AUDIO_CACHE);
    const hit = await cache.match(request.url);
    if (hit) {
      const range = new RangeRequestsPlugin();
      const res = await range.cachedResponseWillBeUsed!({
        cacheName: AUDIO_CACHE,
        request,
        cachedResponse: hit,
        event: undefined as unknown as ExtendableEvent,
        state: {},
      } as never);
      return (res as Response | undefined) ?? hit;
    }
    return fetch(request);
  },
);
