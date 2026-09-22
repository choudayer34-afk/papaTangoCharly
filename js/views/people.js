// Vue Équipe — §31 (liste) et §32 (fiche collaborateur simplifiée).

import * as peopleApi from "../domain/people.js";
import * as followUpsApi from "../domain/followups.js";
import * as projectsApi from "../domain/projects.js";
import * as historyApi from "../domain/history.js";
import * as objectivesApi from "../domain/objectives.js";
import * as preferencesApi from "../domain/preferences.js";
import { openModal, closeModal, confirmDelete, guardClick } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { showHintOnce } from "../components/hint.js";
import { renderHistoryTimeline } from "../components/historyTimeline.js";
import * as linkedItemsApi from "../components/linkedItems.js";
import { renderNotesBlock } from "../components/notesBlock.js";
import { renderChecklist } from "../components/checklist.js";
import { buildMeetingTitle, copyMeetingTitle, launchMeetingFromEntity } from "../components/meetingLauncher.js";
import { renderManagerSection } from "./management.js";
import { renderWorkloadSection } from "./workload.js";
import { renderFollowUpsOverview } from "./followupsOverview.js";
import { attachProjectQuickCreate } from "./projects.js";
import * as workloadApi from "../domain/workload.js";
import { renderInfoTip } from "../components/infoTip.js";
import { renderShortcutAssignButton } from "../services/shortcuts.js";
import { renderMaskChecklist } from "./prepMask.js";
import { openChangeTypeModal } from "../components/changeType.js";
import { copyEntityLink } from "../components/copyLink.js";
import { renderTagsEditor } from "../components/tagsEditor.js";
import { guideLinkHtml } from "./guide.js";
import * as dateUtils from "../services/dateUtils.js";

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
      <!-- Rail façon "Réglages iPhone" (COMP-UX-021 / USE-UX-021, LOT 9 : "Management invisible,
           traité comme un filtre caché" — même remède que pilotageSubNav.js : réutilisation de
           la classe fiche-tabs sur une rangée qui n'était jusqu'ici qu'une classe chip-row
           ordinaire, pour que "👔 Mon manager" (et les 3 autres modes) se lisent comme de vrais
           sous-onglets de l'écran Équipe plutôt que comme un filtre secondaire. Aucun changement
           de comportement : mêmes 4 modes, même logique de bascule ci-dessous. -->
      <div class="chip-row fiche-tabs" id="people-mode-toggle" role="tablist">
        <button type="button" class="chip" data-mode="all" role="tab">👥 Tous</button>
        <button type="button" class="chip" data-mode="manager" role="tab">👔 Mon manager</button>
        <button type="button" class="chip" data-mode="load" role="tab">⚖️ Charge</button>
        <button type="button" class="chip" data-mode="followups" role="tab">👀 Suivis</button>
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
  let projects = [];
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

    // "⚖️ Charge" (vague 34, retour de Charles-Henri : assistant de répartition de charge) —
    // même principe que "👔 Mon manager" ci-dessus, un 3e mode du même chip-row plutôt qu'un
    // onglet séparé (voir js/views/workload.js).
    if (mode === "load") {
      const collaborateurs = people.filter((p) => p.type !== "manager");
      subtitleEl.textContent = collaborateurs.length
        ? `${collaborateurs.length} collaborateur${collaborateurs.length > 1 ? "s" : ""}`
        : "Pas encore de collaborateur renseigné";
      renderWorkloadSection(listEl, people, followUps);
      return;
    }

    // "👀 Suivis" (retour de Charles-Henri, 13/09/2026 : "disposer d'une vue pour voir les
    // suivis ou choses à dire", précisé ensuite : une vue TRANSVERSE tous projets/personnes
    // confondus) — même principe que "⚖️ Charge" juste au-dessus, un 4e mode du même chip-row.
    if (mode === "followups") {
      const active = followUps.filter((f) => f.status !== "done");
      subtitleEl.textContent = active.length
        ? `${active.length} suivi(s) en cours`
        : "Rien en cours — tout est réglé";
      renderFollowUpsOverview(listEl, people, followUps, projects);
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
  // Uniquement pour résoudre le nom de projet affiché par "👀 Suivis" (voir
  // js/views/followupsOverview.js) — jamais utilisé par les 3 autres modes.
  const unsubProjects = projectsApi.subscribe((items) => {
    projects = items;
    render();
  });

  return function cleanup() {
    unsubPeople();
    unsubFollowUps();
    unsubProjects();
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
// `initialTab` (22/09/2026, bug révélé par le premier passage réel des tests LOT 11 sur GitHub
// Actions — voir tests/e2e/lot11-objective-unified-model.spec.js) : `reopen()` plus bas
// rouvrait TOUJOURS cette fiche sur l'onglet "Suivis", quel que soit l'onglet réellement actif
// au moment de l'action (ex. ajouter un objectif depuis l'onglet "Objectifs" renvoyait ensuite
// sur "Suivis", cachant l'objectif qu'on venait de créer). Paramètre optionnel, par défaut
// "followups" pour ne rien changer aux appelants externes (js/components/search.js,
// js/components/linkedItems.js, js/views/management.js, js/views/workload.js) qui n'ouvrent
// jamais la fiche sur un autre onglet que le premier.
export async function openPersonDetail(person, allFollowUps, { initialTab = "followups" } = {}) {
  preferencesApi.recordRecentlyViewed("Person", person.id).catch(() => {});
  // Fusion des deux "Notes" (vague 19, audit de simplification) — voir peopleApi.migrateLegacyNotes.
  person = (await peopleApi.migrateLegacyNotes(person.id)) || person;
  const own = sortByCreatedDesc(allFollowUps.filter((f) => f.personId === person.id));
  const done = own.filter((f) => f.status === "done");

  // BUG corrigé (15/09/2026, audit performance) : rechargeait l'historique ENTIER de l'app pour
  // n'en garder que celui de cette personne et de ses Suivis — voir js/domain/history.js#
  // listForEntities.
  const [allHistory, allObjectives, allProjects] = await Promise.all([
    historyApi.listForEntities([{ entityType: "Person", entityId: person.id }, ...own.map((f) => ({ entityType: "FollowUp", entityId: f.id }))]),
    objectivesApi.listAll(),
    projectsApi.listAll(),
  ]);
  const objectives = allObjectives.filter((o) => o.personId === person.id);

  // Engagements en attente organisés par projet puis par date la plus proche (retour de
  // Charles-Henri, 06/09/2026 : "organisé par projet ou par date d'échéance") — même principe
  // et mêmes fonctions déjà éprouvées côté "🎯 À aborder" de la préparation de point
  // (`soonestDate`/`groupByProject`/`renderGroupedFollowUpList`, voir `computePrepSections`) :
  // trié par date la plus proche d'abord, puis regroupé par projet en conservant cet ordre à
  // l'intérieur de chaque groupe (donc du plus urgent au moins urgent, groupe par groupe).
  const active = [...own.filter((f) => f.status !== "done" && f.direction !== "to_tell")].sort(
    (a, b) => soonestDate(a) - soonestDate(b)
  );
  const toTell = [...own.filter((f) => f.status !== "done" && f.direction === "to_tell")].sort(
    (a, b) => soonestDate(a) - soonestDate(b)
  );
  const activeGroups = groupByProject(active, allProjects);
  const toTellGroups = groupByProject(toTell, allProjects);

  // §38 "Où en est Clément ?" : l'historique d'une personne, c'est le sien plus celui de
  // tous ses suivis — même principe que l'agrégation faite côté fiche Projet (§46).
  const trackedKeys = new Set([`Person:${person.id}`, ...own.map((f) => `FollowUp:${f.id}`)]);
  const personHistory = allHistory
    .filter((h) => trackedKeys.has(`${h.entityType}:${h.entityId}`))
    .sort((a, b) => a.date - b.date);

  // Fiche à onglets (vague 25, retour de Charles-Henri : "idem dans la fiche du collaborateur
  // j'aimerai une organisation piste A" — voir claude/vague-25-onglets-fiches-controle-suivi.md,
  // section 4, pour l'inventaire complet et le découpage validé). En-tête toujours visible
  // (Nom, Type, Rôle, raccourci clavier, et les boutons Préparer mon point/EADP — gardés hors
  // onglets car ils lancent un autre écran plutôt que d'afficher du contenu de la fiche), puis
  // 4 onglets : Suivis (Engagements en cours/À transmettre/+ Suivi/Réalisé), Objectifs, Notes &
  // repères (Journal de notes/Repères managériaux) et Activité (Historique/Lié). AUCUN champ,
  // bouton ou id n'est retiré ni renommé par rapport à la version précédente.
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
    <div style="display:flex;gap:8px;margin-bottom:8px;">
      <button id="prep-btn" class="btn btn-secondary btn-block">🗒️ Préparer mon point</button>
      <button id="eadp-btn" class="btn btn-secondary btn-block">📋 Préparer l'EADP</button>
    </div>
    <div style="margin-bottom:16px;">${guideLinkHtml("usecase-eadp", "📖 Bien préparer un point ou une EADP")}</div>

    <div class="chip-row fiche-tabs" role="tablist">
      <button type="button" class="chip${initialTab === "followups" ? " active" : ""}" data-tab="followups" role="tab">Suivis</button>
      <button type="button" class="chip${initialTab === "objectives" ? " active" : ""}" data-tab="objectives" role="tab" id="fiche-tab-objectives">Objectifs (${objectives.length})</button>
      <button type="button" class="chip${initialTab === "notes" ? " active" : ""}" data-tab="notes" role="tab">Notes &amp; repères</button>
      <button type="button" class="chip${initialTab === "activity" ? " active" : ""}" data-tab="activity" role="tab">Activité</button>
    </div>

    <div class="fiche-tabpanel" data-tabpanel="followups" ${initialTab === "followups" ? "" : "hidden"}>
      <div class="section-title" style="margin-top:0;">🎯 Engagements en cours (${active.length})</div>
      <div class="card" id="active-followups" style="margin-bottom:16px;"></div>
      <div class="section-title">📣 À transmettre (${toTell.length})</div>
      <div class="card" id="to-tell-followups" style="margin-bottom:16px;"></div>
      <button id="add-followup-btn" class="btn btn-secondary btn-sm btn-block" style="margin-bottom:16px;">+ Suivi</button>
      <div class="section-title">🟢 Réalisé (${done.length})</div>
      <div class="card" id="done-followups" style="margin-bottom:16px;"></div>
    </div>

    <div class="fiche-tabpanel" data-tabpanel="objectives" ${initialTab === "objectives" ? "" : "hidden"}>
      <div class="section-header-row">
        <div class="section-title" style="margin-top:0;">🎯 Objectifs (${objectives.length})</div>
        <button type="button" id="add-objective-btn" class="btn btn-ghost btn-sm">+ Ajouter</button>
      </div>
      <div class="card" id="person-objectives" style="margin-bottom:16px;"></div>
    </div>

    <div class="fiche-tabpanel" data-tabpanel="notes" ${initialTab === "notes" ? "" : "hidden"}>
      <div class="section-title" style="margin-top:0;">🗒️ Journal de notes</div>
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
    </div>

    <div class="fiche-tabpanel" data-tabpanel="activity" ${initialTab === "activity" ? "" : "hidden"}>
      <details>
        <summary class="section-title" style="cursor:pointer;margin-top:0;">🕒 Historique (${personHistory.length})</summary>
        <div class="card" id="person-history" style="margin-top:8px;margin-bottom:16px;"></div>
      </details>
      <div class="section-title">🏷️ Tags</div>
      <div id="detail-tags" style="margin-bottom:16px;"></div>
      <div class="section-title">🔗 Lié</div>
      <div class="card" id="detail-links" style="margin-bottom:8px;"></div>
      <div style="display:flex;gap:8px;margin-bottom:16px;">
        <button id="link-existing-btn" class="btn btn-secondary btn-sm">🔗 Lier une fiche</button>
        <button id="create-linked-btn" class="btn btn-secondary btn-sm">+ Créer et lier</button>
      </div>
    </div>
  `;

  // Bascule d'onglet — même mécanique que la fiche Tâche (voir js/views/kanban.js#openTaskDetail) :
  // chaque panneau existe en permanence, seul l'attribut `hidden` change. `activeTab` (22/09/2026,
  // voir le commentaire sur `initialTab` en tête de fonction) retient l'onglet courant pour que
  // `reopen()` puisse y revenir plutôt que de systématiquement retomber sur "Suivis".
  let activeTab = initialTab;
  body.querySelectorAll(".fiche-tabs .chip").forEach((tabBtn) => {
    tabBtn.addEventListener("click", () => {
      activeTab = tabBtn.dataset.tab;
      body.querySelectorAll(".fiche-tabs .chip").forEach((b) => b.classList.toggle("active", b === tabBtn));
      body.querySelectorAll(".fiche-tabpanel").forEach((panel) => {
        panel.hidden = panel.dataset.tabpanel !== tabBtn.dataset.tab;
      });
    });
  });

  // Rouvre la fiche avec des données fraîches — utilisé par toute action menée depuis une
  // modale imbriquée (créer/modifier/supprimer un suivi), plutôt que de laisser la fiche
  // fermée après l'action (bug connu signalé par Charles-Henri : la création d'un suivi
  // refermait la fiche au lieu d'y rester, contrairement au pattern déjà en place pour les
  // ressources liées à un projet/une tâche). Repasse `activeTab` en `initialTab` de la
  // réouverture (voir plus haut) pour rester sur l'onglet où l'action a été lancée.
  const reopen = async () => openPersonDetail(person, await followUpsApi.listAll(), { initialTab: activeTab });

  const activeEl = body.querySelector("#active-followups");
  renderGroupedFollowUpList(activeEl, activeGroups, {
    onOpen: (f) => {
      closeModal();
      openEditFollowUpModal(f, { onDone: reopen });
    },
  });
  const toTellEl = body.querySelector("#to-tell-followups");
  renderGroupedFollowUpList(toTellEl, toTellGroups, {
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
  renderTagsEditor(body.querySelector("#detail-tags"), "Person", person.id);
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
  renderObjectivesList(objectivesEl, objectives, person, reopen, allProjects);
  body.querySelector("#add-objective-btn").addEventListener("click", () => {
    closeModal();
    openCreateObjectiveModal(person, { onDone: reopen });
  });

  const { bodyEl, close } = openModal({
    title: (person.type === "manager" ? "👔 " : "👤 ") + person.name,
    body,
    actions: [
      { icon: "✕", label: "Fermer", variant: "ghost", compact: true },
      {
        // Lien de partage (retour de Charles-Henri, vague 23) — voir js/components/copyLink.js.
        icon: "🔗",
        label: "Copier le lien",
        variant: "secondary",
        compact: true,
        closesModal: false,
        onClick: () => copyEntityLink("#/people", "Person", person.id),
      },
      {
        icon: "🗑️",
        label: "Supprimer",
        variant: "danger",
        compact: true,
        closesModal: false,
        onClick: () => {
          closeModal();
          // Impact réel avant confirmation (LOT 1, TODO-007 — UX-001/DATA-003) : `own` (Suivis)
          // et `objectives` (Objectifs liés à cette personne) sont déjà calculés plus haut dans
          // cette même fonction, pas de requête supplémentaire. `removePerson` ne cascade
          // toujours pas (politique assumée, voir js/domain/people.js) : ces entités perdent
          // seulement leur lien, elles ne sont pas supprimées avec la personne.
          const impactParts = [
            own.length ? `${own.length} suivi${own.length > 1 ? "s" : ""}` : null,
            objectives.length ? `${objectives.length} objectif${objectives.length > 1 ? "s" : ""}` : null,
          ].filter(Boolean);
          const impactSentence = impactParts.length
            ? ` ${new Intl.ListFormat("fr", { type: "conjunction" }).format(impactParts)} qui lui étaient rattaché(e)s ne seront pas supprimé(e)s — ils perdent simplement leur lien vers cette personne.`
            : " Rien n'y est rattaché aujourd'hui.";
          confirmDelete({
            title: "Supprimer cette personne ?",
            message: `« ${person.name} » sera définitivement supprimée.${impactSentence}`,
            onConfirm: async () => {
              await peopleApi.removePerson(person.id);
              showToast("Personne supprimée");
            },
            onCancel: () => reopen(),
          });
        },
      },
      {
        icon: "💾",
        label: "Enregistrer",
        variant: "primary",
        compact: true,
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
 * écran pendant que celle-ci reste affichée (et partagée en visio) sur le premier.
 *
 * BUG corrigé (retour de Charles-Henri, vague 22 octies : "ça marche pas sur iphone en mode
 * signet sur écran d'accueil") : une PWA iOS lancée depuis l'écran d'accueil (mode "standalone",
 * `navigator.standalone === true`, propriété exclusive à iOS Safari) n'a structurellement qu'un
 * seul écran ET qu'une seule fenêtre — WebKit y bloque `window.open()` ou, pire, quitte l'app
 * installée pour rouvrir l'URL dans Safari, cassant complètement l'expérience "app" au lieu de
 * simplement échouer proprement. Comme il n'existe de toute façon aucun second écran à viser
 * dans ce contexte, la fenêtre séparée n'a plus aucun sens : on affiche alors EXACTEMENT la même
 * checklist de masquage (`renderMaskChecklist`, factorisée avec `js/views/prepMask.js` pour ne
 * jamais diverger) dans une modale in-app classique — le masquage reste disponible partout,
 * seule la présentation "fenêtre à part, déplaçable" est spécifique à un poste avec plusieurs
 * écrans, là où elle a un sens.
 *
 * BUG corrigé (retour de Charles-Henri, vague 39, 08/09/2026 : "sur PC en mode installé, la
 * fenêtre reste bloquée sur le texte d'intro sans jamais afficher la checklist ; sur PC web, ça
 * finit par s'afficher mais après ~20 secondes"). Racine du problème : la fenêtre séparée
 * naviguait vers la route dédiée `#/prep-mask`, ce qui rechargeait l'app ENTIÈRE dans cette
 * nouvelle fenêtre — donc une SECONDE instance de Firebase/Firestore avec sa propre
 * persistance IndexedDB (voir js/services/firebase.js#persistentMultipleTabManager), en
 * concurrence avec celle déjà active dans la fenêtre principale. Deux clients Firestore du même
 * compte doivent négocier entre eux lequel détient le "bail" IndexedDB principal avant de
 * pouvoir lire quoi que ce soit — une négociation qui prenait ~20 s sur un onglet de navigateur
 * classique, et qui semblait ne jamais aboutir dans une fenêtre d'app installée (partitionnement
 * différent selon les versions de Chrome/Edge pour les fenêtres d'app autonomes).
 *
 * Corrigé en ouvrant une fenêtre VIERGE (`window.open("", ...)`, pas d'URL, donc aucun
 * rechargement de l'app ni second client Firestore) et en y construisant directement le DOM
 * depuis CETTE fenêtre, avec les feuilles de style copiées et le même `renderMaskChecklist` —
 * la checklist tourne alors sur le client Firestore déjà actif et déjà "primaire" de la fenêtre
 * principale, sans négociation d'aucune sorte. La route `#/prep-mask` (js/views/prepMask.js#
 * renderPrepMask) n'est donc plus utilisée par ce chemin ; elle reste en place sans dommage,
 * simplement inerte, au cas où une ancienne fenêtre garderait ce lien en mémoire.
 *
 * Le "Point avec X" (openPrepModal, l'écran effectivement partagé) ne s'ouvre qu'une fois cette
 * fenêtre refermée (poll sur `win.closed`) — inutile d'échanger des messages entre les deux
 * fenêtres : le masquage se persiste au fil de l'eau (`followUpsApi.updateFollowUp(...,
 * { hiddenFromPrep })`), donc `openPrepModal`, en relisant les données fraîches, applique déjà
 * le bon filtre dès qu'il s'ouvre à son tour.
 */
function openPrepMaskThenPrep(person, { onDone } = {}) {
  if (window.navigator.standalone === true) {
    openPrepMaskModal(person, { onDone });
    return;
  }
  const win = window.open("", "prepMask-" + person.id, "width=480,height=760,menubar=no,toolbar=no,location=no,status=no");
  if (!win) {
    // Popup bloquée par le navigateur (ou tout autre contexte où window.open ne renvoie
    // simplement rien d'utilisable) : on retombe sur la même modale in-app plutôt que de priver
    // Charles-Henri du masquage — seule la présentation "fenêtre à part" n'est pas possible ici.
    openPrepMaskModal(person, { onDone });
    return;
  }
  win.document.title = `Masquer — Point avec ${person.name}`;
  // Copie les feuilles de style de la fenêtre principale (deux seulement, voir index.html) —
  // `link.href` (propriété résolue) plutôt que l'attribut brut, pour rester correct quel que
  // soit le chemin de déploiement, la fenêtre neuve n'ayant pas la même URL de base.
  document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    const clone = win.document.createElement("link");
    clone.rel = "stylesheet";
    clone.href = link.href;
    win.document.head.appendChild(clone);
  });
  const wrapper = win.document.createElement("div");
  wrapper.className = "view";
  wrapper.style.cssText = "max-width:520px;margin:0 auto;padding:20px;";
  wrapper.innerHTML = `
    <h1 style="margin-top:0;">🙈 Avant de partager</h1>
    <p class="item-meta" style="margin-bottom:20px;">
      Cette fenêtre est privée — garde-la sur ton écran, ou déplace-la sur un second si tu en as
      un. Ferme-la quand tu es prêt : le point s'ouvrira automatiquement dans l'autre fenêtre.
    </p>
    <div id="mask-checklist"></div>
  `;
  win.document.body.appendChild(wrapper);
  renderMaskChecklist(wrapper.querySelector("#mask-checklist"), person, {
    closeLabel: "✅ Terminé — fermer cette fenêtre",
    onClose: () => win.close(),
  });
  win.focus();
  const poll = setInterval(() => {
    if (win.closed) {
      clearInterval(poll);
      openPrepModal(person, { onDone });
    }
  }, 400);
}

/**
 * Repli in-app de la fenêtre de masquage (voir commentaire ci-dessus) — même checklist, dans
 * une modale classique plutôt qu'une fenêtre séparée. `onClose` de `openModal` (déclenché une
 * seule fois quel que soit le chemin de fermeture — bouton, Échap, clic en dehors, voir
 * js/components/modal.js) ouvre le point ensuite : fermer cette modale de N'IMPORTE QUELLE
 * façon a le même effet que fermer la fenêtre séparée sur un poste avec plusieurs écrans.
 */
function openPrepMaskModal(person, { onDone } = {}) {
  const body = document.createElement("div");
  const { bodyEl, close } = openModal({
    title: "🙈 Avant de partager",
    body,
    actions: [],
    onClose: () => openPrepModal(person, { onDone }),
  });
  renderMaskChecklist(bodyEl, person, { closeLabel: "✅ Voir le point", onClose: () => close() });
}

async function openPrepModal(person, { onDone, coveredIds = new Set() } = {}) {
  const [allFollowUps, projects] = await Promise.all([followUpsApi.listAll(), projectsApi.listAll()]);
  const { overdue, toTell, upcoming, upcomingGroups, recentlyDone } = computePrepSections(person, allFollowUps, projects);
  // Tous les sujets de la personne, sans exception (retour de Charles-Henri, vague 41,
  // 09/09/2026 : "pouvoir faire une recherche lors d'un point [...] sur l'ensemble des sujets
  // d'une personne") — contrairement aux 4 sections ci-dessus (curatées : "En retard"/"À
  // transmettre"/"À aborder"/5 derniers "Terminé"), la recherche porte sur TOUT, y compris les
  // sujets terminés au-delà des 5 plus récents et les sujets masqués du point partagé
  // (`hiddenFromPrep` — recherche privée pour soi, pas d'enjeu à les exclure ici).
  const ownAll = allFollowUps.filter((f) => f.personId === person.id).sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));

  const remaining = [...overdue, ...toTell, ...upcoming].filter((f) => !coveredIds.has(f.id)).length;

  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field" style="margin-bottom:12px;">
      <input id="prep-search" type="text" placeholder="🔎 Chercher dans tous les sujets de ${escapeAttr(person.name)}..." />
    </div>
    <div class="item-meta" style="margin-bottom:12px;" id="prep-remaining">☑️ ${remaining === 0 ? "Tous les sujets ont été vus." : `${remaining} sujet(s) restant(s) à passer.`}</div>
    <div id="prep-sections">
      <div class="section-title" style="margin-top:0;">🔴 En retard de contrôle (${overdue.length})</div>
      <div class="card" id="prep-overdue" style="margin-bottom:16px;"></div>
      <div class="section-title">📣 À transmettre (${toTell.length})</div>
      <div class="card" id="prep-to-tell" style="margin-bottom:16px;"></div>
      <div class="section-title">🎯 À aborder (${upcoming.length})</div>
      <div class="card" id="prep-upcoming" style="margin-bottom:16px;"></div>
      <div class="section-title">🟢 Terminé récemment (${recentlyDone.length})</div>
      <div class="card" id="prep-done" style="margin-bottom:8px;"></div>
    </div>
    <div id="prep-search-results" hidden>
      <div class="section-title" style="margin-top:0;">🔎 Résultats</div>
      <div class="card" id="prep-search-list" style="margin-bottom:8px;"></div>
    </div>
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

  const sectionsEl = body.querySelector("#prep-sections");
  const remainingEl = body.querySelector("#prep-remaining");
  const resultsWrap = body.querySelector("#prep-search-results");
  const resultsList = body.querySelector("#prep-search-list");
  // BUG corrigé (15/09/2026, audit performance) : aucun anti-rebond sur cette recherche — chaque
  // frappe reconstruisait toute la liste. Voir js/views/kanban.js, même correctif.
  let prepSearchDebounce = null;
  body.querySelector("#prep-search").addEventListener("input", (e) => {
    const value = e.target.value;
    clearTimeout(prepSearchDebounce);
    prepSearchDebounce = setTimeout(() => {
      const needle = value.trim().toLowerCase();
      if (!needle) {
        sectionsEl.hidden = false;
        remainingEl.hidden = false;
        resultsWrap.hidden = true;
        return;
      }
      sectionsEl.hidden = true;
      remainingEl.hidden = true;
      resultsWrap.hidden = false;
      const matches = ownAll.filter(
        (f) => f.title.toLowerCase().includes(needle) || (f.description || "").toLowerCase().includes(needle)
      );
      renderFollowUpList(resultsList, matches, { onOpen: openFromPrep });
    }, 150);
  });

  openModal({
    title: `🗒️ Point avec ${person.name}`,
    body,
    actions: [
      {
        // "un sujet peut apparaître pendant le point" (retour de Charles-Henri, vague 38) : un
        // sujet créé ici suit exactement le même chemin qu'un Suivi créé n'importe où ailleurs
        // (`openCreateFollowUpModal`, même formulaire, même regroupement par projet au retour) —
        // aucune saisie parallèle à maintenir. Il est marqué "vu" (`coveredIds`) dès sa création :
        // il vient d'être discuté en direct, inutile de repasser dessus ensuite dans la même
        // séance. Note : si plusieurs sujets sont ajoutés à la suite via "+ Encore un suivi"
        // (voir promptAnotherFollowUp), seul le DERNIER de la série est marqué vu automatiquement
        // — les précédents apparaissent bien à la reprise (relus depuis le stockage) mais pas
        // encore cochés ; à cocher à la main si besoin.
        icon: "➕",
        label: "Sujet apparu",
        variant: "secondary",
        compact: true,
        closesModal: false,
        onClick: () => {
          closeModal();
          openCreateFollowUpModal({
            person,
            onCreated: (created) => {
              if (created) coveredIds.add(created.id);
              openPrepModal(person, { onDone, coveredIds });
            },
            onCancel: () => openPrepModal(person, { onDone, coveredIds }),
          });
        },
      },
      { label: "Fermer", variant: "ghost", onClick: () => onDone?.() },
    ],
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
// TODO-030 (retour direct de Charles-Henri, 22/09/2026 : "je dois sur échéances et prochain
// contrôle pouvoir disposer d'un bouton pour ajouter directement +1 jours ou +7 jours comme sur
// le kanban [...] dans le point avec le collaborateur et dans la fiche elle-même") — reprend tel
// quel le contrôle "+1j / +7j / date libre" du Kanban (js/views/kanban.js#renderCard, classes
// CSS `.kanban-card-postpone`/`.kanban-postpone-btn`/`.kanban-postpone-custom` réutilisées à
// l'identique) et le calcul `dateUtils.addDaysToIsoDate` désormais partagé (voir son commentaire
// dans js/services/dateUtils.js). Posé ici, dans `appendFollowUpRows`, plutôt que sur le
// formulaire de création/édition (`#fu-due`/`#fu-control`, périmètre initialement envisagé par
// TODO-030) : c'est cette fonction, partagée par la liste "👀 Suivis", la fiche Personne ET
// "Préparer mon point" (voir son commentaire ci-dessous), qui couvre exactement les deux
// endroits demandés ("dans le point avec le collaborateur et dans la fiche elle-même") sans
// avoir à ouvrir la fiche complète d'édition — le formulaire de création/édition n'a pas été
// touché.
//
// Champs concernés par ligne, selon le Sens (`direction`) du Suivi — jamais les deux mêmes
// champs pour les deux Sens, `dueDate` restant toujours `null` pour un "to_tell" (voir
// `js/domain/followups.js#createFollowUp`) :
//  - `waiting_on` : "Échéance" (`dueDate`, appartient à la personne suivie) ET "Prochain
//    contrôle" (`controlDate`, quand JE dois vérifier/relancer — même libellé que
//    `js/views/people.js#openEditFollowUpModal`), l'un et l'autre indépendamment réglables.
//  - `to_tell` : seule "À dire avant" (`controlDate` — même libellé qu'avant ce patch) a un sens,
//    `dueDate` n'existe pas pour ce Sens.
//
// `followUpsApi.updateFollowUp` applique déjà sa propre règle de plafond/calage
// `controlDate`/`dueDate` (voir son commentaire dans js/domain/followups.js) exactement comme le
// ferait une sauvegarde du formulaire d'édition — le document complet renvoyé par cet appel est
// donc utilisé pour rafraîchir les DEUX valeurs affichées après un report d'échéance, au cas où
// `controlDate` aurait elle-même été recalculée en silence par cette règle.
function relevantFollowUpDateFields(f) {
  return f.direction === "to_tell"
    ? [{ field: "controlDate", label: "À dire avant" }]
    : [
        { field: "dueDate", label: "Échéance" },
        { field: "controlDate", label: "Prochain contrôle" },
      ];
}

function appendFollowUpRows(container, followUps, onOpen, coveredIds, onCoveredChange) {
  for (const f of followUps) {
    const isToTell = f.direction === "to_tell";
    const isCovered = !!coveredIds?.has(f.id);
    const row = document.createElement("div");
    row.className = "item-row" + (isCovered ? " item-row-covered" : "");
    row.style.cursor = "pointer";
    const dateFields = relevantFollowUpDateFields(f);
    const notableIcon = f.notable === "positive" ? "👍 " : f.notable === "negative" ? "👎 " : "";
    row.innerHTML = `
      ${coveredIds ? `<label class="covered-check" title="Marquer comme vu pendant ce point"><input type="checkbox" ${isCovered ? "checked" : ""} aria-label="Vu pendant ce point" /></label>` : ""}
      <div class="item-main">
        <div class="item-title">${notableIcon}${isToTell ? "📣 " : ""}${escapeHtml(f.title)}${f.category ? ` <span class="item-meta">· ${followUpsApi.CATEGORY_LABELS[f.category]}</span>` : ""}</div>
        <div class="item-meta">Ajouté le ${formatDate(f.createdAt)}</div>
        ${dateFields.map(({ field, label }) => `
          <div class="followup-date-row" data-date-field="${field}">
            <span class="item-meta">${label} : <span data-date-value>${f[field] ? formatDate(f[field]) : "—"}</span></span>
            <button type="button" class="followup-quick-btn" data-date-toggle title="Reporter" aria-label="Reporter — ${label}">📅</button>
            <div class="kanban-card-postpone" data-date-panel style="display:none;">
              <button type="button" class="kanban-postpone-btn" data-date-offset="1">+1 j</button>
              <button type="button" class="kanban-postpone-btn" data-date-offset="7">+7 j</button>
              <label class="kanban-postpone-custom">
                <span>Date libre</span>
                <input type="date" data-date-custom value="${f[field] || ""}" aria-label="${label} — date libre" />
              </label>
            </div>
          </div>
        `).join("")}
      </div>
      <span class="badge badge-${f.status}">${followUpsApi.STATUS_LABELS[f.status]}</span>
      ${f.status !== "done" ? `
        <div class="followup-quick-actions">
          <button type="button" class="followup-quick-btn" data-quick-relance title="Relancer" aria-label="Relancer">🔁</button>
          <button type="button" class="followup-quick-btn" data-quick-done title="Marquer réglé" aria-label="Marquer réglé">✅</button>
        </div>
      ` : ""}
    `;
    row.querySelectorAll("[data-date-field]").forEach((dateRow) => {
      const field = dateRow.dataset.dateField;
      const toggleBtn = dateRow.querySelector("[data-date-toggle]");
      const panel = dateRow.querySelector("[data-date-panel]");
      const customInput = dateRow.querySelector("[data-date-custom]");
      // Même précaution que .covered-check/.followup-quick-actions ci-dessous : ne jamais
      // laisser un clic sur ce contrôle ouvrir aussi la fiche complète du Suivi.
      dateRow.addEventListener("click", (e) => e.stopPropagation());
      toggleBtn.addEventListener("click", () => {
        panel.style.display = panel.style.display === "none" ? "flex" : "none";
      });
      function applyNewDate(newDate) {
        followUpsApi.updateFollowUp(f.id, { [field]: newDate }).then((updated) => {
          f.dueDate = updated.dueDate;
          f.controlDate = updated.controlDate;
          for (const { field: otherField } of dateFields) {
            const otherValueEl = row.querySelector(`[data-date-field="${otherField}"] [data-date-value]`);
            if (otherValueEl) otherValueEl.textContent = f[otherField] ? formatDate(f[otherField]) : "—";
            const otherCustomInput = row.querySelector(`[data-date-field="${otherField}"] [data-date-custom]`);
            if (otherCustomInput) otherCustomInput.value = f[otherField] || "";
          }
          panel.style.display = "none";
          showToast(newDate ? `Date reportée au ${formatDate(newDate)}` : "Date supprimée");
        });
      }
      dateRow.querySelectorAll("[data-date-offset]").forEach((btn) => {
        btn.addEventListener("click", () => applyNewDate(dateUtils.addDaysToIsoDate(f[field], Number(btn.dataset.dateOffset))));
      });
      customInput.addEventListener("change", () => applyNewDate(customInput.value || null));
    });
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
    // TODO-004 (LOT 2, 21/09/2026) : action rapide "🔁 Relancer / ✅ Réglé" à 1 clic, sans ouvrir
    // la fiche complète — même principe que .covered-check ci-dessus (stopPropagation pour ne
    // pas déclencher aussi le clic sur `row`). `appendFollowUpRows` est appelé depuis 3 contextes
    // différents (liste "👀 Suivis" — redessinée par followUpsApi.subscribe —, mais aussi la
    // fiche Personne et la préparation de point, qui affichent un instantané non réactif) : la
    // ligne est donc mise à jour ICI, localement, plutôt que de compter sur un redessin externe
    // qui n'arrive pas dans ces deux derniers cas.
    const quickActions = row.querySelector(".followup-quick-actions");
    if (quickActions) {
      quickActions.addEventListener("click", (e) => e.stopPropagation());
      const badgeEl = row.querySelector(".badge");
      quickActions.querySelector("[data-quick-relance]").addEventListener("click", async () => {
        await followUpsApi.setStatus(f.id, "relaunched");
        f.status = "relaunched";
        badgeEl.className = "badge badge-relaunched";
        badgeEl.textContent = followUpsApi.STATUS_LABELS.relaunched;
        showToast("Suivi relancé");
      });
      quickActions.querySelector("[data-quick-done]").addEventListener("click", async () => {
        await followUpsApi.setStatus(f.id, "done");
        f.status = "done";
        badgeEl.className = "badge badge-done";
        badgeEl.textContent = followUpsApi.STATUS_LABELS.done;
        quickActions.remove();
        showToast("Suivi réglé");
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

/**
 * Regroupe des Objectifs par campagne/période (LOT 11, TODO-024, "notion de campagne/période")
 * — `period` est un simple champ texte libre (voir le commentaire en tête de
 * js/domain/objectives.js pour l'arbitrage complet : pas de véritable entité "campagne" dans ce
 * lot). Les objectifs sans période vont dans un groupe "Sans période" ; les groupes sont triés
 * par la date de création la plus récente qu'ils contiennent, décroissante — volontairement
 * PAS de notion de "campagne courante" à deviner ou à configurer, la récence suffit à faire
 * ressortir les objectifs actuels avant les plus anciens, exactement le besoin exprimé
 * ("distinguer clairement les objectifs de la campagne courante des objectifs historiques")
 * sans construire de gestion de campagnes.
 */
export function groupObjectivesByPeriod(objectives) {
  const groups = new Map();
  for (const o of objectives) {
    const key = o.period || "__none__";
    if (!groups.has(key)) groups.set(key, { period: o.period || null, items: [] });
    groups.get(key).items.push(o);
  }
  return [...groups.values()].sort((a, b) => {
    const maxA = Math.max(0, ...a.items.map((o) => o.createdAt || 0));
    const maxB = Math.max(0, ...b.items.map((o) => o.createdAt || 0));
    return maxB - maxA;
  });
}

/** Objectifs de campagne (§ préparation EADP) : liste + accès à leurs points de suivi datés. */
function renderObjectivesList(container, objectives, person, reopen, projects = []) {
  if (!objectives.length) {
    container.innerHTML = `<div class="empty-state" style="padding:16px;">Pas encore d'objectif pour ${escapeHtml(person.name)}.</div>`;
    return;
  }
  container.innerHTML = "";
  const groups = groupObjectivesByPeriod(objectives);
  const showGroupTitles = groups.length > 1;
  for (const group of groups) {
    if (showGroupTitles) {
      const label = document.createElement("div");
      label.className = "prep-group-label";
      label.textContent = group.period || "Sans période";
      container.appendChild(label);
    }
    for (const o of group.items) {
      const project = projects.find((p) => p.id === o.projectId);
      const row = document.createElement("div");
      row.className = "item-row";
      row.style.cursor = "pointer";
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">${o.status === "done" ? "✅ " : "🎯 "}${escapeHtml(o.title)}</div>
          <div class="item-meta">${(o.entries || []).length} point(s) de suivi${project ? ` · 📦 ${escapeHtml(project.name)}` : ""}</div>
        </div>
      `;
      row.addEventListener("click", () => {
        closeModal();
        openObjectiveDetail(o, person, { onDone: reopen });
      });
      container.appendChild(row);
    }
  }
}

/**
 * Bloc optionnel "Détails" d'un Objectif (LOT 11, TODO-024) — repliable, replié par défaut sauf
 * si `initial` porte déjà l'une de ces valeurs (fiche d'un objectif déjà enrichi). Réutilisé
 * TEL QUEL par la création (collaborateur ici, personnelle depuis js/views/dashboard.js) et par
 * la fiche détail (`openObjectiveDetail` plus bas) : un seul jeu de champs, jamais deux
 * formulaires distincts — c'est le principe central demandé par Charles-Henri pour ce lot. Rien
 * ici n'est obligatoire ; un objectif personnel simple n'a jamais besoin d'ouvrir ce bloc.
 */
export function renderObjectiveDetailsFieldset(container, initial = {}) {
  const smart = initial.smart || {};
  const hasAnyDetail =
    initial.category || initial.scope || initial.description || initial.period || initial.reviewFrequency ||
    initial.actionPlan || initial.responsibilityLevels || initial.watchPoints ||
    smart.specific || smart.measurable || smart.achievable || smart.relevant || smart.timeBound;

  container.innerHTML = `
    <details ${hasAnyDetail ? "open" : ""}>
      <summary class="section-title" style="cursor:pointer;margin-top:0;">Détails (optionnel — campagne, SMART, EADP...)</summary>
      <div class="field">
        <label for="objd-category">Catégorie</label>
        <input id="objd-category" type="text" placeholder="Ex. Technique, Managérial, Client..." value="${escapeAttr(initial.category || "")}" />
      </div>
      <div class="field">
        <label>Type</label>
        <div class="chip-row">
          <label class="chip-radio"><input type="radio" name="objd-scope" value="" ${!initial.scope ? "checked" : ""} /> — Aucun —</label>
          ${objectivesApi.SCOPES.map((s) => `<label class="chip-radio"><input type="radio" name="objd-scope" value="${s}" ${initial.scope === s ? "checked" : ""} /> ${objectivesApi.SCOPE_LABELS[s]}</label>`).join("")}
        </div>
      </div>
      <div class="field">
        <label for="objd-description">Description / intention</label>
        <textarea id="objd-description" placeholder="Contexte libre : pourquoi cet objectif ?">${escapeHtml(initial.description || "")}</textarea>
      </div>
      <div class="field">
        <label for="objd-period">Campagne / période</label>
        <input id="objd-period" type="text" placeholder="Ex. 2026-2027, T3 2026..." value="${escapeAttr(initial.period || "")}" />
      </div>
      <div class="field">
        <label for="objd-review-frequency">Fréquence de revue</label>
        <input id="objd-review-frequency" type="text" placeholder="Ex. Mensuelle, à chaque point..." value="${escapeAttr(initial.reviewFrequency || "")}" />
      </div>
      <div class="section-title">SMART</div>
      <div class="field">
        <label for="objd-smart-specific">Spécifique</label>
        <textarea id="objd-smart-specific" placeholder="Quoi, précisément ?">${escapeHtml(smart.specific || "")}</textarea>
      </div>
      <div class="field">
        <label for="objd-smart-measurable">Mesurable</label>
        <textarea id="objd-smart-measurable" placeholder="Comment sait-on que c'est atteint ?">${escapeHtml(smart.measurable || "")}</textarea>
      </div>
      <div class="field">
        <label for="objd-smart-achievable">Atteignable</label>
        <textarea id="objd-smart-achievable" placeholder="Réaliste avec les moyens disponibles ?">${escapeHtml(smart.achievable || "")}</textarea>
      </div>
      <div class="field">
        <label for="objd-smart-relevant">Réaliste / Pertinent</label>
        <textarea id="objd-smart-relevant" placeholder="En quoi ça compte vraiment ?">${escapeHtml(smart.relevant || "")}</textarea>
      </div>
      <div class="field">
        <label for="objd-smart-time-bound">Temporel</label>
        <textarea id="objd-smart-time-bound" placeholder="Pour quand ?">${escapeHtml(smart.timeBound || "")}</textarea>
      </div>
      <div class="field">
        <label for="objd-action-plan">Plan / actions</label>
        <textarea id="objd-action-plan" placeholder="Grandes étapes envisagées">${escapeHtml(initial.actionPlan || "")}</textarea>
      </div>
      <div class="field">
        <label for="objd-responsibility">Niveaux de responsabilité</label>
        <textarea id="objd-responsibility" placeholder="Qui décide, qui contribue, qui est informé...">${escapeHtml(initial.responsibilityLevels || "")}</textarea>
      </div>
      <div class="field">
        <label for="objd-watch-points">Points d'attention</label>
        <textarea id="objd-watch-points" placeholder="Risques, dépendances, vigilance particulière...">${escapeHtml(initial.watchPoints || "")}</textarea>
      </div>
    </details>
  `;

  return {
    read() {
      const val = (id) => container.querySelector(id).value.trim();
      return {
        category: val("#objd-category") || null,
        scope: container.querySelector('input[name="objd-scope"]:checked')?.value || null,
        description: val("#objd-description"),
        period: val("#objd-period") || null,
        reviewFrequency: val("#objd-review-frequency"),
        actionPlan: val("#objd-action-plan"),
        responsibilityLevels: val("#objd-responsibility"),
        watchPoints: val("#objd-watch-points"),
        smart: {
          specific: val("#objd-smart-specific"),
          measurable: val("#objd-smart-measurable"),
          achievable: val("#objd-smart-achievable"),
          relevant: val("#objd-smart-relevant"),
          timeBound: val("#objd-smart-time-bound"),
        },
      };
    },
  };
}

/**
 * Mode import depuis un texte généré par IA (22/09/2026, retour direct de Charles-Henri :
 * "c'est pénible de saisir tout [...] il faudrait un mode import qui permet d'importer les
 * indicateurs et de remplir les champs") — colle le texte produit par son prompt IA (format
 * imposé, voir le commentaire en tête de js/domain/objectives.js#parseObjectiveImportText) et le
 * fait analyser pour préremplir un objectif et/ou mettre en file des indicateurs. Fonction
 * PARTAGÉE (exportée) : utilisée ici même pour préremplir une création
 * (`openCreateObjectiveModal` juste en dessous), par js/views/dashboard.js
 * #openCreatePersonalObjectiveModal pour le même besoin côté "Mes objectifs", et par
 * `openObjectiveDetail` plus bas pour importer des indicateurs sur un objectif déjà existant —
 * un seul point d'analyse, jamais trois formulaires de collage différents.
 */
export function openImportObjectiveTextModal({ onParsed, onCancel } = {}) {
  const body = document.createElement("div");
  body.innerHTML = `
    <p class="item-meta" style="margin-top:0;">Collez ci-dessous le texte généré par l'assistant IA (catégorie, titre, SMART, indicateurs...). Les champs reconnus seront pré-remplis.</p>
    <div class="field">
      <label for="obj-import-textarea">Texte généré</label>
      <textarea id="obj-import-textarea" rows="16" placeholder="Collez ici le texte complet généré par l'IA..."></textarea>
    </div>
  `;
  const { bodyEl, close } = openModal({
    title: "📋 Importer depuis un texte",
    body,
    actions: [
      { label: "Annuler", variant: "ghost", onClick: () => onCancel?.() },
      {
        label: "Analyser",
        variant: "primary",
        closesModal: false,
        onClick: () => {
          const text = bodyEl.querySelector("#obj-import-textarea").value;
          if (!text.trim()) return;
          const parsed = objectivesApi.parseObjectiveImportText(text);
          const s = parsed.smart || {};
          const hasContent =
            parsed.title || parsed.description || (parsed.indicators || []).length ||
            parsed.category || parsed.actionPlan || parsed.watchPoints ||
            s.specific || s.measurable || s.achievable || s.relevant || s.timeBound;
          if (!hasContent) {
            showToast("Aucune information reconnue dans ce texte — vérifiez le format");
            return;
          }
          close();
          onParsed?.(parsed);
        },
      },
    ],
  });
}

async function openCreateObjectiveModal(person, { onDone, prefill } = {}) {
  // "Projet" (retour de Charles-Henri, 13/09/2026 : "tout élément doit être rattachable à un
  // projet") — Objectif était, avec les Informations/Idées de l'Inbox, le seul type sans aucun
  // moyen de se rattacher à un projet. Optionnel, même sélecteur + "+ Nouveau projet…" que
  // partout ailleurs (js/views/projects.js#attachProjectQuickCreate).
  const projects = await projectsApi.listAll();
  // Indicateurs importés en attente (mode import, voir openImportObjectiveTextModal
  // ci-dessus) : cette modale de création n'a pas de section indicateurs (elle n'existe qu'une
  // fois l'objectif créé, voir openObjectiveDetail) — ils sont donc simplement mis en file ici et
  // ajoutés en boucle juste après la création, plutôt que d'ouvrir une UI d'indicateurs dédiée à
  // la création qui n'existait pas avant ce besoin.
  const queuedIndicators = prefill?.indicators || [];
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="obj-title">Objectif de ${escapeHtml(person.name)}</label>
      <input id="obj-title" type="text" placeholder="Ex. Monter en autonomie sur le pilotage de projet" value="${escapeAttr(prefill?.title || "")}" />
    </div>
    <div class="field">
      <label for="obj-project">Projet (optionnel)</label>
      <select id="obj-project">
        <option value="">— Aucun —</option>
        ${sortProjectsByName(projects).map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("")}
      </select>
    </div>
    <div style="margin-bottom:8px;">
      <button id="obj-import-text-btn" type="button" class="btn btn-secondary btn-sm">📋 Importer depuis un texte</button>
    </div>
    ${queuedIndicators.length ? `<div class="item-meta" style="margin-bottom:8px;">📊 ${queuedIndicators.length} indicateur(s) importé(s) seront ajoutés à la création.</div>` : ""}
    <div id="obj-details-fieldset"></div>
  `;
  attachProjectQuickCreate(body.querySelector("#obj-project"));
  const details = renderObjectiveDetailsFieldset(body.querySelector("#obj-details-fieldset"), prefill || {});
  body.querySelector("#obj-import-text-btn").addEventListener("click", () => {
    closeModal();
    openImportObjectiveTextModal({
      onParsed: (parsed) => openCreateObjectiveModal(person, { onDone, prefill: parsed }),
      onCancel: () => openCreateObjectiveModal(person, { onDone, prefill }),
    });
  });
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
          const projectId = bodyEl.querySelector("#obj-project").value || null;
          const created = await objectivesApi.createObjective({ personId: person.id, title, projectId, ...details.read() });
          for (const ind of queuedIndicators) await objectivesApi.addIndicator(created.id, ind);
          close();
          showToast("Objectif ajouté");
          onDone?.();
        },
      },
    ],
  });
}

export async function openObjectiveDetail(objective, person, { onDone } = {}) {
  const entries = [...(objective.entries || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
  const indicators = objective.indicators || [];
  // "Projet" (retour de Charles-Henri, 13/09/2026 : "tout élément doit être rattachable à un
  // projet") — chargé ici plutôt que reçu en paramètre : cette fonction est aussi appelée
  // directement depuis js/components/search.js et js/components/linkedItems.js sans que ces
  // appelants n'aient de liste de projets sous la main (même principe que
  // js/views/people.js#openEditFollowUpModal, déjà async et auto-suffisant pour la même raison).
  const projects = await projectsApi.listAll();
  // BUG corrigé (22/09/2026, retour direct de Charles-Henri : "quand j'ajoute un indicateur, il
  // est pris en compte mais ne s'affiche pas directement dans la modale [...] c'est à
  // l'enregistrement et réouverture que je le vois") — chaque modale imbriquée (indicateur,
  // suivi, lien) rouvrait cette fiche avec le paramètre `objective` reçu en ENTRÉE de cet appel,
  // un simple objet JS jamais remis à jour après l'écriture (`addIndicator`/`addEntry`/
  // `createLink`... n'ont jamais muté cet objet en place, ils écrivent en base séparément) — la
  // fiche se redessinait donc avec les données d'AVANT l'ajout, jusqu'à ce qu'un aller-retour
  // complet (fermeture de la fiche puis réouverture depuis la LISTE, qui relit bien la base)
  // finisse par la rafraîchir. `reopenSelf` relit l'Objectif en base avant de rouvrir CETTE
  // fiche, exactement comme le fait déjà `reopenProject` dans js/views/projects.js pour le même
  // genre de rafraîchissement après un "+ Ajouter" imbriqué.
  const reopenSelf = async () => {
    const fresh = await objectivesApi.getObjective(objective.id);
    openObjectiveDetail(fresh || objective, person, { onDone });
  };
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field" style="display:flex;align-items:center;gap:8px;">
      <input id="obj-done" type="checkbox" style="width:auto;" ${objective.status === "done" ? "checked" : ""} />
      <label for="obj-done" style="margin:0;">✅ Objectif atteint</label>
    </div>
    <div class="field">
      <label for="obj-detail-project">Projet</label>
      <select id="obj-detail-project">
        <option value="">— Aucun —</option>
        ${sortProjectsByName(projects).map((p) => `<option value="${p.id}" ${p.id === objective.projectId ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("")}
      </select>
    </div>
    <div id="obj-details-fieldset" style="margin-bottom:8px;"></div>

    <!-- Indicateurs (LOT 11, TODO-024, points 3/4/6) — données structurées PROPRES à
         l'Objectif, jamais une fiche indépendante (arbitrage "Option A", voir le commentaire en
         tête de js/domain/objectives.js) : pas de section "🔗 Lié" par indicateur, uniquement au
         niveau de l'Objectif entier (section plus bas, inchangée). -->
    <div class="section-title">📊 Indicateurs (${indicators.length})</div>
    <div class="card" id="obj-indicators" style="margin-bottom:8px;"></div>
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <button id="add-indicator-btn" type="button" class="btn btn-secondary btn-sm">+ Indicateur</button>
      <button id="import-indicators-btn" type="button" class="btn btn-secondary btn-sm">📋 Importer</button>
    </div>

    <div class="section-title">🕒 Suivis récents (${entries.length})</div>
    <div class="card" id="obj-entries" style="margin-bottom:8px;"></div>
    <div style="margin-bottom:16px;">
      <button id="add-entry-btn" type="button" class="btn btn-secondary btn-sm">+ Ajouter un suivi</button>
    </div>
    <div class="section-title">🏷️ Tags</div>
    <div id="obj-tags" style="margin-bottom:16px;"></div>
    <!-- "🔗 Lié" (retour de Charles-Henri, 06/09/2026 : "pouvoir y rattacher d'autres projets ou
         faire un suivi") — un Objectif se suit désormais comme les autres fiches : on y attache
         des Projets/Suivis déjà existants (ou on en crée un nouveau déjà lié), même mécanique
         partagée que partout ailleurs (js/components/linkedItems.js), sans dupliquer le Kanban
         ni la mécanique Projet. -->
    <div class="section-title">🔗 Lié</div>
    <div class="card" id="obj-links" style="margin-bottom:8px;"></div>
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <button id="obj-link-existing-btn" class="btn btn-secondary btn-sm">🔗 Lier une fiche</button>
      <button id="obj-create-linked-btn" class="btn btn-secondary btn-sm">+ Créer et lier</button>
    </div>
  `;

  const objDetails = renderObjectiveDetailsFieldset(body.querySelector("#obj-details-fieldset"), objective);

  const indicatorById = new Map(indicators.map((ind) => [ind.id, ind]));
  const indicatorsEl = body.querySelector("#obj-indicators");
  function renderIndicators(list) {
    if (!list.length) {
      indicatorsEl.innerHTML = `<div class="empty-state" style="padding:16px;">Aucun indicateur pour l'instant.</div>`;
      return;
    }
    indicatorsEl.innerHTML = "";
    for (const ind of list) {
      const row = document.createElement("div");
      row.className = "item-row";
      row.style.cursor = "pointer";
      const metaParts = [];
      if (ind.target) metaParts.push(`Cible : ${escapeHtml(ind.target)}`);
      if (ind.measurement) metaParts.push(`Mesure : ${escapeHtml(ind.measurement)}`);
      if (ind.evidenceSource) metaParts.push(`Preuve : ${escapeHtml(ind.evidenceSource)}`);
      if (ind.frequency) metaParts.push(`Fréquence : ${escapeHtml(ind.frequency)}`);
      if (ind.currentValue) metaParts.push(`Valeur actuelle : ${escapeHtml(ind.currentValue)}`);
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">${escapeHtml(ind.label || "(sans libellé)")} <span class="badge badge-${ind.status}">${objectivesApi.INDICATOR_STATUS_LABELS[ind.status] || ind.status}</span></div>
          ${metaParts.length ? `<div class="item-meta">${metaParts.join(" · ")}</div>` : ""}
        </div>
      `;
      row.addEventListener("click", () => {
        closeModal();
        openIndicatorModal(objective, ind, { onDone: reopenSelf });
      });
      indicatorsEl.appendChild(row);
    }
  }
  renderIndicators(indicators);
  body.querySelector("#add-indicator-btn").addEventListener("click", () => {
    closeModal();
    openIndicatorModal(objective, null, { onDone: reopenSelf });
  });
  // Mode import (22/09/2026, retour de Charles-Henri) — importe uniquement les indicateurs
  // reconnus dans le texte collé sur CET objectif déjà existant (contrairement à
  // openCreateObjectiveModal, qui préremplit une création) : ajoute chacun via addIndicator puis
  // rouvre la fiche à jour via reopenSelf, exactement comme "+ Indicateur".
  body.querySelector("#import-indicators-btn").addEventListener("click", () => {
    closeModal();
    openImportObjectiveTextModal({
      onParsed: async (parsed) => {
        const toAdd = parsed.indicators || [];
        for (const ind of toAdd) await objectivesApi.addIndicator(objective.id, ind);
        showToast(toAdd.length ? `${toAdd.length} indicateur(s) importé(s)` : "Aucun indicateur reconnu dans ce texte");
        reopenSelf();
      },
      onCancel: reopenSelf,
    });
  });

  const entriesEl = body.querySelector("#obj-entries");
  function renderEntries(list) {
    if (!list.length) {
      entriesEl.innerHTML = `<div class="empty-state" style="padding:16px;">Aucun suivi pour l'instant.</div>`;
      return;
    }
    entriesEl.innerHTML = "";
    for (const e of list) {
      const ind = e.indicatorId ? indicatorById.get(e.indicatorId) : null;
      const row = document.createElement("div");
      row.className = "item-row";
      const titleParts = [];
      if (ind) titleParts.push(`📊 ${escapeHtml(ind.label || "(indicateur)")}`);
      if (e.status) titleParts.push(`<span class="badge badge-${e.status}">${objectivesApi.INDICATOR_STATUS_LABELS[e.status] || e.status}</span>`);
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">${formatDate(e.date)}${titleParts.length ? " — " + titleParts.join(" ") : ""}</div>
          ${e.note ? `<div>${escapeHtml(e.note)}</div>` : ""}
          ${e.nextSteps ? `<div class="item-meta">Prévu avant le prochain point : ${escapeHtml(e.nextSteps)}</div>` : ""}
          <div class="item-meta" id="obj-entry-ref-${e.id}"></div>
        </div>
      `;
      entriesEl.appendChild(row);
      if (e.ref) {
        linkedItemsApi.resolveRefDirect(e.ref).then((resolved) => {
          const refEl = row.querySelector(`#obj-entry-ref-${e.id}`);
          if (refEl) refEl.textContent = resolved ? `🔗 ${resolved.emoji} ${resolved.title}` : "🔗 Élément supprimé";
        });
      }
    }
  }
  renderEntries(entries);
  body.querySelector("#add-entry-btn").addEventListener("click", () => {
    closeModal();
    openAddObjectiveEntryModal(objective, { onDone: reopenSelf });
  });

  const objProjectSelectEl = body.querySelector("#obj-detail-project");
  attachProjectQuickCreate(objProjectSelectEl);
  objProjectSelectEl.addEventListener("change", async () => {
    if (objProjectSelectEl.value === "__create__") return; // géré par attachProjectQuickCreate lui-même
    await objectivesApi.updateObjective(objective.id, { projectId: objProjectSelectEl.value || null });
    objective.projectId = objProjectSelectEl.value || null;
  });

  const objLinkRef = { type: "Objective", id: objective.id };
  renderTagsEditor(body.querySelector("#obj-tags"), "Objective", objective.id);
  linkedItemsApi.renderLinkedSection(body.querySelector("#obj-links"), objLinkRef);
  body.querySelector("#obj-link-existing-btn").addEventListener("click", () => {
    closeModal();
    linkedItemsApi.openLinkPickerModal(objLinkRef, objective.title, {
      onLinked: reopenSelf,
      onCancel: reopenSelf,
    });
  });
  body.querySelector("#obj-create-linked-btn").addEventListener("click", () => {
    closeModal();
    linkedItemsApi.openCreateAndLinkModal(objLinkRef, objective.title, {
      onLinked: reopenSelf,
      onCancel: reopenSelf,
    });
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
            onCancel: reopenSelf,
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
            ...objDetails.read(),
          });
          close();
          showToast("Objectif mis à jour");
          onDone?.();
        },
      },
    ],
  });
}

/** Ajouter/modifier un indicateur (LOT 11, TODO-024, points 3/4) — petite modale imbriquée,
 *  même convention que partout ailleurs dans ce fichier (fermer/rouvrir la fiche parente au
 *  clic). `indicator` à `null` = création, sinon modification en place. */
function openIndicatorModal(objective, indicator, { onDone } = {}) {
  const isEdit = !!indicator;
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="ind-label">Libellé</label>
      <input id="ind-label" type="text" placeholder="Ex. Participation à des contacts utilisateurs" value="${escapeAttr(indicator?.label || "")}" />
    </div>
    <div class="field">
      <label for="ind-target">Cible</label>
      <input id="ind-target" type="text" placeholder="Ex. 6 contacts terrain sur la période" value="${escapeAttr(indicator?.target || "")}" />
    </div>
    <div class="field">
      <label for="ind-measurement">Mode de mesure</label>
      <input id="ind-measurement" type="text" placeholder="Ex. Nombre de comptes rendus de contact" value="${escapeAttr(indicator?.measurement || "")}" />
    </div>
    <div class="field">
      <label for="ind-evidence">Source de preuve</label>
      <input id="ind-evidence" type="text" placeholder="Ex. Comptes rendus partagés sur le drive" value="${escapeAttr(indicator?.evidenceSource || "")}" />
    </div>
    <div class="field">
      <label for="ind-frequency">Fréquence</label>
      <input id="ind-frequency" type="text" placeholder="Ex. Mensuelle" value="${escapeAttr(indicator?.frequency || "")}" />
    </div>
    <div class="field">
      <label for="ind-current-value">Valeur actuelle (optionnel)</label>
      <input id="ind-current-value" type="text" placeholder="Ex. 3 contacts réalisés à ce jour" value="${escapeAttr(indicator?.currentValue || "")}" />
    </div>
    <div class="field">
      <label>Statut</label>
      <div class="chip-row">
        ${objectivesApi.INDICATOR_STATUSES.map(
          (s) => `<label class="chip-radio"><input type="radio" name="ind-status" value="${s}" ${(indicator?.status || "todo") === s ? "checked" : ""} /> ${objectivesApi.INDICATOR_STATUS_LABELS[s]}</label>`
        ).join("")}
      </div>
    </div>
  `;
  const { bodyEl, close } = openModal({
    title: isEdit ? "Modifier l'indicateur" : "Nouvel indicateur",
    body,
    actions: [
      { label: "Annuler", variant: "ghost", onClick: () => onDone?.() },
      ...(isEdit
        ? [
            {
              label: "🗑️ Supprimer",
              variant: "danger",
              closesModal: false,
              onClick: () => {
                closeModal();
                confirmDelete({
                  title: "Supprimer cet indicateur ?",
                  message: `« ${indicator.label || "Cet indicateur"} » sera définitivement supprimé. Les suivis déjà enregistrés qui le concernaient sont conservés.`,
                  onConfirm: async () => {
                    await objectivesApi.removeIndicator(objective.id, indicator.id);
                    showToast("Indicateur supprimé");
                    onDone?.();
                  },
                  onCancel: () => openIndicatorModal(objective, indicator, { onDone }),
                });
              },
            },
          ]
        : []),
      {
        label: isEdit ? "Enregistrer" : "Créer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          const patch = {
            label: bodyEl.querySelector("#ind-label").value.trim(),
            target: bodyEl.querySelector("#ind-target").value.trim(),
            measurement: bodyEl.querySelector("#ind-measurement").value.trim(),
            evidenceSource: bodyEl.querySelector("#ind-evidence").value.trim(),
            frequency: bodyEl.querySelector("#ind-frequency").value.trim(),
            currentValue: bodyEl.querySelector("#ind-current-value").value.trim(),
            status: bodyEl.querySelector('input[name="ind-status"]:checked')?.value || "todo",
          };
          if (!patch.label) return;
          if (isEdit) await objectivesApi.updateIndicator(objective.id, indicator.id, patch);
          else await objectivesApi.addIndicator(objective.id, patch);
          close();
          showToast(isEdit ? "Indicateur mis à jour" : "Indicateur ajouté");
          onDone?.();
        },
      },
    ],
  });
}

/**
 * "+ Ajouter un suivi" sur un Objectif (LOT 11, TODO-024, point 7) — le formulaire ne redemande
 * JAMAIS la cible/le mode de mesure/la source de preuve : ces informations sont déjà celles de
 * l'indicateur choisi, affichées en contexte au-dessus du formulaire (retour de Charles-Henri :
 * "le but est que le manager ou le collaborateur puisse faire un point en quelques minutes").
 * Sans indicateur sur l'objectif (cas "Mes objectifs" simple), le sélecteur d'indicateur et le
 * contexte associé n'apparaissent simplement pas — formulaire réduit à statut/réalisé/prévu/lien,
 * l'expérience légère demandée pour un objectif personnel.
 */
function openAddObjectiveEntryModal(objective, { onDone, prefill = {} } = {}) {
  const indicators = objective.indicators || [];
  const lastEntryFor = (indicatorId) =>
    [...(objective.entries || [])]
      .filter((e) => (indicatorId ? e.indicatorId === indicatorId : !e.indicatorId))
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  const body = document.createElement("div");
  body.innerHTML = `
    ${
      indicators.length
        ? `<div class="field">
      <label for="oe-indicator">Indicateur concerné</label>
      <select id="oe-indicator">
        <option value="">— Suivi général de l'objectif —</option>
        ${indicators.map((ind) => `<option value="${ind.id}" ${prefill.indicatorId === ind.id ? "selected" : ""}>${escapeHtml(ind.label || "(sans libellé)")}</option>`).join("")}
      </select>
    </div>
    <div class="card" id="oe-context" style="margin-bottom:16px;"></div>`
        : ""
    }
    <div class="field">
      <label>Statut</label>
      <div class="chip-row">
        <label class="chip-radio"><input type="radio" name="oe-status" value="" ${!prefill.status ? "checked" : ""} /> — Inchangé —</label>
        ${objectivesApi.INDICATOR_STATUSES.map((s) => `<label class="chip-radio"><input type="radio" name="oe-status" value="${s}" ${prefill.status === s ? "checked" : ""} /> ${objectivesApi.INDICATOR_STATUS_LABELS[s]}</label>`).join("")}
      </div>
    </div>
    <div class="field">
      <label for="oe-date">Date</label>
      <input id="oe-date" type="date" value="${escapeAttr(prefill.date || new Date().toISOString().slice(0, 10))}" />
    </div>
    <div class="field">
      <label for="oe-note">Qu'est-ce qui a été réalisé ?</label>
      <textarea id="oe-note" placeholder="Où en est-on depuis le dernier point ?">${escapeHtml(prefill.note || "")}</textarea>
    </div>
    <div class="field">
      <label for="oe-next-steps">Qu'est-ce qui est prévu avant le prochain point ?</label>
      <textarea id="oe-next-steps" placeholder="Optionnel">${escapeHtml(prefill.nextSteps || "")}</textarea>
    </div>
    <div class="field">
      <label>Lien vers un élément existant (preuve/contexte, optionnel)</label>
      <div id="oe-ref-display" class="item-meta" style="margin-bottom:6px;"></div>
      <button type="button" id="oe-ref-pick-btn" class="btn btn-secondary btn-sm">🔗 Choisir une fiche</button>
      <button type="button" id="oe-ref-clear-btn" class="btn btn-ghost btn-sm" style="display:none;">Retirer</button>
    </div>
  `;

  let pickedRef = prefill.ref || null;
  const refDisplay = body.querySelector("#oe-ref-display");
  const refClearBtn = body.querySelector("#oe-ref-clear-btn");
  function renderPickedRef() {
    refClearBtn.style.display = pickedRef ? "" : "none";
    if (!pickedRef) {
      refDisplay.textContent = "";
      return;
    }
    refDisplay.textContent = "Chargement...";
    linkedItemsApi.resolveRefDirect(pickedRef).then((resolved) => {
      refDisplay.textContent = resolved ? `🔗 ${resolved.emoji} ${resolved.title}` : "🔗 Élément supprimé";
    });
  }
  // Snapshot des champs déjà saisis avant d'ouvrir le sélecteur de fiche — cette modale se
  // referme forcément le temps du choix (`openModal()` n'affiche jamais deux modales à la
  // fois), donc la saisie en cours est reprise via `prefill` à la réouverture plutôt que
  // perdue, même principe qu'ailleurs dans ce fichier pour une modale imbriquée.
  function snapshot() {
    return {
      indicatorId: body.querySelector("#oe-indicator")?.value || null,
      status: body.querySelector('input[name="oe-status"]:checked')?.value || null,
      date: body.querySelector("#oe-date").value,
      note: body.querySelector("#oe-note").value,
      nextSteps: body.querySelector("#oe-next-steps").value,
      ref: pickedRef,
    };
  }
  body.querySelector("#oe-ref-pick-btn").addEventListener("click", () => {
    const current = snapshot();
    closeModal();
    linkedItemsApi.pickRef({
      // Liste exacte demandée par Charles-Henri (LOT 11, TODO-024, point 7) : Suivi, Réunion,
      // Décision, Information, Ressource, Projet — jamais Tâche/Personne/Objectif ici.
      types: ["FollowUp", "Meeting", "Decision", "Kept", "Resource", "Project"],
      title: "Choisir une fiche liée à ce suivi",
      onPick: (ref) => openAddObjectiveEntryModal(objective, { onDone, prefill: { ...current, ref } }),
      onCancel: () => openAddObjectiveEntryModal(objective, { onDone, prefill: current }),
    });
  });
  refClearBtn.addEventListener("click", () => {
    pickedRef = null;
    renderPickedRef();
  });

  function fillContext(indicatorId) {
    const contextEl = body.querySelector("#oe-context");
    if (!contextEl) return;
    const ind = indicators.find((i) => i.id === indicatorId);
    if (!ind) {
      contextEl.innerHTML = "";
      return;
    }
    const last = lastEntryFor(indicatorId);
    const lines = [];
    if (ind.target) lines.push(`Cible : ${escapeHtml(ind.target)}`);
    if (ind.measurement) lines.push(`Mesure : ${escapeHtml(ind.measurement)}`);
    if (ind.evidenceSource) lines.push(`Source de preuve : ${escapeHtml(ind.evidenceSource)}`);
    lines.push(`Statut actuel : ${objectivesApi.INDICATOR_STATUS_LABELS[ind.status] || ind.status}`);
    if (last) {
      lines.push(`Dernier suivi (${formatDate(last.date)}) : ${escapeHtml(last.note || "—")}`);
      if (last.nextSteps) lines.push(`Prévu à ce moment-là : ${escapeHtml(last.nextSteps)}`);
    }
    contextEl.innerHTML = lines.map((l) => `<div class="item-meta">${l}</div>`).join("");
  }
  if (indicators.length) {
    const select = body.querySelector("#oe-indicator");
    select.addEventListener("change", () => fillContext(select.value));
    if (prefill.indicatorId) fillContext(prefill.indicatorId);
  }

  renderPickedRef();

  const { bodyEl, close } = openModal({
    title: "Ajouter un suivi",
    body,
    actions: [
      { label: "Annuler", variant: "ghost", onClick: () => onDone?.() },
      {
        label: "Ajouter",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          const indicatorId = bodyEl.querySelector("#oe-indicator")?.value || null;
          const status = bodyEl.querySelector('input[name="oe-status"]:checked')?.value || null;
          const date = bodyEl.querySelector("#oe-date").value || null;
          const note = bodyEl.querySelector("#oe-note").value.trim();
          const nextSteps = bodyEl.querySelector("#oe-next-steps").value.trim();
          if (!note && !nextSteps && !status) return;
          await objectivesApi.addEntry(objective.id, { date, note, nextSteps, indicatorId, status, ref: pickedRef });
          if (indicatorId && status) await objectivesApi.updateIndicator(objective.id, indicatorId, { status });
          close();
          showToast("Suivi ajouté");
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
export async function openCreateFollowUpModal({ person, projectId, defaultDirection = "waiting_on", defaultTitle = "", defaultDueDate = "", defaultControlDate = "", defaultDescription = "", onCreated, onCancel } = {}) {
  const [projects, people, existingFollowUps] = await Promise.all([
    projectsApi.listAll(),
    person ? Promise.resolve(null) : peopleApi.listAll(),
    person ? Promise.resolve(null) : followUpsApi.listAll(),
  ]);
  // "💡 Suggestion" (vague 34, retour de Charles-Henri : "il te suggérerait à qui confier un
  // nouveau sujet plutôt que de le décider à l'instinct ou par défaut sur la même personne") —
  // calculée ici, au moment précis de la décision, plutôt que seulement consultable à part sur
  // l'onglet Équipe (voir js/views/workload.js) : ce formulaire est LE point de passage commun
  // à tous les endroits où un nouveau Suivi peut naître sans personne déjà choisie (Inbox,
  // Capturer, fiche Projet, "🔗 Lier une fiche"...). N'a de sens qu'à partir de 2 collaborateurs
  // à comparer, et seulement quand le picker est affiché (`!person`).
  const loadSuggestion = !person && people && people.filter((p) => p.type !== "manager").length >= 2
    ? workloadApi.rankByLoad(people, existingFollowUps)[0]
    : null;
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
      ${
        loadSuggestion
          ? `<div class="item-meta" id="fu-load-hint" style="margin-top:6px;">💡 Suggestion : <strong>${escapeHtml(loadSuggestion.person.name)}</strong> a la charge la plus légère (${loadSuggestion.volume} suivi${loadSuggestion.volume > 1 ? "s" : ""} actif${loadSuggestion.volume > 1 ? "s" : ""}) — <button type="button" id="fu-load-hint-pick" class="btn btn-ghost btn-sm" style="padding:0 4px;">Choisir</button></div>`
          : ""
      }
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
      <!-- BUG corrigé (LOT 13, TODO-027, 22/09/2026) : defaultDescription n'existait pas encore
           comme paramètre (contrairement à defaultTitle/defaultDueDate ci-dessus) — premier
           appelant à en avoir besoin, voir js/components/bureau.js "Transformer en Suivi". -->
      <textarea id="fu-description" placeholder="Contexte libre, pas encore d'échéance à retenir ici">${escapeHtml(defaultDescription)}</textarea>
    </div>
    <div class="field">
      <label>Élément notable ? (préparation EADP, optionnel)</label>
      <div class="chip-row">
        <label class="chip-radio"><input type="radio" name="fu-notable" value="" checked /> Aucun</label>
        <label class="chip-radio"><input type="radio" name="fu-notable" value="positive" /> 👍 Positif</label>
        <label class="chip-radio"><input type="radio" name="fu-notable" value="negative" /> 👎 Négatif</label>
      </div>
    </div>
    <!-- LOT 11, TODO-025 — arbitrage explicite de Charles-Henri : décision INDÉPENDANTE du
         "Sens" (direction, ci-dessus), disponible dès la création plutôt qu'à travers l'écran
         de masquage privé (js/views/prepMask.js) qui reste la seule autre façon de la changer
         plus tard. Réutilise le champ hiddenFromPrep déjà existant (js/domain/followups.js) —
         aucune nouvelle valeur de direction créée, PAS de "suivi personnel" (voir l'arbitrage de
         Charles-Henri : ce besoin n'a pas été retenu pour ce lot). Coché par défaut : un Suivi
         remonte normalement au prochain point, comme c'était déjà le cas avant ce lot pour tout
         Suivi jamais masqué. -->
    <div class="field" style="display:flex;align-items:center;gap:8px;">
      <input id="fu-remonte-prep" type="checkbox" style="width:auto;" checked />
      <label for="fu-remonte-prep" style="margin:0;">Remonter au prochain point</label>
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
  // BUG corrigé (15/09/2026, audit "anomalies d'usage ou d'enregistrement en silence") : bouton
  // non désactivé pendant l'écriture — un double-clic créait deux Projets identiques (l'un
  // orphelin, jamais sélectionné).
  const fuNewProjectConfirmBtn = body.querySelector("#fu-new-project-confirm");
  fuNewProjectConfirmBtn.addEventListener(
    "click",
    guardClick(fuNewProjectConfirmBtn, async () => {
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
    })
  );

  // "Saisie en masse" (retour de Charles-Henri, vague 22 : "j'aimerai avoir plus de saisie en
  // masse") — première des deux pistes qu'il a choisies parmi celles proposées : dupliquer un
  // même engagement vers plusieurs personnes en une fois (ex. "tout le monde doit remplir le
  // formulaire X d'ici vendredi"), plutôt que de ressaisir le même texte pour chacune. N'existe
  // que quand le formulaire propose déjà un sélecteur de personne (`!person`) — depuis une
  // fiche Personne déjà ouverte, il n'y a par construction qu'une seule personne possible.
  if (loadSuggestion) {
    body.querySelector("#fu-load-hint-pick").addEventListener("click", () => {
      body.querySelector("#fu-person").value = loadSuggestion.person.id;
    });
  }

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
            // LOT 11, TODO-025 — voir le commentaire au-dessus du champ dans le HTML de ce
            // formulaire : indépendant de `direction`, jamais déduit automatiquement.
            hiddenFromPrep: !bodyEl.querySelector("#fu-remonte-prep").checked,
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
    <div class="section-title">🏷️ Tags</div>
    <div id="detail-tags" style="margin-bottom:16px;"></div>
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
  // BUG corrigé (15/09/2026, audit "anomalies d'usage ou d'enregistrement en silence") : même
  // correctif que "#fu-new-project-confirm" ci-dessus, sur la variante "Modifier le suivi".
  const fuEditNewProjectConfirmBtn = body.querySelector("#fu-edit-new-project-confirm");
  fuEditNewProjectConfirmBtn.addEventListener(
    "click",
    guardClick(fuEditNewProjectConfirmBtn, async () => {
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
    })
  );

  const checklistTitleEl = body.querySelector("#fu-edit-checklist-title");
  function updateChecklistTitle() {
    const list = followUp.checklist || [];
    checklistTitleEl.textContent = `☑️ Sous-étapes (${list.filter((c) => c.done).length}/${list.length})`;
  }
  renderChecklist(body.querySelector("#fu-edit-checklist"), followUp.checklist || [], {
    onAdd: async (text) => {
      // TODO-010 (LOT 4B) : followUpsApi.addChecklistItem() renvoie désormais l'élément ajouté
      // seul (écriture ciblée, plus de relecture du tableau complet).
      const item = await followUpsApi.addChecklistItem(followUp.id, text);
      const updated = item ? [...(followUp.checklist || []), item] : followUp.checklist;
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
    // Retour direct de Charles-Henri (22/09/2026) : "si je me suis trompé dans le nom d'une sous
    // étape [...] je ne peux pas le modifier ni ordonner les sous étapes non terminées" — voir le
    // commentaire en tête de js/components/checklist.js.
    onEdit: async (itemId, text) => {
      const updated = await followUpsApi.editChecklistItem(followUp.id, itemId, text);
      followUp.checklist = updated || followUp.checklist;
      return followUp.checklist;
    },
    onReorder: async (orderedIds) => {
      const updated = await followUpsApi.reorderChecklist(followUp.id, orderedIds);
      followUp.checklist = updated;
      return updated;
    },
    // Retour direct de Charles-Henri (22/09/2026) : "idem pour les étapes, quand je coche une
    // étape, les étapes cochées se mettent après les non cochées et se trient du plus récent au
    // plus ancien" — voir le commentaire en tête de js/components/checklist.js.
    sortDoneToBottom: true,
  });

  renderNotesBlock(body.querySelector("#detail-notes"), followUp.notesLog || [], {
    onAdd: async (text) => {
      // TODO-010 (LOT 4B) : followUpsApi.addNote() renvoie désormais la note ajoutée seule
      // (écriture ciblée) — voir le commentaire équivalent sur la checklist juste au-dessus.
      const note = await followUpsApi.addNote(followUp.id, text);
      const updated = note ? [...(followUp.notesLog || []), note] : followUp.notesLog;
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
  renderTagsEditor(body.querySelector("#detail-tags"), "FollowUp", followUp.id);
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
      { icon: "✕", label: "Fermer", variant: "ghost", compact: true, onClick: () => onDone?.() },
      {
        // Lien de partage (retour de Charles-Henri, vague 23) — voir js/components/copyLink.js.
        icon: "🔗",
        label: "Copier le lien",
        variant: "secondary",
        compact: true,
        closesModal: false,
        onClick: () => copyEntityLink("#/people", "FollowUp", followUp.id),
      },
      {
        // "🔁 Changer de type" (retour de Charles-Henri, vague 40, 09/09/2026) — voir
        // js/components/changeType.js et js/domain/convert.js.
        icon: "🔁",
        label: "Changer de type",
        variant: "secondary",
        compact: true,
        closesModal: false,
        onClick: () => {
          closeModal();
          openChangeTypeModal("followup", followUp, ["task", "kept"], {
            personName: person?.name || "",
            onConverted: () => onDone?.(),
            onCancel: () => openEditFollowUpModal(followUp, { onDone }),
          });
        },
      },
      {
        icon: "🗑️",
        label: "Supprimer",
        variant: "danger",
        compact: true,
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
        icon: "💾",
        label: "Enregistrer",
        variant: "primary",
        compact: true,
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
