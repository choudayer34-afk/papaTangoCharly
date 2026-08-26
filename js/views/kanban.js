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

export function renderKanban(container) {
  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Pilotage</h1>
        <div class="subtitle">Glisse une carte pour changer son statut</div>
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

  card.innerHTML = `
    <div class="kanban-card-title">${task.isBlocked ? "🔴 " : ""}${escapeHtml(task.title)}</div>
    <div class="kanban-card-meta">
      ${project ? `<span>📦 ${escapeHtml(project.name)}</span>` : ""}
      ${task.dueDate ? `<span class="${late ? "badge badge-late" : ""}">📅 ${formatDate(task.dueDate)}</span>` : ""}
    </div>
  `;
  return card;
}

async function openTaskDetail(task, projects) {
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
  `;

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
