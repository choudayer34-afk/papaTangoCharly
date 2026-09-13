// Vue globale des Suivis — "👀 Suivis" dans l'onglet Équipe (retour de Charles-Henri,
// 13/09/2026 : "disposer d'une vue pour voir les suivis ou choses à dire" ; clarifié ensuite :
// une vue TRANSVERSE, tous projets et personnes confondus, plutôt qu'ouvrir chaque fiche
// Personne une par une). Même principe que renderManagerSection/renderWorkloadSection (mêmes
// mode chips, voir js/views/people.js) : reçoit les données déjà à jour, ne gère aucun état ni
// abonnement propre, se contente de dessiner dans le conteneur fourni.
//
// Réutilise entièrement le Suivi existant (js/domain/followups.js) — deux sections, une par
// `direction` : "👀 J'attends" (waiting_on) et "📣 À transmettre" (to_tell), triées par urgence
// (contrôle en retard d'abord, puis date de contrôle croissante, sans date en dernier). Par
// défaut seuls les suivis non réglés sont affichés (même logique de fond que la case "Inclure
// terminé / archivé" de la recherche globale, js/components/search.js) — une case à cocher
// permet de tout réafficher, y compris "✅ Réglé".

import * as followUpsApi from "../domain/followups.js";
import { openEditFollowUpModal } from "./people.js";

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** Retard d'abord, puis date de contrôle croissante, puis sans date en dernier (ordre stable
 *  sinon — voir sortByCreatedDesc ailleurs dans people.js pour le même principe de tri simple
 *  et prévisible plutôt qu'un critère composite opaque). */
function sortByUrgency(followUps) {
  return [...followUps].sort((a, b) => {
    const aOverdue = followUpsApi.isControlDue(a);
    const bOverdue = followUpsApi.isControlDue(b);
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    if (!a.controlDate && !b.controlDate) return 0;
    if (!a.controlDate) return 1;
    if (!b.controlDate) return -1;
    return new Date(a.controlDate) - new Date(b.controlDate);
  });
}

function renderGroup(container, followUps, people, projects) {
  if (!followUps.length) {
    container.innerHTML = `<div class="empty-state" style="padding:16px;">Rien ici.</div>`;
    return;
  }
  container.innerHTML = "";
  for (const f of followUps) {
    const person = people.find((p) => p.id === f.personId);
    const project = projects.find((p) => p.id === f.projectId);
    const overdue = followUpsApi.isControlDue(f);
    const row = document.createElement("div");
    row.className = "item-row";
    row.style.cursor = "pointer";
    row.innerHTML = `
      <div class="item-main">
        <div class="item-title">
          ${escapeHtml(f.title)}
          ${f.status === "done" ? `<span class="badge">✅ Réglé</span>` : ""}
          ${overdue ? `<span class="badge badge-late">🔴 En retard</span>` : ""}
        </div>
        <div class="item-meta">
          ${person ? `${person.type === "manager" ? "👔" : "👤"} ${escapeHtml(person.name)}` : "— personne inconnue —"}
          ${project ? ` · 📦 ${escapeHtml(project.name)}` : ""}
          ${f.category ? ` · ${escapeHtml(followUpsApi.CATEGORY_LABELS[f.category] || f.category)}` : ""}
          ${f.controlDate ? ` · à contrôler le ${formatDate(f.controlDate)}` : ""}
        </div>
      </div>
    `;
    row.addEventListener("click", () => openEditFollowUpModal(f));
    container.appendChild(row);
  }
}

export function renderFollowUpsOverview(container, people, followUps, projects) {
  container.innerHTML = `
    <label style="display:flex;align-items:center;gap:8px;font-size:var(--font-size-sm);color:var(--color-text-muted);margin-bottom:12px;">
      <input id="followups-include-done" type="checkbox" style="width:auto;" />
      Inclure ce qui est réglé
    </label>
    <div class="section-title" style="margin-top:0;">👀 J'attends quelque chose (<span id="fo-waiting-count"></span>)</div>
    <div class="card" id="fo-waiting" style="margin-bottom:16px;"></div>
    <div class="section-title">📣 À transmettre (<span id="fo-totell-count"></span>)</div>
    <div class="card" id="fo-totell" style="margin-bottom:8px;"></div>
  `;

  const includeDoneEl = container.querySelector("#followups-include-done");
  const waitingEl = container.querySelector("#fo-waiting");
  const toTellEl = container.querySelector("#fo-totell");
  const waitingCountEl = container.querySelector("#fo-waiting-count");
  const toTellCountEl = container.querySelector("#fo-totell-count");

  function draw() {
    const includeDone = includeDoneEl.checked;
    const scoped = includeDone ? followUps : followUps.filter((f) => f.status !== "done");
    const waiting = sortByUrgency(scoped.filter((f) => f.direction !== "to_tell"));
    const toTell = sortByUrgency(scoped.filter((f) => f.direction === "to_tell"));
    waitingCountEl.textContent = waiting.length;
    toTellCountEl.textContent = toTell.length;
    renderGroup(waitingEl, waiting, people, projects);
    renderGroup(toTellEl, toTell, people, projects);
  }

  includeDoneEl.addEventListener("change", draw);
  draw();
}
