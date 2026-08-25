// Point d'entrée — routeur minimal par hash, pas de framework (cohérent avec EnVie/eProtec).
// Attend l'état d'authentification Firebase avant d'afficher l'app (les données sont
// scopées par utilisateur dans Firestore, voir js/services/storage.js).

import { renderDashboard } from "./views/dashboard.js";
import { renderInbox } from "./views/inbox.js";
import { renderKanban } from "./views/kanban.js";
import { renderLogin } from "./views/login.js";
import { mountCaptureFab } from "./components/capture.js";
import { onAuthChange } from "./services/firebase.js";

const ROUTES = {
  "#/dashboard": { render: renderDashboard, label: "Accueil", icon: "🏠" },
  "#/inbox": { render: renderInbox, label: "Inbox", icon: "📥" },
  "#/kanban": { render: renderKanban, label: "Pilotage", icon: "📋" },
};

const appRoot = document.getElementById("app");
let currentCleanup = null;
let nav = null;
let appMounted = false;

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

function renderRoute() {
  const hash = ROUTES[location.hash] ? location.hash : "#/dashboard";
  if (location.hash !== hash) history.replaceState(null, "", hash);
  currentCleanup?.();
  currentCleanup = ROUTES[hash].render(appRoot) || null;
  updateNavActive(hash);
}

function mountApp() {
  if (appMounted) return;
  appMounted = true;
  nav = mountNav();
  mountCaptureFab();
  window.addEventListener("hashchange", renderRoute);
  renderRoute();
}

function unmountApp() {
  appMounted = false;
  currentCleanup?.();
  currentCleanup = null;
  nav?.remove();
  nav = null;
  document.querySelector(".fab")?.remove();
  window.removeEventListener("hashchange", renderRoute);
}

onAuthChange((user) => {
  if (user) {
    mountApp();
  } else {
    unmountApp();
    renderLogin(appRoot);
  }
});

// PWA : service worker (ne bloque jamais le fonctionnement de base si indisponible).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
