/* حرب العقول — service worker v3
 *
 * STRATEGY: Network-first for EVERYTHING (HTML, JS, CSS, chunks).
 * Only fall back to cache when offline.
 *
 * WHY: The old cache-first strategy for static assets caused chunk_load
 * crashes after deployments because the browser would serve stale chunks
 * with old hashes that no longer exist on the server.
 *
 * With network-first, we always get the latest code. If the network is
 * down, we fall back to the cache (which is better than a crash).
 *
 * EXCEPTIONS:
 * - Binary downloads (.apk) are NEVER intercepted.
 * - The Convex API (different origin) is never touched.
 * - Dev server (daytonaproxy) is never cached.
 */

const CACHE = "war-v3";

self.addEventListener("install", (event) => {
  // Skip old caches
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// ═══ إشعارات Push الحقيقية — تعمل حتى مع التطبيق مغلق تماماً ═══
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "حرب العقول", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "حرب العقول";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || String(Date.now()),
    data: { url: data.url || "/play" },
    dir: "rtl",
    lang: "ar",
    vibrate: [80, 40, 80],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// النقر على الإشعار: افتح التطبيق على المكان الصحيح
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/play";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never cache cross-origin (Convex API)
  if (url.origin !== self.location.origin) return;

  // Dev server: never cache anything
  if (url.hostname.includes("daytonaproxy") || url.port === "5173") return;

  // NEVER intercept APK/download requests
  if (url.pathname.endsWith(".apk") || url.pathname.includes("/downloads/")) return;

  // ── ALL RESOURCES: Network-first, cache fallback ──
  // This prevents stale chunks after deployment
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only cache successful responses
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => {
        // Network failed — try cache
        return caches.match(request);
      })
  );
});
