// "🧠 Mon bureau" — post-it libres de l'Accueil (LOT 13, TODO-027, besoin transmis par
// Charles-Henri le 22/09/2026 : "je veux disposer de plusieurs post-it libres sur mon écran
// d'accueil afin de capturer rapidement des notes pendant une réunion, organiser mes idées
// visuellement et transformer ensuite ces notes en objets de Pilotage"). Remplace le "📌
// Pense-bête" unique (js/domain/preferences.js) — arbitrage explicite de Charles-Henri
// (AskUserQuestion, 22/09/2026 : "Mon bureau remplace le Pense-bête").
//
// Composant à la fois vue ET domaine (comme js/components/decisionGrid.js, qui importe
// directement js/domain/decisions.js) : contrairement à js/components/checklist.js (générique,
// réutilisé par Tâche/Suivi/ex-Pense-bête, callbacks fournis par l'appelant), le Bureau n'a qu'un
// seul appelant possible (js/views/dashboard.js, section "Mon bureau") — importer directement
// js/domain/stickyNotes.js ici évite de faire remonter une dizaine de callbacks jusqu'à
// dashboard.js sans aucun bénéfice de réutilisation.
//
// Le menu "⋯" (couleur/épingle/archive/suppression/transformation), l'édition rapide et la
// conversion vivent désormais dans js/components/stickyNoteShared.js (extraction du 23/09/2026,
// voir son commentaire en tête) — ce fichier partage ce menu avec js/components/
// pinnedNotesOverlay.js (widgets flottants), qui en a besoin sans jamais afficher le plan de
// travail complet.
//
// Cycle d'imports avec js/views/dashboard.js (dashboard.js monte ce composant, stickyNoteShared.js
// importe openCreateDecisionModal depuis dashboard.js) : même principe qu'un cycle déjà existant
// et déjà en production entre js/views/dashboard.js et js/views/inbox.js — sûr tant qu'aucune des
// deux parties n'utilise le lien importé à l'évaluation du module (seulement plus tard, à
// l'intérieur d'un gestionnaire d'événement), ce qui est le cas ici comme là-bas.
//
// Repositionnement/redimensionnement — Pointer Events (souris/tactile/stylet unifiés) : la
// position affichée suit le pointeur en direct (mise à jour du style CSS seule, aucune écriture
// réseau à chaque pixel), l'écriture Firestore (js/domain/stickyNotes.js#setLayout) n'a lieu
// qu'au relâchement — même préoccupation que le risque déjà noté dans TODO_TECHNIQUE.md pour ce
// lot ("ne pas multiplier les écritures Firestore pendant le glisser").
//
// Écarts assumés avec la spec transmise (implémentation, pas de décision produit — à documenter
// dans le rapport de fin de lot, aucun n'a semblé mériter d'interrompre le lot pour redemander) :
//  - "Épingler [...] reste toujours visible en premier" : dans le plan de travail "Tout voir"
//    (positions libres x/y), un post-it épinglé reçoit un z-index plancher toujours au-dessus de
//    tous les post-it non épinglés (jamais recouvert) — voir PIN_BOOST plus bas. Sur l'ensemble de
//    l'app, "visible en premier" est désormais satisfait plus largement par les widgets flottants
//    (js/components/pinnedNotesOverlay.js, complément du 23/09/2026), toujours au-dessus de tout.
//  - Positionnement libre identique sur toutes les tailles d'écran (pas de repli "liste empilée"
//    sur mobile, non demandé explicitement) — la position/taille restent bornées à la largeur du
//    conteneur au moment du geste, la hauteur du plan de travail s'agrandit automatiquement pour
//    toujours laisser la place au post-it le plus bas.
import * as stickyNotesApi from "../domain/stickyNotes.js";
import { openStickyNoteMenu, renderNoteBody, escapeHtml, escapeAttr } from "./stickyNoteShared.js";
import { openModal, closeModal, confirmDelete, guardClick } from "./modal.js";
import { showToast } from "./toast.js";

/**
 * Monte la section "Mon bureau" dans `container` (vide au départ, voir js/views/dashboard.js).
 * Ne s'abonne PAS lui-même à Firestore (dashboard.js s'en charge, comme pour toutes les autres
 * sections de l'Accueil) — l'appelant pousse chaque nouvel état via `update(notes)`, ce composant
 * ne fait que l'afficher et déclencher les mutations (js/domain/stickyNotes.js) au clic/glisser.
 * Renvoie `{ update(notes) }` ; rien à désinscrire ici (aucun écouteur global posé), seul le
 * conteneur DOM est concerné, nettoyé avec le reste de l'Accueil par l'appelant.
 */
export function mountBureau(container) {
  let currentNotes = [];
  // Suspend le rebuild du plan de travail complet (voir renderFullCanvas() plus bas) pendant
  // qu'un geste est en cours (glisser/redimensionner) OU qu'un champ a le focus (titre, texte
  // libre) — un rebuild en plein milieu détruirait l'élément en cours de manipulation ou de
  // frappe (perte du focus, du curseur, voire de l'écouteur `pointermove` actif). Une mise à jour
  // reçue pendant ce temps (un autre post-it modifié ailleurs, ou depuis un autre appareil) est
  // simplement rejouée dès la fin du geste/de la frappe (`pendingNotes`).
  let dragging = false;
  let focusedInside = false;
  let pendingNotes = null;
  // Plan de travail complet : n'existe plus en permanence dans l'Accueil, seulement pendant que la
  // modale "🧠 Mon bureau — Tout voir" est ouverte (voir openFullCanvasModal() plus bas). `null`
  // tant qu'elle est fermée — `renderFullCanvas()` ne fait alors rien.
  let fullCanvasEl = null;

  function shouldSuspend() {
    return dragging || focusedInside;
  }
  function maybeFlush() {
    if (shouldSuspend() || !pendingNotes) return;
    const notes = pendingNotes;
    pendingNotes = null;
    applyNotes(notes);
  }
  function beginDrag() {
    dragging = true;
  }
  function endDrag() {
    dragging = false;
    maybeFlush();
  }

  // Suit le focus À L'INTÉRIEUR de `scopeEl` (`focusin`/`focusout` remontent, contrairement à
  // `focus`/`blur`) pour ne suspendre le rebuild que pendant une VRAIE frappe en cours (titre,
  // texte libre, ligne de checklist — voir isEditableFocusTarget) — jamais pour un simple bouton.
  // BUG corrigé (23/09/2026, retour direct de Charles-Henri : "quand je clique pour changer le
  // type checklist/description, ou la couleur, ça ne le prend en compte que quand je clique en
  // dehors du post-it") : la version précédente suspendait le rebuild dès qu'un focus ATTEIGNAIT
  // n'importe quel élément du Bureau — y compris un simple bouton (bascule texte/checklist, "⋯").
  // Or un clic sur un `<button>` le rend focusé (comportement standard de Chrome), et le piège de
  // focus des modales (js/components/modal.js#openModal, "rendre le focus à l'élément qui l'avait
  // avant l'ouverture") RAMÈNE explicitement le focus sur ce même bouton "⋯" à la fermeture du
  // menu — donc après un changement de couleur/épingle/archive, le focus se retrouvait de nouveau
  // "dans" le Bureau au moment précis où la notification Firestore arrivait, suspendant
  // indéfiniment le rebuild jusqu'à ce qu'un clic extérieur fasse perdre ce focus.
  //
  // Posé sur `container` (couvre "+ Nouveau post-it"/"Archivés"/"Tout voir", aucun champ éditable)
  // ET, dynamiquement, sur le corps de la modale "Tout voir" tant qu'elle est ouverte (seul
  // endroit où vivent les vrais champs de saisie de ce composant) — voir openFullCanvasModal().
  function attachFocusTracking(scopeEl) {
    scopeEl.addEventListener("focusin", (e) => {
      focusedInside = isEditableFocusTarget(e.target);
    });
    scopeEl.addEventListener("focusout", () => {
      setTimeout(() => {
        focusedInside = isEditableFocusTarget(document.activeElement);
        maybeFlush();
      }, 50);
    });
  }

  // Retour direct de Charles-Henri (23/09/2026) :
  //  - "la zone Bureau soit [...] pliable/dépliable" — `<details open>`/`<summary>`, même
  //    convention que js/views/dashboard.js#renderKeptSection et les autres rubriques de
  //    l'Accueil. État de repli/dépli volontairement NON mémorisé d'une session à l'autre, comme
  //    pour ces mêmes rubriques — seule sa POSITION (`dashboardOrder`) et sa visibilité
  //    (`dashboardHidden`) sont des préférences persistées (déjà en place,
  //    js/views/dashboard.js#DASHBOARD_SECTIONS/HOME_ORDER_LABELS).
  //  - "un écran [...] avec l'ensemble des post-it et leur position enregistrée" via "Tout voir"
  //    — la manipulation complète (position libre, glisser-déposer, redimensionnement) reste
  //    réservée à la modale "🔍 Tout voir" (voir openFullCanvasModal() plus bas).
  //  - "voir [les épinglés] en priorité, n'importe où dans l'écran, au-dessus des autres modales"
  //    — ARBITRAGE REVU quelques minutes après la première livraison de ce même jour (retour
  //    direct de Charles-Henri) : la liste compacte des épinglés directement dans cette section
  //    (première version) ne suffisait pas, un post-it épinglé devait pouvoir sortir du cadre du
  //    Bureau et rester visible même par-dessus une autre modale ouverte ailleurs dans l'app. Cette
  //    section n'affiche donc plus la liste des épinglés (devenue redondante) : ils vivent
  //    désormais comme des widgets flottants (js/components/pinnedNotesOverlay.js, monté une seule
  //    fois pour toute la session comme le mini-minuteur Pomodoro), visibles quel que soit l'écran
  //    ouvert. Cette section garde seulement le point d'entrée (créer/archivés/tout voir).
  container.innerHTML = `
    <details open>
      <summary class="section-title" style="cursor:pointer;margin:0;">🧠 Mon bureau</summary>
      <div class="bureau-header" style="margin-top:8px;">
        <p class="item-meta" style="margin:0;flex:1 1 auto;min-width:200px;">Les post-it épinglés flottent directement sur ton écran, au-dessus de tout, où que tu sois dans l'app. "🔍 Tout voir" ouvre le plan de travail complet (position, glisser-déposer, redimensionnement).</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" id="bureau-archived-btn" class="btn btn-ghost btn-sm">🗄️ Archivés</button>
          <button type="button" id="bureau-see-all-btn" class="btn btn-ghost btn-sm">🔍 Tout voir</button>
          <button type="button" id="bureau-new-note-btn" class="btn btn-secondary btn-sm">+ Nouveau post-it</button>
        </div>
      </div>
    </details>
  `;
  const archivedBtn = container.querySelector("#bureau-archived-btn");
  const seeAllBtn = container.querySelector("#bureau-see-all-btn");
  const newNoteBtn = container.querySelector("#bureau-new-note-btn");

  attachFocusTracking(container);

  newNoteBtn.addEventListener(
    "click",
    guardClick(newNoteBtn, async () => {
      const maxZ = currentNotes.reduce((max, n) => Math.max(max, n.zIndex || 0), 0);
      // Décalage en cascade (retour visuel simple) — évite que chaque nouveau post-it s'empile
      // exactement sur le précédent, sans imposer de vraie disposition automatique (le besoin
      // reste "position libre", géré ensuite par le glisser, dans "🔍 Tout voir").
      const offset = (currentNotes.filter((n) => !n.archived).length % 6) * 24;
      // `pinned: true` (retour direct de Charles-Henri : "je dois toujours pouvoir créer un
      // post-it à la volée qui sera épinglé par défaut") — une capture rapide apparaît donc
      // immédiatement comme widget flottant (js/components/pinnedNotesOverlay.js), sans avoir
      // besoin d'ouvrir "🔍 Tout voir" ni de l'épingler soi-même après coup.
      await stickyNotesApi.createStickyNote({ x: 16 + offset, y: 16 + offset, zIndex: maxZ + 1, pinned: true });
    })
  );
  archivedBtn.addEventListener("click", () => openArchivedNotesModal());
  seeAllBtn.addEventListener("click", () => openFullCanvasModal());

  /**
   * "🔍 Tout voir" — modale reprenant l'ancien comportement plein du Bureau (tous les post-it non
   * archivés, position/taille libres, glisser-déposer, redimensionnement, menus, conversions).
   */
  function openFullCanvasModal() {
    const body = document.createElement("div");
    body.innerHTML = `<div class="bureau-canvas" id="bureau-full-canvas"></div>`;
    fullCanvasEl = body.querySelector("#bureau-full-canvas");
    attachFocusTracking(body);
    renderFullCanvas(currentNotes);
    openModal({
      title: "🧠 Mon bureau — Tout voir",
      body,
      actions: [{ label: "Fermer", variant: "ghost" }],
      // La modale se ferme — `fullCanvasEl` redevient `null` : plus rien à mettre à jour tant
      // qu'elle n'est pas rouverte (voir renderFullCanvas() plus bas, qui ne fait rien sinon).
      onClose: () => {
        fullCanvasEl = null;
      },
    });
  }

  /** Applique un nouvel état (notes) — met à jour le compteur d'archivés et le plan de travail
   *  complet (seulement si la modale "Tout voir" est ouverte, voir renderFullCanvas()). */
  function applyNotes(notes) {
    currentNotes = notes;
    const visible = notes.filter((n) => !n.archived);
    const archivedCount = notes.length - visible.length;
    archivedBtn.textContent = archivedCount ? `🗄️ Archivés (${archivedCount})` : "🗄️ Archivés";
    renderFullCanvas(notes);
  }

  /** Plan de travail COMPLET (tous les post-it non archivés, pas seulement les épinglés) — ne
   *  fait rien tant que la modale "🔍 Tout voir" n'est pas ouverte (`fullCanvasEl` alors `null`,
   *  voir openFullCanvasModal()). */
  function renderFullCanvas(notes) {
    if (!fullCanvasEl) return;
    const visible = notes.filter((n) => !n.archived);
    fullCanvasEl.innerHTML = "";
    for (const note of visible) {
      fullCanvasEl.appendChild(buildNoteEl(note));
    }
    recalcCanvasHeight();
  }

  function recalcCanvasHeight() {
    if (!fullCanvasEl) return;
    let maxBottom = 0;
    fullCanvasEl.querySelectorAll(".sticky-note").forEach((el) => {
      const bottom = el.offsetTop + el.offsetHeight;
      if (bottom > maxBottom) maxBottom = bottom;
    });
    fullCanvasEl.style.height = Math.max(320, maxBottom + 24) + "px";
  }

  /**
   * Un post-it épinglé garde toujours un z-index supérieur à tout post-it non épinglé DANS LE PLAN
   * DE TRAVAIL (voir le commentaire "Écarts assumés" en tête de fichier). `PIN_BOOST` est
   * arbitrairement plus grand que le nombre de post-it qu'un usage réel pourra jamais créer — une
   * constante finie, pas une garantie mathématique absolue.
   */
  const PIN_BOOST = 100000;
  function effectiveZ(note) {
    return (note.zIndex || 0) + (note.pinned ? PIN_BOOST : 0);
  }

  function buildNoteEl(note) {
    const el = document.createElement("div");
    el.className = `sticky-note sticky-note--${note.color}`;
    el.dataset.id = note.id;
    el.style.left = `${note.x}px`;
    el.style.top = `${note.y}px`;
    el.style.width = `${note.width}px`;
    el.style.height = `${note.height}px`;
    el.style.zIndex = String(effectiveZ(note));
    el.innerHTML = `
      <div class="sticky-note-header">
        ${note.pinned ? '<span class="sticky-note-pin" title="Épinglé">📌</span>' : ""}
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

    const headerEl = el.querySelector(".sticky-note-header");
    const titleInput = el.querySelector(".sticky-note-title-input");
    const menuBtn = el.querySelector(".sticky-note-menu-btn");
    const bodyEl = el.querySelector(".sticky-note-body");
    const resizeHandle = el.querySelector(".sticky-note-resize-handle");

    // Titre — même sauvegarde automatique (anti-rebond + immédiate à la perte de focus) que
    // l'ancien Pense-bête (js/views/dashboard.js#renderPostitSection, avant ce lot).
    let titleSaveTimer = null;
    titleInput.addEventListener("input", () => {
      clearTimeout(titleSaveTimer);
      titleSaveTimer = setTimeout(() => stickyNotesApi.setTitle(note.id, titleInput.value), 500);
    });
    titleInput.addEventListener("blur", () => {
      clearTimeout(titleSaveTimer);
      stickyNotesApi.setTitle(note.id, titleInput.value);
    });

    el.querySelectorAll(".sticky-note-mode-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.mode === note.type) return;
        stickyNotesApi.setType(note.id, btn.dataset.mode);
      });
    });

    // `onClose: openFullCanvasModal` — CORRECTIF (23/09/2026, repéré en écrivant les tests de ce
    // complément) : `openModal()` ne garde jamais qu'UNE modale à la fois (voir son commentaire,
    // "closeModal(); // une seule modale à la fois") — ouvrir ce menu alors que "Tout voir" est
    // déjà affiché referme donc "Tout voir" AVANT d'afficher le menu. Sans ce rappel, refermer le
    // menu (couleur/épingle/archive) renvoyait silencieusement sur l'Accueil au lieu de laisser
    // Charles-Henri continuer sur son plan de travail. Un effet de bord accepté : après une
    // conversion ou une suppression (qui ouvrent ELLES-MÊMES une autre modale par-dessus), "Tout
    // voir" se rouvre puis se referme aussitôt — un très bref réaffichage, sans conséquence
    // fonctionnelle, jugé préférable à dupliquer cette logique pour distinguer chaque cas.
    menuBtn.addEventListener("click", () => openStickyNoteMenu(note, { onClose: () => openFullCanvasModal() }));

    // Même correctif que ci-dessus, pour le menu "⋯" D'UNE LIGNE de checklist (conversion d'une
    // seule ligne) — voir js/components/stickyNoteShared.js#openLineConvertModal.
    renderNoteBody(bodyEl, note, { onLineConvertClose: () => openFullCanvasModal() });

    attachDrag(el, note, headerEl);
    attachResize(el, note, resizeHandle);

    return el;
  }

  /** Glisser par l'en-tête — Pointer Events (souris/tactile/stylet unifiés), voir le commentaire
   *  en tête de fichier. Ignoré si le geste démarre sur le titre ou le bouton "⋯" (tous deux à
   *  l'intérieur de l'en-tête) : ces deux-là doivent rester cliquables/éditables normalement. */
  function attachDrag(el, note, headerEl) {
    headerEl.addEventListener("pointerdown", (e) => {
      if (e.target.closest("input, button")) return;
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const startLeft = note.x;
      const startTop = note.y;
      const canvasWidth = fullCanvasEl.clientWidth || note.width;
      const maxZ = currentNotes.reduce((max, n) => Math.max(max, n.zIndex || 0), 0);
      const nextZ = maxZ + 1;
      el.style.zIndex = String(nextZ + (note.pinned ? PIN_BOOST : 0));
      let finalX = startLeft;
      let finalY = startTop;
      beginDrag();
      headerEl.setPointerCapture(e.pointerId);

      function onMove(ev) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const maxLeft = Math.max(0, canvasWidth - note.width);
        finalX = Math.max(0, Math.min(startLeft + dx, maxLeft));
        finalY = Math.max(0, startTop + dy);
        el.style.left = `${finalX}px`;
        el.style.top = `${finalY}px`;
        recalcCanvasHeight();
      }
      function onUp() {
        headerEl.removeEventListener("pointermove", onMove);
        headerEl.removeEventListener("pointerup", onUp);
        headerEl.removeEventListener("pointercancel", onUp);
        stickyNotesApi.setLayout(note.id, { x: finalX, y: finalY, zIndex: nextZ }).finally(endDrag);
      }
      headerEl.addEventListener("pointermove", onMove);
      headerEl.addEventListener("pointerup", onUp);
      headerEl.addEventListener("pointercancel", onUp);
    });
  }

  /** Poignée bas-droite — même mécanique Pointer Events que le glisser ci-dessus, largeur bornée
   *  à ne jamais faire déborder le post-it du plan de travail, hauteur libre (le plan de travail
   *  s'agrandit automatiquement, voir recalcCanvasHeight()). */
  function attachResize(el, note, handleEl) {
    handleEl.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = note.width;
      const startHeight = note.height;
      const canvasWidth = fullCanvasEl.clientWidth || note.width;
      let finalWidth = startWidth;
      let finalHeight = startHeight;
      beginDrag();
      handleEl.setPointerCapture(e.pointerId);

      function onMove(ev) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const maxWidth = Math.max(stickyNotesApi.MIN_WIDTH, canvasWidth - note.x);
        finalWidth = Math.max(stickyNotesApi.MIN_WIDTH, Math.min(startWidth + dx, maxWidth));
        finalHeight = Math.max(stickyNotesApi.MIN_HEIGHT, startHeight + dy);
        el.style.width = `${finalWidth}px`;
        el.style.height = `${finalHeight}px`;
        recalcCanvasHeight();
      }
      function onUp() {
        handleEl.removeEventListener("pointermove", onMove);
        handleEl.removeEventListener("pointerup", onUp);
        handleEl.removeEventListener("pointercancel", onUp);
        stickyNotesApi.setLayout(note.id, { width: finalWidth, height: finalHeight }).finally(endDrag);
      }
      handleEl.addEventListener("pointermove", onMove);
      handleEl.addEventListener("pointerup", onUp);
      handleEl.addEventListener("pointercancel", onUp);
    });
  }

  function openArchivedNotesModal() {
    const archived = currentNotes.filter((n) => n.archived);
    const body = document.createElement("div");
    if (!archived.length) {
      body.innerHTML = `<div class="empty-state" style="padding:16px;">Aucun post-it archivé.</div>`;
    } else {
      const list = document.createElement("div");
      list.className = "card";
      for (const note of archived) {
        const row = document.createElement("div");
        row.className = "item-row";
        const preview = stickyNotesApi.stickyNoteToText(note).slice(0, 80);
        row.innerHTML = `
          <div class="item-main">
            <div class="item-title">${escapeHtml(note.title || "Post-it sans titre")}</div>
            ${preview ? `<div class="item-meta">${escapeHtml(preview)}</div>` : ""}
          </div>
        `;
        const restoreBtn = document.createElement("button");
        restoreBtn.type = "button";
        restoreBtn.className = "btn btn-secondary btn-sm";
        restoreBtn.textContent = "↩️ Restaurer";
        restoreBtn.addEventListener("click", async () => {
          await stickyNotesApi.setArchived(note.id, false);
          closeModal();
          showToast("Post-it restauré");
        });
        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "btn btn-ghost btn-sm";
        deleteBtn.setAttribute("aria-label", "Supprimer définitivement");
        deleteBtn.title = "Supprimer définitivement";
        deleteBtn.textContent = "🗑️";
        deleteBtn.addEventListener("click", () => {
          confirmDelete({
            title: "Supprimer définitivement ce post-it ?",
            message: `« ${note.title || "Post-it sans titre"} » sera définitivement supprimé.`,
            onConfirm: async () => {
              await stickyNotesApi.removeStickyNote(note.id);
              showToast("Post-it supprimé");
            },
            onCancel: () => openArchivedNotesModal(),
          });
        });
        row.appendChild(restoreBtn);
        row.appendChild(deleteBtn);
        list.appendChild(row);
      }
      body.appendChild(list);
    }
    openModal({ title: `🗄️ Post-it archivés (${archived.length})`, body, actions: [{ label: "Fermer", variant: "ghost" }] });
  }

  function update(notes) {
    if (shouldSuspend()) {
      pendingNotes = notes;
      return;
    }
    applyNotes(notes);
  }

  return { update };
}

/** Vrai uniquement pour un champ de VRAIE saisie texte (titre, texte libre, ajout/édition d'une
 *  ligne de checklist — tous des `<input type="text">`/`<textarea>`) — jamais pour un bouton, une
 *  case à cocher ou tout autre élément focusable qui ne contient aucune frappe en cours à
 *  protéger. Voir le commentaire du 23/09/2026 sur focusin/focusout dans mountBureau(). */
function isEditableFocusTarget(el) {
  if (!(el instanceof HTMLElement)) return false;
  return el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && el.type === "text");
}
