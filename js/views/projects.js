// Vue Projets — §36 à §38 : "Où en est Modernisation ?" et la possibilité de descendre
// jusqu'à la tâche précise (§71).

import * as projectsApi from "../domain/projects.js";
import * as tasksApi from "../domain/tasks.js";
import * as resourcesApi from "../domain/resources.js";
import { openModal, closeModal } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { openCreateResourceModal, renderResourceList, openResourcePickerModal } from "./resources.js";

export function renderProjects(container) {
  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Projets</h1>
        <div class="subtitle" id="projects-subtitle">—</div>
      </div>
      <button id="new-project-btn" class="btn btn-primary btn-sm">+ Projet</button>
    </div>
    <div class="view"><div id="projects-list"></div></div>
  `;

  const listEl = container.querySelector("#projects-list");
  const subtitleEl = container.querySelector("#projects-subtitle");
  container.querySelector("#new-project-btn").addEventListener("click", openCreateProjectModal);

  let projects = [];
  let tasks = [];

  function render() {
    subtitleEl.textContent = projects.length ? `${projects.length} projet(s)` : "Aucun projet";

    if (!projects.length) {
      listEl.innerHTML = `
        <div class="empty-state">
          <span class="emoji">📦</span>
          Pas encore de projet. Crée le premier avec le bouton « + Projet ».
        </div>`;
      return;
    }

    listEl.innerHTML = "";
    for (const project of projects) {
      const projectTasks = tasks.filter((t) => t.projectId === project.id);
      const progress = projectsApi.computeProgress(projectTasks);

      const card = document.createElement("div");
      card.className = "card";
      card.style.marginBottom = "12px";
      card.style.cursor = "pointer";
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:baseline;">
          <div class="item-title">${escapeHtml(project.name)}</div>
          <div style="font-weight:700;color:var(--color-primary);">${progress.percent}%</div>
        </div>
        ${project.objective ? `<div class="item-meta" style="margin-bottom:8px;">${escapeHtml(project.objective)}</div>` : ""}
        <div style="height:6px;background:var(--color-surface-alt);border-radius:var(--radius-pill);overflow:hidden;margin:8px 0;">
          <div style="height:100%;width:${progress.percent}%;background:var(--color-primary);"></div>
        </div>
        <div class="kanban-card-meta">
          <span>🟢 ${progress.done} réalisé</span>
          <span>🔵 ${progress.in_progress} en cours</span>
          <span>⏳ ${progress.waiting} attente</span>
          ${progress.blocked ? `<span class="badge badge-late">🔴 ${progress.blocked} bloqué</span>` : ""}
          <span>⚪ ${progress.todo + progress.follow_up} reste</span>
        </div>
      `;
      card.addEventListener("click", () => openProjectDetail(project, projectTasks));
      listEl.appendChild(card);
    }
  }

  const unsubProjects = projectsApi.subscribe((items) => {
    projects = items.filter((p) => p.status !== "archived");
    render();
  });
  const unsubTasks = tasksApi.subscribe((items) => {
    tasks = items;
    render();
  });

  return function cleanup() {
    unsubProjects();
    unsubTasks();
  };
}

function openCreateProjectModal() {
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="project-name">Nom</label>
      <input id="project-name" type="text" placeholder="Ex. Communication Agro" />
    </div>
    <div class="field">
      <label for="project-objective">Objectif (optionnel)</label>
      <textarea id="project-objective" placeholder="Qu'est-ce qu'on cherche à obtenir ?"></textarea>
    </div>
  `;
  const { bodyEl, close } = openModal({
    title: "Nouveau projet",
    body,
    actions: [
      { label: "Annuler", variant: "ghost" },
      {
        label: "Créer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          const name = bodyEl.querySelector("#project-name").value.trim();
          if (!name) return;
          await projectsApi.createProject({
            name,
            objective: bodyEl.querySelector("#project-objective").value.trim(),
          });
          close();
          showToast("Projet créé");
        },
      },
    ],
  });
}

async function openProjectDetail(project, tasks) {
  const progress = projectsApi.computeProgress(tasks);
  const allResources = await resourcesApi.listAll();
  const linkedResources = allResources.filter((r) => (r.projectIds || []).includes(project.id));
  const unlinkedResources = allResources.filter((r) => !(r.projectIds || []).includes(project.id));

  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="detail-objective">Objectif</label>
      <textarea id="detail-objective">${escapeHtml(project.objective || "")}</textarea>
    </div>
    <div class="field">
      <label for="detail-criteria">Critère de réussite</label>
      <textarea id="detail-criteria" placeholder="Comment saurai-je que ce projet est réussi ?">${escapeHtml(project.successCriteria || "")}</textarea>
    </div>
    <div class="section-title" style="margin-top:0;">Tâches (${progress.total})</div>
    <div class="card" id="detail-tasks" style="margin-bottom:16px;"></div>
    <div class="section-title">📎 Ressources (${linkedResources.length})</div>
    <div class="card" id="detail-resources" style="margin-bottom:8px;"></div>
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <button id="link-resource-btn" class="btn btn-secondary btn-sm">🔗 Lier existante</button>
      <button id="new-resource-btn-inline" class="btn btn-secondary btn-sm">+ Nouvelle ressource</button>
    </div>
  `;

  const tasksEl = body.querySelector("#detail-tasks");
  if (!tasks.length) {
    tasksEl.innerHTML = `<div class="empty-state" style="padding:16px;">Aucune tâche liée pour l'instant.</div>`;
  } else {
    for (const task of tasks) {
      const row = document.createElement("div");
      row.className = "item-row";
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">${escapeHtml(task.title)}</div>
        </div>
        <span class="badge badge-${task.status}">${tasksApi.STATUS_LABELS[task.status]}</span>
      `;
      tasksEl.appendChild(row);
    }
  }

  const resourcesEl = body.querySelector("#detail-resources");
  renderResourceList(resourcesEl, linkedResources, {
    onUnlink: (r) => resourcesApi.linkToProject(r.id, project.id, false),
  });

  body.querySelector("#link-resource-btn").addEventListener("click", () => {
    if (!unlinkedResources.length) {
      showToast("Aucune autre ressource à lier pour l'instant");
      return;
    }
    // Une seule modale à la fois (voir components/modal.js) : on referme la fiche projet
    // avant d'ouvrir le sélecteur, puis on la rouvre avec des données fraîches ensuite —
    // sinon la fiche projet disparaît silencieusement sous le sélecteur.
    closeModal();
    openResourcePickerModal(
      unlinkedResources,
      async (resource) => {
        await resourcesApi.linkToProject(resource.id, project.id, true);
        showToast("Ressource liée");
        openProjectDetail(project, tasks);
      },
      () => openProjectDetail(project, tasks)
    );
  });
  body.querySelector("#new-resource-btn-inline").addEventListener("click", () => {
    closeModal();
    openCreateResourceModal({
      projectId: project.id,
      onCreated: () => openProjectDetail(project, tasks),
      onCancel: () => openProjectDetail(project, tasks),
    });
  });

  const { bodyEl, close } = openModal({
    title: project.name,
    body,
    actions: [
      { label: "Fermer", variant: "ghost" },
      {
        label: "Enregistrer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          await projectsApi.updateProject(project.id, {
            objective: bodyEl.querySelector("#detail-objective").value.trim(),
            successCriteria: bodyEl.querySelector("#detail-criteria").value.trim(),
          });
          close();
          showToast("Projet mis à jour");
        },
      },
    ],
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
