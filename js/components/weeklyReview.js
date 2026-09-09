// Revue hebdomadaire guidée — §51. Un seul mode : pas d'assistant multi-écrans avec un état
// de session à gérer (rien de tel n'existe ailleurs dans l'app — §33/§35 recomposent aussi
// tout à la volée, sans "session de revue" persistée) — une seule modale qui rassemble les 8
// catégories du cahier des charges (7 d'origine + "Cette semaine" ajoutée le 06/09/2026, voir
// plus bas), chacune avec ses éléments cliquables. "L'utilisateur traite les éléments un par
// un" (§51) reste vrai : chaque ligne ouvre la vraie fiche pour agir dessus, puis on revient
// ou on referme.
//
// Tri et affichage (retour de Charles-Henri, 06/09/2026 : "je dois voir le statut, la date de
// contrôle ou la date d'échéance la plus proche") — chaque rubrique qui porte une date
// pertinente (Retards, Cette semaine, Suivis à contrôler, Équipe, Management) affiche
// désormais le statut ET cette date sur sa ligne, triée par ordre croissant de cette même date
// (la plus proche/la plus en retard en premier — un retard, étant dans le passé, a une valeur
// de date plus petite qu'une échéance future, donc ce tri simple les fait déjà remonter en
// tête sans traitement spécial). Les rubriques sans date pertinente (Inbox, Projets sans
// prochaine action, Ressources non classées) restent inchangées.

import * as inboxApi from "../domain/inbox.js?v=3";
import * as tasksApi from "../domain/tasks.js?v=3";
import * as projectsApi from "../domain/projects.js?v=3";
import * as peopleApi from "../domain/people.js?v=3";
import * as followUpsApi from "../domain/followups.js?v=3";
import * as resourcesApi from "../domain/resources.js?v=3";
import * as preferencesApi from "../domain/preferences.js?v=3";
import { openModal, closeModal } from "./modal.js?v=3";
import { renderInfoTip } from "./infoTip.js?v=3";
import { openQualifyModal } from "../views/inbox.js?v=3";
import { openTaskDetail } from "../views/kanban.js?v=3";
import { openProjectDetail } from "../views/projects.js?v=3";
import { openEditFollowUpModal } from "../views/people.js?v=3";
import { openResourceDetail } from "../views/resources.js?v=3";

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

  const late = sortByDateAsc(tasks.filter((t) => tasksApi.isLate(t) && isProjectVisible(t.projectId)), (t) => t.dueDate);
  const weekEnd = Date.now() + 7 * 24 * 60 * 60 * 1000;
  // "Cette semaine (hors équipe)" (retour de Charles-Henri, 06/09/2026 : "il manque les
  // éléments qui ont une échéance dans la semaine hors équipe") — les Tâches (jamais des
  // Suivis, déjà couverts par "Équipe" ci-dessous) dont l'échéance tombe dans les 7 prochains
  // jours mais qui ne sont pas encore en retard (sinon déjà dans "🔴 Retards" ci-dessus).
  const dueSoonTasks = sortByDateAsc(
    tasks.filter(
      (t) => t.dueDate && t.status !== "done" && !tasksApi.isLate(t) && new Date(t.dueDate).getTime() <= weekEnd && isProjectVisible(t.projectId)
    ),
    (t) => t.dueDate
  );
  const dueFollowUps = sortByDateAsc(
    followUps.filter((f) => followUpsApi.isControlDue(f) && isProjectVisible(f.projectId)),
    (f) => f.controlDate
  );
  const activeProjects = projects.filter((p) => p.status === "active");
  const activeStatuses = new Set(["todo", "in_progress", "waiting", "follow_up"]);
  const projectsWithoutNextAction = activeProjects.filter(
    (p) => !tasks.some((t) => t.projectId === p.id && activeStatuses.has(t.status))
  );
  const teamThisWeek = sortByDateAsc(
    followUps.filter(
      (f) => f.status !== "done" && f.controlDate && new Date(f.controlDate).getTime() <= weekEnd && isProjectVisible(f.projectId)
    ),
    (f) => f.controlDate
  );
  const managers = people.filter((p) => p.type === "manager");
  const managementTopics = sortByDateAsc(
    followUps.filter(
      (f) => f.status !== "done" && f.direction === "to_tell" && managers.some((m) => m.id === f.personId) && isProjectVisible(f.projectId)
    ),
    (f) => f.controlDate || f.dueDate
  );
  const unclassifiedResources = resources.filter(resourcesApi.isUnclassified);

  const peopleById = new Map(people.map((p) => [p.id, p]));
  // Ouvre le Suivi lui-même, pas la fiche de la personne (retour de Charles-Henri, 07/09/2026 :
  // "tous les éléments sur lesquels je clique doivent m'emmener sur l'élément lui-même et pas
  // son parent") — cohérent avec js/components/linkedItems.js, qui ouvre déjà correctement le
  // Suivi et jamais la Personne pour une réf {type: "FollowUp"}. Fonctionne même si la personne
  // a été supprimée entre-temps (openEditFollowUpModal gère déjà ce cas).
  const openFollowUpFromReview = (f) => {
    closeModal();
    openEditFollowUpModal(f);
  };

  const body = document.createElement("div");
  body.innerHTML = `
    <div id="wr-help" style="margin-bottom:12px;"></div>
    <div class="section-title" style="margin-top:0;">📥 Inbox (${inboxPending.length})</div>
    <div class="card" id="wr-inbox" style="margin-bottom:16px;"></div>
    <div class="section-title">🔴 Retards (${late.length})</div>
    <div class="card" id="wr-late" style="margin-bottom:16px;"></div>
    <div class="section-title">📅 Cette semaine, hors équipe (${dueSoonTasks.length})</div>
    <div class="card" id="wr-due-soon" style="margin-bottom:16px;"></div>
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
    "La revue hebdomadaire (§51) rassemble en une fois 8 catégories qui, sinon, sont dispersées dans l'app : Inbox non qualifiée, Retards, Cette semaine (hors équipe), Suivis à contrôler, Projets sans prochaine action, Équipe cette semaine, Management et Ressources non classées. Rien n'est recalculé « à un instant T » puis figé : chaque ouverture recompose tout depuis les données actuelles — il n'y a pas de notion de revue « en cours » ou « terminée » à gérer. Clique une ligne pour ouvrir la vraie fiche et la traiter directement ; ferme et rouvre la revue autant de fois que nécessaire, rien n'est perdu entre-temps."
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
    meta: (t) => "Échéance : " + formatDate(t.dueDate),
    badge: (t) => tasksApi.STATUS_LABELS[t.status],
    badgeClass: (t) => t.status,
    onOpen: (t) => {
      closeModal();
      openTaskDetail(t, projects);
    },
  });
  renderRows(body.querySelector("#wr-due-soon"), dueSoonTasks, {
    label: (t) => t.title,
    meta: (t) => "Échéance : " + formatDate(t.dueDate),
    badge: (t) => tasksApi.STATUS_LABELS[t.status],
    badgeClass: (t) => t.status,
    onOpen: (t) => {
      closeModal();
      openTaskDetail(t, projects);
    },
  });
  renderRows(body.querySelector("#wr-followups"), dueFollowUps, {
    label: (f) => `${peopleById.get(f.personId)?.name || "?"} — ${f.title}`,
    meta: (f) => "Contrôle : " + formatDate(f.controlDate),
    badge: (f) => followUpsApi.STATUS_LABELS[f.status],
    badgeClass: (f) => f.status,
    onOpen: openFollowUpFromReview,
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
    meta: (f) => "Contrôle : " + formatDate(f.controlDate),
    badge: (f) => followUpsApi.STATUS_LABELS[f.status],
    badgeClass: (f) => f.status,
    onOpen: openFollowUpFromReview,
  });
  renderRows(body.querySelector("#wr-management"), managementTopics, {
    label: (f) => `${peopleById.get(f.personId)?.name || "?"} — ${f.title}`,
    meta: (f) => (f.controlDate || f.dueDate ? "Contrôle : " + formatDate(f.controlDate || f.dueDate) : ""),
    badge: (f) => followUpsApi.STATUS_LABELS[f.status],
    badgeClass: (f) => f.status,
    onOpen: openFollowUpFromReview,
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

function renderRows(container, items, { label, meta, badge, badgeClass, onOpen }) {
  if (!items.length) {
    container.innerHTML = `<div class="empty-state" style="padding:16px;">🎉 Rien à traiter ici.</div>`;
    return;
  }
  for (const item of items) {
    const row = document.createElement("div");
    row.className = "item-row";
    row.style.cursor = "pointer";
    const metaText = meta ? meta(item) : "";
    row.innerHTML = `
      <div class="item-main">
        <div class="item-title">${escapeHtml(label(item))}</div>
        ${metaText ? `<div class="item-meta">${escapeHtml(metaText)}</div>` : ""}
      </div>
      ${badge ? `<span class="badge badge-${badgeClass(item)}">${escapeHtml(badge(item))}</span>` : ""}
    `;
    row.addEventListener("click", () => onOpen(item));
    container.appendChild(row);
  }
}

// Tri croissant par date (retour de Charles-Henri, 06/09/2026 : "la date de contrôle ou la
// date d'échéance la plus proche" en premier) — un retard (date passée) a une valeur plus
// petite qu'une échéance future, donc ce tri simple fait déjà remonter les retards les plus
// anciens avant les échéances à venir, sans logique séparée pour les deux cas.
function sortByDateAsc(items, getDate) {
  return [...items].sort((a, b) => new Date(getDate(a)).getTime() - new Date(getDate(b)).getTime());
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
