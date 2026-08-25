// Dashboard — "🏠 Mon pilotage" (§50). Ne contient aucune logique métier propre :
// il ne fait que consommer les services existants (§78.15) et afficher les chiffres.

import * as tasksApi from "../domain/tasks.js";
import * as inboxApi from "../domain/inbox.js";
import * as projectsApi from "../domain/projects.js";

export function renderDashboard(container) {
  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Mon pilotage</h1>
        <div class="subtitle">${formatToday()}</div>
      </div>
    </div>
    <div class="view">
      <div class="stat-grid" id="stat-grid"></div>
      <div id="projects-section"></div>
    </div>
  `;

  const statGrid = container.querySelector("#stat-grid");
  const projectsSection = container.querySelector("#projects-section");

  let tasks = [];
  let inboxPendingCount = 0;
  let projects = [];

  function renderStats() {
    const late = tasks.filter(tasksApi.isLate).length;
    const followUp = tasks.filter((t) => t.status === "follow_up").length;
    const waiting = tasks.filter((t) => t.status === "waiting").length;

    statGrid.innerHTML = `
      <div class="stat-tile stat-danger">
        <div class="stat-value">${late}</div>
        <div class="stat-label">🔴 En retard</div>
      </div>
      <div class="stat-tile">
        <div class="stat-value">${inboxPendingCount}</div>
        <div class="stat-label">📥 À traiter</div>
      </div>
      <div class="stat-tile stat-warning">
        <div class="stat-value">${followUp}</div>
        <div class="stat-label">👀 À suivre</div>
      </div>
      <div class="stat-tile">
        <div class="stat-value">${waiting}</div>
        <div class="stat-label">⏳ En attente</div>
      </div>
    `;
  }

  function renderProjects() {
    projectsSection.innerHTML = `<div class="section-title">📦 Mes projets</div>`;
    if (!projects.length) {
      projectsSection.innerHTML += `
        <div class="empty-state">
          <span class="emoji">📦</span>
          Pas encore de projet. Ils apparaîtront ici une fois créés depuis une tâche.
        </div>`;
      return;
    }
    const list = document.createElement("div");
    list.className = "card";
    for (const project of projects) {
      const count = tasks.filter((t) => t.projectId === project.id && t.status !== "done").length;
      const row = document.createElement("div");
      row.className = "item-row";
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">${escapeHtml(project.name)}</div>
          <div class="item-meta">${count} tâche(s) en cours</div>
        </div>`;
      list.appendChild(row);
    }
    projectsSection.appendChild(list);
  }

  const unsubTasks = tasksApi.subscribe((items) => {
    tasks = items;
    renderStats();
    renderProjects();
  });
  const unsubInbox = inboxApi.subscribePending((items) => {
    inboxPendingCount = items.length;
    renderStats();
  });
  const unsubProjects = projectsApi.subscribe((items) => {
    projects = items;
    renderProjects();
  });

  return function cleanup() {
    unsubTasks();
    unsubInbox();
    unsubProjects();
  };
}

function formatToday() {
  return new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
