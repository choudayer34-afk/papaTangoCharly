// Dupliquer une tâche (retour de Charles-Henri, 07/09/2026) : reprendre une tâche déjà
// qualifiée sans repartir de zéro (ex. un sujet qui revient mais pas assez régulièrement pour
// justifier un vrai modèle/template). Deux points d'entrée : depuis la fiche Tâche elle-même
// (js/views/kanban.js#openTaskDetail, bouton "🗐 Dupliquer") et depuis la recherche globale
// (js/components/search.js), comme demandé.
//
// Ce qui est TOUJOURS repris tel quel, sans case à cocher (ce sont des propriétés du sujet, pas
// de l'instance en cours) : statut ⚪ À faire, pas d'échéance, description, critère de clôture,
// projet, type (donc le canevas Communication le cas échéant — recréé vierge par
// tasksApi.createTask() exactement comme pour une tâche neuve, jamais avec les cases déjà
// cochées de l'original), priorité. `isBlocked` reste à false : un blocage est un état de
// l'instance en cours, pas du sujet.
//
// Ce qui n'est JAMAIS repris, et n'apparaît même pas comme option (retour explicite de
// Charles-Henri) : le "🔗 Lié" générique (Suivi/Décision/etc. — voir js/domain/links.js),
// l'historique, les notes (notesLog), les réunions Outlook "déjà associées". Un seul lien est
// posé automatiquement sur la copie : vers la tâche d'origine, pour ne jamais perdre la trace
// de la duplication elle-même.
//
// Ce qui est optionnel, case cochée par défaut (masquée s'il n'y a rien à proposer) : les
// sous-étapes (recopiées non cochées), les ressources associées et les prompts liés
// (js/domain/prompts.js#linkToTask, vague du 07/09/2026) — ces deux derniers via leur mécanique
// `taskIds` propre, pas via "🔗 Lié".

import { openModal } from "./modal.js";
import { showToast } from "./toast.js";
import * as tasksApi from "../domain/tasks.js";
import * as resourcesApi from "../domain/resources.js";
import * as promptsApi from "../domain/prompts.js";
import * as linksApi from "../domain/links.js";

function todaySuffix() {
  // Format "07/09/2026" (fr-FR par défaut) — court et sans ambiguïté pour un suffixe de titre,
  // cohérent avec le fuseau/la locale déjà utilisés partout ailleurs dans l'appli.
  return new Date().toLocaleDateString("fr-FR");
}

function optionRow(id, label) {
  return `
    <div class="field" style="display:flex;align-items:center;gap:8px;">
      <input id="${id}" type="checkbox" style="width:auto;" checked />
      <label for="${id}" style="margin:0;">${label}</label>
    </div>
  `;
}

/**
 * `task` : la tâche source (l'objet complet, avec son `checklist`). `{ onDuplicated, onCancel }`
 * : callbacks — cette fonction ne navigue jamais elle-même, comme le reste de l'appli (voir
 * js/components/linkedItems.js) : c'est à l'appelant de décider quoi faire une fois la copie
 * créée (rouvrir la fiche tâche d'origine, ouvrir la copie, etc.) ou l'action annulée.
 */
export async function openDuplicateTaskModal(task, { onDuplicated, onCancel } = {}) {
  const [allResources, allPrompts] = await Promise.all([resourcesApi.listAll(), promptsApi.listAll()]);
  const linkedResources = allResources.filter((r) => (r.taskIds || []).includes(task.id));
  const linkedPrompts = allPrompts.filter((p) => (p.taskIds || []).includes(task.id));
  const checklist = task.checklist || [];

  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="dup-title">Titre de la copie</label>
      <input id="dup-title" type="text" value="${escapeAttr(`${task.title} ${todaySuffix()}`)}" />
    </div>
    <p class="item-meta" style="margin:-8px 0 16px;">
      Toujours repris : ⚪ À faire, sans échéance, même description, même critère de clôture,
      même projet — un lien sera posé vers « ${escapeHtml(task.title)} ».
    </p>
    ${checklist.length ? optionRow("dup-checklist", `☑️ Sous-étapes (${checklist.length}, non cochées)`) : ""}
    ${linkedResources.length ? optionRow("dup-resources", `📎 Ressources associées (${linkedResources.length})`) : ""}
    ${linkedPrompts.length ? optionRow("dup-prompts", `🤖 Prompts liés (${linkedPrompts.length})`) : ""}
  `;

  const { bodyEl, close } = openModal({
    title: "🗐 Dupliquer la tâche",
    body,
    actions: [
      { label: "Annuler", variant: "ghost", onClick: () => onCancel?.() },
      {
        label: "Dupliquer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          const title = bodyEl.querySelector("#dup-title").value.trim();
          if (!title) return;
          const keepChecklist = bodyEl.querySelector("#dup-checklist")?.checked ?? false;
          const keepResources = bodyEl.querySelector("#dup-resources")?.checked ?? false;
          const keepPrompts = bodyEl.querySelector("#dup-prompts")?.checked ?? false;

          const newTask = await tasksApi.createTask({
            title,
            description: task.description,
            type: task.type,
            status: "todo",
            priority: task.priority,
            dueDate: null,
            projectId: task.projectId,
            successCriteria: task.successCriteria,
          });

          if (keepChecklist) {
            for (const item of checklist) {
              await tasksApi.addChecklistItem(newTask.id, item.text);
            }
          }
          if (keepResources) {
            for (const r of linkedResources) await resourcesApi.linkToTask(r.id, newTask.id, true);
          }
          if (keepPrompts) {
            for (const p of linkedPrompts) await promptsApi.linkToTask(p.id, newTask.id, true);
          }
          // Le seul élément "lié" conservé : un lien neuf vers la tâche d'origine (jamais les
          // liens de l'originale elle-même, voir le commentaire en tête de fichier).
          await linksApi.createLink(
            { type: "Task", id: newTask.id, label: title },
            { type: "Task", id: task.id, label: task.title }
          );

          close();
          showToast("Tâche dupliquée");
          onDuplicated?.(newTask);
        },
      },
    ],
  });

  setTimeout(() => bodyEl.querySelector("#dup-title")?.select(), 30);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}
