// Sous-étapes courtes libres (retour de Charles-Henri, 01/09/2026 — piste TDAH : "next
// physical action" claire + petits pas cochables plutôt qu'une seule grosse tâche opaque).
// Distinct du canevas à cases fixes (js/components/canevas.js, js/domain/templates.js) : ici,
// aucune case n'est prédéfinie — Charles-Henri tape lui-même chaque sous-étape, sur
// n'importe quelle Tâche, pas seulement les tâches de type "communication".
//
// `items` est un tableau `{id, text, done, doneAt}` déjà chargé par l'appelant ; `onAdd(text)`,
// `onToggle(itemId, done)` et `onRemove(itemId)` doivent persister côté domaine
// (js/domain/tasks.js, js/domain/followups.js) et renvoyer le tableau à jour, même principe
// que renderNotesBlock().
//
// `doneAt` (retour de Charles-Henri, vague 21 : "quand je coche un élément de la checklist, la
// date de coche doit être enregistrée... pour toutes les checklists") — horodaté par l'appelant
// au moment du `onToggle` (même principe que `toggleStep()` dans js/domain/projects.js),
// affiché ici à côté de chaque élément coché.
//
// `sortDoneToBottom`/`onClearDone` (retour de Charles-Henri, 14/09/2026, sur le Pense-bête
// uniquement : "dès qu'on coche qqch, l'élément coché doit se positionner en bas de la liste
// [...] un bouton [...] pour supprimer d'un coup tout ce qui est coché") — deux options
// désactivées par défaut, pour ne rien changer aux checklists de Tâche/Suivi (js/views/kanban.js,
// js/views/people.js) qui ne les passent pas : leur ordre reste celui dans lequel les sous-étapes
// ont été tapées, sans bouton de purge groupée, comme avant ce patch.
//
// (22/09/2026, retour direct de Charles-Henri) — `sortDoneToBottom` est désormais également
// activé sur les checklists de Tâche (`js/views/kanban.js#openTaskDetail`) et de Suivi
// (`js/views/people.js#openEditFollowUpModal`) : "idem pour les étapes, quand je coche une
// étape, les étapes cochées se mettent après les non cochées et se trient du plus récent au
// plus ancien." Le tri du groupe "coché" par date de coche décroissante (`doneAt`, déjà
// horodaté par l'appelant à chaque coche — voir plus haut) est nouveau à cette occasion :
// jusqu'ici `sortDoneToBottom` ne faisait que déplacer le groupe coché en bas, en conservant son
// ordre d'origine à l'intérieur du groupe (voir `sortChecklistForDisplay` ci-dessous, exportée
// pour être réutilisée à l'identique par le mini-aperçu de la carte Kanban, qui n'utilise pas ce
// composant). Le groupe "non coché" garde son ordre d'origine (aucune autre date pertinente à y
// appliquer), sans changement de comportement pour lui.
//
// Bouton "+" compact plutôt que "+ Ajouter" en toutes lettres (retour de Charles-Henri,
// 14/09/2026 : "le + ajouter sort de la modale, il faudrait juste un + à côté du champ") — ce
// composant vit aussi dans des modales de largeur contrainte (fiche Tâche/Suivi) où le bouton
// texte débordait. Le libellé du champ passe au passage de "sous-étape" à "élément" (même retour
// de Charles-Henri), plus neutre pour les trois usages (sous-étapes de Tâche/Suivi, notes libres
// du Pense-bête).
//
// `onLineMenu` (LOT 13, TODO-027, 22/09/2026 — "Bureau : post-it libres") — troisième option
// OPTIONNELLE, réservée aux post-it Checklist du Bureau (js/components/bureau.js) : un bouton
// "⋯" par ligne, qui ouvre le menu de conversion ligne par ligne ("Créer une Tâche / un Suivi /
// une Ressource / une Décision / une Information" à partir de CETTE seule ligne — voir la spec
// "Conversion d'une seule ligne (Checklist)"). Absent des trois usages existants (Tâche, Suivi,
// Pense-bête, ce dernier disparaissant de toute façon avec ce lot) : convertir une sous-étape de
// Tâche/Suivi en une autre fiche n'a jamais fait partie du besoin, seul le Bureau le demande.
// `onLineMenu(item)` reçoit l'élément cliqué ; à charge de l'appelant d'ouvrir son propre menu
// (aucune valeur de retour attendue, contrairement aux autres callbacks ci-dessous qui persistent
// puis renvoient le tableau à jour).
//
// `onEdit`/`onReorder` (22/09/2026, retour direct de Charles-Henri : "si je me suis trompé dans
// le nom d'une sous étape, je suis aujourd'hui obligé de supprimer et de le réécrire. je ne peux
// pas le modifier ni ordonner les sous étapes non terminées") — deux options OPTIONNELLES,
// activées sur les trois usages existants (Tâche, Suivi, Pense-bête) puisque la limitation
// touchait les trois de la même façon :
//  - `onEdit(itemId, newText)` : un bouton "✏️" transforme le texte en champ éditable (Entrée ou
//    perte de focus valide, Échap annule) — même principe d'édition en place que partout ailleurs
//    dans l'app (ex. renommer un tag), jamais de modale dédiée pour un simple texte.
//  - `onReorder(orderedIds)` : deux boutons ▲/▼ (réutilisant tels quels `.kanban-move-btn`, déjà
//    stylés et déjà dotés d'une zone cliquable élargie à 44px — LOT 9/TODO-017 — sans dupliquer
//    de CSS) permettent de monter/descendre un élément NON coché parmi les autres non cochés.
//    Volontairement UNIQUEMENT sur les éléments non cochés : les éléments cochés sont de toute
//    façon reclassés automatiquement par date de coche dès que `sortDoneToBottom` est actif (voir
//    plus haut), un ordre manuel n'y aurait aucun sens. `orderedIds` est la liste des identifiants
//    des éléments non cochés dans le nouvel ordre souhaité ; à charge de l'appelant (voir
//    js/domain/tasks.js#reorderChecklist / js/domain/followups.js#reorderChecklist) de
//    reconstituer le tableau complet en conservant les éléments cochés à leur place.

//
// `compactActions` (06/10/2026, retour direct de Charles-Henri sur les POST-IT : "je n'aime pas les
// boutons de navigation sur les éléments, ils rendent le post-it encore plus large pour les voir
// entièrement, les boutons prennent plus de la moitié du post-it") — option OPTIONNELLE, activée
// UNIQUEMENT par js/components/stickyNoteShared.js#renderNoteBody (post-it du plan de travail et
// widgets flottants) ; les checklists de Tâche/Suivi gardent leurs boutons ▲/▼/✏️/✕ inchangés.
// En mode compact, une ligne = case + texte (toute la largeur, texte entier visible), RIEN d'autre :
//  - clic/toucher sur le TEXTE : ouvre, sous la ligne et pour CETTE ligne seulement, une petite
//    barre d'actions (✏️ Modifier · 📋 Créer… [= créer une fiche depuis cette ligne] · 🗑️ Supprimer — libellés courts pour tenir sur UNE ligne dans un post-it étroit) — un second clic sur
//    le texte, ou un clic sur le texte d'une autre ligne, la referme/la déplace.
//  - maintien appuyé sur la ligne (souris : clic maintenu ; mobile : appui long) PUIS glissement :
//    déplace l'élément parmi les autres éléments NON cochés (même règle que ▲/▼ avant : les cochés
//    sont reclassés automatiquement, voir `sortDoneToBottom`). La liste se réordonne en direct sous
//    le doigt/le curseur ; `onReorder(orderedIds)` n'est appelé qu'UNE fois, au relâchement, avec le
//    même contrat que pour ▲/▼ — aucun changement côté appelant ni côté domaine.
// La barre d'actions reprend le bouton "Créer…" avec la classe `checklist-line-menu-btn` : c'est ce
// qui permet à js/components/pinnedNotesOverlay.js de continuer à détecter, par délégation, l'ouverture
// de la modale de conversion et de masquer la carte flottante le temps de sa chaîne de modales.

import { guardClick } from "./modal.js";

/**
 * Tri d'affichage partagé (voir le commentaire du 22/09/2026 plus haut) : non cochés d'abord
 * (ordre d'origine préservé), puis cochés, triés par date de coche la plus récente en premier
 * (`doneAt` décroissant — les éléments cochés sans `doneAt`, cas hérité d'avant son introduction
 * en vague 21, restent groupés à la fin de ce sous-groupe plutôt que de faire planter le tri).
 * Exportée pour être réutilisée telle quelle par `js/views/kanban.js#renderCard` (mini-aperçu de
 * checklist sur la carte, qui n'appelle pas `renderChecklist` ci-dessous).
 */
export function sortChecklistForDisplay(items) {
  const notDone = items.filter((it) => !it.done);
  const done = [...items.filter((it) => it.done)].sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  return [...notDone, ...done];
}

export function renderChecklist(
  container,
  items,
  { onAdd, onToggle, onRemove, onEdit, onReorder, onClearDone, onLineMenu, sortDoneToBottom = false, compactActions = false, emptyLabel = "Pas encore de sous-étape." } = {}
) {
  let current = items || [];
  // Mode compact uniquement (voir `compactActions` en tête de fichier) : identifiant de la ligne dont
  // la barre d'actions est actuellement ouverte (une seule à la fois), `null` si aucune.
  let activeId = null;
  // Glisser-déposer du mode compact (voir setupRowDrag plus bas) : déclarés ICI, avant tout appel,
  // pour ne jamais dépendre de l'ordre d'exécution (const/let ne sont pas remontés comme les fonctions).
  const LONG_PRESS_MS = 350;
  const MOVE_TOLERANCE_PX = 8; // avant l'appui long : au-delà, c'est un défilement/balayage, pas un appui
  const EDGE_SCROLL_PX = 32;
  let drag = null;
  let suppressTapUntil = 0;
  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
      <input id="checklist-new-text" type="text" placeholder="Ajouter un élément..." style="flex:1;min-width:0;border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:var(--space-3);" />
      <button type="button" id="checklist-add-btn" class="checklist-add-btn" aria-label="Ajouter un élément" title="Ajouter un élément">+</button>
    </div>
    ${onClearDone ? `<div id="checklist-clear-done-row" style="margin-bottom:8px;"></div>` : ""}
    <div id="checklist-items"></div>
  `;

  const listEl = container.querySelector("#checklist-items");
  if (compactActions && onReorder) setupRowDrag();
  const clearDoneRowEl = container.querySelector("#checklist-clear-done-row");

  function renderClearDoneButton() {
    if (!clearDoneRowEl) return;
    const doneCount = current.filter((it) => it.done).length;
    // Masqué tant que rien n'est coché — jamais un bouton mort en permanence sur le Pense-bête.
    if (!doneCount) {
      clearDoneRowEl.innerHTML = "";
      return;
    }
    clearDoneRowEl.innerHTML = `<button type="button" id="checklist-clear-done-btn" class="btn btn-ghost btn-sm">🗑️ Supprimer les cochés (${doneCount})</button>`;
    clearDoneRowEl.querySelector("#checklist-clear-done-btn").addEventListener("click", async () => {
      const updated = await onClearDone();
      current = updated || current;
      renderList();
    });
  }

  function renderList() {
    renderClearDoneButton();
    if (!current.length) {
      listEl.innerHTML = `<div class="empty-state" style="padding:12px;">${emptyLabel}</div>`;
      return;
    }
    // Les éléments cochés descendent en bas de la liste, triés entre eux par date de coche la
    // plus récente en premier (retour de Charles-Henri, 14/09/2026 puis 22/09/2026 — voir le
    // commentaire en tête de ce fichier) — voir `sortChecklistForDisplay` ci-dessus.
    const visible = sortDoneToBottom ? sortChecklistForDisplay(current) : current;
    // Ordre des éléments NON cochés tel qu'affiché — c'est cet ordre que `onReorder` fait
    // évoluer (voir le commentaire en tête de fichier) : identique que `sortDoneToBottom` soit
    // actif ou non, puisque le groupe non coché garde toujours son ordre d'origine dans les deux
    // cas (voir `sortChecklistForDisplay`).
    const notDoneIds = visible.filter((it) => !it.done).map((it) => it.id);
    listEl.innerHTML = "";
    for (const item of visible) {
      const row = document.createElement("div");
      row.className = "checklist-item";
      row.dataset.itemId = item.id;
      row.innerHTML = `
        <input type="checkbox" ${item.done ? "checked" : ""} aria-label="${escapeAttr(item.text)}" />
        <span class="checklist-item-text${item.done ? " done" : ""}">${escapeHtml(item.text)}</span>
        ${item.done && item.doneAt ? `<span class="checklist-item-date">✓ ${formatDoneAt(item.doneAt)}</span>` : ""}
      `;
      const textSpan = row.querySelector(".checklist-item-text");

      // ▲/▼ — uniquement sur les éléments non cochés (voir le commentaire en tête de fichier) et
      // seulement quand l'appelant fournit `onReorder`.
      if (!compactActions && onReorder && !item.done) {
        const pos = notDoneIds.indexOf(item.id);
        const upBtn = document.createElement("button");
        upBtn.type = "button";
        upBtn.className = "kanban-move-btn";
        upBtn.setAttribute("aria-label", "Monter");
        upBtn.title = "Monter";
        upBtn.textContent = "▲";
        if (pos <= 0) upBtn.disabled = true;
        const downBtn = document.createElement("button");
        downBtn.type = "button";
        downBtn.className = "kanban-move-btn";
        downBtn.setAttribute("aria-label", "Descendre");
        downBtn.title = "Descendre";
        downBtn.textContent = "▼";
        if (pos < 0 || pos >= notDoneIds.length - 1) downBtn.disabled = true;
        async function move(direction) {
          const from = notDoneIds.indexOf(item.id);
          const to = direction === "up" ? from - 1 : from + 1;
          if (from < 0 || to < 0 || to >= notDoneIds.length) return;
          const reordered = [...notDoneIds];
          [reordered[from], reordered[to]] = [reordered[to], reordered[from]];
          const updated = await onReorder(reordered);
          current = updated || current;
          renderList();
        }
        upBtn.addEventListener("click", () => move("up"));
        downBtn.addEventListener("click", () => move("down"));
        row.appendChild(upBtn);
        row.appendChild(downBtn);
      }

      // ✏️ — édition en place du texte (retour de Charles-Henri, 22/09/2026 : "je suis obligé de
      // supprimer et de le réécrire") : jamais de modale pour un simple texte, même principe
      // qu'ailleurs dans l'app pour renommer un élément court.
      if (!compactActions && onEdit) {
        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "btn btn-ghost btn-sm";
        editBtn.setAttribute("aria-label", "Modifier cet élément");
        editBtn.title = "Modifier cet élément";
        editBtn.textContent = "✏️";
        editBtn.addEventListener("click", () => startEdit(item, textSpan));
        row.appendChild(editBtn);
      }

      // "⋯" — menu de conversion de cette seule ligne (voir le commentaire en tête de fichier),
      // avant le bouton de suppression pour ne jamais changer la position de ce dernier sur les
      // trois usages existants qui ne passent pas `onLineMenu`.
      if (!compactActions && onLineMenu) {
        const lineMenuBtn = document.createElement("button");
        lineMenuBtn.type = "button";
        // `checklist-line-menu-btn` (complément du 28/09/2026) — classe dédiée, en plus des classes
        // visuelles existantes, uniquement pour que js/components/pinnedNotesOverlay.js puisse
        // repérer ce bouton précis par délégation d'événement (sans dépendre du texte de
        // l'aria-label, plus fragile) — voir son commentaire sur la carte flottante éditée en
        // place, qui doit savoir masquer/réafficher toute la carte le temps de CETTE modale.
        lineMenuBtn.className = "btn btn-ghost btn-sm checklist-line-menu-btn";
        lineMenuBtn.setAttribute("aria-label", "Créer une fiche à partir de cette ligne");
        lineMenuBtn.title = "Créer une fiche à partir de cette ligne";
        lineMenuBtn.textContent = "⋯";
        lineMenuBtn.addEventListener("click", () => onLineMenu(item));
        row.appendChild(lineMenuBtn);
      }

      async function removeItem() {
        const updated = await onRemove(item.id);
        current = updated || current;
        renderList();
      }
      if (!compactActions) {
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "btn btn-ghost btn-sm";
        removeBtn.setAttribute("aria-label", "Retirer cet élément");
        removeBtn.textContent = "✕";
        row.appendChild(removeBtn);
        removeBtn.addEventListener("click", removeItem);
      } else {
        decorateCompactRow(row, item, textSpan, removeItem, !item.done && !!onReorder);
      }

      row.querySelector('input[type="checkbox"]').addEventListener("change", async (e) => {
        const updated = await onToggle(item.id, e.target.checked);
        current = updated || current;
        renderList();
      });
      listEl.appendChild(row);
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Mode compact (post-it) — voir `compactActions` en tête de fichier.
  // ---------------------------------------------------------------------------------------------

  /** Texte cliquable + barre d'actions sous la ligne active + ligne glissable (non cochée). */
  function decorateCompactRow(row, item, textSpan, removeItem, draggable) {
    row.classList.add("checklist-item--compact");
    if (draggable) row.classList.add("checklist-item--draggable");
    const isActive = item.id === activeId;
    if (isActive) row.classList.add("checklist-item--active");
    textSpan.classList.add("checklist-item-text--tappable");
    textSpan.tabIndex = 0;
    textSpan.setAttribute("role", "button");
    textSpan.setAttribute("aria-expanded", isActive ? "true" : "false");
    function toggleActions() {
      // Un relâchement de glisser-déposer ne doit jamais compter comme un clic sur le texte.
      if (Date.now() < suppressTapUntil) return;
      activeId = isActive ? null : item.id;
      renderList();
    }
    textSpan.addEventListener("click", toggleActions);
    textSpan.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleActions();
      }
    });
    if (!isActive) return;

    const bar = document.createElement("div");
    bar.className = "checklist-item-actions";
    if (onEdit) {
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn btn-ghost btn-sm";
      editBtn.textContent = "✏️ Modifier";
      editBtn.addEventListener("click", () => {
        activeId = null;
        bar.remove();
        row.classList.remove("checklist-item--active");
        startEdit(item, textSpan);
      });
      bar.appendChild(editBtn);
    }
    if (onLineMenu) {
      const createBtn = document.createElement("button");
      createBtn.type = "button";
      // `checklist-line-menu-btn` : voir le commentaire de `compactActions` en tête de fichier.
      createBtn.className = "btn btn-ghost btn-sm checklist-line-menu-btn";
      createBtn.setAttribute("aria-label", "Créer une fiche à partir de cette ligne");
      createBtn.title = "Créer une fiche à partir de cette ligne";
      createBtn.textContent = "📋 Créer…";
      createBtn.addEventListener("click", () => onLineMenu(item));
      bar.appendChild(createBtn);
    }
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn btn-ghost btn-sm";
    delBtn.setAttribute("aria-label", "Retirer cet élément");
    delBtn.title = "Supprimer cette ligne";
    delBtn.textContent = "🗑️";
    delBtn.addEventListener("click", removeItem);
    bar.appendChild(delBtn);
    row.appendChild(bar);
  }

  // Glisser-déposer par appui maintenu (souris : clic maintenu ; tactile : appui long). Un seul
  // glissement à la fois, état partagé dans `drag`. Les écouteurs `document` ne sont posés que le
  // temps d'un appui (pointerdown → pointerup/pointercancel) : rien ne traîne entre deux gestes.
  function setupRowDrag() {
    // Un `touchmove` NON passif, posé une fois sur la liste (jamais recréé par renderList), est ce qui
    // permet d'empêcher le défilement du post-it PENDANT un glissement actif sans l'empêcher le reste
    // du temps (le gestionnaire ne fait rien tant que `drag.active` est faux). Un écouteur ajouté
    // seulement au moment de l'appui long arriverait trop tard pour certains navigateurs mobiles,
    // qui décident dès le début du geste s'ils attendent ou non le thread principal.
    listEl.addEventListener(
      "touchmove",
      (e) => {
        if (drag?.active && e.cancelable) e.preventDefault();
      },
      { passive: false }
    );
    listEl.addEventListener("contextmenu", (e) => {
      // L'appui long tactile ouvre sinon le menu contextuel/la sélection de texte du navigateur.
      if (drag && e.target.closest(".checklist-item--draggable")) e.preventDefault();
    });
    listEl.addEventListener("pointerdown", (e) => {
      const row = e.target.closest(".checklist-item--draggable");
      if (!row || drag) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      // Cases à cocher, champ de modification, boutons : jamais le début d'un glissement.
      if (e.target.closest("input, textarea, button")) return;
      drag = {
        row,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        lastY: e.clientY,
        active: false,
        moved: false,
        rafId: 0,
        timer: setTimeout(activateDrag, LONG_PRESS_MS),
      };
      document.addEventListener("pointermove", onDragMove);
      document.addEventListener("pointerup", onDragEnd);
      document.addEventListener("pointercancel", onDragCancel);
    });
  }

  function activateDrag() {
    if (!drag || !drag.row.isConnected) return endDrag();
    drag.active = true;
    drag.row.classList.add("checklist-item--dragging");
    listEl.classList.add("checklist-items--dragging");
    drag.rafId = requestAnimationFrame(autoScrollTick);
  }

  function onDragMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!drag.active) {
      // Avant l'appui long : un déplacement notable = défilement ou balayage, on abandonne.
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > MOVE_TOLERANCE_PX) endDrag();
      return;
    }
    if (!drag.row.isConnected) return endDrag();
    drag.lastY = e.clientY;
    if (Math.abs(e.clientY - drag.startY) > 3) drag.moved = true;
    repositionDraggedRow(e.clientY);
  }

  // Place la ligne glissée à l'endroit déduit de la position du pointeur : devant la première ligne
  // (non cochée, autre que la sienne) dont le milieu est sous le pointeur, sinon après la dernière.
  // Comparer aux seules AUTRES lignes (qui ne bougent pas entre elles) garantit qu'aucun va-et-vient
  // n'apparaît, même quand les lignes ont des hauteurs différentes (texte sur plusieurs lignes).
  function repositionDraggedRow(y) {
    const others = [...listEl.querySelectorAll(".checklist-item--draggable")].filter((r) => r !== drag.row);
    const before = others.find((r) => {
      const rect = r.getBoundingClientRect();
      return y < rect.top + rect.height / 2;
    });
    if (before) {
      if (drag.row.nextElementSibling !== before) listEl.insertBefore(drag.row, before);
    } else if (others.length) {
      const last = others[others.length - 1];
      if (last.nextElementSibling !== drag.row) last.after(drag.row);
    }
  }

  function autoScrollTick() {
    if (!drag?.active) return;
    const scroller = scrollParentOf(listEl);
    if (scroller) {
      const rect = scroller.getBoundingClientRect();
      let delta = 0;
      if (drag.lastY < rect.top + EDGE_SCROLL_PX) delta = -8;
      else if (drag.lastY > rect.bottom - EDGE_SCROLL_PX) delta = 8;
      if (delta) {
        scroller.scrollTop += delta;
        repositionDraggedRow(drag.lastY);
      }
    }
    drag.rafId = requestAnimationFrame(autoScrollTick);
  }

  async function onDragEnd(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const wasActive = drag.active;
    const moved = drag.moved;
    const row = drag.row;
    const newOrder = wasActive && row.isConnected
      ? [...listEl.querySelectorAll(".checklist-item--draggable")].map((r) => r.dataset.itemId)
      : null;
    endDrag();
    if (!wasActive) return;
    // Si le doigt/curseur a réellement bougé, le clic synthétique qui suit le relâchement ne doit pas
    // ouvrir la barre d'actions ; sans mouvement (simple appui un peu long), il reste un clic normal.
    if (moved) suppressTapUntil = Date.now() + 150;
    const currentOrder = current.filter((it) => !it.done).map((it) => it.id);
    if (newOrder && newOrder.join("|") !== currentOrder.join("|")) {
      const updated = await onReorder(newOrder);
      current = updated || current;
    }
    renderList();
  }

  function onDragCancel(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const wasActive = drag.active;
    endDrag();
    // Le navigateur reprend le geste (défilement) : on rétablit l'ordre d'origine sans rien écrire.
    if (wasActive) renderList();
  }

  function endDrag() {
    if (!drag) return;
    clearTimeout(drag.timer);
    cancelAnimationFrame(drag.rafId);
    drag.row.classList.remove("checklist-item--dragging");
    listEl.classList.remove("checklist-items--dragging");
    document.removeEventListener("pointermove", onDragMove);
    document.removeEventListener("pointerup", onDragEnd);
    document.removeEventListener("pointercancel", onDragCancel);
    drag = null;
  }

  function scrollParentOf(el) {
    for (let node = el.parentElement; node; node = node.parentElement) {
      const overflowY = getComputedStyle(node).overflowY;
      if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) return node;
    }
    return null;
  }

  function startEdit(item, textSpan) {
    const input = document.createElement("input");
    input.type = "text";
    input.value = item.text;
    input.style.flex = "1";
    input.style.minWidth = "0";
    input.style.border = "1px solid var(--color-border)";
    input.style.borderRadius = "var(--radius-sm)";
    input.style.padding = "4px 6px";
    textSpan.replaceWith(input);
    input.focus();
    input.select();
    // `settled` évite un double traitement quand Échap déclenche `cancel()` puis que la perte de
    // focus consécutive (input retiré du DOM) déclenche à son tour l'écouteur `blur` — même genre
    // de garde que `guardClick` pour l'ajout, ici sans écriture réseau à protéger mais pour éviter
    // un second `renderList()` inutile.
    let settled = false;
    async function commit() {
      if (settled) return;
      settled = true;
      const newText = input.value.trim();
      if (newText && newText !== item.text) {
        const updated = await onEdit(item.id, newText);
        current = updated || current;
      }
      renderList();
    }
    function cancel() {
      if (settled) return;
      settled = true;
      renderList();
    }
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    });
  }
  renderList();

  async function addFromInput() {
    const input = container.querySelector("#checklist-new-text");
    const text = input.value.trim();
    if (!text) return;
    const updated = await onAdd(text);
    current = updated || current;
    input.value = "";
    renderList();
    input.focus();
  }

  // BUG corrigé (15/09/2026, audit "anomalies d'usage ou d'enregistrement en silence") : ni le
  // bouton ni le champ n'étaient désactivés pendant `onAdd` (souvent une écriture Firestore) —
  // un double-clic sur "+", ou un double-Entrée, déclenchait deux fois l'ajout avant que
  // `input.value = ""` n'ait eu le temps de s'exécuter : une sous-étape identique dupliquée en
  // silence. `guardClick` désactive le bouton "+" le temps de l'ajout, et la même fonction
  // protégée est utilisée pour le clic ET pour Entrée, pour qu'aucun des deux chemins ne
  // contourne l'autre.
  const addBtn = container.querySelector("#checklist-add-btn");
  const guardedAdd = guardClick(addBtn, addFromInput);
  addBtn.addEventListener("click", guardedAdd);
  container.querySelector("#checklist-new-text").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      guardedAdd();
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

function formatDoneAt(ts) {
  return new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
