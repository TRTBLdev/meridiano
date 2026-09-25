// MERIDIANO PWA - Service Worker con Estrategia de 3 Capas
// 1. Cache-busting con BUILD_VERSION y cache: 'reload' en instalación
// 2. Stale-While-Revalidate en tiempo de ejecución (offline instantáneo + actualización en segundo plano)
// 3. skipWaiting y clients.claim para activación inmediata coordinada con app.js

const BUILD_VERSION = '2026.09.25.0935';
const CACHE_NAME = `meridiano-cache-v${BUILD_VERSION}`;

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
  console.log(`[Service Worker] Instalando versión: ${BUILD_VERSION}`);
  
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Descargamos cada asset con ?v= y cache: 'reload' para saltarse la caché HTTP de disco
      const precachePromises = ASSETS.map(async (url) => {
        try {
          const requestUrl = url.includes('?') ? `${url}&v=${BUILD_VERSION}` : `${url}?v=${BUILD_VERSION}`;
          const response = await fetch(new Request(requestUrl, { cache: 'reload' }));
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
      console.log(`[Service Worker] Precaching completado para v${BUILD_VERSION}`);
    }).then(() => self.skipWaiting())
  );
});

// Activación y purga de cachés obsoletas
self.addEventListener('activate', (event) => {
  console.log(`[Service Worker] Activando versión: ${BUILD_VERSION}`);
  
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
          const networkResponse = await fetch(event.request);
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

  // 2. Peticiones de Assets (CSS, JS, iconos): Stale-While-Revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);

      const revalidatePromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => null);

      event.waitUntil(revalidatePromise);

      // Si existe en caché, responder de inmediato
      if (cachedResponse) {
        return cachedResponse;
      }

      // Si no estaba en caché, esperar a la red
      const networkResponse = await revalidatePromise;
      if (networkResponse && networkResponse.status === 200) {
        return networkResponse;
      }

      return cachedResponse || new Response('Recurso no disponible', { status: 404 });
    })
  );
});
