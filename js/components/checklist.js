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
// Bouton "+" compact plutôt que "+ Ajouter" en toutes lettres (retour de Charles-Henri,
// 14/09/2026 : "le + ajouter sort de la modale, il faudrait juste un + à côté du champ") — ce
// composant vit aussi dans des modales de largeur contrainte (fiche Tâche/Suivi) où le bouton
// texte débordait. Le libellé du champ passe au passage de "sous-étape" à "élément" (même retour
// de Charles-Henri), plus neutre pour les trois usages (sous-étapes de Tâche/Suivi, notes libres
// du Pense-bête).

export function renderChecklist(
  container,
  items,
  { onAdd, onToggle, onRemove, onClearDone, sortDoneToBottom = false, emptyLabel = "Pas encore de sous-étape." } = {}
) {
  let current = items || [];
  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
      <input id="checklist-new-text" type="text" placeholder="Ajouter un élément..." style="flex:1;min-width:0;border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:var(--space-3);" />
      <button type="button" id="checklist-add-btn" class="checklist-add-btn" aria-label="Ajouter un élément" title="Ajouter un élément">+</button>
    </div>
    ${onClearDone ? `<div id="checklist-clear-done-row" style="margin-bottom:8px;"></div>` : ""}
    <div id="checklist-items"></div>
  `;

  const listEl = container.querySelector("#checklist-items");
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
    // Les éléments cochés descendent en bas de la liste (retour de Charles-Henri, 14/09/2026 :
    // "pour que les éléments restants soit toujours visible en premier") — un simple tri stable
    // par groupe (non cochés puis cochés), qui préserve l'ordre relatif à l'intérieur de chaque
    // groupe plutôt que de trier par date de coche ou de tout mélanger.
    const visible = sortDoneToBottom
      ? [...current.filter((it) => !it.done), ...current.filter((it) => it.done)]
      : current;
    listEl.innerHTML = "";
    for (const item of visible) {
      const row = document.createElement("div");
      row.className = "checklist-item";
      row.innerHTML = `
        <input type="checkbox" ${item.done ? "checked" : ""} aria-label="${escapeAttr(item.text)}" />
        <span class="checklist-item-text${item.done ? " done" : ""}">${escapeHtml(item.text)}</span>
        ${item.done && item.doneAt ? `<span class="checklist-item-date">✓ ${formatDoneAt(item.doneAt)}</span>` : ""}
      `;
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn btn-ghost btn-sm";
      removeBtn.setAttribute("aria-label", "Retirer cet élément");
      removeBtn.textContent = "✕";
      row.appendChild(removeBtn);

      row.querySelector('input[type="checkbox"]').addEventListener("change", async (e) => {
        const updated = await onToggle(item.id, e.target.checked);
        current = updated || current;
        renderList();
      });
      removeBtn.addEventListener("click", async () => {
        const updated = await onRemove(item.id);
        current = updated || current;
        renderList();
      });
      listEl.appendChild(row);
    }
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

  container.querySelector("#checklist-add-btn").addEventListener("click", addFromInput);
  container.querySelector("#checklist-new-text").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addFromInput();
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
