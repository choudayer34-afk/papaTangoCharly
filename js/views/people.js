// Vue Équipe — §31 (liste) et §32 (fiche collaborateur simplifiée).

import * as peopleApi from "../domain/people.js";
import * as followUpsApi from "../domain/followups.js";
import * as projectsApi from "../domain/projects.js";
import * as historyApi from "../domain/history.js";
import * as objectivesApi from "../domain/objectives.js";
import { openModal, closeModal, confirmDelete } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { showHintOnce } from "../components/hint.js";
import { renderHistoryTimeline } from "../components/historyTimeline.js";
import * as linkedItemsApi from "../components/linkedItems.js";

/** Suivis triés par date d'ajout décroissante (retour de Charles-Henri : "ordonner par date
 *  décroissante le visu du suivi") — explicitement par `createdAt` plutôt que l'ordre déjà
 *  trié par `updatedAt` que renvoie le storage, pour ne pas faire sauter un suivi en tête de
 *  liste juste parce qu'on vient de le modifier. */
function sortByCreatedDesc(list) {
  return [...list].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function renderPeople(container) {
  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Équipe</h1>
        <div class="subtitle" id="people-subtitle">—</div>
      </div>
      <button id="new-person-btn" class="btn btn-primary btn-sm">+ Personne</button>
    </div>
    <div class="view"><div id="people-list"></div></div>
  `;

  const listEl = container.querySelector("#people-list");
  const subtitleEl = container.querySelector("#people-subtitle");
  container.querySelector("#new-person-btn").addEventListener("click", openCreatePersonModal);

  let people = [];
  let followUps = [];

  function render() {
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
    for (const person of people) {
      const own = followUps.filter((f) => f.personId === person.id);
      const inProgress = own.filter((f) => f.status === "in_progress").length;
      const waiting = own.filter((f) => f.status === "waiting").length;
      const late = own.filter(followUpsApi.isControlDue).length;

      const row = document.createElement("div");
      row.className = "item-row";
      row.style.cursor = "pointer";
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">${person.type === "manager" ? "👔" : "👤"} ${escapeHtml(person.name)}</div>
          <div class="item-meta">
            ${inProgress} en cours · ${waiting} en attente
            ${late ? ` · <span style="color:var(--color-danger);font-weight:600;">${late} à relancer</span>` : ""}
          </div>
        </div>
      `;
      row.addEventListener("click", () => openPersonDetail(person, followUps));
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

/** `prefill.type` préselectionne Collaborateur/Manager — utilisé par l'écran Management
 *  (js/views/management.js) pour "+ Ajouter mon manager" sans repasser par Équipe. */
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

export async function openPersonDetail(person, allFollowUps) {
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
    <div class="field">
      <label for="person-notes">Notes</label>
      <textarea id="person-notes" placeholder="Contexte, points d'attention...">${escapeHtml(person.notes || "")}</textarea>
    </div>
    <details ${personHistory.length > 6 ? "" : "open"}>
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
    openPrepModal(person, own, { onDone: reopen });
  });
  body.querySelector("#eadp-btn").addEventListener("click", () => {
    closeModal();
    openPrepareEadpModal(person, { onDone: reopen });
  });

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
            notes: bodyEl.querySelector("#person-notes").value,
          });
          close();
          showToast("Personne mise à jour");
        },
      },
    ],
  });
}

/**
 * "Suivi managérial" : préparer un point collaborateur en un coup d'œil, sans avoir à
 * relire manuellement chaque engagement — ce que Charles-Henri fait avant chaque 1:1.
 * Purement une lecture recomposée des mêmes suivis déjà présents sur la fiche (retard de
 * contrôle en premier, puis le reste par date de contrôle, puis les derniers terminés) :
 * aucune nouvelle donnée, aucun nouveau champ.
 */
function openPrepModal(person, own, { onDone } = {}) {
  const active = [...own.filter((f) => f.status !== "done")].sort((a, b) => {
    const da = a.controlDate ? new Date(a.controlDate).getTime() : Infinity;
    const db = b.controlDate ? new Date(b.controlDate).getTime() : Infinity;
    return da - db;
  });
  const overdue = active.filter(followUpsApi.isControlDue);
  const notOverdue = active.filter((f) => !followUpsApi.isControlDue(f));
  const upcoming = notOverdue.filter((f) => f.direction !== "to_tell");
  const toTell = notOverdue.filter((f) => f.direction === "to_tell");
  const recentlyDone = [...own.filter((f) => f.status === "done")]
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 5);

  const body = document.createElement("div");
  body.innerHTML = `
    ${person.notes ? `<div class="section-title" style="margin-top:0;">📝 Notes</div><div class="card" style="margin-bottom:16px;padding:12px 16px;white-space:pre-wrap;">${escapeHtml(person.notes)}</div>` : ""}
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
    closeModal();
    openEditFollowUpModal(f, { onDone: () => openPrepModal(person, own, { onDone }) });
  };
  renderFollowUpList(body.querySelector("#prep-overdue"), overdue, { onOpen: openFromPrep });
  renderFollowUpList(body.querySelector("#prep-to-tell"), toTell, { onOpen: openFromPrep });
  renderFollowUpList(body.querySelector("#prep-upcoming"), upcoming, { onOpen: openFromPrep });
  renderFollowUpList(body.querySelector("#prep-done"), recentlyDone, { onOpen: openFromPrep });

  openModal({
    title: `🗒️ Point avec ${person.name}`,
    body,
    actions: [{ label: "Fermer", variant: "ghost", onClick: () => onDone?.() }],
  });
}

function renderFollowUpList(container, followUps, { onOpen } = {}) {
  if (!followUps.length) {
    container.innerHTML = `<div class="empty-state" style="padding:16px;">Rien ici.</div>`;
    return;
  }
  for (const f of followUps) {
    const isToTell = f.direction === "to_tell";
    const row = document.createElement("div");
    row.className = "item-row";
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
      <div class="item-main">
        <div class="item-title">${notableIcon}${isToTell ? "📣 " : ""}${escapeHtml(f.title)}${f.category ? ` <span class="item-meta">· ${followUpsApi.CATEGORY_LABELS[f.category]}</span>` : ""}</div>
        <div class="item-meta">${meta} · Ajouté le ${formatDate(f.createdAt)}</div>
      </div>
      <span class="badge badge-${f.status}">${followUpsApi.STATUS_LABELS[f.status]}</span>
    `;
    row.addEventListener("click", () => (onOpen ? onOpen(f) : openEditFollowUpModal(f)));
    container.appendChild(row);
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
 */
export async function openCreateFollowUpModal({ person, projectId, defaultDirection = "waiting_on", onCreated, onCancel } = {}) {
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
    <div class="field">
      <label for="fu-person">Personne</label>
      <select id="fu-person">
        ${people.map((p) => `<option value="${p.id}">${p.type === "manager" ? "👔" : "👤"} ${escapeHtml(p.name)}</option>`).join("")}
      </select>
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
      <input id="fu-title" type="text" placeholder="Ex. Terminer la migration" />
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
      <input id="fu-due" type="date" />
    </div>
    <div class="field">
      <label for="fu-control" id="fu-control-label">Quand dois-je contrôler / relancer ?</label>
      <input id="fu-control" type="date" />
    </div>
    <div class="field">
      <label for="fu-project">Projet (optionnel)</label>
      <select id="fu-project">
        <option value="">— Aucun —</option>
        ${projects.map((p) => `<option value="${p.id}" ${p.id === projectId ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("")}
      </select>
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
          const personId = person ? person.id : bodyEl.querySelector("#fu-person").value;
          if (!personId) return;
          const direction = bodyEl.querySelector('input[name="fu-direction"]:checked')?.value || "waiting_on";
          const followUp = await followUpsApi.createFollowUp({
            title,
            personId,
            direction,
            category: direction === "to_tell" ? bodyEl.querySelector("#fu-category").value || null : null,
            notable: bodyEl.querySelector('input[name="fu-notable"]:checked')?.value || null,
            dueDate: direction === "to_tell" ? null : bodyEl.querySelector("#fu-due").value || null,
            controlDate: bodyEl.querySelector("#fu-control").value || null,
            projectId: bodyEl.querySelector("#fu-project").value || null,
          });
          close();
          showToast("Suivi créé");
          onCreated?.(followUp);
        },
      },
    ],
  });
}

export async function openEditFollowUpModal(followUp, { onDone } = {}) {
  const projects = await projectsApi.listAll();
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
        ${projects.map((p) => `<option value="${p.id}" ${p.id === followUp.projectId ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("")}
      </select>
    </div>
    <div class="field">
      <label>Élément notable ? (préparation EADP, optionnel)</label>
      <div class="chip-row">
        <label class="chip-radio"><input type="radio" name="fu-edit-notable" value="" ${!followUp.notable ? "checked" : ""} /> Aucun</label>
        <label class="chip-radio"><input type="radio" name="fu-edit-notable" value="positive" ${followUp.notable === "positive" ? "checked" : ""} /> 👍 Positif</label>
        <label class="chip-radio"><input type="radio" name="fu-edit-notable" value="negative" ${followUp.notable === "negative" ? "checked" : ""} /> 👎 Négatif</label>
      </div>
    </div>
    <div class="section-title">🔗 Lié</div>
    <div class="card" id="detail-links" style="margin-bottom:8px;"></div>
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <button id="link-existing-btn" class="btn btn-secondary btn-sm">🔗 Lier une fiche</button>
      <button id="create-linked-btn" class="btn btn-secondary btn-sm">+ Créer et lier</button>
    </div>
  `;

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
