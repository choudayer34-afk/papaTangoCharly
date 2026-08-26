// Dashboard — "🏠 Mon pilotage" (§50). Ne contient aucune logique métier propre :
// il ne fait que consommer les services existants (§78.15) et afficher les chiffres.

import * as tasksApi from "../domain/tasks.js";
import * as inboxApi from "../domain/inbox.js";
import * as projectsApi from "../domain/projects.js";
import * as meetingsApi from "../domain/meetings.js";
import * as decisionsApi from "../domain/decisions.js";
import * as historyApi from "../domain/history.js";
import { openModal } from "../components/modal.js";
import { renderHistoryTimeline } from "../components/historyTimeline.js";

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
      <div id="recent-section"></div>
    </div>
  `;

  const statGrid = container.querySelector("#stat-grid");
  const projectsSection = container.querySelector("#projects-section");
  const recentSection = container.querySelector("#recent-section");

  let tasks = [];
  let inboxPendingCount = 0;
  let projects = [];
  let meetings = [];
  let decisions = [];

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

  function renderProjectsSection() {
    projectsSection.innerHTML = `<div class="section-title">📦 Mes projets</div>`;
    const active = projects.filter((p) => p.status === "active");
    if (!active.length) {
      projectsSection.innerHTML += `
        <div class="empty-state">
          <span class="emoji">📦</span>
          Pas encore de projet. Crée-en un depuis l'onglet Projets.
        </div>`;
      return;
    }
    const list = document.createElement("div");
    list.className = "card";
    for (const project of active) {
      const projectTasks = tasks.filter((t) => t.projectId === project.id);
      const progress = projectsApi.computeProgress(projectTasks);
      const row = document.createElement("div");
      row.className = "item-row";
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">${escapeHtml(project.name)}</div>
          <div style="height:5px;background:var(--color-surface-alt);border-radius:var(--radius-pill);overflow:hidden;margin-top:6px;">
            <div style="height:100%;width:${progress.percent}%;background:var(--color-primary);"></div>
          </div>
        </div>
        <div style="font-weight:700;color:var(--color-primary);">${progress.percent}%</div>
      `;
      list.appendChild(row);
    }
    projectsSection.appendChild(list);
  }

  /**
   * §50 "🧠 Récemment" : tant que la recherche globale et l'historique visible (§45/§46)
   * n'existent pas encore, c'est ici qu'une réunion ou une décision capturée sans projet
   * reste malgré tout retrouvable — sinon elle serait bien enregistrée (jamais perdue,
   * Règle 3) mais invisible nulle part dans l'interface.
   */
  function renderRecentSection() {
    const projectById = new Map(projects.map((p) => [p.id, p]));
    const items = [
      ...meetings.map((m) => ({ kind: "meeting", emoji: "🗓️", label: "Réunion", date: m.date || m.createdAt, data: m })),
      ...decisions.map((d) => ({ kind: "decision", emoji: "🗳️", label: "Décision", date: d.date || d.createdAt, data: d })),
    ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    recentSection.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <div class="section-title" style="margin:var(--space-5) 0 var(--space-2);">🧠 Récemment</div>
        <button id="open-history-btn" class="btn btn-ghost btn-sm">🕒 Tout l'historique</button>
      </div>
    `;
    recentSection.querySelector("#open-history-btn").addEventListener("click", openGlobalHistory);
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = `<span class="emoji">🧠</span>Les réunions et décisions que tu qualifies depuis l'Inbox apparaîtront ici.`;
      recentSection.appendChild(empty);
      return;
    }
    const list = document.createElement("div");
    list.className = "card";
    for (const item of items.slice(0, 8)) {
      const project = item.data.projectId ? projectById.get(item.data.projectId) : null;
      const row = document.createElement("div");
      row.className = "item-row";
      row.style.cursor = "pointer";
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">${item.emoji} ${escapeHtml(item.data.title)}</div>
          <div class="item-meta">
            ${item.label}${item.data.date ? " · " + formatDate(item.data.date) : ""}${project ? " · 📦 " + escapeHtml(project.name) : ""}
          </div>
        </div>
      `;
      row.addEventListener("click", () => openRecentDetail(item));
      list.appendChild(row);
    }
    recentSection.appendChild(list);
  }

  const unsubTasks = tasksApi.subscribe((items) => {
    tasks = items;
    renderStats();
    renderProjectsSection();
  });
  const unsubInbox = inboxApi.subscribePending((items) => {
    inboxPendingCount = items.length;
    renderStats();
  });
  const unsubProjects = projectsApi.subscribe((items) => {
    projects = items;
    renderProjectsSection();
    renderRecentSection();
  });
  const unsubMeetings = meetingsApi.subscribe((items) => {
    meetings = items;
    renderRecentSection();
  });
  const unsubDecisions = decisionsApi.subscribe((items) => {
    decisions = items;
    renderRecentSection();
  });

  return function cleanup() {
    unsubTasks();
    unsubInbox();
    unsubProjects();
    unsubMeetings();
    unsubDecisions();
  };
}

/**
 * §46 : le fil global, tous types confondus, le plus récent en premier — le filet de
 * sécurité pour retrouver une réunion ou décision au-delà des 8 dernières de "Récemment",
 * en attendant la recherche globale (§45/§52).
 */
async function openGlobalHistory() {
  const allHistory = await historyApi.listAll();
  const recent = [...allHistory].sort((a, b) => b.date - a.date).slice(0, 100);

  const body = document.createElement("div");
  const list = document.createElement("div");
  list.className = "card";
  body.appendChild(list);
  renderHistoryTimeline(list, recent);

  openModal({
    title: "🕒 Tout l'historique",
    body,
    actions: [{ label: "Fermer", variant: "ghost" }],
  });
}

/** Vue lecture seule — la modification complète viendra avec les canevas (§14-19). */
function openRecentDetail(item) {
  const body = document.createElement("div");
  if (item.kind === "meeting") {
    body.innerHTML = `
      ${item.data.date ? `<div class="item-meta" style="margin-bottom:12px;">${formatDate(item.data.date)}</div>` : ""}
      ${item.data.objective ? `<div class="section-title" style="margin-top:0;">Objectif</div><div class="card" style="margin-bottom:12px;">${escapeHtml(item.data.objective)}</div>` : ""}
      ${item.data.notes ? `<div class="section-title">Notes</div><div class="card">${escapeHtml(item.data.notes)}</div>` : ""}
    `;
  } else {
    body.innerHTML = `
      ${item.data.date ? `<div class="item-meta" style="margin-bottom:12px;">${formatDate(item.data.date)}</div>` : ""}
      <div class="section-title" style="margin-top:0;">Décision</div>
      <div class="card" style="margin-bottom:12px;">${escapeHtml(item.data.decision)}</div>
      ${item.data.context ? `<div class="section-title">Contexte</div><div class="card">${escapeHtml(item.data.context)}</div>` : ""}
    `;
  }
  openModal({
    title: `${item.emoji} ${item.data.title}`,
    body,
    actions: [{ label: "Fermer", variant: "ghost" }],
  });
}

function formatToday() {
  return new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
