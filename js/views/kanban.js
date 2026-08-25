// Kanban — vue principale de pilotage opérationnel (§24, §25). Drag & drop obligatoire ;
// déplacer une carte change son statut, rien de plus.

import * as tasksApi from "../domain/tasks.js";
import * as projectsApi from "../domain/projects.js";
import { openModal } from "../components/modal.js";
import { showToast } from "../components/toast.js";

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
  let projects = [];

  function render(tasks) {
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

  const unsubTasks = tasksApi.subscribe(render);
  const unsubProjects = projectsApi.subscribe((items) => {
    projects = items;
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
    <div class="kanban-card-title">${escapeHtml(task.title)}</div>
    <div class="kanban-card-meta">
      ${project ? `<span>📦 ${escapeHtml(project.name)}</span>` : ""}
      ${task.dueDate ? `<span class="${late ? "badge badge-late" : ""}">📅 ${formatDate(task.dueDate)}</span>` : ""}
    </div>
  `;
  return card;
}

function openTaskDetail(task, projects) {
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
  `;

  const { bodyEl, close } = openModal({
    title: "Détail de la tâche",
    body,
    actions: [
      { label: "Fermer", variant: "ghost" },
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
