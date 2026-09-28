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
// Conflit de superposition avec SA PROPRE modale (menu "⋯", ou — nouveau depuis l'édition en
// place, voir plus bas — conversion d'une ligne de checklist puis la fiche de création qui en
// découle) : ouvrir l'une de ces modales masquerait sinon partiellement cette modale derrière la
// carte flottante elle-même (z-index 55 > 50 du fond de modale). SEULE la carte à l'origine de la
// modale se masque (`visibility: hidden`) le temps que celle-ci (ou la suivante dans la même
// chaîne) reste ouverte, jamais les autres cartes ni une modale ouverte ailleurs dans l'app
// (ex. "🗄️ Post-it archivés" depuis "🧠 Mon bureau") — voir beginOwnModalChain()/endOwnModalChain()
// plus bas, qui s'abonnent au besoin à js/components/modal.js#subscribeModalState plutôt que de
// masquer tout l'overlay en permanence. Le rebuild périodique de l'overlay (nouvelles données
// Firestore) est suspendu pendant ce temps pour ne pas réafficher cette carte entre-temps — voir
// suspend()/resume() plus bas, même principe que le dragging/focusedInside de bureau.js.
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
//
// Édition en place (complément du 28/09/2026, RETOUR SUR une conclusion du même jour — voir
// claude/postits-epingles-redimensionnement-28-09-2026.md §2 : la 3e demande — "cocher/ajouter/
// modifier directement en mode checklist/texte" — avait d'abord été considérée comme déjà
// satisfaite par la modale d'édition rapide existante depuis le 23/09. Charles-Henri a ensuite
// confirmé vouloir la lecture alternative qui avait été explicitement proposée sans être retenue :
// "je voulais bien l'édition rapide donc que tu repasses dessus" — rendre le contenu éditable
// DIRECTEMENT sur la carte flottante, à la manière du plan de travail "Tout voir"
// (js/components/bureau.js#buildNoteEl), sans plus jamais ouvrir de modale pour ça) : la carte
// reprend désormais la même structure qu'un post-it du plan de travail — titre éditable, bascule
// texte/checklist, corps via js/components/stickyNoteShared.js#renderNoteBody (déjà partagé avec
// bureau.js, aucune duplication de logique de sauvegarde) — au lieu du simple aperçu en lecture
// seule + clic pour ouvrir `openStickyNoteEditor` (RETIRÉE, voir stickyNoteShared.js, elle n'avait
// plus aucun autre appelant). Conséquences directes sur ce fichier :
//  - Le glisser (attachFloatDrag) ne porte plus que sur l'EN-TÊTE de la carte (comme
//    bureau.js#attachDrag), le corps contenant désormais de vrais champs de saisie (titre,
//    textarea, cases à cocher, ligne de checklist) qu'un glisser ne doit plus jamais capturer.
//    La distinction clic/glisser (CLICK_THRESHOLD) disparaît avec elle : plus aucune action
//    n'est déclenchée par un simple clic sans déplacement sur l'en-tête (comme sur le plan de
//    travail complet), le contenu s'édite désormais directement dans le corps de la carte.
//  - Une frappe en cours (titre, texte libre, ajout/édition d'une ligne de checklist) doit
//    suspendre le rebuild périodique de l'overlay, sous peine de perdre le focus/curseur en plein
//    milieu si une notification Firestore arrive pendant la frappe — même bug déjà corrigé sur le
//    plan de travail complet le 23/09/2026 (voir le commentaire détaillé de
//    js/components/bureau.js#mountBureau sur focusin/focusout) : voir attachFocusTracking() plus
//    bas, appliqué ici à tout l'overlay (une seule notification Firestore reconstruit TOUTES les
//    cartes flottantes à la fois, voir render()).
import * as stickyNotesApi from "../domain/stickyNotes.js";
import { openStickyNoteMenu, renderNoteBody, escapeAttr } from "./stickyNoteShared.js";
import { subscribeModalState } from "./modal.js";

const MARGIN = 16;

let containerEl = null;
let unsubscribe = null;
let resizeHandler = null;
let lastNotes = [];
let pendingNotes = null;
let suspendCount = 0;
let dragZCounter = 1;
// Ne déclenche qu'UN SEUL suspend()/resume() par changement d'état (jamais un par événement DOM)
// — évite de désynchroniser le compteur partagé `suspendCount` si plusieurs focusin/focusout
// s'enchaînent vite.
let focusSuspended = false;
// Chaîne de modale "possédée" par une carte flottante (voir beginOwnModalChain() plus bas) — au
// plus UNE seule à la fois, comme le système de modale lui-même ("une seule modale à la fois",
// js/components/modal.js#openModal) : aucun besoin d'une collection, un simple triplet suffit.
let chainOwnerEl = null;
let chainUnsubscribe = null;
let chainCloseTimer = null;

export function mountPinnedNotesOverlay() {
  if (containerEl) return;
  containerEl = document.createElement("div");
  containerEl.className = "pinned-notes-overlay";
  document.body.appendChild(containerEl);
  resizeHandler = () => render(lastNotes);
  window.addEventListener("resize", resizeHandler);
  attachFocusTracking(containerEl);
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
  endOwnModalChain();
  if (resizeHandler) window.removeEventListener("resize", resizeHandler);
  resizeHandler = null;
  containerEl?.remove();
  containerEl = null;
  lastNotes = [];
  pendingNotes = null;
  suspendCount = 0;
  focusSuspended = false;
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

/**
 * Masque LA carte flottante `el` (et suspend le rebuild de l'overlay) tant qu'une modale ouverte
 * PAR ELLE reste ouverte — menu "⋯", ou conversion d'une ligne de checklist puis la fiche de
 * création qui en découle (voir le commentaire en tête de fichier). Ne masque JAMAIS les autres
 * cartes ni ne réagit à une modale ouverte ailleurs dans l'app (ex. "🗄️ Post-it archivés" depuis
 * "🧠 Mon bureau") : c'est tout l'inverse qui est recherché pour celles-là (rester visibles
 * au-dessus, voir le commentaire en tête de fichier) — d'où un abonnement `subscribeModalState`
 * démarré ICI, à l'action précise qui ouvre la première modale de la chaîne, plutôt qu'un
 * abonnement permanent qui ne saurait pas distinguer "ma propre modale" d'une modale quelconque.
 *
 * `openLineConvertModal`/`convertLine`/`convertWholeNote` (js/components/stickyNoteShared.js)
 * peuvent enchaîner DEUX modales (le choix de conversion, puis la fiche créée) sans jamais fermer
 * la première avant que la seconde replace — `subscribeModalState` peut donc rapporter un aller-
 * retour true→false→true en un seul tick JS (le système de modale ferme toujours la précédente
 * avant d'ouvrir la suivante, "une seule modale à la fois") : le `setTimeout(..., 0)` ci-dessous
 * attend un tick complet avant de conclure que la chaîne est réellement terminée, pour ne jamais
 * réafficher la carte entre deux modales du même enchaînement (même principe déjà accepté ailleurs
 * dans l'app pour un enchaînement de modales, voir js/components/bureau.js#buildNoteEl sur la
 * réouverture furtive de "Tout voir").
 */
function beginOwnModalChain(el) {
  clearTimeout(chainCloseTimer);
  if (chainOwnerEl === el) return; // déjà en cours pour cette carte (ex. double-clic rapide)
  if (chainOwnerEl) endOwnModalChain(); // sécurité — ne devrait jamais arriver en pratique
  chainOwnerEl = el;
  suspend();
  el.style.visibility = "hidden";
  chainUnsubscribe = subscribeModalState((open) => {
    clearTimeout(chainCloseTimer);
    if (open) return;
    chainCloseTimer = setTimeout(endOwnModalChain, 0);
  });
}

/** Termine la chaîne en cours (naturellement, une fois plus aucune modale ouverte — ou de force,
 *  voir render()/unmountPinnedNotesOverlay() ci-dessus/ci-dessous, pour l'unique cas où la carte
 *  "propriétaire" serait détruite AVANT que sa chaîne ne se termine d'elle-même : un redimensionne-
 *  ment de fenêtre pendant ce temps, voir resizeHandler plus haut, qui reconstruit tout l'overlay
 *  sans passer par shouldSuspend() — sans ce filet, `suspendCount` resterait incrémenté pour de bon
 *  et l'overlay entier ne se réafficherait plus jamais). Idempotent — sûr à appeler même sans
 *  chaîne active. */
function endOwnModalChain() {
  clearTimeout(chainCloseTimer);
  chainUnsubscribe?.();
  chainUnsubscribe = null;
  if (!chainOwnerEl) return;
  chainOwnerEl.style.visibility = "";
  chainOwnerEl = null;
  resume();
}

/** Vrai uniquement pour un champ de VRAIE saisie texte (titre, texte libre, ajout/édition d'une
 *  ligne de checklist) — jamais pour un bouton, une case à cocher ou tout autre élément focusable
 *  qui ne contient aucune frappe en cours à protéger. Même principe que
 *  js/components/bureau.js#isEditableFocusTarget. */
function isEditableFocusTarget(el) {
  if (!(el instanceof HTMLElement)) return false;
  return el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && el.type === "text");
}

/** Suspend le rebuild de l'overlay tant qu'une VRAIE frappe est en cours quelque part dans une
 *  carte flottante — `focusin`/`focusout` remontent (contrairement à `focus`/`blur`), posé une
 *  seule fois sur `containerEl` plutôt qu'à chaque carte puisque `render()` reconstruit tout
 *  l'overlay d'un coup. Même mécanique que js/components/bureau.js#attachFocusTracking (y compris
 *  le `setTimeout(..., 50)` sur focusout, nécessaire pour laisser le nouveau focus se poser avant
 *  de conclure qu'on est réellement sorti d'un champ éditable). */
function attachFocusTracking(scopeEl) {
  scopeEl.addEventListener("focusin", (e) => {
    if (isEditableFocusTarget(e.target) === focusSuspended) return;
    focusSuspended = isEditableFocusTarget(e.target);
    if (focusSuspended) suspend();
  });
  scopeEl.addEventListener("focusout", () => {
    setTimeout(() => {
      const stillEditable = isEditableFocusTarget(document.activeElement);
      if (stillEditable === focusSuspended) return;
      focusSuspended = stillEditable;
      if (!focusSuspended) resume();
    }, 50);
  });
}

function render(notes) {
  lastNotes = notes;
  if (!containerEl) return;
  // Filet de sécurité (voir le commentaire détaillé d'endOwnModalChain() plus haut) : un rebuild
  // ne devrait normalement jamais survenir tant qu'une chaîne de modale est active (suspend()
  // l'en empêche déjà via shouldSuspend() ci-dessus) — SAUF `resizeHandler`, qui appelle render()
  // directement sans passer par ce garde-fou. Purement défensif, ne fait rien la quasi-totalité
  // du temps (chainOwnerEl reste `null`).
  endOwnModalChain();
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

/**
 * Structure désormais identique à celle d'un post-it du plan de travail complet
 * (js/components/bureau.js#buildNoteEl, voir le commentaire en tête de fichier) : en-tête
 * (épingle/titre éditable/menu "⋯"), bascule texte/checklist, corps édité en place
 * (stickyNoteShared.js#renderNoteBody), poignée de redimensionnement.
 */
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
  el.innerHTML = `
    <div class="pinned-float-note-header">
      <button type="button" class="pinned-float-unpin-btn" aria-label="Désépingler" title="Désépingler">📌</button>
      <input type="text" class="sticky-note-title-input" placeholder="Titre..." value="${escapeAttr(note.title)}" />
      <button type="button" class="sticky-note-menu-btn" aria-label="Menu du post-it" title="Menu du post-it">⋯</button>
    </div>
    <div class="sticky-note-mode-row">
      <button type="button" class="sticky-note-mode-btn${note.type === "text" ? " active" : ""}" data-mode="text" title="Texte libre">📝</button>
      <button type="button" class="sticky-note-mode-btn${note.type === "checklist" ? " active" : ""}" data-mode="checklist" title="Checklist">☑️</button>
    </div>
    <div class="sticky-note-body"></div>
    <div class="sticky-note-resize-handle" role="separator" aria-label="Redimensionner le post-it" title="Redimensionner"></div>
  `;

  const headerEl = el.querySelector(".pinned-float-note-header");
  const titleInput = el.querySelector(".sticky-note-title-input");
  const bodyEl = el.querySelector(".sticky-note-body");

  // Bouton dédié de désépinglage (retour direct de Charles-Henri, AskUserQuestion du 23/09/2026 :
  // "un bouton sur le post-it") — action directe, sans confirmation (symétrique de l'épinglage,
  // jamais destructif : le post-it redevient simplement visible uniquement dans "Tout voir").
  el.querySelector(".pinned-float-unpin-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    stickyNotesApi.togglePin(note.id, false);
  });

  // Titre — même sauvegarde automatique (anti-rebond + immédiate à la perte de focus) que
  // js/components/bureau.js#buildNoteEl, réutilisée à l'identique.
  let titleSaveTimer = null;
  titleInput.addEventListener("input", () => {
    clearTimeout(titleSaveTimer);
    titleSaveTimer = setTimeout(() => stickyNotesApi.setTitle(note.id, titleInput.value), 500);
  });
  titleInput.addEventListener("blur", () => {
    clearTimeout(titleSaveTimer);
    stickyNotesApi.setTitle(note.id, titleInput.value);
  });

  // Menu "⋯" — la carte se masque le temps de cette modale (ou de toute autre qui en découlerait,
  // ex. "Transformer en") via beginOwnModalChain(), voir son commentaire détaillé plus haut.
  el.querySelector(".sticky-note-menu-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    beginOwnModalChain(el);
    openStickyNoteMenu(note);
  });

  // Menu "⋯" D'UNE LIGNE de checklist (conversion individuelle, js/components/checklist.js) —
  // détecté PAR DÉLÉGATION sur le corps de la carte (`.checklist-line-menu-btn`, classe dédiée
  // ajoutée à cette occasion dans checklist.js) plutôt qu'un câblage direct : le bouton lui-même
  // est recréé par renderChecklist() à chaque ajout/coche/réordonnement, un écouteur posé une
  // seule fois ici sur `bodyEl` (jamais recréé, lui, tant que le mode texte/checklist ne bascule
  // pas) survit à ces reconstructions internes sans avoir à en dépendre. La modale de conversion
  // ouverte par ce bouton (js/components/stickyNoteShared.js#openLineConvertModal), puis la fiche
  // de création qui en découle, doivent masquer la carte au même titre que le menu "⋯" ci-dessus —
  // exactement le même besoin, qui n'existait pas avant ce complément puisque cette checklist ne
  // vivait jusqu'ici que dans une modale déjà, elle, entièrement masquante (voir le commentaire en
  // tête de fichier).
  bodyEl.addEventListener("click", (e) => {
    if (e.target.closest(".checklist-line-menu-btn")) beginOwnModalChain(el);
  });

  // Bascule texte/checklist — même correctif "réaffichage immédiat" que
  // js/components/bureau.js#buildNoteEl (CI du 25/09/2026) : `note.type` est mis à jour et le
  // corps réaffiché AVANT même que l'écriture Firestore ne parte, pour ne pas dépendre de
  // l'aller-retour serveur avant de pouvoir taper dans le nouveau mode.
  el.querySelectorAll(".sticky-note-mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.mode === note.type) return;
      note.type = btn.dataset.mode;
      stickyNotesApi.setType(note.id, note.type);
      el.querySelectorAll(".sticky-note-mode-btn").forEach((b) => b.classList.toggle("active", b === btn));
      renderNoteBody(bodyEl, note);
    });
  });

  // Corps édité en place — checklist (cocher/ajouter/modifier/réordonner/convertir une ligne) ou
  // texte libre, exactement comme sur le plan de travail complet. Pas de `onLineConvertClose` : il
  // n'existe ici aucune modale "Tout voir" à rouvrir après la conversion d'une ligne (à la
  // différence de bureau.js) — cette carte se réaffiche d'elle-même dès que sa propre chaîne de
  // modale se termine, voir beginOwnModalChain()/endOwnModalChain() plus haut, câblés juste
  // au-dessus via la détection du bouton "⋯" d'une ligne.
  renderNoteBody(bodyEl, note);

  attachFloatDrag(el, note, headerEl);
  attachFloatResize(el, note, el.querySelector(".sticky-note-resize-handle"));
  return el;
}

/**
 * Glisser par l'EN-TÊTE uniquement (comme js/components/bureau.js#attachDrag) — Pointer Events,
 * même mécanique que le glisser du plan de travail complet, mais en coordonnées VIEWPORT plutôt
 * que relatives à un conteneur. Le corps de la carte contient désormais de vrais champs de saisie
 * (titre, textarea, checklist) : un glisser démarré n'importe où sur la carte entière (comme
 * avant ce complément) capturerait ces interactions au lieu de les laisser s'exécuter — voir le
 * commentaire en tête de fichier. Plus de distinction clic/glisser : un simple clic sans
 * déplacement sur l'en-tête ne déclenche plus rien (le contenu s'édite désormais directement dans
 * le corps de la carte, jamais via l'en-tête).
 */
function attachFloatDrag(el, note, headerEl) {
  headerEl.addEventListener("pointerdown", (e) => {
    if (e.target.closest("input, button")) return;
    e.preventDefault();
    suspend();
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = el.offsetLeft;
    const startTop = el.offsetTop;
    let finalX = startLeft;
    let finalY = startTop;
    el.style.zIndex = String(dragZCounter++);
    headerEl.setPointerCapture(e.pointerId);

    function onMove(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const clamped = clampPosition(startLeft + dx, startTop + dy, el.offsetWidth, el.offsetHeight);
      finalX = clamped.x;
      finalY = clamped.y;
      el.style.left = `${finalX}px`;
      el.style.top = `${finalY}px`;
    }
    function onUp() {
      headerEl.removeEventListener("pointermove", onMove);
      headerEl.removeEventListener("pointerup", onUp);
      headerEl.removeEventListener("pointercancel", onUp);
      stickyNotesApi.setFloatPosition(note.id, { x: finalX, y: finalY }).finally(resume);
    }
    headerEl.addEventListener("pointermove", onMove);
    headerEl.addEventListener("pointerup", onUp);
    headerEl.addEventListener("pointercancel", onUp);
  });
}

/**
 * Poignée bas-droite (complément du 28/09/2026, voir le commentaire en tête de fichier) — même
 * mécanique Pointer Events que js/components/bureau.js#attachResize, en coordonnées VIEWPORT et
 * bornée à la fenêtre courante (MARGIN de chaque côté) plutôt qu'au plan de travail. `handleEl`
 * a son propre `pointerdown` — `e.stopPropagation()` l'empêche de remonter jusqu'au `pointerdown`
 * posé sur `headerEl` par attachFloatDrag() ci-dessus, sans quoi redimensionner déplacerait aussi
 * la carte (n'arrive de toute façon plus depuis ce complément, la poignée étant hors de l'en-tête,
 * mais gardé par prudence/lisibilité, comme sur le plan de travail complet).
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
