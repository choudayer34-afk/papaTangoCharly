// Carte "Progression" de l'Accueil — LOT G10, TODO_GAMIFICATION.md §13.1, ajout du 28/09/2026.
// Donne immédiatement envie d'utiliser Pilotage sans dupliquer ni remplacer les écrans Galerie
// (§7) ou Progression (§9, js/views/gamification.js) — une carte compacte, jamais un troisième
// écran de consultation complet (§13.1 : "aucun élément de plus, aucun de moins" que la liste
// fermée ci-dessous).
//
// Emplacement (§13.1) : Accueil, EN PLUS de l'icône déjà affichée à côté du titre "Mon pilotage"
// (LOT G7) — les deux cohabitent. Montée en dehors du système de sections réordonnables/masquables
// de js/views/dashboard.js (HOME_ORDER_KEYS) : §13.1 exige "toujours visible [...] jamais masquée
// en dessous d'un seuil d'activité minimal", donc pas une rubrique que Charles-Henri pourrait
// décocher dans ⚙️ Personnaliser l'accueil comme les autres.
import * as gamificationApi from "../domain/gamification.js";
import * as objectivesApi from "../domain/objectives.js";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

/**
 * Monte la carte dans `container` (un simple `<div>` vide fourni par js/views/dashboard.js) —
 * même convention que js/components/bureau.js#mountBureau : une instance pour toute la durée de
 * vie de l'Accueil, mise à jour par ses propres abonnements temps réel plutôt que reconstruite par
 * l'appelant. Retourne une fonction de nettoyage (désabonnements), à appeler dans le `cleanup()`
 * global de renderDashboard() comme les autres abonnements de cette vue.
 */
export function mountProgressionCard(container) {
  // Réduite par défaut (retour de Charles-Henri, 29/09/2026 : "je dois voir la rubrique niveau
  // d'avancement Xp en mode réduit par défaut [...] ça doit rester discret par rapport au reste
  // [...] je peux déplier pour voir l'état actuel") : `<details>` SANS `open` (contrairement à
  // "Mon bureau"/renderKeptSection, qui restent ouverts par défaut — ici la demande explicite est
  // l'inverse). Le résumé d'une ligne (niveau, XP total, XP avant le niveau suivant) reste visible
  // même replié ; tout le reste (barre, séries/XP du jour, prochain badge, boutons) n'apparaît
  // qu'une fois déplié. État de repli/dépli volontairement NON mémorisé d'une session à l'autre
  // (même choix que "Mon bureau", js/components/bureau.js) : rien de demandé sur ce point.
  container.innerHTML = `
    <div class="card progression-card--reduced" id="progression-card">
      <details id="progression-card-details">
        <summary class="progression-card-summary" id="progression-card-resume">—</summary>
        <div id="progression-card-detail" style="margin-top: var(--space-3);">
          <div class="progression-repartition-tete">
            <strong id="progression-card-niveau">—</strong>
            <span id="progression-card-xp-total"></span>
          </div>
          <div class="progression-bar-track"><div class="progression-bar-fill" id="progression-card-bar" style="width:0%"></div></div>
          <div style="color: var(--color-text-muted); font-size: var(--font-size-xs); margin-top: 4px;" id="progression-card-xp-restant"></div>
          <div class="stat-grid" id="progression-card-stats" style="margin-top: var(--space-3);"></div>
          <div id="progression-card-prochain-badge"></div>
          <div style="display:flex; gap: var(--space-2); flex-wrap: wrap; margin-top: var(--space-3);">
            <button type="button" class="btn btn-secondary btn-sm" id="progression-card-voir">📊 Voir ma progression</button>
            <button type="button" class="btn btn-secondary btn-sm" id="progression-card-recompenses">🎁 Voir mes récompenses</button>
          </div>
        </div>
      </details>
    </div>
  `;

  const els = {
    resume: container.querySelector("#progression-card-resume"),
    niveau: container.querySelector("#progression-card-niveau"),
    xpTotal: container.querySelector("#progression-card-xp-total"),
    bar: container.querySelector("#progression-card-bar"),
    xpRestant: container.querySelector("#progression-card-xp-restant"),
    stats: container.querySelector("#progression-card-stats"),
    prochainBadge: container.querySelector("#progression-card-prochain-badge"),
  };

  // La carte perd son apparence "discrète" (fond transparent, sans bordure/ombre — voir
  // styles/components.css) dès qu'elle est dépliée, pour redevenir une .card normale le temps de
  // la consultation détaillée.
  const cardEl = container.querySelector("#progression-card");
  const detailsEl = container.querySelector("#progression-card-details");
  detailsEl.addEventListener("toggle", () => {
    cardEl.classList.toggle("progression-card--reduced", !detailsEl.open);
  });

  container.querySelector("#progression-card-voir").addEventListener("click", () => {
    location.hash = "#/progression";
  });
  // Bouton DISTINCT de "Voir ma progression" ci-dessus (§13.1 : "jamais le Centre de récompenses,
  // destination distincte") — répond malgré tout à l'exigence du §13.6 ("accessible depuis
  // l'Accueil, la Galerie et la Progression") en offrant un second point d'entrée, séparé.
  container.querySelector("#progression-card-recompenses").addEventListener("click", () => {
    location.hash = "#/recompenses";
  });

  let state = null;
  let collaborateursDistincts = 0;

  function render() {
    if (!state) return;

    const progression = gamificationApi.progressionNiveau(state.xpTotal);
    // Résumé affiché même repliée (retour de Charles-Henri : "Niveau 5 · 🥉 Bronze — 422 XP — 78
    // XP avant le niveau 6") — les 3 mêmes informations que les lignes détaillées ci-dessous,
    // recomposées sur une seule ligne, jamais un calcul distinct.
    els.resume.textContent = `Niveau ${progression.niveau} · ${progression.palier} · ${state.xpTotal} XP · ${progression.xpRestantAvantNiveauSuivant} XP avant le niveau ${progression.niveau + 1}`;
    els.niveau.textContent = `Niveau ${progression.niveau} · ${progression.palier}`;
    els.xpTotal.textContent = `${state.xpTotal} XP`;
    const pourcent = Math.max(0, Math.min(1, progression.progressionRatio)) * 100;
    els.bar.style.width = `${pourcent}%`;
    els.xpRestant.textContent = `${progression.xpRestantAvantNiveauSuivant} XP avant le niveau ${progression.niveau + 1}`;

    const serieLongueur = gamificationApi.longueurSerieJournaliereCourante(state.series.pilotage);
    const xpAujourdhui = gamificationApi.xpGagneAujourdhui(state);
    els.stats.innerHTML = `
      <div class="stat-tile">
        <div class="stat-value">${serieLongueur}</div>
        <div class="stat-label">🔥 Série Pilotage</div>
      </div>
      <div class="stat-tile">
        <div class="stat-value">${xpAujourdhui}</div>
        <div class="stat-label">⭐ XP aujourd'hui</div>
      </div>
    `;

    // Badge permanent le plus proche (§13.1) — absent si aucun n'est pertinent (cas limite :
    // toutes les familles actives déjà au badge Légendaire, ou seules Régularité/Documentation
    // restent verrouillées) : n'affiche alors que le prochain niveau ci-dessus, sans bloc dédié,
    // jamais un espace vide à sa place.
    const [prochain] = gamificationApi.prochainsBadgesPermanents(state, collaborateursDistincts, 1);
    if (prochain) {
      els.prochainBadge.innerHTML = `
        <div class="progression-repartition-ligne" style="margin-top: var(--space-2);">
          <div class="progression-repartition-tete">
            <span>🏅 Prochain badge : ${escapeHtml(prochain.badge.nom)}</span>
            <span>${prochain.valeurCourante} / ${prochain.badge.seuil}</span>
          </div>
        </div>
      `;
    } else {
      els.prochainBadge.innerHTML = "";
    }
  }

  const unsubGamification = gamificationApi.subscribe((newState) => {
    state = newState;
    render();
  });
  // Collaborateurs distincts suivis (famille Management, §5.1) — même mécanique que
  // js/views/gamification.js#renderGamificationGallery : un abonnement plutôt qu'un `listAll()`
  // unique, pour rester à jour si un Objectif EADP est créé pendant que l'Accueil reste ouvert.
  const unsubObjectives = objectivesApi.subscribe((objectifs) => {
    collaborateursDistincts = new Set(objectifs.filter((o) => o.personId).map((o) => o.personId)).size;
    render();
  });

  return function cleanup() {
    unsubGamification();
    unsubObjectives();
  };
}
