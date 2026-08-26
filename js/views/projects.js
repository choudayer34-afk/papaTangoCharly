// Vue Projets — §36 à §38 : "Où en est Modernisation ?" et la possibilité de descendre
// jusqu'à la tâche précise (§71).

import * as projectsApi from "../domain/projects.js";
import * as tasksApi from "../domain/tasks.js";
import * as resourcesApi from "../domain/resources.js";
import * as followUpsApi from "../domain/followups.js";
import * as meetingsApi from "../domain/meetings.js";
import * as decisionsApi from "../domain/decisions.js";
import * as historyApi from "../domain/history.js";
import { openModal, closeModal, confirmDelete } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { openCreateResourceModal, renderResourceList, openResourcePickerModal } from "./resources.js";
import { renderHistoryTimeline } from "../components/historyTimeline.js";

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
  container.querySelector("#new-project-btn").addEventListener("click", () => openCreateProjectModal());

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

/**
 * Exportée pour être réutilisée depuis la qualification Inbox (§13) avec un titre
 * pré-rempli à partir de la capture brute, sans dupliquer ce formulaire — même pattern
 * que openCreateResourceModal côté Ressources.
 */
export function openCreateProjectModal(prefill = {}) {
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="project-name">Nom</label>
      <input id="project-name" type="text" placeholder="Ex. Communication Agro" value="${escapeAttr(prefill.name || "")}" />
    </div>
    <div class="field">
      <label for="project-objective">Objectif (optionnel)</label>
      <textarea id="project-objective" placeholder="Qu'est-ce qu'on cherche à obtenir ?">${escapeHtml(prefill.objective || "")}</textarea>
    </div>
  `;
  const { bodyEl, close } = openModal({
    title: "Nouveau projet",
    body,
    actions: [
      { label: "Annuler", variant: "ghost", onClick: () => prefill.onCancel?.() },
      {
        label: "Créer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          const name = bodyEl.querySelector("#project-name").value.trim();
          if (!name) return;
          const project = await projectsApi.createProject({
            name,
            objective: bodyEl.querySelector("#project-objective").value.trim(),
          });
          close();
          showToast("Projet créé");
          prefill.onCreated?.(project);
        },
      },
    ],
  });
}

async function openProjectDetail(project, tasks) {
  const progress = projectsApi.computeProgress(tasks);
  const [allResources, allFollowUps, allMeetings, allDecisions, allHistory] = await Promise.all([
    resourcesApi.listAll(),
    followUpsApi.listAll(),
    meetingsApi.listAll(),
    decisionsApi.listAll(),
    historyApi.listAll(),
  ]);
  const linkedResources = allResources.filter((r) => (r.projectIds || []).includes(project.id));
  const unlinkedResources = allResources.filter((r) => !(r.projectIds || []).includes(project.id));
  const linkedFollowUps = allFollowUps.filter((f) => f.projectId === project.id);
  const linkedMeetings = allMeetings.filter((m) => m.projectId === project.id);
  const linkedDecisions = allDecisions.filter((d) => d.projectId === project.id);

  // §46 : l'historique d'un projet n'est pas que le sien — c'est le fil de tout ce qui lui
  // est rattaché (tâches, suivis, réunions, décisions, ressources), exactement comme
  // l'exemple du cahier des charges ("Demande reçue → Réunion → Décision → Action créée →
  // Validation → Publication").
  const trackedKeys = new Set([
    `Project:${project.id}`,
    ...tasks.map((t) => `Task:${t.id}`),
    ...linkedFollowUps.map((f) => `FollowUp:${f.id}`),
    ...linkedMeetings.map((m) => `Meeting:${m.id}`),
    ...linkedDecisions.map((d) => `Decision:${d.id}`),
    ...linkedResources.map((r) => `Resource:${r.id}`),
  ]);
  const projectHistory = allHistory
    .filter((h) => trackedKeys.has(`${h.entityType}:${h.entityId}`))
    .sort((a, b) => a.date - b.date);

  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="detail-name">Nom</label>
      <input id="detail-name" type="text" value="${escapeAttr(project.name)}" />
    </div>
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
    <div class="section-title">👀 Suivis (${linkedFollowUps.length})</div>
    <div class="card" id="detail-followups" style="margin-bottom:16px;"></div>
    <div class="section-title">🗓️ Réunions (${linkedMeetings.length})</div>
    <div class="card" id="detail-meetings" style="margin-bottom:16px;"></div>
    <div class="section-title">🗳️ Décisions (${linkedDecisions.length})</div>
    <div class="card" id="detail-decisions" style="margin-bottom:16px;"></div>
    <div class="section-title">📎 Ressources (${linkedResources.length})</div>
    <div class="card" id="detail-resources" style="margin-bottom:8px;"></div>
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <button id="link-resource-btn" class="btn btn-secondary btn-sm">🔗 Lier existante</button>
      <button id="new-resource-btn-inline" class="btn btn-secondary btn-sm">+ Nouvelle ressource</button>
    </div>
    <div class="section-title">🕒 Historique (${projectHistory.length})</div>
    <div class="card" id="detail-history" style="margin-bottom:16px;"></div>
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

  const followUpsEl = body.querySelector("#detail-followups");
  if (!linkedFollowUps.length) {
    followUpsEl.innerHTML = `<div class="empty-state" style="padding:16px;">Aucun suivi lié pour l'instant.</div>`;
  } else {
    for (const f of linkedFollowUps) {
      const row = document.createElement("div");
      row.className = "item-row";
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">${escapeHtml(f.title)}</div>
          <div class="item-meta">${f.controlDate ? "Contrôle : " + formatDate(f.controlDate) : "Pas de date de contrôle"}</div>
        </div>
        <span class="badge badge-${f.status}">${followUpsApi.STATUS_LABELS[f.status]}</span>
      `;
      followUpsEl.appendChild(row);
    }
  }

  const meetingsEl = body.querySelector("#detail-meetings");
  if (!linkedMeetings.length) {
    meetingsEl.innerHTML = `<div class="empty-state" style="padding:16px;">Aucune réunion liée pour l'instant.</div>`;
  } else {
    for (const m of linkedMeetings) {
      const row = document.createElement("div");
      row.className = "item-row";
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">${escapeHtml(m.title)}</div>
          <div class="item-meta">${m.date ? formatDate(m.date) : "Pas de date"}${m.objective ? " · " + escapeHtml(m.objective) : ""}</div>
        </div>
      `;
      meetingsEl.appendChild(row);
    }
  }

  const decisionsEl = body.querySelector("#detail-decisions");
  if (!linkedDecisions.length) {
    decisionsEl.innerHTML = `<div class="empty-state" style="padding:16px;">Aucune décision liée pour l'instant.</div>`;
  } else {
    for (const d of linkedDecisions) {
      const row = document.createElement("div");
      row.className = "item-row";
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">${escapeHtml(d.title)}</div>
          <div class="item-meta">${escapeHtml(d.decision)}</div>
        </div>
      `;
      decisionsEl.appendChild(row);
    }
  }

  const resourcesEl = body.querySelector("#detail-resources");
  renderResourceList(resourcesEl, linkedResources, {
    onUnlink: (r) => resourcesApi.linkToProject(r.id, project.id, false),
  });

  renderHistoryTimeline(body.querySelector("#detail-history"), projectHistory);

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
        label: "🗑️ Supprimer",
        variant: "danger",
        closesModal: false,
        onClick: () => {
          closeModal();
          confirmDelete({
            title: "Supprimer ce projet ?",
            message: `« ${project.name} » sera définitivement supprimé. Les tâches, suivis, réunions, décisions et ressources qui lui étaient rattachés ne sont pas supprimés — ils perdent simplement leur lien vers ce projet.`,
            onConfirm: async () => {
              await projectsApi.removeProject(project.id);
              showToast("Projet supprimé");
            },
            onCancel: () => openProjectDetail(project, tasks),
          });
        },
      },
      {
        label: "Enregistrer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          const name = bodyEl.querySelector("#detail-name").value.trim();
          if (!name) return;
          await projectsApi.updateProject(project.id, {
            name,
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
