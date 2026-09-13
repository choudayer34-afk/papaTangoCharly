// Dashboard — "🏠 Mon pilotage" (§50). Ne contient aucune logique métier propre :
// il ne fait que consommer les services existants (§78.15) et afficher les chiffres.

import * as tasksApi from "../domain/tasks.js";
import * as inboxApi from "../domain/inbox.js";
import * as projectsApi from "../domain/projects.js";
import * as meetingsApi from "../domain/meetings.js";
import * as decisionsApi from "../domain/decisions.js";
import * as historyApi from "../domain/history.js";
import * as peopleApi from "../domain/people.js";
import * as followUpsApi from "../domain/followups.js";
import * as preferencesApi from "../domain/preferences.js";
import * as casquettesApi from "../domain/casquettes.js";
import * as priorisationApi from "../domain/priorisation.js";
import { openModal, closeModal, confirmDelete } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { showHintOnce } from "../components/hint.js";
import { suggestNextStep } from "../components/suggestNextStep.js";
import { openRecipesModal } from "../components/recipes.js";
import { renderHistoryTimeline } from "../components/historyTimeline.js";
import { openEditFollowUpModal } from "./people.js";
import { openProjectDetail } from "./projects.js";
import { openTaskDetail } from "./kanban.js";
import * as linkedItemsApi from "../components/linkedItems.js";
import { renderCanevas } from "../components/canevas.js";
import { renderNotesBlock } from "../components/notesBlock.js";
import { openWeeklyReview } from "../components/weeklyReview.js";
import { openQualifyChoice, openKeptItemDetail, openAllKeptItemsModal } from "./inbox.js";
import { openCaptureModal } from "../components/capture.js";
import { getDraft, clearDraft } from "../services/draftStore.js";
import { renderInfoTip } from "../components/infoTip.js";
import { copyEntityLink } from "../components/copyLink.js";
import { renderDecisionGrid } from "../components/decisionGrid.js";
import { getTheme, getEffectiveTheme, setTheme } from "../services/themeStore.js";

const KEPT_TYPE_LABELS = { kept: "🧠 Information", idea: "💡 Idée" };
const RECENT_MAX_AGE_MS = 15 * 24 * 60 * 60 * 1000;

// Sections repliables/masquables (piste UX du 31/08/2026, retour de Charles-Henri : "l'accueil
// se rallonge avec les éléments qui prennent de l'ampleur") — chaque section connaît sa propre
// clé de préférence (js/domain/preferences.js#dashboardHidden) ; le bloc chiffré (stat-grid)
// n'y figure pas volontairement : c'est le seul repère qui doit toujours rester visible.
//
// Audit de simplification du 02/09/2026 (retour de Charles-Henri : "on fait l'ensemble des
// modifications suggérées") — "À échéance dans les 7 jours", "En pause depuis un moment" et
// "Suivis en retard" répondaient toutes les trois à la même question de fond ("qu'est-ce qui a
// besoin de moi ?"), calculées indépendamment : fusionnées en une seule section "needsAttention"
// (voir renderNeedsAttentionSection). "recentlyViewed" ("🔄 Reprendre où j'en étais") devient
// masquable pour la première fois — elle ne l'était pas avant ce round.
const DASHBOARD_SECTIONS = [
  { key: "needsAttention", label: "⚠️ Ça a besoin de toi" },
  { key: "kept", label: "🧠 Informations & idées" },
  { key: "projects", label: "📦 Mes projets" },
  { key: "recentlyViewed", label: "🔄 Reprendre où j'en étais" },
  { key: "recent", label: "🧠 Récemment" },
];

// Profil "épuré" (audit de simplification du 02/09/2026, choix retenu avec Charles-Henri :
// "Minimal") — appliqué une seule fois, la toute première fois que ce round tourne (voir
// preferencesApi.markDashboardHiddenMigratedV19), pour que la simplification prenne effet tout
// de suite plutôt que de rester une option qu'il faudrait aller cocher soi-même dans ⚙️.
const DEFAULT_HIDDEN_V19 = ["kept", "projects", "recentlyViewed", "recent"];

export function renderDashboard(container) {
  container.innerHTML = `
    <div class="topbar">
      <div style="display:flex;align-items:center;gap:12px;">
        <!-- Interrupteur clair/sombre (retour de Charles-Henri, 13/09/2026 : "un petit
             interrupteur sur l'écran d'accueil en haut à gauche") — voir
             js/services/themeStore.js et refreshThemeToggleUI() plus bas. -->
        <div class="theme-toggle" title="Basculer clair / sombre">
          <span class="theme-toggle-icon" id="theme-toggle-icon-light" aria-hidden="true">☀️</span>
          <label class="theme-toggle-switch">
            <input id="theme-toggle-input" type="checkbox" />
            <span class="theme-toggle-track"><span class="theme-toggle-thumb"></span></span>
          </label>
          <span class="theme-toggle-icon" id="theme-toggle-icon-dark" aria-hidden="true">🌙</span>
        </div>
        <div>
          <h1>Mon pilotage</h1>
          <div class="subtitle">${formatToday()}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button id="recipes-btn" class="btn btn-secondary btn-sm">🧩 Recettes</button>
        <button id="weekly-review-btn" class="btn btn-secondary btn-sm">🧭 Revue hebdo</button>
        <button id="my-objectives-btn" class="btn btn-secondary btn-sm">🎯 Mes objectifs</button>
        <button id="dashboard-settings-btn" class="btn btn-secondary btn-sm" aria-label="Personnaliser l'accueil">⚙️</button>
      </div>
    </div>
    <div class="view">
      <div id="capture-draft-banner"></div>
      <div id="review-reminder"></div>
      <div id="notif-optin"></div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="chip-row" id="hat-filter" style="margin-bottom:0;flex:1;min-width:0;"></div>
        <span id="hat-filter-info"></span>
      </div>
      <div class="stat-grid" id="stat-grid"></div>
      <div id="recent-viewed-section"></div>
      <div id="focus-section"></div>
      <div id="focus-queue-section"></div>
      <div id="needs-attention-section"></div>
      <div id="kept-section"></div>
      <div id="projects-section"></div>
      <div id="recent-section"></div>
    </div>
  `;

  container.querySelector("#recipes-btn").addEventListener("click", () => openRecipesModal());
  container.querySelector("#weekly-review-btn").addEventListener("click", () => openWeeklyReview());
  container.querySelector("#my-objectives-btn").addEventListener("click", () => openMyObjectivesModal());
  container.querySelector("#dashboard-settings-btn").addEventListener("click", () => openDashboardSettingsModal());

  // Interrupteur clair/sombre — reflète le thème RÉELLEMENT appliqué à l'écran (choix explicite
  // s'il y en a un, sinon le réglage de l'appareil), jamais seulement "un choix a-t-il déjà été
  // posé" (voir js/services/themeStore.js#getEffectiveTheme). Écoute aussi les changements de
  // réglage de l'appareil en direct : tant qu'aucun choix explicite n'a été posé ici, l'app
  // suit déjà l'appareil via CSS (styles/tokens.css) — l'interrupteur doit rester synchronisé
  // avec cet état plutôt que de figer sa position au moment du montage.
  const themeToggleInput = container.querySelector("#theme-toggle-input");
  const themeToggleLightIcon = container.querySelector("#theme-toggle-icon-light");
  const themeToggleDarkIcon = container.querySelector("#theme-toggle-icon-dark");
  function refreshThemeToggleUI() {
    const dark = getEffectiveTheme() === "dark";
    themeToggleInput.checked = dark;
    themeToggleLightIcon.classList.toggle("active", !dark);
    themeToggleDarkIcon.classList.toggle("active", dark);
    themeToggleInput.title = dark ? "Passer en mode clair" : "Passer en mode sombre";
  }
  refreshThemeToggleUI();
  themeToggleInput.addEventListener("change", () => {
    setTheme(themeToggleInput.checked ? "dark" : "light");
    refreshThemeToggleUI();
  });
  const themeMediaQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const onSystemThemeChange = () => {
    if (getTheme() === "system") refreshThemeToggleUI();
  };
  themeMediaQuery?.addEventListener("change", onSystemThemeChange);
  showHintOnce(
    container.querySelector(".view"),
    "dashboard-hats-v1",
    "Le filtre <strong>Toutes / Toi / Équipe / Projets / Manager / CSE</strong> ci-dessous limite l'Accueil à une seule casquette à la fois — il est déduit automatiquement du projet ou de la personne concernée. Le bouton ⚙️ permet de replier les sections dont tu ne te sers pas."
  );
  renderInfoTip(container.querySelector("#hat-filter-info"), casquettesApi.HAT_INFO_HTML);

  const captureDraftBannerEl = container.querySelector("#capture-draft-banner");
  const reviewReminderEl = container.querySelector("#review-reminder");
  const notifOptInEl = container.querySelector("#notif-optin");
  const hatFilterEl = container.querySelector("#hat-filter");
  const statGrid = container.querySelector("#stat-grid");
  const recentViewedSection = container.querySelector("#recent-viewed-section");
  const focusSection = container.querySelector("#focus-section");
  const focusQueueSection = container.querySelector("#focus-queue-section");
  const needsAttentionSection = container.querySelector("#needs-attention-section");
  const keptSection = container.querySelector("#kept-section");
  const projectsSection = container.querySelector("#projects-section");
  const recentSection = container.querySelector("#recent-section");

  let tasks = [];
  let inboxPendingCount = 0;
  let projects = [];
  let meetings = [];
  let decisions = [];
  let people = [];
  let followUps = [];
  let keptItems = [];
  let projectSortMode = "manual";
  let categories = {};
  let activeHat = "all";
  let hiddenSections = new Set();
  let focusOverride = { date: null, addedTaskIds: [] };
  // Poids de la matrice de priorisation (vague 33) — réglés depuis l'onglet 🎯 Priorisation
  // (Pilotage), relus ici à chaque montage de l'Accueil comme le reste des préférences
  // ci-dessous ; valeurs par défaut tant que Charles-Henri n'a rien réglé.
  let priorityWeights = priorisationApi.DEFAULT_WEIGHTS;
  let recentlyViewed = [];
  // Mode "Focus" (audit TDAH ciblé du 07/09/2026) — voir applyHomeModeVisibility() et
  // renderFocusQueueSection() plus bas. `focusExpanded`/`focusQueueIndex` sont volontairement
  // NON persistés : un état d'affichage transitoire, remis à zéro à chaque montage de l'Accueil,
  // pas une préférence durable comme `homeMode` lui-même.
  let homeMode = "classic";
  let focusExpanded = false;
  let focusQueueIndex = 0;

  // Lecture locale (localStorage), synchrone — pas besoin d'attendre les préférences
  // Firestore pour afficher ce bandeau, qui doit apparaître le plus tôt possible.
  renderCaptureDraftBanner();

  preferencesApi.getPreferences().then((prefs) => {
    projectSortMode = prefs.projectSort || "manual";
    categories = prefs.categories || {};
    activeHat = prefs.casquette || "all";
    if (!prefs.dashboardHiddenMigratedV19) {
      // Bascule one-shot vers le profil "épuré" (voir DEFAULT_HIDDEN_V19 ci-dessus) — jamais
      // répétée ensuite, pour respecter toute personnalisation faite après par Charles-Henri.
      hiddenSections = new Set(DEFAULT_HIDDEN_V19);
      preferencesApi.setDashboardHidden(DEFAULT_HIDDEN_V19).catch(() => {});
      preferencesApi.markDashboardHiddenMigratedV19().catch(() => {});
    } else {
      hiddenSections = new Set(prefs.dashboardHidden || []);
    }
    focusOverride = prefs.focusOverride || { date: null, addedTaskIds: [] };
    priorityWeights = prefs.priorityWeights || priorisationApi.DEFAULT_WEIGHTS;
    recentlyViewed = prefs.recentlyViewed || [];
    homeMode = prefs.homeMode || "classic";
    renderHatFilter();
    renderReviewReminder(prefs.lastWeeklyReviewAt);
    renderNotifOptIn(prefs.notifOptIn);
    renderStats();
    renderRecentlyViewedSection();
    renderFocusSection();
    renderNeedsAttentionSection();
    renderFocusQueueSection();
    renderKeptSection();
    renderProjectsSection();
    renderRecentSection();
    applyHomeModeVisibility();
  });

  function renderHatFilter() {
    casquettesApi.renderHatChipRow(hatFilterEl, activeHat, async (hatId) => {
      activeHat = hatId;
      renderHatFilter();
      renderStats();
      renderFocusSection();
      renderNeedsAttentionSection();
      renderFocusQueueSection();
      renderProjectsSection();
      renderRecentSection();
      await preferencesApi.setCasquette(hatId);
    });
  }

  /**
   * "✏️ Saisie laissée en cours" (piste TDAH du 02/09/2026, retour de Charles-Henri — ses
   * propres exemples du quotidien : reposer un yaourt pour passer l'aspirateur et ne s'en
   * souvenir qu'en entendant le camion de recyclage ; demander un café et l'oublier
   * complètement, absorbé ailleurs. Le point commun : une interruption efface totalement ce
   * qui était en cours, et rien ne le fait remonter sans un signal extérieur). Le brouillon
   * lui-même est sauvegardé automatiquement pendant la frappe dans Capturer
   * (js/components/capture.js, js/services/draftStore.js) ; ce bandeau EST le signal
   * extérieur — affiché en tout premier sur l'Accueil, l'endroit que Charles-Henri regarde
   * déjà tous les jours, plutôt que de compter sur lui pour penser à rouvrir Capturer tout
   * seul. Volontairement hors de `DASHBOARD_SECTIONS` (non repliable/masquable) : un
   * brouillon oublié ne doit jamais pouvoir disparaître silencieusement parce que la section a
   * été repliée un jour — même traitement que le bandeau d'opt-in de notification ci-dessous.
   */
  function renderCaptureDraftBanner() {
    const draft = getDraft("capture");
    if (!draft || !draft.value || !draft.value.trim()) {
      captureDraftBannerEl.innerHTML = "";
      return;
    }
    const trimmed = draft.value.trim();
    const preview = trimmed.length > 80 ? trimmed.slice(0, 80) + "…" : trimmed;
    captureDraftBannerEl.innerHTML = `
      <div class="review-banner">
        <span>✏️ Saisie laissée en cours : « ${escapeHtml(preview)} »</span>
        <div style="display:flex;gap:8px;">
          <button type="button" id="capture-draft-resume" class="btn btn-primary btn-sm">Reprendre</button>
          <button type="button" id="capture-draft-discard" class="btn btn-secondary btn-sm">Abandonner</button>
        </div>
      </div>
    `;
    captureDraftBannerEl.querySelector("#capture-draft-resume").addEventListener("click", () => {
      openCaptureModal({ onClose: () => renderCaptureDraftBanner() });
    });
    captureDraftBannerEl.querySelector("#capture-draft-discard").addEventListener("click", () => {
      clearDraft("capture");
      renderCaptureDraftBanner();
      showToast("Brouillon abandonné");
    });
  }

  /**
   * Bandeau d'opt-in pour l'alerte au démarrage (piste TDAH du 01/09/2026, discussion
   * permanence/repérage — "rappels programmés", version retenue : notification navigateur
   * uniquement app ouverte, sans infrastructure serveur). Proposé une seule fois : une fois
   * `notifOptIn` tranché (true ou false), ce bandeau ne réapparaît jamais.
   */
  function renderNotifOptIn(notifOptIn) {
    if (notifOptIn !== null || typeof Notification === "undefined") {
      notifOptInEl.innerHTML = "";
      return;
    }
    notifOptInEl.innerHTML = `
      <div class="review-banner">
        <span>🔔 Être alerté dès l'ouverture de l'app s'il y a du retard ou des tâches en pause ?</span>
        <div style="display:flex;gap:8px;">
          <button type="button" id="notif-optin-yes" class="btn btn-primary btn-sm">Activer</button>
          <button type="button" id="notif-optin-no" class="btn btn-secondary btn-sm">Non merci</button>
        </div>
      </div>
    `;
    notifOptInEl.querySelector("#notif-optin-yes").addEventListener("click", async () => {
      const permission = await Notification.requestPermission();
      await preferencesApi.setNotifOptIn(permission === "granted");
      notifOptInEl.innerHTML = "";
      showToast(permission === "granted" ? "Alerte activée" : "Autorisation refusée par le navigateur");
    });
    notifOptInEl.querySelector("#notif-optin-no").addEventListener("click", async () => {
      await preferencesApi.setNotifOptIn(false);
      notifOptInEl.innerHTML = "";
    });
  }

  /**
   * "🔄 Reprendre où j'en étais" (piste TDAH du 01/09/2026, discussion permanence/repérage —
   * "je ne sais plus où j'en suis ni comment retrouver mes éléments") : les dernières fiches
   * consultées, tous types confondus, résolues via la même mécanique que le lien profond du
   * .ics (`fetchBundle`/`resolveRef`, js/components/linkedItems.js) — aucune nouvelle logique
   * d'ouverture, juste un nouveau point d'entrée. Une fiche supprimée depuis disparaît
   * simplement de la liste plutôt que de planter (résolution à `null`, filtrée).
   */
  /**
   * Exclut du "🔄 Reprendre où j'en étais" tout ce qui pointe vers un projet fermé (retour de
   * Charles-Henri, 02/09/2026 — fermeture de projet) : c'est un raccourci vers l'Accueil au
   * même titre que les autres sections de cette page, donc soumis à la même règle. Une
   * Ressource (liée à plusieurs projets à la fois via `projectIds`) et une Personne/Information
   * n'ont pas de projet unique à vérifier — laissées telles quelles, pas de règle simple et non
   * ambiguë à leur appliquer ici.
   */
  function isRecentlyViewedEntryVisible(entry) {
    const projectsById = new Map(projects.map((p) => [p.id, p]));
    if (entry.type === "Project") return !projectsApi.isArchived(projectsById.get(entry.id));
    if (entry.type === "Task") {
      const t = tasks.find((x) => x.id === entry.id);
      return !t || !t.projectId || !projectsApi.isArchived(projectsById.get(t.projectId));
    }
    if (entry.type === "FollowUp") {
      const f = followUps.find((x) => x.id === entry.id);
      return !f || !f.projectId || !projectsApi.isArchived(projectsById.get(f.projectId));
    }
    if (entry.type === "Meeting") {
      const m = meetings.find((x) => x.id === entry.id);
      return !m || !m.projectId || !projectsApi.isArchived(projectsById.get(m.projectId));
    }
    if (entry.type === "Decision") {
      const d = decisions.find((x) => x.id === entry.id);
      return !d || !d.projectId || !projectsApi.isArchived(projectsById.get(d.projectId));
    }
    return true;
  }

  async function renderRecentlyViewedSection() {
    if (hiddenSections.has("recentlyViewed")) {
      recentViewedSection.innerHTML = "";
      return;
    }
    const visibleEntries = recentlyViewed.filter(isRecentlyViewedEntryVisible);
    if (!visibleEntries.length) {
      recentViewedSection.innerHTML = "";
      return;
    }
    const bundle = await linkedItemsApi.fetchBundle();
    const resolved = visibleEntries
      .map((entry) => {
        const r = linkedItemsApi.resolveRef(bundle, { type: entry.type, id: entry.id });
        return r && { ...r, viewedAt: entry.viewedAt };
      })
      .filter(Boolean);
    if (!resolved.length) {
      recentViewedSection.innerHTML = "";
      return;
    }
    recentViewedSection.innerHTML = `
      <div class="section-title" style="margin-top:0;">🔄 Reprendre où j'en étais</div>
      <div class="card" id="recent-viewed-list" style="margin-bottom:16px;"></div>
    `;
    const listEl = recentViewedSection.querySelector("#recent-viewed-list");
    for (const item of resolved) {
      const row = document.createElement("div");
      row.className = "item-row";
      row.style.cursor = "pointer";
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">${item.emoji} ${escapeHtml(item.title)}</div>
          <div class="item-meta">${timeAgoLabel(item.viewedAt)}</div>
        </div>
      `;
      row.addEventListener("click", () => item.onOpen());
      listEl.appendChild(row);
    }
  }

  /**
   * "⚠️ Ça a besoin de toi" (audit de simplification du 02/09/2026, retour de Charles-Henri) :
   * fusionne ce qui vivait avant dans trois rubriques séparées — "En pause depuis un moment",
   * "À échéance dans les 7 jours" et "Suivis en retard" — qui répondaient toutes les trois à la
   * même question de fond ("qu'est-ce qui a besoin de moi ?"), calculées indépendamment. Le
   * risque avec trois listes distinctes : en vérifier une et oublier les deux autres, ou croire
   * l'Accueil à jour alors qu'une seule des trois a été relue. Ici, une seule liste, triée par
   * urgence (suivi déjà en retard de contrôle d'abord, puis échéance qui approche par date
   * croissante, puis tâche à l'arrêt depuis le plus longtemps) — chaque ligne garde son icône de
   * raison pour ne perdre aucune information, jamais un ton culpabilisant (piste TDAH :
   * "traitement du retard sans honte").
   */
  function renderNeedsAttentionSection() {
    if (hiddenSections.has("needsAttention")) {
      needsAttentionSection.innerHTML = "";
      return;
    }
    const peopleById = new Map(people.map((p) => [p.id, p]));
    const overdueFollowUps = hatFilterFollowUps(followUps)
      .filter(followUpsApi.isControlDue)
      .map((f) => ({ kind: "followup", urgency: 0, sortKey: f.controlDate ? new Date(f.controlDate).getTime() : 0, data: f }));
    const dueSoonTasks = hatFilterTasks(tasks)
      .filter((t) => t.status !== "done" && t.dueDate && daysFromToday(t.dueDate) > 0 && daysFromToday(t.dueDate) <= 7)
      .map((t) => ({ kind: "dueSoon", urgency: 1, sortKey: new Date(t.dueDate).getTime(), data: t }));
    const stalledTasks = hatFilterTasks(tasks)
      .filter(tasksApi.isStalled)
      .map((t) => ({ kind: "stalled", urgency: 2, sortKey: t.updatedAt || t.createdAt || 0, data: t }));

    const items = [...overdueFollowUps, ...dueSoonTasks, ...stalledTasks].sort(
      (a, b) => a.urgency - b.urgency || a.sortKey - b.sortKey
    );

    if (!items.length) {
      needsAttentionSection.innerHTML = "";
      return;
    }

    needsAttentionSection.innerHTML = `
      <details open>
        <summary class="section-title" style="margin-top:0;cursor:pointer;">⚠️ Ça a besoin de toi (${items.length})</summary>
        <div class="card" id="needs-attention-list" style="margin-top:8px;margin-bottom:16px;"></div>
      </details>
    `;
    const listEl = needsAttentionSection.querySelector("#needs-attention-list");
    for (const entry of items) {
      const row = document.createElement("div");
      row.className = "item-row";
      row.style.cursor = "pointer";
      if (entry.kind === "followup") {
        const f = entry.data;
        const person = peopleById.get(f.personId);
        const isToTell = f.direction === "to_tell";
        row.innerHTML = `
          <div class="item-main">
            <div class="item-title">${isToTell ? "📣 " : "👀 "}${person ? escapeHtml(person.name) : "Personne supprimée"} — ${escapeHtml(f.title)}</div>
            <div class="item-meta">Suivi en retard · ${isToTell ? "À dire avant" : "Contrôle prévu"} : ${f.controlDate ? formatDate(f.controlDate) : "?"}</div>
          </div>
          <span class="badge badge-late">🔴</span>
        `;
        // Ouvre le Suivi lui-même, pas la fiche de la personne (retour de Charles-Henri,
        // 07/09/2026 : "tous les éléments sur lesquels je clique doivent m'emmener sur
        // l'élément lui-même et pas son parent") — cohérent avec js/components/linkedItems.js,
        // qui ouvre déjà correctement le Suivi et jamais la Personne pour une réf {type:
        // "FollowUp"}. Fonctionne même si la personne a été supprimée entre-temps
        // (openEditFollowUpModal gère déjà ce cas, voir js/views/people.js).
        row.addEventListener("click", () => openEditFollowUpModal(f));
      } else if (entry.kind === "dueSoon") {
        const t = entry.data;
        row.innerHTML = `
          <div class="item-main">
            <div class="item-title">🗓️ ${escapeHtml(t.title)}</div>
            <div class="item-meta">Échéance proche · ${tasksApi.STATUS_ICONS[t.status]} ${tasksApi.STATUS_LABELS[t.status]} · ${formatDate(t.dueDate)}</div>
          </div>
        `;
        row.addEventListener("click", () => openTaskDetail(t, projects));
      } else {
        const t = entry.data;
        const project = t.projectId ? projects.find((p) => p.id === t.projectId) : null;
        const days = Math.floor((Date.now() - (t.updatedAt || t.createdAt || 0)) / 86400000);
        row.innerHTML = `
          <div class="item-main">
            <div class="item-title">⏸️ ${escapeHtml(t.title)}</div>
            <div class="item-meta">En pause depuis ${days} j${project ? " · 📦 " + escapeHtml(project.name) : ""}</div>
          </div>
        `;
        row.addEventListener("click", () => openTaskDetail(t, projects));
      }
      listEl.appendChild(row);
    }
  }

  /**
   * Mode "Focus" (audit TDAH ciblé du 07/09/2026, retour de Charles-Henri après comparaison de
   * plusieurs pistes d'Accueil — voir claude/vague-28-audit-tdah-onglets-projet-accueil.md et la
   * vague suivante pour la décision finale) : contrairement à renderNeedsAttentionSection()
   * ci-dessus (délibérément NON touchée — comportement du mode "classic" inchangé), la file
   * "Focus" fusionne AUSSI les tâches réellement en retard (`tasksApi.isLate`), pas seulement
   * les trois catégories déjà fusionnées le 02/09/2026 — c'est la fusion "modérée" demandée :
   * plus rien de ce qui a besoin de toi n'est laissé dans un coin séparé (le bloc chiffré
   * "🔴 En retard" reste par ailleurs affiché tel quel, cette file ne le remplace pas).
   *
   * Vague 37 (retour de Charles-Henri, 08/09/2026) : les tâches à échéance AUJOURD'HUI même
   * (`isDueToday`) manquaient purement et simplement de cette file — `tasksApi.isLate` exclut
   * strictement le jour même (`< startOfToday()`) et `dueSoon` exigeait `daysFromToday > 0`
   * (donc demain au plus tôt), laissant un trou entre les deux. Ajout d'une catégorie
   * `dueToday` dédiée, même palier d'urgence (0) que `late` : le tri secondaire par date
   * (`sortKey`) suffit à faire remonter naturellement les tâches en retard avant celles
   * simplement dues aujourd'hui, puisque leur échéance dépassée porte un horodatage plus
   * ancien.
   */
  function computeFocusQueue() {
    const lateTasks = hatFilterTasks(tasks)
      .filter((t) => t.status !== "done" && tasksApi.isLate(t))
      .map((t) => ({ kind: "late", urgency: 0, sortKey: new Date(t.dueDate).getTime(), data: t }));
    const dueTodayTasks = hatFilterTasks(tasks)
      .filter((t) => isDueToday(t))
      .map((t) => ({ kind: "dueToday", urgency: 0, sortKey: new Date(t.dueDate).getTime(), data: t }));
    const overdueFollowUps = hatFilterFollowUps(followUps)
      .filter(followUpsApi.isControlDue)
      .map((f) => ({ kind: "followup", urgency: 0, sortKey: f.controlDate ? new Date(f.controlDate).getTime() : 0, data: f }));
    const dueSoonTasks = hatFilterTasks(tasks)
      .filter((t) => t.status !== "done" && t.dueDate && daysFromToday(t.dueDate) > 0 && daysFromToday(t.dueDate) <= 7)
      .map((t) => ({ kind: "dueSoon", urgency: 1, sortKey: new Date(t.dueDate).getTime(), data: t }));
    const stalledTasks = hatFilterTasks(tasks)
      .filter(tasksApi.isStalled)
      .map((t) => ({ kind: "stalled", urgency: 2, sortKey: t.updatedAt || t.createdAt || 0, data: t }));
    return [...lateTasks, ...dueTodayTasks, ...overdueFollowUps, ...dueSoonTasks, ...stalledTasks].sort(
      (a, b) => a.urgency - b.urgency || a.sortKey - b.sortKey
    );
  }

  /** Traduit une entrée de la file Focus en {why, title, sub, onOpen} — même contenu
   *  d'information que les lignes de renderNeedsAttentionSection(), présenté différemment
   *  (le "pourquoi" en évidence plutôt qu'en pastille de fin de ligne). */
  function queueEntryView(entry, peopleById) {
    if (entry.kind === "late") {
      const t = entry.data;
      const project = t.projectId ? projects.find((p) => p.id === t.projectId) : null;
      return {
        why: `🔴 En retard depuis ${daysLate(t.dueDate)} j`,
        title: escapeHtml(t.title),
        sub: `${tasksApi.STATUS_ICONS[t.status]} ${tasksApi.STATUS_LABELS[t.status]}${project ? " · 📦 " + escapeHtml(project.name) : ""}`,
        onOpen: () => openTaskDetail(t, projects),
      };
    }
    if (entry.kind === "dueToday") {
      const t = entry.data;
      const project = t.projectId ? projects.find((p) => p.id === t.projectId) : null;
      return {
        why: `📅 Échéance aujourd'hui`,
        title: escapeHtml(t.title),
        sub: `${tasksApi.STATUS_ICONS[t.status]} ${tasksApi.STATUS_LABELS[t.status]}${project ? " · 📦 " + escapeHtml(project.name) : ""}`,
        onOpen: () => openTaskDetail(t, projects),
      };
    }
    if (entry.kind === "followup") {
      const f = entry.data;
      const person = peopleById.get(f.personId);
      const isToTell = f.direction === "to_tell";
      return {
        why: isToTell ? "📣 À transmettre — en retard" : "👀 Suivi en retard",
        title: `${person ? escapeHtml(person.name) : "Personne supprimée"} — ${escapeHtml(f.title)}`,
        sub: `${isToTell ? "À dire avant" : "Contrôle prévu"} : ${f.controlDate ? formatDate(f.controlDate) : "?"}`,
        // Ouvre le Suivi lui-même, pas la fiche de la personne — voir même remarque dans
        // renderNeedsAttentionSection() plus haut.
        onOpen: () => openEditFollowUpModal(f),
      };
    }
    if (entry.kind === "dueSoon") {
      const t = entry.data;
      const project = t.projectId ? projects.find((p) => p.id === t.projectId) : null;
      return {
        why: `🗓️ Échéance proche · ${formatDate(t.dueDate)}`,
        title: escapeHtml(t.title),
        sub: `${tasksApi.STATUS_ICONS[t.status]} ${tasksApi.STATUS_LABELS[t.status]}${project ? " · 📦 " + escapeHtml(project.name) : ""}`,
        onOpen: () => openTaskDetail(t, projects),
      };
    }
    const t = entry.data;
    const project = t.projectId ? projects.find((p) => p.id === t.projectId) : null;
    const days = Math.floor((Date.now() - (t.updatedAt || t.createdAt || 0)) / 86400000);
    return {
      why: `⏸️ En pause depuis ${days} j`,
      title: escapeHtml(t.title),
      sub: project ? `📦 ${escapeHtml(project.name)}` : "",
      onOpen: () => openTaskDetail(t, projects),
    };
  }

  function renderFocusQueueSection() {
    if (homeMode !== "focus") {
      focusQueueSection.innerHTML = "";
      return;
    }
    const peopleById = new Map(people.map((p) => [p.id, p]));
    const queue = computeFocusQueue();
    const toggleHtml = `
      <div style="text-align:center;">
        <button type="button" id="focus-queue-toggle" class="btn btn-ghost btn-sm">${focusExpanded ? "▲ Réduire" : "▾ Tout voir"}</button>
      </div>
    `;

    if (!queue.length) {
      focusQueueSection.innerHTML = `
        <div class="card" style="text-align:center;padding:24px 16px;margin-bottom:12px;">
          <div style="font-size:1.4rem;margin-bottom:6px;">🎉</div>
          <div class="item-title">Rien ne t'attend pour l'instant.</div>
        </div>
        ${toggleHtml}
      `;
    } else if (!focusExpanded) {
      if (focusQueueIndex >= queue.length) focusQueueIndex = 0;
      const entry = queue[focusQueueIndex];
      const view = queueEntryView(entry, peopleById);
      focusQueueSection.innerHTML = `
        <div class="card" style="padding:16px;margin-bottom:12px;text-align:center;">
          <div class="item-meta" style="color:var(--color-danger);font-weight:600;">${view.why}</div>
          <div class="item-title" style="margin:6px 0 2px;">${view.title}</div>
          <div class="item-meta">${view.sub}</div>
          <div style="display:flex;gap:8px;justify-content:center;margin-top:14px;">
            <button type="button" id="focus-queue-skip" class="btn btn-secondary btn-sm">Passer</button>
            <button type="button" id="focus-queue-open" class="btn btn-primary btn-sm">Ouvrir</button>
          </div>
          <div class="item-meta" style="margin-top:10px;">${focusQueueIndex + 1} sur ${queue.length}</div>
        </div>
        ${toggleHtml}
      `;
      focusQueueSection.querySelector("#focus-queue-skip").addEventListener("click", () => {
        focusQueueIndex = (focusQueueIndex + 1) % queue.length;
        renderFocusQueueSection();
      });
      const openBtn = focusQueueSection.querySelector("#focus-queue-open");
      if (view.onOpen) openBtn.addEventListener("click", view.onOpen);
      else openBtn.disabled = true;
    } else {
      focusQueueSection.innerHTML = `
        <div class="section-title" style="margin-top:0;">⚠️ Ça a besoin de toi (${queue.length})</div>
        <div class="card" id="focus-queue-list" style="margin-bottom:8px;"></div>
        ${toggleHtml}
      `;
      const listEl = focusQueueSection.querySelector("#focus-queue-list");
      for (const entry of queue) {
        const view = queueEntryView(entry, peopleById);
        const row = document.createElement("div");
        row.className = "item-row";
        row.innerHTML = `
          <div class="item-main" ${view.onOpen ? 'style="cursor:pointer;"' : ""}>
            <div class="item-title">${view.title}</div>
            <div class="item-meta">${view.why} · ${view.sub}</div>
          </div>
        `;
        if (view.onOpen) row.querySelector(".item-main").addEventListener("click", view.onOpen);
        listEl.appendChild(row);
      }
    }
    focusQueueSection.querySelector("#focus-queue-toggle").addEventListener("click", () => {
      focusExpanded = !focusExpanded;
      renderFocusQueueSection();
      applyHomeModeVisibility();
    });
  }

  /**
   * Bascule entre les deux modes d'Accueil sans dupliquer aucune donnée ni logique : en mode
   * "focus", l'ancien "🎯 Focus du jour" et "⚠️ Ça a besoin de toi" (mode classic) sont masqués
   * au profit de la nouvelle file (`focus-queue-section`) ; les sections secondaires
   * (Informations, Projets, Reprendre où j'en étais, Récemment) restent montées et à jour comme
   * toujours, seulement repliées derrière "Tout voir" tant qu'on n'a pas demandé à les voir —
   * rien n'est supprimé, seulement pas montré en premier (retour de Charles-Henri : "ne pas
   * perdre de vue ce qu'il faut faire").
   */
  function applyHomeModeVisibility() {
    const isFocus = homeMode === "focus";
    focusSection.hidden = isFocus;
    needsAttentionSection.hidden = isFocus;
    focusQueueSection.hidden = !isFocus;
    const secondaryHidden = isFocus && !focusExpanded;
    keptSection.hidden = secondaryHidden;
    projectsSection.hidden = secondaryHidden;
    recentViewedSection.hidden = secondaryHidden;
    recentSection.hidden = secondaryHidden;
  }

  /** Filtre une liste de Tâches/Suivis sur la casquette active — "all" = pas de filtre.
   *  Cartes projets/réunions/décisions ont chacune leur propre variante (voir plus bas), le
   *  besoin de map projets/personnes n'étant pas le même.
   *
   *  Exclut aussi systématiquement (retour de Charles-Henri, 02/09/2026 — fermeture de projet)
   *  tout élément rattaché à un projet fermé : un projet clôturé doit disparaître, lui ET tout
   *  ce qui lui est lié, des outils de pilotage — même principe que `applyFilters()` côté
   *  Kanban (js/views/kanban.js). Toujours appliqué, y compris quand activeHat === "all". */
  function hatFilterTasks(list) {
    const projectsById = new Map(projects.map((p) => [p.id, p]));
    let result = list.filter((t) => !t.projectId || !projectsApi.isArchived(projectsById.get(t.projectId)));
    if (activeHat !== "all") result = result.filter((t) => casquettesApi.taskHat(t, projectsById) === activeHat);
    return result;
  }

  function hatFilterFollowUps(list) {
    const projectsById = new Map(projects.map((p) => [p.id, p]));
    const peopleById = new Map(people.map((p) => [p.id, p]));
    let result = list.filter((f) => !f.projectId || !projectsApi.isArchived(projectsById.get(f.projectId)));
    if (activeHat !== "all") result = result.filter((f) => casquettesApi.followUpHat(f, projectsById, peopleById) === activeHat);
    return result;
  }

  /**
   * Rappel de rythme (retour de Charles-Henri : "il y a du retard partout") : un bandeau
   * doux, jamais culpabilisant — pas de rouge, la couleur "warning" suffit — dès que la Revue
   * hebdomadaire n'a pas été relancée depuis plus de 7 jours (ou jamais).
   */
  function renderReviewReminder(lastAt) {
    const days = lastAt ? Math.floor((Date.now() - lastAt) / 86400000) : null;
    if (days !== null && days < 7) {
      reviewReminderEl.innerHTML = "";
      return;
    }
    reviewReminderEl.innerHTML = `
      <div class="review-banner">
        <span>🧭 ${days === null ? "Pas encore de revue hebdomadaire lancée." : `Revue hebdomadaire non relancée depuis ${days} jours.`}</span>
        <button id="review-reminder-btn" class="btn btn-primary btn-sm">Lancer la revue</button>
      </div>
    `;
    reviewReminderEl.querySelector("#review-reminder-btn").addEventListener("click", () => {
      openWeeklyReview();
      reviewReminderEl.innerHTML = "";
    });
  }

  /** Modale "⚙️ Personnaliser l'accueil" (retour de Charles-Henri : "l'accueil se rallonge") —
   *  une case à cocher par section masquable, mémorisée pour de bon (pas juste pour cette
   *  session). */
  function openDashboardSettingsModal() {
    let selectedHomeMode = homeMode;
    const body = document.createElement("div");
    body.innerHTML = `
      <div class="field" style="margin-bottom:16px;">
        <label style="display:block;margin-bottom:6px;">Mode d'accueil</label>
        <div class="chip-row" id="home-mode-row" style="margin-bottom:4px;">
          <button type="button" class="chip${selectedHomeMode === "classic" ? " active" : ""}" data-mode="classic">Classique</button>
          <button type="button" class="chip${selectedHomeMode === "focus" ? " active" : ""}" data-mode="focus">Focus</button>
        </div>
        <p class="item-meta" style="margin:0;">Focus : une seule chose à la fois, triée par urgence (retard, échéance, pause) — le reste (Informations, Projets, Reprendre où j'en étais...) reste à un clic via "Tout voir", rien n'est supprimé.</p>
      </div>
      <p style="color:var(--color-text-muted);">En mode Classique, décoche les sections dont tu ne te sers pas — elles disparaissent de l'Accueil (le bloc chiffré en haut reste toujours visible).</p>
      ${DASHBOARD_SECTIONS.map(
        (s) => `
        <div class="field" style="display:flex;align-items:center;gap:8px;">
          <input id="dash-sec-${s.key}" type="checkbox" style="width:auto;" ${hiddenSections.has(s.key) ? "" : "checked"} />
          <label for="dash-sec-${s.key}" style="margin:0;">${s.label}</label>
        </div>`
      ).join("")}
    `;
    body.querySelectorAll("#home-mode-row .chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedHomeMode = btn.dataset.mode;
        body.querySelectorAll("#home-mode-row .chip").forEach((b) => b.classList.toggle("active", b === btn));
      });
    });
    openModal({
      title: "⚙️ Personnaliser l'accueil",
      body,
      actions: [
        { label: "Annuler", variant: "ghost" },
        {
          label: "Enregistrer",
          variant: "primary",
          closesModal: false,
          onClick: async () => {
            const hidden = DASHBOARD_SECTIONS.filter((s) => !body.querySelector(`#dash-sec-${s.key}`).checked).map((s) => s.key);
            hiddenSections = new Set(hidden);
            const modeChanged = selectedHomeMode !== homeMode;
            homeMode = selectedHomeMode;
            if (modeChanged) {
              // Repart d'une file/position propre à chaque bascule de mode plutôt que de garder
              // un état d'affichage qui n'a plus de sens dans l'autre mode.
              focusExpanded = false;
              focusQueueIndex = 0;
            }
            await preferencesApi.setDashboardHidden(hidden);
            await preferencesApi.setHomeMode(homeMode);
            closeModal();
            renderNeedsAttentionSection();
            renderFocusQueueSection();
            renderKeptSection();
            renderProjectsSection();
            renderRecentlyViewedSection();
            renderRecentSection();
            applyHomeModeVisibility();
            showToast("Accueil mis à jour");
          },
        },
      ],
    });
  }

  /** "🎯 Mes objectifs" (retour de Charles-Henri, vague 21 : "j'aimerai aussi me noter mes
   *  objectifs qq part que ça soit ma ligne directrice") — un texte libre unique, relu et
   *  réécrit à chaque ouverture, volontairement sans historique ni sous-structure : ce n'est
   *  pas un suivi daté comme les objectifs par Personne (js/domain/objectives.js), juste une
   *  ligne directrice qu'on retrouve toujours au même endroit. */
  async function openMyObjectivesModal() {
    const prefs = await preferencesApi.getPreferences();
    const body = document.createElement("div");
    body.innerHTML = `
      <p style="margin-top:0;color:var(--color-text-muted);">Ta ligne directrice — ce que tu veux garder en tête, à relire quand tu perds le fil.</p>
      <div class="field" style="margin-bottom:0;">
        <textarea id="my-objectives-text" placeholder="Ex. Faire monter l'équipe en autonomie, sécuriser la refonte X avant fin d'année...">${escapeHtml(prefs.myObjectives || "")}</textarea>
      </div>
    `;
    const { bodyEl, close } = openModal({
      title: "🎯 Mes objectifs",
      body,
      actions: [
        { label: "Annuler", variant: "ghost" },
        {
          label: "Enregistrer",
          variant: "primary",
          closesModal: false,
          onClick: async () => {
            await preferencesApi.setMyObjectives(bodyEl.querySelector("#my-objectives-text").value.trim());
            close();
            showToast("Objectifs enregistrés");
          },
        },
      ],
    });
  }

  /** Liste cliquable réutilisée par chaque carte chiffrée (retour de Charles-Henri : les
   *  cartes >0 doivent pouvoir s'ouvrir pour voir le détail) — un même petit gabarit pour les
   *  tâches, qu'il s'agisse de retards (avec la durée du retard), d'aujourd'hui, ou des
   *  statuts À suivre/En attente. */
  function openTaskListModal(title, list) {
    const body = document.createElement("div");
    const listEl = document.createElement("div");
    listEl.className = "card";
    if (!list.length) {
      listEl.innerHTML = `<div class="empty-state" style="padding:16px;">Rien ici. 🎉</div>`;
    } else {
      for (const t of list) {
        const project = t.projectId ? projects.find((p) => p.id === t.projectId) : null;
        const late = tasksApi.isLate(t);
        const row = document.createElement("div");
        row.className = "item-row";
        row.style.cursor = "pointer";
        row.innerHTML = `
          <div class="item-main">
            <div class="item-title">${t.isBlocked ? "🔴 " : ""}${escapeHtml(t.title)}</div>
            <div class="item-meta">
              ${t.dueDate ? formatDate(t.dueDate) : "Pas d'échéance"}${late ? ` · <strong style="color:var(--color-danger);">en retard depuis ${daysLate(t.dueDate)} j</strong>` : ""}${project ? " · 📦 " + escapeHtml(project.name) : ""}
            </div>
          </div>
          <span class="badge badge-${t.status}">${tasksApi.STATUS_LABELS[t.status]}</span>
        `;
        row.addEventListener("click", () => {
          closeModal();
          openTaskDetail(t, projects);
        });
        listEl.appendChild(row);
      }
    }
    body.appendChild(listEl);
    openModal({ title, body, actions: [{ label: "Fermer", variant: "ghost" }] });
  }

  function openFollowUpListModal(title, list) {
    const peopleById = new Map(people.map((p) => [p.id, p]));
    const body = document.createElement("div");
    const listEl = document.createElement("div");
    listEl.className = "card";
    if (!list.length) {
      listEl.innerHTML = `<div class="empty-state" style="padding:16px;">Rien ici. 🎉</div>`;
    } else {
      for (const f of list) {
        const person = peopleById.get(f.personId);
        const isToTell = f.direction === "to_tell";
        const row = document.createElement("div");
        row.className = "item-row";
        row.style.cursor = "pointer";
        row.innerHTML = `
          <div class="item-main">
            <div class="item-title">${isToTell ? "📣 " : ""}${person ? escapeHtml(person.name) : "Personne supprimée"} — ${escapeHtml(f.title)}</div>
            <div class="item-meta">${isToTell ? "À dire avant" : "Contrôle prévu"} : ${f.controlDate ? formatDate(f.controlDate) : "?"}</div>
          </div>
        `;
        // Ouvre le Suivi lui-même, pas la fiche de la personne — voir même remarque dans
        // renderNeedsAttentionSection() plus haut.
        row.addEventListener("click", () => {
          closeModal();
          openEditFollowUpModal(f);
        });
        listEl.appendChild(row);
      }
    }
    body.appendChild(listEl);
    openModal({ title, body, actions: [{ label: "Fermer", variant: "ghost" }] });
  }

  function renderStats() {
    // Le compteur Inbox reste global, jamais filtré par casquette : une capture pas encore
    // qualifiée n'a par définition ni projet ni personne pour en déduire une (voir
    // js/domain/casquettes.js) — la filtrer donnerait l'impression trompeuse que "rien à
    // traiter" alors que des captures attendent juste d'être qualifiées.
    const hatTasks = hatFilterTasks(tasks);
    const hatFollowUps = hatFilterFollowUps(followUps);
    const lateList = hatTasks.filter(tasksApi.isLate);
    const followUpList = hatTasks.filter((t) => t.status === "follow_up");
    const waitingList = hatTasks.filter((t) => t.status === "waiting");
    const overdueFollowUpsList = hatFollowUps.filter(followUpsApi.isControlDue);

    // La tuile "📅 Aujourd'hui" a été remplacée par la section "🎯 Focus du jour" ci-dessous
    // (piste TDAH du 01/09/2026, retour de Charles-Henri) : plafonner à 3 choses visibles vaut
    // mieux qu'un chiffre qui peut monter sans limite — la liste complète du jour reste
    // atteignable depuis cette même section, rien n'est masqué, seulement de-emphasé.
    statGrid.innerHTML = `
      <div class="stat-tile stat-danger" id="stat-late" style="cursor:pointer;">
        <div class="stat-value">${lateList.length}</div>
        <div class="stat-label">🔴 En retard</div>
      </div>
      <div class="stat-tile" id="stat-inbox" style="cursor:pointer;">
        <div class="stat-value">${inboxPendingCount}</div>
        <div class="stat-label">📥 À traiter</div>
      </div>
      <div class="stat-tile stat-warning" id="stat-followup" style="cursor:pointer;">
        <div class="stat-value">${followUpList.length}</div>
        <div class="stat-label">👀 À suivre</div>
      </div>
      <div class="stat-tile" id="stat-waiting" style="cursor:pointer;">
        <div class="stat-value">${waitingList.length}</div>
        <div class="stat-label">⏳ En attente</div>
      </div>
      <div class="stat-tile ${overdueFollowUpsList.length ? "stat-danger" : ""}" id="stat-relances" style="cursor:pointer;">
        <div class="stat-value">${overdueFollowUpsList.length}</div>
        <div class="stat-label">📣 Relances dues</div>
      </div>
    `;
    statGrid.querySelector("#stat-late").addEventListener("click", () => openTaskListModal("🔴 En retard", lateList));
    statGrid.querySelector("#stat-inbox").addEventListener("click", () => {
      location.hash = "#/inbox";
    });
    statGrid.querySelector("#stat-followup").addEventListener("click", () => openTaskListModal("👀 À suivre", followUpList));
    statGrid.querySelector("#stat-waiting").addEventListener("click", () => openTaskListModal("⏳ En attente", waitingList));
    statGrid.querySelector("#stat-relances").addEventListener("click", () => openFollowUpListModal("📣 Relances dues", overdueFollowUpsList));
  }

  /**
   * "🎯 Focus du jour" (piste TDAH du 01/09/2026, retour de Charles-Henri) : au lieu d'un
   * chiffre "📅 Aujourd'hui" qui peut grimper sans limite, une liste choisie automatiquement
   * mais complétable d'un clic — le choix hybride retenu plutôt qu'une liste 100% automatique
   * ou 100% manuelle. L'échéance complète du jour reste accessible juste en dessous, rien
   * n'est masqué.
   *
   * Vague 37 (retour de Charles-Henri, 08/09/2026 — "il manque sur l'accueil en focus les
   * tâches qui sont à l'échéance du jour, toutes ne remontent pas") : le plafond fixe à 3 a
   * été supprimé. Le Focus remonte désormais TOUTES les tâches en retard (`tasksApi.isLate`)
   * + TOUTES les tâches à échéance aujourd'hui (`isDueToday`), sans limite de nombre. Si cette
   * liste est vide (rien en retard, rien dû aujourd'hui), on retombe sur l'ancien comportement
   * : les 3 tâches les plus urgentes proposées par la matrice de priorisation, pour ne jamais
   * laisser un bloc vide démotivant. Le bouton 🔀, qui remplaçait auparavant une ligne parmi 3,
   * est remplacé par un bouton ➕ global qui sert à AJOUTER une tâche en plus de cette
   * sélection automatique (voir `openFocusAddModal` plus bas) — `focusOverride.addedTaskIds`
   * (js/domain/preferences.js) ne porte donc plus que ces ajouts, jamais la sélection
   * automatique elle-même.
   *
   * Tri : matrice de priorisation (vague 33, retour de Charles-Henri, 07/09/2026 — "au lieu de
   * juste trier par échéance, elle croiserait urgence, impact [...] et niveau de blocage")
   * plutôt que le simple tri "en retard d'abord, puis échéance la plus proche" d'avant cette
   * vague — voir js/domain/priorisation.js, seul endroit où vit la formule. `focusRanked()`
   * donne accès au détail du score (`why`) pour la phrase affichée sous chaque tâche ci-dessous ;
   * `focusCandidates()` en garde juste les tâches, pour ne rien changer à la logique d'ajout
   * manuel plus bas qui raisonne déjà en tâches brutes.
   */
  function focusRanked() {
    const notDone = hatFilterTasks(tasks).filter((t) => t.status !== "done");
    return priorisationApi.rankTasks(notDone, projects, priorityWeights);
  }
  function focusCandidates() {
    return focusRanked().map((r) => r.task);
  }

  function todayDateKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function renderFocusSection() {
    const rankedCandidates = focusRanked();
    const candidates = rankedCandidates.map((r) => r.task);

    // Sélection automatique (vague 37) : tout ce qui est en retard ou dû aujourd'hui, sans
    // plafond — l'ordre de `candidates` (déjà trié par la matrice de priorisation) est
    // préservé à l'intérieur de ce sous-ensemble.
    const dueOrLate = candidates.filter((t) => tasksApi.isLate(t) || isDueToday(t));
    let chosen = dueOrLate.length ? dueOrLate.slice() : candidates.slice(0, 3);
    const isAutoFallback = !dueOrLate.length;

    // Ajouts manuels du jour (bouton ➕ — voir openFocusAddModal) : uniquement des tâches qui
    // ne sont pas déjà dans la sélection automatique, jamais de doublon par id. `addedIds`
    // sert ensuite à distinguer, ligne par ligne, ce qui peut être retiré (un ajout manuel) de
    // ce qui ne peut pas l'être (une tâche en retard ou due aujourd'hui, jamais retirable à la
    // main du Focus).
    const addedIds = new Set();
    if (focusOverride.date === todayDateKey() && (focusOverride.addedTaskIds || []).length) {
      const byId = new Map(candidates.map((t) => [t.id, t]));
      const chosenIds = new Set(chosen.map((t) => t.id));
      for (const id of focusOverride.addedTaskIds) {
        const t = byId.get(id);
        if (t && !chosenIds.has(id)) {
          chosen.push(t);
          chosenIds.add(id);
          addedIds.add(id);
        }
        // Une tâche ajoutée manuellement puis terminée/supprimée disparaît silencieusement —
        // jamais recomplétée, contrairement à l'ancien comportement de remplacement : ici ce
        // n'était qu'un ajout, son absence ne fait jamais redescendre le Focus en dessous de
        // sa sélection automatique.
      }
    }

    const todayList = hatFilterTasks(tasks).filter(isDueToday);

    focusSection.innerHTML = `
      <div class="section-title" style="margin-top:0;">🎯 Focus du jour${chosen.length ? ` (${chosen.length})` : ""}</div>
      ${isAutoFallback && chosen.length ? `<div class="item-meta" style="margin-bottom:8px;">Rien en retard ni dû aujourd'hui — voici les tâches les plus urgentes en attente.</div>` : ""}
      <div class="card" id="focus-list" style="margin-bottom:8px;"></div>
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
        <button type="button" id="focus-add-btn" class="btn btn-ghost btn-sm">➕ Ajouter une tâche au Focus</button>
        <button type="button" id="focus-today-link" class="btn btn-ghost btn-sm">📅 Toutes les échéances d'aujourd'hui (${todayList.length})</button>
        <button type="button" id="focus-kept-link" class="btn btn-ghost btn-sm">🧠 Informations & idées (${keptItems.length})</button>
      </div>
    `;

    const listEl = focusSection.querySelector("#focus-list");
    if (!chosen.length) {
      listEl.innerHTML = `<div class="empty-state" style="padding:16px;"><span class="emoji">🎉</span>Rien en attente. Le focus se remplira tout seul dès qu'une tâche sera à faire.</div>`;
    } else {
      // Détail du score déjà calculé par focusRanked() ci-dessus — évite de recalculer
      // urgence/impact/blocage/why une seconde fois pour la phrase "pourquoi" de chaque ligne.
      const whyById = new Map(rankedCandidates.map((r) => [r.task.id, r.why]));
      for (const t of chosen) {
        const project = t.projectId ? projects.find((p) => p.id === t.projectId) : null;
        const late = tasksApi.isLate(t);
        const why = whyById.get(t.id);
        const row = document.createElement("div");
        row.className = "item-row";
        row.innerHTML = `
          <div class="item-main" style="cursor:pointer;">
            <div class="item-title">${t.isBlocked ? "🔴 " : ""}${escapeHtml(t.title)}</div>
            <div class="item-meta">
              ${tasksApi.STATUS_ICONS[t.status]} ${tasksApi.STATUS_LABELS[t.status]} · ${t.dueDate ? formatDate(t.dueDate) : "Pas d'échéance"}${late ? ` · <strong style="color:var(--color-danger);">en retard</strong>` : ""}${project ? " · 📦 " + escapeHtml(project.name) : ""}
            </div>
            ${why ? `<div class="item-meta" style="font-style:italic;">🧭 Pourquoi maintenant : ${escapeHtml(why)}</div>` : ""}
          </div>
        `;
        row.querySelector(".item-main").addEventListener("click", () => openTaskDetail(t, projects));
        // Vague 37 : une tâche en retard ou due aujourd'hui n'est plus "remplaçable" (elle
        // n'est plus dans un plafond fixe) — seule une tâche ajoutée manuellement peut être
        // retirée. Le cas "fallback" (rien en retard/dû aujourd'hui, 3 tâches urgentes
        // proposées à la place) garde l'ancien comportement de remplacement, puisqu'on est
        // alors revenu à l'ancienne logique de sélection plafonnée.
        if (addedIds.has(t.id)) {
          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "btn btn-ghost btn-sm";
          removeBtn.setAttribute("aria-label", "Retirer du Focus");
          removeBtn.textContent = "✕";
          row.appendChild(removeBtn);
          removeBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const newAdded = (focusOverride.addedTaskIds || []).filter((id) => id !== t.id);
            focusOverride = { date: todayDateKey(), addedTaskIds: newAdded };
            await preferencesApi.setFocusOverride(focusOverride.date, focusOverride.addedTaskIds);
            renderFocusSection();
            showToast("Retiré du Focus");
          });
        }
        // Note : une tâche de la sélection automatique (en retard, due aujourd'hui, ou l'une
        // des 3 proposées en secours quand rien n'est dû) n'est jamais retirable à la main —
        // seul un ajout manuel (bouton ➕ ci-dessus) l'est. Avant la vague 37, un bouton 🔀 par
        // ligne permettait de remplacer une des 3 tâches fixes ; ce plafond n'existant plus,
        // ce mécanisme n'a plus de sens tel quel et a été retiré au profit de l'ajout global.
        listEl.appendChild(row);
      }
    }
    focusSection.querySelector("#focus-add-btn").addEventListener("click", () => openFocusAddModal(chosen, candidates));
    focusSection.querySelector("#focus-today-link").addEventListener("click", () => openTaskListModal("📅 Échéances d'aujourd'hui", todayList));
    // Retour de Charles-Henri, vague 40, 09/09/2026 : "dans la vue mode d'accueil focus, je
    // n'ai pas moyen de la retrouver [une information]" — jusqu'ici, la section "🧠 Informations
    // & idées" n'existait que dans le mode Accueil "classic" (renderKeptSection ci-dessous),
    // absente du mode "Focus" qui n'affiche jamais cette liste. Même point d'entrée
    // (`openAllKeptItemsModal`) que le lien "Voir tout" du mode classic.
    focusSection.querySelector("#focus-kept-link").addEventListener("click", openAllKeptItemsModal);
  }

  /** Ajout manuel d'une tâche au Focus du jour, en plus de la sélection automatique (vague 37)
   *  — persiste pour la journée en cours uniquement (voir js/domain/preferences.js#
   *  focusOverride), jamais au-delà. `chosen` sert seulement à exclure de la liste ce qui est
   *  déjà affiché dans le Focus (automatique ou déjà ajouté), pour ne jamais proposer un
   *  doublon. */
  function openFocusAddModal(chosen, candidates) {
    const alternatives = candidates.filter((t) => !chosen.some((c) => c.id === t.id));
    const body = document.createElement("div");
    if (!alternatives.length) {
      body.innerHTML = `<div class="empty-state" style="padding:16px;">Toutes les tâches en attente sont déjà dans le Focus.</div>`;
    } else {
      const list = document.createElement("div");
      list.className = "card";
      for (const t of alternatives) {
        const row = document.createElement("div");
        row.className = "item-row";
        row.style.cursor = "pointer";
        row.innerHTML = `
          <div class="item-main">
            <div class="item-title">${escapeHtml(t.title)}</div>
            <div class="item-meta">${t.dueDate ? formatDate(t.dueDate) : "Pas d'échéance"}</div>
          </div>
        `;
        row.addEventListener("click", async () => {
          const current = focusOverride.date === todayDateKey() ? focusOverride.addedTaskIds || [] : [];
          const newAdded = current.includes(t.id) ? current : [...current, t.id];
          focusOverride = { date: todayDateKey(), addedTaskIds: newAdded };
          await preferencesApi.setFocusOverride(focusOverride.date, focusOverride.addedTaskIds);
          closeModal();
          renderFocusSection();
          showToast("Ajouté au Focus du jour");
        });
        list.appendChild(row);
      }
      body.appendChild(list);
    }
    openModal({ title: "Ajouter une tâche au Focus", body, actions: [{ label: "Fermer", variant: "ghost" }] });
  }

  /**
   * §47 "information de contexte" : retour de Charles-Henri, les Informations/Idées
   * qualifiées depuis l'Inbox ne remontaient nulle part une fois traitées. Lecture simple,
   * avec un raccourci pour les archiver directement d'ici si elles ne servent plus.
   */
  function renderKeptSection() {
    if (hiddenSections.has("kept") || !keptItems.length) {
      keptSection.innerHTML = "";
      return;
    }
    // Rubrique repliable comme les autres (retour de Charles-Henri du 31/08 : "toutes les
    // rubriques peuvent être réduites ou dépliées à l'image de l'échéance") — ouverte par
    // défaut, un clic sur le titre suffit à la replier.
    keptSection.innerHTML = `
      <details open>
        <summary class="section-title" style="cursor:pointer;">🧠 Informations & idées (${keptItems.length})</summary>
        <div class="card" id="kept-list" style="margin-top:8px;margin-bottom:8px;"></div>
        ${keptItems.length > 8 ? `<button type="button" id="kept-see-all-btn" class="btn btn-ghost btn-sm" style="margin-bottom:16px;">Voir tout (${keptItems.length})</button>` : ""}
      </details>
    `;
    if (keptItems.length > 8) {
      keptSection.querySelector("#kept-see-all-btn").addEventListener("click", openAllKeptItemsModal);
    }
    const list = keptSection.querySelector("#kept-list");
    for (const item of [...keptItems].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8)) {
      const row = document.createElement("div");
      row.className = "item-row";
      row.style.cursor = "pointer";
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">${escapeHtml(item.rawContent)}</div>
          <div class="item-meta">${KEPT_TYPE_LABELS[item.keptAsType] || KEPT_TYPE_LABELS.kept} · ${formatDate(item.createdAt)}</div>
        </div>
      `;
      // Clic pour ouvrir sa vraie fiche (§ correction du 31/08 : une Information n'avait
      // jusqu'ici aucune fiche propre, donc aucune section "🔗 Lié" — voir js/views/inbox.js).
      row.addEventListener("click", () => openKeptItemDetail(item));
      const btn = document.createElement("button");
      btn.className = "btn btn-ghost btn-sm";
      btn.textContent = "Archiver";
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await inboxApi.qualify(item.id, "archived");
        showToast("Archivé");
      });
      row.appendChild(btn);
      list.appendChild(row);
    }
  }

  /**
   * §33/§38 : les suivis collaborateurs dont la date de contrôle est dépassée n'étaient
   * visibles auparavant que via un petit compteur dans la liste Équipe — on ne les "attend"
   * jamais si on n'ouvre pas cette liste. Les faire remonter ici, là où le pilotage
   * quotidien se passe, c'est ce qui permet de répondre à "ai-je bien relancé les bonnes
   * personnes ?" sans avoir à s'en souvenir soi-même.
   */
  /**
   * L'ordre des projets ici reprend celui de l'onglet Projets (retour de Charles-Henri) —
   * même fonction de tri (`projectsApi.sortProjects`), même mode (avancement ou manuel) lu
   * depuis les préférences, pour ne jamais avoir deux logiques d'ordonnancement qui divergent.
   */
  function renderProjectsSection() {
    if (hiddenSections.has("projects")) {
      projectsSection.innerHTML = "";
      return;
    }
    let active = projects.filter((p) => p.status === "active");
    if (activeHat !== "all") active = active.filter((p) => casquettesApi.projectHat(p) === activeHat);
    projectsSection.innerHTML = `
      <details open>
        <summary class="section-title" style="cursor:pointer;">📦 Mes projets (${active.length})</summary>
        <div id="projects-body" style="margin-top:8px;"></div>
      </details>
    `;
    const bodyWrap = projectsSection.querySelector("#projects-body");
    if (!active.length) {
      bodyWrap.innerHTML = `
        <div class="empty-state">
          <span class="emoji">📦</span>
          ${activeHat !== "all" ? "Aucun projet sur cette casquette." : "Pas encore de projet. Crée-en un depuis l'onglet Projets."}
        </div>`;
      return;
    }
    const tasksByProject = new Map();
    for (const project of active) tasksByProject.set(project.id, tasks.filter((t) => t.projectId === project.id));
    const ordered = projectsApi.sortProjects(active, projectSortMode, tasksByProject);

    const list = document.createElement("div");
    list.className = "card";
    for (const project of ordered) {
      const projectTasks = tasksByProject.get(project.id) || [];
      const progress = projectsApi.computeProgress(projectTasks);
      const icon = preferencesApi.categoryIcon(categories, project.category);
      const row = document.createElement("div");
      row.className = "item-row";
      row.style.cursor = "pointer";
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">${icon ? icon + " " : ""}${escapeHtml(project.name)}</div>
          <div style="height:5px;background:var(--color-surface-alt);border-radius:var(--radius-pill);overflow:hidden;margin-top:6px;">
            <div style="height:100%;width:${progress.percent}%;background:var(--color-primary);"></div>
          </div>
        </div>
        <div style="font-weight:700;color:var(--color-primary);">${progress.percent}%</div>
      `;
      row.addEventListener("click", () => openProjectDetail(project, projectTasks));
      list.appendChild(row);
    }
    bodyWrap.appendChild(list);
  }

  /**
   * §50 "🧠 Récemment" : tant que la recherche globale et l'historique visible (§45/§46)
   * n'existent pas encore, c'est ici qu'une réunion ou une décision capturée sans projet
   * reste malgré tout retrouvable — sinon elle serait bien enregistrée (jamais perdue,
   * Règle 3) mais invisible nulle part dans l'interface.
   */
  function renderRecentSection() {
    if (hiddenSections.has("recent")) {
      recentSection.innerHTML = "";
      return;
    }
    const projectById = new Map(projects.map((p) => [p.id, p]));
    let items = [
      ...meetings.map((m) => ({ kind: "meeting", emoji: "🗓️", label: "Réunion", date: m.date || m.createdAt, data: m })),
      ...decisions.map((d) => ({ kind: "decision", emoji: "🗳️", label: "Décision", date: d.date || d.createdAt, data: d })),
    ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    // Même exclusion des projets fermés que hatFilterTasks/hatFilterFollowUps ci-dessus —
    // une réunion/décision rattachée à un projet clôturé ne doit plus apparaître ici non plus.
    items = items.filter((item) => !item.data.projectId || !projectsApi.isArchived(projectById.get(item.data.projectId)));
    if (activeHat !== "all") items = items.filter((item) => casquettesApi.itemHat(item.data, projectById) === activeHat);
    // Retour de Charles-Henri du 31/08 : garder "Récemment" naturellement court, même
    // traitement dans l'esprit que l'auto-archivage des Informations/Idées après 15 jours —
    // au-delà, une réunion ou décision reste entièrement retrouvable (fiche projet, recherche
    // globale, "🕒 Tout l'historique") mais ne s'accumule plus indéfiniment ici.
    const cutoff = Date.now() - RECENT_MAX_AGE_MS;
    items = items.filter((item) => !item.date || new Date(item.date).getTime() >= cutoff);

    recentSection.innerHTML = `
      <div style="display:flex;justify-content:flex-end;margin-top:var(--space-5);">
        <button id="open-history-btn" class="btn btn-ghost btn-sm">🕒 Tout l'historique</button>
      </div>
      <details open>
        <summary class="section-title" style="margin-top:0;cursor:pointer;">🧠 Récemment (${items.length})</summary>
        <div id="recent-body" style="margin-top:8px;"></div>
      </details>
    `;
    recentSection.querySelector("#open-history-btn").addEventListener("click", openGlobalHistory);
    const bodyWrap = recentSection.querySelector("#recent-body");
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = `<span class="emoji">🧠</span>Les réunions et décisions que tu qualifies depuis l'Inbox apparaîtront ici.`;
      bodyWrap.appendChild(empty);
      return;
    }
    const list = document.createElement("div");
    list.className = "card";
    for (const item of items.slice(0, 8)) {
      const project = item.data.projectId ? projectById.get(item.data.projectId) : null;
      const row = document.createElement("div");
      row.className = "item-row";
      row.style.cursor = "pointer";
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">${item.emoji} ${escapeHtml(item.data.title)}</div>
          <div class="item-meta">
            ${item.label}${item.data.date ? " · " + formatDate(item.data.date) : ""}${project ? " · 📦 " + escapeHtml(project.name) : ""}
          </div>
        </div>
      `;
      row.addEventListener("click", () => openRecentDetail(item, projects));
      list.appendChild(row);
    }
    bodyWrap.appendChild(list);
  }

  // Rafraîchit le bandeau "✏️ Saisie laissée en cours" au retour sur l'app (onglet/fenêtre qui
  // reprend le focus) — le cas le plus fréquent d'une saisie interrompue via le FAB de capture
  // (accessible depuis n'importe quel écran) : Charles-Henri part complètement ailleurs
  // (change d'onglet, d'appli, verrouille son téléphone — exactement le schéma du yaourt/
  // aspirateur) puis revient, sans forcément changer d'onglet Pilotage entre-temps pour
  // déclencher un nouveau rendu de l'Accueil par un autre moyen.
  const refreshCaptureDraftBanner = () => renderCaptureDraftBanner();
  document.addEventListener("visibilitychange", refreshCaptureDraftBanner);
  window.addEventListener("focus", refreshCaptureDraftBanner);

  const unsubTasks = tasksApi.subscribe((items) => {
    tasks = items;
    renderStats();
    renderFocusSection();
    renderNeedsAttentionSection();
    renderFocusQueueSection();
    renderProjectsSection();
  });
  const unsubInbox = inboxApi.subscribePending((items) => {
    inboxPendingCount = items.length;
    renderStats();
  });
  const unsubKept = inboxApi.subscribeKept((items) => {
    keptItems = items;
    renderKeptSection();
    renderFocusSection(); // le compteur "🧠 Informations & idées" du mode Focus en dépend aussi
  });
  const unsubProjects = projectsApi.subscribe((items) => {
    projects = items;
    // Fermer/rouvrir un projet ne touche que la collection Projets — mais change ce que
    // hatFilterTasks()/hatFilterFollowUps() laissent passer (retour de Charles-Henri,
    // 02/09/2026). Sans ça, l'Accueil resterait affiché avec des Tâches/Suivis d'un projet
    // qu'on vient pourtant de fermer, jusqu'au prochain changement de tâche/suivi.
    renderStats();
    renderFocusSection();
    renderNeedsAttentionSection();
    renderFocusQueueSection();
    renderProjectsSection();
    renderRecentSection();
    renderRecentlyViewedSection();
  });
  const unsubMeetings = meetingsApi.subscribe((items) => {
    meetings = items;
    renderRecentSection();
  });
  const unsubDecisions = decisionsApi.subscribe((items) => {
    decisions = items;
    renderRecentSection();
  });
  const unsubPeople = peopleApi.subscribe((items) => {
    people = items;
    renderNeedsAttentionSection();
    renderFocusQueueSection();
  });
  const unsubFollowUps = followUpsApi.subscribe((items) => {
    followUps = items;
    renderStats();
    renderNeedsAttentionSection();
    renderFocusQueueSection();
  });

  return function cleanup() {
    document.removeEventListener("visibilitychange", refreshCaptureDraftBanner);
    window.removeEventListener("focus", refreshCaptureDraftBanner);
    themeMediaQuery?.removeEventListener("change", onSystemThemeChange);
    unsubTasks();
    unsubInbox();
    unsubKept();
    unsubProjects();
    unsubMeetings();
    unsubDecisions();
    unsubPeople();
    unsubFollowUps();
  };
}

/**
 * §46 : le fil global, tous types confondus, le plus récent en premier — le filet de
 * sécurité pour retrouver une réunion ou décision au-delà des 8 dernières de "Récemment",
 * en attendant la recherche globale (§45/§52).
 */
async function openGlobalHistory() {
  const allHistory = await historyApi.listAll();
  const recent = [...allHistory].sort((a, b) => b.date - a.date).slice(0, 100);

  const body = document.createElement("div");
  const list = document.createElement("div");
  list.className = "card";
  body.appendChild(list);
  renderHistoryTimeline(list, recent);

  openModal({
    title: "🕒 Tout l'historique",
    body,
    actions: [{ label: "Fermer", variant: "ghost" }],
  });
}

/**
 * "+ Créer et lier" (fil conducteur, components/linkedItems.js) pour une Réunion. Formulaire
 * minimal — titre + date — le reste (objectif, notes) se complète en rouvrant la fiche.
 */
/**
 * Formulaire canonique de création d'une Réunion — vague 19 (audit de simplification, retour
 * de Charles-Henri : "on fait l'ensemble des modifications suggérées") : jusqu'ici ce
 * formulaire existait en 3 versions légèrement différentes (ici, "+ Ajouter" côté fiche Projet
 * qui appelait déjà celui-ci, et une version séparée dans l'Inbox avec Objectif/Projet en plus)
 * — désormais un seul formulaire, appelé partout, avec le sur-ensemble des champs. Le sélecteur
 * Projet est toujours affiché (jamais cachée selon d'où on vient, même principe que le Suivi
 * dans js/views/people.js) : préremplit `prefill.projectId` sans empêcher de le changer.
 */
export async function openCreateMeetingModal(prefill = {}) {
  const projects = await projectsApi.listAll();
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="new-meeting-title">Titre</label>
      <input id="new-meeting-title" type="text" placeholder="Ex. Point collaborateur" value="${escapeAttr(prefill.title || "")}" />
    </div>
    <div class="field">
      <label for="new-meeting-date">Date</label>
      <input id="new-meeting-date" type="date" value="${prefill.date || new Date().toISOString().slice(0, 10)}" />
    </div>
    <div class="field">
      <label for="new-meeting-objective">Objectif (optionnel)</label>
      <textarea id="new-meeting-objective" placeholder="Qu'est-ce qu'on cherche à obtenir de cette réunion ?">${escapeHtml(prefill.objective || "")}</textarea>
    </div>
    <div class="field">
      <label for="new-meeting-canevas">Canevas (optionnel)</label>
      <select id="new-meeting-canevas">
        ${meetingsApi.CANEVAS_OPTIONS.map((c) => `<option value="${c.key}" ${c.key === prefill.canevasKey ? "selected" : ""}>${c.label}</option>`).join("")}
      </select>
    </div>
    <div class="field">
      <label for="new-meeting-project">Projet (optionnel)</label>
      <select id="new-meeting-project">
        <option value="">— Aucun —</option>
        ${projects.map((p) => `<option value="${p.id}" ${p.id === prefill.projectId ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("")}
      </select>
    </div>
  `;
  attachProjectQuickCreate(body.querySelector("#new-meeting-project"), {
    reopen: (newProjectId) => {
      openCreateMeetingModal({
        ...prefill,
        title: body.querySelector("#new-meeting-title").value,
        date: body.querySelector("#new-meeting-date").value,
        objective: body.querySelector("#new-meeting-objective").value,
        canevasKey: body.querySelector("#new-meeting-canevas").value,
        projectId: newProjectId !== null ? newProjectId : body.querySelector("#new-meeting-project").value || null,
      });
    },
  });
  const { bodyEl, close } = openModal({
    title: "Nouvelle réunion",
    body,
    actions: [
      { label: "Annuler", variant: "ghost", onClick: () => prefill.onCancel?.() },
      {
        label: "Créer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          const title = bodyEl.querySelector("#new-meeting-title").value.trim();
          if (!title) return;
          const meeting = await meetingsApi.createMeeting({
            title,
            date: bodyEl.querySelector("#new-meeting-date").value || null,
            objective: bodyEl.querySelector("#new-meeting-objective").value.trim(),
            canevasKey: bodyEl.querySelector("#new-meeting-canevas").value,
            projectId: bodyEl.querySelector("#new-meeting-project").value || null,
          });
          close();
          showToast("Réunion créée");
          prefill.onCreated?.(meeting);
        },
      },
    ],
  });
}

/**
 * Formulaire canonique de création d'une Décision — même principe et même historique que
 * openCreateMeetingModal ci-dessus (vague 19, unification des 3 formulaires en un seul).
 */
export async function openCreateDecisionModal(prefill = {}) {
  const projects = await projectsApi.listAll();
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="new-decision-title">Sujet</label>
      <input id="new-decision-title" type="text" placeholder="Ex. Retard récurrent de D" value="${escapeAttr(prefill.title || "")}" />
    </div>
    <div class="field">
      <label for="new-decision-decision">Ce qui a été décidé</label>
      <textarea id="new-decision-decision">${escapeHtml(prefill.decision || "")}</textarea>
    </div>
    <div class="field">
      <label for="new-decision-context">Contexte (optionnel)</label>
      <textarea id="new-decision-context">${escapeHtml(prefill.context || "")}</textarea>
    </div>
    <div class="field">
      <label for="new-decision-date">Date</label>
      <input id="new-decision-date" type="date" value="${prefill.date || new Date().toISOString().slice(0, 10)}" />
    </div>
    <div class="field">
      <label for="new-decision-project">Projet (optionnel)</label>
      <select id="new-decision-project">
        <option value="">— Aucun —</option>
        ${projects.map((p) => `<option value="${p.id}" ${p.id === prefill.projectId ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("")}
      </select>
    </div>
  `;
  attachProjectQuickCreate(body.querySelector("#new-decision-project"), {
    reopen: (newProjectId) => {
      openCreateDecisionModal({
        ...prefill,
        title: body.querySelector("#new-decision-title").value,
        decision: body.querySelector("#new-decision-decision").value,
        context: body.querySelector("#new-decision-context").value,
        date: body.querySelector("#new-decision-date").value,
        projectId: newProjectId !== null ? newProjectId : body.querySelector("#new-decision-project").value || null,
      });
    },
  });
  const { bodyEl, close } = openModal({
    title: "Nouvelle décision",
    body,
    actions: [
      { label: "Annuler", variant: "ghost", onClick: () => prefill.onCancel?.() },
      {
        label: "Créer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          const title = bodyEl.querySelector("#new-decision-title").value.trim();
          if (!title) return;
          const decision = await decisionsApi.createDecision({
            title,
            decision: bodyEl.querySelector("#new-decision-decision").value.trim(),
            context: bodyEl.querySelector("#new-decision-context").value.trim(),
            date: bodyEl.querySelector("#new-decision-date").value || null,
            projectId: bodyEl.querySelector("#new-decision-project").value || null,
          });
          close();
          // Suggestion de prochaine étape (§ 31/08/2026, retour de Charles-Henri : mieux se
          // souvenir des enchaînements) — refuser préserve exactement le chaînage d'origine
          // (prefill.onCreated), accepter l'exécute une fois la tâche liée créée.
          suggestNextStep({
            title: "Créer une action ?",
            message: `Décision enregistrée : « ${decision.title} ». Cette décision entraîne-t-elle une action ? Tu peux créer une Tâche liée tout de suite.`,
            acceptLabel: "+ Créer la tâche",
            onAccept: () => {
              linkedItemsApi.openCreateAndLinkDirect("Task", { type: "Decision", id: decision.id }, decision.title, {
                onLinked: () => prefill.onCreated?.(decision),
                onCancel: () => prefill.onCreated?.(decision),
              });
            },
            onDecline: () => {
              showToast("Décision enregistrée");
              prefill.onCreated?.(decision);
            },
          });
        },
      },
    ],
  });
}

/**
 * Fiche modifiable — réunion ou décision. Un seul formulaire pour les deux, les champs
 * spécifiques (objectif/notes vs décision/contexte) changeant selon item.kind ; le déroulé
 * complet Avant/Pendant/Après viendra avec les canevas pilotés par données (§14-19).
 */
/**
 * `onClose` (optionnel) : voir la même logique côté openTaskDetail (kanban.js) — nécessaire
 * pour que cliquer sur une réunion/décision depuis le bloc correspondant de la fiche projet
 * ramène à cette fiche projet en fermant/enregistrant plutôt que de révéler l'écran du dessous.
 */
export function openRecentDetail(item, projects, { onClose } = {}) {
  const isMeeting = item.kind === "meeting";
  const data = item.data;
  preferencesApi.recordRecentlyViewed(isMeeting ? "Meeting" : "Decision", data.id).catch(() => {});

  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="rd-title">Titre</label>
      <input id="rd-title" type="text" value="${escapeAttr(data.title)}" />
    </div>
    <div class="field">
      <label for="rd-date">Date</label>
      <input id="rd-date" type="date" value="${data.date || ""}" />
    </div>
    ${
      isMeeting
        ? `
    <div class="field">
      <label for="rd-objective">Objectif</label>
      <textarea id="rd-objective">${escapeHtml(data.objective || "")}</textarea>
    </div>
    <div class="field">
      <label for="rd-notes">Notes</label>
      <textarea id="rd-notes">${escapeHtml(data.notes || "")}</textarea>
    </div>`
        : `
    <div class="field">
      <label for="rd-decision">Décision</label>
      <textarea id="rd-decision">${escapeHtml(data.decision || "")}</textarea>
    </div>
    <div class="field">
      <label for="rd-context">Contexte</label>
      <textarea id="rd-context">${escapeHtml(data.context || "")}</textarea>
    </div>`
    }
    <div class="field">
      <label for="rd-project">Projet</label>
      <select id="rd-project">
        <option value="">— Aucun —</option>
        ${projects.map((p) => `<option value="${p.id}" ${p.id === data.projectId ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("")}
      </select>
    </div>
    ${isMeeting ? `<div id="rd-canevas"></div>` : `<div class="section-title">⚖️ Grille de décision</div><div id="detail-decision-grid" style="margin-bottom:16px;"></div>`}
    <div class="section-title">🗒️ Notes</div>
    <div id="detail-notes" style="margin-bottom:16px;"></div>
    <div class="section-title">🔗 Lié</div>
    <div class="card" id="detail-links" style="margin-bottom:8px;"></div>
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <button id="link-existing-btn" class="btn btn-secondary btn-sm">🔗 Lier une fiche</button>
      <button id="create-linked-btn" class="btn btn-secondary btn-sm">+ Créer et lier</button>
    </div>
  `;

  attachProjectQuickCreate(body.querySelector("#rd-project"), {
    // Même principe que la fiche Tâche : on enregistre déjà ce qui est saisi (mêmes champs que
    // "💾 Enregistrer" plus bas) avant de rouvrir avec le nouveau projet présélectionné, plutôt
    // que de le perdre en silence.
    reopen: async (newProjectId) => {
      const patch = {
        title: body.querySelector("#rd-title").value.trim() || data.title,
        date: body.querySelector("#rd-date").value || null,
        projectId: newProjectId !== null ? newProjectId : body.querySelector("#rd-project").value || null,
      };
      let updated;
      if (isMeeting) {
        patch.objective = body.querySelector("#rd-objective").value.trim();
        patch.notes = body.querySelector("#rd-notes").value.trim();
        updated = await meetingsApi.updateMeeting(data.id, patch);
      } else {
        patch.decision = body.querySelector("#rd-decision").value.trim();
        patch.context = body.querySelector("#rd-context").value.trim();
        updated = await decisionsApi.updateDecision(data.id, patch);
      }
      openRecentDetail({ kind: item.kind, data: updated }, projects, { onClose });
    },
  });

  if (isMeeting) {
    renderCanevas(body.querySelector("#rd-canevas"), data.steps, async (stepKey, done) => {
      await meetingsApi.toggleStep(data.id, stepKey, done);
      // Suggestion de prochaine étape (§ 31/08/2026, retour de Charles-Henri : mieux se
      // souvenir des enchaînements) : ces deux cases du canevas Réunion (§15) sont justement
      // celles qui appellent une vraie fiche liée — jusqu'ici cocher la case ne faisait rien
      // de plus qu'une simple checklist, sans jamais rappeler qu'il fallait encore la créer.
      if (done && (stepKey === "create_actions" || stepKey === "plan_followups")) {
        const isAction = stepKey === "create_actions";
        suggestNextStep({
          title: isAction ? "Créer une action ?" : "Créer un suivi ?",
          message: isAction
            ? `Tu viens de cocher « Créer les actions » sur « ${data.title} ». Créer une Tâche liée tout de suite ?`
            : `Tu viens de cocher « Planifier les suivis » sur « ${data.title} ». Créer un Suivi lié tout de suite ?`,
          acceptLabel: isAction ? "+ Créer la tâche" : "+ Créer le suivi",
          onAccept: () => {
            closeModal();
            linkedItemsApi.openCreateAndLinkDirect(isAction ? "Task" : "FollowUp", { type: "Meeting", id: data.id }, data.title, {
              onLinked: () => openRecentDetail(item, projects, { onClose }),
              onCancel: () => openRecentDetail(item, projects, { onClose }),
            });
          },
          onDecline: () => openRecentDetail(item, projects, { onClose }),
        });
      }
    });
  } else {
    renderDecisionGrid(body.querySelector("#detail-decision-grid"), data, {
      onReopen: () => {
        closeModal();
        openRecentDetail(item, projects, { onClose });
      },
    });
  }

  renderNotesBlock(body.querySelector("#detail-notes"), data.notesLog || [], {
    onAdd: async (text) => {
      const updated = isMeeting ? await meetingsApi.addNote(data.id, text) : await decisionsApi.addNote(data.id, text);
      data.notesLog = updated;
      return updated;
    },
  });

  const linkRef = { type: isMeeting ? "Meeting" : "Decision", id: data.id };
  linkedItemsApi.renderLinkedSection(body.querySelector("#detail-links"), linkRef);
  body.querySelector("#link-existing-btn").addEventListener("click", () => {
    closeModal();
    linkedItemsApi.openLinkPickerModal(linkRef, data.title, {
      onLinked: () => openRecentDetail(item, projects, { onClose }),
      onCancel: () => openRecentDetail(item, projects, { onClose }),
    });
  });
  body.querySelector("#create-linked-btn").addEventListener("click", () => {
    closeModal();
    linkedItemsApi.openCreateAndLinkModal(linkRef, data.title, {
      onLinked: () => openRecentDetail(item, projects, { onClose }),
      onCancel: () => openRecentDetail(item, projects, { onClose }),
    });
  });

  const { bodyEl, close } = openModal({
    title: `${item.emoji} ${data.title}`,
    body,
    actions: [
      { icon: "✕", label: "Fermer", variant: "ghost", compact: true, onClick: () => onClose?.() },
      {
        // Lien de partage (retour de Charles-Henri, vague 23) — voir js/components/copyLink.js.
        icon: "🔗",
        label: "Copier le lien",
        variant: "secondary",
        compact: true,
        closesModal: false,
        onClick: () => copyEntityLink("#/dashboard", isMeeting ? "Meeting" : "Decision", data.id),
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
            title: isMeeting ? "Supprimer cette réunion ?" : "Supprimer cette décision ?",
            message: `« ${data.title} » sera définitivement supprimée.`,
            onConfirm: async () => {
              if (isMeeting) await meetingsApi.removeMeeting(data.id);
              else await decisionsApi.removeDecision(data.id);
              showToast(isMeeting ? "Réunion supprimée" : "Décision supprimée");
              onClose?.();
            },
            onCancel: () => openRecentDetail(item, projects, { onClose }),
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
          const title = bodyEl.querySelector("#rd-title").value.trim();
          if (!title) return;
          const patch = {
            title,
            date: bodyEl.querySelector("#rd-date").value || null,
            projectId: bodyEl.querySelector("#rd-project").value || null,
          };
          if (isMeeting) {
            patch.objective = bodyEl.querySelector("#rd-objective").value.trim();
            patch.notes = bodyEl.querySelector("#rd-notes").value.trim();
            await meetingsApi.updateMeeting(data.id, patch);
          } else {
            patch.decision = bodyEl.querySelector("#rd-decision").value.trim();
            patch.context = bodyEl.querySelector("#rd-context").value.trim();
            await decisionsApi.updateDecision(data.id, patch);
          }
          close();
          showToast(isMeeting ? "Réunion mise à jour" : "Décision mise à jour");
          onClose?.();
        },
      },
    ],
  });
}

function isDueToday(task) {
  if (!task.dueDate || task.status === "done") return false;
  return daysFromToday(task.dueDate) === 0;
}

function daysLate(dateStr) {
  return -daysFromToday(dateStr);
}

function daysFromToday(dateStr) {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function formatToday() {
  return new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** Étiquette relative pour "🔄 Reprendre où j'en étais" — une échelle grossière suffit ici,
 *  ce n'est qu'un repère de fraîcheur, pas une donnée à lire précisément. */
function timeAgoLabel(ts) {
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "hier";
  return `il y a ${days} j`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}
