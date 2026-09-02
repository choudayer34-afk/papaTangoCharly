// Point d'entrée — routeur minimal par hash, pas de framework (cohérent avec EnVie/eProtec).
// Attend l'état d'authentification Firebase avant d'afficher l'app (les données sont
// scopées par utilisateur dans Firestore, voir js/services/storage.js).

import { renderDashboard } from "./views/dashboard.js";
import { renderInbox } from "./views/inbox.js";
import { renderKanban } from "./views/kanban.js";
import { renderProjects } from "./views/projects.js";
import { renderPeople } from "./views/people.js";
import { renderCalendar } from "./views/calendar.js";
import { renderResources } from "./views/resources.js";
import { renderPrompts } from "./views/prompts.js";
import { renderGuide } from "./views/guide.js";
import { renderWhatsNew } from "./views/whatsnew.js";
import { renderMemoryTraining } from "./views/memory.js";
import { renderLogin, renderRestricted } from "./views/login.js";
import { mountCaptureFab } from "./components/capture.js";
import { mountHelpButton, maybeShowFirstRunTour } from "./components/onboarding.js";
import { mountAdminButton } from "./components/adminPanel.js";
import { mountGlobalSearch } from "./components/search.js";
import { mountPomodoroWidget, unmountPomodoroWidget } from "./components/pomodoroWidget.js";
import { initGlobalShortcuts, teardownGlobalShortcuts } from "./services/shortcuts.js";
import { onAuthChange, isEmailAllowed, signOutUser } from "./services/firebase.js";
import { autoArchiveStaleKept } from "./domain/inbox.js";
import { fetchBundle, resolveRef } from "./components/linkedItems.js";
import { parseOpenParam } from "./services/deeplink.js";
import * as tasksApi from "./domain/tasks.js";
import * as preferencesApi from "./domain/preferences.js";

const ROUTES = {
  "#/dashboard": { render: renderDashboard, label: "Accueil", icon: "🏠" },
  "#/inbox": { render: renderInbox, label: "Inbox", icon: "📥" },
  "#/kanban": { render: renderKanban, label: "Pilotage", icon: "📋" },
  "#/projects": { render: renderProjects, label: "Projets", icon: "📦" },
  // Management (§34/§35) a été fusionné dans cet onglet le 02/09/2026 (retour de
  // Charles-Henri : "traiter les onglets comme des filtres d'un même flux") — le filtre
  // "👔 Mon manager" à l'intérieur d'Équipe couvre désormais ce qui vivait sur sa propre
  // route ; voir js/views/people.js et js/views/management.js#renderManagerSection.
  "#/people": { render: renderPeople, label: "Équipe", icon: "👥" },
  "#/calendar": { render: renderCalendar, label: "Calendrier", icon: "📅" },
  "#/resources": { render: renderResources, label: "Ressources", icon: "📎" },
  "#/prompts": { render: renderPrompts, label: "Prompts", icon: "🤖" },
};

// Le guide (§ retour de Charles-Henri : "accessible même hors ligne via l'appli", pas
// hébergé ailleurs) est volontairement HORS de ROUTES : c'est une page de référence qu'on
// consulte ponctuellement depuis le bouton ❓ Aide, pas un onglet de travail — l'ajouter à
// ROUTES l'aurait automatiquement affiché dans la barre de navigation du bas (mountNav
// itère ROUTES), ce qui aurait ajouté un dixième onglet permanent pour un besoin occasionnel.
const HIDDEN_ROUTES = {
  "#/guide": { render: renderGuide },
  "#/whatsnew": { render: renderWhatsNew },
  "#/memory": { render: renderMemoryTraining },
};

const appRoot = document.getElementById("app");
let currentCleanup = null;
let nav = null;
let appMounted = false;

// Ouverture à "quelques personnes précises que je choisis" (retour de Charles-Henri) : mémorise
// l'email d'une personne qu'on vient de refuser (liste blanche `allowedUsers`, voir
// js/services/firebase.js#isEmailAllowed) le temps que signOutUser() redéclenche onAuthChange
// avec user=null ci-dessous — sans ça, cette seconde notification afficherait l'écran de
// connexion normal au lieu du message "Accès restreint", pour une notification qu'on a
// nous-mêmes provoquée.
let pendingRestrictedEmail = null;

function mountNav() {
  const el = document.createElement("nav");
  el.className = "bottom-nav";
  for (const [hash, route] of Object.entries(ROUTES)) {
    const link = document.createElement("a");
    link.href = hash;
    link.dataset.hash = hash;
    link.innerHTML = `<span class="icon">${route.icon}</span><span>${route.label}</span>`;
    el.appendChild(link);
  }
  document.body.appendChild(el);
  return el;
}

function updateNavActive(hash) {
  nav?.querySelectorAll("a").forEach((a) => a.classList.toggle("active", a.dataset.hash === hash));
}

// Lien profond vers une fiche précise (retour de Charles-Henri, 01/09/2026 : le lien collé
// dans un .ics généré depuis une Tâche/un Suivi doit rouvrir directement cette fiche-là, pas
// juste l'onglet). Format `#/route?open=Type:id` (js/services/deeplink.js) — résolu via la
// même fonction `resolveRef` que le fil conducteur (js/components/linkedItems.js), qui sait
// déjà ouvrir n'importe laquelle des fiches liables. Jamais bloquant : un lien cassé (fiche
// supprimée depuis, id invalide) laisse simplement l'onglet ouvert normalement.
async function maybeOpenDeepLink(queryString) {
  const target = parseOpenParam(queryString);
  if (!target) return;
  try {
    const bundle = await fetchBundle();
    const resolved = resolveRef(bundle, target);
    resolved?.onOpen();
  } catch {
    // silencieux — voir commentaire ci-dessus.
  }
}

function renderRoute() {
  const [path, queryString] = (location.hash || "").split("?");
  const known = ROUTES[path] || HIDDEN_ROUTES[path];
  if (!known) {
    if (location.hash !== "#/dashboard") history.replaceState(null, "", "#/dashboard");
    currentCleanup?.();
    currentCleanup = ROUTES["#/dashboard"].render(appRoot) || null;
    updateNavActive("#/dashboard");
    return;
  }
  currentCleanup?.();
  currentCleanup = known.render(appRoot) || null;
  updateNavActive(path);
  maybeOpenDeepLink(queryString);
}

function mountApp() {
  if (appMounted) return;
  appMounted = true;
  nav = mountNav();
  mountCaptureFab();
  mountHelpButton();
  mountGlobalSearch();
  // Console d'administration (retour de Charles-Henri, vague 22 quater) — le bouton lui-même
  // décide s'il doit apparaître ou non (voir mountAdminButton) : seul son propre compte
  // ch-houdayer@hotmail.fr le voit, jamais les autres personnes autorisées à utiliser Pilotage.
  mountAdminButton();
  mountPomodoroWidget();
  // Raccourcis clavier (vague 20, retour de Charles-Henri : "je marche aussi beaucoup au
  // raccourci clavier") — un seul écouteur pour toute la session, voir js/services/
  // shortcuts.js. `Object.keys(ROUTES)` donne l'ordre exact des onglets pour Alt+1…Alt+8.
  initGlobalShortcuts(Object.keys(ROUTES));
  window.addEventListener("hashchange", renderRoute);
  renderRoute();
  maybeShowFirstRunTour();
  // Auto-archivage des Informations/Idées de plus de 15 jours (retour de Charles-Henri, voir
  // js/domain/inbox.js) — balayage silencieux à chaque montage plutôt qu'une vraie tâche
  // planifiée côté serveur, qui n'existe pas dans cette architecture. Jamais bloquant : erreur
  // avalée plutôt que de gêner l'ouverture de l'app pour un nettoyage secondaire.
  autoArchiveStaleKept().catch(() => {});
  // Alerte de démarrage (piste TDAH du 01/09/2026, discussion permanence/repérage — "rappels
  // programmés" version retenue : notification navigateur app ouverte uniquement, sans
  // infrastructure serveur). Une fois par montage de l'app, jamais bloquant.
  maybeNotifyStalledOrLate().catch(() => {});
}

/**
 * Notification navigateur (pas un vrai push : ne se déclenche que si l'app est ouverte au
 * premier plan) résumant le retard et les tâches "en pause" (js/domain/tasks.js#isStalled) —
 * l'unique geste "pull → push" léger retenu pour cette vague, faute d'infrastructure serveur
 * (voir claude/etat-avancement-pilotage.md, "rappels programmés"). Trois conditions avant de
 * sonner : Charles-Henri a explicitement activé l'alerte (`notifOptIn === true`, bandeau sur
 * l'Accueil), le navigateur a effectivement accordé la permission, et elle n'a pas déjà été
 * montrée aujourd'hui (`lastNotifShownDate`) — pour ne jamais répéter la même alerte à chaque
 * ouverture de l'app dans la même journée.
 */
async function maybeNotifyStalledOrLate() {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const prefs = await preferencesApi.getPreferences();
  if (prefs.notifOptIn !== true) return;
  const todayKey = new Date().toISOString().slice(0, 10);
  if (prefs.lastNotifShownDate === todayKey) return;

  const tasks = await tasksApi.listAll();
  const lateCount = tasks.filter(tasksApi.isLate).length;
  const stalledCount = tasks.filter(tasksApi.isStalled).length;
  if (lateCount + stalledCount === 0) return;

  const parts = [];
  if (lateCount) parts.push(`${lateCount} en retard`);
  if (stalledCount) parts.push(`${stalledCount} en pause depuis un moment`);
  new Notification("Pilotage", { body: parts.join(" · "), icon: "./icons/icon-192.png" });
  await preferencesApi.markNotifShown(todayKey);
}

function unmountApp() {
  appMounted = false;
  currentCleanup?.();
  currentCleanup = null;
  nav?.remove();
  nav = null;
  document.querySelector(".fab")?.remove();
  document.querySelector(".help-fab")?.remove();
  document.querySelector(".search-fab")?.remove();
  document.querySelector(".admin-fab")?.remove();
  unmountPomodoroWidget();
  teardownGlobalShortcuts();
  window.removeEventListener("hashchange", renderRoute);
}

onAuthChange(async (user) => {
  if (user) {
    // Ouverture à "quelques personnes précises que je choisis" (retour de Charles-Henri, pas
    // d'inscription libre) : on vérifie la liste blanche `allowedUsers` AVANT de monter l'app,
    // pour quiconque s'est authentifié avec succès via Firebase (Google ou email/mot de passe)
    // mais n'a pas été explicitement autorisé. Ce garde-fou côté client évite d'afficher l'app
    // à la mauvaise personne, mais ne remplace pas les règles de sécurité Firestore (seul
    // rempart réel contre quelqu'un qui interrogerait Firestore directement) — voir les
    // instructions de configuration livrées séparément.
    const allowed = await isEmailAllowed(user.email);
    if (!allowed) {
      pendingRestrictedEmail = user.email;
      await signOutUser();
      return;
    }
    mountApp();
  } else {
    unmountApp();
    if (pendingRestrictedEmail) {
      renderRestricted(appRoot, pendingRestrictedEmail);
      pendingRestrictedEmail = null;
    } else {
      renderLogin(appRoot);
    }
  }
});

// PWA : service worker (ne bloque jamais le fonctionnement de base si indisponible).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
