// Service worker — app-shell versionné, stratégie network-first avec repli cache.
// Pattern repris d'EnVie (§56/§57 : réutiliser l'existant avant de recréer).

const CACHE_NAME = "pilotage-cache-v24";
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
  "./js/services/deeplink.js",
  "./js/services/draftStore.js",
  "./js/services/pomodoroStore.js",
  "./js/services/pilotageViewStore.js",
  "./js/services/shortcuts.js",
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
  "./js/components/checklist.js",
  "./js/components/meetingLauncher.js",
  "./js/components/suggestNextStep.js",
  "./js/components/recipes.js",
  "./js/components/capture.js",
  "./js/components/historyTimeline.js",
  "./js/components/onboarding.js",
  "./js/components/search.js",
  "./js/components/linkedItems.js",
  "./js/components/canevas.js",
  "./js/components/weeklyReview.js",
  "./js/components/pomodoroWidget.js",
  "./js/components/overviewExport.js",
  "./js/components/adminPanel.js",
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
  "./js/views/whatsnew.js",
  "./js/views/memory.js",
  "./js/views/login.js",
  "./js/views/prepMask.js",
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

// BUG corrigé (retour de Charles-Henri, vague 22 septies : "Cannot read properties of
// undefined (reading 'startTime')" côté navigateur ET la fenêtre de masquage restée bloquée
// sur "Chargement…") — deux problèmes cumulés :
//
// 1. `APP_SHELL` ci-dessus n'avait jamais été mis à jour avec les fichiers ajoutés pendant
//    cette vague (`overviewExport.js`, `adminPanel.js`, `prepMask.js`) — à l'inverse de toutes
//    les vagues précédentes, où `CACHE_NAME` ET la liste étaient systématiquement mis à jour
//    ensemble (voir l'historique de ce fichier). Corrigé en les ajoutant et en incrémentant
//    `CACHE_NAME`, ce qui force une réinstallation propre du cache chez tout le monde.
// 2. Plus fondamentalement, le repli en cas d'échec réseau ci-dessous retombait TOUJOURS sur
//    `index.html` en dernier recours — y compris pour un fichier `.js` qui ne serait pas
//    trouvé (nouveau fichier jamais mis en cache, ou raté réseau ponctuel). Le navigateur reçoit
//    alors du HTML là où il attendait un module JavaScript, ce qui fait échouer le CHARGEMENT
//    ENTIER du module (`js/app.js` et toute la chaîne d'imports) sans qu'aucun code applicatif
//    n'ait la moindre chance de s'exécuter — d'où l'écran bloqué indéfiniment sur le
//    "⏳ Chargement…" statique d'index.html, puisque rien n'est jamais venu le remplacer.
//    Corrigé en ne repliant vers `index.html` QUE pour une navigation (`mode === "navigate"`,
//    ex. ouvrir l'app ou cette fenêtre de masquage) — jamais pour un script, une feuille de
//    style ou tout autre required asset, où un échec doit rester un échec réseau normal et
//    visible plutôt que d'être masqué par une réponse qui n'a rien à voir.
//
// (L'erreur "reportAllChanges"/"startTime" rapportée en même temps ne provient d'aucun fichier
// de ce dépôt — probablement un script de mesure de performance injecté par l'hébergeur
// [Cloudflare] ou une extension du navigateur, sans lien avec ce correctif.)
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const isNavigation = event.request.mode === "navigate";

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (isNavigation) return caches.match("./index.html");
          return Response.error();
        })
      )
  );
});
