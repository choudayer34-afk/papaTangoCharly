// Service worker — app-shell versionné, stratégie network-first avec repli cache.
// Pattern repris d'EnVie (§56/§57 : réutiliser l'existant avant de recréer).

const CACHE_NAME = "pilotage-cache-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./styles/tokens.css",
  "./styles/components.css",
  "./js/app.js",
  "./js/services/id.js",
  "./js/services/storage.js",
  "./js/domain/inbox.js",
  "./js/domain/tasks.js",
  "./js/domain/projects.js",
  "./js/components/modal.js",
  "./js/components/toast.js",
  "./js/components/capture.js",
  "./js/views/dashboard.js",
  "./js/views/inbox.js",
  "./js/views/kanban.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
  );
});
