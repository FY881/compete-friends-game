/* تحدي العقول — service worker
 * Network-first for navigations (the shell is always fresh), cache-first for
 * hashed static assets (safe: Vite fingerprints filenames), and the Convex
 * API (different origin) is never touched.
 *
 * IMPORTANT: binary downloads (.apk) are NEVER intercepted.
 * The cache-first strategy would happily serve a stale or corrupted cached
 * copy of the APK, making the phone save a broken file. Every
 * APK request now goes straight to the network, always, forever. */
// Bump this cache name whenever you ship a new version — it forces every
// installed PWA to discard the old app shell and fetch the fresh one.
const CACHE = "zaka-v21";
const PRECACHE = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never cache the Convex backend

  // Dev server: never cache anything — let Vite serve fresh files
  if (url.hostname.includes("daytonaproxy") || url.port === "5173") return;

  // ── HARD RULE: never intercept APK/download requests ──────────────
  // A cached APK that is stale, truncated, or was an HTML error page in a
  // previous deployment breaks installation on the phone. Let the network
  // serve these bytes directly, always.
  if (url.pathname.endsWith(".apk") || url.pathname.includes("/downloads/")) {
    return;
  }

  // Navigations: always try the network first, fall back to the cached shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  // Static assets: cache-first (filenames are content-hashed by Vite).
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
