// Vue Projets — §36 à §38 : "Où en est Modernisation ?" et la possibilité de descendre
// jusqu'à la tâche précise (§71).

import * as projectsApi from "../domain/projects.js";
import * as tasksApi from "../domain/tasks.js";
import * as resourcesApi from "../domain/resources.js";
import * as followUpsApi from "../domain/followups.js";
import * as peopleApi from "../domain/people.js";
import * as meetingsApi from "../domain/meetings.js";
import * as decisionsApi from "../domain/decisions.js";
import * as historyApi from "../domain/history.js";
import * as preferencesApi from "../domain/preferences.js";
import * as pilotageView from "../services/pilotageViewStore.js";
import { openModal, closeModal, confirmDelete } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { suggestNextStep } from "../components/suggestNextStep.js";
import { openCreateResourceModal, renderResourceList, openResourcePickerModal } from "./resources.js";
import { renderHistoryTimeline } from "../components/historyTimeline.js";
import * as linkedItemsApi from "../components/linkedItems.js";
import { renderCanevas } from "../components/canevas.js";
import { renderNotesBlock } from "../components/notesBlock.js";
import { openCreateTaskModal, openTaskDetail } from "./kanban.js";
import { openCreateFollowUpModal, openEditFollowUpModal } from "./people.js";
import { openCreateMeetingModal, openCreateDecisionModal, openRecentDetail } from "./dashboard.js";
import { renderInfoTip } from "../components/infoTip.js";
import { renderShortcutAssignButton } from "../services/shortcuts.js";
import { copyEntityLink } from "../components/copyLink.js";
import { renderPilotageSubNav } from "../components/pilotageSubNav.js";
import * as projectHealthApi from "../domain/projectHealth.js";
import { renderProjectHealth } from "../components/projectHealth.js";

// Légende ⓘ (audit de simplification du 02/09/2026) : la fiche Projet est le seul écran où les
// trois vocabulaires de statut de l'app coexistent côte à côte (Tâches, Suivis, Sous-parties) —
// un rappel explicite évite de les confondre, contrairement à Pilotage ou Équipe qui n'en
// affichent chacun qu'un seul (voir tasksApi.STATUS_INFO_HTML / followUpsApi.STATUS_INFO_HTML).
const PROJECT_STATUS_INFO_HTML =
  "Cette fiche mélange volontairement trois vocabulaires de statut distincts : les <strong>Tâches</strong> (⚪🔵⏳👀🟢, le pipeline de travail), les <strong>Suivis</strong> (⏳🔁✅, attendre une personne) et les <strong>Sous-parties</strong> (◻️🔶✅, avancement d'un bloc sans créer de tâche dédiée).";

export function renderProjects(container) {
  // Plein écran en mode web (retour de Charles-Henri, 07/09/2026 : "il y a toujours un
  // décalage [...] Tâches qui prend toute la page, à Projet qui réduit sur le milieu
  // uniquement") — même classe et même principe que js/views/kanban.js (posée/retirée au
  // montage/démontage), pour que les 3 écrans Pilotage (Tâches/Projets/Calendrier) se
  // comportent enfin à l'identique en largeur.
  container.classList.add("app-wide");

  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Projets</h1>
        <div class="subtitle" id="projects-subtitle">—</div>
      </div>
    </div>
    <div class="view">
      <div id="pilotage-subnav"></div>
      <!-- "+ Projet" descendu du bandeau du haut, Statut/Tri/Catégorie regroupés dans un seul
           menu "🔧 Filtrer & trier" (audit du 07/09/2026, retour de Charles-Henri : "Actif/
           Fermés, Ordre/avancement, filtres [...] ça fait 4 lignes") — même popover que celui
           déjà utilisé côté Tâches (js/views/kanban.js). AUCUN id n'a été renommé
           (status-filter, sort-toggle, category-filters) : tout le câblage plus bas continue de
           cibler les mêmes éléments, seul leur emplacement dans le DOM change.

           Bascule "📋 Liste / 🗂️ Par catégorie" ajoutée le 07/09/2026 (retour de Charles-Henri :
           "une vue qui regroupe les projets par catégorie [...] répartie sur la page par bloc,
           avec possibilité de glisser pour passer un projet d'une catégorie à l'autre") — même
           patron que Trello/Tableau côté Tâches (js/views/kanban.js) : une bascule de type de
           vue à côté du menu de filtres, jamais confondue avec lui (vague 30). La vue par
           catégorie n'a pas de sens croisée avec le filtre "Catégorie" lui-même (on les voit
           déjà toutes, côte à côte) — ce groupe de filtre est donc masqué en vue "category",
           voir #projects-category-filter-group plus bas. -->
      <div class="chip-row" id="projects-controls" style="flex-wrap:wrap;">
        <button id="new-project-btn" class="btn btn-primary btn-sm">+ Projet</button>
        <button type="button" class="chip" data-view="list">📋 Liste</button>
        <button type="button" class="chip" data-view="category">🗂️ Par catégorie</button>
        <button type="button" class="chip" data-view="health">🩺 Santé</button>
        <details class="filter-popover" id="projects-filter-popover">
          <summary class="chip">🔧 Filtrer &amp; trier<span class="filter-popover-badge" id="projects-filter-badge" hidden></span></summary>
          <div class="filter-popover-panel">
            <div class="filter-popover-group">
              <div class="filter-popover-label">Statut</div>
              <div class="chip-row" id="status-filter" style="margin-bottom:0;">
                <button type="button" class="chip active" data-status="active">🟢 Actifs</button>
                <button type="button" class="chip" data-status="archived">🗄️ Fermés</button>
              </div>
            </div>
            <div class="filter-popover-group">
              <div class="filter-popover-label">Trier par</div>
              <div class="chip-row" id="sort-toggle" style="margin-bottom:0;">
                <button type="button" class="chip" data-sort="manual">✋ Ordre manuel</button>
                <button type="button" class="chip" data-sort="progress">📊 Avancement</button>
              </div>
            </div>
            <div class="filter-popover-group" id="projects-category-filter-group">
              <div class="filter-popover-label">Catégorie</div>
              <div class="chip-row" id="category-filters" style="flex-wrap:wrap;margin-bottom:0;"></div>
            </div>
          </div>
        </details>
      </div>
      <div id="projects-list"></div>
      <div id="projects-board" class="projects-board" style="display:none;"></div>
      <!-- "🩺 Santé" (§49, détecteur de signaux faibles) : un 3e mode de vue de plus, même
           bascule que Liste/Par catégorie ci-dessus plutôt qu'un nouvel onglet Pilotage — un
           score de santé par projet n'est qu'une autre façon de regarder le même flux de
           Projets, pas un flux de données différent. -->
      <div id="projects-health" style="display:none;"></div>
    </div>
  `;

  renderPilotageSubNav(container.querySelector("#pilotage-subnav"), "#/projects");
  const listEl = container.querySelector("#projects-list");
  const boardEl = container.querySelector("#projects-board");
  const healthEl = container.querySelector("#projects-health");
  const subtitleEl = container.querySelector("#projects-subtitle");
  const statusFilterEl = container.querySelector("#status-filter");
  const sortToggleEl = container.querySelector("#sort-toggle");
  const categoryFiltersEl = container.querySelector("#category-filters");
  const categoryFilterGroupEl = container.querySelector("#projects-category-filter-group");
  const filterPopoverEl = container.querySelector("#projects-filter-popover");
  const filterBadgeEl = container.querySelector("#projects-filter-badge");
  const controlsEl = container.querySelector("#projects-controls");
  container.querySelector("#new-project-btn").addEventListener("click", () => openCreateProjectModal());

  // Bascule de vue (localStorage, propre à l'appareil — même mécanique que
  // js/services/pilotageViewStore.js#mode côté Tâches, voir setProjectsMode()).
  let viewMode = pilotageView.getViewState().projectsMode;
  function updateViewToggle() {
    controlsEl.querySelectorAll("[data-view]").forEach((chip) => chip.classList.toggle("active", chip.dataset.view === viewMode));
    // "🩺 Santé" (§49) a sa propre logique de tri (par score) et ne montre toujours que les
    // projets actifs — Statut/Tri/Catégorie n'ont pas de prise dessus, même principe que
    // Priorisation/Charge qui ont chacun leurs propres réglages plutôt que d'hériter de ceux
    // d'un autre écran.
    filterPopoverEl.style.display = viewMode === "health" ? "none" : "";
    categoryFilterGroupEl.style.display = viewMode === "category" ? "none" : "";
    listEl.style.display = viewMode === "list" ? "" : "none";
    boardEl.style.display = viewMode === "category" ? "" : "none";
    healthEl.style.display = viewMode === "health" ? "" : "none";
  }
  updateViewToggle();
  controlsEl.querySelectorAll("[data-view]").forEach((chip) => {
    chip.addEventListener("click", () => {
      viewMode = chip.dataset.view;
      pilotageView.setProjectsMode(viewMode);
      updateViewToggle();
      updateFilterBadge();
      renderCurrent();
    });
  });

  // Même mécanique de badge que "🔧 Filtrer & trier" côté Tâches (js/views/kanban.js) : compte
  // seulement ce qui s'écarte du réglage par défaut (Actifs / Ordre manuel / Toutes catégories),
  // pour ne jamais laisser un filtre actif oublié invisible une fois le menu replié.
  function updateFilterBadge() {
    // Le filtre "Catégorie" est masqué (et sans effet, voir renderCategoryBoard) en vue "🗂️ Par
    // catégorie" — il ne doit donc jamais compter dans le badge tant que cette vue est active,
    // pour ne jamais afficher "1 filtre actif" sans rien de visible à quoi le rattacher.
    const count = (statusFilter !== "active" ? 1 : 0) + (sortMode !== "manual" ? 1 : 0) + (viewMode !== "category" && categoryFilter !== "all" ? 1 : 0);
    filterBadgeEl.textContent = count ? String(count) : "";
    filterBadgeEl.hidden = count === 0;
  }
  function closeFilterPopoverOnOutsideClick(e) {
    if (filterPopoverEl.open && !filterPopoverEl.contains(e.target)) filterPopoverEl.open = false;
  }
  document.addEventListener("click", closeFilterPopoverOnOutsideClick);

  let rawProjects = [];
  let projects = [];
  let tasks = [];
  let followUps = [];
  let sortMode = "manual";
  let categories = {};
  let categoryFilter = "all";
  // "Fermés" (retour de Charles-Henri, 02/09/2026 — clôture de projet) : un filtre chip de
  // plus dans cet onglet existant plutôt qu'un nouvel écran d'archive dédié — même principe
  // que les autres filtres de cet onglet (catégorie, tri).
  let statusFilter = "active";

  function applyStatusFilter() {
    projects = statusFilter === "archived" ? rawProjects.filter((p) => p.status === "archived") : rawProjects.filter((p) => p.status !== "archived");
  }

  statusFilterEl.querySelectorAll("[data-status]").forEach((chip) => {
    chip.addEventListener("click", () => {
      statusFilter = chip.dataset.status;
      statusFilterEl.querySelectorAll("[data-status]").forEach((c) => c.classList.toggle("active", c.dataset.status === statusFilter));
      applyStatusFilter();
      updateFilterBadge();
      renderCurrent();
    });
  });

  preferencesApi.getPreferences().then((prefs) => {
    sortMode = prefs.projectSort || "manual";
    categories = prefs.categories || {};
    updateSortToggle();
    updateFilterBadge();
    renderCurrent();
  });

  function updateSortToggle() {
    sortToggleEl.querySelectorAll("[data-sort]").forEach((chip) => chip.classList.toggle("active", chip.dataset.sort === sortMode));
  }
  sortToggleEl.querySelectorAll("[data-sort]").forEach((chip) => {
    chip.addEventListener("click", async () => {
      sortMode = chip.dataset.sort;
      updateSortToggle();
      updateFilterBadge();
      await preferencesApi.setProjectSort(sortMode);
      renderCurrent();
    });
  });

  /** Redessine la vue actuellement affichée (Liste, Par catégorie ou Santé) — un seul point
   *  d'entrée pour tous les déclencheurs (filtres, tri, bascule de vue, données à jour), pour ne
   *  jamais en oublier un qui redessinerait la mauvaise vue ou aucune des trois. */
  function renderCurrent() {
    if (viewMode === "category") renderCategoryBoard();
    else if (viewMode === "health") renderHealth();
    else render();
  }

  /** "🩺 Santé" (§49) : toujours les projets ACTIFS (rankByHealth filtre déjà `status ===
   *  "active"" en interne), indépendamment du filtre Statut/Catégorie/Tri de la vue Liste — ce
   *  n'est pas une liste filtrable de plus, c'est un tableau de bord à part entière. */
  function renderHealth() {
    const ranked = projectHealthApi.rankByHealth(rawProjects, tasks, followUps);
    renderProjectHealth(healthEl, ranked, {
      onOpenProject: (project) => openProjectDetail(project, tasks.filter((t) => t.projectId === project.id)),
      // Clic sur un signal précis (retour de Charles-Henri, 07/09/2026 : "qu'on puisse cliquer
      // sur l'élément [...] pour ouvrir l'élément ciblé par cette information, pas le projet") —
      // ouvre directement la Tâche ou le Suivi visé, jamais la fiche Projet. Mêmes fonctions
      // d'ouverture déjà utilisées ailleurs dans ce fichier (openTaskDetail pour "+ Tâche" côté
      // fiche Projet, openEditFollowUpModal pour le clic sur un Suivi lié).
      onOpenSignal: (target) => {
        if (target.type === "Task") {
          const task = tasks.find((t) => t.id === target.id);
          if (task) openTaskDetail(task, rawProjects.filter((p) => !projectsApi.isArchived(p)));
        } else if (target.type === "FollowUp") {
          const followUp = followUps.find((f) => f.id === target.id);
          if (followUp) openEditFollowUpModal(followUp);
        }
      },
    });
  }

  /**
   * Construit une carte Projet — factorisé le 07/09/2026 (ajout de la vue "Par catégorie") pour
   * que la Liste et les colonnes de catégorie ne dessinent jamais la carte différemment. Le
   * glisser-déposer fait DEUX choses désormais, jamais confondues : réordonner (ordre manuel,
   * `orderedIds` — toujours la liste GLOBALE, jamais un sous-ensemble par catégorie, pour ne
   * jamais désynchroniser l'ordre manuel affiché en vue Liste) et, seulement en vue par
   * catégorie (`categoryMode`), changer la catégorie du projet déposé si elle diffère de celle
   * de la colonne visée (`columnCategory`) — appliqué immédiatement, sans confirmation (retour
   * de Charles-Henri, question posée avant d'agir). Une carte reste déplaçable en vue par
   * catégorie même en tri "Avancement" (`sortMode !== "manual"`) : changer de catégorie n'a
   * rien à voir avec l'ordre d'affichage, contrairement à la Liste où glisser ne sert QUE à
   * réordonner et n'a donc de sens qu'en tri manuel.
   */
  function buildProjectCard(project, { tasksByProject, orderedIds, projectsById, categoryMode, columnCategory }) {
    const projectTasks = tasksByProject.get(project.id) || [];
    const progress = projectsApi.computeProgress(projectTasks);
    const icon = preferencesApi.categoryIcon(categories, project.category);
    const isArchived = projectsApi.isArchived(project);
    const draggable = !isArchived && (sortMode === "manual" || categoryMode);

    const card = document.createElement("div");
    card.className = "card";
    card.style.marginBottom = "12px";
    card.style.cursor = "pointer";
    card.draggable = draggable;
    if (draggable) card.style.cursor = "grab";
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <div class="item-title">${icon ? icon + " " : ""}${escapeHtml(project.name)}${project.critical ? ` <span class="badge badge-critical">⭐ Prioritaire</span>` : ""}${isArchived ? ` <span class="badge badge-archived">🗄️ Fermé</span>` : ""}</div>
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
    // Réouverture rapide directement depuis la carte (retour de Charles-Henri) — pas besoin
    // d'ouvrir toute la fiche juste pour rouvrir un projet fermé qu'on repère dans la liste.
    if (isArchived) {
      const reopenBtn = document.createElement("button");
      reopenBtn.type = "button";
      reopenBtn.className = "btn btn-secondary btn-sm";
      reopenBtn.style.marginTop = "8px";
      reopenBtn.textContent = "↩️ Rouvrir";
      reopenBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await projectsApi.reopenProject(project.id);
        showToast("Projet rouvert");
      });
      card.appendChild(reopenBtn);
    }
    card.addEventListener("click", (e) => {
      // Un glisser-déposer qui se termine peut déclencher un click parasite — seul un cas où
      // `draggable` est vrai peut en produire un.
      if (card.dataset.justDragged) return;
      openProjectDetail(project, projectTasks);
    });
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/project-id", project.id);
    });
    card.addEventListener("dragover", (e) => {
      if (!draggable) return;
      e.preventDefault();
      card.classList.add("drag-over");
    });
    card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
    card.addEventListener("drop", async (e) => {
      if (!draggable) return;
      e.preventDefault();
      e.stopPropagation(); // évite de aussi déclencher le drop de la colonne (vue par catégorie)
      card.classList.remove("drag-over");
      const draggedId = e.dataTransfer.getData("text/project-id");
      if (!draggedId || draggedId === project.id) return;
      const dragged = projectsById.get(draggedId);
      if (!dragged) return;
      if (categoryMode && (dragged.category || null) !== columnCategory) {
        await projectsApi.updateProject(draggedId, { category: columnCategory });
      }
      if (sortMode === "manual") {
        const ids = [...orderedIds];
        const from = ids.indexOf(draggedId);
        const to = ids.indexOf(project.id);
        if (from >= 0 && to >= 0) {
          ids.splice(to, 0, ids.splice(from, 1)[0]);
          card.dataset.justDragged = "1";
          await projectsApi.reorderProjects(ids);
          setTimeout(() => delete card.dataset.justDragged, 300);
        }
      }
    });
    return card;
  }

  function render() {
    subtitleEl.textContent = projects.length ? `${projects.length} projet(s)` : "Aucun projet";

    const availableCategories = [...new Set(projects.map((p) => p.category).filter(Boolean))];
    categoryFiltersEl.innerHTML = [`<button type="button" class="chip${categoryFilter === "all" ? " active" : ""}" data-cat="all">Toutes</button>`]
      .concat(
        availableCategories.map(
          (c) => `<button type="button" class="chip${categoryFilter === c ? " active" : ""}" data-cat="${escapeAttr(c)}">${preferencesApi.categoryIcon(categories, c)} ${escapeHtml(c)}</button>`
        )
      )
      .join("");
    categoryFiltersEl.querySelectorAll("[data-cat]").forEach((chip) => {
      chip.addEventListener("click", () => {
        categoryFilter = chip.dataset.cat;
        updateFilterBadge();
        renderCurrent();
      });
    });

    if (!projects.length) {
      listEl.innerHTML =
        statusFilter === "archived"
          ? `
        <div class="empty-state">
          <span class="emoji">🗄️</span>
          Aucun projet fermé pour l'instant.
        </div>`
          : `
        <div class="empty-state">
          <span class="emoji">📦</span>
          Pas encore de projet. Crée le premier avec le bouton « + Projet ».
        </div>`;
      return;
    }

    const filtered = categoryFilter === "all" ? projects : projects.filter((p) => p.category === categoryFilter);
    const tasksByProject = new Map();
    for (const project of filtered) tasksByProject.set(project.id, tasks.filter((t) => t.projectId === project.id));
    const ordered = projectsApi.sortProjects(filtered, sortMode, tasksByProject);
    const orderedIds = ordered.map((p) => p.id);
    const projectsById = new Map(filtered.map((p) => [p.id, p]));

    listEl.innerHTML = "";
    for (const project of ordered) {
      listEl.appendChild(buildProjectCard(project, { tasksByProject, orderedIds, projectsById, categoryMode: false }));
    }
  }

  /**
   * Vue "🗂️ Par catégorie" (retour de Charles-Henri, 07/09/2026) : une colonne par catégorie
   * (ordre = ordre d'enregistrement des catégories, voir preferencesApi.registerCategory),
   * "Sans catégorie" toujours en dernier, glisser une carte d'une colonne à l'autre change sa
   * catégorie. Ignore volontairement `categoryFilter` (le filtre "Catégorie" du menu, masqué en
   * vue "category" par updateViewToggle()) : le but de cette vue est justement de TOUTES les
   * voir côte à côte. "Si pas de projet suite au filtre alors la catégorie disparaît" (demande
   * explicite) : une colonne dont le contenu est vide après le filtre Statut n'est simplement
   * jamais construite, plutôt que montrée vide — y compris "Sans catégorie".
   */
  function renderCategoryBoard() {
    subtitleEl.textContent = projects.length ? `${projects.length} projet(s)` : "Aucun projet";
    boardEl.innerHTML = "";

    if (!projects.length) {
      boardEl.innerHTML =
        statusFilter === "archived"
          ? `<div class="empty-state"><span class="emoji">🗄️</span>Aucun projet fermé pour l'instant.</div>`
          : `<div class="empty-state"><span class="emoji">📦</span>Pas encore de projet. Crée le premier avec le bouton « + Projet ».</div>`;
      return;
    }

    const tasksByProject = new Map();
    for (const project of projects) tasksByProject.set(project.id, tasks.filter((t) => t.projectId === project.id));
    // Ordre GLOBAL (tous projets visibles confondus, toutes catégories) — c'est ce même tableau
    // qui sert de base au glisser-déposer "réordonner" dans buildProjectCard(), pour que l'ordre
    // manuel reste cohérent entre cette vue et la Liste (jamais deux ordres différents selon la
    // vue affichée).
    const orderedAll = projectsApi.sortProjects(projects, sortMode, tasksByProject);
    const orderedIds = orderedAll.map((p) => p.id);
    const projectsById = new Map(projects.map((p) => [p.id, p]));

    const registeredNames = Object.keys(categories); // ordre d'enregistrement (voir preferences.js)
    const looseNames = [...new Set(projects.map((p) => p.category).filter((c) => c && !registeredNames.includes(c)))];
    const buckets = [...registeredNames, ...looseNames]
      .map((name) => ({ key: name, label: name, icon: preferencesApi.categoryIcon(categories, name) }))
      .filter((b) => projects.some((p) => p.category === b.key));
    const uncategorizedCount = projects.filter((p) => !p.category).length;
    if (uncategorizedCount) buckets.push({ key: null, label: "Sans catégorie", icon: "📁" });

    if (!buckets.length) {
      boardEl.innerHTML = `<div class="empty-state"><span class="emoji">📦</span>Rien à afficher avec ces filtres.</div>`;
      return;
    }

    for (const bucket of buckets) {
      const bucketProjects = bucket.key === null ? projects.filter((p) => !p.category) : projects.filter((p) => p.category === bucket.key);
      const orderedBucket = projectsApi.sortProjects(bucketProjects, sortMode, tasksByProject);

      const column = document.createElement("div");
      column.className = "projects-category-column";
      const header = document.createElement("div");
      header.className = "kanban-column-header";
      header.innerHTML = `<span>${bucket.icon} ${escapeHtml(bucket.label)}</span>`;
      const count = document.createElement("span");
      count.className = "count";
      count.textContent = orderedBucket.length;
      header.appendChild(count);
      column.appendChild(header);

      const cardsWrap = document.createElement("div");
      cardsWrap.className = "projects-category-cards";
      for (const project of orderedBucket) {
        cardsWrap.appendChild(
          buildProjectCard(project, { tasksByProject, orderedIds, projectsById, categoryMode: true, columnCategory: bucket.key })
        );
      }
      column.appendChild(cardsWrap);

      // Cible de dépose sur la colonne elle-même (pas seulement sur une carte) — pour pouvoir
      // déposer sous la dernière carte, ou dans une colonne qui n'en a qu'une ou deux. Le
      // `e.stopPropagation()` du drop d'une carte (buildProjectCard) évite tout double
      // traitement quand la dépose a lieu directement sur une carte.
      cardsWrap.addEventListener("dragover", (e) => {
        e.preventDefault();
        cardsWrap.classList.add("drag-over");
      });
      cardsWrap.addEventListener("dragleave", () => cardsWrap.classList.remove("drag-over"));
      cardsWrap.addEventListener("drop", async (e) => {
        e.preventDefault();
        cardsWrap.classList.remove("drag-over");
        const draggedId = e.dataTransfer.getData("text/project-id");
        if (!draggedId) return;
        const dragged = projectsById.get(draggedId);
        if (!dragged) return;
        if ((dragged.category || null) !== bucket.key) {
          await projectsApi.updateProject(draggedId, { category: bucket.key });
        }
      });

      boardEl.appendChild(column);
    }
  }

  const unsubProjects = projectsApi.subscribe((items) => {
    rawProjects = items;
    applyStatusFilter();
    renderCurrent();
  });
  const unsubTasks = tasksApi.subscribe((items) => {
    tasks = items;
    renderCurrent();
  });
  // Suivis en retard rattachés au projet — un des signaux de "🩺 Santé" (§49) ; jamais utilisé
  // par les vues Liste/Par catégorie, mais un seul abonnement partagé plutôt qu'un chargement à
  // chaque bascule vers ce mode évite un flash "aucun signal" le temps de la requête.
  const unsubFollowUps = followUpsApi.subscribe((items) => {
    followUps = items;
    renderCurrent();
  });

  return function cleanup() {
    container.classList.remove("app-wide");
    unsubProjects();
    unsubTasks();
    unsubFollowUps();
    document.removeEventListener("click", closeFilterPopoverOnOutsideClick);
  };
}

/**
 * Exportée pour être réutilisée depuis la qualification Inbox (§13) avec un titre
 * pré-rempli à partir de la capture brute, sans dupliquer ce formulaire — même pattern
 * que openCreateResourceModal côté Ressources. Asynchrone (retour de Charles-Henri, champ
 * Catégorie) : le champ propose les catégories déjà utilisées via une datalist, il faut donc
 * les charger avant de construire le formulaire.
 */
/**
 * Ajoute une option "+ Nouveau projet…" en fin de la liste d'un `<select>` de rattachement à
 * un projet — la choisir ouvre `openCreateProjectModal` (déjà utilisée partout ailleurs pour
 * créer un projet) SANS fermer ni recharger le formulaire englobant : le projet créé est
 * inséré comme option et sélectionné directement dans ce même `<select>` au retour.
 *
 * Retour de Charles-Henri, vague 40, 09/09/2026 : "sur tous les éléments qui demandent le
 * rattachement même optionnel à un projet, je dois pouvoir créer un projet à la volée si non
 * présent dans la liste déroulante." Un seul helper partagé plutôt qu'une modale de création
 * dupliquée dans chaque formulaire (Tâche, Suivi, Information/Idée...) qui référence un
 * `<select>` de projet — voir js/views/kanban.js, js/views/dashboard.js, js/views/people.js.
 */
export function attachProjectQuickCreate(selectEl) {
  const createOption = document.createElement("option");
  createOption.value = "__create__";
  createOption.textContent = "+ Nouveau projet…";
  selectEl.appendChild(createOption);

  let lastRealValue = selectEl.value === "__create__" ? "" : selectEl.value;
  selectEl.addEventListener("change", () => {
    if (selectEl.value !== "__create__") {
      lastRealValue = selectEl.value;
      return;
    }
    // Ne reste jamais bloqué sur "+ Nouveau projet…" — revient à la sélection précédente
    // pendant que la modale de création est ouverte (utile si elle est annulée).
    selectEl.value = lastRealValue;
    openCreateProjectModal({
      onCreated: (project) => {
        const opt = document.createElement("option");
        opt.value = project.id;
        opt.textContent = project.name;
        selectEl.insertBefore(opt, createOption);
        selectEl.value = project.id;
        lastRealValue = project.id;
        selectEl.dispatchEvent(new Event("change"));
      },
    });
  });
}

export async function openCreateProjectModal(prefill = {}) {
  const prefs = await preferencesApi.getPreferences();
  const categoryNames = Object.keys(prefs.categories || {});

  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="project-name">Nom</label>
      <input id="project-name" type="text" placeholder="Ex. Communication Agro" value="${escapeAttr(prefill.name || "")}" />
    </div>
    <div class="field">
      <label for="project-category">Catégorie (optionnel — CSE, Modernisation...)</label>
      <input id="project-category" type="text" list="project-category-options" placeholder="Choisir ou créer une catégorie" />
      <datalist id="project-category-options">
        ${categoryNames.map((c) => `<option value="${escapeAttr(c)}"></option>`).join("")}
      </datalist>
    </div>
    <div class="field">
      <label for="project-objective">Objectif (optionnel)</label>
      <textarea id="project-objective" placeholder="Qu'est-ce qu'on cherche à obtenir ?">${escapeHtml(prefill.objective || "")}</textarea>
    </div>
    <div class="field" style="display:flex;align-items:center;gap:8px;">
      <input id="project-critical" type="checkbox" style="width:auto;" ${prefill.critical ? "checked" : ""} />
      <label for="project-critical" style="margin:0;">⭐ Projet prioritaire (compte dans la Priorisation)</label>
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
          const category = bodyEl.querySelector("#project-category").value.trim();
          if (category) await preferencesApi.registerCategory(category);
          const project = await projectsApi.createProject({
            name,
            category: category || null,
            objective: bodyEl.querySelector("#project-objective").value.trim(),
            critical: bodyEl.querySelector("#project-critical").checked,
          });
          close();
          showToast("Projet créé");
          prefill.onCreated?.(project);
        },
      },
    ],
  });
}

export async function openProjectDetail(project, tasks) {
  preferencesApi.recordRecentlyViewed("Project", project.id).catch(() => {});
  const progress = projectsApi.computeProgress(tasks);
  const [allProjects, allResources, allFollowUps, allMeetings, allDecisions, allHistory, prefs, allPeople] = await Promise.all([
    projectsApi.listAll(),
    resourcesApi.listAll(),
    followUpsApi.listAll(),
    meetingsApi.listAll(),
    decisionsApi.listAll(),
    historyApi.listAll(),
    preferencesApi.getPreferences(),
    peopleApi.listAll(),
  ]);
  // Pour afficher le collaborateur sur chaque Suivi lié ci-dessous (retour de Charles-Henri,
  // 07/09/2026 : "je vois pas à qui est attribué le suivi [...] à tous les niveaux où ça
  // apparaît") — un projet transverse peut avoir des Suivis pour plusieurs collaborateurs à la
  // fois, contrairement à une fiche Personne où le nom est déjà celui de la page entière.
  const peopleById = new Map(allPeople.map((p) => [p.id, p]));
  const linkedResources = allResources.filter((r) => (r.projectIds || []).includes(project.id));
  const unlinkedResources = allResources.filter((r) => !(r.projectIds || []).includes(project.id));
  const linkedFollowUps = allFollowUps.filter((f) => f.projectId === project.id);
  const linkedMeetings = allMeetings.filter((m) => m.projectId === project.id);
  const linkedDecisions = allDecisions.filter((d) => d.projectId === project.id);
  const parts = project.parts || [];

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

  const isArchived = projectsApi.isArchived(project);

  // Fiche à onglets (vague 25, retour de Charles-Henri : "je veux aussi une organisation piste A
  // comme sur les tâches" — voir claude/vague-25-onglets-fiches-controle-suivi.md, section 3,
  // pour l'inventaire complet et le découpage validé). En-tête toujours visible (Nom, Catégorie,
  // badge Actif/Fermé, raccourci clavier), puis 3 onglets : Détails (Objectif/Critère de
  // réussite/Canevas/Notes), Contenu (Sous-parties/Tâches/Suivis/Réunions/Décisions) et Activité
  // (Ressources/Historique/Lié). AUCUN champ, bouton ou id n'est retiré ni renommé par rapport à
  // la version précédente — seul l'emplacement visuel change, tout le câblage plus bas
  // (querySelector par id) continue de fonctionner à l'identique.
  //
  // Audit TDAH ciblé du 07/09/2026 (claude/vague-27-superadmin-usage-kpi.md § audit) : la fiche
  // Projet avait 4 onglets contre 3 pour la fiche Tâche, signalé "à surveiller" dans la vague 25.
  // Sous-parties n'a pas assez de matière pour justifier un onglet à elle seule (un seul bloc
  // d'ajout + une liste) et c'est, de fait, un contenu du projet au même titre que les Tâches ou
  // les Suivis — elle rejoint donc l'onglet Contenu, en premier (avant Tâches), plutôt que de
  // garder un 4e onglet dédié. Le système à trois états + notes par sous-partie n'est PAS touché
  // ici (décision explicite du 02/09/2026 de le garder distinct des Tâches, voir
  // js/domain/projects.js) — seul l'endroit où il s'affiche change.
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="detail-name">Nom</label>
      <input id="detail-name" type="text" value="${escapeAttr(project.name)}" />
    </div>
    <div class="field">
      <label for="detail-category">Catégorie (optionnel)</label>
      <input id="detail-category" type="text" list="detail-category-options" value="${escapeAttr(project.category || "")}" placeholder="Choisir ou créer une catégorie" />
      <datalist id="detail-category-options">
        ${Object.keys(prefs.categories || {}).map((c) => `<option value="${escapeAttr(c)}"></option>`).join("")}
      </datalist>
    </div>
    <div class="item-meta" style="margin-bottom:12px;">${isArchived ? "🗄️ Fermé" : "🟢 Actif"}</div>
    <!-- "⭐ Projet prioritaire" (vague 33, retour de Charles-Henri : "impact — le projet est-il
         critique ?") — seul signal manuel requis par la matrice de priorisation, volontairement
         posé ici (en-tête de la fiche, toujours visible) plutôt que dans l'onglet Détails, au
         même niveau que le statut Actif/Fermé juste au-dessus. -->
    <div class="field" style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
      <input id="detail-critical" type="checkbox" style="width:auto;" ${project.critical ? "checked" : ""} />
      <label for="detail-critical" style="margin:0;">⭐ Projet prioritaire (compte dans la Priorisation)</label>
    </div>
    <div id="project-shortcut" style="margin-bottom:12px;"></div>

    <div class="chip-row fiche-tabs" role="tablist">
      <button type="button" class="chip active" data-tab="details" role="tab">Détails</button>
      <button type="button" class="chip" data-tab="content" role="tab">Contenu</button>
      <button type="button" class="chip" data-tab="activity" role="tab">Activité</button>
    </div>

    <div class="fiche-tabpanel" data-tabpanel="details">
      <div class="field">
        <label for="detail-objective">Objectif</label>
        <textarea id="detail-objective">${escapeHtml(project.objective || "")}</textarea>
      </div>
      <div class="field">
        <label for="detail-criteria">Critère de réussite</label>
        <textarea id="detail-criteria" placeholder="Comment saurai-je que ce projet est réussi ?">${escapeHtml(project.successCriteria || "")}</textarea>
      </div>
      <div id="detail-canevas"></div>
      <!-- Notes : bloc secondaire replié par défaut (audit de simplification du 02/09/2026 —
           "trop de blocs ouverts en permanence sur une fiche déjà longue") ; le compte dans le
           résumé garde l'information visible sans avoir à déplier. -->
      <details class="fiche-section">
        <summary class="section-title" style="cursor:pointer;">🗒️ Notes (${(project.notesLog || []).length})</summary>
        <div id="detail-notes" style="margin-top:8px;margin-bottom:16px;"></div>
      </details>
    </div>

    <div class="fiche-tabpanel" data-tabpanel="content" hidden>
      <!-- Sous-parties (déplacé ici le 07/09/2026, ex-onglet dédié — voir commentaire plus haut) :
           reste en tête du contenu, comme avant. Id, structure et câblage inchangés. -->
      <div class="section-header-row">
        <div class="section-title" style="margin-top:0;">🧩 Sous-parties (${parts.length})</div>
        <span id="project-status-info"></span>
      </div>
      <div class="card" id="detail-parts" style="margin-bottom:8px;"></div>
      <div style="display:flex;gap:8px;margin-bottom:16px;">
        <input id="new-part-label" type="text" placeholder="Ex. Traduction" style="flex:1;border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:var(--space-3);" />
        <button id="add-part-btn" type="button" class="btn btn-secondary btn-sm">+ Sous-partie</button>
      </div>

      <div class="section-header-row">
        <div class="section-title" style="margin-top:0;">Tâches (${progress.total})</div>
        <button type="button" id="add-task-inline" class="btn btn-ghost btn-sm">+ Ajouter</button>
      </div>
      <div class="card" id="detail-tasks" style="margin-bottom:16px;"></div>
      <div class="section-header-row">
        <div class="section-title">👀 Suivis (${linkedFollowUps.length})</div>
        <button type="button" id="add-followup-inline" class="btn btn-ghost btn-sm">+ Ajouter</button>
      </div>
      <div class="card" id="detail-followups" style="margin-bottom:16px;"></div>
      <div class="section-header-row">
        <div class="section-title">🗓️ Réunions (${linkedMeetings.length})</div>
        <button type="button" id="add-meeting-inline" class="btn btn-ghost btn-sm">+ Ajouter</button>
      </div>
      <div class="card" id="detail-meetings" style="margin-bottom:16px;"></div>
      <div class="section-header-row">
        <div class="section-title">🗳️ Décisions (${linkedDecisions.length})</div>
        <button type="button" id="add-decision-inline" class="btn btn-ghost btn-sm">+ Ajouter</button>
      </div>
      <div class="card" id="detail-decisions" style="margin-bottom:16px;"></div>
    </div>

    <div class="fiche-tabpanel" data-tabpanel="activity" hidden>
      <details class="fiche-section">
        <summary class="section-title" style="cursor:pointer;margin-top:0;">📎 Ressources (${linkedResources.length})</summary>
        <div class="card" id="detail-resources" style="margin-top:8px;margin-bottom:8px;"></div>
        <div style="display:flex;gap:8px;margin-bottom:16px;">
          <button id="link-resource-btn" class="btn btn-secondary btn-sm">🔗 Lier existante</button>
          <button id="new-resource-btn-inline" class="btn btn-secondary btn-sm">+ Nouvelle ressource</button>
        </div>
      </details>
      <details class="fiche-section">
        <summary class="section-title" style="cursor:pointer;">🕒 Historique (${projectHistory.length})</summary>
        <div class="card" id="detail-history" style="margin-top:8px;margin-bottom:16px;"></div>
      </details>
      <div class="section-title">🔗 Lié</div>
      <div class="card" id="detail-links" style="margin-bottom:8px;"></div>
      <div style="display:flex;gap:8px;margin-bottom:16px;">
        <button id="link-existing-btn" class="btn btn-secondary btn-sm">🔗 Lier une fiche</button>
        <button id="create-linked-btn" class="btn btn-secondary btn-sm">+ Créer et lier</button>
      </div>
    </div>
  `;

  // Bascule d'onglet — même mécanique que la fiche Tâche (voir js/views/kanban.js#openTaskDetail) :
  // chaque panneau existe en permanence, seul l'attribut `hidden` change.
  body.querySelectorAll(".fiche-tabs .chip").forEach((tabBtn) => {
    tabBtn.addEventListener("click", () => {
      body.querySelectorAll(".fiche-tabs .chip").forEach((b) => b.classList.toggle("active", b === tabBtn));
      body.querySelectorAll(".fiche-tabpanel").forEach((panel) => {
        panel.hidden = panel.dataset.tabpanel !== tabBtn.dataset.tab;
      });
    });
  });

  renderInfoTip(body.querySelector("#project-status-info"), PROJECT_STATUS_INFO_HTML);
  // Raccourci clavier personnalisé (retour de Charles-Henri, vague 20) — voir
  // js/services/shortcuts.js#renderShortcutAssignButton.
  renderShortcutAssignButton(body.querySelector("#project-shortcut"), { type: "Project", id: project.id, label: project.name });

  // "+ Ajouter" par bloc (retour de Charles-Henri : pouvoir créer directement depuis la
  // fiche projet, pour chaque type, sans passer par le fil conducteur générique) — réutilise
  // les mêmes modales de création que partout ailleurs, préremplies avec ce projet.
  // Va rechercher les tâches à jour plutôt que de réutiliser le tableau `tasks` reçu en
  // paramètre (un instantané figé au moment de l'ouverture) : sinon une tâche tout juste
  // créée depuis ce même "+ Ajouter" n'apparaîtrait pas en rouvrant la fiche.
  const reopenProject = async () => {
    const freshTasks = (await tasksApi.listAll()).filter((t) => t.projectId === project.id);
    openProjectDetail(project, freshTasks);
  };

  const tasksEl = body.querySelector("#detail-tasks");
  if (!tasks.length) {
    tasksEl.innerHTML = `<div class="empty-state" style="padding:16px;">Aucune tâche liée pour l'instant.</div>`;
  } else {
    for (const task of tasks) {
      const row = document.createElement("div");
      row.className = "item-row";
      row.style.cursor = "pointer";
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">${escapeHtml(task.title)}</div>
        </div>
        <span class="badge badge-${task.status}">${tasksApi.STATUS_LABELS[task.status]}</span>
      `;
      // Retour de Charles-Henri : pouvoir cliquer sur un sous-élément pour "aller dedans" —
      // `onClose` ramène ici (fiche projet) plutôt que de révéler l'écran du dessous une fois
      // la fiche tâche fermée, puisqu'on est arrivé sur cette tâche depuis une autre modale.
      row.addEventListener("click", () => {
        closeModal();
        openTaskDetail(task, allProjects, { onClose: reopenProject });
      });
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
      row.style.cursor = "pointer";
      const person = peopleById.get(f.personId);
      // Nom du collaborateur affiché en premier (voir peopleById plus haut) : un projet
      // transverse a souvent des Suivis pour plusieurs personnes différentes, sans lui le
      // titre seul ne dit pas à qui ce Suivi est attribué.
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">${person ? escapeHtml(person.name) + " — " : ""}${escapeHtml(f.title)}</div>
          <div class="item-meta">${f.controlDate ? "Contrôle : " + formatDate(f.controlDate) : "Pas de date de contrôle"}</div>
        </div>
        <span class="badge badge-${f.status}">${followUpsApi.STATUS_LABELS[f.status]}</span>
      `;
      row.addEventListener("click", () => {
        closeModal();
        openEditFollowUpModal(f, { onDone: reopenProject });
      });
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
      row.style.cursor = "pointer";
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">${escapeHtml(m.title)}</div>
          <div class="item-meta">${m.date ? formatDate(m.date) : "Pas de date"}${m.objective ? " · " + escapeHtml(m.objective) : ""}</div>
        </div>
      `;
      row.addEventListener("click", () => {
        closeModal();
        openRecentDetail({ kind: "meeting", emoji: "🗓️", data: m }, allProjects, { onClose: reopenProject });
      });
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
      row.style.cursor = "pointer";
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">${escapeHtml(d.title)}</div>
          <div class="item-meta">${escapeHtml(d.decision)}</div>
        </div>
      `;
      row.addEventListener("click", () => {
        closeModal();
        openRecentDetail({ kind: "decision", emoji: "🗳️", data: d }, allProjects, { onClose: reopenProject });
      });
      decisionsEl.appendChild(row);
    }
  }

  const resourcesEl = body.querySelector("#detail-resources");
  renderResourceList(resourcesEl, linkedResources, {
    onUnlink: (r) => resourcesApi.linkToProject(r.id, project.id, false),
  });

  renderHistoryTimeline(body.querySelector("#detail-history"), projectHistory);

  renderNotesBlock(body.querySelector("#detail-notes"), project.notesLog || [], {
    onAdd: async (text) => {
      const updated = await projectsApi.addNote(project.id, text);
      project.notesLog = updated;
      return updated;
    },
  });

  renderCanevas(body.querySelector("#detail-canevas"), project.steps, async (stepKey, done) => {
    await projectsApi.toggleStep(project.id, stepKey, done);
    // Suggestion de prochaine étape (§ 31/08/2026, retour de Charles-Henri : mieux se souvenir
    // des enchaînements) — même principe que le canevas Réunion (voir dashboard.js).
    if (stepKey === "actions" && done) {
      suggestNextStep({
        title: "Créer une action ?",
        message: `Tu viens de cocher « Actions » sur « ${project.name} ». Créer une Tâche liée tout de suite ?`,
        acceptLabel: "+ Créer la tâche",
        onAccept: () => {
          closeModal();
          openCreateTaskModal({ projectId: project.id, onCreated: reopenProject, onCancel: reopenProject });
        },
        onDecline: reopenProject,
      });
    }
  });

  // Sous-parties (§ retour de Charles-Henri) : avancement d'un bloc de l'équipe sans passer
  // par une Tâche — un clic cycle le statut ⚪ → 🔵 → 🟢 → ⚪.
  const partsEl = body.querySelector("#detail-parts");
  function renderParts() {
    const currentParts = project.parts || [];
    if (!currentParts.length) {
      partsEl.innerHTML = `<div class="empty-state" style="padding:16px;">Aucune sous-partie pour l'instant.</div>`;
      return;
    }
    partsEl.innerHTML = "";
    for (const part of currentParts) {
      const partNotes = part.notesLog || [];
      const lastNote = partNotes.length ? [...partNotes].sort((a, b) => b.createdAt - a.createdAt)[0] : null;
      const row = document.createElement("div");
      row.className = "item-row";
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">${escapeHtml(part.label)}</div>
          ${lastNote ? `<div class="item-meta">🗒️ ${escapeHtml(lastNote.text)} · ${formatDateTime(lastNote.createdAt)}</div>` : ""}
        </div>
      `;
      const noteBtn = document.createElement("button");
      noteBtn.type = "button";
      noteBtn.className = "btn btn-ghost btn-sm";
      noteBtn.textContent = partNotes.length ? `🗒️ Notes (${partNotes.length})` : "🗒️ Note";
      noteBtn.addEventListener("click", () => {
        closeModal();
        openPartNotesModal(project, part, reopenProject);
      });
      row.appendChild(noteBtn);
      const cycleBtn = document.createElement("button");
      cycleBtn.type = "button";
      cycleBtn.className = "btn btn-secondary btn-sm";
      cycleBtn.textContent = `${projectsApi.PART_STATUS_ICONS[part.status]} ${projectsApi.PART_STATUS_LABELS[part.status]}`;
      cycleBtn.addEventListener("click", async () => {
        const idx = projectsApi.PART_STATUSES.indexOf(part.status);
        const nextStatus = projectsApi.PART_STATUSES[(idx + 1) % projectsApi.PART_STATUSES.length];
        await projectsApi.updatePartStatus(project.id, part.id, nextStatus);
        part.status = nextStatus;
        renderParts();
      });
      row.appendChild(cycleBtn);
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn btn-ghost btn-sm";
      removeBtn.textContent = "Retirer";
      removeBtn.addEventListener("click", async () => {
        await projectsApi.removePart(project.id, part.id);
        project.parts = (project.parts || []).filter((p) => p.id !== part.id);
        renderParts();
      });
      row.appendChild(removeBtn);
      partsEl.appendChild(row);
    }
  }
  renderParts();
  body.querySelector("#add-part-btn").addEventListener("click", async () => {
    const input = body.querySelector("#new-part-label");
    const label = input.value.trim();
    if (!label) return;
    const updated = await projectsApi.addPart(project.id, label);
    project.parts = updated.parts;
    input.value = "";
    renderParts();
  });

  body.querySelector("#add-task-inline").addEventListener("click", () => {
    closeModal();
    openCreateTaskModal({ projectId: project.id, onCreated: reopenProject, onCancel: reopenProject });
  });
  body.querySelector("#add-followup-inline").addEventListener("click", () => {
    closeModal();
    openCreateFollowUpModal({ projectId: project.id, onCreated: reopenProject, onCancel: reopenProject });
  });
  body.querySelector("#add-meeting-inline").addEventListener("click", () => {
    closeModal();
    openCreateMeetingModal({ projectId: project.id, onCreated: reopenProject, onCancel: reopenProject });
  });
  body.querySelector("#add-decision-inline").addEventListener("click", () => {
    closeModal();
    openCreateDecisionModal({ projectId: project.id, onCreated: reopenProject, onCancel: reopenProject });
  });

  const linkRef = { type: "Project", id: project.id };
  linkedItemsApi.renderLinkedSection(body.querySelector("#detail-links"), linkRef);
  body.querySelector("#link-existing-btn").addEventListener("click", () => {
    closeModal();
    linkedItemsApi.openLinkPickerModal(linkRef, project.name, {
      onLinked: () => openProjectDetail(project, tasks),
      onCancel: () => openProjectDetail(project, tasks),
    });
  });
  body.querySelector("#create-linked-btn").addEventListener("click", () => {
    closeModal();
    linkedItemsApi.openCreateAndLinkModal(linkRef, project.name, {
      onLinked: () => openProjectDetail(project, tasks),
      onCancel: () => openProjectDetail(project, tasks),
    });
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
    title: project.name + (isArchived ? " 🗄️" : ""),
    body,
    actions: [
      { icon: "✕", label: "Fermer", variant: "ghost", compact: true },
      {
        // Lien de partage (retour de Charles-Henri, vague 23) — voir js/components/copyLink.js.
        icon: "🔗",
        label: "Copier le lien",
        variant: "secondary",
        compact: true,
        closesModal: false,
        onClick: () => copyEntityLink("#/projects", "Project", project.id),
      },
      isArchived
        ? {
            icon: "↩️",
            label: "Rouvrir le projet",
            variant: "secondary",
            compact: true,
            closesModal: false,
            onClick: async () => {
              await projectsApi.reopenProject(project.id);
              close();
              showToast("Projet rouvert");
            },
          }
        : {
            icon: "🗄️",
            label: "Clôturer le projet",
            variant: "secondary",
            compact: true,
            closesModal: false,
            onClick: () => {
              closeModal();
              // Pas une suppression (Règle 3 : rien n'est jamais perdu) — juste une bascule
              // réversible, mais avec la même mise en garde qu'une confirmDelete (via un
              // openModal dédié plutôt que confirmDelete() elle-même, dont le bouton de
              // confirmation dit toujours "Supprimer" — inexact ici) puisque l'effet
              // (disparition du projet ET de tout ce qui lui est lié des outils de pilotage)
              // est large et pas forcément évident au premier abord.
              const confirmBody = document.createElement("div");
              confirmBody.textContent = `« ${project.name} » et tout ce qui lui est rattaché (tâches, suivis, réunions, décisions, ressources) disparaîtront des outils de pilotage (Accueil, Pilotage, Calendrier, Revue hebdomadaire). Rien n'est supprimé : tu retrouveras tout via le filtre « 🗄️ Fermés » de cet onglet, et pourras rouvrir le projet à tout moment.`;
              openModal({
                title: "Fermer ce projet ?",
                body: confirmBody,
                actions: [
                  { label: "Annuler", variant: "ghost", onClick: () => openProjectDetail(project, tasks) },
                  {
                    label: "🗄️ Fermer le projet",
                    variant: "danger",
                    onClick: async () => {
                      await projectsApi.closeProject(project.id);
                      showToast("Projet fermé");
                    },
                  },
                ],
              });
            },
          },
      {
        icon: "🗑️",
        label: "Supprimer",
        variant: "danger",
        compact: true,
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
        icon: "💾",
        label: "Enregistrer",
        variant: "primary",
        compact: true,
        closesModal: false,
        onClick: async () => {
          const name = bodyEl.querySelector("#detail-name").value.trim();
          if (!name) return;
          const category = bodyEl.querySelector("#detail-category").value.trim();
          if (category) await preferencesApi.registerCategory(category);
          await projectsApi.updateProject(project.id, {
            name,
            category: category || null,
            objective: bodyEl.querySelector("#detail-objective").value.trim(),
            successCriteria: bodyEl.querySelector("#detail-criteria").value.trim(),
            critical: bodyEl.querySelector("#detail-critical").checked,
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

function formatDateTime(ts) {
  return new Date(ts).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * Notes d'une sous-partie (retour de Charles-Henri, 01/09/2026) : la fiche projet n'affiche
 * que la dernière (voir renderParts ci-dessus) — l'historique complet s'ouvre ici, à la
 * demande, dans une petite modale dédiée plutôt que d'alourdir la ligne de la sous-partie en
 * permanence. `onDone` rouvre la fiche projet (une seule modale à la fois, voir modal.js).
 */
function openPartNotesModal(project, part, onDone) {
  const body = document.createElement("div");
  body.innerHTML = `<div id="part-notes"></div>`;
  renderNotesBlock(body.querySelector("#part-notes"), part.notesLog || [], {
    onAdd: async (text) => {
      const updated = await projectsApi.addPartNote(project.id, part.id, text);
      part.notesLog = updated;
      return updated;
    },
  });
  openModal({
    title: `🗒️ Notes — ${part.label}`,
    body,
    actions: [{ label: "Fermer", variant: "ghost", onClick: () => onDone?.() }],
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}
