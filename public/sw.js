// Cache the app shell and its built JS/CSS so the local-first app opens offline.
const CACHE_NAME = 'mesai-defteri-v4.0.2';
const APP_BASE = new URL('./', self.registration.scope);
const APP_URLS = [
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const indexUrl = new URL('./index.html', APP_BASE);
    const response = await fetch(indexUrl, { cache: 'reload' });
    if (!response.ok) throw new Error('Uygulama başlangıç dosyası önbelleğe alınamadı.');
    await cache.put(indexUrl, response.clone());

    // Vite gives each production JS/CSS file a content hash. Read those exact
    // filenames from the generated HTML and cache them during installation.
    const html = await response.text();
    const assetUrls = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))(?:\?[^"']*)?["']/gi)]
      .map((match) => new URL(match[1], APP_BASE));
    const shellAssets = [...new Map(assetUrls.map((url) => [url.href, url])).values()];
    await Promise.all(shellAssets.map(async (url) => {
      const asset = await fetch(url, { cache: 'reload' });
      if (!asset.ok) throw new Error(`Uygulama dosyası önbelleğe alınamadı: ${url.pathname}`);
      await cache.put(url, asset);
    }));

    await Promise.all(APP_URLS.map(async (path) => {
      const url = new URL(path, APP_BASE);
      try {
        const file = await fetch(url, { cache: 'reload' });
        if (file.ok) await cache.put(url, file);
      } catch {
        // A missing decorative asset must not stop the app from being cached.
      }
    }));

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('mesai-defteri-') && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(new URL('./index.html', APP_BASE), response.clone());
        }
        return response;
      } catch {
        const cached = await caches.match(new URL('./index.html', APP_BASE));
        return cached || new Response('Mesai Defteri çevrimdışı kullanıma henüz hazır değil. İnternete bağlanıp uygulamayı bir kez açın.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      return new Response('', { status: 503, statusText: 'Çevrimdışı' });
    }
  })());
});
