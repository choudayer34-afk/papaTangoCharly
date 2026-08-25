// Point d'entrée — routeur minimal par hash, pas de framework (cohérent avec EnVie/eProtec).

import { renderDashboard } from "./views/dashboard.js";
import { renderInbox } from "./views/inbox.js";
import { renderKanban } from "./views/kanban.js";
import { mountCaptureFab } from "./components/capture.js";

const ROUTES = {
  "#/dashboard": { render: renderDashboard, label: "Accueil", icon: "🏠" },
  "#/inbox": { render: renderInbox, label: "Inbox", icon: "📥" },
  "#/kanban": { render: renderKanban, label: "Pilotage", icon: "📋" },
};

const appRoot = document.getElementById("app");
let currentCleanup = null;

function mountNav() {
  const nav = document.createElement("nav");
  nav.className = "bottom-nav";
  for (const [hash, route] of Object.entries(ROUTES)) {
    const link = document.createElement("a");
    link.href = hash;
    link.dataset.hash = hash;
    link.innerHTML = `<span class="icon">${route.icon}</span><span>${route.label}</span>`;
    nav.appendChild(link);
  }
  document.body.appendChild(nav);
  return nav;
}

function updateNavActive(nav, hash) {
  nav.querySelectorAll("a").forEach((a) => a.classList.toggle("active", a.dataset.hash === hash));
}

function renderRoute(nav) {
  const hash = ROUTES[location.hash] ? location.hash : "#/dashboard";
  if (location.hash !== hash) {
    history.replaceState(null, "", hash);
  }
  currentCleanup?.();
  currentCleanup = ROUTES[hash].render(appRoot) || null;
  updateNavActive(nav, hash);
}

function init() {
  const nav = mountNav();
  mountCaptureFab();
  window.addEventListener("hashchange", () => renderRoute(nav));
  renderRoute(nav);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

// PWA : service worker (ne bloque jamais le fonctionnement de base si indisponible).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
