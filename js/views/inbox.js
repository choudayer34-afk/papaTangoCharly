// Vue Inbox — le sas d'entrée (§11, §12, §13).
// Une capture non traitée n'est PAS un retard : pas de badge rouge culpabilisant ici,
// juste un compteur neutre.

import * as inboxApi from "../domain/inbox.js";
import * as peopleApi from "../domain/people.js";
import * as projectsApi from "../domain/projects.js";
import * as tasksApi from "../domain/tasks.js";
import * as preferencesApi from "../domain/preferences.js";
import { openModal, closeModal } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { showHintOnce } from "../components/hint.js";
import { openCreateProjectModal, openProjectDetail, attachProjectQuickCreate } from "./projects.js";
import { openCreateResourceModal, openResourceDetail } from "./resources.js";
import { openCreateFollowUpModal, openEditFollowUpModal } from "./people.js";
import { openCreateTaskModal, openTaskDetail } from "./kanban.js";
import { openCreateMeetingModal, openCreateDecisionModal, openRecentDetail } from "./dashboard.js";
import { renderNotesBlock } from "../components/notesBlock.js";
import * as linkedItemsApi from "../components/linkedItems.js";
import { copyEntityLink } from "../components/copyLink.js";
import { openChangeTypeModal } from "../components/changeType.js";
import * as tagsApi from "../domain/tags.js";
import { renderTagsEditor } from "../components/tagsEditor.js";

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

// TODO-013 (LOT 6, 21/09/2026) — "Traiter en lot" : strictement limité aux 3 qualifications de
// QUALIFY_CHOICES qui ne nécessitent aucun formulaire de création (kept/idea/archived — voir
// leur commentaire plus haut, "primary" et "Autre" n'y changent rien). Ne concerne jamais
// Action/Suivi/Projet/Réunion/Décision/Ressource, qui gardent leur formulaire dédié. Dérivé de
// QUALIFY_CHOICES par filtre plutôt que redéfini séparément, pour ne jamais pouvoir diverger
// silencieusement de la liste "sans formulaire" si elle change un jour.
const BULK_ELIGIBLE_KEYS = ["kept", "idea", "archived"];
const BULK_CHOICES = QUALIFY_CHOICES.filter((c) => BULK_ELIGIBLE_KEYS.includes(c.key));

export function renderInbox(container) {
  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Inbox</h1>
        <div class="subtitle" id="inbox-subtitle">—</div>
      </div>
      <button type="button" id="inbox-bulk-toggle" class="btn btn-ghost btn-sm">☑️ Traiter en lot</button>
    </div>
    <div class="view"><div id="inbox-hint"></div><div id="inbox-bulk-toolbar-slot"></div><div id="inbox-list"></div></div>
  `;

  const listEl = container.querySelector("#inbox-list");
  const subtitleEl = container.querySelector("#inbox-subtitle");
  const bulkToggleBtn = container.querySelector("#inbox-bulk-toggle");
  const bulkToolbarSlot = container.querySelector("#inbox-bulk-toolbar-slot");
  showHintOnce(
    container.querySelector("#inbox-hint"),
    "inbox-intro-v1",
    "Une capture en attente ici n'est <strong>jamais</strong> un retard — c'est juste qualifié plus tard. Qualifie-la en Tâche (c'est toi qui agis) ou en Suivi (quelqu'un d'autre s'engage) pour qu'elle rejoigne le bon endroit."
  );

  // Désactivé par défaut (retour explicite de Charles-Henri : l'utilisateur doit activer le
  // mode lot lui-même) — état purement local à cette vue, volontairement pas un mécanisme
  // générique de sélection/traitement multiple (voir la garde d'implémentation du TODO-013) :
  // un booléen + un Set d'ids, indépendants de tout ce qui existe par ailleurs (ex. la
  // sélection en masse de js/views/kanban.js, qui reste un mécanisme séparé, propre aux tâches).
  let bulkMode = false;
  const bulkSelection = new Set();
  let currentItems = [];

  function renderBulkToolbar() {
    bulkToolbarSlot.innerHTML = "";
    if (!bulkMode || bulkSelection.size === 0) return;
    const bar = document.createElement("div");
    // Classe déjà utilisée par la barre d'actions en masse de js/views/kanban.js, reprise ici
    // uniquement pour la cohérence visuelle — aucune logique JS partagée avec elle.
    bar.className = "pilotage-bulk-toolbar";
    bar.innerHTML = `
      <span class="pilotage-bulk-toolbar-count">${bulkSelection.size} élément${bulkSelection.size > 1 ? "s" : ""} sélectionné${bulkSelection.size > 1 ? "s" : ""}</span>
      ${BULK_CHOICES.map((c) => `<button type="button" class="btn btn-secondary btn-sm" data-bulk-choice="${c.key}">${c.emoji} ${escapeHtml(c.label)}</button>`).join("")}
      <button type="button" id="inbox-bulk-clear" class="btn btn-ghost btn-sm">Tout désélectionner</button>
    `;
    bar.querySelectorAll("[data-bulk-choice]").forEach((btn) => {
      btn.addEventListener("click", () => processBulk(btn.dataset.bulkChoice));
    });
    bar.querySelector("#inbox-bulk-clear").addEventListener("click", () => {
      bulkSelection.clear();
      renderBulkToolbar();
      render(currentItems);
    });
    bulkToolbarSlot.appendChild(bar);
  }

  /** Traite en une fois tous les éléments actuellement sélectionnés avec l'issue choisie. */
  async function processBulk(key) {
    const choice = BULK_CHOICES.find((c) => c.key === key);
    if (!choice) return;
    const ids = [...bulkSelection];
    if (!ids.length) return;
    const outcome = choice.mapsTo || choice.key;
    // Garde anti-double-traitement (exigée par TODO-013) : la sélection est vidée et la barre
    // d'actions/les cases à cocher redessinées de façon SYNCHRONE, avant le `await` de la
    // qualification elle-même — un second clic (ou un clic pendant le await) ne retrouve donc
    // plus ni les ids déjà envoyés ni les boutons qui les ont envoyés.
    bulkSelection.clear();
    renderBulkToolbar();
    render(currentItems);
    await Promise.all(ids.map((id) => inboxApi.qualify(id, outcome)));
    showToast(`${ids.length} élément${ids.length > 1 ? "s" : ""} traité${ids.length > 1 ? "s" : ""} en lot`);
  }

  bulkToggleBtn.addEventListener("click", () => {
    bulkMode = !bulkMode;
    bulkToggleBtn.textContent = bulkMode ? "✅ Mode lot actif" : "☑️ Traiter en lot";
    bulkToggleBtn.classList.toggle("btn-secondary", bulkMode);
    bulkToggleBtn.classList.toggle("btn-ghost", !bulkMode);
    if (!bulkMode) bulkSelection.clear();
    renderBulkToolbar();
    render(currentItems);
  });

  function render(items) {
    currentItems = items;
    // Purge la sélection de tout id qui ne serait plus en attente (qualifié entretemps par un
    // autre onglet, par ex.) — jamais de sélection fantôme.
    for (const id of [...bulkSelection]) {
      if (!items.some((i) => i.id === id)) bulkSelection.delete(id);
    }

    subtitleEl.textContent = items.length
      ? `${items.length} élément${items.length > 1 ? "s" : ""} à traiter`
      : "Tout est traité";

    if (!items.length) {
      listEl.innerHTML = `
        <div class="empty-state">
          <span class="emoji">📥</span>
          Rien à traiter pour l'instant.
        </div>`;
      renderBulkToolbar();
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
      // Case de sélection pour le mode lot (TODO-013) — visible uniquement quand le mode est
      // actif ; le comportement individuel ci-dessous ("✏️" et "Traiter") reste par ailleurs
      // totalement inchangé et disponible, mode lot actif ou non.
      if (bulkMode) {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.setAttribute("aria-label", "Sélectionner pour un traitement en lot");
        checkbox.style.marginRight = "12px";
        checkbox.checked = bulkSelection.has(item.id);
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) bulkSelection.add(item.id);
          else bulkSelection.delete(item.id);
          renderBulkToolbar();
        });
        row.prepend(checkbox);
      }
      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "8px";
      // Modifier le texte capturé sans avoir à qualifier (retour de Charles-Henri,
      // 06/09/2026, voir js/domain/inbox.js#updateRawContent) — bouton icône distinct de
      // "Traiter" : l'un corrige le texte, l'autre choisit ce qu'il devient.
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn btn-ghost btn-sm";
      editBtn.title = "Modifier le texte";
      editBtn.setAttribute("aria-label", "Modifier le texte");
      editBtn.textContent = "✏️";
      editBtn.addEventListener("click", () => openEditRawModal(item));
      actions.appendChild(editBtn);
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
    renderBulkToolbar();
  }

  const unsubscribe = inboxApi.subscribePending(render);
  return unsubscribe;
}

/**
 * Corrige le texte d'une capture encore en attente, sans passer par la qualification (retour
 * de Charles-Henri, 06/09/2026 : "je dois pouvoir modifier le titre même si je la qualifie
 * pas") — une petite modale dédiée plutôt que de rendre `raw` éditable dans openQualifyModal :
 * ce dernier reste "je choisis ce que ça devient", celle-ci reste "je corrige ce que j'ai
 * écrit", les deux actions restent indépendantes l'une de l'autre.
 */
function openEditRawModal(item) {
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="inbox-edit-raw">Texte capturé</label>
      <textarea id="inbox-edit-raw">${escapeHtml(item.rawContent)}</textarea>
    </div>
  `;
  const { bodyEl, close } = openModal({
    title: "✏️ Modifier",
    body,
    actions: [
      { label: "Annuler", variant: "ghost" },
      {
        label: "Enregistrer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          const text = bodyEl.querySelector("#inbox-edit-raw").value.trim();
          if (!text) return;
          await inboxApi.updateRawContent(item.id, text);
          close();
          showToast("Modifié");
        },
      },
    ],
  });
  setTimeout(() => bodyEl.querySelector("#inbox-edit-raw").focus(), 30);
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

  // Raccourcis 1/2/3/A (vague 20, retour de Charles-Henri : "je marche aussi beaucoup au
  // raccourci clavier") — 1/2/3 choisissent directement Action/Suivi/Information dans l'ordre
  // où ils apparaissent déjà dans la grille primaire, A déplie "Autre". Documentés dans le
  // Guide (js/services/shortcuts.js#BUILTIN_SHORTCUTS), câblés ici plutôt que dans ce fichier
  // partagé : cette fenêtre "Traiter" n'a aucun champ de texte, donc aucun risque de capter
  // une frappe destinée ailleurs.
  function onKeydown(e) {
    // Garde défensive ajoutée en vague 22 (en plus de la vraie correction dans modal.js#closeModal,
    // qui empêchait cet écouteur d'être retiré) : cette fenêtre "Traiter" n'a normalement aucun
    // champ de texte, mais autant ne jamais capter 1/2/3/A si le focus est malgré tout dans un
    // champ éditable, plutôt que de reposer uniquement sur cette hypothèse.
    if (isEditableTarget(e.target)) return;
    if (e.key === "1") return act("task");
    if (e.key === "2") return act("followup");
    if (e.key === "3") return act("kept");
    if (e.key.toLowerCase() === "a" && !other.open) {
      e.preventDefault();
      other.open = true;
    }
  }
  function act(key) {
    const choice = QUALIFY_CHOICES.find((c) => c.key === key);
    if (choice) handleChoice(item, choice);
  }
  document.addEventListener("keydown", onKeydown);

  openModal({
    title: "Traiter",
    body,
    actions: [{ label: "Plus tard", variant: "ghost" }],
    onClose: () => document.removeEventListener("keydown", onKeydown),
  });
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
  // "Archivé" = classé sans suite, rien à montrer. "Kept"/idée : même principe que les autres
  // types ci-dessus — ouvrir la fiche complète plutôt que de s'arrêter au toast. Reconstruit
  // localement l'état posé par `qualify()` (voir js/domain/inbox.js) plutôt que de re-fetch.
  if (outcome !== "archived") {
    openKeptItemDetail({ ...item, status: "kept", keptAsType: outcome });
  }
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
    // Retour de Charles-Henri, 13/09/2026 : "quand je traite une tâche de l'inbox, je dois à la
    // fin rentrer dans l'élément en mode complet [...] ne doit pas se fermer de lui-même" —
    // jusqu'ici, créer depuis l'Inbox refermait tout sur un simple toast, sans jamais montrer la
    // fiche créée. `openCreateTaskModal` ferme déjà SA propre modale avant d'appeler `onCreated`
    // (voir js/views/kanban.js), donc ouvrir la fiche complète ici ne referme rien de force —
    // elle reste ouverte tant que Charles-Henri ne la ferme pas lui-même (comportement normal
    // de toute fiche, voir js/components/modal.js).
    onCreated: async (task) => {
      const projects = await projectsApi.listAll();
      openTaskDetail(task, projects);
    },
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
    // Même principe que "Action" ci-dessus : ouvrir la fiche complète du Suivi créé plutôt que
    // de refermer sur un simple toast.
    onCreated: async (followUp) => {
      await inboxApi.qualify(item.id, "followup", { id: followUp.id });
      showToast("Suivi créé");
      openEditFollowUpModal(followUp);
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
      openProjectDetail(project, []); // tout juste créé — aucune tâche liée pour l'instant
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
      const [projects, tasks] = await Promise.all([projectsApi.listAll(), tasksApi.listAll()]);
      openResourceDetail(resource, projects, tasks);
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
    onCreated: async (meeting) => {
      await inboxApi.qualify(item.id, "meeting", { id: meeting.id });
      const projects = await projectsApi.listAll();
      openRecentDetail({ kind: "meeting", emoji: "🗓️", data: meeting }, projects);
    },
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
    onCreated: async (decision) => {
      await inboxApi.qualify(item.id, "decision", { id: decision.id });
      const projects = await projectsApi.listAll();
      openRecentDetail({ kind: "decision", emoji: "🗳️", data: decision }, projects);
    },
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
/**
 * Parcourir TOUTES les Informations/Idées (retour de Charles-Henri, vague 40, 09/09/2026 :
 * "je n'ai jamais la possibilité de retrouver une information ailleurs") — contrairement à la
 * section du Dashboard classique (limitée aux 8 plus récentes, repliable, et absente du mode
 * Accueil "Focus"), cette modale liste TOUT — y compris les éléments auto-archivés après 15
 * jours (`listKeptIncludingArchived`, voir js/domain/inbox.js) — avec un filtre texte simple.
 * Un seul point d'entrée réutilisé par les deux modes d'Accueil (classic et Focus).
 */
export async function openAllKeptItemsModal() {
  const items = (await inboxApi.listKeptIncludingArchived()).sort((a, b) => b.createdAt - a.createdAt);
  // Filtre par tag (retour de Charles-Henri, 13/09/2026 : "voir comment retrouver facilement
  // les éléments d'une catégorie") — en plus du filtre texte déjà existant, jamais à la place :
  // les deux se combinent (ET). Plusieurs tags peuvent être activés à la fois (un élément
  // correspond dès qu'il porte AU MOINS un des tags cochés, pas tous). Tags désormais posés via
  // la collection générique js/domain/tags.js (retour de Charles-Henri, même jour : "les tags
  // peuvent être associé à n'importe quel élément"), plus l'ancien tableau `item.tags`.
  const allTags = await tagsApi.listAll();
  const tagNames = tagsApi.listAllTagNames(allTags);
  const tagsByItem = new Map(items.map((item) => [item.id, tagsApi.tagsFor(allTags, "Kept", item.id).map((t) => t.tag)]));

  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field" style="margin-bottom:12px;">
      <input id="kept-filter" type="text" placeholder="🔎 Filtrer par mot..." />
    </div>
    ${
      tagNames.length
        ? `<div class="chip-row" id="kept-tag-filters" style="margin-bottom:12px;">
             ${tagNames.map((t) => `<button type="button" class="chip" data-tag="${escapeAttr(t)}">#${escapeHtml(t)}</button>`).join("")}
           </div>`
        : ""
    }
    <div class="card" id="kept-all-list"></div>
  `;
  const listEl = body.querySelector("#kept-all-list");
  const activeTags = new Set();

  function renderList(filterText) {
    const needle = filterText.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (needle && !item.rawContent.toLowerCase().includes(needle)) return false;
      const itemTags = tagsByItem.get(item.id) || [];
      if (activeTags.size && !itemTags.some((t) => activeTags.has(t))) return false;
      return true;
    });
    listEl.innerHTML = "";
    if (!filtered.length) {
      listEl.innerHTML = `<div class="empty-state" style="padding:16px;">${needle || activeTags.size ? "Aucun résultat." : "Rien à afficher pour l'instant."}</div>`;
      return;
    }
    for (const item of filtered) {
      const row = document.createElement("div");
      row.className = "item-row";
      row.style.cursor = "pointer";
      const archivedTag = item.status === "archived" ? " · 🗄️ archivée" : "";
      const itemTags = tagsByItem.get(item.id) || [];
      const tagsLine = itemTags.length ? ` · ${itemTags.map((t) => `#${escapeHtml(t)}`).join(" ")}` : "";
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">${escapeHtml(item.rawContent)}</div>
          <div class="item-meta">${KEPT_TYPE_LABELS[item.keptAsType] || KEPT_TYPE_LABELS.kept} · ${formatDate(item.createdAt)}${archivedTag}${tagsLine}</div>
        </div>
      `;
      row.addEventListener("click", () => {
        closeModal();
        openKeptItemDetail(item, { onClose: () => openAllKeptItemsModal() });
      });
      listEl.appendChild(row);
    }
  }
  renderList("");
  // BUG corrigé (15/09/2026, audit performance) : aucun anti-rebond sur ce filtre — chaque
  // frappe reconstruisait toute la liste. Voir js/views/kanban.js, même correctif.
  let keptFilterDebounce = null;
  body.querySelector("#kept-filter").addEventListener("input", (e) => {
    const value = e.target.value;
    clearTimeout(keptFilterDebounce);
    keptFilterDebounce = setTimeout(() => renderList(value), 150);
  });
  body.querySelectorAll("#kept-tag-filters .chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tag = btn.dataset.tag;
      if (activeTags.has(tag)) {
        activeTags.delete(tag);
        btn.classList.remove("active");
      } else {
        activeTags.add(tag);
        btn.classList.add("active");
      }
      renderList(body.querySelector("#kept-filter").value);
    });
  });

  openModal({ title: `🧠 Informations & idées (${items.length})`, body, actions: [{ label: "Fermer", variant: "ghost" }] });
}

export async function openKeptItemDetail(item, { onClose } = {}) {
  preferencesApi.recordRecentlyViewed("Kept", item.id).catch(() => {});
  // "Projet" + "Tags" (retour de Charles-Henri, 13/09/2026 : "tout élément doit être
  // rattachable à un projet" + "pouvoir catégoriser des idées/informations") — chargés ici
  // plutôt qu'à la qualification (openQualifyChoice) : une capture qualifiée en Information/Idée
  // reste d'abord un texte brut conservé (Règle 3), le rattachement à un projet et les tags
  // s'ajoutent ensuite, depuis la fiche détail, jamais obligatoires.
  const [projects] = await Promise.all([projectsApi.listAll()]);
  const sortedProjects = [...projects].sort((a, b) => a.name.localeCompare(b.name, "fr"));

  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label>${KEPT_TYPE_LABELS[item.keptAsType] || KEPT_TYPE_LABELS.kept}</label>
      <p style="white-space:pre-wrap;margin:4px 0 0;">${escapeHtml(item.rawContent)}</p>
    </div>
    <div class="item-meta" style="margin-bottom:16px;">Capturé le ${formatDate(item.createdAt)}</div>
    <div class="field">
      <label for="kept-project">Projet (optionnel)</label>
      <select id="kept-project">
        <option value="">— Aucun —</option>
        ${sortedProjects.map((p) => `<option value="${p.id}" ${p.id === item.projectId ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("")}
      </select>
    </div>
    <div class="section-title" style="margin-top:0;">🏷️ Tags</div>
    <div id="kept-tags-editor" style="margin-bottom:16px;"></div>
    <div class="section-title">🗒️ Notes</div>
    <div id="detail-notes" style="margin-bottom:16px;"></div>
    <div class="section-title">🔗 Lié</div>
    <div class="card" id="detail-links" style="margin-bottom:8px;"></div>
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <button id="link-existing-btn" class="btn btn-secondary btn-sm">🔗 Lier une fiche</button>
      <button id="create-linked-btn" class="btn btn-secondary btn-sm">+ Créer et lier</button>
    </div>
  `;

  const projectSelectEl = body.querySelector("#kept-project");
  attachProjectQuickCreate(projectSelectEl);
  projectSelectEl.addEventListener("change", async () => {
    if (projectSelectEl.value === "__create__") return; // géré par attachProjectQuickCreate lui-même
    await inboxApi.setKeptProject(item.id, projectSelectEl.value || null);
    item.projectId = projectSelectEl.value || null;
  });

  renderTagsEditor(body.querySelector("#kept-tags-editor"), "Kept", item.id);

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
        // "🔁 Changer de type" (retour de Charles-Henri, vague 40, 09/09/2026) — voir
        // js/components/changeType.js et js/domain/convert.js.
        label: "🔁 Changer de type",
        variant: "secondary",
        closesModal: false,
        onClick: () => {
          closeModal();
          openChangeTypeModal("kept", item, ["task", "followup"], {
            onConverted: () => onClose?.(),
            onCancel: () => openKeptItemDetail(item, { onClose }),
          });
        },
      },
      {
        // Lien de partage (retour de Charles-Henri, vague 23) — voir js/components/copyLink.js.
        label: "🔗 Copier le lien",
        variant: "secondary",
        closesModal: false,
        onClick: () => copyEntityLink("#/inbox", "Kept", item.id),
      },
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

// Même définition que js/services/shortcuts.js#isEditableTarget (non exportée là-bas) —
// dupliquée ici plutôt que remontée en commun pour un helper de 4 lignes sans état partagé.
function isEditableTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}
