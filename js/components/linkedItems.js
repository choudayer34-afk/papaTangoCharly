// Le "fil conducteur" — partie affichage. Rend une section "🔗 Lié" réutilisable par les 7
// fiches (Tâche, Projet, Personne, Suivi, Ressource, Réunion, Décision), plus deux actions :
// lier une fiche déjà existante, ou en créer une nouvelle directement liée ("créer à la
// volée" — le geste que Charles-Henri décrivait). Chaque résultat rouvre la VRAIE fiche
// (même modale que si on l'avait trouvée depuis son propre écran) plutôt qu'une vue dupliquée
// — même principe que components/search.js.

import { openModal, closeModal } from "./modal.js";
import { showToast } from "./toast.js";
import * as linksApi from "../domain/links.js";
import * as tasksApi from "../domain/tasks.js";
import * as projectsApi from "../domain/projects.js";
import * as peopleApi from "../domain/people.js";
import * as followUpsApi from "../domain/followups.js";
import * as resourcesApi from "../domain/resources.js";
import * as meetingsApi from "../domain/meetings.js";
import * as decisionsApi from "../domain/decisions.js";
import * as inboxApi from "../domain/inbox.js";
import { openTaskDetail, openCreateTaskModal } from "../views/kanban.js";
import { openProjectDetail, openCreateProjectModal } from "../views/projects.js";
import { openPersonDetail, openEditFollowUpModal, openCreateFollowUpModal } from "../views/people.js";
import { openResourceDetail, openCreateResourceModal } from "../views/resources.js";
import { openRecentDetail, openCreateMeetingModal, openCreateDecisionModal } from "../views/dashboard.js";
import { openKeptItemDetail } from "../views/inbox.js";

/** Les 7 types liables. Personne n'apparaît pas dans "+ Créer et lier" (rarement une fiche
 *  qu'on crée depuis un autre sujet) mais reste liable à une fiche existante — même chose pour
 *  une Information/Idée (§ correction du 31/08/2026, retour de Charles-Henri : "une tâche liée
 *  à une information n'est pas visible") : elle se crée uniquement par qualification depuis
 *  l'Inbox, jamais depuis "+ Créer et lier", mais doit rester liable à une fiche existante et
 *  se résoudre correctement quand une autre fiche pointe vers elle (voir resolveRef/allRefs
 *  plus bas, et openKeptItemDetail dans js/views/inbox.js pour sa propre section "🔗 Lié"). */
export const ENTITY_KINDS = [
  { type: "Task", label: "Tâche", emoji: "✅" },
  { type: "Project", label: "Projet", emoji: "📦" },
  { type: "FollowUp", label: "Suivi", emoji: "👀" },
  { type: "Resource", label: "Ressource", emoji: "📎" },
  { type: "Meeting", label: "Réunion", emoji: "🗓️" },
  { type: "Decision", label: "Décision", emoji: "🗳️" },
];

export async function fetchBundle() {
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
  return { tasks, projects, people, followUps, resources, meetings, decisions, keptItems };
}

/** Résout une référence {type, id} en { emoji, title, onOpen }, ou null si l'élément visé a
 *  été supprimé depuis (le lien reste alors affiché mais déliable, jamais une erreur). */
export function resolveRef(bundle, ref) {
  switch (ref.type) {
    case "Task": {
      const t = bundle.tasks.find((x) => x.id === ref.id);
      return t && { emoji: "✅", title: t.title, onOpen: () => openTaskDetail(t, bundle.projects) };
    }
    case "Project": {
      const p = bundle.projects.find((x) => x.id === ref.id);
      if (!p) return null;
      const projectTasks = bundle.tasks.filter((t) => t.projectId === p.id);
      return { emoji: "📦", title: p.name, onOpen: () => openProjectDetail(p, projectTasks) };
    }
    case "Person": {
      const person = bundle.people.find((x) => x.id === ref.id);
      return (
        person && {
          emoji: person.type === "manager" ? "👔" : "👤",
          title: person.name,
          onOpen: () => openPersonDetail(person, bundle.followUps),
        }
      );
    }
    case "FollowUp": {
      const f = bundle.followUps.find((x) => x.id === ref.id);
      return f && { emoji: "👀", title: f.title, onOpen: () => openEditFollowUpModal(f) };
    }
    case "Resource": {
      const r = bundle.resources.find((x) => x.id === ref.id);
      return r && { emoji: "📎", title: r.title, onOpen: () => openResourceDetail(r, bundle.projects, bundle.tasks) };
    }
    case "Meeting": {
      const m = bundle.meetings.find((x) => x.id === ref.id);
      return (
        m && {
          emoji: "🗓️",
          title: m.title,
          onOpen: () => openRecentDetail({ kind: "meeting", emoji: "🗓️", data: m }, bundle.projects),
        }
      );
    }
    case "Decision": {
      const d = bundle.decisions.find((x) => x.id === ref.id);
      return (
        d && {
          emoji: "🗳️",
          title: d.title,
          onOpen: () => openRecentDetail({ kind: "decision", emoji: "🗳️", data: d }, bundle.projects),
        }
      );
    }
    case "Kept": {
      const k = (bundle.keptItems || []).find((x) => x.id === ref.id);
      // Résolu à null si l'Information a été auto-archivée depuis (§ balayage 15 jours,
      // js/domain/inbox.js) — même traitement que tout autre élément disparu : le lien reste
      // affiché comme "Élément supprimé" plutôt que de planter, jamais une perte silencieuse.
      return (
        k && {
          emoji: k.keptAsType === "idea" ? "💡" : "🧠",
          title: k.rawContent,
          onOpen: () => openKeptItemDetail(k),
        }
      );
    }
    default:
      return null;
  }
}

function allRefs(bundle) {
  return [
    ...bundle.tasks.map((t) => ({ type: "Task", id: t.id })),
    ...bundle.projects.map((p) => ({ type: "Project", id: p.id })),
    ...bundle.people.map((p) => ({ type: "Person", id: p.id })),
    ...bundle.followUps.map((f) => ({ type: "FollowUp", id: f.id })),
    ...bundle.resources.map((r) => ({ type: "Resource", id: r.id })),
    ...bundle.meetings.map((m) => ({ type: "Meeting", id: m.id })),
    ...bundle.decisions.map((d) => ({ type: "Decision", id: d.id })),
    ...(bundle.keptItems || []).map((k) => ({ type: "Kept", id: k.id })),
  ];
}

/** Rend la section "🔗 Lié" dans `container` pour la fiche `ref` = {type, id}. */
export async function renderLinkedSection(container, ref) {
  const [bundle, allLinks] = await Promise.all([fetchBundle(), linksApi.listAll()]);
  const mine = linksApi.linksFor(allLinks, ref.type, ref.id);

  if (!mine.length) {
    container.innerHTML = `<div class="empty-state" style="padding:16px;">Rien de lié pour l'instant.</div>`;
    return;
  }

  container.innerHTML = "";
  for (const { link, other } of mine) {
    const resolved = resolveRef(bundle, other);
    const row = document.createElement("div");
    row.className = "item-row";
    if (resolved) {
      row.style.cursor = "pointer";
      row.innerHTML = `<div class="item-main"><div class="item-title">${resolved.emoji} ${escapeHtml(resolved.title)}</div></div>`;
      row.addEventListener("click", () => resolved.onOpen());
    } else {
      row.innerHTML = `<div class="item-main"><div class="item-title" style="color:var(--color-text-muted);">Élément supprimé</div></div>`;
    }
    const unlinkBtn = document.createElement("button");
    unlinkBtn.type = "button";
    unlinkBtn.className = "btn btn-ghost btn-sm";
    unlinkBtn.textContent = "Délier";
    unlinkBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await linksApi.removeLink(link);
      row.remove();
      if (!container.children.length) {
        container.innerHTML = `<div class="empty-state" style="padding:16px;">Rien de lié pour l'instant.</div>`;
      }
    });
    row.appendChild(unlinkBtn);
    container.appendChild(row);
  }
}

/** "🔗 Lier une fiche" : cherche parmi toutes les fiches existantes (tous types), exclut la
 *  fiche courante elle-même. */
export function openLinkPickerModal(ref, currentLabel, { onLinked, onCancel } = {}) {
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <input id="link-picker-input" type="text" placeholder="Chercher une fiche à lier..." />
    </div>
    <div id="link-picker-results"></div>
  `;
  const resultsEl = body.querySelector("#link-picker-results");
  const inputEl = body.querySelector("#link-picker-input");

  let bundle = null;
  let candidates = [];

  function render(query) {
    if (!bundle) {
      resultsEl.innerHTML = `<div class="empty-state" style="padding:16px;">Chargement...</div>`;
      return;
    }
    const q = query.trim().toLowerCase();
    const filtered = candidates.filter(({ resolved }) => !q || resolved.title.toLowerCase().includes(q));

    if (!filtered.length) {
      resultsEl.innerHTML = `<div class="empty-state" style="padding:16px;">${q ? "Rien ne correspond." : "Aucune autre fiche pour l'instant."}</div>`;
      return;
    }
    resultsEl.innerHTML = "";
    const card = document.createElement("div");
    card.className = "card";
    for (const { ref: r, resolved } of filtered.slice(0, 60)) {
      const row = document.createElement("div");
      row.className = "item-row";
      row.style.cursor = "pointer";
      row.innerHTML = `<div class="item-main"><div class="item-title">${resolved.emoji} ${escapeHtml(resolved.title)}</div></div>`;
      row.addEventListener("click", async () => {
        await linksApi.createLink(
          { type: ref.type, id: ref.id, label: currentLabel },
          { type: r.type, id: r.id, label: resolved.title }
        );
        closeModal();
        showToast("Lien créé");
        onLinked?.();
      });
      card.appendChild(row);
    }
    resultsEl.appendChild(card);
  }

  render("");
  fetchBundle().then((b) => {
    bundle = b;
    candidates = allRefs(b)
      .filter((r) => !(r.type === ref.type && r.id === ref.id))
      .map((r) => ({ ref: r, resolved: resolveRef(b, r) }))
      .filter(({ resolved }) => resolved);
    render(inputEl.value);
  });

  inputEl.addEventListener("input", () => render(inputEl.value));

  openModal({
    title: "🔗 Lier une fiche",
    body,
    actions: [{ label: "Annuler", variant: "ghost", onClick: () => onCancel?.() }],
  });
  setTimeout(() => inputEl.focus(), 30);
}

/** "+ Créer et lier" : choisir un type, remplir le petit formulaire habituel de ce type, et
 *  le lien est posé automatiquement dès la création — le geste "créer à la volée sans perdre
 *  le contexte" décrit par Charles-Henri. */
export function openCreateAndLinkModal(ref, currentLabel, { onLinked, onCancel } = {}) {
  const body = document.createElement("div");
  const grid = document.createElement("div");
  grid.className = "choice-grid";
  for (const kind of ENTITY_KINDS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice-btn";
    btn.innerHTML = `<span class="emoji">${kind.emoji}</span> ${kind.label}`;
    btn.addEventListener("click", () => {
      closeModal();
      openCreateFormFor(kind.type, ref, currentLabel, { onLinked, onCancel });
    });
    grid.appendChild(btn);
  }
  body.appendChild(grid);

  openModal({
    title: "Créer et lier",
    body,
    actions: [{ label: "Annuler", variant: "ghost", onClick: () => onCancel?.() }],
  });
}

/**
 * Comme openCreateAndLinkModal, mais saute directement le choix de type — utilisé quand le
 * type pertinent est déjà connu (§ suggestions de prochaine étape du 31/08/2026, voir
 * js/components/suggestNextStep.js : après avoir coché "Créer les actions" sur un canevas, ou
 * après avoir enregistré une Décision, inutile de repasser par la grille des 7 types).
 *
 * `defaults` (01/09/2026, voir js/components/meetingLauncher.js) préremplit le formulaire de
 * création — ex. un titre déjà composé — sans changer le comportement par défaut (`{}` ne
 * préremplit rien, comme avant).
 */
export function openCreateAndLinkDirect(type, ref, currentLabel, { onLinked, onCancel, defaults } = {}) {
  openCreateFormFor(type, ref, currentLabel, { onLinked, onCancel, defaults });
}

function openCreateFormFor(type, ref, currentLabel, { onLinked, onCancel, defaults = {} }) {
  const link = async (created, titleField) => {
    await linksApi.createLink(
      { type: ref.type, id: ref.id, label: currentLabel },
      { type, id: created.id, label: created[titleField] }
    );
    onLinked?.();
  };

  const prefill = {
    ...defaults,
    onCancel: () => onCancel?.(),
  };

  switch (type) {
    case "Task":
      openCreateTaskModal({ ...prefill, onCreated: (t) => link(t, "title") });
      break;
    case "Project":
      openCreateProjectModal({ ...prefill, onCreated: (p) => link(p, "name") });
      break;
    case "FollowUp":
      openCreateFollowUpModal({ ...prefill, onCreated: (f) => link(f, "title") });
      break;
    case "Resource":
      openCreateResourceModal({ ...prefill, onCreated: (r) => link(r, "title") });
      break;
    case "Meeting":
      openCreateMeetingModal({ ...prefill, onCreated: (m) => link(m, "title") });
      break;
    case "Decision":
      openCreateDecisionModal({ ...prefill, onCreated: (d) => link(d, "title") });
      break;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
