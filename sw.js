// Service worker — app-shell versionné, stratégie network-first avec repli cache.
// Pattern repris d'EnVie (§56/§57 : réutiliser l'existant avant de recréer).

const CACHE_NAME = "pilotage-cache-v14";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./styles/tokens.css",
  "./styles/components.css",
  "./js/app.js",
  "./js/services/id.js",
  "./js/services/storage.js",
  "./js/services/firebase.js",
  "./js/domain/inbox.js",
  "./js/domain/tasks.js",
  "./js/domain/projects.js",
  "./js/domain/people.js",
  "./js/domain/followups.js",
  "./js/domain/resources.js",
  "./js/domain/meetings.js",
  "./js/domain/decisions.js",
  "./js/domain/history.js",
  "./js/domain/preferences.js",
  "./js/domain/links.js",
  "./js/domain/templates.js",
  "./js/domain/objectives.js",
  "./js/domain/prompts.js",
  "./js/domain/casquettes.js",
  "./js/components/modal.js",
  "./js/components/toast.js",
  "./js/components/hint.js",
  "./js/components/infoTip.js",
  "./js/components/notesBlock.js",
  "./js/components/suggestNextStep.js",
  "./js/components/recipes.js",
  "./js/components/capture.js",
  "./js/components/historyTimeline.js",
  "./js/components/onboarding.js",
  "./js/components/search.js",
  "./js/components/linkedItems.js",
  "./js/components/canevas.js",
  "./js/components/weeklyReview.js",
  "./js/views/dashboard.js",
  "./js/views/inbox.js",
  "./js/views/kanban.js",
  "./js/views/projects.js",
  "./js/views/people.js",
  "./js/views/management.js",
  "./js/views/calendar.js",
  "./js/views/resources.js",
  "./js/views/prompts.js",
  "./js/views/guide.js",
  "./js/views/login.js",
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
