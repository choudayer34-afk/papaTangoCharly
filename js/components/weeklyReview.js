// Revue hebdomadaire guidée — §51. Un seul mode : pas d'assistant multi-écrans avec un état
// de session à gérer (rien de tel n'existe ailleurs dans l'app — §33/§35 recomposent aussi
// tout à la volée, sans "session de revue" persistée) — une seule modale qui rassemble les 7
// catégories du cahier des charges, chacune avec ses éléments cliquables. "L'utilisateur
// traite les éléments un par un" (§51) reste vrai : chaque ligne ouvre la vraie fiche pour
// agir dessus, puis on revient ou on referme.

import * as inboxApi from "../domain/inbox.js";
import * as tasksApi from "../domain/tasks.js";
import * as projectsApi from "../domain/projects.js";
import * as peopleApi from "../domain/people.js";
import * as followUpsApi from "../domain/followups.js";
import * as resourcesApi from "../domain/resources.js";
import * as preferencesApi from "../domain/preferences.js";
import { openModal, closeModal } from "./modal.js";
import { showToast } from "./toast.js";
import { renderInfoTip } from "./infoTip.js";
import { openQualifyModal } from "../views/inbox.js";
import { openTaskDetail } from "../views/kanban.js";
import { openProjectDetail } from "../views/projects.js";
import { openPersonDetail } from "../views/people.js";
import { openResourceDetail } from "../views/resources.js";

export async function openWeeklyReview() {
  // Rappel de rythme (§ piste UX du 31/08/2026, retour de Charles-Henri : "il y a du retard
  // partout") : horodater le lancement ici, pas la fermeture — l'engagement dans la revue
  // compte déjà, pas besoin d'attendre qu'elle soit "terminée" (aucune notion de session ici,
  // voir le commentaire en tête de fichier).
  preferencesApi.markWeeklyReviewDone();

  const [inboxPending, tasks, projects, people, followUps, resources] = await Promise.all([
    inboxApi.listPending(),
    tasksApi.listAll(),
    projectsApi.listAll(),
    peopleApi.listAll(),
    followUpsApi.listAll(),
    resourcesApi.listAll(),
  ]);

  // Projet fermé = lui et tout ce qui lui est lié disparaît des outils de pilotage (retour de
  // Charles-Henri, 02/09/2026) — la Revue hebdomadaire en fait partie, même principe que
  // hatFilterTasks()/hatFilterFollowUps() côté Dashboard et applyFilters() côté Kanban.
  const projectsById = new Map(projects.map((p) => [p.id, p]));
  const isProjectVisible = (projectId) => !projectId || !projectsApi.isArchived(projectsById.get(projectId));

  const late = tasks.filter((t) => tasksApi.isLate(t) && isProjectVisible(t.projectId));
  const dueFollowUps = followUps.filter((f) => followUpsApi.isControlDue(f) && isProjectVisible(f.projectId));
  const activeProjects = projects.filter((p) => p.status === "active");
  const activeStatuses = new Set(["todo", "in_progress", "waiting", "follow_up"]);
  const projectsWithoutNextAction = activeProjects.filter(
    (p) => !tasks.some((t) => t.projectId === p.id && activeStatuses.has(t.status))
  );
  const weekEnd = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const teamThisWeek = followUps.filter(
    (f) => f.status !== "done" && f.controlDate && new Date(f.controlDate).getTime() <= weekEnd && isProjectVisible(f.projectId)
  );
  const managers = people.filter((p) => p.type === "manager");
  const managementTopics = followUps.filter(
    (f) => f.status !== "done" && f.direction === "to_tell" && managers.some((m) => m.id === f.personId) && isProjectVisible(f.projectId)
  );
  const unclassifiedResources = resources.filter(resourcesApi.isUnclassified);

  const peopleById = new Map(people.map((p) => [p.id, p]));
  // Suppression sans cascade (voir domain/people.js) : un Suivi peut pointer vers une
  // personne supprimée entre-temps — on ne casse jamais, on prévient juste.
  const openPersonOrWarn = (f) => {
    const person = peopleById.get(f.personId);
    if (!person) {
      showToast("La personne liée à ce suivi a été supprimée");
      return;
    }
    closeModal();
    openPersonDetail(person, followUps);
  };

  const body = document.createElement("div");
  body.innerHTML = `
    <div id="wr-help" style="margin-bottom:12px;"></div>
    <div class="section-title" style="margin-top:0;">📥 Inbox (${inboxPending.length})</div>
    <div class="card" id="wr-inbox" style="margin-bottom:16px;"></div>
    <div class="section-title">🔴 Retards (${late.length})</div>
    <div class="card" id="wr-late" style="margin-bottom:16px;"></div>
    <div class="section-title">👀 Suivis à contrôler (${dueFollowUps.length})</div>
    <div class="card" id="wr-followups" style="margin-bottom:16px;"></div>
    <div class="section-title">📦 Projets sans prochaine action (${projectsWithoutNextAction.length})</div>
    <div class="card" id="wr-projects" style="margin-bottom:16px;"></div>
    <div class="section-title">👥 Équipe — suivis cette semaine (${teamThisWeek.length})</div>
    <div class="card" id="wr-team" style="margin-bottom:16px;"></div>
    <div class="section-title">👔 Management — sujets à préparer (${managementTopics.length})</div>
    <div class="card" id="wr-management" style="margin-bottom:16px;"></div>
    <div class="section-title">📎 Ressources non classées (${unclassifiedResources.length})</div>
    <div class="card" id="wr-resources" style="margin-bottom:8px;"></div>
  `;

  renderInfoTip(
    body.querySelector("#wr-help"),
    "La revue hebdomadaire (§51) rassemble en une fois 7 catégories qui, sinon, sont dispersées dans l'app : Inbox non qualifiée, Retards, Suivis à contrôler, Projets sans prochaine action, Équipe cette semaine, Management et Ressources non classées. Rien n'est recalculé « à un instant T » puis figé : chaque ouverture recompose tout depuis les données actuelles — il n'y a pas de notion de revue « en cours » ou « terminée » à gérer. Clique une ligne pour ouvrir la vraie fiche et la traiter directement ; ferme et rouvre la revue autant de fois que nécessaire, rien n'est perdu entre-temps."
  );
  renderRows(body.querySelector("#wr-inbox"), inboxPending, {
    label: (i) => i.rawContent,
    onOpen: (i) => {
      closeModal();
      openQualifyModal(i);
    },
  });
  renderRows(body.querySelector("#wr-late"), late, {
    label: (t) => t.title,
    onOpen: (t) => {
      closeModal();
      openTaskDetail(t, projects);
    },
  });
  renderRows(body.querySelector("#wr-followups"), dueFollowUps, {
    label: (f) => `${peopleById.get(f.personId)?.name || "?"} — ${f.title}`,
    onOpen: openPersonOrWarn,
  });
  renderRows(body.querySelector("#wr-projects"), projectsWithoutNextAction, {
    label: (p) => p.name,
    onOpen: (p) => {
      closeModal();
      openProjectDetail(p, tasks.filter((t) => t.projectId === p.id));
    },
  });
  renderRows(body.querySelector("#wr-team"), teamThisWeek, {
    label: (f) => `${peopleById.get(f.personId)?.name || "?"} — ${f.title}`,
    onOpen: openPersonOrWarn,
  });
  renderRows(body.querySelector("#wr-management"), managementTopics, {
    label: (f) => `${peopleById.get(f.personId)?.name || "?"} — ${f.title}`,
    onOpen: openPersonOrWarn,
  });
  renderRows(body.querySelector("#wr-resources"), unclassifiedResources, {
    label: (r) => r.title,
    onOpen: (r) => {
      closeModal();
      openResourceDetail(r, projects, tasks);
    },
  });

  openModal({
    title: "🧭 Revue hebdomadaire",
    body,
    actions: [{ label: "Fermer", variant: "ghost" }],
  });
}

function renderRows(container, items, { label, onOpen }) {
  if (!items.length) {
    container.innerHTML = `<div class="empty-state" style="padding:16px;">🎉 Rien à traiter ici.</div>`;
    return;
  }
  for (const item of items) {
    const row = document.createElement("div");
    row.className = "item-row";
    row.style.cursor = "pointer";
    row.innerHTML = `<div class="item-main"><div class="item-title">${escapeHtml(label(item))}</div></div>`;
    row.addEventListener("click", () => onOpen(item));
    container.appendChild(row);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
