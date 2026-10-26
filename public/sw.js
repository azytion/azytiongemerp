// Azytion GemERP - Service Worker v13
// Production only. Localhost/dev is always network-only so UI changes are never
// hidden by stale PWA caches during development.

const CACHE_VERSION = 'azytion-v13';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;
const IS_LOCAL_DEV = ['localhost', '127.0.0.1', '::1'].includes(self.location.hostname);

const PRECACHE_ASSETS = [
    '/azytion-brand-logo-512.png',
    '/azytion-app-icon-192.png',
    '/azytion-app-icon-512.png',
    '/offline.html',
];

const PRECACHE_PAGES = [
    '/offline.html',
];

self.addEventListener('install', (event) => {
    if (IS_LOCAL_DEV) {
        event.waitUntil(self.skipWaiting());
        return;
    }

    event.waitUntil(
        Promise.all([
            caches.open(STATIC_CACHE).then((cache) =>
                cache.addAll(PRECACHE_ASSETS).catch(() => {
                    // Some assets may not exist yet; ignore individual failures.
                })
            ),
            caches.open(PAGE_CACHE).then((cache) =>
                Promise.allSettled(PRECACHE_PAGES.map(url => cache.add(url)))
            ),
        ]).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key.startsWith('azytion-') && (IS_LOCAL_DEV || (key !== STATIC_CACHE && key !== PAGE_CACHE)))
                    .map((key) => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET') return;
    if (url.origin !== self.location.origin) return;

    if (IS_LOCAL_DEV) {
        event.respondWith(fetch(request));
        return;
    }

    if (
        url.pathname.startsWith('/api/') ||
        url.pathname.startsWith('/_next/') ||
        url.searchParams.has('_rsc') ||
        request.headers.has('rsc') ||
        request.headers.has('next-router-state-tree') ||
        request.headers.has('next-router-prefetch') ||
        request.headers.has('next-url') ||
        request.headers.get('next-action') !== null ||
        request.headers.get('accept')?.includes('text/x-component') ||
        request.headers.get('content-type')?.includes('multipart/form-data')
    ) {
        return;
    }

    if (
        url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf|otf|css)$/)
    ) {
        event.respondWith(
            caches.open(STATIC_CACHE).then(async (cache) => {
                const cached = await cache.match(request);
                if (cached) return cached;
                try {
                    const response = await fetch(request);
                    if (response.ok) cache.put(request, response.clone());
                    return response;
                } catch {
                    return cached || new Response('Not found', { status: 404 });
                }
            })
        );
        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .catch(async () => {
                    const offline = await caches.match('/offline.html');
                    return offline || new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } });
                })
        );
        return;
    }

    // Let the browser handle everything else (RSC, documents, fonts already matched).
    // Intercepting these previously mixed stale HTML with new server actions.
    return;
});

self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
