// Dashboard — "🏠 Mon pilotage" (§50). Ne contient aucune logique métier propre :
// il ne fait que consommer les services existants (§78.15) et afficher les chiffres.

import * as tasksApi from "../domain/tasks.js";
import * as inboxApi from "../domain/inbox.js";
import * as projectsApi from "../domain/projects.js";
import * as meetingsApi from "../domain/meetings.js";
import * as decisionsApi from "../domain/decisions.js";
import * as historyApi from "../domain/history.js";
import * as peopleApi from "../domain/people.js";
import * as followUpsApi from "../domain/followups.js";
import { openModal, closeModal, confirmDelete } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { renderHistoryTimeline } from "../components/historyTimeline.js";
import { openPersonDetail } from "./people.js";

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
      <div id="followups-section"></div>
      <div id="projects-section"></div>
      <div id="recent-section"></div>
    </div>
  `;

  const statGrid = container.querySelector("#stat-grid");
  const followUpsSection = container.querySelector("#followups-section");
  const projectsSection = container.querySelector("#projects-section");
  const recentSection = container.querySelector("#recent-section");

  let tasks = [];
  let inboxPendingCount = 0;
  let projects = [];
  let meetings = [];
  let decisions = [];
  let people = [];
  let followUps = [];

  function renderStats() {
    const late = tasks.filter(tasksApi.isLate).length;
    const followUp = tasks.filter((t) => t.status === "follow_up").length;
    const waiting = tasks.filter((t) => t.status === "waiting").length;
    const overdueFollowUps = followUps.filter(followUpsApi.isControlDue).length;

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
      <div class="stat-tile ${overdueFollowUps ? "stat-danger" : ""}">
        <div class="stat-value">${overdueFollowUps}</div>
        <div class="stat-label">📣 Relances dues</div>
      </div>
    `;
  }

  /**
   * §33/§38 : les suivis collaborateurs dont la date de contrôle est dépassée n'étaient
   * visibles auparavant que via un petit compteur dans la liste Équipe — on ne les "attend"
   * jamais si on n'ouvre pas cette liste. Les faire remonter ici, là où le pilotage
   * quotidien se passe, c'est ce qui permet de répondre à "ai-je bien relancé les bonnes
   * personnes ?" sans avoir à s'en souvenir soi-même.
   */
  function renderFollowUpsSection() {
    const overdue = followUps.filter(followUpsApi.isControlDue);
    if (!overdue.length) {
      followUpsSection.innerHTML = "";
      return;
    }
    const peopleById = new Map(people.map((p) => [p.id, p]));
    followUpsSection.innerHTML = `<div class="section-title" style="margin-top:0;">📣 Suivis à relancer (${overdue.length})</div>`;
    const list = document.createElement("div");
    list.className = "card";
    for (const f of overdue) {
      const person = peopleById.get(f.personId);
      const row = document.createElement("div");
      row.className = "item-row";
      row.style.cursor = person ? "pointer" : "default";
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">${person ? escapeHtml(person.name) : "Personne supprimée"} — ${escapeHtml(f.title)}</div>
          <div class="item-meta">Contrôle prévu : ${f.controlDate ? formatDate(f.controlDate) : "?"}</div>
        </div>
        <span class="badge badge-late">🔴</span>
      `;
      if (person) row.addEventListener("click", () => openPersonDetail(person, followUps));
      list.appendChild(row);
    }
    followUpsSection.appendChild(list);
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
      row.addEventListener("click", () => openRecentDetail(item, projects));
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
  const unsubPeople = peopleApi.subscribe((items) => {
    people = items;
    renderFollowUpsSection();
  });
  const unsubFollowUps = followUpsApi.subscribe((items) => {
    followUps = items;
    renderStats();
    renderFollowUpsSection();
  });

  return function cleanup() {
    unsubTasks();
    unsubInbox();
    unsubProjects();
    unsubMeetings();
    unsubDecisions();
    unsubPeople();
    unsubFollowUps();
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

/**
 * Fiche modifiable — réunion ou décision. Un seul formulaire pour les deux, les champs
 * spécifiques (objectif/notes vs décision/contexte) changeant selon item.kind ; le déroulé
 * complet Avant/Pendant/Après viendra avec les canevas pilotés par données (§14-19).
 */
function openRecentDetail(item, projects) {
  const isMeeting = item.kind === "meeting";
  const data = item.data;

  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="rd-title">Titre</label>
      <input id="rd-title" type="text" value="${escapeAttr(data.title)}" />
    </div>
    <div class="field">
      <label for="rd-date">Date</label>
      <input id="rd-date" type="date" value="${data.date || ""}" />
    </div>
    ${
      isMeeting
        ? `
    <div class="field">
      <label for="rd-objective">Objectif</label>
      <textarea id="rd-objective">${escapeHtml(data.objective || "")}</textarea>
    </div>
    <div class="field">
      <label for="rd-notes">Notes</label>
      <textarea id="rd-notes">${escapeHtml(data.notes || "")}</textarea>
    </div>`
        : `
    <div class="field">
      <label for="rd-decision">Décision</label>
      <textarea id="rd-decision">${escapeHtml(data.decision || "")}</textarea>
    </div>
    <div class="field">
      <label for="rd-context">Contexte</label>
      <textarea id="rd-context">${escapeHtml(data.context || "")}</textarea>
    </div>`
    }
    <div class="field">
      <label for="rd-project">Projet</label>
      <select id="rd-project">
        <option value="">— Aucun —</option>
        ${projects.map((p) => `<option value="${p.id}" ${p.id === data.projectId ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("")}
      </select>
    </div>
  `;

  const { bodyEl, close } = openModal({
    title: `${item.emoji} ${data.title}`,
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
            title: isMeeting ? "Supprimer cette réunion ?" : "Supprimer cette décision ?",
            message: `« ${data.title} » sera définitivement supprimée.`,
            onConfirm: async () => {
              if (isMeeting) await meetingsApi.removeMeeting(data.id);
              else await decisionsApi.removeDecision(data.id);
              showToast(isMeeting ? "Réunion supprimée" : "Décision supprimée");
            },
            onCancel: () => openRecentDetail(item, projects),
          });
        },
      },
      {
        label: "Enregistrer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          const title = bodyEl.querySelector("#rd-title").value.trim();
          if (!title) return;
          const patch = {
            title,
            date: bodyEl.querySelector("#rd-date").value || null,
            projectId: bodyEl.querySelector("#rd-project").value || null,
          };
          if (isMeeting) {
            patch.objective = bodyEl.querySelector("#rd-objective").value.trim();
            patch.notes = bodyEl.querySelector("#rd-notes").value.trim();
            await meetingsApi.updateMeeting(data.id, patch);
          } else {
            patch.decision = bodyEl.querySelector("#rd-decision").value.trim();
            patch.context = bodyEl.querySelector("#rd-context").value.trim();
            await decisionsApi.updateDecision(data.id, patch);
          }
          close();
          showToast(isMeeting ? "Réunion mise à jour" : "Décision mise à jour");
        },
      },
    ],
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

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}
