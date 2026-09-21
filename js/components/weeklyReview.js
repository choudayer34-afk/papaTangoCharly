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

import * as inboxApi from "../domain/inbox.js";
import * as tasksApi from "../domain/tasks.js";
import * as projectsApi from "../domain/projects.js";
import * as peopleApi from "../domain/people.js";
import * as followUpsApi from "../domain/followups.js";
import * as resourcesApi from "../domain/resources.js";
import * as preferencesApi from "../domain/preferences.js";
import { openModal, closeModal } from "./modal.js";
import { renderInfoTip } from "./infoTip.js";
import { openQualifyModal } from "../views/inbox.js";
import { openTaskDetail } from "../views/kanban.js";
import { openProjectDetail } from "../views/projects.js";
import { openEditFollowUpModal } from "../views/people.js";
import { openResourceDetail } from "../views/resources.js";
import * as dateUtils from "../services/dateUtils.js";

// TODO-013 (LOT 6, 21/09/2026) — même principe de "Traiter en lot" que js/views/inbox.js,
// strictement limité aux 3 qualifications sans formulaire de création (Information/kept,
// Idée/idea, Archivé/archived). Redéfini ici en local plutôt qu'importé de js/views/inbox.js :
// ce fichier n'exporte pas sa propre liste, et la garde d'implémentation du TODO-013 demande
// justement de ne pas construire de mécanisme partagé entre les deux — seules ces 3 lignes de
// données (pas de logique) sont dupliquées.
const WR_BULK_CHOICES = [
  { key: "kept", emoji: "🧠", label: "Information" },
  { key: "idea", emoji: "💡", label: "Idée", mapsTo: "kept" },
  { key: "archived", emoji: "🗑️", label: "Archiver" },
];

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
  // BUG corrigé (15/09/2026, audit "anomalies silencieuses" : unification du calcul de dates) —
  // `new Date(dateStr).getTime() <= Date.now() + 7 jours` mélangeait un parsing UTC de
  // l'échéance avec un instant courant en temps réel (pas un début de journée) : une fenêtre
  // "7 jours" qui glissait selon l'heure du jour ET le fuseau, au lieu de "au plus 7 jours civils
  // d'ici" comme partout ailleurs dans l'app (dashboard.js, kanban.js). Remplacé par
  // dateUtils.daysFromToday(...) <= 7, cohérent avec le reste de l'app — voir
  // js/services/dateUtils.js.
  // "Cette semaine (hors équipe)" (retour de Charles-Henri, 06/09/2026 : "il manque les
  // éléments qui ont une échéance dans la semaine hors équipe") — les Tâches (jamais des
  // Suivis, déjà couverts par "Équipe" ci-dessous) dont l'échéance tombe dans les 7 prochains
  // jours mais qui ne sont pas encore en retard (sinon déjà dans "🔴 Retards" ci-dessus).
  const dueSoonTasks = sortByDateAsc(
    tasks.filter(
      (t) => t.dueDate && t.status !== "done" && !tasksApi.isLate(t) && dateUtils.daysFromToday(t.dueDate) <= 7 && isProjectVisible(t.projectId)
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
      (f) => f.status !== "done" && f.controlDate && dateUtils.daysFromToday(f.controlDate) <= 7 && isProjectVisible(f.projectId)
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
    <div class="section-title" style="margin-top:0;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
      <span id="wr-inbox-section-title">📥 Inbox (${inboxPending.length})</span>
      <button type="button" id="wr-inbox-bulk-toggle" class="btn btn-ghost btn-sm">☑️ Traiter en lot</button>
    </div>
    <div id="wr-inbox-bulk-toolbar"></div>
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
  // TODO-013 (LOT 6) — la section Inbox est la SEULE des 8 à ne pas utiliser renderRows() :
  // c'est la seule à porter le mode "Traiter en lot" (limité à kept/idea/archived, voir
  // WR_BULK_CHOICES ci-dessus), donc un rendu propre à ce fichier plutôt qu'un paramètre
  // supplémentaire greffé sur renderRows(), qui reste inchangé pour les 7 autres sections.
  // `inboxItems` est une copie locale, mutable, de `inboxPending` : un traitement en lot retire
  // les éléments traités de cette liste et ne referme pas toute la revue (voir
  // processInboxBulk ci-dessous), contrairement à `onOpen` du traitement individuel.
  let inboxItems = [...inboxPending];
  let wrBulkMode = false;
  const wrBulkSelection = new Set();
  const inboxSectionTitleEl = body.querySelector("#wr-inbox-section-title");
  const inboxBulkToggleBtn = body.querySelector("#wr-inbox-bulk-toggle");
  const inboxBulkToolbarEl = body.querySelector("#wr-inbox-bulk-toolbar");
  const inboxContainerEl = body.querySelector("#wr-inbox");

  function renderInboxBulkToolbar() {
    inboxBulkToolbarEl.innerHTML = "";
    if (!wrBulkMode || wrBulkSelection.size === 0) return;
    const bar = document.createElement("div");
    // Classe reprise de js/views/kanban.js (barre d'actions en masse) uniquement pour la
    // cohérence visuelle — aucune logique JS partagée avec elle, ni avec js/views/inbox.js.
    bar.className = "pilotage-bulk-toolbar";
    bar.style.marginBottom = "8px";
    bar.innerHTML = `
      <span class="pilotage-bulk-toolbar-count">${wrBulkSelection.size} élément${wrBulkSelection.size > 1 ? "s" : ""} sélectionné${wrBulkSelection.size > 1 ? "s" : ""}</span>
      ${WR_BULK_CHOICES.map((c) => `<button type="button" class="btn btn-secondary btn-sm" data-bulk-choice="${c.key}">${c.emoji} ${escapeHtml(c.label)}</button>`).join("")}
      <button type="button" id="wr-inbox-bulk-clear" class="btn btn-ghost btn-sm">Tout désélectionner</button>
    `;
    bar.querySelectorAll("[data-bulk-choice]").forEach((btn) => btn.addEventListener("click", () => processInboxBulk(btn.dataset.bulkChoice)));
    bar.querySelector("#wr-inbox-bulk-clear").addEventListener("click", () => {
      wrBulkSelection.clear();
      renderInboxSection();
    });
    inboxBulkToolbarEl.appendChild(bar);
  }

  async function processInboxBulk(key) {
    const choice = WR_BULK_CHOICES.find((c) => c.key === key);
    if (!choice) return;
    const ids = [...wrBulkSelection];
    if (!ids.length) return;
    const outcome = choice.mapsTo || choice.key;
    // Garde anti-double-traitement (TODO-013), identique dans son principe à celle de
    // js/views/inbox.js : sélection vidée et rendu refait de façon SYNCHRONE avant le `await`.
    wrBulkSelection.clear();
    renderInboxSection();
    await Promise.all(ids.map((id) => inboxApi.qualify(id, outcome)));
    // Ne ferme PAS toute la revue (contrairement à `onOpen` ci-dessous) : ces 3 issues n'ouvrent
    // aucune fiche à consulter, retirer les éléments traités de la liste locale et rafraîchir la
    // section sur place suffit — la revue hebdomadaire reste ouverte pour la suite.
    inboxItems = inboxItems.filter((i) => !ids.includes(i.id));
    renderInboxSection();
  }

  function renderInboxSection() {
    inboxSectionTitleEl.textContent = `📥 Inbox (${inboxItems.length})`;
    inboxContainerEl.innerHTML = "";
    if (!inboxItems.length) {
      inboxContainerEl.innerHTML = `<div class="empty-state" style="padding:16px;">🎉 Rien à traiter ici.</div>`;
      renderInboxBulkToolbar();
      return;
    }
    for (const item of inboxItems) {
      const row = document.createElement("div");
      row.className = "item-row";
      row.innerHTML = `<div class="item-main"><div class="item-title">${escapeHtml(item.rawContent)}</div></div>`;
      if (wrBulkMode) {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.setAttribute("aria-label", "Sélectionner pour un traitement en lot");
        checkbox.style.marginRight = "12px";
        checkbox.checked = wrBulkSelection.has(item.id);
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) wrBulkSelection.add(item.id);
          else wrBulkSelection.delete(item.id);
          renderInboxBulkToolbar();
        });
        row.prepend(checkbox);
      } else {
        // Comportement individuel inchangé (§51 : "l'utilisateur traite les éléments un par
        // un") : clic → ferme la revue, ouvre la qualification complète (9 choix).
        row.style.cursor = "pointer";
        row.addEventListener("click", () => {
          closeModal();
          openQualifyModal(item);
        });
      }
      inboxContainerEl.appendChild(row);
    }
    renderInboxBulkToolbar();
  }

  inboxBulkToggleBtn.addEventListener("click", () => {
    wrBulkMode = !wrBulkMode;
    inboxBulkToggleBtn.textContent = wrBulkMode ? "✅ Mode lot actif" : "☑️ Traiter en lot";
    inboxBulkToggleBtn.classList.toggle("btn-secondary", wrBulkMode);
    inboxBulkToggleBtn.classList.toggle("btn-ghost", !wrBulkMode);
    if (!wrBulkMode) wrBulkSelection.clear();
    renderInboxSection();
  });

  renderInboxSection();

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
