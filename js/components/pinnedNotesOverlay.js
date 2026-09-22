// "📌 Post-it flottants" — post-it épinglés visibles PARTOUT dans l'app (LOT 13, complément du
// 23/09/2026, retour direct de Charles-Henri le jour même de la livraison initiale : "je dois
// pouvoir [mettre un post-it épinglé] n'importe où dans l'écran même en dehors du bureau [...] il
// [ne doit pas passer] au dessous de toutes les autres modales"). Remplace la liste compacte des
// épinglés qui vivait jusque-là dans la section "Mon bureau" de l'Accueil (voir le commentaire
// "Écarts assumés"/arbitrage revu dans js/components/bureau.js) : un post-it épinglé n'est plus
// une carte parmi d'autres sur l'Accueil, c'est un widget à `position: fixed` monté UNE SEULE FOIS
// pour toute la session (mountApp/unmountApp, js/app.js) — même principe que le mini-minuteur
// Pomodoro (js/components/pomodoroWidget.js), qui doit lui aussi rester visible quel que soit
// l'écran ouvert.
//
// Coordonnées INDÉPENDANTES du plan de travail "Tout voir" (js/components/bureau.js) : un post-it
// a deux positions distinctes qui ne se mélangent jamais — `x`/`y` (position dans le plan de
// travail complet, coordonnées relatives à `#bureau-full-canvas`) et `floatX`/`floatY` (position
// flottante à l'écran, coordonnées viewport — voir js/domain/stickyNotes.js#setFloatPosition). Un
// post-it épinglé jamais encore glissé sous sa forme flottante n'a pas de floatX/floatY enregistré
// — une position de repli en cascade est calculée ici, CÔTÉ CLIENT UNIQUEMENT, tant qu'aucun
// glisser n'a eu lieu (voir fallbackPosition()) : jamais écrite en base tant que Charles-Henri n'a
// pas lui-même déplacé le post-it, même principe que le reste du lot ("ne jamais écrire à chaque
// pixel, seulement au relâchement").
//
// z-index 55 (styles/components.css#.pinned-notes-overlay) : au-dessus de .modal-overlay (50) pour
// rester visible même fiche/modale ouverte ailleurs dans l'app — c'est tout le problème signalé.
// Volontairement EN DESSOUS de .toast (60), .offline-banner (65) et .completion-burst (70) : ces
// trois-là restent des signaux ponctuels/système, jamais masqués par un post-it.
//
// Conflit de superposition avec SA PROPRE modale (menu "⋯" ou édition rapide) : ouvrir l'une de
// ces deux modales pour LE POST-IT QU'ON VIENT DE CLIQUER masquerait sinon partiellement cette
// modale derrière la carte flottante elle-même (z-index 55 > 50 du fond de modale). Chaque carte
// se masque donc (`visibility: hidden`) le temps que SA PROPRE modale reste ouverte, et le rebuild
// périodique (nouvelles données Firestore) est suspendu pendant ce temps pour ne pas la
// réafficher entre-temps — voir suspend()/resume() plus bas, même principe que le
// dragging/focusedInside de js/components/bureau.js.
import * as stickyNotesApi from "../domain/stickyNotes.js";
import { openStickyNoteMenu, openStickyNoteEditor, escapeHtml } from "./stickyNoteShared.js";

const WIDTH = 220;
const MARGIN = 16;
// Au-delà de ce seuil de déplacement (en pixels), un pointerdown/pointerup est un glisser ; en
// dessous, un simple clic (ouvre l'édition rapide) — jamais les deux à la fois pour le même geste.
const CLICK_THRESHOLD = 5;

let containerEl = null;
let unsubscribe = null;
let resizeHandler = null;
let lastNotes = [];
let pendingNotes = null;
let suspendCount = 0;
let dragZCounter = 1;

export function mountPinnedNotesOverlay() {
  if (containerEl) return;
  containerEl = document.createElement("div");
  containerEl.className = "pinned-notes-overlay";
  document.body.appendChild(containerEl);
  resizeHandler = () => render(lastNotes);
  window.addEventListener("resize", resizeHandler);
  unsubscribe = stickyNotesApi.subscribe((notes) => {
    if (shouldSuspend()) {
      pendingNotes = notes;
      return;
    }
    render(notes);
  });
}

export function unmountPinnedNotesOverlay() {
  unsubscribe?.();
  unsubscribe = null;
  if (resizeHandler) window.removeEventListener("resize", resizeHandler);
  resizeHandler = null;
  containerEl?.remove();
  containerEl = null;
  lastNotes = [];
  pendingNotes = null;
  suspendCount = 0;
}

function shouldSuspend() {
  return suspendCount > 0;
}
function suspend() {
  suspendCount++;
}
function resume() {
  suspendCount = Math.max(0, suspendCount - 1);
  if (shouldSuspend() || !pendingNotes) return;
  const notes = pendingNotes;
  pendingNotes = null;
  render(notes);
}

function render(notes) {
  lastNotes = notes;
  if (!containerEl) return;
  const pinned = notes
    .filter((n) => !n.archived && n.pinned)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  containerEl.innerHTML = "";
  pinned.forEach((note, index) => {
    containerEl.appendChild(buildFloatingNote(note, index));
  });
}

/** Position de repli en cascade pour un post-it épinglé jamais encore glissé sous sa forme
 *  flottante (voir le commentaire en tête de fichier) — jamais écrite en base. */
function fallbackPosition(index) {
  const cascade = (index % 6) * 28;
  return {
    x: Math.max(MARGIN, window.innerWidth - WIDTH - MARGIN - cascade),
    y: 80 + cascade,
  };
}

/** Borne une position à l'intérieur du viewport courant — appliqué à chaque rendu (pas seulement
 *  au glisser) pour qu'un post-it positionné sur un grand écran reste atteignable si Charles-Henri
 *  revient ensuite sur un écran plus petit (redimensionnement de fenêtre, autre appareil). */
function clampPosition(x, y, height) {
  const maxX = Math.max(MARGIN, window.innerWidth - WIDTH - MARGIN);
  const maxY = Math.max(MARGIN, window.innerHeight - height - MARGIN);
  return { x: Math.min(Math.max(MARGIN, x), maxX), y: Math.min(Math.max(MARGIN, y), maxY) };
}

function buildFloatingNote(note, index) {
  const el = document.createElement("div");
  el.className = `pinned-float-note sticky-note--${note.color}`;
  el.dataset.id = note.id;
  const hasStoredPosition = Number.isFinite(note.floatX) && Number.isFinite(note.floatY);
  const raw = hasStoredPosition ? { x: note.floatX, y: note.floatY } : fallbackPosition(index);
  // Hauteur estimée avant mesure réelle du DOM (~120px, une carte compacte titre + aperçu) — sert
  // uniquement à borner Y avant le premier rendu ; un léger écart avec la hauteur réelle ne laisse
  // jamais le post-it franchement hors-écran.
  const { x, y } = clampPosition(raw.x, raw.y, 120);
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.zIndex = String(dragZCounter++);
  const preview = stickyNotesApi.stickyNoteToText(note).slice(0, 80);
  el.innerHTML = `
    <div class="pinned-float-note-header">
      <button type="button" class="pinned-float-unpin-btn" aria-label="Désépingler" title="Désépingler">📌</button>
      <div class="pinned-float-note-title">${escapeHtml(note.title || "Post-it sans titre")}</div>
      <button type="button" class="sticky-note-menu-btn" aria-label="Menu du post-it" title="Menu du post-it">⋯</button>
    </div>
    ${preview ? `<div class="pinned-float-note-preview">${escapeHtml(preview)}</div>` : ""}
  `;

  // Bouton dédié de désépinglage (retour direct de Charles-Henri, AskUserQuestion du 23/09/2026 :
  // "un bouton sur le post-it") — action directe, sans confirmation (symétrique de l'épinglage,
  // jamais destructif : le post-it redevient simplement visible uniquement dans "Tout voir").
  el.querySelector(".pinned-float-unpin-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    stickyNotesApi.togglePin(note.id, false);
  });
  el.querySelector(".sticky-note-menu-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    suspend();
    el.style.visibility = "hidden";
    openStickyNoteMenu(note, {
      onClose: () => {
        el.style.visibility = "";
        resume();
      },
    });
  });

  attachFloatDrag(el, note);
  return el;
}

/**
 * Glisser n'importe où sur la carte (hors boutons) — Pointer Events, même mécanique que le
 * glisser du plan de travail complet (js/components/bureau.js#attachDrag), mais en coordonnées
 * VIEWPORT plutôt que relatives à un conteneur, et avec un seuil de mouvement (CLICK_THRESHOLD)
 * pour distinguer un simple clic (ouvre l'édition rapide, voir openStickyNoteEditor) d'un vrai
 * glisser (repositionne, jamais les deux à la fois pour le même geste).
 */
function attachFloatDrag(el, note) {
  el.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    e.preventDefault();
    suspend(); // couvre tout le geste — glisser ET clic (voir la branche `else` de onUp).
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = el.offsetLeft;
    const startTop = el.offsetTop;
    let finalX = startLeft;
    let finalY = startTop;
    let moved = false;
    el.style.zIndex = String(dragZCounter++);
    el.setPointerCapture(e.pointerId);

    function onMove(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.abs(dx) > CLICK_THRESHOLD || Math.abs(dy) > CLICK_THRESHOLD) moved = true;
      const clamped = clampPosition(startLeft + dx, startTop + dy, el.offsetHeight);
      finalX = clamped.x;
      finalY = clamped.y;
      el.style.left = `${finalX}px`;
      el.style.top = `${finalY}px`;
    }
    function onUp() {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      if (moved) {
        stickyNotesApi.setFloatPosition(note.id, { x: finalX, y: finalY }).finally(resume);
      } else {
        el.style.visibility = "hidden";
        openStickyNoteEditor(note, {
          onClose: () => {
            el.style.visibility = "";
            resume();
          },
        });
      }
    }
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  });
}
