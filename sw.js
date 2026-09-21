// Service Worker for Minesweeper - Offline Support
const CACHE_NAME = 'minesweeper-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './engine.js',
  './script.js',
  './manifest.json',
  './favicon.ico?v=1',
  './favicon.svg?v=1',
  './assets/apple-touch-icon.png?v=1',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('chrome-extension://')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }

        return fetch(event.request)
          .then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // Offline fallback for game assets
            if (event.request.destination === 'image') {
              return new Response('', { status: 200, statusText: 'OK' });
            }
            return caches.match('./index.html');
          });
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Performance optimization: Pre-cache game assets
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PRECACHE_ASSETS') {
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(event.data.assets || []);
      });
  }
});
