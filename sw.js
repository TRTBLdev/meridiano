// MERIDIANO PWA - Service Worker con actualización automática
// 1. Network-first: la red entrega los assets actuales; la caché queda como respaldo offline.
// 2. Caché estable: no depende de una versión escrita manualmente ni de scripts externos.
// 3. skipWaiting y clients.claim para activación inmediata coordinada con app.js

// Cache estable: la app usa red primero y no requiere actualizar una version manual.
const CACHE_NAME = 'meridiano-cache';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon.svg',
  // Estilos
  './css/style.css',
  './css/variables.css',
  './css/layout.css',
  './css/components.css',
  './css/lobbies.css',
  './css/strengthTimer.css',
  './css/timerTechnique.css',
  // Núcleo
  './js/app.js',
  './js/db.js',
  // Semillas de datos
  './js/seeds/acupuncture_points_seed.js',
  './js/seeds/acupuncture_sequences_seed.js',
  './js/seeds/breathwork_seeds.js',
  './js/seeds/compound_sessions_seed.js',
  './js/seeds/meditation_seeds.js',
  './js/seeds/meridians_seed.js',
  './js/seeds/strength_exercises_seed.js',
  './js/seeds/yoga_seeds.js',
  // Componentes de interfaz
  './js/components/acupuncture.js',
  './js/components/body.js',
  './js/components/breathwork.js',
  './js/components/config.js',
  './js/components/dashboard.js',
  './js/components/lobbyUi.js',
  './js/components/login.js',
  './js/components/meditation.js',
  './js/components/progress.js',
  './js/components/sessions.js',
  './js/components/sessionsUi.js',
  './js/components/strength.js',
  './js/components/strengthDotField.js',
  './js/components/strengthManager.js',
  './js/components/strengthTimerUi.js',
  './js/components/syllabus.js',
  './js/components/techniqueDetails.js',
  './js/components/timerShell.js',
  './js/components/ui.js',
  './js/components/yoga.js',
  // Utilidades
  './js/utils/acupunctureUtils.js',
  './js/utils/breathworkUtils.js',
  './js/utils/crypto.js',
  './js/utils/dotmatrix.js',
  './js/utils/freqUtils.js',
  './js/utils/meditationUtils.js',
  './js/utils/sanitize.js',
  './js/utils/sessionResults.js',
  './js/utils/strengthUtils.js',
  './js/utils/synth.js',
  './js/utils/yogaUtils.js'
];

// Capa 1: Instalación con descarga limpia de assets evitando HTTP Cache
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Instalando caché base');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Descargamos cada asset ignorando la caché HTTP durante la instalación.
      const precachePromises = ASSETS.map(async (url) => {
        try {
          const response = await fetch(new Request(url, { cache: 'reload' }));
          if (response.ok) {
            // Guardamos bajo la clave canónica 'url' para que coincida con las peticiones de la app
            await cache.put(url, response);
          } else {
            console.warn(`[Service Worker] Respuesta no OK (${response.status}) para: ${url}`);
          }
        } catch (err) {
          console.warn(`[Service Worker] Fallo de precache en: ${url}`, err);
        }
      });

      await Promise.all(precachePromises);
      console.log('[Service Worker] Precaching completado');
    }).then(() => self.skipWaiting())
  );
});

// Activación y purga de cachés obsoletas
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activando caché estable');
  
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log(`[Service Worker] Purgando caché obsoleta: ${key}`);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Capa 2: Estrategia de Fetch con Protección de Navegación SPA y Stale-While-Revalidate
self.addEventListener('fetch', (event) => {
  // Solo interceptar peticiones GET originadas en el mismo dominio
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // 1. Manejo Especial para Navegación (Recarga, acceso directo por index.html o subrutas SPA)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Intentar red primero si el servidor está en línea
          const networkResponse = await fetch(event.request, { cache: 'no-store' });
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          }
        } catch (err) {
          // Servidor no disponible, conexión caída o modo offline
        }

        // Si la red falla o el servidor devuelve error al recargar una ruta,
        // servir index.html precacheado para que la SPA continúe ejecutándose sin interrupciones
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(event.request)
                    || await cache.match('./index.html', { ignoreSearch: true })
                    || await cache.match('./', { ignoreSearch: true })
                    || await caches.match(event.request)
                    || await caches.match('./index.html', { ignoreSearch: true })
                    || await caches.match('./', { ignoreSearch: true });
        if (cached) return cached;

        // Búsqueda de rescate: cualquier entrada HTML precacheada
        const keys = await cache.keys();
        const fallbackKey = keys.find(k => k.url.endsWith('/index.html') || k.url.endsWith('/'));
        if (fallbackKey) {
          const fallbackRes = await cache.match(fallbackKey);
          if (fallbackRes) return fallbackRes;
        }

        return new Response('MERIDIANO offline: Recurso no disponible', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })()
    );
    return;
  }

  // 2. Peticiones de assets (CSS, JS, iconos): red primero, caché solo si la red falla.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const networkResponse = await fetch(event.request, { cache: 'no-store' });
        if (networkResponse && networkResponse.status === 200) {
          event.waitUntil(cache.put(event.request, networkResponse.clone()));
          return networkResponse;
        }

        return await cache.match(event.request)
          || networkResponse
          || new Response('Recurso no disponible', { status: 404 });
      } catch {
        return await cache.match(event.request)
          || new Response('Recurso no disponible', { status: 404 });
      }
    })()
  );
});
