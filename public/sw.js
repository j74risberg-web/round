const CACHE_VERSION = "round-v6";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/favicon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-192-maskable.png",
  "/icons/icon-512-maskable.png",
  "/icons/apple-touch-icon.png",
  "/exercises/knaboj.webp",
  "/exercises/armhavningar.webp",
  "/exercises/plankan.webp",
  "/exercises/utfall.webp",
  "/exercises/situps.webp",
  "/exercises/enbensbalans.jpeg",
  "/exercises/axlar.jpeg",
  "/exercises/superman.jpeg",
  "/exercises/bird-dog.jpeg",
  "/exercises/dead-bug.jpeg",
  "/exercises/rygglyft.jpg",
  "/exercises/liggande-benlyft.jpeg",
  "/exercises/tricepscurl.jpeg",
  "/exercises/bicepscurl.jpeg",
  "/exercises/upphopp.jpeg",
  "/exercises/rest.webp",
  "/sounds/boxing-round-double.mp3",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API calls must always hit the network fresh — never cache these (they carry
  // the synced state and would otherwise serve stale "not found" responses forever).
  if (url.pathname.startsWith("/api/")) return;

  // Navigation requests: network-first, fall back to cached app shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Don't cache redirected responses (e.g. the PIN gate) under the "/" key.
          if (!response.redirected && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put("/", copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  // Static assets (images, audio, manifest, icons): cache-first, then network, then cache the result.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => cached);
    }),
  );
});
