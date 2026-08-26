// Vue Inbox — le sas d'entrée (§11, §12, §13).
// Une capture non traitée n'est PAS un retard : pas de badge rouge culpabilisant ici,
// juste un compteur neutre.

import * as inboxApi from "../domain/inbox.js";
import * as projectsApi from "../domain/projects.js";
import * as peopleApi from "../domain/people.js";
import * as followUpsApi from "../domain/followups.js";
import * as meetingsApi from "../domain/meetings.js";
import * as decisionsApi from "../domain/decisions.js";
import { openModal, closeModal } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { openCreateProjectModal } from "./projects.js";
import { openCreateResourceModal } from "./resources.js";

// Les 9 issues de qualification du §12 sont maintenant toutes réellement implémentées :
// chacune crée sa vraie entité (Task / FollowUp / Project / Meeting / Decision / Resource)
// au lieu de retomber en "Information" générique — la Règle 3 (ne jamais perdre la capture)
// reste garantie par inboxApi.qualify(), qui journalise toujours le lien vers l'objet créé.
const QUALIFY_CHOICES = [
  { key: "task", emoji: "✅", label: "Action" },
  { key: "followup", emoji: "👀", label: "Suivi" },
  { key: "project", emoji: "📦", label: "Projet" },
  { key: "meeting", emoji: "📅", label: "Réunion" },
  { key: "decision", emoji: "🗳️", label: "Décision" },
  { key: "kept", emoji: "🧠", label: "Information" },
  { key: "resource", emoji: "📎", label: "Ressource" },
  { key: "idea", emoji: "💡", label: "Idée", mapsTo: "kept" },
  { key: "archived", emoji: "🗑️", label: "Archiver" },
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
  if (choice.key === "followup") {
    closeModal();
    return openFollowUpFromInboxModal(item);
  }
  if (choice.key === "project") {
    closeModal();
    return openProjectFromInboxModal(item);
  }
  if (choice.key === "meeting") {
    closeModal();
    return openMeetingFromInboxModal(item);
  }
  if (choice.key === "decision") {
    closeModal();
    return openDecisionFromInboxModal(item);
  }
  if (choice.key === "resource") {
    closeModal();
    return openResourceFromInboxModal(item);
  }
  // "kept", "archived" et "idea" (→ "kept" via mapsTo) : rien à qualifier de plus, on
  // journalise directement l'issue.
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

/**
 * "Suivi" (§29) : contrairement à Action/Projet/Ressource, il n'existe pas de modale de
 * création réutilisable côté Équipe — celle-là (people.js) part toujours d'une personne déjà
 * connue. Depuis l'Inbox on ne sait pas encore qui, donc on ajoute un sélecteur de personne
 * ici plutôt que de complexifier people.js pour un usage qui ne s'y prête pas vraiment.
 */
async function openFollowUpFromInboxModal(item) {
  const [people, projects] = await Promise.all([peopleApi.listAll(), projectsApi.listAll()]);
  if (!people.length) {
    showToast("Ajoute d'abord une personne dans l'onglet Équipe pour créer un suivi");
    return;
  }

  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="fu-person">Qui s'engage ?</label>
      <select id="fu-person">
        ${people.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("")}
      </select>
    </div>
    <div class="field">
      <label for="fu-title">Sur quoi ?</label>
      <input id="fu-title" type="text" value="${escapeAttr(item.rawContent.slice(0, 120))}" />
    </div>
    <div class="field">
      <label for="fu-due">Échéance de la personne (optionnel)</label>
      <input id="fu-due" type="date" />
    </div>
    <div class="field">
      <label for="fu-control">Quand dois-je contrôler / relancer ? (optionnel)</label>
      <input id="fu-control" type="date" />
    </div>
    <div class="field">
      <label for="fu-project">Projet (optionnel)</label>
      <select id="fu-project">
        <option value="">— Aucun —</option>
        ${projects.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("")}
      </select>
    </div>
  `;

  const { bodyEl, close } = openModal({
    title: "Nouveau suivi",
    body,
    actions: [
      { label: "Annuler", variant: "ghost" },
      {
        label: "Créer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          const title = bodyEl.querySelector("#fu-title").value.trim();
          if (!title) return;
          const followUp = await followUpsApi.createFollowUp({
            title,
            personId: bodyEl.querySelector("#fu-person").value,
            dueDate: bodyEl.querySelector("#fu-due").value || null,
            controlDate: bodyEl.querySelector("#fu-control").value || null,
            projectId: bodyEl.querySelector("#fu-project").value || null,
          });
          await inboxApi.qualify(item.id, "followup", { id: followUp.id });
          close();
          showToast("Suivi créé");
        },
      },
    ],
  });
}

/** "Projet" : réutilise directement la modale de création de projects.js (prefill + callback). */
function openProjectFromInboxModal(item) {
  openCreateProjectModal({
    name: item.rawContent.slice(0, 80),
    onCreated: async (project) => {
      await inboxApi.qualify(item.id, "project", { id: project.id });
      showToast("Projet créé");
    },
  });
}

/** "Ressource" : réutilise directement la modale de création de resources.js, avec sa
 *  détection automatique de type — même pattern que "Projet" ci-dessus. */
function openResourceFromInboxModal(item) {
  openCreateResourceModal({
    title: item.rawContent.slice(0, 80),
    onCreated: async (resource) => {
      await inboxApi.qualify(item.id, "resource", { id: resource.id });
      showToast("Ressource ajoutée");
    },
  });
}

/** "Réunion" (§49) : version simplifiée pour l'instant — le déroulé Avant/Pendant/Après
 *  complet viendra avec les canevas (§14-19). */
async function openMeetingFromInboxModal(item) {
  const projects = await projectsApi.listAll();

  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="mt-title">Sujet de la réunion</label>
      <input id="mt-title" type="text" value="${escapeAttr(item.rawContent.slice(0, 120))}" />
    </div>
    <div class="field">
      <label for="mt-date">Date (optionnel)</label>
      <input id="mt-date" type="date" />
    </div>
    <div class="field">
      <label for="mt-objective">Objectif (optionnel)</label>
      <textarea id="mt-objective" placeholder="Qu'est-ce qu'on cherche à obtenir de cette réunion ?"></textarea>
    </div>
    <div class="field">
      <label for="mt-project">Projet (optionnel)</label>
      <select id="mt-project">
        <option value="">— Aucun —</option>
        ${projects.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("")}
      </select>
    </div>
  `;

  const { bodyEl, close } = openModal({
    title: "Nouvelle réunion",
    body,
    actions: [
      { label: "Annuler", variant: "ghost" },
      {
        label: "Créer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          const title = bodyEl.querySelector("#mt-title").value.trim();
          if (!title) return;
          const meeting = await meetingsApi.createMeeting({
            title,
            date: bodyEl.querySelector("#mt-date").value || null,
            objective: bodyEl.querySelector("#mt-objective").value.trim(),
            projectId: bodyEl.querySelector("#mt-project").value || null,
          });
          await inboxApi.qualify(item.id, "meeting", { id: meeting.id });
          close();
          showToast("Réunion créée");
        },
      },
    ],
  });
}

/** "Décision" (§48). */
async function openDecisionFromInboxModal(item) {
  const projects = await projectsApi.listAll();

  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="dc-title">Sujet</label>
      <input id="dc-title" type="text" value="${escapeAttr(item.rawContent.slice(0, 120))}" />
    </div>
    <div class="field">
      <label for="dc-decision">Qu'est-ce qui a été décidé ?</label>
      <textarea id="dc-decision"></textarea>
    </div>
    <div class="field">
      <label for="dc-context">Contexte (optionnel)</label>
      <textarea id="dc-context"></textarea>
    </div>
    <div class="field">
      <label for="dc-date">Date (optionnel)</label>
      <input id="dc-date" type="date" />
    </div>
    <div class="field">
      <label for="dc-project">Projet (optionnel)</label>
      <select id="dc-project">
        <option value="">— Aucun —</option>
        ${projects.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("")}
      </select>
    </div>
  `;

  const { bodyEl, close } = openModal({
    title: "Nouvelle décision",
    body,
    actions: [
      { label: "Annuler", variant: "ghost" },
      {
        label: "Créer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          const title = bodyEl.querySelector("#dc-title").value.trim();
          const decisionText = bodyEl.querySelector("#dc-decision").value.trim();
          if (!title || !decisionText) return;
          const decision = await decisionsApi.createDecision({
            title,
            decision: decisionText,
            context: bodyEl.querySelector("#dc-context").value.trim(),
            date: bodyEl.querySelector("#dc-date").value || null,
            projectId: bodyEl.querySelector("#dc-project").value || null,
          });
          await inboxApi.qualify(item.id, "decision", { id: decision.id });
          close();
          showToast("Décision enregistrée");
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
