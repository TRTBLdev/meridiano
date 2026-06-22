const CACHE_NAME = 'meridiano-cache-v18';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './css/variables.css',
  './css/layout.css',
  './css/components.css',
  './js/app.js',
  './js/db.js',
  './js/seeds/acupuncture_points_seed.js',
  './js/seeds/meridians_seed.js',
  './js/seeds/yoga_seeds.js',
  './js/seeds/breathwork_seeds.js',
  './js/seeds/meditation_seeds.js',
  './js/seeds/acupuncture_sequences_seed.js',
  './js/utils/crypto.js',
  './js/utils/sanitize.js',
  './js/components/login.js',
  './js/components/dashboard.js',
  './js/components/acupuncture.js',
  './js/components/syllabus.js',
  './js/components/breathwork.js',
  './js/components/meditation.js',
  './js/components/yoga.js',
  './js/components/timerShell.js',
  './js/utils/dotmatrix.js',
  './icons/icon.svg'
];

// Instalación del Service Worker y almacenamiento de assets en caché
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching core assets');
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activación y limpieza de cachés antiguas
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia Cache-First con caída a Network (y actualización en background opcional)
self.addEventListener('fetch', (e) => {
  // Evitar interceptar llamadas no locales o solicitudes externas que no se puedan cachear fácilmente
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).then((networkResponse) => {
        // Guardar nuevas solicitudes en caché dinámicamente si pertenecen a la app
        if (networkResponse.status === 200) {
          const cacheCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, cacheCopy);
          });
        }
        return networkResponse;
      });
    })
  );
});
