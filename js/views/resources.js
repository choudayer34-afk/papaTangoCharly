// Vue Ressources — bibliothèque (§43) : Récentes / Par type / Non classées, recherche
// texte simple sur titre/description/tags (avant-goût de la recherche globale §45).

import * as resourcesApi from "../domain/resources.js";
import * as projectsApi from "../domain/projects.js";
import * as tasksApi from "../domain/tasks.js";
import * as historyApi from "../domain/history.js";
import * as preferencesApi from "../domain/preferences.js";
import { openModal, closeModal, confirmDelete } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { renderHistoryTimeline } from "../components/historyTimeline.js";
import * as linkedItemsApi from "../components/linkedItems.js";
import { renderNotesBlock } from "../components/notesBlock.js";

const FILTERS = [
  { key: "recent", label: "Récentes" },
  { key: "type", label: "Par type" },
  { key: "unclassified", label: "Non classées" },
];

export function renderResources(container) {
  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Ressources</h1>
        <div class="subtitle" id="resources-subtitle">—</div>
      </div>
      <button id="new-resource-btn" class="btn btn-primary btn-sm">+ Ressource</button>
    </div>
    <div class="view">
      <div class="field">
        <input id="resources-search" type="text" placeholder="Rechercher (titre, description, tag)..." />
      </div>
      <div class="chip-row" id="resources-filters"></div>
      <div id="resources-list"></div>
    </div>
  `;

  const listEl = container.querySelector("#resources-list");
  const subtitleEl = container.querySelector("#resources-subtitle");
  const filtersEl = container.querySelector("#resources-filters");
  const searchEl = container.querySelector("#resources-search");
  container.querySelector("#new-resource-btn").addEventListener("click", openCreateResourceModal);

  let resources = [];
  let projects = [];
  let tasks = [];
  let activeFilter = "recent";
  let query = "";

  filtersEl.innerHTML = FILTERS.map((f) => `<button class="chip" data-filter="${f.key}">${f.label}</button>`).join("");
  filtersEl.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      activeFilter = chip.dataset.filter;
      render();
    });
  });
  searchEl.addEventListener("input", () => {
    query = searchEl.value.trim().toLowerCase();
    render();
  });

  function matchesQuery(r) {
    if (!query) return true;
    const haystack = [r.title, r.description, r.url, ...(r.tags || [])].join(" ").toLowerCase();
    return haystack.includes(query);
  }

  function render() {
    filtersEl.querySelectorAll(".chip").forEach((chip) => chip.classList.toggle("active", chip.dataset.filter === activeFilter));
    subtitleEl.textContent = resources.length ? `${resources.length} ressource(s)` : "Aucune ressource";

    const filtered = resources.filter(matchesQuery);

    if (!filtered.length) {
      listEl.innerHTML = `
        <div class="empty-state">
          <span class="emoji">📎</span>
          ${resources.length ? "Rien ne correspond à ta recherche." : "Pas encore de ressource. Ajoute un lien Figma, Excel, SharePoint..."}
        </div>`;
      return;
    }

    listEl.innerHTML = "";

    if (activeFilter === "type") {
      const byType = new Map();
      for (const r of filtered) {
        if (!byType.has(r.type)) byType.set(r.type, []);
        byType.get(r.type).push(r);
      }
      for (const [type, items] of byType) {
        const info = resourcesApi.typeInfo(type);
        const header = document.createElement("div");
        header.className = "section-title";
        header.textContent = `${info.emoji} ${info.label} (${items.length})`;
        listEl.appendChild(header);
        listEl.appendChild(buildList(items));
      }
      return;
    }

    let items = filtered;
    if (activeFilter === "unclassified") items = filtered.filter(resourcesApi.isUnclassified);
    if (activeFilter === "recent") {
      items = [...items].sort((a, b) => (b.lastUsedAt || b.createdAt) - (a.lastUsedAt || a.createdAt));
    }
    if (!items.length) {
      listEl.innerHTML = `<div class="empty-state"><span class="emoji">🎉</span>Rien à classer ici.</div>`;
      return;
    }
    listEl.appendChild(buildList(items));
  }

  function buildList(items) {
    const card = document.createElement("div");
    card.className = "card";
    card.style.marginBottom = "12px";
    for (const r of items) {
      const info = resourcesApi.typeInfo(r.type);
      const row = document.createElement("div");
      row.className = "item-row";
      row.style.cursor = "pointer";
      const linkCount = (r.projectIds?.length || 0) + (r.taskIds?.length || 0);
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">${info.emoji} ${escapeHtml(r.title)}</div>
          <div class="item-meta">${linkCount ? `${linkCount} rattachement(s)` : "Non classée"}</div>
        </div>
      `;
      row.addEventListener("click", () => openResourceDetail(r, projects, tasks));
      card.appendChild(row);
    }
    return card;
  }

  const unsubResources = resourcesApi.subscribe((items) => {
    resources = items;
    render();
  });
  const unsubProjects = projectsApi.subscribe((items) => {
    projects = items;
  });
  const unsubTasks = tasksApi.subscribe((items) => {
    tasks = items;
  });

  return function cleanup() {
    unsubResources();
    unsubProjects();
    unsubTasks();
  };
}

function openCreateResourceModal(prefill = {}) {
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="res-url">Lien (optionnel)</label>
      <input id="res-url" type="url" placeholder="https://..." value="${escapeAttr(prefill.url || "")}" />
    </div>
    <div class="field">
      <label for="res-type">Type détecté</label>
      <select id="res-type">
        ${resourcesApi.TYPES.map((t) => `<option value="${t.key}">${t.emoji} ${t.label}</option>`).join("")}
      </select>
    </div>
    <div class="field">
      <label for="res-title">Titre</label>
      <input id="res-title" type="text" placeholder="Ex. Figma SMAGazine" value="${escapeAttr(prefill.title || "")}" />
    </div>
    <div class="field">
      <label for="res-description">Description (optionnel)</label>
      <textarea id="res-description"></textarea>
    </div>
  `;
  const urlInput = body.querySelector("#res-url");
  const typeSelect = body.querySelector("#res-type");
  urlInput.addEventListener("input", () => {
    typeSelect.value = resourcesApi.detectType(urlInput.value);
  });

  const { bodyEl, close } = openModal({
    title: "Nouvelle ressource",
    body,
    actions: [
      { label: "Annuler", variant: "ghost", onClick: () => prefill.onCancel?.() },
      {
        label: "Créer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          const title = bodyEl.querySelector("#res-title").value.trim();
          if (!title) return;
          const resource = await resourcesApi.createResource({
            title,
            url: bodyEl.querySelector("#res-url").value.trim(),
            type: bodyEl.querySelector("#res-type").value,
            description: bodyEl.querySelector("#res-description").value.trim(),
            projectIds: prefill.projectId ? [prefill.projectId] : [],
            taskIds: prefill.taskId ? [prefill.taskId] : [],
          });
          close();
          showToast("Ressource ajoutée");
          prefill.onCreated?.(resource);
        },
      },
    ],
  });
}

export async function openResourceDetail(resource, projects, tasks) {
  preferencesApi.recordRecentlyViewed("Resource", resource.id).catch(() => {});
  const allHistory = await historyApi.listAll();
  const resourceHistory = allHistory
    .filter((h) => h.entityType === "Resource" && h.entityId === resource.id)
    .sort((a, b) => a.date - b.date);

  const body = document.createElement("div");
  body.innerHTML = `
    ${resource.url ? `<a id="res-open-link" href="${escapeAttr(resource.url)}" target="_blank" rel="noopener" class="btn btn-secondary btn-block" style="margin-bottom:16px;">🔗 Ouvrir le lien</a>` : ""}
    <div class="field">
      <label for="res-detail-title">Titre</label>
      <input id="res-detail-title" type="text" value="${escapeAttr(resource.title)}" />
    </div>
    <div class="field">
      <label for="res-detail-type">Type</label>
      <select id="res-detail-type">
        ${resourcesApi.TYPES.map((t) => `<option value="${t.key}" ${t.key === resource.type ? "selected" : ""}>${t.emoji} ${t.label}</option>`).join("")}
      </select>
    </div>
    <div class="field">
      <label for="res-detail-url">Lien</label>
      <input id="res-detail-url" type="url" placeholder="https://..." value="${escapeAttr(resource.url || "")}" />
    </div>
    <div class="field">
      <label for="res-detail-description">Description</label>
      <textarea id="res-detail-description">${escapeHtml(resource.description || "")}</textarea>
    </div>
    <div class="section-title" style="margin-top:0;">📦 Projets liés</div>
    <div id="res-projects-links"></div>
    <div class="section-title">✅ Tâches liées</div>
    <div id="res-tasks-links"></div>
    <div class="section-title">🗒️ Notes</div>
    <div id="detail-notes" style="margin-bottom:16px;"></div>
    <details ${resourceHistory.length > 6 ? "" : "open"}>
      <summary class="section-title" style="cursor:pointer;">🕒 Historique (${resourceHistory.length})</summary>
      <div class="card" id="res-history" style="margin-top:8px;margin-bottom:16px;"></div>
    </details>
    <div class="section-title">🔗 Lié</div>
    <div class="card" id="detail-links" style="margin-bottom:8px;"></div>
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <button id="link-existing-btn" class="btn btn-secondary btn-sm">🔗 Lier une fiche</button>
      <button id="create-linked-btn" class="btn btn-secondary btn-sm">+ Créer et lier</button>
    </div>
  `;

  body.querySelector("#res-open-link")?.addEventListener("click", () => resourcesApi.touchLastUsed(resource.id));
  renderHistoryTimeline(body.querySelector("#res-history"), resourceHistory);
  renderNotesBlock(body.querySelector("#detail-notes"), resource.notesLog || [], {
    onAdd: async (text) => {
      const updated = await resourcesApi.addNote(resource.id, text);
      resource.notesLog = updated;
      return updated;
    },
  });

  const linkRef = { type: "Resource", id: resource.id };
  linkedItemsApi.renderLinkedSection(body.querySelector("#detail-links"), linkRef);
  body.querySelector("#link-existing-btn").addEventListener("click", () => {
    closeModal();
    linkedItemsApi.openLinkPickerModal(linkRef, resource.title, {
      onLinked: () => openResourceDetail(resource, projects, tasks),
      onCancel: () => openResourceDetail(resource, projects, tasks),
    });
  });
  body.querySelector("#create-linked-btn").addEventListener("click", () => {
    closeModal();
    linkedItemsApi.openCreateAndLinkModal(linkRef, resource.title, {
      onLinked: () => openResourceDetail(resource, projects, tasks),
      onCancel: () => openResourceDetail(resource, projects, tasks),
    });
  });

  renderLinkPicker(
    body.querySelector("#res-projects-links"),
    projects,
    resource.projectIds || [],
    (projectId, shouldLink) => resourcesApi.linkToProject(resource.id, projectId, shouldLink)
  );
  renderLinkPicker(
    body.querySelector("#res-tasks-links"),
    tasks,
    resource.taskIds || [],
    (taskId, shouldLink) => resourcesApi.linkToTask(resource.id, taskId, shouldLink)
  );

  const { bodyEl, close } = openModal({
    title: resourcesApi.typeInfo(resource.type).emoji + " " + resource.title,
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
            title: "Supprimer cette ressource ?",
            message: `« ${resource.title} » sera définitivement supprimée. Les projets et tâches qui y étaient liés perdent simplement le lien.`,
            onConfirm: async () => {
              await resourcesApi.removeResource(resource.id);
              showToast("Ressource supprimée");
            },
            onCancel: () => openResourceDetail(resource, projects, tasks),
          });
        },
      },
      {
        label: "Enregistrer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          const title = bodyEl.querySelector("#res-detail-title").value.trim();
          if (!title) return;
          await resourcesApi.updateResource(resource.id, {
            title,
            type: bodyEl.querySelector("#res-detail-type").value,
            url: bodyEl.querySelector("#res-detail-url").value.trim(),
            description: bodyEl.querySelector("#res-detail-description").value.trim(),
          });
          close();
          showToast("Ressource mise à jour");
        },
      },
    ],
  });
}

/**
 * Liste compacte de ressources déjà liées, avec un bouton "Délier" optionnel — utilisée
 * depuis la fiche projet et la fiche tâche pour afficher §41 sans dupliquer la ressource.
 *
 * Retour de Charles-Henri : pas besoin de voir l'URL complète ici, juste pouvoir cliquer sur
 * le titre pour ouvrir la ressource et un bouton pour copier le lien si besoin (ex. le coller
 * ailleurs) — l'URL brute n'apporte rien à l'affichage une fois qu'on peut faire les deux.
 */
export function renderResourceList(container, resources, { onUnlink } = {}) {
  if (!resources.length) {
    container.innerHTML = `<div class="empty-state" style="padding:16px;">Aucune ressource liée.</div>`;
    return;
  }
  container.innerHTML = "";
  for (const r of resources) {
    const info = resourcesApi.typeInfo(r.type);
    const row = document.createElement("div");
    row.className = "item-row";
    const main = document.createElement("div");
    main.className = "item-main";
    main.innerHTML = r.url
      ? `<a href="${escapeAttr(r.url)}" target="_blank" rel="noopener" class="item-title" style="text-decoration:none;">${info.emoji} ${escapeHtml(r.title)}</a>`
      : `<div class="item-title">${info.emoji} ${escapeHtml(r.title)}</div>`;
    row.appendChild(main);
    if (r.url) {
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "btn btn-ghost btn-sm";
      copyBtn.textContent = "📋 Copier";
      copyBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          await navigator.clipboard.writeText(r.url);
          showToast("Lien copié");
        } catch {
          showToast("Impossible de copier le lien");
        }
      });
      row.appendChild(copyBtn);
    }
    if (onUnlink) {
      const btn = document.createElement("button");
      btn.className = "btn btn-ghost btn-sm";
      btn.textContent = "Délier";
      btn.addEventListener("click", async () => {
        await onUnlink(r);
        row.remove();
      });
      row.appendChild(btn);
    }
    container.appendChild(row);
  }
}

/**
 * Petite modale de sélection pour lier une ressource déjà existante (Règle 8 : jamais de
 * duplication) — recherche texte + filtre par type (retour de Charles-Henri : utile dès que
 * la bibliothèque de ressources grandit).
 */
export function openResourcePickerModal(candidates, onPick, onCancel) {
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <input id="res-picker-search" type="text" placeholder="Rechercher par titre..." />
    </div>
    <div class="chip-row" id="res-picker-types" style="flex-wrap:wrap;"></div>
    <div class="card" id="res-picker-list"></div>
  `;
  const searchEl = body.querySelector("#res-picker-search");
  const typesEl = body.querySelector("#res-picker-types");
  const listEl = body.querySelector("#res-picker-list");

  const availableTypes = [...new Set(candidates.map((r) => r.type))];
  let activeType = "all";
  let query = "";

  typesEl.innerHTML = [`<button type="button" class="chip active" data-type="all">Tous</button>`]
    .concat(availableTypes.map((t) => `<button type="button" class="chip" data-type="${t}">${resourcesApi.typeInfo(t).emoji} ${resourcesApi.typeInfo(t).label}</button>`))
    .join("");

  function renderList() {
    const filtered = candidates.filter((r) => {
      if (activeType !== "all" && r.type !== activeType) return false;
      if (query && !r.title.toLowerCase().includes(query)) return false;
      return true;
    });
    if (!filtered.length) {
      listEl.innerHTML = `<div class="empty-state" style="padding:16px;">Rien ne correspond.</div>`;
      return;
    }
    listEl.innerHTML = "";
    for (const r of filtered) {
      const info = resourcesApi.typeInfo(r.type);
      const row = document.createElement("div");
      row.className = "item-row";
      row.style.cursor = "pointer";
      row.innerHTML = `<div class="item-main"><div class="item-title">${info.emoji} ${escapeHtml(r.title)}</div></div>`;
      row.addEventListener("click", async () => {
        await onPick(r);
        close();
      });
      listEl.appendChild(row);
    }
  }

  searchEl.addEventListener("input", () => {
    query = searchEl.value.trim().toLowerCase();
    renderList();
  });
  typesEl.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      activeType = chip.dataset.type;
      typesEl.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === chip));
      renderList();
    });
  });

  renderList();

  const { close } = openModal({
    title: "Lier une ressource",
    body,
    actions: [{ label: "Annuler", variant: "ghost", onClick: () => onCancel?.() }],
  });
}

function renderLinkPicker(container, items, linkedIds, onToggle) {
  if (!items.length) {
    container.innerHTML = `<div class="empty-state" style="padding:8px 0;">Rien à lier pour l'instant.</div>`;
    return;
  }
  const wrap = document.createElement("div");
  wrap.className = "chip-row";
  wrap.style.flexWrap = "wrap";
  for (const item of items) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip" + (linkedIds.includes(item.id) ? " active" : "");
    chip.textContent = item.name || item.title;
    chip.addEventListener("click", async () => {
      const nowLinked = !chip.classList.contains("active");
      await onToggle(item.id, nowLinked);
      chip.classList.toggle("active", nowLinked);
    });
    wrap.appendChild(chip);
  }
  container.appendChild(wrap);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

export { openCreateResourceModal };
