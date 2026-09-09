// Point d'entrée — routeur minimal par hash, pas de framework (cohérent avec EnVie/eProtec).
// Attend l'état d'authentification Firebase avant d'afficher l'app (les données sont
// scopées par utilisateur dans Firestore, voir js/services/storage.js).

import { renderDashboard } from "./views/dashboard.js?v=3";
import { renderInbox } from "./views/inbox.js?v=3";
import { renderKanban } from "./views/kanban.js?v=3";
import { renderProjects } from "./views/projects.js?v=3";
import { renderPeople } from "./views/people.js?v=3";
import { renderCalendar } from "./views/calendar.js?v=3";
import { renderPriorisation } from "./views/priorisation.js?v=3";
import { renderResources } from "./views/resources.js?v=3";
import { renderPrompts } from "./views/prompts.js?v=3";
import { renderMore } from "./views/more.js?v=3";
import { renderGuide } from "./views/guide.js?v=3";
import { renderWhatsNew } from "./views/whatsnew.js?v=3";
import { renderMemoryTraining } from "./views/memory.js?v=3";
import { renderLogin, renderRestricted } from "./views/login.js?v=3";
import { renderPrepMask } from "./views/prepMask.js?v=3";
import { openModal } from "./components/modal.js?v=3";
import { mountCaptureFab } from "./components/capture.js?v=3";
import { mountHelpButton, maybeShowFirstRunTour } from "./components/onboarding.js?v=3";
import { mountAdminButton } from "./components/adminPanel.js?v=3";
import { mountInboxBadge, unmountInboxBadge } from "./components/inboxBadge.js?v=3";
import { mountWhatsNewBadge, unmountWhatsNewBadge } from "./components/whatsNewBadge.js?v=3";
import { mountGlobalSearch } from "./components/search.js?v=3";
import { mountPomodoroWidget, unmountPomodoroWidget } from "./components/pomodoroWidget.js?v=3";
import { initGlobalShortcuts, teardownGlobalShortcuts } from "./services/shortcuts.js?v=3";
import { onAuthChange, isEmailAllowed, signOutUser } from "./services/firebase.js?v=3";
import { logView, logLogin } from "./services/usageTracking.js?v=3";
import { autoArchiveStaleKept } from "./domain/inbox.js?v=3";
import { fetchBundle, resolveRef } from "./components/linkedItems.js?v=3";
import { parseOpenParam } from "./services/deeplink.js?v=3";
import * as tasksApi from "./domain/tasks.js?v=3";
import * as preferencesApi from "./domain/preferences.js?v=3";

// ROUTES reste la table de dispatch COMPLÈTE — toute route qui y figure fonctionne par hash,
// que son icône apparaisse ou non dans la barre du bas. Distinct de NAV_ITEMS ci-dessous
// (vague 24) depuis que la barre du bas ne montre plus mécaniquement une icône par entrée de
// ROUTES : avant cette vague, mountNav() itérait directement Object.entries(ROUTES).
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
  // Matrice de priorisation (vague 33) — 4e sous-onglet de "Pilotage" (voir NAV_ITEMS
  // ci-dessous et js/components/pilotageSubNav.js), même principe que Tâches/Projets/Calendrier.
  "#/priorisation": { render: renderPriorisation, label: "Priorisation", icon: "🎯" },
  "#/resources": { render: renderResources, label: "Ressources", icon: "📎" },
  "#/prompts": { render: renderPrompts, label: "Prompts", icon: "🤖" },
  "#/more": { render: renderMore, label: "Plus", icon: "☰" },
};

// Barre de navigation du bas (vague 24, retour de Charles-Henri, base : la densité de 8 onglets
// dépassait Material Design (3 à 5 destinations recommandées) et Apple HIG (bascule vers un
// onglet "Plus" au-delà d'environ 5) — voir claude/vague-24-declins-fiches-navigation.md,
// sections 2 et 7 pour le diagnostic et l'organisation exacte choisie avec Charles-Henri.
// "Pilotage" regroupe désormais Tâches/Projets/Calendrier en sous-onglets À L'INTÉRIEUR de ces
// 3 écrans (voir js/components/pilotageSubNav.js) — les routes elles-mêmes ne changent pas,
// seule l'icône du bas devient commune aux 3 (`activeFor`). Même principe pour "Plus", actif
// aussi bien sur son propre écran que sur Ressources/Prompts/Guide/Nouveautés/Mémoire, qui n'ont
// plus leur propre icône directe.
const NAV_ITEMS = [
  { hash: "#/dashboard", label: "Accueil", icon: "🏠" },
  { hash: "#/inbox", label: "Inbox", icon: "📥" },
  { hash: "#/kanban", label: "Pilotage", icon: "📋", activeFor: ["#/kanban", "#/projects", "#/calendar", "#/priorisation"] },
  { hash: "#/people", label: "Équipe", icon: "👥" },
  { hash: "#/more", label: "Plus", icon: "☰", activeFor: ["#/more", "#/resources", "#/prompts", "#/guide", "#/whatsnew", "#/memory"] },
];

// Guide/Nouveautés/Mémoire restent HORS de ROUTES : des pages de référence consultées
// ponctuellement (désormais depuis l'onglet ☰ Plus plutôt que ❓ Aide, voir js/views/more.js et
// js/components/onboarding.js), pas des écrans de travail — les ajouter à ROUTES les aurait
// automatiquement fait apparaître comme icônes de la barre du bas (voir mountNav plus bas, qui
// itère désormais NAV_ITEMS et non plus ROUTES, mais HIDDEN_ROUTES garde ce même principe de
// prudence pour toute future page de référence).
const HIDDEN_ROUTES = {
  "#/guide": { render: renderGuide, label: "Guide" },
  "#/whatsnew": { render: renderWhatsNew, label: "Nouveautés" },
  "#/memory": { render: renderMemoryTraining, label: "Mémoire" },
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
  for (const item of NAV_ITEMS) {
    const link = document.createElement("a");
    link.href = item.hash;
    link.dataset.hash = item.hash;
    link.innerHTML = `<span class="icon">${item.icon}</span><span>${item.label}</span>`;
    el.appendChild(link);
  }
  document.body.appendChild(el);
  return el;
}

// Un item de la barre du bas est actif pour son propre hash ET pour tout hash listé dans son
// `activeFor` (ex. "Pilotage" reste actif sur #/projects et #/calendar, "Plus" sur ses 5 pages
// — voir NAV_ITEMS ci-dessus) — sans `activeFor`, seul son propre hash compte, comme avant.
function updateNavActive(hash) {
  nav?.querySelectorAll("a").forEach((a) => {
    const item = NAV_ITEMS.find((i) => i.hash === a.dataset.hash);
    const matches = item?.activeFor ? item.activeFor.includes(hash) : a.dataset.hash === hash;
    a.classList.toggle("active", matches);
  });
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
    logView("#/dashboard", ROUTES["#/dashboard"].label).catch(() => {});
    return;
  }
  currentCleanup?.();
  currentCleanup = known.render(appRoot) || null;
  updateNavActive(path);
  maybeOpenDeepLink(queryString);
  // Suivi d'usage superadmin (retour de Charles-Henri, 06/09/2026, voir
  // js/services/usageTracking.js) — jamais bloquant : un souci de règle Firestore ou de réseau
  // ne doit jamais gêner la navigation normale de qui que ce soit.
  logView(path, known.label).catch(() => {});
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
  // Pastille "🔴 3" sur l'onglet Inbox (retour de Charles-Henri, vague 23) — voir
  // js/components/inboxBadge.js. Après mountNav() : cherche le lien déjà créé dans `nav`.
  mountInboxBadge(nav);
  // Pastille "🆕" sur l'onglet ☰ Plus (audit TDAH ciblé du 07/09/2026) — voir
  // js/components/whatsNewBadge.js.
  mountWhatsNewBadge(nav);
  mountPomodoroWidget();
  // Raccourcis clavier (vague 20, retour de Charles-Henri : "je marche aussi beaucoup au
  // raccourci clavier") — un seul écouteur pour toute la session, voir js/services/
  // shortcuts.js. Depuis la vague 24 (barre du bas réduite à 5 icônes), Alt+1…Alt+5 pointent
  // vers NAV_ITEMS plutôt que vers les 8 entrées de ROUTES — Charles-Henri a explicitement
  // choisi de ne rien construire pour atteindre Projets/Calendrier/Ressources/Prompts/Guide/
  // Nouveautés/Mémoire au clavier au-delà de ce qui existe déjà (clic, Ctrl+K) : "ça ne marche
  // pas actuellement, donc on laisse tomber" — voir claude/vague-24-declins-fiches-navigation.md.
  initGlobalShortcuts(NAV_ITEMS.map((item) => item.hash));
  window.addEventListener("hashchange", renderRoute);
  renderRoute();
  // "ℹ️ Suivi d'usage" doit être vue avant la visite guidée si les deux sont en attente pour ce
  // compte (une seule modale à la fois, voir modal.js) — voir maybeShowUsageNotice ci-dessous.
  maybeShowUsageNotice().then(maybeShowFirstRunTour);
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
 * Bandeau d'information "suivi d'usage" (retour de Charles-Henri, 06/09/2026 : "oui" à la
 * question de savoir si les autres comptes doivent être informés que leur usage est suivi —
 * voir js/services/usageTracking.js) — affiché UNE SEULE FOIS par compte, à sa toute première
 * connexion suivant la mise en ligne de cette vague (même principe que maybeShowFirstRunTour,
 * js/components/onboarding.js : mémorisé via preferences, jamais reproposé une fois vu).
 *
 * `seenUsageNotice` est marqué à la FERMETURE de la modale, pas à son ouverture (contrairement
 * à markTourSeen(), appelé avant openTour()) : preferences.js n'a qu'un document unique
 * lu-modifié-réécrit en entier (pas d'écriture atomique par champ), et renderDashboard() écrit
 * elle aussi ce même document tout de suite au montage (sa migration ponctuelle
 * dashboardHiddenMigratedV19, js/views/dashboard.js) — deux écritures concurrentes sur le même
 * document au montage peuvent se piétiner (la plus tardive écrase la plus fraîche avec un
 * instantané plus vieux). En ne marquant qu'à la fermeture — un geste humain qui arrive
 * forcément après que ce montage initial se soit calmé — cette écriture ne se retrouve jamais
 * dans cette fenêtre de course. Une vraie Promise (résolue à la fermeture, pas à l'ouverture)
 * pour que l'appelant puisse enchaîner proprement sur la visite guidée sans que les deux
 * modales ne se marchent dessus (une seule modale à la fois, voir modal.js).
 */
async function maybeShowUsageNotice() {
  const prefs = await preferencesApi.getPreferences();
  if (prefs.seenUsageNotice) return;
  await new Promise((resolve) => {
    const body = document.createElement("div");
    body.innerHTML = `
      <p style="margin-top:0;">Pour t'aider à piloter Pilotage, les écrans que tu consultes et
      tes connexions sont enregistrés (quoi, quand, par quel compte) — jamais le détail de ce que
      tu saisis, modifies ou consultes à l'intérieur d'un écran.</p>
      <p style="margin-bottom:0;">Seul le compte administrateur (ch-houdayer@hotmail.fr) peut
      consulter ces informations.</p>
    `;
    openModal({
      title: "ℹ️ Suivi d'usage",
      body,
      dismissible: true,
      onClose: () => {
        preferencesApi.markUsageNoticeSeen().catch(() => {});
        resolve();
      },
      actions: [{ label: "J'ai compris", variant: "primary" }],
    });
  });
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
  unmountInboxBadge();
  unmountWhatsNewBadge();
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
    // Suivi d'usage superadmin (retour de Charles-Henri, 06/09/2026, voir
    // js/services/usageTracking.js) — une connexion par ouverture de session authentifiée, y
    // compris pour la fenêtre de masquage privée ci-dessous (voir le commentaire de logLogin()).
    logLogin().catch(() => {});
    // Fenêtre de masquage privée avant "Préparer mon point" (retour de Charles-Henri, vague 22
    // sexies, voir js/views/people.js#openPrepMaskThenPrep et js/views/prepMask.js) : une vraie
    // fenêtre de navigateur à part, ouverte par window.open() sur cette route dédiée, PAS
    // l'app complète — pas de nav/FAB/aide/recherche/admin à monter pour un outil aussi ponctuel
    // et concentré, et qu'on veut pouvoir glisser sur un second écran sans trimballer le reste.
    if (location.hash.startsWith("#/prep-mask")) {
      renderPrepMask(appRoot);
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
