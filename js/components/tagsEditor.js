// Éditeur de tags réutilisable (retour de Charles-Henri, 13/09/2026 : "les tags peuvent être
// associé à n'importe quel élément d'une info au projet au suivi, etc.") — un seul point
// d'implémentation (chips + saisie + autocomplétion) réutilisé par les 9 fiches de l'app,
// plutôt que dupliqué comme l'était l'ancienne UI de tags de js/views/inbox.js#openKeptItemDetail
// — même principe que js/components/linkedItems.js#renderLinkedSection pour "🔗 Lié".
//
// Affichage toujours préfixé "#" (retour de Charles-Henri : "les tags soit toujours prefixé
// par #") — jamais stocké avec le "#", qui n'est qu'un habillage de présentation/saisie (voir
// js/domain/tags.js#stripHash : la saisie reste tolérante, "urgent" et "#urgent" tapés l'un
// après l'autre restent le même tag).

import * as tagsApi from "../domain/tags.js";

let uidCounter = 0;

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

/** Rend l'éditeur de tags dans `container` pour la fiche {type, id}. */
export async function renderTagsEditor(container, type, id) {
  const datalistId = `tags-editor-options-${++uidCounter}`;
  container.innerHTML = `
    <div class="tags-editor-list" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;"></div>
    <div style="display:flex;gap:8px;">
      <input type="text" class="tags-editor-input" placeholder="Ajouter un tag..." list="${datalistId}"
             style="flex:1;border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:var(--space-3);" />
      <datalist id="${datalistId}"></datalist>
      <button type="button" class="btn btn-secondary btn-sm tags-editor-add-btn">+ Tag</button>
    </div>
  `;
  const listEl = container.querySelector(".tags-editor-list");
  const inputEl = container.querySelector(".tags-editor-input");
  const datalistEl = container.querySelector(`#${datalistId}`);

  function renderList(mine) {
    listEl.innerHTML = "";
    if (!mine.length) {
      listEl.innerHTML = `<span class="item-meta">Aucun tag pour l'instant.</span>`;
      return;
    }
    for (const tagDoc of mine) {
      const chip = document.createElement("span");
      chip.className = "tag-chip";
      chip.innerHTML = `#${escapeHtml(tagDoc.tag)} <button type="button" title="Retirer ce tag">✕</button>`;
      chip.querySelector("button").addEventListener("click", async () => {
        await tagsApi.removeTag(tagDoc);
        renderList(mine.filter((t) => t.id !== tagDoc.id));
      });
      listEl.appendChild(chip);
    }
  }

  const allTags = await tagsApi.listAll();
  let mine = tagsApi.tagsFor(allTags, type, id);
  datalistEl.innerHTML = tagsApi
    .listAllTagNames(allTags)
    .map((t) => `<option value="#${escapeHtml(t)}"></option>`)
    .join("");
  renderList(mine);

  const addTag = async () => {
    const value = inputEl.value.trim();
    if (!value) return;
    const created = await tagsApi.addTag(type, id, value);
    if (created && !mine.some((t) => t.id === created.id)) mine = [...mine, created];
    inputEl.value = "";
    renderList(mine);
  };
  container.querySelector(".tags-editor-add-btn").addEventListener("click", addTag);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  });
}
