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

export function renderChecklist(container, items, { onAdd, onToggle, onRemove, emptyLabel = "Pas encore de sous-étape." } = {}) {
  let current = items || [];
  container.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <input id="checklist-new-text" type="text" placeholder="Ajouter une sous-étape..." style="flex:1;border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:var(--space-3);" />
      <button type="button" id="checklist-add-btn" class="btn btn-secondary btn-sm">+ Ajouter</button>
    </div>
    <div id="checklist-items"></div>
  `;

  const listEl = container.querySelector("#checklist-items");

  function renderList() {
    if (!current.length) {
      listEl.innerHTML = `<div class="empty-state" style="padding:12px;">${emptyLabel}</div>`;
      return;
    }
    listEl.innerHTML = "";
    for (const item of current) {
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
      removeBtn.setAttribute("aria-label", "Retirer cette sous-étape");
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
