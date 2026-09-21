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
import * as peopleApi from "../domain/people.js";
import { openModal, closeModal } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { openTaskDetail, openCreateTaskModal } from "./kanban.js";
import { openRecentDetail, openCreateMeetingModal } from "./dashboard.js";
import { openEditFollowUpModal } from "./people.js";
import { renderPilotageSubNav } from "../components/pilotageSubNav.js";

const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export function renderCalendar(container) {
  // Plein écran en mode web (retour de Charles-Henri, 07/09/2026 : "il y a toujours un
  // décalage [...] Calendrier idem [que Projet]") — même classe et même principe que
  // js/views/kanban.js et js/views/projects.js (posée/retirée au montage/démontage), pour
  // que les 3 écrans Pilotage (Tâches/Projets/Calendrier) se comportent enfin à l'identique
  // en largeur.
  container.classList.add("app-wide");

  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Calendrier</h1>
        <div class="subtitle" id="calendar-subtitle">—</div>
      </div>
    </div>
    <div class="view">
      <div id="pilotage-subnav"></div>
      <!-- Mois/Semaine descendus du bandeau du haut, et devenus deux chips actif/inactif comme
           Trello/Tableau côté Tâches (audit du 07/09/2026) : c'est le "type de vue" de cet
           écran, au même titre — avant cette vague c'étaient deux boutons ordinaires, sans
           aucun indicateur visuel du mode actuellement affiché. -->
      <div class="chip-row" id="cal-view-toggle">
        <button type="button" class="chip active" data-view="month">Mois</button>
        <button type="button" class="chip" data-view="week">Semaine</button>
        <!-- Filtres Type/Projet/Personne (LOT 7, TODO-015, 21/09/2026 — COMP-UX-005) : réutilise
             tel quel le menu "🔧 Filtrer" déjà écrit pour Pilotage/Projets
             (`.filter-popover`/`.filter-popover-panel`, voir styles/components.css et
             js/views/kanban.js), plutôt que d'inventer un nouveau composant de filtre. -->
        <details class="filter-popover" id="cal-filter-popover">
          <summary class="chip">🔧 Filtrer<span class="filter-popover-badge" id="cal-filter-badge" hidden></span></summary>
          <div class="filter-popover-panel">
            <div class="filter-popover-group">
              <div class="filter-popover-label">Type</div>
              <div class="chip-row" id="cal-type-filter">
                <button type="button" class="chip active" data-type="Task">✅ Tâches</button>
                <button type="button" class="chip active" data-type="Meeting">🗓️ Réunions</button>
                <button type="button" class="chip active" data-type="Decision">🗳️ Décisions</button>
                <button type="button" class="chip active" data-type="FollowUp">👀 Suivis</button>
              </div>
            </div>
            <div class="filter-popover-group">
              <div class="filter-popover-label">Projet</div>
              <select id="cal-project-filter"></select>
            </div>
            <div class="filter-popover-group">
              <!-- Ne filtre en pratique que les Suivis (👀), seul type portant réellement une
                   personne (`personId`) — une Tâche n'en a jamais (voir openTaskDetail dans
                   kanban.js) et le champ `participants` d'une Réunion n'est pas encore exposé
                   dans son formulaire de création. Sélectionner une personne masque donc aussi
                   Tâches/Réunions/Décisions ce jour-là, aucune ne pouvant lui être rattachée. -->
              <div class="filter-popover-label">Personne</div>
              <select id="cal-person-filter"></select>
            </div>
          </div>
        </details>
      </div>
      <div class="cal-nav">
        <button id="cal-prev" class="btn btn-ghost btn-sm">‹</button>
        <button id="cal-today" class="btn btn-ghost btn-sm">Aujourd'hui</button>
        <button id="cal-next" class="btn btn-ghost btn-sm">›</button>
      </div>
      <div id="calendar-body"></div>
    </div>
  `;

  renderPilotageSubNav(container.querySelector("#pilotage-subnav"), "#/calendar");
  const subtitleEl = container.querySelector("#calendar-subtitle");
  const bodyEl = container.querySelector("#calendar-body");
  const filterPopoverEl = container.querySelector("#cal-filter-popover");
  const filterBadgeEl = container.querySelector("#cal-filter-badge");
  const typeFilterEl = container.querySelector("#cal-type-filter");
  const projectFilterEl = container.querySelector("#cal-project-filter");
  const personFilterEl = container.querySelector("#cal-person-filter");

  let tasks = [];
  let projects = [];
  let meetings = [];
  let decisions = [];
  let followUps = [];
  let people = [];
  let cursor = startOfDay(new Date());
  let mode = "month"; // "month" | "week"
  // Filtres Type/Projet/Personne (LOT 7, TODO-015) — jamais persistés d'une visite à l'autre,
  // même traitement que les filtres équivalents de Kanban/Projets (js/views/kanban.js).
  const activeTypes = new Set(["Task", "Meeting", "Decision", "FollowUp"]);
  let filterProjectId = "all";
  let filterPersonId = "all";

  /** Exclut tout élément rattaché à un projet fermé (retour de Charles-Henri, 02/09/2026 —
   *  fermeture de projet : "faire que les éléments sous-jacents et le projet n'apparaissent
   *  plus dans les outils de pilotage") — même principe que hatFilterTasks() côté Dashboard
   *  et applyFilters() côté Kanban. */
  function isProjectVisible(projectId) {
    if (!projectId) return true;
    const project = projects.find((p) => p.id === projectId);
    return !projectsApi.isArchived(project);
  }

  /** Filtre Projet (toutes les entités calendrier ont un `projectId`) — "all" = pas de filtre,
   *  même convention que `filterProjectId` côté Kanban (js/views/kanban.js). */
  function matchesProjectFilter(projectId) {
    return filterProjectId === "all" || projectId === filterProjectId;
  }

  function allItems() {
    const items = [];
    if (activeTypes.has("Task")) {
      for (const t of tasks) {
        if (!t.dueDate || !isProjectVisible(t.projectId)) continue;
        if (!matchesProjectFilter(t.projectId)) continue;
        // Une Tâche n'a jamais de personne assignée (voir openTaskDetail, kanban.js) : un
        // filtre Personne actif l'exclut donc systématiquement, plutôt que de la garder par
        // défaut alors qu'elle ne peut jamais correspondre à la personne choisie.
        if (filterPersonId !== "all") continue;
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
    }
    if (activeTypes.has("Meeting")) {
      for (const m of meetings) {
        if (!m.date || !isProjectVisible(m.projectId)) continue;
        if (!matchesProjectFilter(m.projectId)) continue;
        // `participants` existe dans le modèle (js/domain/meetings.js) mais n'est renseigné par
        // aucun formulaire exposé à ce jour — un filtre Personne ne peut donc jamais y trouver de
        // correspondance fiable ; exclue comme la Tâche ci-dessus plutôt que de prétendre filtrer
        // sur un champ en pratique toujours vide.
        if (filterPersonId !== "all") continue;
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
    }
    if (activeTypes.has("Decision")) {
      for (const d of decisions) {
        if (!d.date || !isProjectVisible(d.projectId)) continue;
        if (!matchesProjectFilter(d.projectId)) continue;
        if (filterPersonId !== "all") continue; // une Décision n'a pas non plus de personne assignée
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
    }
    if (!activeTypes.has("FollowUp")) return items;
    for (const f of followUps) {
      if (!f.controlDate || f.status === "done" || !isProjectVisible(f.projectId)) continue;
      if (!matchesProjectFilter(f.projectId)) continue;
      if (filterPersonId !== "all" && f.personId !== filterPersonId) continue;
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

  /** Rebâtit les deux `<select>` de filtre à chaque rendu — même convention que
   *  `projectFilterEl.innerHTML` côté Kanban (js/views/kanban.js#renderBoard) : plus simple et
   *  plus sûr que de ne mettre à jour que les options ajoutées/retirées, quitte à reconstruire
   *  à chaque fois (liste jamais assez longue pour que ce soit coûteux). Projets fermés exclus,
   *  comme le reste du Calendrier (voir isProjectVisible ci-dessus). */
  function renderFilterSelects() {
    const visibleProjects = [...projects].filter((p) => !projectsApi.isArchived(p)).sort((a, b) => a.name.localeCompare(b.name, "fr"));
    projectFilterEl.innerHTML =
      `<option value="all">Tous les projets</option>` +
      visibleProjects.map((p) => `<option value="${p.id}" ${p.id === filterProjectId ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("");

    const sortedPeople = peopleApi.sortPeople(people);
    personFilterEl.innerHTML =
      `<option value="all">Toutes les personnes</option>` +
      sortedPeople
        .map((p) => `<option value="${p.id}" ${p.id === filterPersonId ? "selected" : ""}>${p.type === "manager" ? "👔" : "👤"} ${escapeHtml(p.name)}</option>`)
        .join("");
  }

  function updateFilterBadge() {
    const count = (activeTypes.size < 4 ? 1 : 0) + (filterProjectId !== "all" ? 1 : 0) + (filterPersonId !== "all" ? 1 : 0);
    filterBadgeEl.textContent = count ? String(count) : "";
    filterBadgeEl.hidden = count === 0;
  }

  function render() {
    renderFilterSelects();
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

  typeFilterEl.querySelectorAll("[data-type]").forEach((chip) => {
    chip.addEventListener("click", () => {
      const type = chip.dataset.type;
      if (activeTypes.has(type)) activeTypes.delete(type);
      else activeTypes.add(type);
      chip.classList.toggle("active", activeTypes.has(type));
      updateFilterBadge();
      render();
    });
  });
  projectFilterEl.addEventListener("change", () => {
    filterProjectId = projectFilterEl.value;
    updateFilterBadge();
    render();
  });
  personFilterEl.addEventListener("change", () => {
    filterPersonId = personFilterEl.value;
    updateFilterBadge();
    render();
  });
  // Même correctif que `closeFilterPopoverOnOutsideClick` côté Kanban (js/views/kanban.js) : un
  // <details> ne se referme jamais tout seul au clic en dehors de son contenu.
  function closeFilterPopoverOnOutsideClick(e) {
    if (filterPopoverEl.open && !filterPopoverEl.contains(e.target)) filterPopoverEl.open = false;
  }
  document.addEventListener("click", closeFilterPopoverOnOutsideClick);

  const calViewToggleEl = container.querySelector("#cal-view-toggle");
  function updateCalViewToggle() {
    calViewToggleEl.querySelectorAll("[data-view]").forEach((chip) => chip.classList.toggle("active", chip.dataset.view === mode));
  }
  calViewToggleEl.querySelectorAll("[data-view]").forEach((chip) => {
    chip.addEventListener("click", () => {
      mode = chip.dataset.view;
      updateCalViewToggle();
      render();
    });
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
  const unsubPeople = peopleApi.subscribe((items) => {
    people = items;
    render();
  });

  return function cleanup() {
    container.classList.remove("app-wide");
    document.removeEventListener("click", closeFilterPopoverOnOutsideClick);
    unsubTasks();
    unsubProjects();
    unsubMeetings();
    unsubDecisions();
    unsubFollowUps();
    unsubPeople();
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
        row.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/cal-item", JSON.stringify({ type: item.type, id: item.id, fromDate: item.date })));
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
    e.dataTransfer.setData("text/cal-item", JSON.stringify({ type: item.type, id: item.id, fromDate: item.date }));
  });
  return pill;
}

/** Champ de date à mettre à jour selon le type d'entité — un seul endroit pour le déplacement
 *  initial (glisser-déposer) et son annulation (voir showToast plus bas), pour ne jamais les
 *  laisser diverger. */
async function moveItemDate(type, id, dateValue) {
  if (type === "Task") return tasksApi.updateTask(id, { dueDate: dateValue });
  if (type === "Meeting") return meetingsApi.updateMeeting(id, { date: dateValue });
  if (type === "Decision") return decisionsApi.updateDecision(id, { date: dateValue });
  if (type === "FollowUp") return followUpsApi.updateFollowUp(id, { controlDate: dateValue });
}

/** Glisser une pastille vers un autre jour change directement sa date (§26) — retrouve
 *  l'item par type+id à l'intérieur de `allItems()` recalculé au moment du drop pour ne
 *  jamais agir sur des données périmées (drag potentiellement long sur mobile).
 *  `fromDate` (audit de simplification du 02/09/2026, retour de Charles-Henri : un
 *  glisser-déposer accidentel doit pouvoir se rattraper immédiatement) voyage avec l'item dès
 *  le dragstart — un bouton "Annuler" sur le toast de confirmation remet la date d'origine sans
 *  devoir rouvrir la fiche. */
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
    const { type, id, fromDate } = JSON.parse(raw);
    if (fromDate === iso) return; // déposé sur son jour d'origine : rien à faire, rien à annuler
    try {
      await moveItemDate(type, id, iso);
      showToast("Date déplacée", {
        actionLabel: fromDate ? "Annuler" : undefined,
        onAction: fromDate
          ? async () => {
              await moveItemDate(type, id, fromDate);
              showToast("Déplacement annulé");
            }
          : undefined,
      });
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
    // "+ Tâche"/"+ Réunion" (LOT 7, TODO-015, COMP-UX-006) : point de création rapide sur un
    // jour, réutilisant tel quel les formulaires de création existants (Dépendances du TODO)
    // avec la date de ce jour déjà pré-remplie — jamais de nouveau formulaire. `openModal()`
    // ferme toujours la modale précédente avant d'en ouvrir une nouvelle (voir modal.js), donc
    // cette fiche Agenda du jour se referme normalement dès qu'on clique l'un des deux.
    actions: [
      { label: "Fermer", variant: "ghost" },
      { label: "+ Tâche", onClick: () => openCreateTaskModal({ dueDate: iso }) },
      { label: "+ Réunion", onClick: () => openCreateMeetingModal({ date: iso }) },
    ],
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
