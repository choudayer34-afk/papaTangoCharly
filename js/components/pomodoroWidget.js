// Mini-minuteur 🍅 toujours visible — monté une seule fois pour toute la session
// (mountApp/unmountApp, js/app.js), comme le bouton ❓ Aide ou le FAB de capture. C'est le seul
// moyen pour qu'un Pomodoro lancé depuis "🧠 Mémoire & TDAH" continue de compter pendant que
// Charles-Henri va travailler ailleurs dans l'app (Kanban, Inbox...) plutôt que de s'arrêter
// dès qu'il change d'écran — sinon l'outil ne servirait à rien pour son usage réel ("je lance
// 25 minutes puis je vais bosser"). Invisible tant qu'aucune session n'est active.
//
// Seul endroit qui fait avancer les phases (voir pomodoroStore.js#tick) — la vue #/memory ne
// fait que lire l'état pour s'afficher, ce qui évite tout double toast/notification si les
// deux sont "actifs" en même temps (le widget tourne toujours, même quand #/memory est ouvert).

import * as pomodoroStore from "../services/pomodoroStore.js";
import { showToast } from "./toast.js";

let tickInterval = null;
let widgetEl = null;
let originalTitle = null;
let titleRestoreBound = false;

export function mountPomodoroWidget() {
  if (widgetEl) return;
  widgetEl = document.createElement("div");
  widgetEl.className = "pomodoro-widget";
  document.body.appendChild(widgetEl);
  render();
  tickInterval = setInterval(onTick, 1000);
}

export function unmountPomodoroWidget() {
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = null;
  widgetEl?.remove();
  widgetEl = null;
}

function onTick() {
  const { justTransitionedTo } = pomodoroStore.tick();
  if (justTransitionedTo) announceTransition(justTransitionedTo);
  render();
}

function announceTransition(phase) {
  const label = pomodoroStore.PHASE_LABELS[phase] || phase;
  showToast(`${label} — c'est parti`);
  flashTitleUntilFocus(phase === "work" ? "🎯 Concentration !" : "☕ Pause !");
  // Réutilise la même permission que l'alerte de démarrage (js/app.js#maybeNotifyStalledOrLate)
  // si Charles-Henri l'a déjà accordée — pas de second opt-in à proposer pour un signal qui
  // sert exactement le même besoin (un rappel qui vient le chercher plutôt que l'inverse).
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification("Pilotage", { body: `${label} — c'est parti`, icon: "./icons/icon-192.png" });
    } catch {
      // silencieux — jamais bloquant pour le minuteur lui-même.
    }
  }
}

/**
 * Signal externe pendant que l'onglet n'est pas au premier plan (retour de Charles-Henri :
 * "je demande un café et je l'oublie complètement, absorbé par autre chose ailleurs") — le
 * titre de l'onglet change tant qu'il n'y revient pas, remis en place au premier retour de
 * focus/visibilité plutôt que par une minuterie dédiée à nettoyer.
 */
function flashTitleUntilFocus(message) {
  if (!document.hidden) return; // déjà au premier plan, le toast suffit.
  if (originalTitle === null) originalTitle = document.title;
  document.title = message;
  if (!titleRestoreBound) {
    titleRestoreBound = true;
    const restore = () => {
      if (originalTitle !== null) document.title = originalTitle;
      originalTitle = null;
      titleRestoreBound = false;
      document.removeEventListener("visibilitychange", restore);
      window.removeEventListener("focus", restore);
    };
    document.addEventListener("visibilitychange", restore);
    window.addEventListener("focus", restore);
  }
}

function render() {
  const state = pomodoroStore.getState();
  if (!state) {
    widgetEl.classList.remove("visible");
    widgetEl.innerHTML = "";
    return;
  }
  widgetEl.classList.add("visible");
  const remaining = pomodoroStore.remainingMs(state);
  const label = pomodoroStore.PHASE_LABELS[state.phase] || state.phase;
  widgetEl.innerHTML = `
    <a href="#/memory" class="pomodoro-widget-time">${label} ${pomodoroStore.formatMs(remaining)}</a>
    <button type="button" class="pomodoro-widget-toggle" aria-label="${state.isPaused ? "Reprendre" : "Mettre en pause"}">${state.isPaused ? "▶️" : "⏸️"}</button>
  `;
  widgetEl.querySelector(".pomodoro-widget-toggle").addEventListener("click", () => {
    if (state.isPaused) pomodoroStore.resume();
    else pomodoroStore.pause();
    render();
  });
}
