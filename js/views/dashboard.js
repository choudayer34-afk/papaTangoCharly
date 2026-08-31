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
import * as preferencesApi from "../domain/preferences.js";
import { openModal, closeModal, confirmDelete } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { renderHistoryTimeline } from "../components/historyTimeline.js";
import { openPersonDetail } from "./people.js";
import { openProjectDetail } from "./projects.js";
import { openTaskDetail } from "./kanban.js";
import * as linkedItemsApi from "../components/linkedItems.js";
import { renderCanevas } from "../components/canevas.js";
import { openWeeklyReview } from "../components/weeklyReview.js";
import { openQualifyChoice } from "./inbox.js";

const KEPT_TYPE_LABELS = { kept: "🧠 Information", idea: "💡 Idée" };

export function renderDashboard(container) {
  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Mon pilotage</h1>
        <div class="subtitle">${formatToday()}</div>
      </div>
      <button id="weekly-review-btn" class="btn btn-secondary btn-sm">🧭 Revue hebdo</button>
    </div>
    <div class="view">
      <div class="stat-grid" id="stat-grid"></div>
      <div id="due-soon-section"></div>
      <div id="followups-section"></div>
      <div id="kept-section"></div>
      <div id="projects-section"></div>
      <div id="recent-section"></div>
    </div>
  `;

  container.querySelector("#weekly-review-btn").addEventListener("click", () => openWeeklyReview());

  const statGrid = container.querySelector("#stat-grid");
  const dueSoonSection = container.querySelector("#due-soon-section");
  const followUpsSection = container.querySelector("#followups-section");
  const keptSection = container.querySelector("#kept-section");
  const projectsSection = container.querySelector("#projects-section");
  const recentSection = container.querySelector("#recent-section");

  let tasks = [];
  let inboxPendingCount = 0;
  let projects = [];
  let meetings = [];
  let decisions = [];
  let people = [];
  let followUps = [];
  let keptItems = [];
  let projectSortMode = "manual";
  let categories = {};

  preferencesApi.getPreferences().then((prefs) => {
    projectSortMode = prefs.projectSort || "manual";
    categories = prefs.categories || {};
    renderProjectsSection();
  });

  /** Liste cliquable réutilisée par chaque carte chiffrée (retour de Charles-Henri : les
   *  cartes >0 doivent pouvoir s'ouvrir pour voir le détail) — un même petit gabarit pour les
   *  tâches, qu'il s'agisse de retards (avec la durée du retard), d'aujourd'hui, ou des
   *  statuts À suivre/En attente. */
  function openTaskListModal(title, list) {
    const body = document.createElement("div");
    const listEl = document.createElement("div");
    listEl.className = "card";
    if (!list.length) {
      listEl.innerHTML = `<div class="empty-state" style="padding:16px;">Rien ici. 🎉</div>`;
    } else {
      for (const t of list) {
        const project = t.projectId ? projects.find((p) => p.id === t.projectId) : null;
        const late = tasksApi.isLate(t);
        const row = document.createElement("div");
        row.className = "item-row";
        row.style.cursor = "pointer";
        row.innerHTML = `
          <div class="item-main">
            <div class="item-title">${t.isBlocked ? "🔴 " : ""}${escapeHtml(t.title)}</div>
            <div class="item-meta">
              ${t.dueDate ? formatDate(t.dueDate) : "Pas d'échéance"}${late ? ` · <strong style="color:var(--color-danger);">en retard depuis ${daysLate(t.dueDate)} j</strong>` : ""}${project ? " · 📦 " + escapeHtml(project.name) : ""}
            </div>
          </div>
          <span class="badge badge-${t.status}">${tasksApi.STATUS_LABELS[t.status]}</span>
        `;
        row.addEventListener("click", () => {
          closeModal();
          openTaskDetail(t, projects);
        });
        listEl.appendChild(row);
      }
    }
    body.appendChild(listEl);
    openModal({ title, body, actions: [{ label: "Fermer", variant: "ghost" }] });
  }

  function openFollowUpListModal(title, list) {
    const peopleById = new Map(people.map((p) => [p.id, p]));
    const body = document.createElement("div");
    const listEl = document.createElement("div");
    listEl.className = "card";
    if (!list.length) {
      listEl.innerHTML = `<div class="empty-state" style="padding:16px;">Rien ici. 🎉</div>`;
    } else {
      for (const f of list) {
        const person = peopleById.get(f.personId);
        const isToTell = f.direction === "to_tell";
        const row = document.createElement("div");
        row.className = "item-row";
        row.style.cursor = person ? "pointer" : "default";
        row.innerHTML = `
          <div class="item-main">
            <div class="item-title">${isToTell ? "📣 " : ""}${person ? escapeHtml(person.name) : "Personne supprimée"} — ${escapeHtml(f.title)}</div>
            <div class="item-meta">${isToTell ? "À dire avant" : "Contrôle prévu"} : ${f.controlDate ? formatDate(f.controlDate) : "?"}</div>
          </div>
        `;
        if (person) {
          row.addEventListener("click", () => {
            closeModal();
            openPersonDetail(person, followUps);
          });
        }
        listEl.appendChild(row);
      }
    }
    body.appendChild(listEl);
    openModal({ title, body, actions: [{ label: "Fermer", variant: "ghost" }] });
  }

  function renderStats() {
    const lateList = tasks.filter(tasksApi.isLate);
    const followUpList = tasks.filter((t) => t.status === "follow_up");
    const waitingList = tasks.filter((t) => t.status === "waiting");
    const todayList = tasks.filter(isDueToday);
    const overdueFollowUpsList = followUps.filter(followUpsApi.isControlDue);

    statGrid.innerHTML = `
      <div class="stat-tile stat-danger" id="stat-late" style="cursor:pointer;">
        <div class="stat-value">${lateList.length}</div>
        <div class="stat-label">🔴 En retard</div>
      </div>
      <div class="stat-tile" id="stat-inbox" style="cursor:pointer;">
        <div class="stat-value">${inboxPendingCount}</div>
        <div class="stat-label">📥 À traiter</div>
      </div>
      <div class="stat-tile" id="stat-today" style="cursor:pointer;">
        <div class="stat-value">${todayList.length}</div>
        <div class="stat-label">📅 Aujourd'hui</div>
      </div>
      <div class="stat-tile stat-warning" id="stat-followup" style="cursor:pointer;">
        <div class="stat-value">${followUpList.length}</div>
        <div class="stat-label">👀 À suivre</div>
      </div>
      <div class="stat-tile" id="stat-waiting" style="cursor:pointer;">
        <div class="stat-value">${waitingList.length}</div>
        <div class="stat-label">⏳ En attente</div>
      </div>
      <div class="stat-tile ${overdueFollowUpsList.length ? "stat-danger" : ""}" id="stat-relances" style="cursor:pointer;">
        <div class="stat-value">${overdueFollowUpsList.length}</div>
        <div class="stat-label">📣 Relances dues</div>
      </div>
    `;
    statGrid.querySelector("#stat-late").addEventListener("click", () => openTaskListModal("🔴 En retard", lateList));
    statGrid.querySelector("#stat-inbox").addEventListener("click", () => {
      location.hash = "#/inbox";
    });
    statGrid.querySelector("#stat-today").addEventListener("click", () => openTaskListModal("📅 Échéances d'aujourd'hui", todayList));
    statGrid.querySelector("#stat-followup").addEventListener("click", () => openTaskListModal("👀 À suivre", followUpList));
    statGrid.querySelector("#stat-waiting").addEventListener("click", () => openTaskListModal("⏳ En attente", waitingList));
    statGrid.querySelector("#stat-relances").addEventListener("click", () => openFollowUpListModal("📣 Relances dues", overdueFollowUpsList));
  }

  /**
   * Rubrique pliable/dépliable (retour de Charles-Henri) : les tâches non terminées dont
   * l'échéance tombe dans les 7 prochains jours — distinct du retard (déjà couvert par la
   * carte 🔴) et distinct d'"Aujourd'hui" (déjà sa propre carte), la vraie question ici est
   * "qu'est-ce qui arrive cette semaine ?".
   */
  function renderDueSoonSection() {
    const dueSoon = tasks.filter((t) => t.status !== "done" && t.dueDate && daysFromToday(t.dueDate) > 0 && daysFromToday(t.dueDate) <= 7);
    dueSoonSection.innerHTML = `
      <details ${dueSoon.length ? "open" : ""}>
        <summary class="section-title" style="margin-top:0;cursor:pointer;">🗓️ À échéance dans les 7 jours (${dueSoon.length})</summary>
        <div class="card" id="due-soon-list" style="margin-top:8px;margin-bottom:16px;"></div>
      </details>
    `;
    const listEl = dueSoonSection.querySelector("#due-soon-list");
    if (!dueSoon.length) {
      listEl.innerHTML = `<div class="empty-state" style="padding:16px;">Rien cette semaine. 🎉</div>`;
      return;
    }
    for (const t of [...dueSoon].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))) {
      const row = document.createElement("div");
      row.className = "item-row";
      row.style.cursor = "pointer";
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">${escapeHtml(t.title)}</div>
          <div class="item-meta">${formatDate(t.dueDate)}</div>
        </div>
      `;
      row.addEventListener("click", () => openTaskDetail(t, projects));
      listEl.appendChild(row);
    }
  }

  /**
   * §47 "information de contexte" : retour de Charles-Henri, les Informations/Idées
   * qualifiées depuis l'Inbox ne remontaient nulle part une fois traitées. Lecture simple,
   * avec un raccourci pour les archiver directement d'ici si elles ne servent plus.
   */
  function renderKeptSection() {
    if (!keptItems.length) {
      keptSection.innerHTML = "";
      return;
    }
    keptSection.innerHTML = `<div class="section-title">🧠 Informations & idées (${keptItems.length})</div>`;
    const list = document.createElement("div");
    list.className = "card";
    for (const item of [...keptItems].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8)) {
      const row = document.createElement("div");
      row.className = "item-row";
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">${escapeHtml(item.rawContent)}</div>
          <div class="item-meta">${KEPT_TYPE_LABELS[item.keptAsType] || KEPT_TYPE_LABELS.kept} · ${formatDate(item.createdAt)}</div>
        </div>
      `;
      const btn = document.createElement("button");
      btn.className = "btn btn-ghost btn-sm";
      btn.textContent = "Archiver";
      btn.addEventListener("click", async () => {
        await inboxApi.qualify(item.id, "archived");
        showToast("Archivé");
      });
      row.appendChild(btn);
      list.appendChild(row);
    }
    keptSection.appendChild(list);
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
    followUpsSection.innerHTML = `<div class="section-title" style="margin-top:0;">📣 Suivis en retard (${overdue.length})</div>`;
    const list = document.createElement("div");
    list.className = "card";
    for (const f of overdue) {
      const person = peopleById.get(f.personId);
      const isToTell = f.direction === "to_tell";
      const row = document.createElement("div");
      row.className = "item-row";
      row.style.cursor = person ? "pointer" : "default";
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">${isToTell ? "📣 " : ""}${person ? escapeHtml(person.name) : "Personne supprimée"} — ${escapeHtml(f.title)}</div>
          <div class="item-meta">${isToTell ? "À dire avant" : "Contrôle prévu"} : ${f.controlDate ? formatDate(f.controlDate) : "?"}</div>
        </div>
        <span class="badge badge-late">🔴</span>
      `;
      if (person) row.addEventListener("click", () => openPersonDetail(person, followUps));
      list.appendChild(row);
    }
    followUpsSection.appendChild(list);
  }

  /**
   * L'ordre des projets ici reprend celui de l'onglet Projets (retour de Charles-Henri) —
   * même fonction de tri (`projectsApi.sortProjects`), même mode (avancement ou manuel) lu
   * depuis les préférences, pour ne jamais avoir deux logiques d'ordonnancement qui divergent.
   */
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
    const tasksByProject = new Map();
    for (const project of active) tasksByProject.set(project.id, tasks.filter((t) => t.projectId === project.id));
    const ordered = projectsApi.sortProjects(active, projectSortMode, tasksByProject);

    const list = document.createElement("div");
    list.className = "card";
    for (const project of ordered) {
      const projectTasks = tasksByProject.get(project.id) || [];
      const progress = projectsApi.computeProgress(projectTasks);
      const icon = preferencesApi.categoryIcon(categories, project.category);
      const row = document.createElement("div");
      row.className = "item-row";
      row.style.cursor = "pointer";
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">${icon ? icon + " " : ""}${escapeHtml(project.name)}</div>
          <div style="height:5px;background:var(--color-surface-alt);border-radius:var(--radius-pill);overflow:hidden;margin-top:6px;">
            <div style="height:100%;width:${progress.percent}%;background:var(--color-primary);"></div>
          </div>
        </div>
        <div style="font-weight:700;color:var(--color-primary);">${progress.percent}%</div>
      `;
      row.addEventListener("click", () => openProjectDetail(project, projectTasks));
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
    renderDueSoonSection();
    renderProjectsSection();
  });
  const unsubInbox = inboxApi.subscribePending((items) => {
    inboxPendingCount = items.length;
    renderStats();
  });
  const unsubKept = inboxApi.subscribeKept((items) => {
    keptItems = items;
    renderKeptSection();
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
    unsubKept();
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
 * "+ Créer et lier" (fil conducteur, components/linkedItems.js) pour une Réunion. Formulaire
 * minimal — titre + date — le reste (objectif, notes) se complète en rouvrant la fiche.
 */
export function openCreateMeetingModal(prefill = {}) {
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="new-meeting-title">Titre</label>
      <input id="new-meeting-title" type="text" placeholder="Ex. Point collaborateur" value="${escapeAttr(prefill.title || "")}" />
    </div>
    <div class="field">
      <label for="new-meeting-date">Date</label>
      <input id="new-meeting-date" type="date" value="${new Date().toISOString().slice(0, 10)}" />
    </div>
    <div class="field">
      <label for="new-meeting-canevas">Canevas (optionnel)</label>
      <select id="new-meeting-canevas">
        ${meetingsApi.CANEVAS_OPTIONS.map((c) => `<option value="${c.key}">${c.label}</option>`).join("")}
      </select>
    </div>
  `;
  const { bodyEl, close } = openModal({
    title: "Nouvelle réunion",
    body,
    actions: [
      { label: "Annuler", variant: "ghost", onClick: () => prefill.onCancel?.() },
      {
        label: "Créer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          const title = bodyEl.querySelector("#new-meeting-title").value.trim();
          if (!title) return;
          const meeting = await meetingsApi.createMeeting({
            title,
            date: bodyEl.querySelector("#new-meeting-date").value || null,
            canevasKey: bodyEl.querySelector("#new-meeting-canevas").value,
            projectId: prefill.projectId || null,
          });
          close();
          showToast("Réunion créée");
          prefill.onCreated?.(meeting);
        },
      },
    ],
  });
}

/**
 * "+ Créer et lier" pour une Décision. Formulaire minimal — sujet + ce qui a été décidé —
 * le contexte détaillé se complète en rouvrant la fiche.
 */
export function openCreateDecisionModal(prefill = {}) {
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="new-decision-title">Sujet</label>
      <input id="new-decision-title" type="text" placeholder="Ex. Retard récurrent de D" value="${escapeAttr(prefill.title || "")}" />
    </div>
    <div class="field">
      <label for="new-decision-decision">Ce qui a été décidé</label>
      <textarea id="new-decision-decision"></textarea>
    </div>
  `;
  const { bodyEl, close } = openModal({
    title: "Nouvelle décision",
    body,
    actions: [
      { label: "Annuler", variant: "ghost", onClick: () => prefill.onCancel?.() },
      {
        label: "Créer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          const title = bodyEl.querySelector("#new-decision-title").value.trim();
          if (!title) return;
          const decision = await decisionsApi.createDecision({
            title,
            decision: bodyEl.querySelector("#new-decision-decision").value.trim(),
            date: new Date().toISOString().slice(0, 10),
            projectId: prefill.projectId || null,
          });
          close();
          showToast("Décision enregistrée");
          prefill.onCreated?.(decision);
        },
      },
    ],
  });
}

/**
 * Fiche modifiable — réunion ou décision. Un seul formulaire pour les deux, les champs
 * spécifiques (objectif/notes vs décision/contexte) changeant selon item.kind ; le déroulé
 * complet Avant/Pendant/Après viendra avec les canevas pilotés par données (§14-19).
 */
/**
 * `onClose` (optionnel) : voir la même logique côté openTaskDetail (kanban.js) — nécessaire
 * pour que cliquer sur une réunion/décision depuis le bloc correspondant de la fiche projet
 * ramène à cette fiche projet en fermant/enregistrant plutôt que de révéler l'écran du dessous.
 */
export function openRecentDetail(item, projects, { onClose } = {}) {
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
    ${isMeeting ? `<div id="rd-canevas"></div>` : ""}
    <div class="section-title">🔗 Lié</div>
    <div class="card" id="detail-links" style="margin-bottom:8px;"></div>
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <button id="link-existing-btn" class="btn btn-secondary btn-sm">🔗 Lier une fiche</button>
      <button id="create-linked-btn" class="btn btn-secondary btn-sm">+ Créer et lier</button>
    </div>
  `;

  if (isMeeting) {
    renderCanevas(body.querySelector("#rd-canevas"), data.steps, async (stepKey, done) => {
      await meetingsApi.toggleStep(data.id, stepKey, done);
    });
  }

  const linkRef = { type: isMeeting ? "Meeting" : "Decision", id: data.id };
  linkedItemsApi.renderLinkedSection(body.querySelector("#detail-links"), linkRef);
  body.querySelector("#link-existing-btn").addEventListener("click", () => {
    closeModal();
    linkedItemsApi.openLinkPickerModal(linkRef, data.title, {
      onLinked: () => openRecentDetail(item, projects, { onClose }),
      onCancel: () => openRecentDetail(item, projects, { onClose }),
    });
  });
  body.querySelector("#create-linked-btn").addEventListener("click", () => {
    closeModal();
    linkedItemsApi.openCreateAndLinkModal(linkRef, data.title, {
      onLinked: () => openRecentDetail(item, projects, { onClose }),
      onCancel: () => openRecentDetail(item, projects, { onClose }),
    });
  });

  const { bodyEl, close } = openModal({
    title: `${item.emoji} ${data.title}`,
    body,
    actions: [
      { label: "Fermer", variant: "ghost", onClick: () => onClose?.() },
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
              onClose?.();
            },
            onCancel: () => openRecentDetail(item, projects, { onClose }),
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
          onClose?.();
        },
      },
    ],
  });
}

function isDueToday(task) {
  if (!task.dueDate || task.status === "done") return false;
  return daysFromToday(task.dueDate) === 0;
}

function daysLate(dateStr) {
  return -daysFromToday(dateStr);
}

function daysFromToday(dateStr) {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
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
