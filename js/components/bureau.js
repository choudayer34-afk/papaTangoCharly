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
// Cycle d'imports avec js/views/dashboard.js (dashboard.js monte ce composant, ce composant
// importe openCreateDecisionModal depuis dashboard.js) : même principe qu'un cycle déjà existant
// et déjà en production entre js/views/dashboard.js et js/views/inbox.js (dashboard.js importe
// openQualifyChoice/openKeptItemDetail depuis inbox.js, qui importe lui-même
// openCreateMeetingModal/openCreateDecisionModal depuis dashboard.js) — sûr tant qu'aucune des
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
//  - "Épingler [...] reste toujours visible en premier" : sur un plan libre (x/y quelconques), il
//    n'existe pas de "première place" naturelle comme dans une liste — un post-it épinglé reçoit
//    un z-index plancher toujours au-dessus de tous les post-it non épinglés (jamais recouvert),
//    seule lecture qui garde un sens dans une disposition libre.
//  - "Bouton flottant + Nouveau post-it" devient un bouton normal ancré en haut de la section
//    "Mon bureau" (jamais `position: fixed`) : aucun bouton flottant par-dessus le contenu
//    n'existe ailleurs dans l'app (qui reste une simple page qui défile, bandeau de navigation du
//    bas mis à part), un vrai flottant risquerait de chevaucher ce bandeau ou une modale ouverte.
//  - Positionnement libre identique sur toutes les tailles d'écran (pas de repli "liste empilée"
//    sur mobile, non demandé explicitement) — la position/taille restent bornées à la largeur du
//    conteneur au moment du geste, la hauteur du plan de travail s'agrandit automatiquement pour
//    toujours laisser la place au post-it le plus bas.
import * as stickyNotesApi from "../domain/stickyNotes.js";
import * as inboxApi from "../domain/inbox.js";
import * as peopleApi from "../domain/people.js";
import { openCreateTaskModal } from "../views/kanban.js";
import { openCreateResourceModal } from "../views/resources.js";
import { openCreateFollowUpModal } from "../views/people.js";
import { openCreateDecisionModal } from "../views/dashboard.js";
import { openKeptItemDetail } from "../views/inbox.js";
import { renderChecklist } from "./checklist.js";
import { openModal, closeModal, confirmDelete, guardClick } from "./modal.js";
import { showToast } from "./toast.js";

const COLOR_LABELS = { yellow: "Jaune", blue: "Bleu", green: "Vert", pink: "Rose", purple: "Violet", gray: "Gris" };

// Choix de conversion (post-it entier ET ligne de checklist, voir plus bas) — même famille que
// js/views/inbox.js#QUALIFY_CHOICES, réduite aux 5 issues pertinentes ici (un post-it n'est
// jamais "archivé sans suite" par ce menu : l'action "🗄️ Archiver" existe déjà séparément, voir
// openNoteMenu ci-dessous, et "Réunion"/"Projet" ne font pas partie du besoin transmis).
const CONVERT_CHOICES = [
  { key: "task", emoji: "✅", label: "Tâche" },
  { key: "followup", emoji: "👀", label: "Suivi" },
  { key: "resource", emoji: "📎", label: "Ressource" },
  { key: "decision", emoji: "🗳️", label: "Décision" },
  { key: "kept", emoji: "🧠", label: "Information" },
];

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
  // Suspend le rebuild complet du plan de travail (voir renderAll() plus bas) pendant qu'un
  // geste est en cours (glisser/redimensionner) OU qu'un champ du Bureau a le focus (titre, texte
  // libre) — un rebuild en plein milieu détruirait l'élément en cours de manipulation ou de
  // frappe (perte du focus, du curseur, voire de l'écouteur `pointermove` actif). Une mise à jour
  // reçue pendant ce temps (un autre post-it modifié ailleurs, ou depuis un autre appareil) est
  // simplement rejouée dès la fin du geste/de la frappe (`pendingNotes`).
  let dragging = false;
  let focusedInside = false;
  let pendingNotes = null;

  function shouldSuspend() {
    return dragging || focusedInside;
  }
  function maybeFlush() {
    if (shouldSuspend() || !pendingNotes) return;
    const notes = pendingNotes;
    pendingNotes = null;
    renderAll(notes);
  }
  function beginDrag() {
    dragging = true;
  }
  function endDrag() {
    dragging = false;
    maybeFlush();
  }

  // Rubrique repliable comme les autres (retour de Charles-Henri, 23/09/2026 : "je voudrais que
  // la zone Bureau soit [...] pliable/dépliable") — même convention que
  // js/views/dashboard.js#renderKeptSection et les autres rubriques de l'Accueil (`<details
  // open>`/`<summary>`, ouverte par défaut, un clic sur le titre replie/déplie). État de
  // repli/dépli volontairement NON mémorisé d'une session à l'autre, comme pour ces mêmes
  // rubriques — seule sa POSITION (`dashboardOrder`) et sa visibilité (`dashboardHidden`) sont
  // des préférences persistées (voir js/views/dashboard.js#DASHBOARD_SECTIONS/HOME_ORDER_LABELS,
  // où "bureau" est déjà déplaçable/masquable exactement comme les autres rubriques).
  container.innerHTML = `
    <details open>
      <summary class="section-title" style="cursor:pointer;margin:0;">🧠 Mon bureau</summary>
      <div class="bureau-header" style="margin-top:8px;">
        <p class="item-meta" style="margin:0;flex:1 1 auto;min-width:200px;">Pas des tâches à piloter — un espace pour noter vite pendant une réunion, organiser visuellement, puis transformer en Tâche, Suivi, Ressource, Décision ou Information quand c'est prêt.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" id="bureau-archived-btn" class="btn btn-ghost btn-sm">🗄️ Archivés</button>
          <button type="button" id="bureau-new-note-btn" class="btn btn-secondary btn-sm">+ Nouveau post-it</button>
        </div>
      </div>
      <div class="bureau-canvas" id="bureau-canvas"></div>
    </details>
  `;
  const canvasEl = container.querySelector("#bureau-canvas");
  const archivedBtn = container.querySelector("#bureau-archived-btn");
  const newNoteBtn = container.querySelector("#bureau-new-note-btn");

  // BUG corrigé (23/09/2026, retour direct de Charles-Henri : "quand je clique pour changer le
  // type checklist/description, ou la couleur, ça ne le prend en compte que quand je clique en
  // dehors du post-it") : la version précédente suspendait le rebuild dès qu'un focus ATTEIGNAIT
  // n'importe quel élément du Bureau — y compris un simple bouton (bascule texte/checklist, "⋯").
  // Or un clic sur un `<button>` le rend focusé (comportement standard de Chrome), et le piège de
  // focus des modales (js/components/modal.js#openModal, "rendre le focus à l'élément qui l'avait
  // avant l'ouverture") RAMÈNE explicitement le focus sur ce même bouton "⋯" à la fermeture du
  // menu — donc après un changement de couleur/épingle/archive (fait via une modale), le focus se
  // retrouvait de nouveau "dans" le Bureau au moment précis où la notification Firestore
  // arrivait, suspendant indéfiniment le rebuild jusqu'à ce qu'un clic extérieur fasse perdre ce
  // focus. Seuls le TITRE et le texte libre (et l'ajout/l'édition d'une ligne de checklist)
  // contiennent une vraie frappe en cours qu'un rebuild détruirait — `isEditableFocusTarget` ne
  // suspend plus que pour ces champs-là, jamais pour un bouton.
  container.addEventListener("focusin", (e) => {
    focusedInside = isEditableFocusTarget(e.target);
  });
  container.addEventListener("focusout", () => {
    setTimeout(() => {
      focusedInside = container.contains(document.activeElement) && isEditableFocusTarget(document.activeElement);
      maybeFlush();
    }, 50);
  });

  newNoteBtn.addEventListener(
    "click",
    guardClick(newNoteBtn, async () => {
      const maxZ = currentNotes.reduce((max, n) => Math.max(max, n.zIndex || 0), 0);
      // Décalage en cascade (retour visuel simple) — évite que chaque nouveau post-it s'empile
      // exactement sur le précédent, sans imposer de vraie disposition automatique (le besoin
      // reste "position libre", géré ensuite par le glisser).
      const offset = (currentNotes.filter((n) => !n.archived).length % 6) * 24;
      // `pinned: true` (23/09/2026, retour direct de Charles-Henri : "je dois toujours pouvoir
      // créer un post-it à la volée qui sera épinglé par défaut") — une capture rapide reste donc
      // visible en priorité (z-index plancher, voir PIN_BOOST/effectiveZ plus bas) tant qu'on ne
      // l'a pas explicitement désépinglée depuis son menu "⋯".
      await stickyNotesApi.createStickyNote({ x: 16 + offset, y: 16 + offset, zIndex: maxZ + 1, pinned: true });
    })
  );
  archivedBtn.addEventListener("click", () => openArchivedNotesModal());

  function renderAll(notes) {
    currentNotes = notes;
    const visible = notes.filter((n) => !n.archived);
    const archivedCount = notes.length - visible.length;
    archivedBtn.textContent = archivedCount ? `🗄️ Archivés (${archivedCount})` : "🗄️ Archivés";
    canvasEl.innerHTML = "";
    for (const note of visible) {
      canvasEl.appendChild(buildNoteEl(note));
    }
    recalcCanvasHeight();
  }

  function recalcCanvasHeight() {
    let maxBottom = 0;
    canvasEl.querySelectorAll(".sticky-note").forEach((el) => {
      const bottom = el.offsetTop + el.offsetHeight;
      if (bottom > maxBottom) maxBottom = bottom;
    });
    canvasEl.style.height = Math.max(320, maxBottom + 24) + "px";
  }

  /**
   * Un post-it épinglé garde toujours un z-index supérieur à tout post-it non épinglé — voir le
   * commentaire "Écarts assumés" en tête de fichier. `PIN_BOOST` est arbitrairement plus grand
   * que le nombre de post-it qu'un usage réel pourra jamais créer — une constante finie, pas une
   * garantie mathématique absolue : elle suppose qu'aucun post-it n'atteindra jamais 100 000
   * glissers/redimensionnements cumulés sur un même compte (`zIndex` n'avance que de 1 par
   * geste, voir attachDrag/attachResize plus bas), une hypothèse jugée raisonnable pour un usage
   * personnel plutôt qu'une vraie borne infranchissable.
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

    menuBtn.addEventListener("click", () => openNoteMenu(note));

    renderNoteBody(bodyEl, note);

    attachDrag(el, note, headerEl);
    attachResize(el, note, resizeHandle);

    return el;
  }

  /**
   * `note.checklist` est mutée localement à chaque callback (même pattern que
   * js/views/kanban.js#openTaskDetail pour `task.checklist`) : `addChecklistItem` ne renvoie que
   * l'élément ajouté seul (écriture ciblée, voir js/domain/stickyNotes.js), les quatre autres
   * renvoient le tableau complet — reconstruit ici pour que `renderChecklist` puisse réafficher
   * IMMÉDIATEMENT le nouvel état, sans attendre le prochain aller-retour Firestore (qui finira de
   * toute façon par recréer cet élément avec la donnée serveur, via `update(notes)` plus haut).
   */
  function renderNoteBody(bodyEl, note) {
    if (note.type === "checklist") {
      renderChecklist(bodyEl, note.checklist || [], {
        emptyLabel: "Rien de noté pour l'instant.",
        sortDoneToBottom: true,
        onAdd: async (text) => {
          const item = await stickyNotesApi.addChecklistItem(note.id, text);
          note.checklist = item ? [...(note.checklist || []), item] : note.checklist;
          return note.checklist;
        },
        onToggle: async (itemId, done) => {
          note.checklist = await stickyNotesApi.toggleChecklistItem(note.id, itemId, done);
          return note.checklist;
        },
        onRemove: async (itemId) => {
          note.checklist = await stickyNotesApi.removeChecklistItem(note.id, itemId);
          return note.checklist;
        },
        onEdit: async (itemId, text) => {
          note.checklist = (await stickyNotesApi.editChecklistItem(note.id, itemId, text)) || note.checklist;
          return note.checklist;
        },
        onReorder: async (orderedIds) => {
          note.checklist = await stickyNotesApi.reorderChecklist(note.id, orderedIds);
          return note.checklist;
        },
        // "Conversion d'une seule ligne (Checklist)" (spec transmise, §"Conversion intelligente")
        // — voir le commentaire d'onLineMenu dans js/components/checklist.js.
        onLineMenu: (item) => openLineConvertModal(note, item),
      });
    } else {
      bodyEl.innerHTML = `<textarea class="sticky-note-textarea" placeholder="Écris ici...">${escapeHtml(note.content)}</textarea>`;
      const textarea = bodyEl.querySelector(".sticky-note-textarea");
      let contentSaveTimer = null;
      textarea.addEventListener("input", () => {
        clearTimeout(contentSaveTimer);
        contentSaveTimer = setTimeout(() => stickyNotesApi.setContent(note.id, textarea.value), 500);
      });
      textarea.addEventListener("blur", () => {
        clearTimeout(contentSaveTimer);
        stickyNotesApi.setContent(note.id, textarea.value);
      });
    }
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
      const canvasWidth = canvasEl.clientWidth || note.width;
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
      const canvasWidth = canvasEl.clientWidth || note.width;
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

  /** Menu "⋯" d'un post-it — Épingler/Désépingler, couleur, Archiver, Supprimer, puis
   *  "Transformer en" (post-it ENTIER, voir CONVERT_CHOICES). */
  function openNoteMenu(note) {
    const body = document.createElement("div");
    body.innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
        <button type="button" id="note-menu-pin" class="btn btn-secondary btn-sm">${note.pinned ? "📌 Désépingler" : "📌 Épingler"}</button>
        <button type="button" id="note-menu-archive" class="btn btn-secondary btn-sm">🗄️ Archiver</button>
        <button type="button" id="note-menu-delete" class="btn btn-danger btn-sm">🗑️ Supprimer</button>
      </div>
      <div class="section-title" style="margin-top:0;">🎨 Couleur</div>
      <div class="chip-row" id="note-menu-colors" style="margin-bottom:16px;">
        ${stickyNotesApi.COLORS.map(
          (c) =>
            `<button type="button" class="chip sticky-color-swatch sticky-note--${c}${c === note.color ? " active" : ""}" data-color="${c}" aria-label="${COLOR_LABELS[c]}" title="${COLOR_LABELS[c]}"></button>`
        ).join("")}
      </div>
      <div class="section-title">🔀 Transformer en</div>
      <div class="choice-grid" id="note-menu-convert"></div>
    `;
    body.querySelector("#note-menu-pin").addEventListener("click", async () => {
      await stickyNotesApi.togglePin(note.id, !note.pinned);
      closeModal();
    });
    body.querySelector("#note-menu-archive").addEventListener("click", async () => {
      await stickyNotesApi.setArchived(note.id, true);
      closeModal();
      showToast("Post-it archivé");
    });
    body.querySelector("#note-menu-delete").addEventListener("click", () => {
      closeModal();
      confirmDelete({
        title: "Supprimer ce post-it ?",
        message: `« ${note.title || "Post-it sans titre"} » sera définitivement supprimé.`,
        onConfirm: async () => {
          await stickyNotesApi.removeStickyNote(note.id);
          showToast("Post-it supprimé");
        },
      });
    });
    body.querySelectorAll("#note-menu-colors .sticky-color-swatch").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await stickyNotesApi.setColor(note.id, btn.dataset.color);
        closeModal();
      });
    });
    body.querySelector("#note-menu-convert").appendChild(
      buildConvertChoiceGrid((key) => {
        closeModal();
        convertWholeNote(note, key);
      })
    );
    openModal({ title: note.title || "📝 Post-it", body, actions: [{ label: "Fermer", variant: "ghost" }] });
  }

  function buildConvertChoiceGrid(onChoose) {
    const grid = document.createElement("div");
    grid.className = "choice-grid";
    for (const choice of CONVERT_CHOICES) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice-btn";
      btn.innerHTML = `<span class="emoji">${choice.emoji}</span> ${choice.label}`;
      btn.addEventListener("click", () => onChoose(choice.key));
      grid.appendChild(btn);
    }
    return grid;
  }

  /**
   * Conversion du post-it ENTIER (spec : "Conversion du post-it entier — depuis le menu ⋯ du
   * post-it") — préremplit le formulaire cible avec le titre du post-it et son contenu (texte
   * libre, ou chaque ligne de la checklist mise à plat, voir stickyNotesApi.stickyNoteToText).
   * Décision d'implémentation (à documenter, pas bloquante) : le post-it source est ARCHIVÉ (pas
   * supprimé) une fois la fiche cible créée — jamais perdu, retrouvable dans "🗄️ Post-it
   * archivés" si besoin, cohérent avec Règle 3 de l'app ("ne jamais perdre une capture").
   */
  async function convertWholeNote(note, key) {
    const title = note.title || "Post-it";
    const text = stickyNotesApi.stickyNoteToText(note);
    const afterCreate = () => stickyNotesApi.setArchived(note.id, true);
    if (key === "task") {
      openCreateTaskModal({ title, description: text, createdToast: "Tâche créée", onCreated: afterCreate });
    } else if (key === "followup") {
      const people = await peopleApi.listAll();
      if (!people.length) {
        showToast("Ajoute d'abord une personne dans l'onglet Équipe pour créer un suivi");
        return;
      }
      openCreateFollowUpModal({ defaultTitle: title, defaultDescription: text, onCreated: afterCreate });
    } else if (key === "resource") {
      openCreateResourceModal({ title, description: text, onCreated: afterCreate });
    } else if (key === "decision") {
      // Écart assumé (déjà repéré au cadrage de ce lot, pas de champ "description" générique côté
      // Décision) : le contenu du post-it part dans "Contexte", "Ce qui a été décidé" reste vide
      // — Charles-Henri le complète lui-même, une vraie décision ne se déduit pas d'une note.
      openCreateDecisionModal({ title, context: text, onCreated: afterCreate });
    } else if (key === "kept") {
      await convertToInformation(title, text, afterCreate);
    }
  }

  /**
   * Conversion d'une SEULE ligne de checklist (spec : "Conversion d'une seule ligne (Checklist)")
   * — seule cette ligne alimente le formulaire, le reste de la checklist n'est jamais touché tant
   * que la fiche n'est pas créée ; une fois créée, SEULE cette ligne est retirée (jamais tout le
   * post-it), conformément à la spec ("le reste de la checklist reste intact").
   */
  function openLineConvertModal(note, item) {
    const body = document.createElement("div");
    body.appendChild(
      buildConvertChoiceGrid((key) => {
        closeModal();
        convertLine(note, item, key);
      })
    );
    openModal({ title: "Créer depuis cette ligne", body, actions: [{ label: "Annuler", variant: "ghost" }] });
  }

  async function convertLine(note, item, key) {
    const text = item.text;
    const afterCreate = () => stickyNotesApi.removeChecklistItem(note.id, item.id);
    if (key === "task") {
      openCreateTaskModal({ title: text, createdToast: "Tâche créée", onCreated: afterCreate });
    } else if (key === "followup") {
      const people = await peopleApi.listAll();
      if (!people.length) {
        showToast("Ajoute d'abord une personne dans l'onglet Équipe pour créer un suivi");
        return;
      }
      openCreateFollowUpModal({ defaultTitle: text, onCreated: afterCreate });
    } else if (key === "resource") {
      openCreateResourceModal({ title: text, onCreated: afterCreate });
    } else if (key === "decision") {
      openCreateDecisionModal({ title: text, onCreated: afterCreate });
    } else if (key === "kept") {
      await convertToInformation(text, "", afterCreate);
    }
  }

  /**
   * "Information" n'a jamais de formulaire de création dédié nulle part dans l'app (une
   * Information/Idée est structurellement un InboxItem qualifié "kept", voir
   * js/domain/inbox.js#qualify) — même chemin que js/views/inbox.js#handleChoice pour ce même
   * choix : capture directe puis qualification immédiate, la fiche complète s'ouvre ensuite
   * plutôt qu'un simple toast, pour rester cohérent avec le reste de l'app.
   */
  async function convertToInformation(title, text, afterCreate) {
    const content = text && text.trim() ? text : title;
    const item = await inboxApi.capture(content, "post-it");
    await inboxApi.qualify(item.id, "kept");
    await afterCreate();
    openKeptItemDetail({ ...item, status: "kept", keptAsType: "kept" });
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
    renderAll(notes);
  }

  return { update };
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

/** Vrai uniquement pour un champ de VRAIE saisie texte (titre, texte libre, ajout/édition d'une
 *  ligne de checklist — tous des `<input type="text">`/`<textarea>`) — jamais pour un bouton, une
 *  case à cocher ou tout autre élément focusable qui ne contient aucune frappe en cours à
 *  protéger. Voir le commentaire du 23/09/2026 sur focusin/focusout dans mountBureau(). */
function isEditableFocusTarget(el) {
  if (!(el instanceof HTMLElement)) return false;
  return el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && el.type === "text");
}
