// Modale générique "🔁 Changer de type" (retour de Charles-Henri, vague 40, 09/09/2026 : "si je
// me suis trompé de type, je dois supprimer et recréer, il faudrait que je puisse le changer").
// Ouverte depuis la fiche Tâche (js/views/kanban.js), la fiche Suivi (js/views/people.js) ou le
// détail d'une Information/Idée (js/views/inbox.js) — un seul composant partagé plutôt que trois
// modales redondantes, la logique de conversion elle-même vivant dans js/domain/convert.js.
//
// Volontairement PAS de réouverture automatique de la nouvelle fiche après conversion : cela
// demanderait d'importer les trois vues (Tâche/Suivi/Inbox) les unes dans les autres en plus de
// ce composant, pour un gain limité — un simple message indique où retrouver l'élément converti.

import { openModal, closeModal } from "./modal.js";
import { showToast } from "./toast.js";
import * as peopleApi from "../domain/people.js";
import * as convertApi from "../domain/convert.js";

const TARGET_LABELS = { task: "📝 Tâche", followup: "🔁 Suivi (collaborateur)", kept: "🧠 Information / 💡 Idée" };
const SHORT_LABELS = { task: "Tâche", followup: "Suivi", kept: "Information/Idée" };
const WHERE_TO_FIND = { task: "Pilotage", followup: "Équipe", kept: "Accueil, section « 🧠 Informations & idées »" };

/**
 * @param {"task"|"followup"|"kept"} sourceType
 * @param {object} entity - la Tâche, le Suivi, ou l'InboxItem "kept" à convertir.
 * @param {("task"|"followup"|"kept")[]} targets - types de destination proposés (jamais
 *   "project", voir js/domain/convert.js pour pourquoi).
 * @param {{ personName?: string, onConverted?: Function, onCancel?: Function }} opts
 */
export async function openChangeTypeModal(sourceType, entity, targets, { personName = "", onConverted, onCancel } = {}) {
  const needsPersonUpfront = sourceType !== "followup" && targets.includes("followup");
  const people = needsPersonUpfront ? await peopleApi.listAll() : [];

  const body = document.createElement("div");
  body.innerHTML = `
    <p class="item-meta" style="margin-bottom:16px;">
      Titre, description, projet et échéance (quand compatibles avec le nouveau type) sont
      repris. L'élément d'origine est supprimé après la conversion ; son historique garde une
      trace du lien vers le nouvel élément.
    </p>
    <div class="field">
      <label for="convert-target">Nouveau type</label>
      <select id="convert-target">
        ${targets.map((t) => `<option value="${t}">${TARGET_LABELS[t]}</option>`).join("")}
      </select>
    </div>
    <div class="field" id="convert-person-field" style="display:none;">
      <label for="convert-person">Personne</label>
      <select id="convert-person">
        <option value="">— Choisir —</option>
        ${people.map((p) => `<option value="${p.id}">${p.type === "manager" ? "👔" : "👤"} ${p.name}</option>`).join("")}
      </select>
    </div>
    <div class="field" id="convert-idea-field" style="display:none;">
      <label class="chip-radio" style="display:flex;align-items:center;gap:8px;">
        <input type="checkbox" id="convert-is-idea" style="width:auto;" /> C'est plutôt une 💡 idée qu'une 🧠 information
      </label>
    </div>
  `;

  const syncFields = () => {
    const target = body.querySelector("#convert-target").value;
    body.querySelector("#convert-person-field").style.display = target === "followup" ? "" : "none";
    body.querySelector("#convert-idea-field").style.display = target === "kept" ? "" : "none";
  };
  body.querySelector("#convert-target").addEventListener("change", syncFields);
  syncFields();

  openModal({
    title: "🔁 Changer de type",
    body,
    actions: [
      { label: "Annuler", variant: "ghost", onClick: () => onCancel?.() },
      {
        label: "Convertir",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          const target = body.querySelector("#convert-target").value;
          const keptAsType = body.querySelector("#convert-is-idea")?.checked ? "idea" : "kept";
          const personId = body.querySelector("#convert-person")?.value || "";
          if (target === "followup" && !personId) {
            showToast("Choisis une personne pour ce suivi");
            return;
          }
          try {
            let result;
            if (sourceType === "task") {
              result = target === "followup" ? await convertApi.convertTaskToFollowUp(entity, { personId }) : await convertApi.convertTaskToKept(entity, keptAsType);
            } else if (sourceType === "followup") {
              result = target === "task" ? await convertApi.convertFollowUpToTask(entity, personName) : await convertApi.convertFollowUpToKept(entity, keptAsType, personName);
            } else {
              result = target === "task" ? await convertApi.convertKeptToTask(entity) : await convertApi.convertKeptToFollowUp(entity, { personId });
            }
            closeModal();
            showToast(`Converti en ${SHORT_LABELS[target]} — retrouvable dans ${WHERE_TO_FIND[target]}`);
            onConverted?.(result, target);
          } catch (err) {
            showToast(err.message || "Impossible de convertir");
          }
        },
      },
    ],
  });
}
