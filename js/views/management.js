// Vue Management — §34/§35. Distinct de "Préparer un point collaborateur" (§33, people.js) :
// ici, ce n'est pas moi qui suis quelqu'un, c'est moi qui dois faire remonter des sujets à
// mon propre manager (une personne de type 👔, déjà supporté par Équipe) et préparer mon
// propre point avec lui.
//
// Réutilise entièrement l'objet Suivi plutôt que d'inventer une nouvelle entité (retour de
// Charles-Henri sur le "push d'info", voir js/domain/followups.js) :
//  - 🗳️ Décisions attendues = les Suivis "waiting_on" que j'ai sur ce manager (j'attends
//    quelque chose de lui — typiquement une décision ou une validation).
//  - 📌 Sujets à discuter / ⚠️ Difficultés / 🟢 Réalisations à mentionner = les Suivis
//    "to_tell" sur ce manager, groupés par `category`.
// Le reste (🔵 En cours, 🟢 Réalisé, 🎯 Prochaines étapes) est recomposé depuis les Tâches
// existantes, exactement comme §33 recompose depuis les Suivis — aucune nouvelle donnée
// stockée pour ces sections-là.

import * as peopleApi from "../domain/people.js";
import * as followUpsApi from "../domain/followups.js";
import * as tasksApi from "../domain/tasks.js";
import { openModal, closeModal } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { openPersonDetail, openCreatePersonModal, openCreateFollowUpModal, openEditFollowUpModal } from "./people.js";

export function renderManagement(container) {
  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Management</h1>
        <div class="subtitle" id="management-subtitle">—</div>
      </div>
    </div>
    <div class="view"><div id="management-list"></div></div>
  `;

  const listEl = container.querySelector("#management-list");
  const subtitleEl = container.querySelector("#management-subtitle");

  let people = [];
  let followUps = [];
  let tasks = [];

  function render() {
    const managers = people.filter((p) => p.type === "manager");
    subtitleEl.textContent = managers.length
      ? `${managers.length} manager${managers.length > 1 ? "s" : ""}`
      : "Pas encore de manager renseigné";

    listEl.innerHTML = "";

    if (!managers.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = `<span class="emoji">👔</span>Ajoute ton manager pour préparer tes points avec lui et faire remonter tes sujets.`;
      listEl.appendChild(empty);
      const btn = document.createElement("button");
      btn.className = "btn btn-primary btn-block";
      btn.textContent = "+ Ajouter mon manager";
      btn.addEventListener("click", () => {
        openCreatePersonModal({ type: "manager", onCreated: () => showToast("Manager ajouté") });
      });
      listEl.appendChild(btn);
      return;
    }

    for (const manager of managers) {
      const own = followUps.filter((f) => f.personId === manager.id && f.status !== "done");
      const decisionsAwaited = own.filter((f) => f.direction !== "to_tell");
      const toTell = own.filter((f) => f.direction === "to_tell");
      const topics = toTell.filter((f) => !f.category || f.category === "topic");
      const difficulties = toTell.filter((f) => f.category === "difficulty");
      const achievements = toTell.filter((f) => f.category === "achievement");

      const card = document.createElement("div");
      card.className = "card";
      card.style.marginBottom = "16px";
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
          <div class="item-title" style="cursor:pointer;">👔 ${escapeHtml(manager.name)}</div>
        </div>
        <div class="kanban-card-meta" style="margin-bottom:12px;">
          <span>🗳️ ${decisionsAwaited.length} décision(s) attendue(s)</span>
          <span>📌 ${topics.length} sujet(s)</span>
          ${difficulties.length ? `<span class="badge badge-late">⚠️ ${difficulties.length} difficulté(s)</span>` : ""}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" class="btn btn-secondary btn-sm add-topic-btn">+ Sujet</button>
          <button type="button" class="btn btn-primary btn-sm prep-btn">🗒️ Préparer le point</button>
        </div>
      `;
      card.querySelector(".item-title").addEventListener("click", () => openPersonDetail(manager, followUps));
      card.querySelector(".add-topic-btn").addEventListener("click", () => {
        openCreateFollowUpModal({
          person: manager,
          defaultDirection: "to_tell",
          onCreated: () => showToast("Sujet ajouté"),
        });
      });
      card.querySelector(".prep-btn").addEventListener("click", () => {
        openManagerPrepModal(manager);
      });
      listEl.appendChild(card);
    }
  }

  const unsubPeople = peopleApi.subscribe((items) => {
    people = items;
    render();
  });
  const unsubFollowUps = followUpsApi.subscribe((items) => {
    followUps = items;
    render();
  });
  const unsubTasks = tasksApi.subscribe((items) => {
    tasks = items;
    render();
  });

  return function cleanup() {
    unsubPeople();
    unsubFollowUps();
    unsubTasks();
  };
}

/**
 * §35 "Point manager" : "Depuis le dernier point" — 🟢 Réalisé / 🔵 En cours / ⚠️
 * Difficultés / 🗳️ Décisions attendues / 📌 Sujets à discuter / 🎯 Prochaines étapes.
 * Comme §33, entièrement recomposé à l'ouverture (aucune session de revue persistée) :
 * "depuis le dernier point" est approximé par une fenêtre glissante de 7 jours pour les
 * tâches terminées, faute d'un vrai horodatage de "dernier point" pour l'instant.
 * Récupère ses propres données fraîches (plutôt que de recevoir les groupes déjà calculés
 * par renderManagement) pour pouvoir se rouvrir elle-même après une action menée depuis une
 * modale imbriquée (modifier un suivi) — même principe que openPrepModal (people.js).
 */
async function openManagerPrepModal(manager) {
  const [allFollowUps, tasks] = await Promise.all([followUpsApi.listAll(), tasksApi.listAll()]);
  const own = allFollowUps.filter((f) => f.personId === manager.id && f.status !== "done");
  const decisionsAwaited = own.filter((f) => f.direction !== "to_tell");
  const toTell = own.filter((f) => f.direction === "to_tell");
  const topics = toTell.filter((f) => !f.category || f.category === "topic");
  const difficulties = toTell.filter((f) => f.category === "difficulty");
  const achievements = toTell.filter((f) => f.category === "achievement");

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentlyDone = tasks.filter((t) => t.status === "done" && t.completedAt && t.completedAt >= sevenDaysAgo);
  const inProgress = tasks.filter((t) => t.status === "in_progress");
  const upcoming = [...tasks.filter((t) => t.dueDate && t.status !== "done")]
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 6);

  const body = document.createElement("div");
  body.innerHTML = `
    <div class="section-title" style="margin-top:0;">🟢 Réalisé depuis 7 jours (${recentlyDone.length + achievements.length})</div>
    <div class="card" id="mp-done" style="margin-bottom:16px;"></div>
    <div class="section-title">🔵 En cours (${inProgress.length})</div>
    <div class="card" id="mp-progress" style="margin-bottom:16px;"></div>
    <div class="section-title">⚠️ Difficultés (${difficulties.length})</div>
    <div class="card" id="mp-difficulties" style="margin-bottom:16px;"></div>
    <div class="section-title">🗳️ Décisions attendues (${decisionsAwaited.length})</div>
    <div class="card" id="mp-decisions" style="margin-bottom:16px;"></div>
    <div class="section-title">📌 Sujets à discuter (${topics.length})</div>
    <div class="card" id="mp-topics" style="margin-bottom:16px;"></div>
    <div class="section-title">🎯 Prochaines étapes (${upcoming.length})</div>
    <div class="card" id="mp-upcoming" style="margin-bottom:8px;"></div>
  `;

  renderTaskList(body.querySelector("#mp-done"), recentlyDone, achievements);
  renderTaskList(body.querySelector("#mp-progress"), inProgress, []);
  renderFollowUpItems(body.querySelector("#mp-difficulties"), difficulties, manager);
  renderFollowUpItems(body.querySelector("#mp-decisions"), decisionsAwaited, manager);
  renderFollowUpItems(body.querySelector("#mp-topics"), topics, manager);
  renderTaskList(body.querySelector("#mp-upcoming"), upcoming, []);

  openModal({
    title: `👔 Point avec ${manager.name}`,
    body,
    actions: [{ label: "Fermer", variant: "ghost" }],
  });
}

function renderTaskList(container, tasks, followUpAchievements) {
  const items = [
    ...tasks.map((t) => ({ kind: "task", title: t.title, meta: t.dueDate ? formatDate(t.dueDate) : "" })),
    ...followUpAchievements.map((f) => ({ kind: "followup", title: f.title, meta: "réalisation mentionnée" })),
  ];
  if (!items.length) {
    container.innerHTML = `<div class="empty-state" style="padding:16px;">Rien ici.</div>`;
    return;
  }
  container.innerHTML = "";
  for (const item of items) {
    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
      <div class="item-main">
        <div class="item-title">${escapeHtml(item.title)}</div>
        ${item.meta ? `<div class="item-meta">${escapeHtml(item.meta)}</div>` : ""}
      </div>
    `;
    container.appendChild(row);
  }
}

function renderFollowUpItems(container, followUps, manager) {
  if (!followUps.length) {
    container.innerHTML = `<div class="empty-state" style="padding:16px;">Rien ici.</div>`;
    return;
  }
  container.innerHTML = "";
  for (const f of followUps) {
    const row = document.createElement("div");
    row.className = "item-row";
    row.style.cursor = "pointer";
    row.innerHTML = `<div class="item-main"><div class="item-title">${escapeHtml(f.title)}</div></div>`;
    row.addEventListener("click", () => {
      closeModal();
      openEditFollowUpModal(f, { onDone: () => openManagerPrepModal(manager) });
    });
    container.appendChild(row);
  }
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
