/* MY LIFE PLANNER offline app shell */
const CACHE_VERSION = 'my-life-planner-shell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './office-recovery.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await cache.addAll(APP_SHELL.map(path => new Request(path, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('my-life-planner-') && key !== CACHE_VERSION)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Never cache Firebase/API traffic or other dynamic authenticated data.
  if (/firestore|firebaseio|googleapis\.com\/identitytoolkit|securetoken|\/api\//i.test(url.href)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_VERSION);
          cache.put('./index.html', response.clone());
        }
        return response;
      } catch (error) {
        const cache = await caches.open(CACHE_VERSION);
        return (await cache.match('./index.html')) || (await cache.match('./')) ||
          new Response('เปิด MY LIFE PLANNER ไม่ได้ในขณะนี้ กรุณาเปิดเว็บขณะออนไลน์อย่างน้อย 1 ครั้งเพื่อบันทึกไฟล์สำหรับใช้งานออฟไลน์', {
            status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
      }
    })());
    return;
  }

  // Cache same-origin app files and static CDN assets after their first successful load.
  const isStaticAsset = url.origin === self.location.origin ||
    /\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|webp)(\?|$)/i.test(url.href);
  if (!isStaticAsset) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request);
    if (cached) {
      event.waitUntil(fetch(request).then(response => {
        if (response && response.ok) return cache.put(request, response.clone());
      }).catch(() => {}));
      return cached;
    }
    try {
      const response = await fetch(request);
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    } catch (error) {
      return new Response('', { status: 504, statusText: 'Offline asset unavailable' });
    }
  })());
});
