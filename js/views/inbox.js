// Vue Inbox — le sas d'entrée (§11, §12, §13).
// Une capture non traitée n'est PAS un retard : pas de badge rouge culpabilisant ici,
// juste un compteur neutre.

import * as inboxApi from "../domain/inbox.js";
import * as peopleApi from "../domain/people.js";
import * as preferencesApi from "../domain/preferences.js";
import { openModal, closeModal } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { showHintOnce } from "../components/hint.js";
import { openCreateProjectModal } from "./projects.js";
import { openCreateResourceModal } from "./resources.js";
import { openCreateFollowUpModal } from "./people.js";
import { openCreateTaskModal } from "./kanban.js";
import { openCreateMeetingModal, openCreateDecisionModal } from "./dashboard.js";
import { renderNotesBlock } from "../components/notesBlock.js";
import * as linkedItemsApi from "../components/linkedItems.js";

const KEPT_TYPE_LABELS = { kept: "🧠 Information", idea: "💡 Idée" };

// Les 9 issues de qualification du §12 sont maintenant toutes réellement implémentées :
// chacune crée sa vraie entité (Task / FollowUp / Project / Meeting / Decision / Resource)
// au lieu de retomber en "Information" générique — la Règle 3 (ne jamais perdre la capture)
// reste garantie par inboxApi.qualify(), qui journalise toujours le lien vers l'objet créé.
//
// `primary` (audit de simplification du 02/09/2026, retour de Charles-Henri : "9 choix d'un
// coup à la qualification, c'est trop") : Action/Suivi/Information couvrent l'essentiel des
// captures et restent seuls visibles d'emblée ; les 6 autres issues, plus rares, passent sous
// "Autre" (voir openQualifyModal) — jamais supprimées, juste à un clic de plus.
const QUALIFY_CHOICES = [
  { key: "task", emoji: "✅", label: "Action", primary: true },
  { key: "followup", emoji: "👀", label: "Suivi", primary: true },
  { key: "kept", emoji: "🧠", label: "Information", primary: true },
  { key: "project", emoji: "📦", label: "Projet" },
  { key: "meeting", emoji: "📅", label: "Réunion" },
  { key: "decision", emoji: "🗳️", label: "Décision" },
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

  function buildChoiceGrid(choices) {
    const grid = document.createElement("div");
    grid.className = "choice-grid";
    for (const choice of choices) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice-btn";
      btn.innerHTML = `<span class="emoji">${choice.emoji}</span> ${choice.label}`;
      btn.addEventListener("click", () => handleChoice(item, choice));
      grid.appendChild(btn);
    }
    return grid;
  }

  body.appendChild(buildChoiceGrid(QUALIFY_CHOICES.filter((c) => c.primary)));

  // "Autre" (audit de simplification du 02/09/2026) : replié par défaut, mêmes <details>
  // natifs qu'ailleurs dans l'app (ex. "🕒 Historique" des fiches) plutôt qu'un composant dédié.
  const other = document.createElement("details");
  other.className = "qualify-other";
  other.innerHTML = `<summary class="section-title" style="cursor:pointer;">Autre</summary>`;
  other.appendChild(buildChoiceGrid(QUALIFY_CHOICES.filter((c) => !c.primary)));
  body.appendChild(other);

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

/**
 * "Action" (vague 19, unification des formulaires de création, audit de simplification) :
 * réutilise désormais le même formulaire que le "+" du Pilotage (js/views/kanban.js) au lieu
 * d'en maintenir une copie légèrement différente ici — seule différence de comportement gardée,
 * via `prefill.createFn` : la tâche est créée par `inboxApi.qualify()` plutôt que directement,
 * pour que le lien avec la capture d'origine (Règle 3, `sourceInboxItemId`) ne se perde jamais.
 */
function openTaskFromInboxModal(item) {
  openCreateTaskModal({
    title: item.rawContent.slice(0, 80),
    description: item.rawContent,
    createdToast: "Action créée",
    createFn: (payload) => inboxApi.qualify(item.id, "task", payload).then((r) => r.task),
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

/**
 * "Réunion" (vague 19, unification des formulaires de création) : réutilise désormais le
 * formulaire canonique de js/views/dashboard.js (Objectif, Canevas, Projet) au lieu d'une
 * version séparée qui avait fini par diverger — même toast déjà géré par la modale canonique.
 */
function openMeetingFromInboxModal(item) {
  openCreateMeetingModal({
    title: item.rawContent.slice(0, 120),
    onCreated: (meeting) => inboxApi.qualify(item.id, "meeting", { id: meeting.id }),
  });
}

/**
 * "Décision" (vague 19, unification des formulaires de création) : réutilise le formulaire
 * canonique de js/views/dashboard.js, qui propose déjà la suggestion "Créer une action ?"
 * après l'enregistrement — plus besoin de la dupliquer ici.
 */
function openDecisionFromInboxModal(item) {
  openCreateDecisionModal({
    title: item.rawContent.slice(0, 120),
    onCreated: (decision) => inboxApi.qualify(item.id, "decision", { id: decision.id }),
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
