// Vue Équipe — §31 (liste) et §32 (fiche collaborateur simplifiée).

import * as peopleApi from "../domain/people.js";
import * as followUpsApi from "../domain/followups.js";
import * as projectsApi from "../domain/projects.js";
import { openModal } from "../components/modal.js";
import { showToast } from "../components/toast.js";

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

function openCreatePersonModal() {
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="person-name">Nom</label>
      <input id="person-name" type="text" placeholder="Ex. Clément" />
    </div>
    <div class="field">
      <label for="person-type">Type</label>
      <select id="person-type">
        <option value="collaborateur">👤 Collaborateur</option>
        <option value="manager">👔 Manager</option>
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
      { label: "Annuler", variant: "ghost" },
      {
        label: "Créer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          const name = bodyEl.querySelector("#person-name").value.trim();
          if (!name) return;
          await peopleApi.createPerson({
            name,
            type: bodyEl.querySelector("#person-type").value,
            role: bodyEl.querySelector("#person-role").value.trim(),
          });
          close();
          showToast("Personne ajoutée");
        },
      },
    ],
  });
}

function openPersonDetail(person, allFollowUps) {
  const own = allFollowUps.filter((f) => f.personId === person.id);
  const active = own.filter((f) => f.status !== "done");
  const done = own.filter((f) => f.status === "done");

  const body = document.createElement("div");
  body.innerHTML = `
    <div class="section-title" style="margin-top:0;">🎯 Engagements en cours (${active.length})</div>
    <div class="card" id="active-followups" style="margin-bottom:16px;"></div>
    <button id="add-followup-btn" class="btn btn-secondary btn-sm btn-block" style="margin-bottom:16px;">+ Suivi</button>
    <div class="section-title">🟢 Réalisé (${done.length})</div>
    <div class="card" id="done-followups" style="margin-bottom:16px;"></div>
    <div class="field">
      <label for="person-notes">Notes</label>
      <textarea id="person-notes" placeholder="Contexte, points d'attention...">${escapeHtml(person.notes || "")}</textarea>
    </div>
  `;

  const activeEl = body.querySelector("#active-followups");
  renderFollowUpList(activeEl, active);
  const doneEl = body.querySelector("#done-followups");
  renderFollowUpList(doneEl, done);

  body.querySelector("#add-followup-btn").addEventListener("click", () => openCreateFollowUpModal(person));

  const { bodyEl, close } = openModal({
    title: (person.type === "manager" ? "👔 " : "👤 ") + person.name,
    body,
    actions: [
      { label: "Fermer", variant: "ghost" },
      {
        label: "Enregistrer les notes",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          await peopleApi.updatePerson(person.id, { notes: bodyEl.querySelector("#person-notes").value });
          close();
          showToast("Notes enregistrées");
        },
      },
    ],
  });
}

function renderFollowUpList(container, followUps) {
  if (!followUps.length) {
    container.innerHTML = `<div class="empty-state" style="padding:16px;">Rien ici.</div>`;
    return;
  }
  for (const f of followUps) {
    const row = document.createElement("div");
    row.className = "item-row";
    row.style.cursor = "pointer";
    row.innerHTML = `
      <div class="item-main">
        <div class="item-title">${escapeHtml(f.title)}</div>
        <div class="item-meta">${f.dueDate ? "Échéance : " + formatDate(f.dueDate) : "Pas d'échéance"}</div>
      </div>
      <span class="badge badge-${f.status}">${followUpsApi.STATUS_LABELS[f.status]}</span>
    `;
    row.addEventListener("click", () => openEditFollowUpModal(f));
    container.appendChild(row);
  }
}

async function openCreateFollowUpModal(person) {
  const projects = await projectsApi.listAll();
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="fu-title">Qu'est-ce que ${escapeHtml(person.name)} s'engage à faire ?</label>
      <input id="fu-title" type="text" placeholder="Ex. Terminer la migration" />
    </div>
    <div class="field">
      <label for="fu-due">Échéance de ${escapeHtml(person.name)}</label>
      <input id="fu-due" type="date" />
    </div>
    <div class="field">
      <label for="fu-control">Quand dois-je contrôler / relancer ?</label>
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
          await followUpsApi.createFollowUp({
            title,
            personId: person.id,
            dueDate: bodyEl.querySelector("#fu-due").value || null,
            controlDate: bodyEl.querySelector("#fu-control").value || null,
            projectId: bodyEl.querySelector("#fu-project").value || null,
          });
          close();
          showToast("Suivi créé");
        },
      },
    ],
  });
}

function openEditFollowUpModal(followUp) {
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
      <label for="fu-edit-control">Prochain contrôle</label>
      <input id="fu-edit-control" type="date" value="${followUp.controlDate || ""}" />
    </div>
  `;
  const { bodyEl, close } = openModal({
    title: "Modifier le suivi",
    body,
    actions: [
      { label: "Fermer", variant: "ghost" },
      {
        label: "Enregistrer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          await followUpsApi.updateFollowUp(followUp.id, {
            title: bodyEl.querySelector("#fu-edit-title").value.trim(),
            status: bodyEl.querySelector("#fu-edit-status").value,
            controlDate: bodyEl.querySelector("#fu-edit-control").value || null,
          });
          close();
          showToast("Suivi mis à jour");
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
