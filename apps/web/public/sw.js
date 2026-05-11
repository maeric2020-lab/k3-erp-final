/**
 * K3 ERP — Service Worker
 *
 * استراتيجيات:
 *   - الأصول الثابتة (_next/static, /icons, /manifest.json): cache-first
 *   - صفحات HTML: network-first مع fallback إلى cache
 *   - استدعاءات API: network-only (لا cache — البيانات حسّاسة + تتغير)
 *   - الـ POST/PATCH/DELETE: network فقط، إذا فشل يُحفظ في offline queue
 *
 * عند التحديث، نزيد رقم CACHE_VERSION ليتم تنظيف الكاش القديم.
 */

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `k3-static-${CACHE_VERSION}`;
const PAGES_CACHE = `k3-pages-${CACHE_VERSION}`;

// ملفات أساسية نُكاشّفها مسبقاً
const PRECACHE_URLS = [
  '/',
  '/dashboard',
  '/my-jobs',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// -----------------------------------------------------------------------------
// install — pre-cache
// -----------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // نسجّل كل واحد على حدة كي لا يفشل الكل بسبب واحد
      Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

// -----------------------------------------------------------------------------
// activate — تنظيف الكاش القديم
// -----------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.endsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// -----------------------------------------------------------------------------
// fetch — توجيه الطلبات حسب الاستراتيجية
// -----------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // فقط GET — الباقي يمر مباشرة
  if (req.method !== 'GET') return;

  // 1) أصول ثابتة: cache-first
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json' ||
    /\.(?:woff2?|ttf|eot|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // 2) API: network-only
  if (url.pathname.startsWith('/api/')) {
    return; // اتركه للمتصفح (network)
  }

  // 3) صفحات HTML داخلية: network-first مع fallback
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(req, PAGES_CACHE));
    return;
  }
});

// -----------------------------------------------------------------------------
// استراتيجيات
// -----------------------------------------------------------------------------

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;

  try {
    const fresh = await fetch(req);
    if (fresh.ok && (req.url.startsWith(self.location.origin))) {
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch {
    // نُعيد response فارغ بدلاً من فشل تام
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

async function networkFirst(req, cacheName) {
  try {
    const fresh = await fetch(req);
    if (fresh.ok) {
      const cache = await caches.open(cacheName);
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    // fallback لصفحة offline
    const fallback = await caches.match('/offline');
    if (fallback) return fallback;
    return new Response(
      `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>غير متصل</title>` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<style>body{font-family:system-ui;text-align:center;padding:3rem 1rem;color:#374151}` +
      `h1{color:#0f766e}p{margin:1rem 0}button{background:#0f766e;color:white;border:0;padding:.6rem 1.2rem;border-radius:.4rem;cursor:pointer}</style></head>` +
      `<body><h1>أنت غير متصل</h1><p>تأكد من اتصالك بالإنترنت ثم حاول مرة أخرى.</p>` +
      `<button onclick="location.reload()">إعادة المحاولة</button></body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

// -----------------------------------------------------------------------------
// رسائل من الـ client (مثلاً: SKIP_WAITING للترقية الفورية)
// -----------------------------------------------------------------------------
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
