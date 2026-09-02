// Recherche globale cross-entités — §45/§52. "Il y a trois mois, on avait décidé quoi sur
// ce sujet ?" ne devrait jamais obliger à naviguer écran par écran pour le retrouver. Un
// seul champ, interroge tout ce qui a un titre/nom/notes, groupé par type, cliquable
// directement vers la fiche existante — jamais une nouvelle vue de détail dupliquée, chaque
// résultat rouvre exactement la même modale que si on l'avait trouvé depuis son propre écran.
//
// Vague 20 (retour de Charles-Henri) : "la recherche doit rechercher dans tous les éléments
// même les notes ou autre" — le journal de notes horodaté (`notesLog`, présent sur les 8
// types) et les Informations/Idées "gardées" depuis l'Inbox (jusqu'ici absentes de la
// recherche, comme elles l'avaient été du fil conducteur avant la correction du 31/08/2026)
// sont désormais inclus. "je dois voir également le statut" : chaque résultat Tâche/Suivi/
// Projet affiche son statut, seuls types de l'app où ce mot a un sens concret. Et "comment
// cibler plus facilement une recherche" : un bandeau de chips par type (tous actifs par
// défaut, comme aujourd'hui), avec Alt+1…Alt+8 pour les basculer sans la souris — cohérent
// avec le reste des raccourcis de cette vague (js/services/shortcuts.js), mais scopé à cette
// seule modale pour ne jamais entrer en conflit avec Alt+1…8 qui change d'onglet ailleurs.

import { openModal, closeModal } from "./modal.js";
import * as tasksApi from "../domain/tasks.js";
import * as projectsApi from "../domain/projects.js";
import * as peopleApi from "../domain/people.js";
import * as followUpsApi from "../domain/followups.js";
import * as resourcesApi from "../domain/resources.js";
import * as meetingsApi from "../domain/meetings.js";
import * as decisionsApi from "../domain/decisions.js";
import * as inboxApi from "../domain/inbox.js";
import { openTaskDetail } from "../views/kanban.js";
import { openProjectDetail } from "../views/projects.js";
import { openPersonDetail, openEditFollowUpModal } from "../views/people.js";
import { openResourceDetail } from "../views/resources.js";
import { openRecentDetail } from "../views/dashboard.js";
import { openKeptItemDetail } from "../views/inbox.js";

// Ordre = celui des chips affichées et des touches Alt+1…Alt+8 qui leur correspondent.
const SEARCH_TYPES = ["Tâche", "Projet", "Personne", "Suivi", "Ressource", "Réunion", "Décision", "Information/Idée"];

function haystack(...parts) {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

/** Concatène le texte d'un journal de notes horodaté (`notesLog`, présent sur les 8 types) —
 *  un seul point pour ce besoin plutôt que de le refaire à chaque type ci-dessous. */
function notesText(notesLog) {
  return (notesLog || []).map((n) => n.text).join(" ");
}

async function runSearch(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const [tasks, projects, people, followUps, resources, meetings, decisions, keptItems] = await Promise.all([
    tasksApi.listAll(),
    projectsApi.listAll(),
    peopleApi.listAll(),
    followUpsApi.listAll(),
    resourcesApi.listAll(),
    meetingsApi.listAll(),
    decisionsApi.listAll(),
    inboxApi.listKept(),
  ]);

  const results = [];

  for (const t of tasks) {
    const checklistText = (t.checklist || []).map((c) => c.text).join(" ");
    if (haystack(t.title, t.description, t.successCriteria, t.waitingOn, checklistText, notesText(t.notesLog)).includes(q)) {
      results.push({
        type: "Tâche",
        emoji: "✅",
        title: t.title,
        status: `${tasksApi.STATUS_ICONS[t.status] || ""} ${tasksApi.STATUS_LABELS[t.status] || ""}`.trim(),
        onOpen: () => openTaskDetail(t, projects),
      });
    }
  }
  for (const p of projects) {
    const partsText = (p.parts || []).map((part) => `${part.label} ${notesText(part.notesLog)}`).join(" ");
    if (haystack(p.name, p.objective, p.successCriteria, partsText, notesText(p.notesLog)).includes(q)) {
      const projectTasks = tasks.filter((t) => t.projectId === p.id);
      results.push({
        type: "Projet",
        emoji: "📦",
        title: p.name,
        status: projectsApi.isArchived(p) ? "🗄️ Fermé" : "🟢 Actif",
        onOpen: () => openProjectDetail(p, projectTasks),
      });
    }
  }
  for (const person of people) {
    if (haystack(person.name, person.role, notesText(person.notesLog)).includes(q)) {
      results.push({
        type: "Personne",
        emoji: person.type === "manager" ? "👔" : "👤",
        title: person.name,
        onOpen: () => openPersonDetail(person, followUps),
      });
    }
  }
  for (const f of followUps) {
    if (haystack(f.title, f.expectedResult, f.successCriteria, f.notes, notesText(f.notesLog)).includes(q)) {
      const person = people.find((p) => p.id === f.personId);
      results.push({
        type: "Suivi",
        emoji: "👀",
        title: f.title,
        meta: person ? person.name : "",
        status: followUpsApi.STATUS_LABELS[f.status] || "",
        onOpen: () => openEditFollowUpModal(f),
      });
    }
  }
  for (const r of resources) {
    if (haystack(r.title, r.description, r.url, (r.tags || []).join(" "), notesText(r.notesLog)).includes(q)) {
      results.push({ type: "Ressource", emoji: "📎", title: r.title, onOpen: () => openResourceDetail(r, projects, tasks) });
    }
  }
  for (const m of meetings) {
    if (haystack(m.title, m.objective, m.notes, notesText(m.notesLog)).includes(q)) {
      results.push({
        type: "Réunion",
        emoji: "🗓️",
        title: m.title,
        onOpen: () => openRecentDetail({ kind: "meeting", emoji: "🗓️", data: m }, projects),
      });
    }
  }
  for (const d of decisions) {
    if (haystack(d.title, d.decision, d.context, notesText(d.notesLog)).includes(q)) {
      results.push({
        type: "Décision",
        emoji: "🗳️",
        title: d.title,
        onOpen: () => openRecentDetail({ kind: "decision", emoji: "🗳️", data: d }, projects),
      });
    }
  }
  // Informations/Idées "gardées" depuis l'Inbox — absentes de la recherche jusqu'à cette
  // vague, comme elles l'avaient été du fil conducteur avant la correction du 31/08/2026
  // (même trou d'architecture, même correction : un type de plus à ne jamais oublier).
  for (const item of keptItems) {
    if (haystack(item.rawContent, notesText(item.notesLog)).includes(q)) {
      results.push({
        type: "Information/Idée",
        emoji: item.keptAsType === "idea" ? "💡" : "🧠",
        title: item.rawContent,
        onOpen: () => openKeptItemDetail(item),
      });
    }
  }

  return results;
}

export function openSearchModal() {
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <input id="global-search-input" type="text" placeholder="Rechercher un mot dans tout Pilotage..." />
    </div>
    <div class="chip-row" id="search-type-filter" style="margin-bottom:8px;"></div>
    <div id="global-search-results"></div>
  `;

  const resultsEl = body.querySelector("#global-search-results");
  const inputEl = body.querySelector("#global-search-input");
  const filterEl = body.querySelector("#search-type-filter");

  let lastResults = [];
  const activeTypes = new Set(SEARCH_TYPES);

  filterEl.innerHTML = SEARCH_TYPES.map(
    (t, i) => `<button type="button" class="chip active" data-type="${escapeHtml(t)}" title="Alt+${i + 1}">${t}</button>`
  ).join("");

  function updateFilterChips() {
    filterEl.querySelectorAll("[data-type]").forEach((chip) => chip.classList.toggle("active", activeTypes.has(chip.dataset.type)));
  }

  function toggleType(type) {
    if (activeTypes.has(type)) {
      if (activeTypes.size === 1) return; // jamais 0 type actif — inutile, ça ne montrerait plus rien.
      activeTypes.delete(type);
    } else {
      activeTypes.add(type);
    }
    updateFilterChips();
    renderResults(lastResults, inputEl.value);
  }

  filterEl.querySelectorAll("[data-type]").forEach((chip) => chip.addEventListener("click", () => toggleType(chip.dataset.type)));

  function renderResults(results, query) {
    lastResults = results;
    if (!query.trim()) {
      resultsEl.innerHTML = `<div class="empty-state" style="padding:16px;">Tape un mot-clé — titre, nom, notes, tag...</div>`;
      return;
    }
    const filtered = results.filter((r) => activeTypes.has(r.type));
    if (!filtered.length) {
      resultsEl.innerHTML = `<div class="empty-state" style="padding:16px;">Rien ne correspond à « ${escapeHtml(query)} »${
        results.length ? " avec ces filtres." : "."
      }</div>`;
      return;
    }
    resultsEl.innerHTML = "";
    const card = document.createElement("div");
    card.className = "card";
    for (const r of filtered) {
      const row = document.createElement("div");
      row.className = "item-row";
      row.style.cursor = "pointer";
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">${r.emoji} ${escapeHtml(r.title)}</div>
          <div class="item-meta">
            ${r.type}${r.meta ? " · " + escapeHtml(r.meta) : ""}${r.status ? ` · <strong>${escapeHtml(r.status)}</strong>` : ""}
          </div>
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

  // Alt+1…Alt+8 = basculer le filtre de type correspondant, sans quitter le clavier — scopé à
  // cette modale (capturé avant d'atteindre le raccourci global Alt+1…8 qui change d'onglet,
  // lequel s'abstient déjà tant qu'une fiche est ouverte, voir js/services/shortcuts.js).
  function onKeydown(e) {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    const index = Number(e.key) - 1;
    if (Number.isNaN(index) || index < 0 || index >= SEARCH_TYPES.length) return;
    e.preventDefault();
    e.stopPropagation();
    toggleType(SEARCH_TYPES[index]);
  }
  body.addEventListener("keydown", onKeydown);

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
