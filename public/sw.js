const CACHE_VERSION = "round-v3";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/favicon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-192-maskable.png",
  "/icons/icon-512-maskable.png",
  "/icons/apple-touch-icon.png",
  "/exercises/squat.webp",
  "/exercises/pushup.webp",
  "/exercises/plank.webp",
  "/exercises/lunge.webp",
  "/exercises/situp.webp",
  "/exercises/rest.webp",
  "/sounds/boxing-round-double.mp3",
  "/music/energi.mp3",
  "/music/driv.mp3",
  "/music/fokus.mp3",
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
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put("/", copy)).catch(() => {});
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
