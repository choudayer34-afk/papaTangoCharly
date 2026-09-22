// Le "fil conducteur" — partie affichage. Rend une section "🔗 Lié" réutilisable par les 7
// fiches (Tâche, Projet, Personne, Suivi, Ressource, Réunion, Décision), plus deux actions :
// lier une fiche déjà existante, ou en créer une nouvelle directement liée ("créer à la
// volée" — le geste que Charles-Henri décrivait). Chaque résultat rouvre la VRAIE fiche
// (même modale que si on l'avait trouvée depuis son propre écran) plutôt qu'une vue dupliquée
// — même principe que components/search.js.

import { openModal, closeModal, guardClick } from "./modal.js";
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
import * as objectivesApi from "../domain/objectives.js";
import { openTaskDetail, openCreateTaskModal } from "../views/kanban.js";
import { openProjectDetail, openCreateProjectModal } from "../views/projects.js";
import { openPersonDetail, openEditFollowUpModal, openCreateFollowUpModal, openObjectiveDetail } from "../views/people.js";
import { openResourceDetail, openCreateResourceModal } from "../views/resources.js";
import { openRecentDetail, openCreateMeetingModal, openCreateDecisionModal } from "../views/dashboard.js";
import { openKeptItemDetail, openInboxSourceDetail } from "../views/inbox.js";

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
  const [tasks, projects, people, followUps, resources, meetings, decisions, keptItems, objectives] = await Promise.all([
    tasksApi.listAll(),
    projectsApi.listAll(),
    peopleApi.listAll(),
    followUpsApi.listAll(),
    resourcesApi.listAll(),
    meetingsApi.listAll(),
    decisionsApi.listAll(),
    inboxApi.listKept(),
    objectivesApi.listAll(),
  ]);
  return { tasks, projects, people, followUps, resources, meetings, decisions, keptItems, objectives };
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
      if (!f) return null;
      // Nom du collaborateur préfixé au titre (retour de Charles-Henri, 07/09/2026 : "je vois
      // pas à qui est attribué le suivi [...] il me faudrait le nom du collaborateur [...] à
      // tous les niveaux où ça apparaît") — même format "Nom — Titre" déjà utilisé pour un Suivi
      // partout ailleurs dans l'app (dashboard.js, weeklyReview.js, search.js). `resolveRef` est
      // LE point de passage unique pour afficher une référence {type, id} — corriger ici suffit
      // à couvrir toutes les sections "🔗 Lié" (7 fiches), le sélecteur "🔗 Lier une fiche" et
      // "🔄 Reprendre où j'en étais" (Dashboard) en un seul endroit, sans toucher à chacun.
      const person = bundle.people.find((x) => x.id === f.personId);
      return { emoji: "👀", title: person ? `${person.name} — ${f.title}` : f.title, onOpen: () => openEditFollowUpModal(f) };
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
    case "Objective": {
      // Un Objectif se résout comme les autres — sauf qu'ouvrir sa fiche demande aussi la
      // personne propriétaire (retour de Charles-Henri, 06/09/2026 : "pouvoir y rattacher
      // d'autres projets ou faire un suivi" — voir js/views/people.js#openObjectiveDetail).
      const o = bundle.objectives.find((x) => x.id === ref.id);
      if (!o) return null;
      const owner = bundle.people.find((p) => p.id === o.personId);
      return {
        emoji: o.status === "done" ? "✅" : "🎯",
        title: o.title,
        onOpen: () => openObjectiveDetail(o, owner, {}),
      };
    }
    case "Kept": {
      const k = (bundle.keptItems || []).find((x) => x.id === ref.id);
      // Résolu à null si l'Information a été auto-archivée depuis (§ balayage 15 jours,
      // js/domain/inbox.js) — même traitement que tout autre élément disparu : le lien reste
      // affiché comme "Élément supprimé" plutôt que de planter, jamais une perte silencieuse.
      return (
        k && {
          // TODO-021 (LOT 9) : libellé/emoji "Information" unique, "idea" fusionné (voir
          // js/views/inbox.js) — `k.keptAsType` peut encore valoir "idea" pour un élément
          // ancien, l'affichage ne le distingue plus.
          emoji: "🧠",
          title: k.rawContent,
          onOpen: () => openKeptItemDetail(k),
        }
      );
    }
    // Pas de cas "InboxSource" ici, volontairement (TODO-008 point 1, LOT 6) : ce type n'est
    // résolu que par resolveRefDirect() plus bas, seule consommatrice des liens qu'il représente
    // (renderLinkedSection, affichage de "🔗 Lié"). resolveRef()/allRefs() ci-dessus ne servent
    // qu'à "🔗 Lier une fiche"/"+ Créer et lier" — un InboxSource n'est jamais choisi
    // manuellement par ces deux chemins, uniquement posé automatiquement par
    // js/domain/inbox.js#qualify(), donc jamais nécessaire à énumérer ici. L'ajouter obligerait
    // en plus `fetchBundle()` à charger TOUS les InboxItems (pas seulement `keptItems`), à
    // l'inverse de l'optimisation faite par TODO-009A.
    default:
      return null;
  }
}

// BUG corrigé (21/09/2026, audit performance, TODO-009A) : `renderLinkedSection` ci-dessous
// appelait `fetchBundle()` (9 `getDocs()`, une collection ENTIÈRE chacune) à CHAQUE ouverture
// d'une fiche portant une section "🔗 Lié" — soit à chaque fois qu'une Tâche/Projet/Personne/
// Suivi/Ressource/Réunion/Décision est ouverte, un des gestes les plus fréquents de l'app — pour
// n'en tirer au final que les quelques éléments RÉELLEMENT liés à CETTE fiche (`mine`, souvent 0
// à 5 liens). `resolveRefDirect()` lit directement le document demandé (`storage.get`, via les
// nouveaux accesseurs `getTask`/`getFollowUp`/`getObjective`/`getInboxItem` — les autres
// existaient déjà) plutôt que de filtrer un bundle déjà chargé en entier.
//
// Les données auxiliaires que `resolveRef()` allait chercher dans le bundle pour CONSTRUIRE le
// bouton d'ouverture (ex. les tâches d'un Projet pour `openProjectDetail`, les Suivis d'une
// Personne pour `openPersonDetail`) ne sont, elles, nécessaires qu'AU CLIC — jamais pour le
// simple affichage du titre dans la liste "🔗 Lié". `onOpen` devient donc asynchrone : il ne va
// chercher cette donnée complémentaire (au plus 1 à 2 collections, jamais les 9) qu'au moment où
// l'utilisateur clique réellement sur ce lien précis, l'immense majorité des liens affichés
// n'étant jamais cliqués dans une même session.
//
// `resolveRef(bundle, ref)` ci-dessus reste INCHANGÉE et continue de servir
// `openLinkPickerModal`/`openCreateAndLinkModal` : ces deux-là ont un besoin structurellement
// différent (chercher/lister TOUTES les fiches existantes pour en choisir une à lier), pour
// lequel charger l'ensemble reste inévitable — seul `renderLinkedSection`, qui résout des
// références déjà connues une par une, tire parti d'une lecture ciblée.
async function resolveRefDirect(ref) {
  switch (ref.type) {
    case "Task": {
      const t = await tasksApi.getTask(ref.id);
      return t && { emoji: "✅", title: t.title, onOpen: async () => openTaskDetail(t, await projectsApi.listAll()) };
    }
    case "Project": {
      const p = await projectsApi.getProject(ref.id);
      if (!p) return null;
      return {
        emoji: "📦",
        title: p.name,
        onOpen: async () => {
          const allTasks = await tasksApi.listAll();
          openProjectDetail(p, allTasks.filter((t) => t.projectId === p.id));
        },
      };
    }
    case "Person": {
      const person = await peopleApi.getPerson(ref.id);
      return (
        person && {
          emoji: person.type === "manager" ? "👔" : "👤",
          title: person.name,
          onOpen: async () => openPersonDetail(person, await followUpsApi.listAll()),
        }
      );
    }
    case "FollowUp": {
      const f = await followUpsApi.getFollowUp(ref.id);
      if (!f) return null;
      // Même format "Nom — Titre" que resolveRef() ci-dessus — voir son commentaire.
      const person = f.personId ? await peopleApi.getPerson(f.personId) : null;
      return { emoji: "👀", title: person ? `${person.name} — ${f.title}` : f.title, onOpen: () => openEditFollowUpModal(f) };
    }
    case "Resource": {
      const r = await resourcesApi.getResource(ref.id);
      if (!r) return null;
      return {
        emoji: "📎",
        title: r.title,
        onOpen: async () => {
          const [projects, tasks] = await Promise.all([projectsApi.listAll(), tasksApi.listAll()]);
          openResourceDetail(r, projects, tasks);
        },
      };
    }
    case "Meeting": {
      const m = await meetingsApi.getMeeting(ref.id);
      return (
        m && {
          emoji: "🗓️",
          title: m.title,
          onOpen: async () => openRecentDetail({ kind: "meeting", emoji: "🗓️", data: m }, await projectsApi.listAll()),
        }
      );
    }
    case "Decision": {
      const d = await decisionsApi.getDecision(ref.id);
      return (
        d && {
          emoji: "🗳️",
          title: d.title,
          onOpen: async () => openRecentDetail({ kind: "decision", emoji: "🗳️", data: d }, await projectsApi.listAll()),
        }
      );
    }
    case "Objective": {
      const o = await objectivesApi.getObjective(ref.id);
      if (!o) return null;
      return {
        emoji: o.status === "done" ? "✅" : "🎯",
        title: o.title,
        onOpen: async () => openObjectiveDetail(o, o.personId ? await peopleApi.getPerson(o.personId) : null, {}),
      };
    }
    case "Kept": {
      const k = await inboxApi.getInboxItem(ref.id);
      // Même filtre que listKept() (voir fetchBundle() ci-dessus) : un lien vers une
      // Information/Idée auto-archivée depuis (§ balayage 15 jours) reste résolu à null ici,
      // comme avant ce correctif — comportement inchangé, pas une amélioration au passage.
      // INCHANGÉ par TODO-008/LOT 6 (arbitrage de Charles-Henri, 21/09/2026) : ce filtre sur
      // `status === "kept"` reste tel quel, sémantique et cas d'usage propres à "Kept" — voir le
      // nouveau cas "InboxSource" ci-dessous, ajouté SÉPARÉMENT pour un besoin différent.
      return (
        k &&
        k.status === "kept" && {
          // TODO-021 (LOT 9) : voir le même commentaire ci-dessus, cas "Kept" de fetchBundle().
          emoji: "🧠",
          title: k.rawContent,
          onOpen: () => openKeptItemDetail(k),
        }
      );
    }
    // TODO-008 point 1 (LOT 6, arbitrage de Charles-Henri, 21/09/2026) — type de référence dédié
    // pour le lien "entité créée → InboxItem source" posé par js/domain/inbox.js#qualify()
    // (linkEntityToInboxSource). Résout directement l'InboxItem par son id, SANS exiger
    // `status === "kept"` (contrairement au cas "Kept" ci-dessus, volontairement inchangé) :
    // les six issues concernées (Task/FollowUp/Project/Meeting/Decision/Resource) posent
    // `status: "processed"`, jamais "kept" — ce nouveau cas est donc le seul chemin de
    // résolution pour ces liens, sans toucher au comportement existant du type "Kept" ni au
    // balayage d'auto-archivage à 15 jours (qui ne concerne que les Informations/Idées). Ouvre
    // une fiche dédiée en lecture seule (openInboxSourceDetail, js/views/inbox.js) plutôt que
    // openKeptItemDetail — voir son commentaire pour pourquoi les deux doivent rester distinctes.
    case "InboxSource": {
      const source = await inboxApi.getInboxItem(ref.id);
      return (
        source && {
          emoji: "📥",
          title: source.rawContent,
          onOpen: () => openInboxSourceDetail(source),
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
    ...bundle.objectives.map((o) => ({ type: "Objective", id: o.id })),
  ];
}

/** Rend la section "🔗 Lié" dans `container` pour la fiche `ref` = {type, id}. */
export async function renderLinkedSection(container, ref) {
  // TODO-009A (LOT 4A) : `resolveRefDirect` (lecture ciblée par référence) plutôt que
  // `fetchBundle()` + `resolveRef()` (9 collections entières) — voir le commentaire de
  // `resolveRefDirect` ci-dessus pour le détail. `linksApi.listAll()` reste inchangé : la
  // collection `links` elle-même est hors périmètre de ce TODO.
  const allLinks = await linksApi.listAll();
  const mine = linksApi.linksFor(allLinks, ref.type, ref.id);

  if (!mine.length) {
    container.innerHTML = `<div class="empty-state" style="padding:16px;">Rien de lié pour l'instant.</div>`;
    return;
  }

  const resolvedEntries = await Promise.all(
    mine.map(async ({ link, other }) => ({ link, other, resolved: await resolveRefDirect(other) }))
  );

  container.innerHTML = "";
  for (const { link, resolved } of resolvedEntries) {
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
      // BUG corrigé (15/09/2026, audit "anomalies d'usage ou d'enregistrement en silence") :
      // `linksApi.createLink` n'a aucune vérification d'existence, et rien n'empêchait un
      // double-clic sur la même ligne avant la fermeture de la modale — deux liens identiques
      // créés en silence, visibles en double des deux côtés du "🔗 Lié".
      row.addEventListener(
        "click",
        guardClick(row, async () => {
          await linksApi.createLink(
            { type: ref.type, id: ref.id, label: currentLabel },
            { type: r.type, id: r.id, label: resolved.title }
          );
          closeModal();
          showToast("Lien créé");
          onLinked?.();
        })
      );
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

  // BUG corrigé (15/09/2026, audit performance) : aucun anti-rebond sur ce champ — chaque
  // frappe reconstruisait toute la liste de résultats. Voir js/views/kanban.js, même correctif.
  let linkSearchDebounce = null;
  inputEl.addEventListener("input", () => {
    clearTimeout(linkSearchDebounce);
    linkSearchDebounce = setTimeout(() => render(inputEl.value), 150);
  });

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
      // TODO-014 (LOT 7, COMP-UX-014, 21/09/2026) : deux mécanismes de liaison Ressource
      // coexistent avec des résultats différents — "+ Nouvelle ressource"/"🔗 Lier existante"
      // dans le bloc dédié "📎 Ressources" d'une fiche Tâche/Projet (js/views/kanban.js,
      // js/views/projects.js) peuplent taskIds/projectIds sur la Ressource, jamais de lien
      // générique ; ce chemin universel "+ Créer et lier" crée un lien générique (ci-dessus),
      // jamais de taskIds/projectIds. Une première version transmettait aussi l'id d'origine ici
      // pour peupler taskIds/projectIds en plus du lien générique, mais cela faisait apparaître
      // la Ressource dans LES DEUX sections à la fois ("📎 Ressources" ET "🔗 Lié") — un doublon
      // visuel jugé indésirable par Charles-Henri (21/09/2026). Décision retenue : ce chemin ne
      // pose QUE le lien générique, comme avant — aucune transmission de taskId/projectId ici.
      // L'incohérence entre les deux mécanismes n'est donc pas éliminée (une Ressource créée par
      // l'un des deux chemins n'apparaît toujours que dans une seule des deux sections), mais
      // c'est le résultat explicitement choisi plutôt que le doublon.
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
