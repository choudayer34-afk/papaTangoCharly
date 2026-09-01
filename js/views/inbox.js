// Vue Inbox — le sas d'entrée (§11, §12, §13).
// Une capture non traitée n'est PAS un retard : pas de badge rouge culpabilisant ici,
// juste un compteur neutre.

import * as inboxApi from "../domain/inbox.js";
import * as projectsApi from "../domain/projects.js";
import * as peopleApi from "../domain/people.js";
import * as followUpsApi from "../domain/followups.js";
import * as meetingsApi from "../domain/meetings.js";
import * as decisionsApi from "../domain/decisions.js";
import * as preferencesApi from "../domain/preferences.js";
import { openModal, closeModal } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { showHintOnce } from "../components/hint.js";
import { suggestNextStep } from "../components/suggestNextStep.js";
import * as linkedItemsApi from "../components/linkedItems.js";
import { openCreateProjectModal } from "./projects.js";
import { openCreateResourceModal } from "./resources.js";
import { openCreateFollowUpModal } from "./people.js";
import { renderNotesBlock } from "../components/notesBlock.js";

const KEPT_TYPE_LABELS = { kept: "🧠 Information", idea: "💡 Idée" };

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
    <div class="view"><div id="inbox-hint"></div><div id="inbox-list"></div></div>
  `;

  const listEl = container.querySelector("#inbox-list");
  const subtitleEl = container.querySelector("#inbox-subtitle");
  showHintOnce(
    container.querySelector("#inbox-hint"),
    "inbox-intro-v1",
    "Une capture en attente ici n'est <strong>jamais</strong> un retard — c'est juste qualifié plus tard. Qualifie-la en Tâche (c'est toi qui agis) ou en Suivi (quelqu'un d'autre s'engage) pour qu'elle rejoigne le bon endroit."
  );

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

/** Exportée pour la Revue hebdomadaire guidée (§51, components/weeklyReview.js), qui doit
 *  pouvoir sauter directement sur la qualification d'un élément Inbox sans dupliquer ce
 *  choix de type ailleurs. */
export function openQualifyModal(item) {
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

/**
 * Exportée pour la capture express (js/components/capture.js, "+ Préciser maintenant") : elle
 * peut sauter directement sur un type choisi au moment de la capture plutôt que de repasser
 * par l'Inbox et le choix "Qu'est-ce que c'est ?" — réutilise exactement le même dispatcheur
 * que la qualification normale, pour ne jamais dupliquer cette logique.
 */
export function openQualifyChoice(item, key) {
  const choice = QUALIFY_CHOICES.find((c) => c.key === key);
  if (!choice) return openQualifyModal(item);
  return handleChoice(item, choice);
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
      <label for="task-description">Description</label>
      <textarea id="task-description" placeholder="Le détail — la capture d'origine part ici par défaut, rien n'est perdu">${escapeHtml(item.rawContent)}</textarea>
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
    <div class="field" style="display:flex;align-items:center;gap:8px;">
      <input id="task-communication" type="checkbox" style="width:auto;" />
      <label for="task-communication" style="margin:0;">📣 C'est une communication (article, message) — activer son canevas de production</label>
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
          const description = bodyEl.querySelector("#task-description").value.trim();
          const dueDate = bodyEl.querySelector("#task-due").value || null;
          const projectId = bodyEl.querySelector("#task-project").value || null;
          const type = bodyEl.querySelector("#task-communication").checked ? "communication" : "action";
          await inboxApi.qualify(item.id, "task", { title, description, dueDate, projectId, type });
          close();
          showToast("Action créée");
        },
      },
    ],
  });
}

/**
 * "Suivi" (§29) : réutilise directement la modale complète de people.js (retour de
 * Charles-Henri, 01/09/2026 : le "sens" — j'attends / je dois transmettre — n'apparaissait pas
 * directement à la qualification depuis l'Inbox). Cette modale gère déjà le cas "on ne sait pas
 * encore qui" (sélecteur de personne affiché quand `person` n'est pas fourni) — plus besoin
 * d'une seconde version simplifiée ici, qui avait fini par diverger de la vraie (sens, catégorie,
 * notable manquants).
 */
async function openFollowUpFromInboxModal(item) {
  const people = await peopleApi.listAll();
  if (!people.length) {
    showToast("Ajoute d'abord une personne dans l'onglet Équipe pour créer un suivi");
    return;
  }
  openCreateFollowUpModal({
    defaultTitle: item.rawContent.slice(0, 120),
    onCreated: async (followUp) => {
      await inboxApi.qualify(item.id, "followup", { id: followUp.id });
      showToast("Suivi créé");
    },
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
      <label for="mt-canevas">Canevas (optionnel)</label>
      <select id="mt-canevas">
        ${meetingsApi.CANEVAS_OPTIONS.map((c) => `<option value="${c.key}">${c.label}</option>`).join("")}
      </select>
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
            canevasKey: bodyEl.querySelector("#mt-canevas").value,
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
          // Suggestion de prochaine étape (§ 31/08/2026, retour de Charles-Henri : mieux se
          // souvenir des enchaînements) : une Décision entraîne souvent une Tâche — proposer
          // de la créer, déjà liée, tout de suite plutôt que de compter sur la Revue hebdo
          // pour s'en souvenir plus tard.
          suggestNextStep({
            title: "Créer une action ?",
            message: `Décision enregistrée : « ${decision.title} ». Cette décision entraîne-t-elle une action ? Tu peux créer une Tâche liée tout de suite.`,
            acceptLabel: "+ Créer la tâche",
            onAccept: () => linkedItemsApi.openCreateAndLinkDirect("Task", { type: "Decision", id: decision.id }, decision.title),
            onDecline: () => showToast("Décision enregistrée"),
          });
        },
      },
    ],
  });
}

/**
 * Fiche minimale pour une Information/Idée qualifiée (§ correction du 31/08/2026, retour de
 * Charles-Henri : "une tâche liée à une information n'est pas visible") — jusqu'ici ces
 * éléments n'avaient aucune fiche propre : ni clic depuis le Dashboard, ni section "🔗 Lié",
 * ni résolution dans le fil conducteur (voir js/components/linkedItems.js), contrairement aux
 * 7 autres types. Le contenu capturé reste en lecture seule (Règle 3 : jamais perdre ni
 * retoucher la capture brute) — seules deux actions restent possibles : lier/délier, et
 * archiver (même chemin que le bouton "Archiver" déjà existant au Dashboard).
 */
export function openKeptItemDetail(item, { onClose } = {}) {
  preferencesApi.recordRecentlyViewed("Kept", item.id).catch(() => {});
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label>${KEPT_TYPE_LABELS[item.keptAsType] || KEPT_TYPE_LABELS.kept}</label>
      <p style="white-space:pre-wrap;margin:4px 0 0;">${escapeHtml(item.rawContent)}</p>
    </div>
    <div class="item-meta" style="margin-bottom:16px;">Capturé le ${formatDate(item.createdAt)}</div>
    <div class="section-title">🗒️ Notes</div>
    <div id="detail-notes" style="margin-bottom:16px;"></div>
    <div class="section-title">🔗 Lié</div>
    <div class="card" id="detail-links" style="margin-bottom:8px;"></div>
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <button id="link-existing-btn" class="btn btn-secondary btn-sm">🔗 Lier une fiche</button>
      <button id="create-linked-btn" class="btn btn-secondary btn-sm">+ Créer et lier</button>
    </div>
  `;

  const ref = { type: "Kept", id: item.id };
  const shortLabel = item.rawContent.slice(0, 60);
  renderNotesBlock(body.querySelector("#detail-notes"), item.notesLog || [], {
    onAdd: async (text) => {
      const updated = await inboxApi.addKeptNote(item.id, text);
      item.notesLog = updated;
      return updated;
    },
  });
  linkedItemsApi.renderLinkedSection(body.querySelector("#detail-links"), ref);
  body.querySelector("#link-existing-btn").addEventListener("click", () => {
    closeModal();
    linkedItemsApi.openLinkPickerModal(ref, shortLabel, {
      onLinked: () => openKeptItemDetail(item, { onClose }),
      onCancel: () => openKeptItemDetail(item, { onClose }),
    });
  });
  body.querySelector("#create-linked-btn").addEventListener("click", () => {
    closeModal();
    linkedItemsApi.openCreateAndLinkModal(ref, shortLabel, {
      onLinked: () => openKeptItemDetail(item, { onClose }),
      onCancel: () => openKeptItemDetail(item, { onClose }),
    });
  });

  openModal({
    title: item.keptAsType === "idea" ? "💡 Idée" : "🧠 Information",
    body,
    actions: [
      { label: "Fermer", variant: "ghost", onClick: () => onClose?.() },
      {
        label: "🗄️ Archiver",
        variant: "secondary",
        closesModal: false,
        onClick: async () => {
          await inboxApi.qualify(item.id, "archived");
          closeModal();
          showToast("Archivé");
          onClose?.();
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
