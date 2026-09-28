// Journal de notes horodaté (retour de Charles-Henri, 01/09/2026 : pouvoir ajouter un
// complément sur un Suivi — puis, plus généralement, "sur tout les éléments") — réutilisable
// depuis n'importe quelle fiche (Tâche, Suivi, Projet, sous-partie de projet, Réunion,
// Décision, Ressource, Personne, Information/Idée). La date/heure s'alimente automatiquement
// à l'ajout, jamais saisie à la main.
//
// (28/09/2026, retour direct de Charles-Henri : "je dois pouvoir pour toutes les notes, les
// modifier si besoin") — la règle d'origine ("volontairement additif seulement [...] si
// Charles-Henri se trompe, il ajoute une note suivante plutôt que de réécrire le passé") est
// levée sur les 8 fiches qui partagent ce composant : `onUpdate`/`onDelete` sont désormais
// systématiquement fournis par chaque appelant (voir js/domain/*.js#updateNote/removeNote).
// Édition en place (textarea + Enregistrer/Annuler, jamais de modale pour un simple texte —
// même principe que js/components/checklist.js#onEdit), pas de confirmation avant suppression
// (même principe que le "✕" de checklist.js : un simple clic retire la note).
//
// `eadpTagging` (optionnel, réservé au journal d'une Personne — voir
// js/domain/people.js#EADP_FLAG_VALUES) : quand fourni avec `onEadpFlagChange`, chaque note
// gagne 3 chips positif/négatif/neutre pour se signaler comme élément à remonter dans
// "Préparer l'EADP" (js/views/people.js#openPrepareEadpModal). Absent sur les 7 autres usages
// de ce composant, qui n'ont pas cette notion.
//
// `notes` est un tableau `{id, text, createdAt, eadpFlag?}` déjà chargé par l'appelant ;
// `onAdd(text)`, `onUpdate(noteId, text)` et `onDelete(noteId)` doivent persister la mutation
// côté domaine et renvoyer le tableau à jour. `onEadpFlagChange(noteId, flag|null)` idem, pour
// le seul tag EADP.

import { guardClick } from "./modal.js";

export function renderNotesBlock(
  container,
  notes,
  { onAdd, onUpdate, onDelete, emptyLabel = "Aucune note pour l'instant.", eadpTagging = false, onEadpFlagChange } = {}
) {
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
        <div class="notes-entry-header">
          <div class="item-meta">${formatDateTime(note.createdAt)}</div>
          <div class="notes-entry-actions"></div>
        </div>
        <div class="notes-entry-text"></div>
        ${eadpTagging ? `<div class="notes-entry-eadp-row"></div>` : ""}
      `;
      entry.querySelector(".notes-entry-text").textContent = note.text;
      const actionsEl = entry.querySelector(".notes-entry-actions");

      if (onUpdate) {
        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "btn btn-ghost btn-sm";
        editBtn.setAttribute("aria-label", "Modifier cette note");
        editBtn.title = "Modifier cette note";
        editBtn.textContent = "✏️";
        editBtn.addEventListener("click", () => startEdit(entry, note));
        actionsEl.appendChild(editBtn);
      }
      if (onDelete) {
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "btn btn-ghost btn-sm";
        removeBtn.setAttribute("aria-label", "Supprimer cette note");
        removeBtn.title = "Supprimer cette note";
        removeBtn.textContent = "✕";
        removeBtn.addEventListener(
          "click",
          guardClick(removeBtn, async () => {
            const updated = await onDelete(note.id);
            current = updated || current.filter((n) => n.id !== note.id);
            renderList();
          })
        );
        actionsEl.appendChild(removeBtn);
      }

      if (eadpTagging) {
        const eadpRow = entry.querySelector(".notes-entry-eadp-row");
        const flags = [
          { value: "positive", label: "👍 Positif" },
          { value: "negative", label: "👎 Négatif" },
          { value: "neutral", label: "⚪ Neutre" },
        ];
        for (const f of flags) {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "notes-entry-eadp-chip" + (note.eadpFlag === f.value ? " active" : "");
          chip.textContent = f.label;
          chip.title = "Remonter dans l'EADP (" + f.label.replace(/^[^ ]+ /, "") + ")";
          chip.addEventListener(
            "click",
            guardClick(chip, async () => {
              const nextValue = note.eadpFlag === f.value ? null : f.value;
              const updated = await onEadpFlagChange(note.id, nextValue);
              current = updated || current;
              renderList();
            })
          );
          eadpRow.appendChild(chip);
        }
      }

      listEl.appendChild(entry);
    }
  }
  renderList();

  function startEdit(entry, note) {
    const textEl = entry.querySelector(".notes-entry-text");
    const textarea = document.createElement("textarea");
    textarea.value = note.text;
    textarea.style.minHeight = "56px";
    textarea.style.width = "100%";
    const actionsRow = document.createElement("div");
    actionsRow.style.display = "flex";
    actionsRow.style.gap = "8px";
    actionsRow.style.marginTop = "6px";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn btn-secondary btn-sm";
    saveBtn.textContent = "Enregistrer";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn-ghost btn-sm";
    cancelBtn.textContent = "Annuler";
    actionsRow.append(saveBtn, cancelBtn);
    textEl.replaceWith(textarea, actionsRow);
    textarea.focus();

    saveBtn.addEventListener(
      "click",
      guardClick(saveBtn, async () => {
        const newText = textarea.value.trim();
        if (!newText) return;
        const updated = await onUpdate(note.id, newText);
        current = updated || current;
        renderList();
      })
    );
    cancelBtn.addEventListener("click", () => renderList());
  }

  // BUG corrigé (15/09/2026, audit "anomalies d'usage ou d'enregistrement en silence") : le
  // bouton n'était pas désactivé pendant `onAdd` — un double-clic créait une note dupliquée en
  // silence (même famille que le correctif équivalent dans checklist.js).
  const addBtn = container.querySelector("#notes-add-btn");
  addBtn.addEventListener(
    "click",
    guardClick(addBtn, async () => {
      const textarea = container.querySelector("#notes-new-text");
      const text = textarea.value.trim();
      if (!text) return;
      const updated = await onAdd(text);
      current = updated || current;
      textarea.value = "";
      renderList();
    })
  );
}

function formatDateTime(ts) {
  return new Date(ts).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
