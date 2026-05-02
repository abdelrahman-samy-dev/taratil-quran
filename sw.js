const CACHE_NAME = 'taratil-pwa-v4';
const MUSHAF_CACHE = 'mushaf-pages-v1';
const API_CACHE = 'taratil-api-cache-v4';
const MAX_MUSHAF_PAGES = 160;

const CORE_ASSETS = [
    './',
    './index.html',
    './css/styles.css',
    './js/app.js',
    './js/data.js',
    './js/mushaf.js',
    './js/sync-engine.js',
    './manifest.json',
    './icons/icon.svg',
    'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@400;600;700;800&family=Noto+Naskh+Arabic:wght@400;500;600;700&display=swap'
];

// ─── Install: cache core assets ────────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(CORE_ASSETS);
        })
    );
    self.skipWaiting();
});

// ─── Activate: clean old caches ────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    // Keep mushaf cache and new caches, delete old ones
                    if (cache !== CACHE_NAME && cache !== MUSHAF_CACHE && cache !== API_CACHE) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// ─── LRU Mushaf Cache Limiter ──────────────────────────────────────
async function enforceMushafCacheLimit() {
    const cache = await caches.open(MUSHAF_CACHE);
    const keys = await cache.keys();
    if (keys.length > MAX_MUSHAF_PAGES) {
        // Delete oldest entries (FIFO approximation — oldest = first added)
        const toDelete = keys.slice(0, keys.length - MAX_MUSHAF_PAGES);
        await Promise.all(toDelete.map(k => cache.delete(k)));
    }
}

// ─── Fetch Handler ─────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // ── Mushaf page images (GitHub raw CDN) ──────────────────────
    if (url.hostname === 'raw.githubusercontent.com' && url.pathname.includes('/nawafalqari/ayah/')) {
        event.respondWith(mushafCacheStrategy(event.request));
        return;
    }

    // ── Quran/Prayer API calls (Stale-while-revalidate) ──────────
    if (
        url.hostname.includes('api.alquran.cloud') ||
        url.hostname.includes('mp3quran.net') ||
        url.hostname.includes('aladhan.com') ||
        url.hostname.includes('hadith.inapi.ru')
    ) {
        event.respondWith(staleWhileRevalidate(event.request, API_CACHE));
        return;
    }

    // ── Skip audio files (too large, streaming preferred) ────────
    if (url.pathname.endsWith('.mp3')) return;

    // ── Core assets (Cache-first) ─────────────────────────────────
    event.respondWith(
        caches.match(event.request).then((cached) => {
            return cached || fetch(event.request).then((fetchRes) => {
                if (!fetchRes || fetchRes.status !== 200 || fetchRes.type !== 'basic') {
                    return fetchRes;
                }
                const clone = fetchRes.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                return fetchRes;
            });
        })
    );
});

// ─── Mushaf Cache Strategy: Cache → Network → Cache ───────────────
async function mushafCacheStrategy(request) {
    try {
        const cache = await caches.open(MUSHAF_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;

        // Not cached — fetch from network
        const networkRes = await fetch(request, { mode: 'cors' });
        if (networkRes.ok) {
            cache.put(request, networkRes.clone());
            // Enforce LRU limit in background (don't block response)
            setTimeout(enforceMushafCacheLimit, 500);
        }
        return networkRes;
    } catch (err) {
        // Offline & not cached — return offline placeholder
        return new Response(
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">' +
            '<rect width="400" height="600" fill="#f5f0e8"/>' +
            '<text x="200" y="290" text-anchor="middle" font-size="18" fill="#888" font-family="serif">الصفحة غير متاحة بدون إنترنت</text>' +
            '<text x="200" y="320" text-anchor="middle" font-size="14" fill="#aaa" font-family="serif">Page not cached yet</text>' +
            '</svg>',
            { headers: { 'Content-Type': 'image/svg+xml' } }
        );
    }
}

// ─── Stale-While-Revalidate Strategy ──────────────────────────────
async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse.ok) cache.put(request, networkResponse.clone());
        return networkResponse;
    }).catch(() => cachedResponse);

    return cachedResponse || fetchPromise;
}
