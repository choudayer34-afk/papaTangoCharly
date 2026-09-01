// Calendrier — §26. Vues Mois (par défaut) et Semaine ; la vue Jour est servie par le clic
// sur un jour, qui ouvre son agenda détaillé plutôt que d'être un troisième onglet séparé —
// un jour du mois EST son propre détail, pas une vue en plus à maintenir.
//
// Affiche tâches (échéance), réunions, suivis (date de contrôle — la date qui compte pour
// moi, voir followups.js) et décisions, comme demandé (§26 : tâches, échéances, réunions,
// suivis, relances — les "jalons" ne sont pas encore modélisés, donc absents pour l'instant).
// "Les échéances doivent pouvoir être déplacées directement" (§26) : chaque pastille est
// glissable vers un autre jour, même mécanique de glisser-déposer que le Kanban
// (dataTransfer), et met à jour la vraie date de l'entité au drop.

import * as tasksApi from "../domain/tasks.js";
import * as projectsApi from "../domain/projects.js";
import * as meetingsApi from "../domain/meetings.js";
import * as decisionsApi from "../domain/decisions.js";
import * as followUpsApi from "../domain/followups.js";
import { openModal, closeModal } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { openTaskDetail } from "./kanban.js";
import { openRecentDetail } from "./dashboard.js";
import { openEditFollowUpModal } from "./people.js";

const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export function renderCalendar(container) {
  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Calendrier</h1>
        <div class="subtitle" id="calendar-subtitle">—</div>
      </div>
      <div style="display:flex;gap:8px;">
        <button id="cal-view-month" class="btn btn-secondary btn-sm">Mois</button>
        <button id="cal-view-week" class="btn btn-secondary btn-sm">Semaine</button>
      </div>
    </div>
    <div class="view">
      <div class="cal-nav">
        <button id="cal-prev" class="btn btn-ghost btn-sm">‹</button>
        <button id="cal-today" class="btn btn-ghost btn-sm">Aujourd'hui</button>
        <button id="cal-next" class="btn btn-ghost btn-sm">›</button>
      </div>
      <div id="calendar-body"></div>
    </div>
  `;

  const subtitleEl = container.querySelector("#calendar-subtitle");
  const bodyEl = container.querySelector("#calendar-body");

  let tasks = [];
  let projects = [];
  let meetings = [];
  let decisions = [];
  let followUps = [];
  let cursor = startOfDay(new Date());
  let mode = "month"; // "month" | "week"

  /** Exclut tout élément rattaché à un projet fermé (retour de Charles-Henri, 02/09/2026 —
   *  fermeture de projet : "faire que les éléments sous-jacents et le projet n'apparaissent
   *  plus dans les outils de pilotage") — même principe que hatFilterTasks() côté Dashboard
   *  et applyFilters() côté Kanban. */
  function isProjectVisible(projectId) {
    if (!projectId) return true;
    const project = projects.find((p) => p.id === projectId);
    return !projectsApi.isArchived(project);
  }

  function allItems() {
    const items = [];
    for (const t of tasks) {
      if (!t.dueDate || !isProjectVisible(t.projectId)) continue;
      items.push({
        type: "Task",
        id: t.id,
        date: t.dueDate,
        icon: t.isBlocked ? "🔴" : "✅",
        title: t.title,
        onOpen: () => openTaskDetail(t, projects),
        onMove: (newDate) => tasksApi.updateTask(t.id, { dueDate: newDate }),
      });
    }
    for (const m of meetings) {
      if (!m.date || !isProjectVisible(m.projectId)) continue;
      items.push({
        type: "Meeting",
        id: m.id,
        date: m.date,
        icon: "🗓️",
        title: m.title,
        onOpen: () => openRecentDetail({ kind: "meeting", emoji: "🗓️", data: m }, projects),
        onMove: (newDate) => meetingsApi.updateMeeting(m.id, { date: newDate }),
      });
    }
    for (const d of decisions) {
      if (!d.date || !isProjectVisible(d.projectId)) continue;
      items.push({
        type: "Decision",
        id: d.id,
        date: d.date,
        icon: "🗳️",
        title: d.title,
        onOpen: () => openRecentDetail({ kind: "decision", emoji: "🗳️", data: d }, projects),
        onMove: (newDate) => decisionsApi.updateDecision(d.id, { date: newDate }),
      });
    }
    for (const f of followUps) {
      if (!f.controlDate || f.status === "done" || !isProjectVisible(f.projectId)) continue;
      items.push({
        type: "FollowUp",
        id: f.id,
        date: f.controlDate,
        icon: f.direction === "to_tell" ? "📣" : "👀",
        title: f.title,
        onOpen: () => openEditFollowUpModal(f),
        onMove: (newDate) => followUpsApi.updateFollowUp(f.id, { controlDate: newDate }),
      });
    }
    return items;
  }

  function render() {
    const items = allItems();
    if (mode === "month") {
      subtitleEl.textContent = cursor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
      renderMonth(bodyEl, cursor, items);
    } else {
      const { start, end } = weekRange(cursor);
      subtitleEl.textContent = `Semaine du ${formatShort(start)} au ${formatShort(end)}`;
      renderWeek(bodyEl, cursor, items);
    }
  }

  container.querySelector("#cal-view-month").addEventListener("click", () => {
    mode = "month";
    render();
  });
  container.querySelector("#cal-view-week").addEventListener("click", () => {
    mode = "week";
    render();
  });
  container.querySelector("#cal-prev").addEventListener("click", () => {
    cursor = mode === "month" ? addMonths(cursor, -1) : addDays(cursor, -7);
    render();
  });
  container.querySelector("#cal-next").addEventListener("click", () => {
    cursor = mode === "month" ? addMonths(cursor, 1) : addDays(cursor, 7);
    render();
  });
  container.querySelector("#cal-today").addEventListener("click", () => {
    cursor = startOfDay(new Date());
    render();
  });

  const unsubTasks = tasksApi.subscribe((items) => {
    tasks = items;
    render();
  });
  const unsubProjects = projectsApi.subscribe((items) => {
    projects = items;
    render();
  });
  const unsubMeetings = meetingsApi.subscribe((items) => {
    meetings = items;
    render();
  });
  const unsubDecisions = decisionsApi.subscribe((items) => {
    decisions = items;
    render();
  });
  const unsubFollowUps = followUpsApi.subscribe((items) => {
    followUps = items;
    render();
  });

  return function cleanup() {
    unsubTasks();
    unsubProjects();
    unsubMeetings();
    unsubDecisions();
    unsubFollowUps();
  };
}

function renderMonth(container, cursor, items) {
  const byDate = groupByDate(items);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7; // lundi = 0
  const gridStart = addDays(firstOfMonth, -startOffset);
  const today = isoDate(new Date());

  container.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "cal-grid";

  for (const label of WEEKDAY_LABELS) {
    const head = document.createElement("div");
    head.className = "cal-weekday";
    head.textContent = label;
    grid.appendChild(head);
  }

  for (let i = 0; i < 42; i++) {
    const day = addDays(gridStart, i);
    const iso = isoDate(day);
    const inMonth = day.getMonth() === month;
    const dayItems = byDate.get(iso) || [];

    const cell = document.createElement("div");
    cell.className = "cal-cell" + (inMonth ? "" : " cal-cell-outside") + (iso === today ? " cal-cell-today" : "");
    cell.dataset.date = iso;
    cell.innerHTML = `<div class="cal-cell-num">${day.getDate()}</div>`;

    const pillsWrap = document.createElement("div");
    pillsWrap.className = "cal-pills";
    for (const item of dayItems.slice(0, 3)) {
      pillsWrap.appendChild(renderPill(item));
    }
    if (dayItems.length > 3) {
      const more = document.createElement("div");
      more.className = "cal-more";
      more.textContent = `+${dayItems.length - 3}`;
      pillsWrap.appendChild(more);
    }
    cell.appendChild(pillsWrap);

    cell.addEventListener("click", (e) => {
      if (e.target.closest(".cal-pill")) return;
      openDayAgenda(iso, dayItems);
    });
    wireDropTarget(cell, iso);
    grid.appendChild(cell);
  }

  container.appendChild(grid);
}

function renderWeek(container, cursor, items) {
  const byDate = groupByDate(items);
  const { start } = weekRange(cursor);
  const today = isoDate(new Date());

  container.innerHTML = "";
  const list = document.createElement("div");
  for (let i = 0; i < 7; i++) {
    const day = addDays(start, i);
    const iso = isoDate(day);
    const dayItems = byDate.get(iso) || [];

    const section = document.createElement("div");
    section.className = "cal-week-day" + (iso === today ? " cal-cell-today" : "");
    section.dataset.date = iso;
    section.innerHTML = `<div class="cal-week-day-label">${WEEKDAY_LABELS[i]} ${day.getDate()}</div>`;

    const card = document.createElement("div");
    card.className = "card";
    card.style.marginBottom = "12px";
    if (!dayItems.length) {
      card.innerHTML = `<div class="empty-state" style="padding:12px;">Rien ce jour-là.</div>`;
    } else {
      for (const item of dayItems) {
        const row = document.createElement("div");
        row.className = "item-row";
        row.style.cursor = "pointer";
        row.draggable = true;
        row.innerHTML = `<div class="item-main"><div class="item-title">${item.icon} ${escapeHtml(item.title)}</div></div>`;
        row.addEventListener("click", () => item.onOpen());
        row.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/cal-item", JSON.stringify({ type: item.type, id: item.id })));
        card.appendChild(row);
      }
    }
    section.appendChild(card);
    wireDropTarget(section, iso);
    list.appendChild(section);
  }
  container.appendChild(list);
}

function renderPill(item) {
  const pill = document.createElement("div");
  pill.className = "cal-pill";
  pill.draggable = true;
  pill.title = item.title;
  pill.textContent = `${item.icon} ${item.title}`;
  pill.addEventListener("click", (e) => {
    e.stopPropagation();
    item.onOpen();
  });
  pill.addEventListener("dragstart", (e) => {
    e.stopPropagation();
    e.dataTransfer.setData("text/cal-item", JSON.stringify({ type: item.type, id: item.id }));
  });
  return pill;
}

/** Glisser une pastille vers un autre jour change directement sa date (§26) — retrouve
 *  l'item par type+id à l'intérieur de `allItems()` recalculé au moment du drop pour ne
 *  jamais agir sur des données périmées (drag potentiellement long sur mobile). */
function wireDropTarget(el, iso) {
  el.addEventListener("dragover", (e) => {
    e.preventDefault();
    el.classList.add("cal-drop-target");
  });
  el.addEventListener("dragleave", () => el.classList.remove("cal-drop-target"));
  el.addEventListener("drop", async (e) => {
    e.preventDefault();
    el.classList.remove("cal-drop-target");
    const raw = e.dataTransfer.getData("text/cal-item");
    if (!raw) return;
    const { type, id } = JSON.parse(raw);
    try {
      if (type === "Task") await tasksApi.updateTask(id, { dueDate: iso });
      else if (type === "Meeting") await meetingsApi.updateMeeting(id, { date: iso });
      else if (type === "Decision") await decisionsApi.updateDecision(id, { date: iso });
      else if (type === "FollowUp") await followUpsApi.updateFollowUp(id, { controlDate: iso });
      showToast("Date déplacée");
    } catch {
      showToast("Impossible de déplacer cet élément");
    }
  });
}

function openDayAgenda(iso, items) {
  const body = document.createElement("div");
  if (!items.length) {
    body.innerHTML = `<div class="empty-state" style="padding:16px;">Rien ce jour-là.</div>`;
  } else {
    const card = document.createElement("div");
    card.className = "card";
    for (const item of items) {
      const row = document.createElement("div");
      row.className = "item-row";
      row.style.cursor = "pointer";
      row.innerHTML = `<div class="item-main"><div class="item-title">${item.icon} ${escapeHtml(item.title)}</div></div>`;
      row.addEventListener("click", () => {
        closeModal();
        item.onOpen();
      });
      card.appendChild(row);
    }
    body.appendChild(card);
  }
  openModal({
    title: formatLong(new Date(iso + "T00:00:00")),
    body,
    actions: [{ label: "Fermer", variant: "ghost" }],
  });
}

function groupByDate(items) {
  const map = new Map();
  for (const item of items) {
    if (!map.has(item.date)) map.set(item.date, []);
    map.get(item.date).push(item);
  }
  return map;
}

function startOfDay(d) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
function addDays(d, n) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}
function addMonths(d, n) {
  const copy = new Date(d);
  copy.setMonth(copy.getMonth() + n);
  return copy;
}
function weekRange(d) {
  const offset = (d.getDay() + 6) % 7;
  const start = addDays(d, -offset);
  const end = addDays(start, 6);
  return { start, end };
}
function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function formatShort(d) {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function formatLong(d) {
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
