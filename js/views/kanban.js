// Kanban — vue principale de pilotage opérationnel (§24, §25). Drag & drop obligatoire ;
// déplacer une carte change son statut, rien de plus.

import * as tasksApi from "../domain/tasks.js";
import * as projectsApi from "../domain/projects.js";
import * as resourcesApi from "../domain/resources.js";
import * as historyApi from "../domain/history.js";
import { openModal, closeModal, confirmDelete } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { openCreateResourceModal, renderResourceList, openResourcePickerModal } from "./resources.js";
import { renderHistoryTimeline } from "../components/historyTimeline.js";
import * as linkedItemsApi from "../components/linkedItems.js";

export function renderKanban(container) {
  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Pilotage</h1>
        <div class="subtitle">Glisse une carte, ou utilise ‹ › pour changer son statut</div>
      </div>
    </div>
    <div class="view"><div class="kanban-board" id="kanban-board"></div></div>
  `;

  const board = container.querySelector("#kanban-board");
  let latestTasks = [];
  let latestProjects = [];

  function render(tasks, projects) {
    board.innerHTML = "";
    for (const status of tasksApi.STATUSES) {
      const column = document.createElement("div");
      column.className = "kanban-column";
      column.dataset.status = status;

      const columnTasks = tasks.filter((t) => t.status === status);

      const header = document.createElement("div");
      header.className = "kanban-column-header";
      header.innerHTML = `<span>${tasksApi.STATUS_LABELS[status]}</span>`;
      const count = document.createElement("span");
      count.className = "count";
      count.textContent = columnTasks.length;
      header.appendChild(count);
      column.appendChild(header);

      for (const task of columnTasks) {
        column.appendChild(renderCard(task, projects));
      }

      column.addEventListener("dragover", (e) => {
        e.preventDefault();
        column.classList.add("drag-over");
      });
      column.addEventListener("dragleave", () => column.classList.remove("drag-over"));
      column.addEventListener("drop", async (e) => {
        e.preventDefault();
        column.classList.remove("drag-over");
        const taskId = e.dataTransfer.getData("text/task-id");
        if (taskId) await tasksApi.setStatus(taskId, status);
      });

      board.appendChild(column);
    }
  }

  function renderBoard() {
    render(latestTasks, latestProjects);
  }

  const unsubTasks = tasksApi.subscribe((tasks) => {
    latestTasks = tasks;
    renderBoard();
  });
  const unsubProjects = projectsApi.subscribe((projects) => {
    latestProjects = projects;
    renderBoard();
  });

  return function cleanup() {
    unsubTasks();
    unsubProjects();
  };
}

/**
 * Le glisser-déposer entre colonnes est peu fiable au doigt sur mobile, surtout dès que la
 * cible n'est pas visible sans scroller horizontalement (§ergonomie signalée par
 * Charles-Henri). Les boutons ‹ › offrent un chemin qui ne dépend jamais du scroll ni du
 * drag : changer de statut reste possible même quand une seule colonne tient à l'écran.
 */
function renderCard(task, projects) {
  const card = document.createElement("div");
  card.className = "kanban-card";
  card.draggable = true;
  card.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/task-id", task.id);
  });
  card.addEventListener("click", () => openTaskDetail(task, projects));

  const project = projects.find((p) => p.id === task.projectId);
  const late = tasksApi.isLate(task);
  const statusIndex = tasksApi.STATUSES.indexOf(task.status);
  const prevStatus = statusIndex > 0 ? tasksApi.STATUSES[statusIndex - 1] : null;
  const nextStatus = statusIndex < tasksApi.STATUSES.length - 1 ? tasksApi.STATUSES[statusIndex + 1] : null;

  card.innerHTML = `
    <div class="kanban-card-title">${task.isBlocked ? "🔴 " : ""}${escapeHtml(task.title)}</div>
    <div class="kanban-card-meta">
      ${project ? `<span>📦 ${escapeHtml(project.name)}</span>` : ""}
      ${task.dueDate ? `<span class="${late ? "badge badge-late" : ""}">📅 ${formatDate(task.dueDate)}</span>` : ""}
    </div>
    <div class="kanban-card-move">
      <button type="button" class="kanban-move-btn" data-dir="prev" aria-label="Statut précédent" ${prevStatus ? "" : "disabled"}>‹</button>
      <span class="kanban-move-label">${tasksApi.STATUS_LABELS[task.status]}</span>
      <button type="button" class="kanban-move-btn" data-dir="next" aria-label="Statut suivant" ${nextStatus ? "" : "disabled"}>›</button>
    </div>
  `;

  card.querySelector('[data-dir="prev"]').addEventListener("click", (e) => {
    e.stopPropagation();
    if (prevStatus) tasksApi.setStatus(task.id, prevStatus);
  });
  card.querySelector('[data-dir="next"]').addEventListener("click", (e) => {
    e.stopPropagation();
    if (nextStatus) tasksApi.setStatus(task.id, nextStatus);
  });

  return card;
}

/**
 * Création autonome d'une tâche, hors du parcours Inbox → qualification — utilisée par le
 * "fil conducteur" (components/linkedItems.js) pour "créer à la volée" une tâche liée à une
 * autre fiche. Même pattern prefill/onCreated/onCancel que openCreateProjectModal et
 * openCreateResourceModal.
 */
export function openCreateTaskModal(prefill = {}) {
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="new-task-title">Titre</label>
      <input id="new-task-title" type="text" placeholder="Ex. Préparer la réunion du 27" value="${escapeAttr(prefill.title || "")}" />
    </div>
    <div class="field">
      <label for="new-task-due">Échéance (optionnel)</label>
      <input id="new-task-due" type="date" />
    </div>
  `;
  const { bodyEl, close } = openModal({
    title: "Nouvelle tâche",
    body,
    actions: [
      { label: "Annuler", variant: "ghost", onClick: () => prefill.onCancel?.() },
      {
        label: "Créer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          const title = bodyEl.querySelector("#new-task-title").value.trim();
          if (!title) return;
          const task = await tasksApi.createTask({
            title,
            dueDate: bodyEl.querySelector("#new-task-due").value || null,
            projectId: prefill.projectId || null,
          });
          close();
          showToast("Tâche créée");
          prefill.onCreated?.(task);
        },
      },
    ],
  });
}

export async function openTaskDetail(task, projects) {
  const [allResources, allHistory] = await Promise.all([resourcesApi.listAll(), historyApi.listAll()]);
  const linkedResources = allResources.filter((r) => (r.taskIds || []).includes(task.id));
  const unlinkedResources = allResources.filter((r) => !(r.taskIds || []).includes(task.id));
  const taskHistory = allHistory
    .filter((h) => h.entityType === "Task" && h.entityId === task.id)
    .sort((a, b) => a.date - b.date);

  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="detail-title">Titre</label>
      <input id="detail-title" type="text" value="${escapeAttr(task.title)}" />
    </div>
    <div class="field">
      <label for="detail-criteria">Critère de clôture</label>
      <textarea id="detail-criteria" placeholder="Comment saurai-je que c'est réellement terminé ?">${escapeHtml(task.successCriteria || "")}</textarea>
    </div>
    <div class="field">
      <label for="detail-due">Échéance</label>
      <input id="detail-due" type="date" value="${task.dueDate || ""}" />
    </div>
    <div class="field">
      <label for="detail-status">Statut</label>
      <select id="detail-status">
        ${tasksApi.STATUSES.map((s) => `<option value="${s}" ${s === task.status ? "selected" : ""}>${tasksApi.STATUS_LABELS[s]}</option>`).join("")}
      </select>
    </div>
    <div class="field">
      <label for="detail-project">Projet</label>
      <select id="detail-project">
        <option value="">— Aucun —</option>
        ${projects.map((p) => `<option value="${p.id}" ${p.id === task.projectId ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("")}
      </select>
    </div>
    <div class="field" style="display:flex;align-items:center;gap:8px;">
      <input id="detail-blocked" type="checkbox" style="width:auto;" ${task.isBlocked ? "checked" : ""} />
      <label for="detail-blocked" style="margin:0;">🔴 Bloqué</label>
    </div>
    <div class="section-title">📎 Ressources (${linkedResources.length})</div>
    <div class="card" id="detail-resources" style="margin-bottom:8px;"></div>
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <button id="link-resource-btn" class="btn btn-secondary btn-sm">🔗 Lier existante</button>
      <button id="new-resource-btn-inline" class="btn btn-secondary btn-sm">+ Nouvelle ressource</button>
    </div>
    <div class="section-title">🕒 Historique (${taskHistory.length})</div>
    <div class="card" id="detail-history" style="margin-bottom:16px;"></div>
    <div class="section-title">🔗 Lié</div>
    <div class="card" id="detail-links" style="margin-bottom:8px;"></div>
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <button id="link-existing-btn" class="btn btn-secondary btn-sm">🔗 Lier une fiche</button>
      <button id="create-linked-btn" class="btn btn-secondary btn-sm">+ Créer et lier</button>
    </div>
  `;

  linkedItemsApi.renderLinkedSection(body.querySelector("#detail-links"), { type: "Task", id: task.id });
  body.querySelector("#link-existing-btn").addEventListener("click", () => {
    closeModal();
    linkedItemsApi.openLinkPickerModal({ type: "Task", id: task.id }, task.title, {
      onLinked: () => openTaskDetail(task, projects),
      onCancel: () => openTaskDetail(task, projects),
    });
  });
  body.querySelector("#create-linked-btn").addEventListener("click", () => {
    closeModal();
    linkedItemsApi.openCreateAndLinkModal({ type: "Task", id: task.id }, task.title, {
      onLinked: () => openTaskDetail(task, projects),
      onCancel: () => openTaskDetail(task, projects),
    });
  });

  const resourcesEl = body.querySelector("#detail-resources");
  renderResourceList(resourcesEl, linkedResources, {
    onUnlink: (r) => resourcesApi.linkToTask(r.id, task.id, false),
  });
  renderHistoryTimeline(body.querySelector("#detail-history"), taskHistory);
  body.querySelector("#link-resource-btn").addEventListener("click", () => {
    if (!unlinkedResources.length) {
      showToast("Aucune autre ressource à lier pour l'instant");
      return;
    }
    // Une seule modale à la fois (voir components/modal.js) : on referme la fiche tâche
    // avant d'ouvrir le sélecteur, puis on la rouvre avec des données fraîches ensuite —
    // sinon la fiche tâche disparaît silencieusement sous le sélecteur.
    closeModal();
    openResourcePickerModal(
      unlinkedResources,
      async (resource) => {
        await resourcesApi.linkToTask(resource.id, task.id, true);
        showToast("Ressource liée");
        openTaskDetail(task, projects);
      },
      () => openTaskDetail(task, projects)
    );
  });
  body.querySelector("#new-resource-btn-inline").addEventListener("click", () => {
    closeModal();
    openCreateResourceModal({
      taskId: task.id,
      onCreated: () => openTaskDetail(task, projects),
      onCancel: () => openTaskDetail(task, projects),
    });
  });

  const { bodyEl, close } = openModal({
    title: "Détail de la tâche",
    body,
    actions: [
      { label: "Fermer", variant: "ghost" },
      {
        label: "🗑️ Supprimer",
        variant: "danger",
        closesModal: false,
        onClick: () => {
          closeModal();
          confirmDelete({
            title: "Supprimer cette tâche ?",
            message: `« ${task.title} » sera définitivement supprimée. Cette action est irréversible.`,
            onConfirm: async () => {
              await tasksApi.removeTask(task.id);
              showToast("Tâche supprimée");
            },
            onCancel: () => openTaskDetail(task, projects),
          });
        },
      },
      {
        label: "Enregistrer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          const title = bodyEl.querySelector("#detail-title").value.trim();
          if (!title) return;
          await tasksApi.updateTask(task.id, {
            title,
            successCriteria: bodyEl.querySelector("#detail-criteria").value,
            dueDate: bodyEl.querySelector("#detail-due").value || null,
            status: bodyEl.querySelector("#detail-status").value,
            projectId: bodyEl.querySelector("#detail-project").value || null,
            isBlocked: bodyEl.querySelector("#detail-blocked").checked,
          });
          close();
          showToast("Tâche mise à jour");
        },
      },
    ],
  });
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}
