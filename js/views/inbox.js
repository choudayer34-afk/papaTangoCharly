// Vue Inbox — le sas d'entrée (§11, §12, §13).
// Une capture non traitée n'est PAS un retard : pas de badge rouge culpabilisant ici,
// juste un compteur neutre.

import * as inboxApi from "../domain/inbox.js";
import * as projectsApi from "../domain/projects.js";
import { openModal, closeModal } from "../components/modal.js";
import { showToast } from "../components/toast.js";

const QUALIFY_CHOICES = [
  { key: "task", emoji: "✅", label: "Action", implemented: true },
  { key: "follow_up_stub", emoji: "👀", label: "Suivi", implemented: false },
  { key: "project_stub", emoji: "📦", label: "Projet", implemented: false },
  { key: "meeting_stub", emoji: "📅", label: "Réunion", implemented: false },
  { key: "decision_stub", emoji: "🗳️", label: "Décision", implemented: false },
  { key: "kept", emoji: "🧠", label: "Information", implemented: true },
  { key: "resource_stub", emoji: "📎", label: "Ressource", implemented: false },
  { key: "idea_stub", emoji: "💡", label: "Idée", implemented: true, mapsTo: "kept" },
  { key: "archived", emoji: "🗑️", label: "Archiver", implemented: true },
];

export function renderInbox(container) {
  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Inbox</h1>
        <div class="subtitle" id="inbox-subtitle">—</div>
      </div>
    </div>
    <div class="view"><div id="inbox-list"></div></div>
  `;

  const listEl = container.querySelector("#inbox-list");
  const subtitleEl = container.querySelector("#inbox-subtitle");

  function render(items) {
    subtitleEl.textContent = items.length
      ? `${items.length} élément${items.length > 1 ? "s" : ""} à traiter`
      : "Tout est traité";

    if (!items.length) {
      listEl.innerHTML = `
        <div class="empty-state">
          <span class="emoji">📥</span>
          Rien à traiter pour l'instant.
        </div>`;
      return;
    }

    const list = document.createElement("div");
    list.className = "card";
    for (const item of items) {
      const row = document.createElement("div");
      row.className = "item-row";
      row.innerHTML = `
        <div class="item-main">
          <div class="item-raw">${escapeHtml(item.rawContent)}</div>
          <div class="item-meta">${formatDate(item.createdAt)} · ${escapeHtml(item.source)}</div>
        </div>
      `;
      const actions = document.createElement("div");
      const btn = document.createElement("button");
      btn.className = "btn btn-secondary btn-sm";
      btn.textContent = "Traiter";
      btn.addEventListener("click", () => openQualifyModal(item));
      actions.appendChild(btn);
      row.appendChild(actions);
      list.appendChild(row);
    }
    listEl.innerHTML = "";
    listEl.appendChild(list);
  }

  const unsubscribe = inboxApi.subscribePending(render);
  return unsubscribe;
}

function openQualifyModal(item) {
  const body = document.createElement("div");
  const raw = document.createElement("div");
  raw.className = "item-raw card";
  raw.style.marginBottom = "16px";
  raw.textContent = item.rawContent;
  body.appendChild(raw);

  const label = document.createElement("div");
  label.className = "section-title";
  label.style.margin = "0 0 8px";
  label.textContent = "Qu'est-ce que c'est ?";
  body.appendChild(label);

  const grid = document.createElement("div");
  grid.className = "choice-grid";
  for (const choice of QUALIFY_CHOICES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice-btn";
    btn.innerHTML = `<span class="emoji">${choice.emoji}</span> ${choice.label}`;
    btn.addEventListener("click", () => handleChoice(item, choice));
    grid.appendChild(btn);
  }
  body.appendChild(grid);

  openModal({ title: "Traiter", body, actions: [{ label: "Plus tard", variant: "ghost" }] });
}

async function handleChoice(item, choice) {
  if (choice.key === "task") {
    closeModal();
    return openTaskFromInboxModal(item);
  }
  if (!choice.implemented) {
    await inboxApi.qualify(item.id, "kept", { as: choice.label });
    closeModal();
    showToast(`« ${choice.label} » arrive bientôt — gardé en Information pour l'instant`);
    return;
  }
  const outcome = choice.mapsTo || choice.key;
  await inboxApi.qualify(item.id, outcome);
  closeModal();
  showToast(outcome === "archived" ? "Archivé" : "Conservé comme information");
}

async function openTaskFromInboxModal(item) {
  const projects = await projectsApi.listAll();

  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="task-title">Titre</label>
      <input id="task-title" type="text" value="${escapeAttr(item.rawContent.slice(0, 80))}" />
    </div>
    <div class="field">
      <label for="task-due">Pour quand ? (optionnel)</label>
      <input id="task-due" type="date" />
    </div>
    <div class="field">
      <label for="task-project">Projet (optionnel)</label>
      <select id="task-project">
        <option value="">— Aucun —</option>
        ${projects.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("")}
      </select>
    </div>
  `;

  const { bodyEl, close } = openModal({
    title: "Nouvelle action",
    body,
    actions: [
      { label: "Annuler", variant: "ghost" },
      {
        label: "Créer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          const title = bodyEl.querySelector("#task-title").value.trim();
          if (!title) return;
          const dueDate = bodyEl.querySelector("#task-due").value || null;
          const projectId = bodyEl.querySelector("#task-project").value || null;
          await inboxApi.qualify(item.id, "task", { title, dueDate, projectId });
          close();
          showToast("Action créée");
        },
      },
    ],
  });
}

function formatDate(ts) {
  return new Date(ts).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}
