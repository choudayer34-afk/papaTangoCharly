// Réordonnancement par appui maintenu puis glissement — UN SEUL mécanisme pour toute l'app (06/10/2026,
// retour direct de Charles-Henri : "je veux que ce soit partout pareil pour les déplacements où il y
// a ces icônes [▲▼], que ça fonctionne maintenant comme les post-it"). Remplace les boutons ▲/▼ des
// checklists (Tâche, Suivi, post-it), des Sous-parties d'un Projet et des deux listes de
// personnalisation (ordre des rubriques de l'Accueil, barre de navigation).
//
// Extrait tel quel de js/components/checklist.js (où il avait été écrit le jour même pour les post-it,
// puis validé par des tests navigateur : souris et tactile simulé) pour que tous les écrans se
// comportent exactement pareil — c'était la demande.
//
// Geste : souris = clic maintenu ; tactile = appui long (350 ms) ; PUIS glisser. Avant les 350 ms, un
// déplacement notable (> 8 px) abandonne le geste : c'est un défilement ou un balayage, la page/le
// panneau défile normalement. La ligne glissée se replace en direct sous le pointeur ; `onReorder` n'est
// appelé qu'UNE fois, au relâchement, avec les identifiants dans leur nouvel ordre.
//
// Contrat de l'appelant :
//  - `listEl` : conteneur PERSISTANT (il survit aux réaffichages ; ses enfants, eux, sont recréés) dont
//    les lignes réordonnables sont des ENFANTS DIRECTS portant la classe `drag-reorder-row` et un
//    attribut `data-drag-id` (identifiant stable de la ligne). Les lignes qui ne doivent pas bouger (ex.
//    éléments cochés) n'ont simplement pas cette classe : elles ne démarrent aucun glissement et la
//    ligne glissée ne peut pas les dépasser.
//  - `getCurrentOrder()` : identifiants des lignes réordonnables dans l'ordre actuel (sert à ne rien
//    écrire si la ligne est reposée à sa place).
//  - `onReorder(orderedIds)` : persiste le nouvel ordre (peut être asynchrone).
//  - `rerender()` : réaffiche la liste — appelé après chaque geste (ordre changé, inchangé ou annulé),
//    ce qui rétablit aussi l'ordre d'origine du DOM si le navigateur reprend le geste.
// Renvoie `{ justDropped() }` : vrai pendant 150 ms après un vrai glissement — pour qu'un appelant dont
// la ligne réagit au clic (ex. barre d'actions d'un post-it) ignore le clic synthétique du relâchement.

const LONG_PRESS_MS = 350;
const MOVE_TOLERANCE_PX = 8;
const EDGE_SCROLL_PX = 32;
const ROW_SELECTOR = ".drag-reorder-row";

export function attachDragReorder(listEl, { getCurrentOrder, onReorder, rerender }) {
  let drag = null;
  let suppressTapUntil = 0;

  // Un `touchmove` NON passif, posé une fois sur la liste, est ce qui permet d'empêcher le défilement
  // PENDANT un glissement actif sans l'empêcher le reste du temps (le gestionnaire ne fait rien tant
  // que `drag.active` est faux). Un écouteur ajouté seulement au moment de l'appui long arriverait trop
  // tard pour certains navigateurs mobiles, qui décident dès le début du geste s'ils attendent ou non
  // le thread principal.
  listEl.addEventListener(
    "touchmove",
    (e) => {
      if (drag?.active && e.cancelable) e.preventDefault();
    },
    { passive: false }
  );
  // L'appui long tactile ouvre sinon le menu contextuel/la sélection de texte du navigateur.
  listEl.addEventListener("contextmenu", (e) => {
    if (drag && e.target.closest(ROW_SELECTOR)) e.preventDefault();
  });
  listEl.addEventListener("pointerdown", (e) => {
    const row = e.target.closest(ROW_SELECTOR);
    if (!row || drag || !listEl.contains(row)) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Cases à cocher, champs de saisie, boutons : jamais le début d'un glissement.
    if (e.target.closest("input, textarea, select, button")) return;
    drag = {
      row,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastY: e.clientY,
      active: false,
      moved: false,
      rafId: 0,
      timer: setTimeout(activate, LONG_PRESS_MS),
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onEnd);
    document.addEventListener("pointercancel", onCancel);
  });

  function activate() {
    if (!drag || !drag.row.isConnected) return endDrag();
    drag.active = true;
    drag.row.classList.add("drag-reorder-row--dragging");
    listEl.classList.add("drag-reorder-list--dragging");
    drag.rafId = requestAnimationFrame(autoScrollTick);
  }

  function onMove(e) {
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
  // réordonnable (autre que la sienne) dont le milieu est sous le pointeur, sinon après la dernière.
  // Comparer aux seules AUTRES lignes (qui ne bougent pas entre elles) garantit qu'aucun va-et-vient
  // n'apparaît, même quand les lignes ont des hauteurs différentes (texte sur plusieurs lignes).
  function repositionDraggedRow(y) {
    const others = [...listEl.querySelectorAll(ROW_SELECTOR)].filter((r) => r !== drag.row);
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

  async function onEnd(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { active, moved, row } = drag;
    const newOrder = active && row.isConnected ? [...listEl.querySelectorAll(ROW_SELECTOR)].map((r) => r.dataset.dragId) : null;
    endDrag();
    if (!active) return;
    // Si le doigt/curseur a réellement bougé, le clic synthétique qui suit le relâchement ne doit pas
    // déclencher l'action de clic de la ligne ; sans mouvement (simple appui un peu long), il reste un
    // clic normal.
    if (moved) suppressTapUntil = Date.now() + 150;
    try {
      if (newOrder && newOrder.join("|") !== getCurrentOrder().join("|")) await onReorder(newOrder);
    } finally {
      rerender();
    }
  }

  function onCancel(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const wasActive = drag.active;
    endDrag();
    // Le navigateur reprend le geste (défilement) : on rétablit l'ordre d'origine sans rien écrire.
    if (wasActive) rerender();
  }

  function endDrag() {
    if (!drag) return;
    clearTimeout(drag.timer);
    cancelAnimationFrame(drag.rafId);
    drag.row.classList.remove("drag-reorder-row--dragging");
    listEl.classList.remove("drag-reorder-list--dragging");
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onEnd);
    document.removeEventListener("pointercancel", onCancel);
    drag = null;
  }

  return { justDropped: () => Date.now() < suppressTapUntil };
}

function scrollParentOf(el) {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const overflowY = getComputedStyle(node).overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) return node;
  }
  return null;
}
