/// <reference lib="webworker" />

const CACHE_NAME = 'fluxo-v1';

// Archivos críticos para que la app funcione offline
const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/index.css',
];

// Instalar — cachear archivos esenciales
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(PRECACHE_URLS);
        })
    );
    self.skipWaiting();
});

// Activar — limpiar caches viejos
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// Fetch — Network First para API, Cache First para assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // No cachear las llamadas a Supabase o al print-server
    if (url.hostname.includes('supabase') || url.port === '3001') {
        return;
    }

    // Para navegación (páginas HTML) — Network First
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match('/index.html'))
        );
        return;
    }

    // Para assets (JS, CSS, imágenes, fonts) — Cache First
    if (
        event.request.destination === 'script' ||
        event.request.destination === 'style' ||
        event.request.destination === 'image' ||
        event.request.destination === 'font'
    ) {
        event.respondWith(
            caches.match(event.request).then(cached => {
                if (cached) return cached;

                return fetch(event.request).then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                });
            })
        );
        return;
    }
});
