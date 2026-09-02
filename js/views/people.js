// Vue Équipe — §31 (liste) et §32 (fiche collaborateur simplifiée).

import * as peopleApi from "../domain/people.js";
import * as followUpsApi from "../domain/followups.js";
import * as projectsApi from "../domain/projects.js";
import * as historyApi from "../domain/history.js";
import * as objectivesApi from "../domain/objectives.js";
import * as preferencesApi from "../domain/preferences.js";
import { openModal, closeModal, confirmDelete } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { showHintOnce } from "../components/hint.js";
import { renderHistoryTimeline } from "../components/historyTimeline.js";
import * as linkedItemsApi from "../components/linkedItems.js";
import { renderNotesBlock } from "../components/notesBlock.js";
import { renderChecklist } from "../components/checklist.js";
import { buildMeetingTitle, copyMeetingTitle, launchMeetingFromEntity } from "../components/meetingLauncher.js";
import { renderManagerSection } from "./management.js";
import { renderInfoTip } from "../components/infoTip.js";
import { renderShortcutAssignButton } from "../services/shortcuts.js";
import { exportFollowUpOverview } from "../components/overviewExport.js";

/** Suivis triés par date d'ajout décroissante (retour de Charles-Henri : "ordonner par date
 *  décroissante le visu du suivi") — explicitement par `createdAt` plutôt que l'ordre déjà
 *  trié par `updatedAt` que renvoie le storage, pour ne pas faire sauter un suivi en tête de
 *  liste juste parce qu'on vient de le modifier. */
/** Tri alphabétique pour les listes déroulantes "Projet" des formulaires de Suivi (retour de
 *  Charles-Henri, vague 21) — distinct du tri d'affichage de l'onglet Projets lui-même
 *  (avancement / manuel, voir preferencesApi.projectSort), qui reste inchangé. */
function sortProjectsByName(projects) {
  return [...projects].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

function sortByCreatedDesc(list) {
  return [...list].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/**
 * Vue Équipe + Management fusionnés en un seul onglet (retour de Charles-Henri, 02/09/2026 :
 * "traiter les onglets comme des filtres d'un même flux" — Management était déjà une simple
 * recomposition des mêmes Personnes/Suivis qu'Équipe, donc la fusion la plus naturelle parmi
 * les onglets). Le filtre "👥 Tous" / "👔 Mon manager" bascule entre la liste habituelle et le
 * tableau de bord manager (`renderManagerSection`, js/views/management.js) — rien n'a
 * disparu, juste regroupé sous un seul onglet plutôt que deux.
 */
export function renderPeople(container) {
  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Équipe</h1>
        <div class="subtitle" id="people-subtitle">—</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span id="people-status-info"></span>
        <button id="new-person-btn" class="btn btn-primary btn-sm">+ Personne</button>
      </div>
    </div>
    <div class="view">
      <div class="chip-row" id="people-mode-toggle">
        <button type="button" class="chip" data-mode="all">👥 Tous</button>
        <button type="button" class="chip" data-mode="manager">👔 Mon manager</button>
      </div>
      <div id="people-list"></div>
    </div>
  `;

  const listEl = container.querySelector("#people-list");
  const subtitleEl = container.querySelector("#people-subtitle");
  const modeToggleEl = container.querySelector("#people-mode-toggle");
  container.querySelector("#new-person-btn").addEventListener("click", openCreatePersonModal);
  renderInfoTip(container.querySelector("#people-status-info"), followUpsApi.STATUS_INFO_HTML);

  let people = [];
  let followUps = [];
  let mode = "all";

  function updateModeToggle() {
    modeToggleEl.querySelectorAll("[data-mode]").forEach((chip) => chip.classList.toggle("active", chip.dataset.mode === mode));
  }
  modeToggleEl.querySelectorAll("[data-mode]").forEach((chip) => {
    chip.addEventListener("click", () => {
      mode = chip.dataset.mode;
      updateModeToggle();
      render();
    });
  });
  updateModeToggle();

  function render() {
    if (mode === "manager") {
      const managers = people.filter((p) => p.type === "manager");
      subtitleEl.textContent = managers.length
        ? `${managers.length} manager${managers.length > 1 ? "s" : ""}`
        : "Pas encore de manager renseigné";
      renderManagerSection(listEl, people, followUps);
      return;
    }

    subtitleEl.textContent = people.length ? `${people.length} personne(s)` : "Personne pour l'instant";

    if (!people.length) {
      listEl.innerHTML = `
        <div class="empty-state">
          <span class="emoji">👥</span>
          Ajoute les personnes que tu suis avec le bouton « + Personne ».
        </div>`;
      return;
    }

    listEl.innerHTML = "";
    const card = document.createElement("div");
    card.className = "card";
    // Ordre manuel (retour de Charles-Henri, vague 20 : "je veux aussi pouvoir réordonner les
    // personnes au sein de mon équipe") — même mécanisme que l'onglet Projets (js/domain/
    // people.js#sortPeople/reorderPeople, calqué sur projectsApi.sortProjects/reorderProjects) :
    // toute la ligne est glissable (comme une carte Projet), pas besoin d'une poignée dédiée,
    // rien d'éditable en ligne ici qui pourrait entrer en conflit avec le glisser-déposer.
    const orderedPeople = peopleApi.sortPeople(people);
    const orderedIds = orderedPeople.map((p) => p.id);
    for (const person of orderedPeople) {
      const own = followUps.filter((f) => f.personId === person.id);
      const waiting = own.filter((f) => f.status === "waiting").length;
      const relaunched = own.filter((f) => f.status === "relaunched").length;
      const late = own.filter(followUpsApi.isControlDue).length;

      const row = document.createElement("div");
      row.className = "item-row";
      row.style.cursor = "grab";
      row.draggable = true;
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">⠿ ${person.type === "manager" ? "👔" : "👤"} ${escapeHtml(person.name)}</div>
          <div class="item-meta">
            ${waiting} en attente · ${relaunched} relancé(s)
            ${late ? ` · <span style="color:var(--color-danger);font-weight:600;">${late} à relancer</span>` : ""}
          </div>
        </div>
      `;
      row.addEventListener("click", () => {
        // Un glisser-déposer qui se termine peut déclencher un click parasite juste après —
        // même garde-fou que l'onglet Projets (js/views/projects.js).
        if (row.dataset.justDragged) return;
        openPersonDetail(person, followUps);
      });
      row.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/person-id", person.id);
      });
      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        row.classList.add("drag-over");
      });
      row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
      row.addEventListener("drop", async (e) => {
        e.preventDefault();
        row.classList.remove("drag-over");
        const draggedId = e.dataTransfer.getData("text/person-id");
        if (!draggedId || draggedId === person.id) return;
        const ids = [...orderedIds];
        const from = ids.indexOf(draggedId);
        const to = ids.indexOf(person.id);
        if (from < 0 || to < 0) return;
        ids.splice(to, 0, ids.splice(from, 1)[0]);
        row.dataset.justDragged = "1";
        await peopleApi.reorderPeople(ids);
        setTimeout(() => delete row.dataset.justDragged, 300);
      });
      card.appendChild(row);
    }
    listEl.appendChild(card);
  }

  const unsubPeople = peopleApi.subscribe((items) => {
    people = items;
    render();
  });
  const unsubFollowUps = followUpsApi.subscribe((items) => {
    followUps = items;
    render();
  });

  return function cleanup() {
    unsubPeople();
    unsubFollowUps();
  };
}

/** `prefill.type` préselectionne Collaborateur/Manager — utilisé par le filtre "👔 Mon manager"
 *  d'Équipe (`renderManagerSection`, js/views/management.js) pour "+ Ajouter mon manager"
 *  sans changer de filtre. */
export function openCreatePersonModal(prefill = {}) {
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="person-name">Nom</label>
      <input id="person-name" type="text" placeholder="Ex. Clément" />
    </div>
    <div class="field">
      <label for="person-type">Type</label>
      <select id="person-type">
        <option value="collaborateur" ${prefill.type !== "manager" ? "selected" : ""}>👤 Collaborateur</option>
        <option value="manager" ${prefill.type === "manager" ? "selected" : ""}>👔 Manager</option>
      </select>
    </div>
    <div class="field">
      <label for="person-role">Rôle (optionnel)</label>
      <input id="person-role" type="text" />
    </div>
  `;
  const { bodyEl, close } = openModal({
    title: "Nouvelle personne",
    body,
    actions: [
      { label: "Annuler", variant: "ghost", onClick: () => prefill.onCancel?.() },
      {
        label: "Créer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          const name = bodyEl.querySelector("#person-name").value.trim();
          if (!name) return;
          const person = await peopleApi.createPerson({
            name,
            type: bodyEl.querySelector("#person-type").value,
            role: bodyEl.querySelector("#person-role").value.trim(),
          });
          close();
          showToast("Personne ajoutée");
          prefill.onCreated?.(person);
        },
      },
    ],
  });
}

/**
 * "🧭 Repères managériaux" (retour de Charles-Henri, vague 21) : trois notes libres et non
 * datées, distinctes du Journal de notes (horodaté, un événement à la fois) et de `notes`
 * (contexte général déjà migré vers le Journal, voir migrateLegacyNotes) — ce que Charles-Henri
 * a besoin de RETROUVER sur une personne sans avoir à relire tout le journal : ce qu'elle
 * attend de lui en 1:1 (`expectationsInOneToOne`), ce qu'elle attend de lui comme manager en
 * général (`expectationsAsManager`), et des observations de personnalité (`personalConsideration`).
 * Simple texte libre par champ (pas de sous-structure), replié par défaut dans un `<details>`
 * comme "🕒 Historique" pour ne pas allonger la fiche par défaut.
 */
export async function openPersonDetail(person, allFollowUps) {
  preferencesApi.recordRecentlyViewed("Person", person.id).catch(() => {});
  // Fusion des deux "Notes" (vague 19, audit de simplification) — voir peopleApi.migrateLegacyNotes.
  person = (await peopleApi.migrateLegacyNotes(person.id)) || person;
  const own = sortByCreatedDesc(allFollowUps.filter((f) => f.personId === person.id));
  const active = own.filter((f) => f.status !== "done" && f.direction !== "to_tell");
  const toTell = own.filter((f) => f.status !== "done" && f.direction === "to_tell");
  const done = own.filter((f) => f.status === "done");

  const [allHistory, allObjectives] = await Promise.all([historyApi.listAll(), objectivesApi.listAll()]);
  const objectives = allObjectives.filter((o) => o.personId === person.id);

  // §38 "Où en est Clément ?" : l'historique d'une personne, c'est le sien plus celui de
  // tous ses suivis — même principe que l'agrégation faite côté fiche Projet (§46).
  const trackedKeys = new Set([`Person:${person.id}`, ...own.map((f) => `FollowUp:${f.id}`)]);
  const personHistory = allHistory
    .filter((h) => trackedKeys.has(`${h.entityType}:${h.entityId}`))
    .sort((a, b) => a.date - b.date);

  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="person-detail-name">Nom</label>
      <input id="person-detail-name" type="text" value="${escapeAttr(person.name)}" />
    </div>
    <div class="field">
      <label for="person-detail-type">Type</label>
      <select id="person-detail-type">
        <option value="collaborateur" ${person.type !== "manager" ? "selected" : ""}>👤 Collaborateur</option>
        <option value="manager" ${person.type === "manager" ? "selected" : ""}>👔 Manager</option>
      </select>
    </div>
    <div class="field">
      <label for="person-detail-role">Rôle</label>
      <input id="person-detail-role" type="text" value="${escapeAttr(person.role || "")}" />
    </div>
    <div id="person-shortcut" style="margin-bottom:12px;"></div>
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <button id="prep-btn" class="btn btn-secondary btn-block">🗒️ Préparer mon point</button>
      <button id="eadp-btn" class="btn btn-secondary btn-block">📋 Préparer l'EADP</button>
    </div>
    <div class="section-title" style="margin-top:0;">🎯 Engagements en cours (${active.length})</div>
    <div class="card" id="active-followups" style="margin-bottom:16px;"></div>
    <div class="section-title">📣 À transmettre (${toTell.length})</div>
    <div class="card" id="to-tell-followups" style="margin-bottom:16px;"></div>
    <button id="add-followup-btn" class="btn btn-secondary btn-sm btn-block" style="margin-bottom:16px;">+ Suivi</button>
    <div class="section-title">🟢 Réalisé (${done.length})</div>
    <div class="card" id="done-followups" style="margin-bottom:16px;"></div>
    <div class="section-header-row">
      <div class="section-title">🎯 Objectifs (${objectives.length})</div>
      <button type="button" id="add-objective-btn" class="btn btn-ghost btn-sm">+ Ajouter</button>
    </div>
    <div class="card" id="person-objectives" style="margin-bottom:16px;"></div>
    <div class="section-title">🗒️ Journal de notes</div>
    <div id="detail-notes" style="margin-bottom:16px;"></div>
    <details>
      <summary class="section-title" style="cursor:pointer;">🧭 Repères managériaux</summary>
      <div style="margin-top:8px;margin-bottom:16px;">
        <div class="field">
          <label for="person-o2o">Attente des O2O — ce que ${escapeHtml(person.name)} attend de moi en 1:1</label>
          <textarea id="person-o2o" placeholder="Boulot ou perso, pas forcément récurrent, ce qui va bien / moins bien...">${escapeHtml(person.expectationsInOneToOne || "")}</textarea>
        </div>
        <div class="field">
          <label for="person-manager-expect">Attente manager — ce que ${escapeHtml(person.name)} attend de moi en tant que manager</label>
          <textarea id="person-manager-expect" placeholder="Feedback, direction, orientation, attentes vis-à-vis de son propre travail...">${escapeHtml(person.expectationsAsManager || "")}</textarea>
        </div>
        <div class="field" style="margin-bottom:0;">
          <label for="person-consideration">Considération personnelle</label>
          <textarea id="person-consideration" placeholder="Personnalité, forces, axes d'amélioration...">${escapeHtml(person.personalConsideration || "")}</textarea>
        </div>
      </div>
    </details>
    <details>
      <summary class="section-title" style="cursor:pointer;">🕒 Historique (${personHistory.length})</summary>
      <div class="card" id="person-history" style="margin-top:8px;margin-bottom:16px;"></div>
    </details>
    <div class="section-title">🔗 Lié</div>
    <div class="card" id="detail-links" style="margin-bottom:8px;"></div>
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <button id="link-existing-btn" class="btn btn-secondary btn-sm">🔗 Lier une fiche</button>
      <button id="create-linked-btn" class="btn btn-secondary btn-sm">+ Créer et lier</button>
    </div>
  `;

  // Rouvre la fiche avec des données fraîches — utilisé par toute action menée depuis une
  // modale imbriquée (créer/modifier/supprimer un suivi), plutôt que de laisser la fiche
  // fermée après l'action (bug connu signalé par Charles-Henri : la création d'un suivi
  // refermait la fiche au lieu d'y rester, contrairement au pattern déjà en place pour les
  // ressources liées à un projet/une tâche).
  const reopen = async () => openPersonDetail(person, await followUpsApi.listAll());

  const activeEl = body.querySelector("#active-followups");
  renderFollowUpList(activeEl, active, {
    onOpen: (f) => {
      closeModal();
      openEditFollowUpModal(f, { onDone: reopen });
    },
  });
  const toTellEl = body.querySelector("#to-tell-followups");
  renderFollowUpList(toTellEl, toTell, {
    onOpen: (f) => {
      closeModal();
      openEditFollowUpModal(f, { onDone: reopen });
    },
  });
  const doneEl = body.querySelector("#done-followups");
  renderFollowUpList(doneEl, done, {
    onOpen: (f) => {
      closeModal();
      openEditFollowUpModal(f, { onDone: reopen });
    },
  });
  renderHistoryTimeline(body.querySelector("#person-history"), personHistory);
  renderNotesBlock(body.querySelector("#detail-notes"), person.notesLog || [], {
    onAdd: async (text) => {
      const updated = await peopleApi.addNote(person.id, text);
      person.notesLog = updated;
      return updated;
    },
  });

  const linkRef = { type: "Person", id: person.id };
  linkedItemsApi.renderLinkedSection(body.querySelector("#detail-links"), linkRef);
  body.querySelector("#link-existing-btn").addEventListener("click", () => {
    closeModal();
    linkedItemsApi.openLinkPickerModal(linkRef, person.name, {
      onLinked: () => reopen(),
      onCancel: () => reopen(),
    });
  });
  body.querySelector("#create-linked-btn").addEventListener("click", () => {
    closeModal();
    linkedItemsApi.openCreateAndLinkModal(linkRef, person.name, {
      onLinked: () => reopen(),
      onCancel: () => reopen(),
    });
  });

  body.querySelector("#add-followup-btn").addEventListener("click", () => {
    closeModal();
    openCreateFollowUpModal({ person, onCreated: () => reopen(), onCancel: () => reopen() });
  });
  body.querySelector("#prep-btn").addEventListener("click", () => {
    closeModal();
    openPrepMaskThenPrep(person, { onDone: reopen });
  });
  body.querySelector("#eadp-btn").addEventListener("click", () => {
    closeModal();
    openPrepareEadpModal(person, { onDone: reopen });
  });
  // Raccourci clavier personnalisé (retour de Charles-Henri, vague 20) — voir
  // js/services/shortcuts.js#renderShortcutAssignButton.
  renderShortcutAssignButton(body.querySelector("#person-shortcut"), { type: "Person", id: person.id, label: person.name });

  const objectivesEl = body.querySelector("#person-objectives");
  renderObjectivesList(objectivesEl, objectives, person, reopen);
  body.querySelector("#add-objective-btn").addEventListener("click", () => {
    closeModal();
    openCreateObjectiveModal(person, { onDone: reopen });
  });

  const { bodyEl, close } = openModal({
    title: (person.type === "manager" ? "👔 " : "👤 ") + person.name,
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
            title: "Supprimer cette personne ?",
            message: `« ${person.name} » sera définitivement supprimée. Ses suivis ne sont pas supprimés — ils perdent simplement leur lien vers cette personne.`,
            onConfirm: async () => {
              await peopleApi.removePerson(person.id);
              showToast("Personne supprimée");
            },
            onCancel: () => reopen(),
          });
        },
      },
      {
        label: "Enregistrer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          const name = bodyEl.querySelector("#person-detail-name").value.trim();
          if (!name) return;
          await peopleApi.updatePerson(person.id, {
            name,
            type: bodyEl.querySelector("#person-detail-type").value,
            role: bodyEl.querySelector("#person-detail-role").value.trim(),
            expectationsInOneToOne: bodyEl.querySelector("#person-o2o").value.trim(),
            expectationsAsManager: bodyEl.querySelector("#person-manager-expect").value.trim(),
            personalConsideration: bodyEl.querySelector("#person-consideration").value.trim(),
          });
          close();
          showToast("Personne mise à jour");
        },
      },
    ],
  });
}

/** Date la plus proche entre échéance et contrôle (retour de Charles-Henri, vague 21 : "que les
 *  éléments se trient par date d'échéance ou date de contrôle plus petite") — un suivi "à
 *  transmettre" n'a pas de dueDate, un suivi ordinaire a les deux parfois (dueDate = échéance
 *  de la personne, controlDate = quand je vérifie, souvent plus tôt) : on veut la plus urgente
 *  des deux, jamais une seule au détriment de l'autre. Sans aucune date, trié en dernier. */
function soonestDate(f) {
  const times = [f.controlDate, f.dueDate].filter(Boolean).map((d) => new Date(d).getTime());
  return times.length ? Math.min(...times) : Infinity;
}

/**
 * "Suivi managérial" : préparer un point collaborateur en un coup d'œil, sans avoir à
 * relire manuellement chaque engagement — ce que Charles-Henri fait avant chaque 1:1.
 * Purement une lecture recomposée des mêmes suivis déjà présents sur la fiche (retard de
 * contrôle en premier, puis le reste par date de contrôle/échéance, puis les derniers
 * terminés) : aucune nouvelle donnée, aucun nouveau champ sur le Suivi lui-même.
 *
 * "🎯 À aborder" est en plus regroupé par projet (fil rouge par sujet plutôt que des lignes
 * isolées — retour de Charles-Henri du 02/09/2026 : "les deux", projet ET date). Le
 * regroupement est volontairement limité à cette seule section : c'est précisément celle
 * visée par sa question, et "🔴 En retard" / "📣 À transmettre" restent des listes courtes où
 * un fil rouge par projet ajouterait plus de bruit que de lisibilité.
 *
 * `coveredIds` (retour de Charles-Henri, vague 21 : "je dois identifier lors de la préparation
 * du point que je suis passé sur le sujet quand on les passe un à un") — un `Set` d'ids tenu le
 * temps d'UNE préparation de point, jamais persisté : rouvrir "🗒️ Point avec..." plus tard (une
 * autre fois, un autre jour) repart d'une ardoise vierge, seul le passage "en direct" au sein
 * d'une même session de préparation compte. Un sujet se marque "vu" soit en cochant la case
 * dédiée sur sa ligne (sans l'ouvrir), soit automatiquement en l'ouvrant (`openFromPrep`) — dans
 * les deux cas la modale se reconstruit toujours avec des données FRAÎCHES (`followUpsApi.
 * listAll()` relu à chaque appel plutôt que de réutiliser un tableau `own` capturé une fois pour
 * toutes) : c'est ce qui corrige le bug remonté par Charles-Henri ("quand je modifie un sujet,
 * ça ne se met pas à jour sur la modale 'Point avec...' tant que je ne ressors pas").
 */
/**
 * Calcule les 4 sections d'un point (retard, à transmettre, à aborder groupé par projet,
 * terminé récemment) — factorisé hors de `openPrepModal` (vague 22 sexies) pour être partagé
 * avec la fenêtre de masquage privée `js/views/prepMask.js#renderPrepMask`, qui doit afficher
 * EXACTEMENT les mêmes sections/le même tri que l'écran finalement partagé, sinon cocher
 * "masquer" sur un sujet ne correspondrait à rien de visible dans le point réel.
 *
 * `includeHidden` (retour de Charles-Henri : "je puisse cocher ce que je ne veux pas remonter
 * [...] en mode privé") : `false` (défaut, utilisé par `openPrepModal`, l'écran qu'il partage)
 * exclut les Suivis marqués `hiddenFromPrep` — `true` (utilisé par la fenêtre de masquage) les
 * inclut tous, pour pouvoir aussi bien les masquer que les redémasquer.
 */
export function computePrepSections(person, allFollowUps, projects, { includeHidden = false } = {}) {
  const own = allFollowUps.filter((f) => f.personId === person.id && (includeHidden || !f.hiddenFromPrep));

  const active = [...own.filter((f) => f.status !== "done")].sort((a, b) => soonestDate(a) - soonestDate(b));
  const overdue = active.filter(followUpsApi.isControlDue);
  const notOverdue = active.filter((f) => !followUpsApi.isControlDue(f));
  const upcoming = notOverdue.filter((f) => f.direction !== "to_tell");
  const toTell = notOverdue.filter((f) => f.direction === "to_tell");
  const recentlyDone = [...own.filter((f) => f.status === "done")]
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 5);
  // `upcoming` est déjà trié par date la plus proche croissante (cf. `active` ci-dessus) : le
  // regroupement par projet hérite donc de cet ordre à l'intérieur de chaque groupe, et les
  // groupes eux-mêmes s'enchaînent dans l'ordre d'apparition de leur premier sujet — donc du
  // plus urgent au moins urgent, y compris pour les sujets sans projet.
  const upcomingGroups = groupByProject(upcoming, projects);

  return { overdue, toTell, upcoming, upcomingGroups, recentlyDone };
}

/**
 * Étape de masquage privée AVANT "Préparer mon point" (retour de Charles-Henri, vague 22
 * sexies) : *"il faut qu'avant je puisse cocher ce que je ne veux pas remonter dans cet écran
 * en mode privé et que cette modale soit déportée et déplaçable seule sur un autre écran."*
 *
 * Une vraie modale (js/components/modal.js) vit à l'intérieur de CETTE fenêtre — elle ne
 * peut donc jamais être déplacée sur un second écran indépendamment du reste. Seule une vraie
 * fenêtre de navigateur, ouverte via `window.open()`, peut être glissée par l'OS sur un autre
 * écran pendant que celle-ci reste affichée (et partagée en visio) sur le premier. La fenêtre
 * ouverte ici recharge donc l'app en entier sur la route dédiée `#/prep-mask` (voir
 * js/app.js et js/views/prepMask.js), qui s'arrête avant de monter la navigation/les FAB
 * habituels : un outil ponctuel et concentré, pas un second onglet de travail complet.
 *
 * Le "Point avec X" (openPrepModal, l'écran effectivement partagé) ne s'ouvre qu'une fois cette
 * fenêtre refermée — inutile d'échanger des messages entre les deux fenêtres : le masquage se
 * persiste au fil de l'eau (`followUpsApi.updateFollowUp(..., { hiddenFromPrep })`), donc
 * `openPrepModal`, en relisant les données fraîches, applique déjà le bon filtre dès qu'il
 * s'ouvre à son tour.
 */
function openPrepMaskThenPrep(person, { onDone } = {}) {
  const url = location.pathname + "#/prep-mask?person=" + encodeURIComponent(person.id);
  const win = window.open(url, "prepMask-" + person.id, "width=480,height=760,menubar=no,toolbar=no,location=no,status=no");
  if (!win) {
    // Popup bloquée par le navigateur : on ne bloque pas Charles-Henri pour autant, le point
    // s'ouvre directement sans étape de masquage cette fois plutôt que de le laisser sans rien.
    showToast("Fenêtre de masquage bloquée par le navigateur — autorise les popups pour cette appli");
    openPrepModal(person, { onDone });
    return;
  }
  win.focus();
  const poll = setInterval(() => {
    if (win.closed) {
      clearInterval(poll);
      openPrepModal(person, { onDone });
    }
  }, 400);
}

async function openPrepModal(person, { onDone, coveredIds = new Set() } = {}) {
  const [allFollowUps, projects] = await Promise.all([followUpsApi.listAll(), projectsApi.listAll()]);
  const { overdue, toTell, upcoming, upcomingGroups, recentlyDone } = computePrepSections(person, allFollowUps, projects);

  const remaining = [...overdue, ...toTell, ...upcoming].filter((f) => !coveredIds.has(f.id)).length;

  const body = document.createElement("div");
  body.innerHTML = `
    <div class="item-meta" style="margin-bottom:12px;">☑️ ${remaining === 0 ? "Tous les sujets ont été vus." : `${remaining} sujet(s) restant(s) à passer.`}</div>
    <div class="section-title" style="margin-top:0;">🔴 En retard de contrôle (${overdue.length})</div>
    <div class="card" id="prep-overdue" style="margin-bottom:16px;"></div>
    <div class="section-title">📣 À transmettre (${toTell.length})</div>
    <div class="card" id="prep-to-tell" style="margin-bottom:16px;"></div>
    <div class="section-title">🎯 À aborder (${upcoming.length})</div>
    <div class="card" id="prep-upcoming" style="margin-bottom:16px;"></div>
    <div class="section-title">🟢 Terminé récemment (${recentlyDone.length})</div>
    <div class="card" id="prep-done" style="margin-bottom:8px;"></div>
  `;

  const openFromPrep = (f) => {
    coveredIds.add(f.id);
    closeModal();
    openEditFollowUpModal(f, { onDone: () => openPrepModal(person, { onDone, coveredIds }) });
  };
  renderFollowUpList(body.querySelector("#prep-overdue"), overdue, { onOpen: openFromPrep, coveredIds });
  renderFollowUpList(body.querySelector("#prep-to-tell"), toTell, { onOpen: openFromPrep, coveredIds });
  renderGroupedFollowUpList(body.querySelector("#prep-upcoming"), upcomingGroups, { onOpen: openFromPrep, coveredIds });
  renderFollowUpList(body.querySelector("#prep-done"), recentlyDone, { onOpen: openFromPrep });

  openModal({
    title: `🗒️ Point avec ${person.name}`,
    body,
    actions: [{ label: "Fermer", variant: "ghost", onClick: () => onDone?.() }],
  });
}

/** Regroupe une liste de suivis par projet lié, en conservant l'ordre d'apparition (voir
 *  commentaire dans `openPrepModal`). Les suivis sans `projectId` sont réunis dans un groupe
 *  "Sans projet" plutôt qu'isolés un par un. */
function groupByProject(items, projects) {
  const groups = [];
  const indexByKey = new Map();
  for (const f of items) {
    const key = f.projectId || "__none__";
    let index = indexByKey.get(key);
    if (index === undefined) {
      const project = f.projectId ? projects.find((p) => p.id === f.projectId) : null;
      index = groups.length;
      indexByKey.set(key, index);
      groups.push({ label: project ? project.name : "Sans projet", items: [] });
    }
    groups[index].items.push(f);
  }
  return groups;
}

/**
 * `coveredIds` (optionnel — uniquement fourni par `openPrepModal`, vague 21) : quand présent,
 * chaque ligne gagne une case "vu" indépendante du statut du Suivi lui-même (cocher ne modifie
 * rien côté données, seulement l'affichage de cette session de préparation — voir commentaire
 * sur `openPrepModal`). `onCoveredChange` permet au regroupement par projet de rafraîchir le
 * compteur "x/y vus" de son étiquette après une case cochée sans tout redessiner.
 */
function appendFollowUpRows(container, followUps, onOpen, coveredIds, onCoveredChange) {
  for (const f of followUps) {
    const isToTell = f.direction === "to_tell";
    const isCovered = !!coveredIds?.has(f.id);
    const row = document.createElement("div");
    row.className = "item-row" + (isCovered ? " item-row-covered" : "");
    row.style.cursor = "pointer";
    const meta = isToTell
      ? f.controlDate
        ? "À dire avant : " + formatDate(f.controlDate)
        : "Pas de date"
      : f.dueDate
        ? "Échéance : " + formatDate(f.dueDate)
        : "Pas d'échéance";
    const notableIcon = f.notable === "positive" ? "👍 " : f.notable === "negative" ? "👎 " : "";
    row.innerHTML = `
      ${coveredIds ? `<label class="covered-check" title="Marquer comme vu pendant ce point"><input type="checkbox" ${isCovered ? "checked" : ""} aria-label="Vu pendant ce point" /></label>` : ""}
      <div class="item-main">
        <div class="item-title">${notableIcon}${isToTell ? "📣 " : ""}${escapeHtml(f.title)}${f.category ? ` <span class="item-meta">· ${followUpsApi.CATEGORY_LABELS[f.category]}</span>` : ""}</div>
        <div class="item-meta">${meta} · Ajouté le ${formatDate(f.createdAt)}</div>
      </div>
      <span class="badge badge-${f.status}">${followUpsApi.STATUS_LABELS[f.status]}</span>
    `;
    if (coveredIds) {
      const checkWrap = row.querySelector(".covered-check");
      // Empêche la case de déclencher aussi l'ouverture de la fiche (clic qui bulle vers `row`).
      checkWrap.addEventListener("click", (e) => e.stopPropagation());
      checkWrap.querySelector("input").addEventListener("change", (e) => {
        if (e.target.checked) coveredIds.add(f.id);
        else coveredIds.delete(f.id);
        row.classList.toggle("item-row-covered", e.target.checked);
        onCoveredChange?.();
      });
    }
    row.addEventListener("click", () => (onOpen ? onOpen(f) : openEditFollowUpModal(f)));
    container.appendChild(row);
  }
}

function renderFollowUpList(container, followUps, { onOpen, coveredIds } = {}) {
  if (!followUps.length) {
    container.innerHTML = `<div class="empty-state" style="padding:16px;">Rien ici.</div>`;
    return;
  }
  appendFollowUpRows(container, followUps, onOpen, coveredIds);
}

/** Variante groupée de `renderFollowUpList` : un sous-titre par groupe (ex. nom de projet),
 *  puis ses suivis dans l'ordre déjà trié — voir `groupByProject`. Le compteur "x/y vus" sur
 *  l'étiquette (retour de Charles-Henri, vague 21) ne s'affiche que dans le contexte de
 *  préparation d'un point (`coveredIds` fourni). */
function renderGroupedFollowUpList(container, groups, { onOpen, coveredIds } = {}) {
  if (!groups.some((g) => g.items.length)) {
    container.innerHTML = `<div class="empty-state" style="padding:16px;">Rien ici.</div>`;
    return;
  }
  container.innerHTML = "";
  for (const group of groups) {
    if (!group.items.length) continue;
    const groupEl = document.createElement("div");
    groupEl.className = "prep-group";
    const label = document.createElement("div");
    label.className = "prep-group-label";
    groupEl.appendChild(label);
    const updateLabel = () => {
      if (!coveredIds) {
        label.textContent = group.label;
        return;
      }
      const covered = group.items.filter((i) => coveredIds.has(i.id)).length;
      label.textContent = `${group.label} — ${covered}/${group.items.length} vu(s)`;
    };
    updateLabel();
    appendFollowUpRows(groupEl, group.items, onOpen, coveredIds, updateLabel);
    container.appendChild(groupEl);
  }
}

/** Objectifs de campagne (§ préparation EADP) : liste + accès à leurs points de suivi datés. */
function renderObjectivesList(container, objectives, person, reopen) {
  if (!objectives.length) {
    container.innerHTML = `<div class="empty-state" style="padding:16px;">Pas encore d'objectif pour ${escapeHtml(person.name)}.</div>`;
    return;
  }
  container.innerHTML = "";
  for (const o of objectives) {
    const row = document.createElement("div");
    row.className = "item-row";
    row.style.cursor = "pointer";
    row.innerHTML = `
      <div class="item-main">
        <div class="item-title">${o.status === "done" ? "✅ " : "🎯 "}${escapeHtml(o.title)}</div>
        <div class="item-meta">${(o.entries || []).length} point(s) de suivi</div>
      </div>
    `;
    row.addEventListener("click", () => {
      closeModal();
      openObjectiveDetail(o, person, { onDone: reopen });
    });
    container.appendChild(row);
  }
}

function openCreateObjectiveModal(person, { onDone } = {}) {
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="obj-title">Objectif de ${escapeHtml(person.name)}</label>
      <input id="obj-title" type="text" placeholder="Ex. Monter en autonomie sur le pilotage de projet" />
    </div>
  `;
  const { bodyEl, close } = openModal({
    title: "Nouvel objectif",
    body,
    actions: [
      { label: "Annuler", variant: "ghost", onClick: () => onDone?.() },
      {
        label: "Créer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          const title = bodyEl.querySelector("#obj-title").value.trim();
          if (!title) return;
          await objectivesApi.createObjective({ personId: person.id, title });
          close();
          showToast("Objectif ajouté");
          onDone?.();
        },
      },
    ],
  });
}

function openObjectiveDetail(objective, person, { onDone } = {}) {
  const entries = [...(objective.entries || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field" style="display:flex;align-items:center;gap:8px;">
      <input id="obj-done" type="checkbox" style="width:auto;" ${objective.status === "done" ? "checked" : ""} />
      <label for="obj-done" style="margin:0;">✅ Objectif atteint</label>
    </div>
    <div class="section-title" style="margin-top:0;">🕒 Points de suivi (${entries.length})</div>
    <div class="card" id="obj-entries" style="margin-bottom:16px;"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
      <input id="obj-entry-date" type="date" value="${new Date().toISOString().slice(0, 10)}" style="flex:1;min-width:130px;border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:var(--space-3);" />
      <input id="obj-entry-note" type="text" placeholder="Où en est-on ?" style="flex:2;min-width:160px;border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:var(--space-3);" />
      <button id="add-entry-btn" type="button" class="btn btn-secondary btn-sm">+ Point</button>
    </div>
  `;
  const entriesEl = body.querySelector("#obj-entries");
  function renderEntries(list) {
    if (!list.length) {
      entriesEl.innerHTML = `<div class="empty-state" style="padding:16px;">Aucun point de suivi pour l'instant.</div>`;
      return;
    }
    entriesEl.innerHTML = "";
    for (const e of list) {
      const row = document.createElement("div");
      row.className = "item-row";
      row.innerHTML = `<div class="item-main"><div class="item-title">${escapeHtml(e.note)}</div><div class="item-meta">${formatDate(e.date)}</div></div>`;
      entriesEl.appendChild(row);
    }
  }
  renderEntries(entries);
  body.querySelector("#add-entry-btn").addEventListener("click", async () => {
    const note = body.querySelector("#obj-entry-note").value.trim();
    if (!note) return;
    const date = body.querySelector("#obj-entry-date").value || null;
    const updated = await objectivesApi.addEntry(objective.id, { date, note });
    objective.entries = updated.entries;
    renderEntries([...updated.entries].sort((a, b) => new Date(b.date) - new Date(a.date)));
    body.querySelector("#obj-entry-note").value = "";
    showToast("Point de suivi ajouté");
  });

  const { bodyEl, close } = openModal({
    title: `🎯 ${objective.title}`,
    body,
    actions: [
      { label: "Fermer", variant: "ghost", onClick: () => onDone?.() },
      {
        label: "🗑️ Supprimer",
        variant: "danger",
        closesModal: false,
        onClick: () => {
          closeModal();
          confirmDelete({
            title: "Supprimer cet objectif ?",
            message: `« ${objective.title} » et ses points de suivi seront définitivement supprimés.`,
            onConfirm: async () => {
              await objectivesApi.removeObjective(objective.id);
              showToast("Objectif supprimé");
              onDone?.();
            },
            onCancel: () => openObjectiveDetail(objective, person, { onDone }),
          });
        },
      },
      {
        label: "Enregistrer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          await objectivesApi.updateObjective(objective.id, {
            status: bodyEl.querySelector("#obj-done").checked ? "done" : "active",
          });
          close();
          showToast("Objectif mis à jour");
          onDone?.();
        },
      },
    ],
  });
}

/**
 * "Préparer l'EADP" (retour de Charles-Henri) : sortir, sur une période choisie, les éléments
 * notables (positif/négatif) d'une personne ainsi que l'avancement de ses objectifs — version
 * simple délibérée (pas d'export/impression dédiée, pas de comparaison multi-campagnes),
 * décision prise avec Charles-Henri. Recompose tout à la volée à l'ouverture, comme §33/§35.
 */
async function openPrepareEadpModal(person, { onDone } = {}) {
  const [allFollowUps, allObjectives] = await Promise.all([followUpsApi.listAll(), objectivesApi.listAll()]);
  const own = allFollowUps.filter((f) => f.personId === person.id);
  const objectives = allObjectives.filter((o) => o.personId === person.id);

  const defaultFrom = new Date();
  defaultFrom.setFullYear(defaultFrom.getFullYear() - 1);

  const body = document.createElement("div");
  body.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <div class="field" style="flex:1;margin-bottom:0;">
        <label for="eadp-from">Du</label>
        <input id="eadp-from" type="date" value="${defaultFrom.toISOString().slice(0, 10)}" />
      </div>
      <div class="field" style="flex:1;margin-bottom:0;">
        <label for="eadp-to">Au</label>
        <input id="eadp-to" type="date" value="${new Date().toISOString().slice(0, 10)}" />
      </div>
    </div>
    <div id="eadp-content"></div>
    <button id="eadp-copy-btn" type="button" class="btn btn-secondary btn-block" style="margin-top:8px;">📋 Copier le résumé</button>
  `;
  const contentEl = body.querySelector("#eadp-content");
  let summaryText = "";

  function render() {
    const from = new Date(body.querySelector("#eadp-from").value);
    const to = new Date(body.querySelector("#eadp-to").value);
    to.setHours(23, 59, 59, 999);
    const inRange = (ts) => ts >= from.getTime() && ts <= to.getTime();

    const notable = own.filter((f) => f.notable && inRange(f.createdAt));
    const positive = notable.filter((f) => f.notable === "positive");
    const negative = notable.filter((f) => f.notable === "negative");

    const lines = [`📋 Préparation EADP — ${person.name}`, `Période : du ${formatDate(from)} au ${formatDate(to)}`, ""];

    contentEl.innerHTML = `
      <div class="section-title" style="margin-top:0;">👍 Notables positifs (${positive.length})</div>
      <div class="card" id="eadp-positive" style="margin-bottom:16px;"></div>
      <div class="section-title">👎 Notables négatifs (${negative.length})</div>
      <div class="card" id="eadp-negative" style="margin-bottom:16px;"></div>
      <div class="section-title">🎯 Objectifs (${objectives.length})</div>
      <div class="card" id="eadp-objectives" style="margin-bottom:8px;"></div>
    `;
    renderSimpleList(contentEl.querySelector("#eadp-positive"), positive);
    renderSimpleList(contentEl.querySelector("#eadp-negative"), negative);

    lines.push(`👍 Notables positifs (${positive.length})`);
    for (const f of positive) lines.push(`- ${f.title} (${formatDate(f.createdAt)})`);
    lines.push("", `👎 Notables négatifs (${negative.length})`);
    for (const f of negative) lines.push(`- ${f.title} (${formatDate(f.createdAt)})`);
    lines.push("", `🎯 Objectifs (${objectives.length})`);

    const objectivesEl = contentEl.querySelector("#eadp-objectives");
    if (!objectives.length) {
      objectivesEl.innerHTML = `<div class="empty-state" style="padding:16px;">Aucun objectif défini.</div>`;
    } else {
      objectivesEl.innerHTML = "";
      for (const o of objectives) {
        const entriesInRange = (o.entries || []).filter((e) => inRange(e.createdAt));
        const row = document.createElement("div");
        row.className = "item-row";
        row.innerHTML = `
          <div class="item-main">
            <div class="item-title">${o.status === "done" ? "✅ " : "🎯 "}${escapeHtml(o.title)}</div>
            <div class="item-meta">${entriesInRange.map((e) => escapeHtml(e.date + " — " + e.note)).join("<br/>") || "Aucun point sur la période"}</div>
          </div>
        `;
        objectivesEl.appendChild(row);
        lines.push(`- ${o.title} (${o.status === "done" ? "atteint" : "en cours"})`);
        for (const e of entriesInRange) lines.push(`  · ${e.date} — ${e.note}`);
      }
    }
    summaryText = lines.join("\n");
  }

  function renderSimpleList(container, list) {
    if (!list.length) {
      container.innerHTML = `<div class="empty-state" style="padding:16px;">Rien sur cette période.</div>`;
      return;
    }
    container.innerHTML = "";
    for (const f of list) {
      const row = document.createElement("div");
      row.className = "item-row";
      row.innerHTML = `<div class="item-main"><div class="item-title">${escapeHtml(f.title)}</div><div class="item-meta">${formatDate(f.createdAt)}</div></div>`;
      container.appendChild(row);
    }
  }

  render();
  body.querySelector("#eadp-from").addEventListener("change", render);
  body.querySelector("#eadp-to").addEventListener("change", render);
  body.querySelector("#eadp-copy-btn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      showToast("Résumé copié");
    } catch {
      showToast("Impossible de copier");
    }
  });

  openModal({
    title: `📋 Préparer l'EADP — ${person.name}`,
    body,
    actions: [{ label: "Fermer", variant: "ghost", onClick: () => onDone?.() }],
  });
}

/**
 * Créer un suivi. `person` est optionnel : appelée depuis une fiche personne, il est déjà
 * connu ; appelée depuis "+ Créer et lier" (fil conducteur, components/linkedItems.js) ou
 * depuis la fiche projet ("+ Ajouter"), on ne sait pas encore de qui il s'agit — un
 * sélecteur "Personne" apparaît alors dans le formulaire. `projectId` préremplit le projet
 * quand on vient d'une fiche projet.
 *
 * `direction` (retour de Charles-Henri : comment noter un "push d'info" vers quelqu'un,
 * pas seulement attendre quelque chose de lui) : le même objet Suivi sert dans les deux
 * sens — soit j'attends quelque chose de la personne (comportement historique), soit c'est
 * moi qui dois lui dire/transmettre quelque chose. `category` ne compte que pour ce second
 * sens, et seulement quand la personne est de type Manager (§34/§35, voir management.js).
 *
 * `defaultTitle` (retour de Charles-Henri, 01/09/2026 : qualifier une capture Inbox en Suivi
 * n'affichait pas le sens directement) — l'Inbox (js/views/inbox.js) appelle désormais cette
 * même modale complète plutôt que sa propre version simplifiée, pour ne jamais avoir deux
 * formulaires de création de Suivi qui divergent. Préremplit juste le champ "Sur quoi ?" avec
 * le début de la capture brute.
 *
 * `defaultDueDate`/`defaultControlDate` (retour de Charles-Henri, vague 22 : "quand je clique
 * sur oui [pour un autre suivi], j'aimerai que par défaut soit repris le projet et l'échéance
 * de la dernière création") — préremplissent les deux champs date ; utilisés par
 * `promptAnotherFollowUp()` ci-dessous pour reprendre les valeurs du Suivi qui vient d'être
 * enregistré, jamais saisis directement par un appelant existant (tous omettent ce paramètre).
 *
 * Après un enregistrement réussi, la modale "Encore un suivi ?" s'affiche désormais
 * systématiquement (retour de Charles-Henri, vague 22 : "j'aimerai que la modale encore un
 * suivi s'affiche même en dehors des recettes [...] systématiquement après enregistrement du
 * suivi") — plus seulement depuis la recette "Plusieurs suivis" (js/components/recipes.js, qui
 * s'appuyait jusqu'ici sur sa propre boucle `promptAnotherFollowUp`, désormais superflue et
 * simplifiée). Le `onCreated`/`onCancel` de l'appelant continue de s'exécuter normalement à
 * chaque suivi créé (ex. `reopen()` sur la fiche Personne) ; la relance "Encore un suivi ?"
 * vient s'ajouter par-dessus, pas à la place.
 */
export async function openCreateFollowUpModal({ person, projectId, defaultDirection = "waiting_on", defaultTitle = "", defaultDueDate = "", defaultControlDate = "", onCreated, onCancel } = {}) {
  const [projects, people] = await Promise.all([
    projectsApi.listAll(),
    person ? Promise.resolve(null) : peopleApi.listAll(),
  ]);
  const body = document.createElement("div");
  body.innerHTML = `
    ${
      person
        ? ""
        : `
    <div class="field" id="fu-person-field">
      <label for="fu-person">Personne</label>
      <select id="fu-person">
        ${people.map((p) => `<option value="${p.id}">${p.type === "manager" ? "👔" : "👤"} ${escapeHtml(p.name)}</option>`).join("")}
      </select>
      <button type="button" id="fu-multi-toggle" class="btn btn-ghost btn-sm" style="padding-left:0;margin-top:6px;">👥 Assigner le même suivi à plusieurs personnes</button>
    </div>
    <div class="field" id="fu-multi-people-field" style="display:none;">
      <label>À qui ?</label>
      <div id="fu-multi-people-list" style="max-height:180px;overflow-y:auto;border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:var(--space-3);">
        ${people.map((p) => `<label class="chip-radio" style="display:flex;"><input type="checkbox" class="fu-multi-person-cb" value="${p.id}" style="width:auto;margin-right:8px;" /> ${p.type === "manager" ? "👔" : "👤"} ${escapeHtml(p.name)}</label>`).join("")}
      </div>
      <button type="button" id="fu-multi-toggle-back" class="btn btn-ghost btn-sm" style="padding-left:0;margin-top:6px;">← Revenir à une seule personne</button>
    </div>`
    }
    <div class="field">
      <label>Sens</label>
      <div class="chip-row">
        ${followUpsApi.DIRECTIONS.map(
          (d) => `<label class="chip-radio"><input type="radio" name="fu-direction" value="${d}" ${d === defaultDirection ? "checked" : ""} /> ${followUpsApi.DIRECTION_LABELS[d]}</label>`
        ).join("")}
      </div>
    </div>
    <div class="field">
      <label for="fu-title" id="fu-title-label">Qu'est-ce que ${person ? escapeHtml(person.name) : "la personne"} s'engage à faire ?</label>
      <input id="fu-title" type="text" placeholder="Ex. Terminer la migration" value="${escapeAttr(defaultTitle)}" />
    </div>
    <div class="field" id="fu-category-field" style="display:none;">
      <label for="fu-category">Catégorie (pour le point manager, optionnel)</label>
      <select id="fu-category">
        <option value="">— Aucune —</option>
        ${followUpsApi.CATEGORIES.map((c) => `<option value="${c}">${followUpsApi.CATEGORY_LABELS[c]}</option>`).join("")}
      </select>
    </div>
    <div class="field" id="fu-due-field">
      <label for="fu-due">Échéance de la personne</label>
      <input id="fu-due" type="date" value="${escapeAttr(defaultDueDate)}" />
    </div>
    <div class="field">
      <label for="fu-control" id="fu-control-label">Quand dois-je contrôler / relancer ?</label>
      <input id="fu-control" type="date" value="${escapeAttr(defaultControlDate)}" />
    </div>
    <div class="field">
      <label for="fu-project">Projet (optionnel)</label>
      <select id="fu-project">
        <option value="">— Aucun —</option>
        ${sortProjectsByName(projects).map((p) => `<option value="${p.id}" ${p.id === projectId ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("")}
      </select>
      <button type="button" id="fu-new-project-btn" class="btn btn-ghost btn-sm" style="margin-top:6px;">+ Nouveau projet</button>
      <div id="fu-new-project-row" style="display:none;gap:8px;margin-top:6px;">
        <input id="fu-new-project-name" type="text" placeholder="Nom du nouveau projet" style="flex:1;border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:var(--space-3);" />
        <button type="button" id="fu-new-project-confirm" class="btn btn-secondary btn-sm">Créer</button>
      </div>
    </div>
    <div class="field">
      <label for="fu-description">Description (optionnel)</label>
      <textarea id="fu-description" placeholder="Contexte libre, pas encore d'échéance à retenir ici"></textarea>
    </div>
    <div class="field">
      <label>Élément notable ? (préparation EADP, optionnel)</label>
      <div class="chip-row">
        <label class="chip-radio"><input type="radio" name="fu-notable" value="" checked /> Aucun</label>
        <label class="chip-radio"><input type="radio" name="fu-notable" value="positive" /> 👍 Positif</label>
        <label class="chip-radio"><input type="radio" name="fu-notable" value="negative" /> 👎 Négatif</label>
      </div>
    </div>
  `;

  // "Créer un projet à la volée" (retour de Charles-Henri, vague 21 : "dans la fiche nouveau
  // suivi, je dois pouvoir créer un nouveau projet à la volée") — une simple rangée qui
  // s'ouvre/se ferme dans le formulaire plutôt qu'une modale imbriquée, pour ne jamais perdre
  // ce qui a déjà été saisi (titre, dates...) le temps de nommer le projet.
  body.querySelector("#fu-new-project-btn").addEventListener("click", () => {
    const row = body.querySelector("#fu-new-project-row");
    row.style.display = row.style.display === "none" ? "flex" : "none";
    if (row.style.display === "flex") body.querySelector("#fu-new-project-name").focus();
  });
  body.querySelector("#fu-new-project-confirm").addEventListener("click", async () => {
    const name = body.querySelector("#fu-new-project-name").value.trim();
    if (!name) return;
    const project = await projectsApi.createProject({ name });
    const select = body.querySelector("#fu-project");
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.name;
    const options = [...select.options].filter((o) => o.value);
    const insertBefore = options.find((o) => o.textContent.localeCompare(project.name, "fr") > 0);
    select.insertBefore(option, insertBefore || null);
    select.value = project.id;
    body.querySelector("#fu-new-project-name").value = "";
    body.querySelector("#fu-new-project-row").style.display = "none";
    showToast("Projet créé");
  });

  // "Saisie en masse" (retour de Charles-Henri, vague 22 : "j'aimerai avoir plus de saisie en
  // masse") — première des deux pistes qu'il a choisies parmi celles proposées : dupliquer un
  // même engagement vers plusieurs personnes en une fois (ex. "tout le monde doit remplir le
  // formulaire X d'ici vendredi"), plutôt que de ressaisir le même texte pour chacune. N'existe
  // que quand le formulaire propose déjà un sélecteur de personne (`!person`) — depuis une
  // fiche Personne déjà ouverte, il n'y a par construction qu'une seule personne possible.
  if (!person) {
    const multiToggleBtn = body.querySelector("#fu-multi-toggle");
    const multiToggleBackBtn = body.querySelector("#fu-multi-toggle-back");
    const personField = body.querySelector("#fu-person-field");
    const multiField = body.querySelector("#fu-multi-people-field");
    multiToggleBtn.addEventListener("click", () => {
      personField.style.display = "none";
      multiField.style.display = "";
    });
    multiToggleBackBtn.addEventListener("click", () => {
      multiField.style.display = "none";
      personField.style.display = "";
      multiField.querySelectorAll(".fu-multi-person-cb").forEach((cb) => (cb.checked = false));
    });
  }

  showHintOnce(
    body,
    "followup-direction-v1",
    "« J'attends quelque chose » : c'est <strong>elle</strong> qui agit, tu contrôles à la date choisie. « Je dois transmettre » : c'est <strong>toi</strong> qui dois lui dire quelque chose avant cette date. Dans les deux cas c'est un Suivi, jamais une Tâche."
  );

  const applyDirection = (direction) => {
    const isToTell = direction === "to_tell";
    body.querySelector("#fu-title-label").textContent = isToTell
      ? `Qu'est-ce que je dois dire à ${person ? escapeHtml(person.name) : "la personne"} ?`
      : `Qu'est-ce que ${person ? escapeHtml(person.name) : "la personne"} s'engage à faire ?`;
    body.querySelector("#fu-category-field").style.display = isToTell ? "" : "none";
    body.querySelector("#fu-due-field").style.display = isToTell ? "none" : "";
    body.querySelector("#fu-control-label").textContent = isToTell
      ? "Avant quand dois-je lui en parler ?"
      : "Quand dois-je contrôler / relancer ?";
  };
  body.querySelectorAll('input[name="fu-direction"]').forEach((r) => r.addEventListener("change", () => applyDirection(r.value)));
  applyDirection(defaultDirection);

  const { bodyEl, close } = openModal({
    title: "Nouveau suivi",
    body,
    actions: [
      { label: "Annuler", variant: "ghost", onClick: () => onCancel?.() },
      {
        label: "Créer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          const title = bodyEl.querySelector("#fu-title").value.trim();
          if (!title) return;
          const direction = bodyEl.querySelector('input[name="fu-direction"]:checked')?.value || "waiting_on";
          const commonFields = {
            title,
            direction,
            category: direction === "to_tell" ? bodyEl.querySelector("#fu-category").value || null : null,
            notable: bodyEl.querySelector('input[name="fu-notable"]:checked')?.value || null,
            description: bodyEl.querySelector("#fu-description").value.trim(),
            dueDate: direction === "to_tell" ? null : bodyEl.querySelector("#fu-due").value || null,
            controlDate: bodyEl.querySelector("#fu-control").value || null,
            projectId: bodyEl.querySelector("#fu-project").value || null,
          };

          // Mode "saisie en masse" (vague 22) : le bloc multi-personnes n'existe que quand
          // `!person`, et n'est actif que si Charles-Henri l'a explicitement révélé via
          // "👥 Assigner le même suivi à plusieurs personnes" (affichage encore sur "none" sinon).
          const multiField = bodyEl.querySelector("#fu-multi-people-field");
          const isMultiMode = multiField && multiField.style.display !== "none";
          if (isMultiMode) {
            const personIds = [...bodyEl.querySelectorAll(".fu-multi-person-cb:checked")].map((cb) => cb.value);
            if (!personIds.length) return;
            const created = [];
            for (const personId of personIds) {
              created.push(await followUpsApi.createFollowUp({ ...commonFields, personId }));
            }
            close();
            showToast(`${created.length} suivi${created.length > 1 ? "s" : ""} créé${created.length > 1 ? "s" : ""}`);
            // Pas de "Encore un suivi ?" ici : cette action répond déjà, en un seul geste, au
            // besoin qui aurait autrement demandé de répéter la modale N fois pour N personnes.
            // `onCreated` reçoit le premier suivi créé — une limite assumée pour les appelants
            // qui l'utilisent pour rattacher un objet unique (ex. qualification Inbox, qui ne
            // peut de toute façon référencer qu'un seul `resultFollowUpId`) — voir "Point
            // d'attention" du doc de suivi.
            onCreated?.(created[0]);
            return;
          }

          const personId = person ? person.id : bodyEl.querySelector("#fu-person").value;
          if (!personId) return;
          const followUp = await followUpsApi.createFollowUp({ ...commonFields, personId });
          close();
          showToast("Suivi créé");
          // `onCreated` n'est PAS appelé ici (retour de test, vague 22) : la plupart des
          // appelants (fiche Personne, fiche Projet) rouvrent leur propre modale dans
          // `onCreated` (ex. `reopen()`), et `openModal()` ferme systématiquement la modale
          // active avant d'en ouvrir une nouvelle (une seule modale à la fois). Si `onCreated`
          // était invoqué immédiatement ici, sa réouverture de fiche entrerait en course avec
          // l'ouverture de "Encore un suivi ?" juste après — laquelle des deux modales reste
          // affichée dépendrait alors uniquement de la vitesse de la promesse `reopen()`
          // (relecture en base), parfois plus lente que l'ouverture synchrone de cette modale-ci.
          // `onCreated` est donc différé et déclenché une seule fois, quand la série de suivis
          // est réellement terminée (clic sur "Terminé" dans promptAnotherFollowUp), avec le
          // DERNIER suivi créé de la série — voir promptAnotherFollowUp() ci-dessous.
          const resolvedPerson = person || (await peopleApi.getPerson(personId).catch(() => null));
          if (resolvedPerson) promptAnotherFollowUp(resolvedPerson, followUp, { onCreated, onCancel });
          else onCreated?.(followUp);
        },
      },
    ],
  });
}

/**
 * "Encore un suivi ?" (retour de Charles-Henri, vague 22) — affichée systématiquement après la
 * création d'un Suivi, quel que soit le point d'entrée (fiche Personne, qualification Inbox,
 * recette de démarrage...). "+ Encore un suivi" rouvre la même modale pour la même personne en
 * reprenant le projet, le sens et les deux dates du Suivi qui vient d'être créé — l'hypothèse
 * étant qu'une série de suivis créés à la suite (ex. pendant un même point) partage
 * généralement le même contexte, seul l'engagement individuel change.
 *
 * `continuation.onCreated` est délibérément déclenché ICI (au clic sur "Terminé"), pas à chaque
 * création intermédiaire de la série (voir le commentaire dans le handler "Créer" ci-dessus) :
 * c'est le seul moment où on sait que la série est terminée, donc le seul moment sûr pour
 * déclencher un effet de bord qui rouvre une modale derrière (ex. `reopen()` de la fiche
 * Personne) sans risquer que "Encore un suivi ?" ne soit jamais visible.
 */
function promptAnotherFollowUp(person, lastFollowUp, continuation = {}) {
  const body = document.createElement("div");
  body.textContent = `Ajouter un autre suivi pour ${person.name} ?`;
  openModal({
    title: "Encore un suivi ?",
    body,
    actions: [
      { label: "Terminé", variant: "ghost", onClick: () => continuation.onCreated?.(lastFollowUp) },
      {
        label: "+ Encore un suivi",
        variant: "primary",
        onClick: () =>
          openCreateFollowUpModal({
            person,
            projectId: lastFollowUp.projectId || undefined,
            defaultDirection: lastFollowUp.direction || "waiting_on",
            defaultDueDate: lastFollowUp.dueDate || "",
            defaultControlDate: lastFollowUp.controlDate || "",
            onCreated: continuation.onCreated,
            onCancel: continuation.onCancel,
          }),
      },
    ],
  });
}

export async function openEditFollowUpModal(followUp, { onDone } = {}) {
  preferencesApi.recordRecentlyViewed("FollowUp", followUp.id).catch(() => {});
  const [projects, person] = await Promise.all([
    projectsApi.listAll(),
    followUp.personId ? peopleApi.getPerson(followUp.personId) : Promise.resolve(null),
  ]);

  // Titre de réunion composé (retour de Charles-Henri, 01/09/2026, voir
  // js/components/meetingLauncher.js) : Catégorie du projet - Projet - Intitulé du suivi -
  // Personne, chaque partie omise si absente.
  const followUpProject = projects.find((p) => p.id === followUp.projectId) || null;
  const meetingTitle = buildMeetingTitle({
    category: followUpProject?.category || "",
    projectName: followUpProject?.name || "",
    itemTitle: followUp.title,
    personName: person?.name || "",
  });

  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="fu-edit-title">Engagement</label>
      <input id="fu-edit-title" type="text" value="${escapeAttr(followUp.title)}" />
    </div>
    <div class="field">
      <label for="fu-edit-status">Statut</label>
      <select id="fu-edit-status">
        ${followUpsApi.STATUSES.map((s) => `<option value="${s}" ${s === followUp.status ? "selected" : ""}>${followUpsApi.STATUS_LABELS[s]}</option>`).join("")}
      </select>
    </div>
    <div class="field">
      <label>Sens</label>
      <div class="chip-row">
        ${followUpsApi.DIRECTIONS.map(
          (d) => `<label class="chip-radio"><input type="radio" name="fu-edit-direction" value="${d}" ${d === (followUp.direction || "waiting_on") ? "checked" : ""} /> ${followUpsApi.DIRECTION_LABELS[d]}</label>`
        ).join("")}
      </div>
    </div>
    <div class="field" id="fu-edit-category-field" style="display:${followUp.direction === "to_tell" ? "" : "none"};">
      <label for="fu-edit-category">Catégorie (pour le point manager, optionnel)</label>
      <select id="fu-edit-category">
        <option value="">— Aucune —</option>
        ${followUpsApi.CATEGORIES.map((c) => `<option value="${c}" ${c === followUp.category ? "selected" : ""}>${followUpsApi.CATEGORY_LABELS[c]}</option>`).join("")}
      </select>
    </div>
    <div class="field" id="fu-edit-due-field" style="display:${followUp.direction === "to_tell" ? "none" : ""};">
      <label for="fu-edit-due">Échéance de la personne</label>
      <input id="fu-edit-due" type="date" value="${followUp.dueDate || ""}" />
    </div>
    <div class="field">
      <label for="fu-edit-control" id="fu-edit-control-label">${followUp.direction === "to_tell" ? "Avant quand dois-je lui en parler ?" : "Prochain contrôle"}</label>
      <input id="fu-edit-control" type="date" value="${followUp.controlDate || ""}" />
    </div>
    <div class="field">
      <label for="fu-edit-project">Projet</label>
      <select id="fu-edit-project">
        <option value="">— Aucun —</option>
        ${sortProjectsByName(projects).map((p) => `<option value="${p.id}" ${p.id === followUp.projectId ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("")}
      </select>
      <button type="button" id="fu-edit-new-project-btn" class="btn btn-ghost btn-sm" style="margin-top:6px;">+ Nouveau projet</button>
      <div id="fu-edit-new-project-row" style="display:none;gap:8px;margin-top:6px;">
        <input id="fu-edit-new-project-name" type="text" placeholder="Nom du nouveau projet" style="flex:1;border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:var(--space-3);" />
        <button type="button" id="fu-edit-new-project-confirm" class="btn btn-secondary btn-sm">Créer</button>
      </div>
    </div>
    <div class="field">
      <label>Élément notable ? (préparation EADP, optionnel)</label>
      <div class="chip-row">
        <label class="chip-radio"><input type="radio" name="fu-edit-notable" value="" ${!followUp.notable ? "checked" : ""} /> Aucun</label>
        <label class="chip-radio"><input type="radio" name="fu-edit-notable" value="positive" ${followUp.notable === "positive" ? "checked" : ""} /> 👍 Positif</label>
        <label class="chip-radio"><input type="radio" name="fu-edit-notable" value="negative" ${followUp.notable === "negative" ? "checked" : ""} /> 👎 Négatif</label>
      </div>
    </div>
    <div class="field">
      <label for="fu-edit-description">Description</label>
      <textarea id="fu-edit-description" placeholder="Contexte libre">${escapeHtml(followUp.description || "")}</textarea>
    </div>
    <div class="section-title" id="fu-edit-checklist-title">☑️ Sous-étapes (${(followUp.checklist || []).filter((c) => c.done).length}/${(followUp.checklist || []).length})</div>
    <div id="fu-edit-checklist" style="margin-bottom:16px;"></div>
    <div class="section-title">🗓️ Réunion</div>
    <div class="field" style="margin-bottom:8px;">
      <input id="meeting-title-preview" type="text" readonly value="${escapeAttr(meetingTitle)}" />
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
      <button id="copy-meeting-title-btn" type="button" class="btn btn-secondary btn-sm">📋 Copier le titre</button>
      <button id="create-meeting-btn" type="button" class="btn btn-secondary btn-sm">🗓️ Créer une réunion (.ics)</button>
    </div>
    <div class="section-title">🗒️ Notes</div>
    <div id="detail-notes" style="margin-bottom:16px;"></div>
    <div class="section-title">🔗 Lié</div>
    <div class="card" id="detail-links" style="margin-bottom:8px;"></div>
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <button id="link-existing-btn" class="btn btn-secondary btn-sm">🔗 Lier une fiche</button>
      <button id="create-linked-btn" class="btn btn-secondary btn-sm">+ Créer et lier</button>
    </div>
  `;

  body.querySelector("#fu-edit-new-project-btn").addEventListener("click", () => {
    const row = body.querySelector("#fu-edit-new-project-row");
    row.style.display = row.style.display === "none" ? "flex" : "none";
    if (row.style.display === "flex") body.querySelector("#fu-edit-new-project-name").focus();
  });
  body.querySelector("#fu-edit-new-project-confirm").addEventListener("click", async () => {
    const name = body.querySelector("#fu-edit-new-project-name").value.trim();
    if (!name) return;
    const project = await projectsApi.createProject({ name });
    const select = body.querySelector("#fu-edit-project");
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.name;
    const options = [...select.options].filter((o) => o.value);
    const insertBefore = options.find((o) => o.textContent.localeCompare(project.name, "fr") > 0);
    select.insertBefore(option, insertBefore || null);
    select.value = project.id;
    body.querySelector("#fu-edit-new-project-name").value = "";
    body.querySelector("#fu-edit-new-project-row").style.display = "none";
    showToast("Projet créé");
  });

  const checklistTitleEl = body.querySelector("#fu-edit-checklist-title");
  function updateChecklistTitle() {
    const list = followUp.checklist || [];
    checklistTitleEl.textContent = `☑️ Sous-étapes (${list.filter((c) => c.done).length}/${list.length})`;
  }
  renderChecklist(body.querySelector("#fu-edit-checklist"), followUp.checklist || [], {
    onAdd: async (text) => {
      const updated = await followUpsApi.addChecklistItem(followUp.id, text);
      followUp.checklist = updated;
      updateChecklistTitle();
      return updated;
    },
    onToggle: async (itemId, done) => {
      const updated = await followUpsApi.toggleChecklistItem(followUp.id, itemId, done);
      followUp.checklist = updated;
      updateChecklistTitle();
      return updated;
    },
    onRemove: async (itemId) => {
      const updated = await followUpsApi.removeChecklistItem(followUp.id, itemId);
      followUp.checklist = updated;
      updateChecklistTitle();
      return updated;
    },
  });

  renderNotesBlock(body.querySelector("#detail-notes"), followUp.notesLog || [], {
    onAdd: async (text) => {
      const updated = await followUpsApi.addNote(followUp.id, text);
      followUp.notesLog = updated;
      return updated;
    },
  });
  body.querySelector("#copy-meeting-title-btn").addEventListener("click", () => {
    copyMeetingTitle(meetingTitle);
  });
  body.querySelector("#create-meeting-btn").addEventListener("click", () => {
    closeModal();
    launchMeetingFromEntity({
      ref: { type: "FollowUp", id: followUp.id },
      routeHash: "#/people",
      title: meetingTitle,
      onLinked: () => openEditFollowUpModal(followUp, { onDone }),
      onCancel: () => openEditFollowUpModal(followUp, { onDone }),
    });
  });

  body.querySelectorAll('input[name="fu-edit-direction"]').forEach((r) =>
    r.addEventListener("change", () => {
      const isToTell = r.value === "to_tell";
      if (!r.checked) return;
      body.querySelector("#fu-edit-category-field").style.display = isToTell ? "" : "none";
      body.querySelector("#fu-edit-due-field").style.display = isToTell ? "none" : "";
      body.querySelector("#fu-edit-control-label").textContent = isToTell ? "Avant quand dois-je lui en parler ?" : "Prochain contrôle";
    })
  );

  const linkRef = { type: "FollowUp", id: followUp.id };
  linkedItemsApi.renderLinkedSection(body.querySelector("#detail-links"), linkRef);
  body.querySelector("#link-existing-btn").addEventListener("click", () => {
    closeModal();
    linkedItemsApi.openLinkPickerModal(linkRef, followUp.title, {
      onLinked: () => openEditFollowUpModal(followUp, { onDone }),
      onCancel: () => openEditFollowUpModal(followUp, { onDone }),
    });
  });
  body.querySelector("#create-linked-btn").addEventListener("click", () => {
    closeModal();
    linkedItemsApi.openCreateAndLinkModal(linkRef, followUp.title, {
      onLinked: () => openEditFollowUpModal(followUp, { onDone }),
      onCancel: () => openEditFollowUpModal(followUp, { onDone }),
    });
  });

  const { bodyEl, close } = openModal({
    title: "Modifier le suivi",
    body,
    actions: [
      { label: "Fermer", variant: "ghost", onClick: () => onDone?.() },
      {
        // "Exporter la vue d'ensemble" (retour de Charles-Henri, vague 22, option (c) retenue
        // parmi les 3 propositions de visualisation automatique) — voir
        // js/components/overviewExport.js et le même bouton sur la fiche Tâche (kanban.js).
        label: "📄 Exporter",
        variant: "secondary",
        closesModal: false,
        onClick: () =>
          exportFollowUpOverview(followUp, {
            project: followUpProject,
            person,
            statusLabel: followUpsApi.STATUS_LABELS[followUp.status],
            directionLabel: followUpsApi.DIRECTION_LABELS[followUp.direction || "waiting_on"],
          }),
      },
      {
        label: "🗑️ Supprimer",
        variant: "danger",
        closesModal: false,
        onClick: () => {
          closeModal();
          confirmDelete({
            title: "Supprimer ce suivi ?",
            message: `« ${followUp.title} » sera définitivement supprimé.`,
            onConfirm: async () => {
              await followUpsApi.removeFollowUp(followUp.id);
              showToast("Suivi supprimé");
              onDone?.();
            },
            onCancel: () => openEditFollowUpModal(followUp, { onDone }),
          });
        },
      },
      {
        label: "Enregistrer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          const direction = bodyEl.querySelector('input[name="fu-edit-direction"]:checked')?.value || "waiting_on";
          await followUpsApi.updateFollowUp(followUp.id, {
            title: bodyEl.querySelector("#fu-edit-title").value.trim(),
            status: bodyEl.querySelector("#fu-edit-status").value,
            direction,
            category: direction === "to_tell" ? bodyEl.querySelector("#fu-edit-category").value || null : null,
            notable: bodyEl.querySelector('input[name="fu-edit-notable"]:checked')?.value || null,
            dueDate: direction === "to_tell" ? null : bodyEl.querySelector("#fu-edit-due").value || null,
            controlDate: bodyEl.querySelector("#fu-edit-control").value || null,
            projectId: bodyEl.querySelector("#fu-edit-project").value || null,
            description: bodyEl.querySelector("#fu-edit-description").value.trim(),
          });
          close();
          showToast("Suivi mis à jour");
          onDone?.();
        },
      },
    ],
  });
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}
