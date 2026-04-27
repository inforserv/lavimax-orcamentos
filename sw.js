const CACHE_NAME = 'lavimax-orcamentos-v11';
const PDFMAKE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/pdfmake.min.js';
const PDFMAKE_FONTS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/vfs_fonts.js';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.ico',
  PDFMAKE_URL,
  PDFMAKE_FONTS_URL
];

// Install: cache all assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first, fallback to network
self.addEventListener('fetch', event => {
  const url = event.request.url;
  const isSameOrigin = url.startsWith(self.location.origin);
  // Permite servir as bibliotecas pdfmake da cache mesmo sendo cross-origin
  const isPdfLib = url.indexOf('pdfmake') !== -1 || url.indexOf('vfs_fonts') !== -1;

  if (!isSameOrigin && !isPdfLib) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache new successful requests (except POST, etc.)
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Offline fallback
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
