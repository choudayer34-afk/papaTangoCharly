// Journal de notes horodaté (retour de Charles-Henri, 01/09/2026 : pouvoir ajouter un
// complément sur un Suivi — puis, plus généralement, "sur tout les éléments") — réutilisable
// depuis n'importe quelle fiche (Tâche, Suivi, Projet, sous-partie de projet, Réunion,
// Décision, Ressource, Personne, Information/Idée). La date/heure s'alimente automatiquement
// à l'ajout, jamais saisie à la main.
//
// Volontairement additif seulement, comme l'Historique (§46) : pas d'édition ni de suppression
// d'une note existante — si Charles-Henri se trompe, il ajoute une note suivante plutôt que de
// réécrire le passé. `notes` est un tableau `{id, text, createdAt}` déjà chargé par l'appelant ;
// `onAdd(text)` doit persister la nouvelle note côté domaine et renvoyer le tableau à jour.
//
// Distinct du champ "Notes" existant sur Personne/Réunion (un texte de contexte durable, pas
// daté, voir js/views/people.js) : les deux coexistent, ce journal est un complément, pas un
// remplacement.

export function renderNotesBlock(container, notes, { onAdd, emptyLabel = "Aucune note pour l'instant." } = {}) {
  let current = notes || [];
  container.innerHTML = `
    <div class="field" style="margin-bottom:8px;">
      <textarea id="notes-new-text" placeholder="Ajouter une note..." style="min-height:56px;"></textarea>
    </div>
    <button type="button" id="notes-add-btn" class="btn btn-secondary btn-sm" style="margin-bottom:12px;">+ Ajouter la note</button>
    <div id="notes-list"></div>
  `;

  const listEl = container.querySelector("#notes-list");

  function renderList() {
    if (!current.length) {
      listEl.innerHTML = `<div class="empty-state" style="padding:12px;">${emptyLabel}</div>`;
      return;
    }
    const sorted = [...current].sort((a, b) => b.createdAt - a.createdAt);
    listEl.innerHTML = "";
    for (const note of sorted) {
      const entry = document.createElement("div");
      entry.className = "notes-entry";
      entry.innerHTML = `
        <div class="item-meta">${formatDateTime(note.createdAt)}</div>
        <div class="notes-entry-text">${escapeHtml(note.text)}</div>
      `;
      listEl.appendChild(entry);
    }
  }
  renderList();

  container.querySelector("#notes-add-btn").addEventListener("click", async () => {
    const textarea = container.querySelector("#notes-new-text");
    const text = textarea.value.trim();
    if (!text) return;
    const updated = await onAdd(text);
    current = updated || current;
    textarea.value = "";
    renderList();
  });
}

function formatDateTime(ts) {
  return new Date(ts).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
