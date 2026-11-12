// Service worker: повністю офлайн-кеш застосунку
const CACHE = 'tests-op-pb-v2';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

// Кожен файл кешується окремо: якщо одного немає, решта все одно збережеться
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(FILES.map((f) => c.add(f).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Сторінка: одразу з кешу (швидко, без очікування мережі), оновлення у фоні
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((hit) => {
        const update = fetch(req).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('./index.html', copy));
          }
          return res;
        });
        if (hit) {
          event.waitUntil(update.catch(() => {}));
          return hit;
        }
        return update.catch(() => new Response(
          '<meta charset="utf-8"><p style="font-family:sans-serif;padding:20px">Немає мережі. Відкрийте застосунок один раз з інтернетом, щоб він зберігся для офлайн-роботи.</p>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        ));
      })
    );
    return;
  }

  // Решта: з кешу, інакше мережа (і зберегти)
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }))
  );
});
