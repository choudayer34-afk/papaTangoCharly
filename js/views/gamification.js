// Vue "🏅 Galerie des badges" — LOT G6 de TODO_GAMIFICATION.md (roadmap gamification
// indépendante de TODO_TECHNIQUE.md, 25/09/2026). PREMIER écran UI de toute cette roadmap :
// affiche UNIQUEMENT la collection de badges (§7 — obtenus, verrouillés, progression vers
// chacun, raretés), JAMAIS les données de pilotage (XP total, niveau, séries d'activité) — une
// séparation "Galerie" (collectionner) / "Progression" (piloter) déjà actée avec Charles-Henri,
// l'écran "Progression" arrivant séparément avec LOT G7/LOT G8. Toute la logique de calcul (le
// catalogue `BADGES`, les 14 familles `FAMILLES_BADGES`, la valeur courante d'une famille via
// `valeurCouranteFamille`) vit dans js/domain/gamification.js, seul point d'entrée du moteur —
// ce fichier ne fait que LIRE cet état et l'afficher, aucune écriture.
//
// DEUX LIMITATIONS actées avec Charles-Henri (AskUserQuestion, 25/09/2026) avant tout
// développement de cet écran, toutes deux documentées en détail dans js/domain/gamification.js
// (section "Galerie des badges (LOT G6)") et dans le bilan de ce lot :
//  - Déblocages (§7) : section OMISE pour l'instant — dépend de LOT G7 (Tables B/C), pas
//    construit, aucune donnée n'existe. À ajouter plus tard sans retoucher la structure de cet
//    écran (une nouvelle section par tuile, insérée dans `renderTuileBadge` ci-dessous).
//  - Illustrations (§7/§8) : pas d'illustration réelle par badge (LOT G9, production graphique
//    externe, non démarrée) — un emoji par FAMILLE (`FAMILLES_BADGES`) avec un traitement CSS
//    par RARETÉ (`styles/components.css`, classes `.badge-tuile--*`) en tient lieu, swappable
//    pour une vraie illustration SVG plus tard sans changer cette structure.
//
// Régularité/Documentation (§5.1) : ces 2 familles sur 14 restent SANS DÉTECTION depuis LOT G3
// (arbitrage du 25/09/2026, non reconduit dans ce lot — ce n'est pas à ce lot de rouvrir cette
// décision) : leurs badges s'affichent tous verrouillés avec une note explicative dédiée
// (`renderNoteFamilleBloquee` ci-dessous), jamais silencieusement comme n'importe quelle autre
// famille. Régularité affiche malgré tout une progression réelle et non figée à 0, grâce au
// judgment call documenté sur `valeurCouranteFamille()` (le record personnel de la Série
// Pilotage, §5.3, existe déjà depuis LOT G5, même si l'attribution du badge reste bloquée).

import * as gamificationApi from "../domain/gamification.js";
import * as objectivesApi from "../domain/objectives.js";

const RARETES = [
  { key: "toutes", label: "Toutes les raretés" },
  { key: "bronze", label: "🥉 Bronze" },
  { key: "argent", label: "🥈 Argent" },
  { key: "or", label: "🥇 Or" },
  { key: "platine", label: "🏆 Platine" },
  { key: "legendaire", label: "💎 Légendaire" },
];

const RARETE_LABELS = { bronze: "Bronze", argent: "Argent", or: "Or", platine: "Platine", legendaire: "Légendaire" };

export function renderGamificationGallery(container) {
  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>🏅 Galerie des badges</h1>
        <div class="subtitle" id="gamification-subtitle">—</div>
      </div>
    </div>
    <div class="view">
      <div class="chip-row" id="gamification-filters"></div>
      <div id="gamification-list"></div>
    </div>
  `;

  const subtitleEl = container.querySelector("#gamification-subtitle");
  const filtersEl = container.querySelector("#gamification-filters");
  const listEl = container.querySelector("#gamification-list");

  let state = null;
  let collaborateursDistincts = 0;
  let activeRarete = "toutes";

  filtersEl.innerHTML = RARETES.map((r) => `<button type="button" class="chip" data-rarete="${r.key}">${r.label}</button>`).join("");
  filtersEl.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      activeRarete = chip.dataset.rarete;
      render();
    });
  });

  function render() {
    filtersEl.querySelectorAll(".chip").forEach((chip) => chip.classList.toggle("active", chip.dataset.rarete === activeRarete));

    if (!state) {
      subtitleEl.textContent = "Chargement...";
      listEl.innerHTML = "";
      return;
    }

    const totalObtenus = Object.keys(state.badgesObtained).length;
    subtitleEl.textContent = `${totalObtenus} / ${gamificationApi.BADGES.length} badges obtenus`;

    listEl.innerHTML = "";
    let aAfficheAuMoinsUneFamille = false;

    gamificationApi.FAMILLES_BADGES.forEach((famille, i) => {
      const badgesFamille = gamificationApi.BADGES.filter(
        (b) => b.famille === famille.id && (activeRarete === "toutes" || b.rarete === activeRarete)
      );
      if (!badgesFamille.length) return;
      aAfficheAuMoinsUneFamille = true;

      const header = document.createElement("div");
      header.className = "section-title";
      if (i === 0) header.style.marginTop = "0";
      header.textContent = `${famille.emoji} ${famille.label}`;
      listEl.appendChild(header);

      const noteFamilleBloquee = renderNoteFamilleBloquee(famille.id);
      if (noteFamilleBloquee) listEl.appendChild(noteFamilleBloquee);

      const grid = document.createElement("div");
      grid.className = "badges-grid";
      badgesFamille.forEach((badge) => grid.appendChild(renderTuileBadge(badge, state, collaborateursDistincts)));
      listEl.appendChild(grid);
    });

    if (!aAfficheAuMoinsUneFamille) {
      listEl.innerHTML = `<div class="empty-state"><span class="emoji">🔍</span>Aucun badge de cette rareté.</div>`;
    }
  }

  /** Note explicative pour Régularité/Documentation (§5.1, familles VOLONTAIREMENT SANS
   *  DÉTECTION depuis LOT G3, voir le commentaire en tête de ce fichier) — affichée entre le
   *  titre de la famille et sa grille de tuiles, pour que "toujours verrouillé" se comprenne
   *  comme un état attendu plutôt que comme un bug de l'écran. */
  function renderNoteFamilleBloquee(familleId) {
    if (familleId !== "regularite" && familleId !== "documentation") return null;
    const note = document.createElement("div");
    note.className = "empty-state";
    note.style.textAlign = "left";
    note.style.padding = "0 0 12px";
    note.style.margin = "0";
    note.textContent =
      familleId === "regularite"
        ? "Cette famille n'est pas encore attribuée automatiquement (dépend du record de la Série Pilotage, § 5.3) — la progression ci-dessous reflète déjà ce record réel."
        : "Cette famille n'est pas encore attribuée automatiquement : l'app ne propose pas encore de Modèles personnalisés.";
    return note;
  }

  function renderTuileBadge(badge, currentState, collabs) {
    const obtenuAtMs = currentState.badgesObtained[badge.id];
    const locked = !obtenuAtMs;
    const tile = document.createElement("div");
    tile.className = `badge-tuile badge-tuile--${badge.rarete}${locked ? " badge-tuile--verrouille" : ""}`;
    tile.title = badge.description;

    const familleInfo = gamificationApi.FAMILLES_BADGES.find((f) => f.id === badge.famille);
    const emoji = familleInfo ? familleInfo.emoji : "🏅";

    let progressionHtml;
    if (!locked) {
      const dateObtenu = new Date(obtenuAtMs).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
      progressionHtml = `<div class="badge-tuile-obtenu">Obtenu le ${dateObtenu} · +${badge.xp} XP</div>`;
    } else {
      const valeurCourante = gamificationApi.valeurCouranteFamille(currentState, badge.famille, collabs);
      const valeurAffichee = Math.max(0, Math.min(valeurCourante, badge.seuil));
      progressionHtml = `<div class="badge-tuile-progression">${valeurAffichee} / ${badge.seuil}</div>`;
    }

    tile.innerHTML = `
      <div class="badge-tuile-emoji">${emoji}</div>
      <div class="badge-tuile-nom">${escapeHtml(badge.nom)}</div>
      <div class="badge-tuile-rarete">${RARETE_LABELS[badge.rarete] || badge.rarete}</div>
      <div class="badge-tuile-condition">${escapeHtml(badge.condition)}</div>
      ${progressionHtml}
    `;
    return tile;
  }

  const unsubGamification = gamificationApi.subscribe((newState) => {
    state = newState;
    render();
  });

  // Nombre de collaborateurs distincts suivis (famille Management, §5.1) — recalculé en direct
  // via un abonnement à la collection `objectives` (même mécanique que
  // `recordObjectiveCreated` dans js/domain/gamification.js, qui la recalcule elle aussi en
  // interrogeant cette collection plutôt que de dupliquer un compteur séparé qui risquerait de
  // diverger). Un abonnement plutôt qu'un simple `listAll()` unique pour que la Galerie reste à
  // jour si un Objectif EADP est créé pendant que cet écran est ouvert.
  const unsubObjectives = objectivesApi.subscribe((objectifs) => {
    collaborateursDistincts = new Set(objectifs.filter((o) => o.personId).map((o) => o.personId)).size;
    render();
  });

  render();

  return function cleanup() {
    unsubGamification();
    unsubObjectives();
  };
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
