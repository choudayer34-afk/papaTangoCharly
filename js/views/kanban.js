// Kanban — vue principale de pilotage opérationnel (§24, §25). Drag & drop obligatoire ;
// déplacer une carte change son statut, rien de plus.

import * as tasksApi from "../domain/tasks.js";
import * as projectsApi from "../domain/projects.js";
import * as resourcesApi from "../domain/resources.js";
import * as historyApi from "../domain/history.js";
import { openModal, closeModal, confirmDelete } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { openCreateResourceModal, renderResourceList, openResourcePickerModal } from "./resources.js";
import { renderHistoryTimeline } from "../components/historyTimeline.js";
import * as linkedItemsApi from "../components/linkedItems.js";
import { renderCanevas } from "../components/canevas.js";

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
        <select id="kanban-project-filter" class="chip" style="border-radius:var(--radius-sm);"></select>
      </div>
      <div class="kanban-board" id="kanban-board"></div>
    </div>
  `;

  const board = container.querySelector("#kanban-board");
  const filtersEl = container.querySelector("#kanban-filters");
  const projectFilterEl = container.querySelector("#kanban-project-filter");
  let latestTasks = [];
  let latestProjects = [];
  let filterWindow = "all";
  let filterProjectId = "all";

  filtersEl.insertAdjacentHTML(
    "afterbegin",
    DUE_WINDOWS.map((w) => `<button type="button" class="chip${w.key === "all" ? " active" : ""}" data-window="${w.key}">${w.label}</button>`).join("")
  );
  filtersEl.querySelectorAll("[data-window]").forEach((chip) => {
    chip.addEventListener("click", () => {
      filterWindow = chip.dataset.window;
      filtersEl.querySelectorAll("[data-window]").forEach((c) => c.classList.toggle("active", c === chip));
      renderBoard();
    });
  });
  projectFilterEl.addEventListener("change", () => {
    filterProjectId = projectFilterEl.value;
    renderBoard();
  });

  function applyFilters(tasks) {
    let list = tasks;
    if (filterProjectId !== "all") list = list.filter((t) => t.projectId === filterProjectId);
    if (filterWindow === "late") list = list.filter((t) => tasksApi.isLate(t));
    else if (filterWindow === "7" || filterWindow === "15") {
      const horizon = Number(filterWindow);
      list = list.filter((t) => t.dueDate && daysFromToday(t.dueDate) >= 0 && daysFromToday(t.dueDate) <= horizon);
    }
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
        if (taskId) await tasksApi.setStatus(taskId, status);
      });

      board.appendChild(column);
    }
  }

  function renderBoard() {
    render(latestTasks, latestProjects);
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
 * Le glisser-déposer entre colonnes est peu fiable au doigt sur mobile, surtout dès que la
 * cible n'est pas visible sans scroller horizontalement (§ergonomie signalée par
 * Charles-Henri). Les boutons ‹ › offrent un chemin qui ne dépend jamais du scroll ni du
 * drag : changer de statut reste possible même quand une seule colonne tient à l'écran.
 */
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

  card.innerHTML = `
    <div class="kanban-card-title">${task.isBlocked ? "🔴 " : ""}${escapeHtml(task.title)}</div>
    <div class="kanban-card-meta">
      ${project ? `<span>📦 ${escapeHtml(project.name)}</span>` : ""}
      ${task.dueDate ? `<span class="${late ? "badge badge-late" : ""}">📅 ${formatDate(task.dueDate)}</span>` : ""}
    </div>
    <div class="kanban-card-move">
      <button type="button" class="kanban-move-btn" data-dir="prev" aria-label="Statut précédent" ${prevStatus ? "" : "disabled"}>‹</button>
      <span class="kanban-move-label">${tasksApi.STATUS_LABELS[task.status]}</span>
      <button type="button" class="kanban-move-btn" data-dir="next" aria-label="Statut suivant" ${nextStatus ? "" : "disabled"}>›</button>
    </div>
  `;

  card.querySelector('[data-dir="prev"]').addEventListener("click", (e) => {
    e.stopPropagation();
    if (prevStatus) tasksApi.setStatus(task.id, prevStatus);
  });
  card.querySelector('[data-dir="next"]').addEventListener("click", (e) => {
    e.stopPropagation();
    if (nextStatus) tasksApi.setStatus(task.id, nextStatus);
  });

  return card;
}

/**
 * Création autonome d'une tâche, hors du parcours Inbox → qualification — utilisée par le
 * "fil conducteur" (components/linkedItems.js) pour "créer à la volée" une tâche liée à une
 * autre fiche. Même pattern prefill/onCreated/onCancel que openCreateProjectModal et
 * openCreateResourceModal.
 */
export function openCreateTaskModal(prefill = {}) {
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
          const task = await tasksApi.createTask({
            title,
            description: bodyEl.querySelector("#new-task-description").value.trim(),
            dueDate: bodyEl.querySelector("#new-task-due").value || null,
            projectId: prefill.projectId || null,
            type: isCommunication ? "communication" : "action",
          });
          close();
          showToast("Tâche créée");
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
  const [allResources, allHistory] = await Promise.all([resourcesApi.listAll(), historyApi.listAll()]);
  const linkedResources = allResources.filter((r) => (r.taskIds || []).includes(task.id));
  const unlinkedResources = allResources.filter((r) => !(r.taskIds || []).includes(task.id));
  const taskHistory = allHistory
    .filter((h) => h.entityType === "Task" && h.entityId === task.id)
    .sort((a, b) => a.date - b.date);

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
    <div class="section-title">📎 Ressources (${linkedResources.length})</div>
    <div class="card" id="detail-resources" style="margin-bottom:8px;"></div>
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <button id="link-resource-btn" class="btn btn-secondary btn-sm">🔗 Lier existante</button>
      <button id="new-resource-btn-inline" class="btn btn-secondary btn-sm">+ Nouvelle ressource</button>
    </div>
    <div class="section-title">📅 Réunions Outlook associées (${(task.outlookMeetings || []).length})</div>
    <div class="card" id="detail-outlook" style="margin-bottom:8px;"></div>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
      <input id="outlook-title" type="text" placeholder="Titre de la réunion Outlook" style="flex:2;min-width:140px;border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:var(--space-3);" />
      <input id="outlook-date" type="date" style="flex:1;min-width:120px;border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:var(--space-3);" />
      <button id="add-outlook-btn" type="button" class="btn btn-secondary btn-sm">+ Associer</button>
    </div>
    <details ${taskHistory.length > 6 ? "" : "open"}>
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
          await tasksApi.updateTask(task.id, {
            title,
            description: bodyEl.querySelector("#detail-description").value,
            successCriteria: bodyEl.querySelector("#detail-criteria").value,
            dueDate: bodyEl.querySelector("#detail-due").value || null,
            status: bodyEl.querySelector("#detail-status").value,
            projectId: bodyEl.querySelector("#detail-project").value || null,
            isBlocked: bodyEl.querySelector("#detail-blocked").checked,
          });
          close();
          showToast("Tâche mise à jour");
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
