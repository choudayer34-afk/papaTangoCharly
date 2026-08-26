// Recherche globale cross-entités — §45/§52. "Il y a trois mois, on avait décidé quoi sur
// ce sujet ?" ne devrait jamais obliger à naviguer écran par écran pour le retrouver. Un
// seul champ, interroge tout ce qui a un titre/nom/notes, groupé par type, cliquable
// directement vers la fiche existante — jamais une nouvelle vue de détail dupliquée, chaque
// résultat rouvre exactement la même modale que si on l'avait trouvé depuis son propre écran.

import { openModal, closeModal } from "./modal.js";
import * as tasksApi from "../domain/tasks.js";
import * as projectsApi from "../domain/projects.js";
import * as peopleApi from "../domain/people.js";
import * as followUpsApi from "../domain/followups.js";
import * as resourcesApi from "../domain/resources.js";
import * as meetingsApi from "../domain/meetings.js";
import * as decisionsApi from "../domain/decisions.js";
import { openTaskDetail } from "../views/kanban.js";
import { openProjectDetail } from "../views/projects.js";
import { openPersonDetail, openEditFollowUpModal } from "../views/people.js";
import { openResourceDetail } from "../views/resources.js";
import { openRecentDetail } from "../views/dashboard.js";

function haystack(...parts) {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

async function runSearch(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const [tasks, projects, people, followUps, resources, meetings, decisions] = await Promise.all([
    tasksApi.listAll(),
    projectsApi.listAll(),
    peopleApi.listAll(),
    followUpsApi.listAll(),
    resourcesApi.listAll(),
    meetingsApi.listAll(),
    decisionsApi.listAll(),
  ]);

  const results = [];

  for (const t of tasks) {
    if (haystack(t.title, t.description, t.successCriteria).includes(q)) {
      results.push({ type: "Tâche", emoji: "✅", title: t.title, onOpen: () => openTaskDetail(t, projects) });
    }
  }
  for (const p of projects) {
    if (haystack(p.name, p.objective, p.successCriteria).includes(q)) {
      const projectTasks = tasks.filter((t) => t.projectId === p.id);
      results.push({ type: "Projet", emoji: "📦", title: p.name, onOpen: () => openProjectDetail(p, projectTasks) });
    }
  }
  for (const person of people) {
    if (haystack(person.name, person.role, person.notes).includes(q)) {
      results.push({
        type: "Personne",
        emoji: person.type === "manager" ? "👔" : "👤",
        title: person.name,
        onOpen: () => openPersonDetail(person, followUps),
      });
    }
  }
  for (const f of followUps) {
    if (haystack(f.title, f.expectedResult, f.successCriteria).includes(q)) {
      const person = people.find((p) => p.id === f.personId);
      results.push({
        type: "Suivi",
        emoji: "👀",
        title: f.title,
        meta: person ? person.name : "",
        onOpen: () => openEditFollowUpModal(f),
      });
    }
  }
  for (const r of resources) {
    if (haystack(r.title, r.description, r.url, (r.tags || []).join(" ")).includes(q)) {
      results.push({ type: "Ressource", emoji: "📎", title: r.title, onOpen: () => openResourceDetail(r, projects, tasks) });
    }
  }
  for (const m of meetings) {
    if (haystack(m.title, m.objective, m.notes).includes(q)) {
      results.push({
        type: "Réunion",
        emoji: "🗓️",
        title: m.title,
        onOpen: () => openRecentDetail({ kind: "meeting", emoji: "🗓️", data: m }, projects),
      });
    }
  }
  for (const d of decisions) {
    if (haystack(d.title, d.decision, d.context).includes(q)) {
      results.push({
        type: "Décision",
        emoji: "🗳️",
        title: d.title,
        onOpen: () => openRecentDetail({ kind: "decision", emoji: "🗳️", data: d }, projects),
      });
    }
  }

  return results;
}

function openSearchModal() {
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <input id="global-search-input" type="text" placeholder="Rechercher un mot dans tout Pilotage..." />
    </div>
    <div id="global-search-results"></div>
  `;

  const resultsEl = body.querySelector("#global-search-results");
  const inputEl = body.querySelector("#global-search-input");

  function renderResults(results, query) {
    if (!query.trim()) {
      resultsEl.innerHTML = `<div class="empty-state" style="padding:16px;">Tape un mot-clé — titre, nom, notes, tag...</div>`;
      return;
    }
    if (!results.length) {
      resultsEl.innerHTML = `<div class="empty-state" style="padding:16px;">Rien ne correspond à « ${escapeHtml(query)} ».</div>`;
      return;
    }
    resultsEl.innerHTML = "";
    const card = document.createElement("div");
    card.className = "card";
    for (const r of results) {
      const row = document.createElement("div");
      row.className = "item-row";
      row.style.cursor = "pointer";
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">${r.emoji} ${escapeHtml(r.title)}</div>
          <div class="item-meta">${r.type}${r.meta ? " · " + escapeHtml(r.meta) : ""}</div>
        </div>
      `;
      row.addEventListener("click", () => {
        closeModal();
        r.onOpen();
      });
      card.appendChild(row);
    }
    resultsEl.appendChild(card);
  }

  renderResults([], "");

  let debounceTimer = null;
  inputEl.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const query = inputEl.value;
    debounceTimer = setTimeout(async () => {
      const results = await runSearch(query);
      renderResults(results, query);
    }, 150);
  });

  openModal({
    title: "🔎 Rechercher",
    body,
    actions: [{ label: "Fermer", variant: "ghost" }],
  });

  setTimeout(() => inputEl.focus(), 30);
}

export function mountGlobalSearch() {
  if (document.querySelector(".search-fab")) return;
  const btn = document.createElement("button");
  btn.className = "search-fab";
  btn.type = "button";
  btn.setAttribute("aria-label", "Rechercher");
  btn.textContent = "🔎";
  btn.addEventListener("click", openSearchModal);
  document.body.appendChild(btn);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
