// 🎯 Priorisation — vague 33 (retour de Charles-Henri, 07/09/2026 : "une matrice de
// priorisation automatique qui irait plus loin que le Focus du jour actuel : au lieu de juste
// trier par échéance, elle croiserait urgence, impact [...] et niveau de blocage pour te dire
// non seulement quoi faire en premier, mais pourquoi"). 4e sous-onglet de "Pilotage", à côté de
// 📋 Tâches/📦 Projets/📅 Calendrier (voir js/components/pilotageSubNav.js) : un classement du
// MÊME flux de Tâches déjà utilisé par le Kanban (même filtre casquette, mêmes projets fermés
// exclus), pas un second jeu de données.
//
// Le Focus du jour de l'Accueil (js/views/dashboard.js) utilise la MÊME formule
// (js/domain/priorisation.js) pour ses 3 tâches condensées ; cette vue est l'endroit où on
// règle les poids et où on voit le classement complet avec la matrice urgence × impact.

import * as tasksApi from "../domain/tasks.js?v=3";
import * as projectsApi from "../domain/projects.js?v=3";
import * as preferencesApi from "../domain/preferences.js?v=3";
import * as casquettesApi from "../domain/casquettes.js?v=3";
import * as priorisationApi from "../domain/priorisation.js?v=3";
import { openModal } from "../components/modal.js?v=3";
import { showToast } from "../components/toast.js?v=3";
import { renderInfoTip } from "../components/infoTip.js?v=3";
import { renderPilotageSubNav } from "../components/pilotageSubNav.js?v=3";
import { openTaskDetail } from "./kanban.js?v=3";

// Mêmes casquettes affichables que le Kanban (une Tâche ne peut jamais être "Équipe" ni
// "Manager") — voir js/views/kanban.js#PILOTAGE_HATS pour le même choix et sa justification.
const PILOTAGE_HATS = ["toi", "projets", "cse"];

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function renderPriorisation(container) {
  // Plein écran en mode web, même traitement que Kanban/Projets/Calendrier (vague 31, retour de
  // Charles-Henri : éviter le scroll horizontal) — retiré au démontage de la vue (voir cleanup).
  container.classList.add("app-wide");

  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Priorisation</h1>
        <div class="subtitle">Pas juste l'échéance : urgence, impact et blocage croisés pour dire pourquoi</div>
      </div>
    </div>
    <div class="view">
      <div id="pilotage-subnav"></div>
      <!-- Casquette repliée dans un popover "🔧 Filtrer" plutôt qu'une rangée toujours ouverte
           (retour de Charles-Henri : "pour le voir en entier, je dois scroller la page vers le
           bas" — même geste que le popover "Filtrer & trier" du Kanban, voir js/views/
           kanban.js) : moins de hauteur prise avant la matrice, qui doit être visible sans
           scroller sur un écran normal. -->
      <div class="chip-row" id="prio-filters" style="flex-wrap:wrap;">
        <details class="filter-popover" id="prio-filter-popover">
          <summary class="chip">🔧 Filtrer<span class="filter-popover-badge" id="prio-filter-badge" hidden></span></summary>
          <div class="filter-popover-panel">
            <div class="filter-popover-group">
              <div class="filter-popover-label" style="display:flex;align-items:center;gap:6px;">Casquette<span id="prio-hat-info"></span></div>
              <div class="chip-row" id="prio-hat-filter" style="margin-bottom:0;"></div>
            </div>
          </div>
        </details>
        <button type="button" id="prio-weights-btn" class="btn btn-ghost btn-sm">⚙️ Régler les poids</button>
      </div>

      <div class="section-title" style="margin-top:0;">Matrice urgence × impact</div>
      <!-- Cliquer un point ouvre la tâche (retour de Charles-Henri : "les points sont non
           cliquables du coup on ne sait pas à quoi ça correspond") — voir renderQuadrant(). -->
      <div class="card" id="prio-quadrant" style="margin-bottom:16px;padding:12px;"></div>

      <div class="section-title">Classement complet</div>
      <!-- Légende des couleurs de la barre (retour de Charles-Henri : "les couleurs des barres
           de progression sont peu compréhensibles") — les mêmes 3 couleurs que la matrice/le
           score, une seule fois ici plutôt que répétée sur chaque ligne. -->
      <div id="prio-legend" style="margin-bottom:8px;font-size:var(--font-size-sm);color:var(--color-text-muted);"></div>
      <div class="card" id="prio-list" style="margin-bottom:16px;"></div>
    </div>
  `;

  renderPilotageSubNav(container.querySelector("#pilotage-subnav"), "#/priorisation");
  renderInfoTip(
    container.querySelector("#prio-hat-info"),
    "Le score croise trois signaux déjà dans l'app : l'échéance (urgence), le projet marqué ⭐ prioritaire ou non (impact), et la case 🔴 Bloqué de la tâche (blocage). Réglable via « ⚙️ Régler les poids » — valeurs par défaut sinon."
  );

  const hatFilterEl = container.querySelector("#prio-hat-filter");
  const filterBadgeEl = container.querySelector("#prio-filter-badge");
  const quadrantEl = container.querySelector("#prio-quadrant");
  const legendEl = container.querySelector("#prio-legend");
  const listEl = container.querySelector("#prio-list");
  const weightsBtn = container.querySelector("#prio-weights-btn");

  let latestTasks = [];
  let latestProjects = [];
  let activeHat = "all";
  let weights = priorisationApi.DEFAULT_WEIGHTS;

  function renderHatFilter() {
    casquettesApi.renderHatChipRow(
      hatFilterEl,
      activeHat,
      async (hatId) => {
        activeHat = hatId;
        renderHatFilter();
        renderAll();
        await preferencesApi.setCasquette(hatId);
      },
      PILOTAGE_HATS
    );
    filterBadgeEl.hidden = activeHat === "all";
    filterBadgeEl.textContent = activeHat === "all" ? "" : "1";
  }

  function filteredTasks() {
    const projectsById = new Map(latestProjects.map((p) => [p.id, p]));
    // Même règle que le Kanban : une tâche non terminée, dont le projet (s'il y en a un) n'est
    // pas fermé — un projet fermé sort de tous les outils de pilotage actifs.
    let list = latestTasks.filter(
      (t) => t.status !== "done" && (!t.projectId || !projectsApi.isArchived(projectsById.get(t.projectId)))
    );
    if (activeHat !== "all") {
      list = list.filter((t) => casquettesApi.taskHat(t, projectsById) === activeHat);
    }
    return list;
  }

  function renderAll() {
    const ranked = priorisationApi.rankTasks(filteredTasks(), latestProjects, weights);
    renderQuadrant(ranked);
    renderLegend();
    renderList(ranked);
  }

  /**
   * Matrice urgence (x) × impact (y) — le blocage se voit au rayon (une bulle bloquée est plus
   * grosse) plutôt qu'à une 3e dimension impossible à dessiner en 2D. Les 8 premières tâches du
   * classement seulement (au-delà, le nuage de points devient illisible) — le classement complet
   * ci-dessous n'a lui aucune limite.
   *
   * Ratio plus large que haut (retour de Charles-Henri : "pour le voir en entier, je dois
   * scroller la page vers le bas") pour que la matrice tienne sans défiler sur un écran normal,
   * une fois combinée au popover "🔧 Filtrer" replié ci-dessus. Chaque point est cliquable
   * (retour de Charles-Henri : "les points sont non cliquables du coup on ne sait pas à quoi ça
   * correspond") et ouvre directement la tâche, comme une ligne du classement complet.
   *
   * BUG corrigé (retour de Charles-Henri, 07/09/2026, capture d'écran : le graphique reste
   * coupé malgré le correctif précédent) : le SVG était en `width:100%` sans limite — inoffensif
   * sur mobile, mais `#app.app-wide` (>= 900px, voir styles/components.css) retire complètement
   * le `max-width` habituel de `#app` pour laisser le Kanban utiliser toute la largeur de
   * l'écran. La matrice héritait donc de cette largeur totale, quel que soit la taille réelle de
   * l'écran (grand téléphone en paysage, fenêtre large) — et sa hauteur, liée à une proportion
   * fixe (480×220), grandissait d'autant, dépassant largement la hauteur visible avant même
   * d'atteindre le bas. `max-width:480px` fixe une taille plafond correspondant exactement aux
   * unités du viewBox (1 unité = 1px maximum) : en dessous de 480px de large, rien ne change
   * (toujours 100% de la largeur, comportement mobile inchangé) ; au-dessus, le graphique ne
   * grandit plus jamais au-delà de 480×220, quelle que soit la largeur de la fenêtre.
   */
  function renderQuadrant(ranked) {
    const top = ranked.slice(0, 8);
    if (!top.length) {
      quadrantEl.innerHTML = `<div class="empty-state" style="padding:16px;"><span class="emoji">🎉</span>Rien à classer avec ce filtre.</div>`;
      return;
    }
    const W = 480, H = 220, PAD = 30;
    const x = (u) => PAD + u * (W - PAD * 2);
    const y = (i) => H - PAD - i * (H - PAD * 2);
    const tierColor = (rank) => (rank === 0 ? "var(--color-danger)" : rank === 1 ? "var(--color-warning)" : rank === 2 ? "var(--color-info)" : "var(--color-primary)");

    const points = top
      .map((r, idx) => {
        const cx = x(r.score.urgence);
        const cy = y(r.score.impact);
        const radius = 8 + (idx < 3 ? (3 - idx) * 3 : 0) + (r.task.isBlocked ? 4 : 0);
        return `
          <g class="quad-point" data-task-id="${r.task.id}" style="cursor:pointer;">
            <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${radius}" fill="${tierColor(idx)}" fill-opacity="${idx < 3 ? 0.9 : 0.55}" stroke="var(--color-surface)" stroke-width="2">
              <title>${escapeHtml(r.task.title)} — ${escapeHtml(r.why)}</title>
            </circle>
            ${idx < 3 ? `<text x="${cx.toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="middle" font-size="11" fill="var(--color-text-inverse)" font-weight="700" style="pointer-events:none;">${idx + 1}</text>` : ""}
          </g>
        `;
      })
      .join("");

    quadrantEl.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;height:auto;display:block;margin:0 auto;" role="img" aria-label="Matrice urgence-impact — cliquer un point pour ouvrir la tâche correspondante">
        <line x1="${PAD}" y1="${H - PAD}" x2="${W - PAD}" y2="${H - PAD}" stroke="var(--color-border)" stroke-width="1.5" />
        <line x1="${PAD}" y1="${PAD}" x2="${PAD}" y2="${H - PAD}" stroke="var(--color-border)" stroke-width="1.5" />
        <line x1="${(W / 2).toFixed(1)}" y1="${PAD}" x2="${(W / 2).toFixed(1)}" y2="${H - PAD}" stroke="var(--color-border)" stroke-width="1" stroke-dasharray="4 4" />
        <line x1="${PAD}" y1="${(H / 2).toFixed(1)}" x2="${W - PAD}" y2="${(H / 2).toFixed(1)}" stroke="var(--color-border)" stroke-width="1" stroke-dasharray="4 4" />
        <text x="${PAD}" y="${PAD - 12}" font-size="11" fill="var(--color-text-muted)">Impact ↑</text>
        <text x="${W - PAD}" y="${H - PAD + 20}" font-size="11" fill="var(--color-text-muted)" text-anchor="end">Urgence →</text>
        ${points}
      </svg>
      <div class="fine-print" style="color:var(--color-text-muted);font-size:var(--font-size-xs);margin-top:4px;">Taille = blocage (bulle plus grosse si 🔴 Bloqué) · couleur = rang parmi les 3 premiers · clique un point pour ouvrir la tâche.</div>
    `;

    quadrantEl.querySelectorAll(".quad-point").forEach((g) => {
      const found = top.find((r) => r.task.id === g.dataset.taskId);
      if (!found) return;
      g.addEventListener("click", () => openTaskDetail(found.task, latestProjects.filter((p) => !projectsApi.isArchived(p))));
    });
  }

  /** Légende des couleurs de la barre à 3 segments du classement complet (retour de
   *  Charles-Henri : "les couleurs des barres de progression sont peu compréhensibles") — une
   *  seule fois au-dessus de la liste, avec les poids courants pour qu'elle reste à jour après
   *  un réglage. Le violet de l'impact est le même que le badge "⭐ Prioritaire" (styles/
   *  components.css#badge-critical) — pas une couleur arbitraire. */
  function renderLegend() {
    const w = priorisationApi.normalizedWeights(weights);
    const swatch = (color) => `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};"></span>`;
    legendEl.innerHTML = `
      <span style="display:inline-flex;align-items:center;gap:5px;margin-right:14px;">${swatch("var(--color-danger)")}Urgence (${Math.round(w.urgence * 100)}%)</span>
      <span style="display:inline-flex;align-items:center;gap:5px;margin-right:14px;">${swatch("var(--color-waiting)")}Impact (${Math.round(w.impact * 100)}%)</span>
      <span style="display:inline-flex;align-items:center;gap:5px;">${swatch("var(--color-warning)")}Blocage (${Math.round(w.blocage * 100)}%)</span>
    `;
  }

  function renderList(ranked) {
    if (!ranked.length) {
      listEl.innerHTML = `<div class="empty-state" style="padding:16px;"><span class="emoji">🎉</span>Rien à classer avec ce filtre.</div>`;
      return;
    }
    listEl.innerHTML = "";
    ranked.forEach((r, idx) => {
      const { task, project, score, why } = r;
      const row = document.createElement("div");
      row.className = "item-row";
      row.style.cursor = "pointer";
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">${idx + 1}. ${task.isBlocked ? "🔴 " : ""}${escapeHtml(task.title)}${project ? ` <span style="font-weight:400;font-size:var(--font-size-sm);color:var(--color-text-muted);">${project.critical ? "⭐ " : "📦 "}${escapeHtml(project.name)}</span>` : ""}</div>
          <div style="height:6px;border-radius:var(--radius-pill);overflow:hidden;display:flex;margin:6px 0;background:var(--color-surface-alt);">
            <div style="width:${(score.urgence * score.weights.urgence * 100).toFixed(1)}%;background:var(--color-danger);"></div>
            <div style="width:${(score.impact * score.weights.impact * 100).toFixed(1)}%;background:var(--color-waiting);"></div>
            <div style="width:${(score.blocage * score.weights.blocage * 100).toFixed(1)}%;background:var(--color-warning);"></div>
          </div>
          <div class="item-meta prio-why" style="font-style:italic;">🧭 ${escapeHtml(why)}</div>
        </div>
        <span class="badge" style="background:var(--color-primary-light);color:var(--color-primary);">${Math.round(score.total * 100)}</span>
      `;
      row.addEventListener("click", () => openTaskDetail(task, latestProjects.filter((p) => !projectsApi.isArchived(p))));
      listEl.appendChild(row);
    });
  }

  function openWeightsModal() {
    const body = document.createElement("div");
    body.innerHTML = `
      <p style="color:var(--color-text-muted);font-size:var(--font-size-sm);margin-top:0;">
        Répartis l'importance relative des trois signaux — les valeurs sont ramenées automatiquement sur 100%, seul le rapport entre elles compte.
      </p>
      ${["urgence", "impact", "blocage"]
        .map(
          (key) => `
        <div class="field">
          <label for="weight-${key}">${key === "urgence" ? "⏰ Urgence (échéance)" : key === "impact" ? "🎯 Impact (projet prioritaire)" : "🔴 Blocage"} — <span id="weight-${key}-value">${weights[key]}</span></label>
          <input id="weight-${key}" type="range" min="0" max="100" step="5" value="${weights[key]}" style="width:100%;" />
        </div>
      `
        )
        .join("")}
    `;
    for (const key of ["urgence", "impact", "blocage"]) {
      body.querySelector(`#weight-${key}`).addEventListener("input", (e) => {
        body.querySelector(`#weight-${key}-value`).textContent = e.target.value;
      });
    }
    const { close } = openModal({
      title: "⚙️ Régler les poids de la priorisation",
      body,
      actions: [
        {
          label: "Réinitialiser",
          variant: "ghost",
          closesModal: false,
          onClick: () => {
            for (const key of ["urgence", "impact", "blocage"]) {
              body.querySelector(`#weight-${key}`).value = priorisationApi.DEFAULT_WEIGHTS[key];
              body.querySelector(`#weight-${key}-value`).textContent = priorisationApi.DEFAULT_WEIGHTS[key];
            }
          },
        },
        { label: "Annuler", variant: "ghost" },
        {
          label: "Enregistrer",
          variant: "primary",
          closesModal: false,
          onClick: async () => {
            weights = {
              urgence: Number(body.querySelector("#weight-urgence").value),
              impact: Number(body.querySelector("#weight-impact").value),
              blocage: Number(body.querySelector("#weight-blocage").value),
            };
            await preferencesApi.setPriorityWeights(weights);
            close();
            renderAll();
            showToast("Poids de priorisation mis à jour");
          },
        },
      ],
    });
  }
  weightsBtn.addEventListener("click", openWeightsModal);

  preferencesApi.getPreferences().then((prefs) => {
    const casquette = prefs.casquette || "all";
    activeHat = casquette === "all" || PILOTAGE_HATS.includes(casquette) ? casquette : "all";
    weights = prefs.priorityWeights || priorisationApi.DEFAULT_WEIGHTS;
    renderHatFilter();
    renderAll();
  });

  const unsubTasks = tasksApi.subscribe((tasks) => {
    latestTasks = tasks;
    renderAll();
  });
  const unsubProjects = projectsApi.subscribe((projects) => {
    latestProjects = projects;
    renderAll();
  });

  return function cleanup() {
    container.classList.remove("app-wide");
    unsubTasks();
    unsubProjects();
  };
}
