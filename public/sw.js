// Service Worker — кэширует данные ТН ВЭД и обеспечивает офлайн-работу
// Версия кэша обновляется вместе с данными (через meta.json)

const CACHE_NAME   = "tnved-v1";
const DATA_CACHE   = "tnved-data-v1";

// Ресурсы, которые кэшируем при установке SW
const PRECACHE_ASSETS = [
  "./",
  "./index.html",
];

// ── Установка ──────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_ASSETS)
    )
  );
  self.skipWaiting();
});

// ── Активация (удаляем старые кэши) ────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== DATA_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Перехват запросов ───────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Файлы данных: стратегия "stale-while-revalidate"
  // → сразу отдаём кэш, фоново проверяем обновление
  if (url.pathname.includes("/data/")) {
    event.respondWith(staleWhileRevalidate(event.request, DATA_CACHE));
    return;
  }

  // Всё остальное: network-first с fallback на кэш
  event.respondWith(networkFirstWithCache(event.request, CACHE_NAME));
});

// ── Стратегии ───────────────────────────────────────────────────────────────

async function staleWhileRevalidate(request, cacheName) {
  const cache    = await caches.open(cacheName);
  const cached   = await cache.match(request);

  // Фоновое обновление (не блокирует рендер)
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  // Если есть кэш — отдаём его немедленно
  return cached || fetchPromise;
}

async function networkFirstWithCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response("Нет соединения с сетью", { status: 503 });
  }
}

// ── Сообщения от клиента ────────────────────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
