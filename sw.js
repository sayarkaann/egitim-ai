const CACHE = 'notioai-v1';
const STATIC = [
  '/',
  '/index.html',
  '/styles.css',
  '/app/styles/app.css',
  '/app/js/app.js',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Kurulum — statik dosyaları önbelleğe al
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

// Aktivasyon — eski önbellekleri temizle
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — network-first, fallback cache
self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // API isteklerini önbelleğe alma
  if (url.pathname.startsWith('/api/')) return;

  // GET isteklerini önbelleğe al
  if (request.method !== 'GET') return;

  e.respondWith(
    fetch(request)
      .then(res => {
        // Başarılı yanıtı önbelleğe koy
        if (res.ok && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(request, clone));
        }
        return res;
      })
      .catch(() => caches.match(request))
  );
});
