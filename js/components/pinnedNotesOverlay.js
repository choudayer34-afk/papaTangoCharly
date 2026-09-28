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
//
// Redimensionnement (complément du 28/09/2026, retour direct de Charles-Henri : "pouvoir agrandir
// ou réduire un post-it en dimension qui serait épinglé") — poignée bas-droite, même mécanique
// Pointer Events que js/components/bureau.js#attachResize (voir attachFloatResize plus bas), mais
// en coordonnées VIEWPORT plutôt que relatives à un conteneur, et bornée à la fenêtre plutôt qu'au
// plan de travail. La largeur n'est donc plus une constante fixe (`WIDTH`, avant ce complément) :
// chaque carte lit désormais sa propre taille (note.floatWidth/floatHeight, voir
// js/domain/stickyNotes.js#setFloatSize), avec repli sur DEFAULT_WIDTH/DEFAULT_HEIGHT (220×190,
// déjà les valeurs par défaut du plan de travail — réutilisées telles quelles plutôt qu'une
// deuxième paire de constantes) tant qu'un post-it flottant n'a jamais été redimensionné.
// L'aperçu (.pinned-float-note-preview, styles/components.css) n'est plus tronqué à 80 caractères
// ni plafonné à 4.5em de hauteur : il remplit désormais tout l'espace restant de la carte et
// défile si besoin (`overflow-y: auto`) — agrandir un post-it épinglé montre donc directement plus
// de son contenu réel, sans avoir à l'ouvrir.
import * as stickyNotesApi from "../domain/stickyNotes.js";
import { openStickyNoteMenu, openStickyNoteEditor, escapeHtml } from "./stickyNoteShared.js";

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

/** Largeur/hauteur effectives d'un post-it flottant — sa propre taille si déjà redimensionné
 *  (note.floatWidth/floatHeight, voir js/domain/stickyNotes.js#setFloatSize), sinon repli sur
 *  DEFAULT_WIDTH/DEFAULT_HEIGHT (220×190, la largeur fixe déjà en place avant ce complément). */
function floatSize(note) {
  return {
    width: Number.isFinite(note.floatWidth) ? note.floatWidth : stickyNotesApi.DEFAULT_WIDTH,
    height: Number.isFinite(note.floatHeight) ? note.floatHeight : stickyNotesApi.DEFAULT_HEIGHT,
  };
}

/** Position de repli en cascade pour un post-it épinglé jamais encore glissé sous sa forme
 *  flottante (voir le commentaire en tête de fichier) — jamais écrite en base. */
function fallbackPosition(index, width) {
  const cascade = (index % 6) * 28;
  return {
    x: Math.max(MARGIN, window.innerWidth - width - MARGIN - cascade),
    y: 80 + cascade,
  };
}

/** Borne une position à l'intérieur du viewport courant — appliqué à chaque rendu (pas seulement
 *  au glisser) pour qu'un post-it positionné sur un grand écran reste atteignable si Charles-Henri
 *  revient ensuite sur un écran plus petit (redimensionnement de fenêtre, autre appareil). */
function clampPosition(x, y, width, height) {
  const maxX = Math.max(MARGIN, window.innerWidth - width - MARGIN);
  const maxY = Math.max(MARGIN, window.innerHeight - height - MARGIN);
  return { x: Math.min(Math.max(MARGIN, x), maxX), y: Math.min(Math.max(MARGIN, y), maxY) };
}

function buildFloatingNote(note, index) {
  const el = document.createElement("div");
  el.className = `pinned-float-note sticky-note--${note.color}`;
  el.dataset.id = note.id;
  const { width, height } = floatSize(note);
  const hasStoredPosition = Number.isFinite(note.floatX) && Number.isFinite(note.floatY);
  const raw = hasStoredPosition ? { x: note.floatX, y: note.floatY } : fallbackPosition(index, width);
  const { x, y } = clampPosition(raw.x, raw.y, width, height);
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  el.style.zIndex = String(dragZCounter++);
  // Aperçu non tronqué (voir le commentaire en tête de fichier, 28/09/2026) — remplit désormais
  // tout l'espace restant de la carte et défile au besoin (.pinned-float-note-preview,
  // styles/components.css), au lieu d'un extrait fixe de 80 caractères/4.5em.
  const preview = stickyNotesApi.stickyNoteToText(note);
  el.innerHTML = `
    <div class="pinned-float-note-header">
      <button type="button" class="pinned-float-unpin-btn" aria-label="Désépingler" title="Désépingler">📌</button>
      <div class="pinned-float-note-title">${escapeHtml(note.title || "Post-it sans titre")}</div>
      <button type="button" class="sticky-note-menu-btn" aria-label="Menu du post-it" title="Menu du post-it">⋯</button>
    </div>
    ${preview ? `<div class="pinned-float-note-preview">${escapeHtml(preview)}</div>` : ""}
    <div class="sticky-note-resize-handle" role="separator" aria-label="Redimensionner le post-it" title="Redimensionner"></div>
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
  attachFloatResize(el, note, el.querySelector(".sticky-note-resize-handle"));
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
      const clamped = clampPosition(startLeft + dx, startTop + dy, el.offsetWidth, el.offsetHeight);
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

/**
 * Poignée bas-droite (complément du 28/09/2026, voir le commentaire en tête de fichier) — même
 * mécanique Pointer Events que js/components/bureau.js#attachResize, en coordonnées VIEWPORT et
 * bornée à la fenêtre courante (MARGIN de chaque côté) plutôt qu'au plan de travail. `handleEl`
 * a son propre `pointerdown` — `e.stopPropagation()` l'empêche de remonter jusqu'au `pointerdown`
 * posé sur `el` par attachFloatDrag() ci-dessus (qui ne sait, lui, exclure qu'un `<button>` du
 * geste de glisser), sans quoi redimensionner déplacerait aussi la carte.
 */
function attachFloatResize(el, note, handleEl) {
  handleEl.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    suspend();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = el.offsetWidth;
    const startHeight = el.offsetHeight;
    const maxWidth = Math.max(stickyNotesApi.MIN_WIDTH, window.innerWidth - el.offsetLeft - MARGIN);
    const maxHeight = Math.max(stickyNotesApi.MIN_HEIGHT, window.innerHeight - el.offsetTop - MARGIN);
    let finalWidth = startWidth;
    let finalHeight = startHeight;
    handleEl.setPointerCapture(e.pointerId);

    function onMove(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      finalWidth = Math.max(stickyNotesApi.MIN_WIDTH, Math.min(startWidth + dx, maxWidth));
      finalHeight = Math.max(stickyNotesApi.MIN_HEIGHT, Math.min(startHeight + dy, maxHeight));
      el.style.width = `${finalWidth}px`;
      el.style.height = `${finalHeight}px`;
    }
    function onUp() {
      handleEl.removeEventListener("pointermove", onMove);
      handleEl.removeEventListener("pointerup", onUp);
      handleEl.removeEventListener("pointercancel", onUp);
      stickyNotesApi.setFloatSize(note.id, { width: finalWidth, height: finalHeight }).finally(resume);
    }
    handleEl.addEventListener("pointermove", onMove);
    handleEl.addEventListener("pointerup", onUp);
    handleEl.addEventListener("pointercancel", onUp);
  });
}
