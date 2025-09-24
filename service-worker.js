// Service Worker Version: 1.1.0 (aggressive cache-busting)

// Unified App / Asset Version (bump this when deploying front-end changes to force fresh fetch of CSS/JS)
// IMPORTANT: Increment APP_VERSION on ANY deploy that changes shipped JS/CSS/HTML.
// The service worker now also embeds a BUILD_STAMP so even if APP_VERSION is forgotten,
// byte-diff in this file still triggers an update. However, always bump for clarity.
const APP_VERSION = '2.15.12';
// Unique build stamp (ISO) - forces SW byte change each build even if version forgotten
const BUILD_STAMP = '2025-09-24T00:00:00Z';

// Cache name for the current version (auto-derived from APP_VERSION so we don't forget to bump both)
const CACHE_NAME = `share-watchlist-${APP_VERSION}`;
// A short-lived runtime cache for opportunistic non-core responses (separate from versioned precache)
const RUNTIME_CACHE = 'runtime-v1';

// List of essential application assets to precache
const CACHED_ASSETS = [
    // We intentionally DO NOT precache index.html anymore to avoid serving stale shell after deploy.
    // It will be fetched network-first on navigation; offline fallback still provided via root cache if present.
    `./script.js?v=${APP_VERSION}`,
    `./style.css?v=${APP_VERSION}`,
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap',
    // Font Awesome served from CDN removed from precache because cross-origin fetches can time out.
    // Firebase SDKs are loaded as modules, so they might not be directly in the cache list
    // if not explicitly requested by the main app. However, if they are, it's good to list them.
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js'
];

// Install event: cache assets individually so one failure doesn't abort install
self.addEventListener('install', (event) => {
    console.log('[SW] Installing… version', APP_VERSION, 'stamp', BUILD_STAMP, 'cache', CACHE_NAME);
    event.waitUntil((async ()=>{
        try {
            const cache = await caches.open(CACHE_NAME);
            for (const url of CACHED_ASSETS) {
                const bustUrl = url + (url.includes('?') ? '&' : '?') + 'cb=' + APP_VERSION + '-' + BUILD_STAMP;
                const req = new Request(bustUrl, { cache: 'reload' });
                try {
                    const res = await fetch(req);
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    await cache.put(url, res.clone()); // store under canonical key (without cb param)
                    console.log('[SW] Cached core asset:', url);
                } catch(err) {
                    console.warn('[SW] (install) failed to cache core asset', url, err.message||err);
                }
            }
        } catch(e) {
            console.warn('[SW] install caching loop failed', e);
        }
        await self.skipWaiting();
    })());
});

// Activate event: cleans up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating version', APP_VERSION);
    event.waitUntil((async ()=>{
        try {
            const names = await caches.keys();
            await Promise.all(names.map(n => {
                if (n.startsWith('share-watchlist-') && n !== CACHE_NAME) {
                    console.log('[SW] Deleting old cache:', n);
                    return caches.delete(n);
                }
                return null;
            }));
        } catch(e){ console.warn('[SW] cache cleanup failed', e); }
        try { await self.clients.claim(); } catch(_){}
        // Broadcast new version so clients can self-reload if needed
        try {
            const all = await self.clients.matchAll({ includeUncontrolled:true, type:'window' });
            for (const client of all) {
                client.postMessage({ type:'SW_VERSION', version: APP_VERSION, stamp: BUILD_STAMP });
            }
        } catch(e){ console.warn('[SW] broadcast failed', e); }
    })());
});

// Fetch event: intercepts network requests
self.addEventListener('fetch', (event) => {
    // Only cache GET requests
    if (event.request.method === 'GET') {
        // Navigation requests (user refresh / open). Always network-first with explicit reload to defeat cached index.
        if (event.request.mode === 'navigate') {
            event.respondWith((async ()=>{
                try {
                    const net = await fetch(event.request, { cache: 'reload' });
                    // Optionally keep a copy of latest root as offline fallback (store in runtime cache)
                    try {
                        const rt = await caches.open(RUNTIME_CACHE);
                        rt.put('./', net.clone());
                    } catch(_){}
                    return net;
                } catch(err) {
                    const cachedRoot = await caches.match('./');
                    if (cachedRoot) return cachedRoot;
                    return new Response('Offline', { status: 503, statusText:'Offline'});
                }
            })());
            return;
        }
        // Skip non-http(s) schemes (e.g., chrome-extension, file, data)
        try {
            const u = new URL(event.request.url);
            if (u.protocol !== 'http:' && u.protocol !== 'https:') {
                return; // Let the browser handle it; Cache API doesn't support these schemes
            }
        } catch (_) {
            return; // If URL can't be parsed, don't attempt to handle/capture
        }
        // Pre-compute whether this is a cross-origin request so we can avoid noisy logging for CDN failures
        let requestUrl;
        let isCrossOrigin = false;
        try { requestUrl = new URL(event.request.url); isCrossOrigin = requestUrl.origin !== self.location.origin; } catch(_) { /* ignore */ }
        // IMPORTANT: Do NOT cache Firestore API calls (or any dynamic API calls).
        // These are real-time data streams or dynamic queries and should always go to the network.
        if (event.request.url.includes('firestore.googleapis.com') || event.request.url.includes('script.google.com/macros')) {
            // Bypass cache for dynamic API calls but guard network failures to avoid unhandled promise rejections.
            event.respondWith(
                fetch(event.request).catch(() => new Response('Service Unavailable', { status: 503, statusText: 'Service Unavailable' }))
            );
            return; // Exit early, don't try to cache this
        }

        // Network-first strategy for core versioned assets (CSS / JS) so updates propagate immediately
    try {
            const url = new URL(event.request.url);
            const isSameOrigin = url.origin === self.location.origin;
            const isCoreAsset = isSameOrigin && (url.pathname.endsWith('/style.css') || url.pathname.endsWith('/script.js'));
            if (isCoreAsset) {
                // Always network-first with reload directive & version/hash busting
                const busted = new Request(url.pathname + url.search + (url.search ? '&' : '?') + 'v=' + APP_VERSION + '-' + BUILD_STAMP, { cache: 'reload' });
                event.respondWith((async ()=>{
                    try {
                        const net = await fetch(busted);
                        if (net && net.status === 200) {
                            try { const c = await caches.open(CACHE_NAME); await c.put(event.request, net.clone()); } catch(_){ }
                        }
                        return net;
                    } catch(err) {
                        const match = await caches.match(event.request);
                        if (match) return match;
                        return safeMatchOrFallback(event.request);
                    }
                })());
                return; // stop
            }
        } catch(_e) { /* noop */ }

    // Helper to safely return a cached response or a harmless offline Response
    async function safeMatchOrFallback(request) {
        try {
            const match = await caches.match(request);
            if (match) return match;
            const root = await caches.match('./');
            if (root) return root;
        } catch (e) {
            // ignore
        }
        return new Response('Service Unavailable', { status: 503, statusText: 'Service Unavailable', headers: { 'Content-Type': 'text/plain' } });
    }

    event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                // If cached response is found, return it
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Otherwise, go to network
                return fetch(event.request).then((networkResponse) => {
                    // Check if the response is valid to cache
                    // A response is valid if it has a status of 200 and is not opaque (cross-origin without CORS)
                    // Opaque responses cannot be inspected or cached reliably.
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
                        // console.log(`Service Worker: Skipping caching for response (status ${networkResponse ? networkResponse.status : 'N/A'}, type ${networkResponse ? networkResponse.type : 'N/A'}): ${event.request.url}`);
                        return networkResponse; // Return the response without caching
                    }

                    // Clone the response because it's a stream and can only be consumed once
                    const responseToCache = networkResponse.clone();

                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache).catch(e => {
                            console.error(`Service Worker: Failed to cache (put error) ${event.request.url}:`, e);
                        });
                    });

                    return networkResponse; // Always return the original network response
                }).catch(error => {
                    // Only log as an error for same-origin/core app assets to avoid noisy CDN timeout logs
                    if (!isCrossOrigin) console.error(`Service Worker: Network fetch failed for ${event.request.url}. Returning offline fallback if available.`, error);
                    // If network fails, try to return a cached response as a fallback
                    return safeMatchOrFallback(event.request);
                });

            }) // No second .catch here, as the inner fetch promise already handles its own errors and returns a fallback
        );
    } else {
        // For non-GET requests (e.g., POST, PUT, DELETE), just fetch from network
        // Do NOT cache these requests as they modify data. Guard failures to avoid unhandled rejections.
        event.respondWith(
            fetch(event.request).catch(() => new Response('Service Unavailable', { status: 503, statusText: 'Service Unavailable' }))
        );
    }
});

// Message event: allows the app to send messages to the service worker (e.g., to skip waiting)
self.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.type === 'SKIP_WAITING') {
        self.skipWaiting();
        console.log('[SW] Skip waiting message received, activating now.');
    } else if (data.type === 'CHECK_VERSION') {
        try { event.source && event.source.postMessage({ type:'SW_VERSION', version: APP_VERSION, stamp: BUILD_STAMP }); } catch(_){}
    } else if (data.type === 'CLEAR_RUNTIME_CACHE') {
        caches.delete(RUNTIME_CACHE).then(()=> console.log('[SW] Runtime cache cleared on request')).catch(()=>{});
    }
});

// Periodic self-update hint (optional; noop if unsupported)
if ('periodicSync' in self.registration) {
    // Register a periodic sync for version check (safe to ignore failures)
    self.registration.periodicSync.getTags().then(tags => {
        if (!tags.includes('version-check')) {
            self.registration.periodicSync.register('version-check', { minInterval: 6 * 60 * 60 * 1000 }).catch(()=>{});
        }
    }).catch(()=>{});
}
