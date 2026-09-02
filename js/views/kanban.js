// Kanban — vue principale de pilotage opérationnel (§24, §25). Drag & drop obligatoire ;
// déplacer une carte change son statut, rien de plus.
//
// Vue "📊 Tableau" (02/09/2026, retour de Charles-Henri — "basculer de la vue trello à la vue
// monday") : une seconde façon d'afficher le MÊME flux de Tâches déjà filtré (casquette,
// projet, échéance) — jamais un second jeu de données. Regroupable par Statut ou Projet,
// triable par colonne, colonnes réordonnables par glisser-déposer, cellules éditables en
// ligne (Statut/Projet/Échéance/Titre) sans ouvrir la fiche complète, et une ligne
// "+ Ajouter une tâche" par groupe. Voir `renderTableView` plus bas et
// `js/services/pilotageViewStore.js` pour la persistance (localStorage, propre à l'appareil).

import * as tasksApi from "../domain/tasks.js";
import * as projectsApi from "../domain/projects.js";
import * as resourcesApi from "../domain/resources.js";
import * as historyApi from "../domain/history.js";
import * as preferencesApi from "../domain/preferences.js";
import * as casquettesApi from "../domain/casquettes.js";
import * as pilotageView from "../services/pilotageViewStore.js";
import { openModal, closeModal, confirmDelete } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { showHintOnce } from "../components/hint.js";
import { openCreateResourceModal, renderResourceList, openResourcePickerModal } from "./resources.js";
import { renderHistoryTimeline } from "../components/historyTimeline.js";
import * as linkedItemsApi from "../components/linkedItems.js";
import { renderCanevas } from "../components/canevas.js";
import { renderNotesBlock } from "../components/notesBlock.js";
import { renderChecklist } from "../components/checklist.js";
import { buildMeetingTitle, copyMeetingTitle, launchMeetingFromEntity } from "../components/meetingLauncher.js";
import { renderInfoTip } from "../components/infoTip.js";
import { exportTaskOverview } from "../components/overviewExport.js";

// Fenêtres d'échéance pour le filtre (retour de Charles-Henri) — "en retard" est distinct de
// "≤7/15 jours" plutôt qu'inclus dedans : ce sont deux questions différentes ("qu'est-ce qui
// approche ?" vs "qu'est-ce qui est déjà dépassé ?").
const DUE_WINDOWS = [
  { key: "all", label: "Toutes les échéances" },
  { key: "7", label: "≤ 7 jours" },
  { key: "15", label: "≤ 15 jours" },
  { key: "late", label: "🔴 En retard" },
];

export function renderKanban(container) {
  // Plein écran en mode web (retour de Charles-Henri : éviter le scroll horizontal) — la
  // classe n'affecte que #app pendant que Pilotage est affiché, retirée au démontage de la
  // vue (voir cleanup) pour ne jamais fuiter sur les autres onglets.
  container.classList.add("app-wide");

  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Pilotage</h1>
        <div class="subtitle">Glisse une carte, ou utilise ‹ › pour changer son statut</div>
      </div>
    </div>
    <div class="view">
      <div class="chip-row" id="kanban-filters" style="flex-wrap:wrap;">
        <details class="filter-popover" id="kanban-filter-popover">
          <summary class="chip">🔧 Filtrer<span class="filter-popover-badge" id="kanban-filter-badge" hidden></span></summary>
          <div class="filter-popover-panel">
            <div class="filter-popover-group">
              <div class="filter-popover-label" style="display:flex;align-items:center;gap:6px;">Casquette<span id="kanban-hat-info"></span></div>
              <div class="chip-row" id="kanban-hat-filter"></div>
            </div>
            <div class="filter-popover-group">
              <div class="filter-popover-label">Projet</div>
              <select id="kanban-project-filter"></select>
            </div>
          </div>
        </details>
      </div>
      <div class="chip-row" id="kanban-view-toggle">
        <button type="button" class="chip" data-view="trello">🗂️ Trello</button>
        <button type="button" class="chip" data-view="table">📊 Tableau</button>
        <span id="kanban-status-info"></span>
      </div>
      <div class="chip-row" id="kanban-table-controls" style="display:none;">
        <label style="display:flex;align-items:center;gap:8px;font-size:var(--font-size-sm);color:var(--color-text-muted);">
          Regrouper par
          <select id="kanban-group-by" class="chip" style="border-radius:var(--radius-sm);">
            <option value="status">Statut</option>
            <option value="project">Projet</option>
            <option value="none">Aucun</option>
          </select>
        </label>
      </div>
      <div class="kanban-board" id="kanban-board"></div>
      <div id="kanban-table" style="display:none;"></div>
    </div>
  `;

  showHintOnce(
    container.querySelector(".view"),
    "kanban-intro-v1",
    "Ici, seulement <strong>tes</strong> tâches — pas de collaborateur à choisir, tout ce qui s'y trouve est déjà à toi. Ce qu'un collaborateur doit faire, c'est un Suivi sur sa fiche (onglet Équipe). Le filtre par casquette est le même qu'à l'Accueil."
  );
  renderInfoTip(container.querySelector("#kanban-hat-info"), casquettesApi.HAT_INFO_HTML);
  renderInfoTip(container.querySelector("#kanban-status-info"), tasksApi.STATUS_INFO_HTML);

  const board = container.querySelector("#kanban-board");
  const tableEl = container.querySelector("#kanban-table");
  const hatFilterEl = container.querySelector("#kanban-hat-filter");
  const filtersEl = container.querySelector("#kanban-filters");
  const filterPopoverEl = container.querySelector("#kanban-filter-popover");
  const filterBadgeEl = container.querySelector("#kanban-filter-badge");
  const projectFilterEl = container.querySelector("#kanban-project-filter");
  const viewToggleEl = container.querySelector("#kanban-view-toggle");
  const tableControlsEl = container.querySelector("#kanban-table-controls");
  const groupByEl = container.querySelector("#kanban-group-by");
  let latestTasks = [];
  let latestProjects = [];
  let filterWindow = "all";
  let filterProjectId = "all";
  let activeHat = "all";
  let hideDone = false;

  // Vue Trello/Tableau (02/09/2026) : préférence propre à l'appareil (localStorage), pas
  // besoin d'attendre les préférences Firestore pour l'afficher — contrairement à la
  // casquette, ce n'est qu'un choix d'affichage local, jamais une donnée à synchroniser.
  let viewMode = pilotageView.getViewState().mode;
  updateViewToggle();
  groupByEl.value = pilotageView.getViewState().table.groupBy;
  viewToggleEl.querySelectorAll("[data-view]").forEach((chip) => {
    chip.addEventListener("click", () => {
      viewMode = chip.dataset.view;
      pilotageView.setMode(viewMode);
      updateViewToggle();
      renderBoard();
    });
  });
  groupByEl.addEventListener("change", () => {
    pilotageView.setTableConfig({ groupBy: groupByEl.value });
    renderBoard();
  });

  function updateViewToggle() {
    viewToggleEl.querySelectorAll("[data-view]").forEach((chip) => chip.classList.toggle("active", chip.dataset.view === viewMode));
    tableControlsEl.style.display = viewMode === "table" ? "" : "none";
    board.style.display = viewMode === "table" ? "none" : "";
    tableEl.style.display = viewMode === "table" ? "" : "none";
  }

  // Pilotage ne montre que des Tâches, qui ne peuvent jamais être "Équipe" ni "Manager" (voir
  // taskHat() dans casquettes.js) — restreindre les chips affichées évite un board vide et
  // confus au clic sur ces deux-là (retour de Charles-Henri, 02/09/2026).
  const PILOTAGE_HATS = ["toi", "projets", "cse"];

  preferencesApi.getPreferences().then((prefs) => {
    // La préférence de casquette est partagée avec l'Accueil (qui, lui, montre aussi des
    // Suivis et peut légitimement être sur "Équipe"/"Manager") — si Pilotage en hérite une
    // valeur qu'il ne peut pas afficher comme chip, revenir à "Toutes" plutôt que de filtrer
    // silencieusement sur une casquette invisible.
    const casquette = prefs.casquette || "all";
    activeHat = casquette === "all" || PILOTAGE_HATS.includes(casquette) ? casquette : "all";
    renderHatFilter();
    updateFilterBadge();
    renderBoard();
  });

  function renderHatFilter() {
    casquettesApi.renderHatChipRow(
      hatFilterEl,
      activeHat,
      async (hatId) => {
        activeHat = hatId;
        renderHatFilter();
        updateFilterBadge();
        renderBoard();
        await preferencesApi.setCasquette(hatId);
      },
      PILOTAGE_HATS
    );
  }

  // "🔧 Filtrer" (audit de simplification du 02/09/2026 : "regrouper casquette + projet, deux
  // façons de restreindre la même liste, dans un même menu plutôt que deux rangées de chips en
  // permanence à l'écran") — un badge sur le bouton donne l'état d'un coup d'œil sans avoir à
  // ouvrir le menu, pour ne jamais laisser un filtre actif oublié invisible.
  function updateFilterBadge() {
    const count = (activeHat !== "all" ? 1 : 0) + (filterProjectId !== "all" ? 1 : 0);
    filterBadgeEl.textContent = count ? String(count) : "";
    filterBadgeEl.hidden = count === 0;
  }
  function closeFilterPopoverOnOutsideClick(e) {
    if (filterPopoverEl.open && !filterPopoverEl.contains(e.target)) filterPopoverEl.open = false;
  }
  document.addEventListener("click", closeFilterPopoverOnOutsideClick);

  filtersEl.insertAdjacentHTML(
    "beforeend",
    DUE_WINDOWS.map((w) => `<button type="button" class="chip${w.key === "all" ? " active" : ""}" data-window="${w.key}">${w.label}</button>`).join("") +
      `<button type="button" class="chip" id="kanban-hide-done">🙈 Masquer terminées</button>`
  );
  filtersEl.querySelectorAll("[data-window]").forEach((chip) => {
    chip.addEventListener("click", () => {
      filterWindow = chip.dataset.window;
      filtersEl.querySelectorAll("[data-window]").forEach((c) => c.classList.toggle("active", c === chip));
      renderBoard();
    });
  });
  // "Masquer terminées" (retour de Charles-Henri, 02/09/2026) : filtre en plus des autres,
  // jamais persisté d'une visite à l'autre (même traitement que filterWindow/filterProjectId
  // ci-dessus) — s'applique aussi bien au Trello (la colonne "Terminé" se vide) qu'au Tableau.
  filtersEl.querySelector("#kanban-hide-done").addEventListener("click", (e) => {
    hideDone = !hideDone;
    e.currentTarget.classList.toggle("active", hideDone);
    renderBoard();
  });
  projectFilterEl.addEventListener("change", () => {
    filterProjectId = projectFilterEl.value;
    updateFilterBadge();
    renderBoard();
  });

  function applyFilters(tasks) {
    const projectsById = new Map(latestProjects.map((p) => [p.id, p]));
    // Un projet fermé sort des outils de pilotage avec tout ce qui lui est rattaché (retour de
    // Charles-Henri, 02/09/2026) — voir projectsApi.closeProject(). Reste consultable via le
    // filtre "Fermés" de l'onglet Projets ou la recherche globale, jamais ici.
    let list = tasks.filter((t) => !t.projectId || !projectsApi.isArchived(projectsById.get(t.projectId)));
    if (activeHat !== "all") {
      list = list.filter((t) => casquettesApi.taskHat(t, projectsById) === activeHat);
    }
    if (filterProjectId !== "all") list = list.filter((t) => t.projectId === filterProjectId);
    if (filterWindow === "late") list = list.filter((t) => tasksApi.isLate(t));
    else if (filterWindow === "7" || filterWindow === "15") {
      const horizon = Number(filterWindow);
      list = list.filter((t) => t.dueDate && daysFromToday(t.dueDate) >= 0 && daysFromToday(t.dueDate) <= horizon);
    }
    if (hideDone) list = list.filter((t) => t.status !== "done");
    return list;
  }

  /** Tri par défaut : échéance la plus proche en premier, sans échéance à la fin (retour de
   *  Charles-Henri) — ne change jamais l'ordre des colonnes elles-mêmes, seulement l'ordre
   *  des cartes à l'intérieur de chacune. */
  function sortByDueDate(tasks) {
    return [...tasks].sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
  }

  function render(tasks, projects) {
    // `projects` est déjà filtré aux projets actifs par renderBoard() — un projet fermé ne doit
    // même pas apparaître comme choix de filtre ici.
    projectFilterEl.innerHTML =
      `<option value="all">Tous les projets</option>` +
      projects.map((p) => `<option value="${p.id}" ${p.id === filterProjectId ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("");

    const filtered = applyFilters(tasks);

    board.innerHTML = "";
    for (const status of tasksApi.STATUSES) {
      const column = document.createElement("div");
      column.className = "kanban-column";
      column.dataset.status = status;

      const columnTasks = sortByDueDate(filtered.filter((t) => t.status === status));

      const header = document.createElement("div");
      header.className = "kanban-column-header";
      header.innerHTML = `<span>${tasksApi.STATUS_LABELS[status]}</span>`;
      const count = document.createElement("span");
      count.className = "count";
      count.textContent = columnTasks.length;
      header.appendChild(count);
      column.appendChild(header);

      // Les cartes vivent dans leur propre zone de scroll (retour de Charles-Henri : "les
      // titres de colonnes disparaissent au scroll") — l'en-tête reste toujours visible
      // puisqu'il est en dehors de cette zone, pas besoin de position sticky ni de calcul de
      // décalage par rapport à la barre du haut.
      const cardsWrap = document.createElement("div");
      cardsWrap.className = "kanban-column-cards";
      for (const task of columnTasks) {
        cardsWrap.appendChild(renderCard(task, projects));
      }
      column.appendChild(cardsWrap);

      column.addEventListener("dragover", (e) => {
        e.preventDefault();
        column.classList.add("drag-over");
      });
      column.addEventListener("dragleave", () => column.classList.remove("drag-over"));
      column.addEventListener("drop", async (e) => {
        e.preventDefault();
        column.classList.remove("drag-over");
        const taskId = e.dataTransfer.getData("text/task-id");
        if (!taskId) return;
        const dragged = latestTasks.find((t) => t.id === taskId);
        const prevStatus = dragged ? dragged.status : null;
        await tasksApi.setStatus(taskId, status);
        celebrateIfJustDone(prevStatus, status);
      });

      board.appendChild(column);
    }
  }

  function renderBoard() {
    updateViewToggle();
    const activeProjects = latestProjects.filter((p) => !projectsApi.isArchived(p));
    if (viewMode === "table") {
      renderTableView(tableEl, applyFilters(latestTasks), activeProjects, renderBoard);
    } else {
      render(latestTasks, activeProjects);
    }
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
    container.classList.remove("app-wide");
    document.removeEventListener("click", closeFilterPopoverOnOutsideClick);
    unsubTasks();
    unsubProjects();
  };
}

function daysFromToday(dateStr) {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

/**
 * Petit retour positif à la clôture d'une tâche (retour de Charles-Henri, 01/09/2026 — piste
 * TDAH : un signal immédiat et visible que quelque chose vient réellement d'être terminé,
 * plutôt qu'un chiffre qui change silencieusement dans un coin). Un seul endroit pour les 3
 * chemins qui peuvent amener une tâche à "done" (glisser-déposer, boutons ‹ ›, fiche détail) :
 * ne se déclenche que sur une vraie *transition* vers "done", jamais si la tâche y était déjà.
 */
function celebrateIfJustDone(prevStatus, newStatus) {
  if (newStatus !== "done" || prevStatus === "done") return false;
  showToast("🎉 Terminé !");
  triggerCompletionAnimation();
  return true;
}

function triggerCompletionAnimation() {
  document.querySelectorAll(".completion-burst").forEach((el) => el.remove());
  const burst = document.createElement("div");
  burst.className = "completion-burst";
  burst.textContent = "🎉";
  document.body.appendChild(burst);
  setTimeout(() => burst.remove(), 900);
}

const TABLE_COLUMN_LABELS = { type: "Type", status: "Statut", project: "Projet", dueDate: "Échéance", notes: "Notes", description: "Description" };

/**
 * Vue "📊 Tableau" façon Monday (02/09/2026). `tasks` est déjà filtré (casquette, projet,
 * échéance — même pipeline que la vue Trello, voir `applyFilters` dans `renderKanban`) : cette
 * fonction ne fait que le regrouper/trier/afficher, jamais une seconde source de vérité.
 * `onChange` redessine tout depuis `renderBoard()` après chaque action (tri, glisser-déposer
 * de colonne, édition en ligne, ajout rapide) — toujours relire `pilotageView.getViewState()`
 * plutôt que de garder une copie locale, pour ne jamais désynchroniser l'affichage du réglage
 * réellement enregistré.
 */
function renderTableView(container, tasks, projects, onChange) {
  const { groupBy, sortColumn, sortDir, columnOrder } = pilotageView.getViewState().table;

  // Statut/Projet redevient inutile comme colonne quand c'est déjà lui qui structure les
  // groupes (même logique que Monday : la colonne de regroupement disparaît, remplacée par
  // les en-têtes de section).
  const visibleColumns = columnOrder.filter((c) => !(groupBy === "status" && c === "status") && !(groupBy === "project" && c === "project"));

  function cellSortValue(task, col) {
    if (col === "type") return task.type === "communication" ? 1 : 0;
    if (col === "status") return tasksApi.STATUSES.indexOf(task.status);
    if (col === "project") {
      const p = projects.find((pr) => pr.id === task.projectId);
      return p ? p.name.toLowerCase() : null;
    }
    if (col === "dueDate") return task.dueDate ? new Date(task.dueDate).getTime() : null;
    if (col === "description") return (task.description || "").toLowerCase() || null;
    if (col === "notes") {
      const log = task.notesLog || [];
      return log.length ? log[log.length - 1].createdAt : null;
    }
    return null;
  }

  function sortRows(rows) {
    if (!sortColumn) return rows;
    const sorted = [...rows].sort((a, b) => {
      const va = cellSortValue(a, sortColumn);
      const vb = cellSortValue(b, sortColumn);
      let cmp;
      if (va == null && vb == null) cmp = 0;
      else if (va == null) cmp = 1;
      else if (vb == null) cmp = -1;
      else if (typeof va === "string") cmp = va.localeCompare(vb);
      else cmp = va - vb;
      return sortDir === "desc" ? -cmp : cmp;
    });
    return sorted;
  }

  let groups;
  if (groupBy === "status") {
    groups = tasksApi.STATUSES.map((s) => ({ key: s, label: tasksApi.STATUS_LABELS[s], items: sortRows(tasks.filter((t) => t.status === s)) }));
  } else if (groupBy === "project") {
    const byKey = new Map();
    const order = [];
    for (const t of tasks) {
      const key = t.projectId || "__none__";
      if (!byKey.has(key)) {
        byKey.set(key, []);
        order.push(key);
      }
      byKey.get(key).push(t);
    }
    groups = order.map((key) => {
      const project = key === "__none__" ? null : projects.find((p) => p.id === key);
      return { key, label: project ? project.name : "Sans projet", items: sortRows(byKey.get(key)) };
    });
  } else {
    groups = [{ key: "__all__", label: null, items: sortRows(tasks) }];
  }

  container.innerHTML = "";
  if (!tasks.length) {
    container.innerHTML = `<div class="empty-state"><span class="emoji">📊</span>Rien à afficher avec ces filtres.</div>`;
    return;
  }

  for (const group of groups) {
    const section = document.createElement("div");
    section.className = "pilotage-table-group";
    if (group.label !== null) {
      const header = document.createElement("div");
      header.className = "pilotage-table-group-header";
      header.innerHTML = `<span>${escapeHtml(group.label)}</span><span class="count">${group.items.length}</span>`;
      section.appendChild(header);
    }

    const wrap = document.createElement("div");
    wrap.className = "pilotage-table-wrap";
    const table = document.createElement("table");
    table.className = "pilotage-table";
    table.appendChild(renderTableHead(visibleColumns, sortColumn, sortDir, columnOrder, onChange));
    const tbody = document.createElement("tbody");
    for (const task of group.items) {
      tbody.appendChild(renderTableRow(task, projects, visibleColumns, onChange, groupBy));
    }
    tbody.appendChild(renderQuickAddRow(visibleColumns, group, groupBy));
    table.appendChild(tbody);
    wrap.appendChild(table);

    // Glisser une ligne vers un autre groupe pour changer sa valeur (retour de Charles-Henri,
    // 02/09/2026 : "basculer par glisser une tâche ailleurs", façon Monday) — n'a de sens que
    // quand un regroupement structure les lignes (Statut/Projet) ; en "Aucun", il n'y a qu'un
    // seul groupe, glisser une ligne dedans ne changerait jamais rien.
    if (groupBy !== "none") {
      tbody.addEventListener("dragover", (e) => {
        if (!e.dataTransfer.types.includes("text/pilotage-row-task")) return;
        e.preventDefault();
        tbody.classList.add("drag-over-group");
      });
      tbody.addEventListener("dragleave", () => tbody.classList.remove("drag-over-group"));
      tbody.addEventListener("drop", async (e) => {
        const taskId = e.dataTransfer.getData("text/pilotage-row-task");
        if (!taskId) return;
        e.preventDefault();
        tbody.classList.remove("drag-over-group");
        const dragged = tasks.find((t) => t.id === taskId);
        if (!dragged) return;
        if (groupBy === "status" && dragged.status !== group.key) {
          const prevStatus = dragged.status;
          await tasksApi.setStatus(taskId, group.key);
          celebrateIfJustDone(prevStatus, group.key);
          onChange();
        } else if (groupBy === "project") {
          const targetProjectId = group.key === "__none__" ? null : group.key;
          if (targetProjectId !== dragged.projectId) {
            await tasksApi.updateTask(taskId, { projectId: targetProjectId });
            onChange();
          }
        }
      });
    }

    section.appendChild(wrap);
    container.appendChild(section);
  }
}

function renderTableHead(visibleColumns, sortColumn, sortDir, columnOrder, onChange) {
  const thead = document.createElement("thead");
  const tr = document.createElement("tr");

  const thTitle = document.createElement("th");
  thTitle.className = "pilotage-table-th-pinned";
  thTitle.textContent = "Titre";
  tr.appendChild(thTitle);

  for (const col of visibleColumns) {
    const th = document.createElement("th");
    th.draggable = true;
    th.dataset.col = col;
    const arrow = sortColumn === col ? (sortDir === "asc" ? " ▲" : " ▼") : "";
    th.textContent = TABLE_COLUMN_LABELS[col] + arrow;
    th.addEventListener("click", () => {
      const current = pilotageView.getViewState().table;
      const nextDir = current.sortColumn === col && current.sortDir === "asc" ? "desc" : "asc";
      pilotageView.setTableConfig({ sortColumn: col, sortDir: nextDir });
      onChange();
    });
    th.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/pilotage-column", col);
    });
    th.addEventListener("dragover", (e) => e.preventDefault());
    th.addEventListener("drop", (e) => {
      e.preventDefault();
      const draggedCol = e.dataTransfer.getData("text/pilotage-column");
      if (!draggedCol || draggedCol === col) return;
      const order = [...columnOrder];
      const from = order.indexOf(draggedCol);
      const to = order.indexOf(col);
      if (from === -1 || to === -1) return;
      order.splice(from, 1);
      order.splice(to, 0, draggedCol);
      pilotageView.setTableConfig({ columnOrder: order });
      onChange();
    });
    tr.appendChild(th);
  }
  thead.appendChild(tr);
  return thead;
}

function renderTableRow(task, projects, visibleColumns, onChange, groupBy) {
  const tr = document.createElement("tr");
  tr.className = "pilotage-table-row";

  const tdTitle = document.createElement("td");
  tdTitle.className = "pilotage-table-td-pinned";

  // Poignée de glisser-déposer (retour de Charles-Henri, 02/09/2026 : "basculer par glisser
  // une tâche ailleurs") — un élément dédié plutôt que toute la ligne, pour ne jamais gêner la
  // sélection/l'édition de texte dans les champs de la ligne (titre, notes...). N'a de sens que
  // si un regroupement structure les lignes (voir la logique de drop dans renderTableView).
  if (groupBy !== "none") {
    const handle = document.createElement("span");
    handle.className = "pilotage-table-drag-handle";
    handle.textContent = "⠿";
    handle.title = "Glisser vers un autre groupe";
    handle.draggable = true;
    handle.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/pilotage-row-task", task.id);
    });
    tdTitle.appendChild(handle);
  }

  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.value = task.title;
  titleInput.className = "pilotage-table-title-input";
  titleInput.addEventListener("change", async () => {
    const value = titleInput.value.trim();
    if (value && value !== task.title) await tasksApi.updateTask(task.id, { title: value });
  });
  tdTitle.appendChild(titleInput);
  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "pilotage-table-open-btn";
  openBtn.textContent = "↗";
  openBtn.title = "Ouvrir la fiche complète";
  openBtn.addEventListener("click", () => openTaskDetail(task, projects));
  tdTitle.appendChild(openBtn);
  tr.appendChild(tdTitle);

  for (const col of visibleColumns) {
    const td = document.createElement("td");
    if (col === "type") {
      td.className = "pilotage-table-td-type";
      td.textContent = task.type === "communication" ? "📣" : "📝";
      td.title = task.type === "communication" ? "Communication" : "Action";
    } else if (col === "status") {
      const select = document.createElement("select");
      select.innerHTML = tasksApi.STATUSES.map((s) => `<option value="${s}" ${s === task.status ? "selected" : ""}>${tasksApi.STATUS_LABELS[s]}</option>`).join("");
      select.addEventListener("change", async () => {
        const prevStatus = task.status;
        await tasksApi.setStatus(task.id, select.value);
        celebrateIfJustDone(prevStatus, select.value);
        onChange();
      });
      td.appendChild(select);
    } else if (col === "project") {
      const select = document.createElement("select");
      select.innerHTML =
        `<option value="">— Aucun —</option>` +
        projects.map((p) => `<option value="${p.id}" ${p.id === task.projectId ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("");
      select.addEventListener("change", async () => {
        await tasksApi.updateTask(task.id, { projectId: select.value || null });
        onChange();
      });
      td.appendChild(select);
    } else if (col === "dueDate") {
      const input = document.createElement("input");
      input.type = "date";
      input.value = task.dueDate || "";
      input.addEventListener("change", async () => {
        await tasksApi.updateTask(task.id, { dueDate: input.value || null });
        onChange();
      });
      td.appendChild(input);
    } else if (col === "description") {
      // Lecture seule + clic pour ouvrir la fiche complète (retour de Charles-Henri, 02/09/2026 :
      // "afficher aussi la description") — jamais éditée en ligne dans la cellule, un texte
      // potentiellement long se prête mal à ça (contrairement au Titre, toujours court).
      td.className = "pilotage-table-td-description";
      const text = (task.description || "").trim();
      td.textContent = text ? truncateText(text, 60) : "—";
      if (text) td.title = text;
      td.addEventListener("click", () => openTaskDetail(task, projects));
    } else if (col === "notes") {
      renderNotesCell(td, task, onChange);
    }
    tr.appendChild(td);
  }
  return tr;
}

function truncateText(text, max) {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

/**
 * Colonne "Notes" du Tableau (retour de Charles-Henri, 02/09/2026 : "une colonne pour Notes
 * avec la dernière note, je peux en ajouter et ça complète") — réutilise le même journal
 * horodaté que le reste de l'app (`tasksApi.addNote`, `js/components/notesBlock.js`),
 * additif uniquement, jamais d'édition ni de suppression d'une note existante depuis ici.
 */
function renderNotesCell(td, task, onChange) {
  td.className = "pilotage-table-td-notes";
  const log = task.notesLog || [];
  const last = log[log.length - 1];

  const preview = document.createElement("span");
  preview.className = "pilotage-table-notes-preview";
  if (last) {
    preview.textContent = truncateText(last.text, 36);
    preview.title = `${last.text}\n${formatDate(new Date(last.createdAt).toISOString())}`;
  } else {
    preview.textContent = "—";
  }
  td.appendChild(preview);

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "pilotage-table-notes-add-btn";
  addBtn.textContent = "+";
  addBtn.title = "Ajouter une note";
  td.appendChild(addBtn);

  const input = document.createElement("input");
  input.type = "text";
  input.className = "pilotage-table-notes-input";
  input.placeholder = "Nouvelle note, puis Entrée";
  input.style.display = "none";
  td.appendChild(input);

  addBtn.addEventListener("click", () => {
    const showing = input.style.display !== "none";
    input.style.display = showing ? "none" : "inline-block";
    if (!showing) input.focus();
  });
  input.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    const text = input.value.trim();
    if (!text) return;
    input.disabled = true;
    await tasksApi.addNote(task.id, text);
    onChange();
  });
}

/** Une ligne "+ Ajouter" par groupe (retour de Charles-Henri : "ajouter les éléments dans les
 *  colonnes" / "ajouter un nouvel élément simplement dans le tableau") — préremplit le champ
 *  qui structure le groupe (Statut ou Projet) pour ne jamais créer une tâche qui disparaîtrait
 *  aussitôt du groupe où elle vient d'être ajoutée. */
function renderQuickAddRow(visibleColumns, group, groupBy) {
  const tr = document.createElement("tr");
  tr.className = "pilotage-table-quickadd-row";

  const tdTitle = document.createElement("td");
  tdTitle.className = "pilotage-table-td-pinned";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "+ Ajouter une tâche";
  input.className = "pilotage-table-quickadd-input";
  input.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    const title = input.value.trim();
    if (!title) return;
    const patch = { title };
    if (groupBy === "status") patch.status = group.key;
    if (groupBy === "project") patch.projectId = group.key === "__none__" ? null : group.key;
    input.disabled = true;
    await tasksApi.createTask(patch);
    input.value = "";
    input.disabled = false;
    input.focus();
  });
  tdTitle.appendChild(input);
  tr.appendChild(tdTitle);

  for (const col of visibleColumns) {
    tr.appendChild(document.createElement("td"));
  }
  return tr;
}

/**
 * Le glisser-déposer entre colonnes est peu fiable au doigt sur mobile, surtout dès que la
 * cible n'est pas visible sans scroller horizontalement (§ergonomie signalée par
 * Charles-Henri). Les boutons ‹ › offrent un chemin qui ne dépend jamais du scroll ni du
 * drag : changer de statut reste possible même quand une seule colonne tient à l'écran.
 */
// Cartes dont la checklist est actuellement dépliée (retour de Charles-Henri, 02/09/2026 :
// "afficher les sous-étapes en dessous, en décalé, mode réduit/déplier"). Au niveau du module
// (pas de renderKanban) pour survivre aux redessins complets du board déclenchés par toute
// mutation de tâche (storage.subscribe) — replié par défaut, comme l'historique des fiches.
const expandedChecklists = new Set();

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
  const statusIndex = tasksApi.STATUSES.indexOf(task.status);
  const prevStatus = statusIndex > 0 ? tasksApi.STATUSES[statusIndex - 1] : null;
  const nextStatus = statusIndex < tasksApi.STATUSES.length - 1 ? tasksApi.STATUSES[statusIndex + 1] : null;
  const checklist = task.checklist || [];
  const checklistDone = checklist.filter((c) => c.done).length;
  const hasChecklist = checklist.length > 0;
  const isExpanded = expandedChecklists.has(task.id);
  // "⏳ En attente de..." (retour de Charles-Henri, 02/09/2026) : n'a de sens que sur ces deux
  // statuts (voir tasksApi.updateTask, qui l'efface automatiquement en sortant) — jamais
  // affiché ailleurs, pour ne pas laisser un champ vide et sans objet sur une tâche "à faire".
  const showWaiting = task.status === "waiting" || task.status === "follow_up";

  card.innerHTML = `
    <div class="kanban-card-title">${task.isBlocked ? "🔴 " : ""}${escapeHtml(task.title)}</div>
    <div class="kanban-card-meta">
      ${project ? `<span>📦 ${escapeHtml(project.name)}</span>` : ""}
      ${task.dueDate ? `<span class="${late ? "badge badge-late" : ""}">📅 ${formatDate(task.dueDate)}</span>` : ""}
      ${hasChecklist ? `<button type="button" class="kanban-checklist-toggle" data-checklist-toggle>${isExpanded ? "▾" : "▸"} ☑️ ${checklistDone}/${checklist.length}</button>` : ""}
    </div>
    ${showWaiting ? `
      <div class="kanban-card-waiting">
        <label>⏳ En attente de</label>
        <input type="text" class="kanban-waiting-input" placeholder="Qui, ou quoi ?" value="${escapeAttr(task.waitingOn || "")}" />
      </div>
    ` : ""}
    <div class="kanban-card-move">
      <button type="button" class="kanban-move-btn" data-dir="prev" aria-label="Statut précédent" ${prevStatus ? "" : "disabled"}>‹</button>
      <span class="kanban-move-label">${tasksApi.STATUS_LABELS[task.status]}</span>
      <button type="button" class="kanban-move-btn" data-dir="next" aria-label="Statut suivant" ${nextStatus ? "" : "disabled"}>›</button>
    </div>
    ${hasChecklist ? `
      <div class="kanban-card-checklist" data-checklist-body style="display:${isExpanded ? "block" : "none"};">
        ${checklist.map((c) => `
          <label class="kanban-checklist-item">
            <input type="checkbox" data-checklist-id="${c.id}" ${c.done ? "checked" : ""} />
            <span class="${c.done ? "done" : ""}">${escapeHtml(c.text)}</span>
          </label>
        `).join("")}
      </div>
    ` : ""}
  `;

  card.querySelector('[data-dir="prev"]').addEventListener("click", (e) => {
    e.stopPropagation();
    if (prevStatus) tasksApi.setStatus(task.id, prevStatus);
  });
  card.querySelector('[data-dir="next"]').addEventListener("click", (e) => {
    e.stopPropagation();
    if (nextStatus) {
      tasksApi.setStatus(task.id, nextStatus);
      celebrateIfJustDone(task.status, nextStatus);
    }
  });

  if (hasChecklist) {
    const toggleBtn = card.querySelector("[data-checklist-toggle]");
    const body = card.querySelector("[data-checklist-body]");
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const expanded = !expandedChecklists.has(task.id);
      if (expanded) expandedChecklists.add(task.id);
      else expandedChecklists.delete(task.id);
      body.style.display = expanded ? "block" : "none";
      toggleBtn.textContent = `${expanded ? "▾" : "▸"} ☑️ ${checklistDone}/${checklist.length}`;
    });
    card.querySelectorAll("[data-checklist-id]").forEach((input) => {
      input.addEventListener("click", (e) => e.stopPropagation());
      input.addEventListener("change", () => {
        tasksApi.toggleChecklistItem(task.id, input.dataset.checklistId, input.checked);
      });
    });
  }

  if (showWaiting) {
    const waitingInput = card.querySelector(".kanban-waiting-input");
    waitingInput.addEventListener("click", (e) => e.stopPropagation());
    waitingInput.addEventListener("change", () => {
      tasksApi.setWaitingNote(task.id, waitingInput.value);
    });
  }

  return card;
}

/**
 * Création autonome d'une tâche, hors du parcours Inbox → qualification — utilisée par le
 * "fil conducteur" (components/linkedItems.js) pour "créer à la volée" une tâche liée à une
 * autre fiche, et par la fiche Projet ("+ Ajouter"). Même pattern prefill/onCreated/onCancel
 * que openCreateProjectModal et openCreateResourceModal.
 *
 * `prefill.createFn` (vague 19, unification des formulaires de création, audit de
 * simplification) : par défaut la tâche est créée directement via `tasksApi.createTask()`,
 * mais l'Inbox (js/views/inbox.js) a besoin que la création passe par
 * `inboxApi.qualify(item.id, "task", ...)` pour ne jamais perdre le lien vers la capture
 * d'origine (Règle 3) ni le rattachement `sourceInboxItemId` — `createFn`, quand fourni, reçoit
 * exactement le même objet de champs et doit renvoyer la tâche créée, pour que ce formulaire
 * n'existe qu'à un seul endroit tout en gardant ce comportement spécifique à l'Inbox.
 */
export async function openCreateTaskModal(prefill = {}) {
  const projects = await projectsApi.listAll();
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="new-task-title">Titre</label>
      <input id="new-task-title" type="text" placeholder="Ex. Préparer la réunion du 27" value="${escapeAttr(prefill.title || "")}" />
    </div>
    <div class="field">
      <label for="new-task-description">Description (optionnel)</label>
      <textarea id="new-task-description" placeholder="Le détail — ce que le titre seul ne suffit pas à dire">${escapeHtml(prefill.description || "")}</textarea>
    </div>
    <div class="field">
      <label for="new-task-due">Échéance (optionnel)</label>
      <input id="new-task-due" type="date" />
    </div>
    <div class="field">
      <label for="new-task-project">Projet (optionnel)</label>
      <select id="new-task-project">
        <option value="">— Aucun —</option>
        ${projects.map((p) => `<option value="${p.id}" ${p.id === prefill.projectId ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("")}
      </select>
    </div>
    <div class="field" style="display:flex;align-items:center;gap:8px;">
      <input id="new-task-communication" type="checkbox" style="width:auto;" />
      <label for="new-task-communication" style="margin:0;">📣 C'est une communication (article, message) — activer son canevas de production</label>
    </div>
  `;
  const { bodyEl, close } = openModal({
    title: "Nouvelle tâche",
    body,
    actions: [
      { label: "Annuler", variant: "ghost", onClick: () => prefill.onCancel?.() },
      {
        label: "Créer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          const title = bodyEl.querySelector("#new-task-title").value.trim();
          if (!title) return;
          const isCommunication = bodyEl.querySelector("#new-task-communication").checked;
          const payload = {
            title,
            description: bodyEl.querySelector("#new-task-description").value.trim(),
            dueDate: bodyEl.querySelector("#new-task-due").value || null,
            projectId: bodyEl.querySelector("#new-task-project").value || null,
            type: isCommunication ? "communication" : "action",
          };
          const task = prefill.createFn ? await prefill.createFn(payload) : await tasksApi.createTask(payload);
          close();
          showToast(prefill.createdToast || "Tâche créée");
          prefill.onCreated?.(task);
        },
      },
    ],
  });
}

/**
 * `onClose` (optionnel) : quand la fiche tâche est ouverte depuis une autre fiche (ex. la
 * fiche projet, en cliquant sur une tâche du bloc "Tâches") plutôt que depuis une vue de
 * premier niveau (Kanban, Calendrier...), fermer/enregistrer/supprimer doit rouvrir la fiche
 * d'origine plutôt que de révéler l'écran du dessous — même principe que le "reopen" déjà
 * utilisé pour les créations depuis la fiche projet (§ round D).
 */
export async function openTaskDetail(task, projects, { onClose } = {}) {
  preferencesApi.recordRecentlyViewed("Task", task.id).catch(() => {});
  const [allResources, allHistory] = await Promise.all([resourcesApi.listAll(), historyApi.listAll()]);
  const linkedResources = allResources.filter((r) => (r.taskIds || []).includes(task.id));
  const unlinkedResources = allResources.filter((r) => !(r.taskIds || []).includes(task.id));
  const taskHistory = allHistory
    .filter((h) => h.entityType === "Task" && h.entityId === task.id)
    .sort((a, b) => a.date - b.date);

  // Titre de réunion composé (retour de Charles-Henri, 01/09/2026, voir
  // js/components/meetingLauncher.js) : Catégorie du projet - Projet - Titre de la tâche —
  // une Tâche n'a jamais de personne assignée (voir le Guide, "Tâche ou Suivi ?"), donc ce
  // 4e segment reste toujours vide ici.
  const taskProject = projects.find((p) => p.id === task.projectId) || null;
  const meetingTitle = buildMeetingTitle({
    category: taskProject?.category || "",
    projectName: taskProject?.name || "",
    itemTitle: task.title,
  });

  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="detail-title">Titre</label>
      <input id="detail-title" type="text" value="${escapeAttr(task.title)}" />
    </div>
    <div class="field">
      <label for="detail-description">Description</label>
      <textarea id="detail-description" placeholder="Le détail — ce que le titre seul ne suffit pas à dire">${escapeHtml(task.description || "")}</textarea>
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
    <div id="detail-canevas"></div>
    <div class="section-title" id="checklist-title">☑️ Sous-étapes (${(task.checklist || []).filter((c) => c.done).length}/${(task.checklist || []).length})</div>
    <div id="detail-checklist" style="margin-bottom:16px;"></div>
    <div class="section-title">🗓️ Réunion</div>
    <div class="field" style="margin-bottom:8px;">
      <input id="meeting-title-preview" type="text" readonly value="${escapeAttr(meetingTitle)}" />
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
      <button id="copy-meeting-title-btn" type="button" class="btn btn-secondary btn-sm">📋 Copier le titre</button>
      <button id="create-meeting-btn" type="button" class="btn btn-secondary btn-sm">🗓️ Créer une réunion (.ics)</button>
    </div>
    <!-- Ressources / Réunions Outlook / Notes : blocs secondaires repliés par défaut (audit de
         simplification du 02/09/2026 — "trop de blocs ouverts en permanence sur une fiche déjà
         longue") ; le compte dans le résumé garde l'information visible sans avoir à déplier. -->
    <details class="fiche-section">
      <summary class="section-title" style="cursor:pointer;">📎 Ressources (${linkedResources.length})</summary>
      <div class="card" id="detail-resources" style="margin-top:8px;margin-bottom:8px;"></div>
      <div style="display:flex;gap:8px;margin-bottom:16px;">
        <button id="link-resource-btn" class="btn btn-secondary btn-sm">🔗 Lier existante</button>
        <button id="new-resource-btn-inline" class="btn btn-secondary btn-sm">+ Nouvelle ressource</button>
      </div>
    </details>
    <details class="fiche-section">
      <summary class="section-title" style="cursor:pointer;">📅 Réunions Outlook associées (${(task.outlookMeetings || []).length})</summary>
      <div class="card" id="detail-outlook" style="margin-top:8px;margin-bottom:8px;"></div>
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
        <input id="outlook-title" type="text" placeholder="Titre de la réunion Outlook" style="flex:2;min-width:140px;border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:var(--space-3);" />
        <input id="outlook-date" type="date" style="flex:1;min-width:120px;border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:var(--space-3);" />
        <button id="add-outlook-btn" type="button" class="btn btn-secondary btn-sm">+ Associer</button>
      </div>
    </details>
    <details class="fiche-section">
      <summary class="section-title" style="cursor:pointer;">🗒️ Notes (${(task.notesLog || []).length})</summary>
      <div id="detail-notes" style="margin-top:8px;margin-bottom:16px;"></div>
    </details>
    <details class="fiche-section">
      <summary class="section-title" style="cursor:pointer;">🕒 Historique (${taskHistory.length})</summary>
      <div class="card" id="detail-history" style="margin-top:8px;margin-bottom:16px;"></div>
    </details>
    <div class="section-title">🔗 Lié</div>
    <div class="card" id="detail-links" style="margin-bottom:8px;"></div>
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <button id="link-existing-btn" class="btn btn-secondary btn-sm">🔗 Lier une fiche</button>
      <button id="create-linked-btn" class="btn btn-secondary btn-sm">+ Créer et lier</button>
    </div>
  `;

  renderCanevas(body.querySelector("#detail-canevas"), task.steps, async (stepKey, done) => {
    await tasksApi.toggleStep(task.id, stepKey, done);
  });
  const checklistTitleEl = body.querySelector("#checklist-title");
  function updateChecklistTitle() {
    const list = task.checklist || [];
    checklistTitleEl.textContent = `☑️ Sous-étapes (${list.filter((c) => c.done).length}/${list.length})`;
  }
  renderChecklist(body.querySelector("#detail-checklist"), task.checklist || [], {
    onAdd: async (text) => {
      const updated = await tasksApi.addChecklistItem(task.id, text);
      task.checklist = updated;
      updateChecklistTitle();
      return updated;
    },
    onToggle: async (itemId, done) => {
      const updated = await tasksApi.toggleChecklistItem(task.id, itemId, done);
      task.checklist = updated;
      updateChecklistTitle();
      return updated;
    },
    onRemove: async (itemId) => {
      const updated = await tasksApi.removeChecklistItem(task.id, itemId);
      task.checklist = updated;
      updateChecklistTitle();
      return updated;
    },
  });
  renderNotesBlock(body.querySelector("#detail-notes"), task.notesLog || [], {
    onAdd: async (text) => {
      const updated = await tasksApi.addNote(task.id, text);
      task.notesLog = updated;
      return updated;
    },
  });
  body.querySelector("#copy-meeting-title-btn").addEventListener("click", () => {
    copyMeetingTitle(meetingTitle);
  });
  body.querySelector("#create-meeting-btn").addEventListener("click", () => {
    closeModal();
    launchMeetingFromEntity({
      ref: { type: "Task", id: task.id },
      routeHash: "#/kanban",
      title: meetingTitle,
      onLinked: () => openTaskDetail(task, projects, { onClose }),
      onCancel: () => openTaskDetail(task, projects, { onClose }),
    });
  });
  linkedItemsApi.renderLinkedSection(body.querySelector("#detail-links"), { type: "Task", id: task.id });
  body.querySelector("#link-existing-btn").addEventListener("click", () => {
    closeModal();
    linkedItemsApi.openLinkPickerModal({ type: "Task", id: task.id }, task.title, {
      onLinked: () => openTaskDetail(task, projects, { onClose }),
      onCancel: () => openTaskDetail(task, projects, { onClose }),
    });
  });
  body.querySelector("#create-linked-btn").addEventListener("click", () => {
    closeModal();
    linkedItemsApi.openCreateAndLinkModal({ type: "Task", id: task.id }, task.title, {
      onLinked: () => openTaskDetail(task, projects, { onClose }),
      onCancel: () => openTaskDetail(task, projects, { onClose }),
    });
  });

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
        openTaskDetail(task, projects, { onClose });
      },
      () => openTaskDetail(task, projects, { onClose })
    );
  });
  body.querySelector("#new-resource-btn-inline").addEventListener("click", () => {
    closeModal();
    openCreateResourceModal({
      taskId: task.id,
      onCreated: () => openTaskDetail(task, projects, { onClose }),
      onCancel: () => openTaskDetail(task, projects, { onClose }),
    });
  });

  const outlookEl = body.querySelector("#detail-outlook");
  renderOutlookList(outlookEl, task);
  body.querySelector("#add-outlook-btn").addEventListener("click", async () => {
    const title = body.querySelector("#outlook-title").value.trim();
    if (!title) return;
    const date = body.querySelector("#outlook-date").value || null;
    const updated = await tasksApi.addOutlookMeeting(task.id, { title, date });
    task.outlookMeetings = updated.outlookMeetings;
    renderOutlookList(outlookEl, task);
    body.querySelector("#outlook-title").value = "";
    body.querySelector("#outlook-date").value = "";
    showToast("Réunion Outlook associée");
  });

  const { bodyEl, close } = openModal({
    title: "Détail de la tâche",
    body,
    actions: [
      { label: "Fermer", variant: "ghost", onClick: () => onClose?.() },
      {
        // "Exporter la vue d'ensemble" (retour de Charles-Henri, vague 22, option (c) retenue
        // parmi les 3 propositions de visualisation automatique) : une image PNG ponctuelle
        // plutôt qu'une vue maintenue dans l'app — voir js/components/overviewExport.js.
        label: "📄 Exporter",
        variant: "secondary",
        closesModal: false,
        onClick: () => exportTaskOverview(task, { project: taskProject, statusLabel: tasksApi.STATUS_LABELS[task.status] }),
      },
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
              onClose?.();
            },
            onCancel: () => openTaskDetail(task, projects, { onClose }),
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
          const newStatus = bodyEl.querySelector("#detail-status").value;
          const prevStatus = task.status;
          await tasksApi.updateTask(task.id, {
            title,
            description: bodyEl.querySelector("#detail-description").value,
            successCriteria: bodyEl.querySelector("#detail-criteria").value,
            dueDate: bodyEl.querySelector("#detail-due").value || null,
            status: newStatus,
            projectId: bodyEl.querySelector("#detail-project").value || null,
            isBlocked: bodyEl.querySelector("#detail-blocked").checked,
          });
          close();
          // Un seul toast à la fois (voir components/toast.js) : la clôture prime sur le
          // message générique de sauvegarde plutôt que de l'écraser silencieusement juste après.
          if (!celebrateIfJustDone(prevStatus, newStatus)) showToast("Tâche mise à jour");
          onClose?.();
        },
      },
    ],
  });
}

/** Référence manuelle (pas de vraie synchro Outlook, voir js/domain/tasks.js) — liste simple
 *  avec suppression, réutilisée à chaque ajout sans devoir rouvrir toute la fiche. */
function renderOutlookList(container, task) {
  const meetings = task.outlookMeetings || [];
  if (!meetings.length) {
    container.innerHTML = `<div class="empty-state" style="padding:16px;">Aucune réunion Outlook associée.</div>`;
    return;
  }
  container.innerHTML = "";
  for (const m of meetings) {
    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
      <div class="item-main">
        <div class="item-title">📅 ${escapeHtml(m.title)}</div>
        ${m.date ? `<div class="item-meta">${formatDate(m.date)}</div>` : ""}
      </div>
    `;
    const btn = document.createElement("button");
    btn.className = "btn btn-ghost btn-sm";
    btn.textContent = "Retirer";
    btn.addEventListener("click", async () => {
      await tasksApi.removeOutlookMeeting(task.id, m.id);
      task.outlookMeetings = (task.outlookMeetings || []).filter((x) => x.id !== m.id);
      renderOutlookList(container, task);
    });
    row.appendChild(btn);
    container.appendChild(row);
  }
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
