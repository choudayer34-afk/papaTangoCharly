// Vue Projets — §36 à §38 : "Où en est Modernisation ?" et la possibilité de descendre
// jusqu'à la tâche précise (§71).

import * as projectsApi from "../domain/projects.js";
import * as tasksApi from "../domain/tasks.js";
import * as resourcesApi from "../domain/resources.js";
import * as followUpsApi from "../domain/followups.js";
import * as meetingsApi from "../domain/meetings.js";
import * as decisionsApi from "../domain/decisions.js";
import * as historyApi from "../domain/history.js";
import * as preferencesApi from "../domain/preferences.js";
import { openModal, closeModal, confirmDelete } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { suggestNextStep } from "../components/suggestNextStep.js";
import { openCreateResourceModal, renderResourceList, openResourcePickerModal } from "./resources.js";
import { renderHistoryTimeline } from "../components/historyTimeline.js";
import * as linkedItemsApi from "../components/linkedItems.js";
import { renderCanevas } from "../components/canevas.js";
import { openCreateTaskModal, openTaskDetail } from "./kanban.js";
import { openCreateFollowUpModal, openEditFollowUpModal } from "./people.js";
import { openCreateMeetingModal, openCreateDecisionModal, openRecentDetail } from "./dashboard.js";

export function renderProjects(container) {
  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Projets</h1>
        <div class="subtitle" id="projects-subtitle">—</div>
      </div>
      <button id="new-project-btn" class="btn btn-primary btn-sm">+ Projet</button>
    </div>
    <div class="view">
      <div class="chip-row" id="sort-toggle">
        <button type="button" class="chip" data-sort="manual">✋ Ordre manuel</button>
        <button type="button" class="chip" data-sort="progress">📊 Avancement</button>
      </div>
      <div class="chip-row" id="category-filters" style="flex-wrap:wrap;"></div>
      <div id="projects-list"></div>
    </div>
  `;

  const listEl = container.querySelector("#projects-list");
  const subtitleEl = container.querySelector("#projects-subtitle");
  const sortToggleEl = container.querySelector("#sort-toggle");
  const categoryFiltersEl = container.querySelector("#category-filters");
  container.querySelector("#new-project-btn").addEventListener("click", () => openCreateProjectModal());

  let projects = [];
  let tasks = [];
  let sortMode = "manual";
  let categories = {};
  let categoryFilter = "all";

  preferencesApi.getPreferences().then((prefs) => {
    sortMode = prefs.projectSort || "manual";
    categories = prefs.categories || {};
    updateSortToggle();
    render();
  });

  function updateSortToggle() {
    sortToggleEl.querySelectorAll("[data-sort]").forEach((chip) => chip.classList.toggle("active", chip.dataset.sort === sortMode));
  }
  sortToggleEl.querySelectorAll("[data-sort]").forEach((chip) => {
    chip.addEventListener("click", async () => {
      sortMode = chip.dataset.sort;
      updateSortToggle();
      await preferencesApi.setProjectSort(sortMode);
      render();
    });
  });

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
        render();
      });
    });

    if (!projects.length) {
      listEl.innerHTML = `
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

    listEl.innerHTML = "";
    for (const project of ordered) {
      const projectTasks = tasksByProject.get(project.id) || [];
      const progress = projectsApi.computeProgress(projectTasks);
      const icon = preferencesApi.categoryIcon(categories, project.category);

      const card = document.createElement("div");
      card.className = "card";
      card.style.marginBottom = "12px";
      card.style.cursor = "pointer";
      card.draggable = sortMode === "manual";
      if (sortMode === "manual") card.style.cursor = "grab";
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:baseline;">
          <div class="item-title">${icon ? icon + " " : ""}${escapeHtml(project.name)}</div>
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
      card.addEventListener("click", (e) => {
        // Un glisser-déposer qui se termine peut déclencher un click parasite — sortMode
        // "manual" est le seul cas où draggable est vrai, donc le seul où ça peut arriver.
        if (card.dataset.justDragged) return;
        openProjectDetail(project, projectTasks);
      });
      card.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/project-id", project.id);
      });
      card.addEventListener("dragover", (e) => {
        if (sortMode !== "manual") return;
        e.preventDefault();
        card.classList.add("drag-over");
      });
      card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
      card.addEventListener("drop", async (e) => {
        if (sortMode !== "manual") return;
        e.preventDefault();
        card.classList.remove("drag-over");
        const draggedId = e.dataTransfer.getData("text/project-id");
        if (!draggedId || draggedId === project.id) return;
        const ids = [...orderedIds];
        const from = ids.indexOf(draggedId);
        const to = ids.indexOf(project.id);
        if (from < 0 || to < 0) return;
        ids.splice(to, 0, ids.splice(from, 1)[0]);
        card.dataset.justDragged = "1";
        await projectsApi.reorderProjects(ids);
        setTimeout(() => delete card.dataset.justDragged, 300);
      });
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
 * que openCreateResourceModal côté Ressources. Asynchrone (retour de Charles-Henri, champ
 * Catégorie) : le champ propose les catégories déjà utilisées via une datalist, il faut donc
 * les charger avant de construire le formulaire.
 */
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
  const progress = projectsApi.computeProgress(tasks);
  const [allProjects, allResources, allFollowUps, allMeetings, allDecisions, allHistory, prefs] = await Promise.all([
    projectsApi.listAll(),
    resourcesApi.listAll(),
    followUpsApi.listAll(),
    meetingsApi.listAll(),
    decisionsApi.listAll(),
    historyApi.listAll(),
    preferencesApi.getPreferences(),
  ]);
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
    <div class="field">
      <label for="detail-objective">Objectif</label>
      <textarea id="detail-objective">${escapeHtml(project.objective || "")}</textarea>
    </div>
    <div class="field">
      <label for="detail-criteria">Critère de réussite</label>
      <textarea id="detail-criteria" placeholder="Comment saurai-je que ce projet est réussi ?">${escapeHtml(project.successCriteria || "")}</textarea>
    </div>
    <div id="detail-canevas"></div>
    <div class="section-header-row">
      <div class="section-title">🧩 Sous-parties (${parts.length})</div>
    </div>
    <div class="card" id="detail-parts" style="margin-bottom:8px;"></div>
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <input id="new-part-label" type="text" placeholder="Ex. Traduction" style="flex:1;border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:var(--space-3);" />
      <button id="add-part-btn" type="button" class="btn btn-secondary btn-sm">+ Sous-partie</button>
    </div>
    <div class="section-header-row">
      <div class="section-title">Tâches (${progress.total})</div>
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
    <div class="section-title">📎 Ressources (${linkedResources.length})</div>
    <div class="card" id="detail-resources" style="margin-bottom:8px;"></div>
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <button id="link-resource-btn" class="btn btn-secondary btn-sm">🔗 Lier existante</button>
      <button id="new-resource-btn-inline" class="btn btn-secondary btn-sm">+ Nouvelle ressource</button>
    </div>
    <details ${projectHistory.length > 6 ? "" : "open"}>
      <summary class="section-title" style="cursor:pointer;">🕒 Historique (${projectHistory.length})</summary>
      <div class="card" id="detail-history" style="margin-top:8px;margin-bottom:16px;"></div>
    </details>
    <div class="section-title">🔗 Lié</div>
    <div class="card" id="detail-links" style="margin-bottom:8px;"></div>
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <button id="link-existing-btn" class="btn btn-secondary btn-sm">🔗 Lier une fiche</button>
      <button id="create-linked-btn" class="btn btn-secondary btn-sm">+ Créer et lier</button>
    </div>
  `;

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
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">${escapeHtml(f.title)}</div>
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
      const row = document.createElement("div");
      row.className = "item-row";
      row.innerHTML = `<div class="item-main"><div class="item-title">${escapeHtml(part.label)}</div></div>`;
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
          const category = bodyEl.querySelector("#detail-category").value.trim();
          if (category) await preferencesApi.registerCategory(category);
          await projectsApi.updateProject(project.id, {
            name,
            category: category || null,
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
