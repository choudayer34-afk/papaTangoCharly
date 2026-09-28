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
//  - Déblocages (§7) : ajoutés en LOT G7 (voir "Déblocages (LOT G7)" ci-dessous), une fois les
//    Tables A/B/C construites côté moteur (js/domain/gamification.js#DEBLOCAGES).
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
//
// Déblocages (LOT G7, TODO_GAMIFICATION.md §6) — les 34 déblocages (Tables A/B/C, catalogue et
// moteur d'attribution dans js/domain/gamification.js#DEBLOCAGES/verifierDeblocages), groupés
// par catégorie (`CATEGORIES_DEBLOCAGES`, ordre d'affichage stable). Deux arbitrages
// AskUserQuestion du 25/09/2026 (détaillés dans js/domain/gamification.js) limitent ce qui est
// réellement APPLIQUÉ dans ce lot :
//  - Palette (2) et Icône (14) sont appliquées (voir js/components/stickyNoteShared.js pour la
//    Palette, js/views/dashboard.js pour l'Icône) — seule Icône est "équipable" (un déblocage
//    actif à la fois, voir CATEGORIES_DEBLOCAGES#equipable), câblée ici sur
//    preferencesApi.setGamificationIconeEquipee().
//  - Thème (2), Fond (2) et Ruban (14) sont détectés/acquis mais SANS application visuelle
//    (`valeur: null` dans le catalogue, même philosophie que Régularité/Documentation
//    ci-dessus : "acquis" reste vrai et se voit ici, sans travail de reprise nécessaire plus
//    tard) — renderNoteCategorieDifferee() rend cette limite explicite, jamais silencieuse.

import * as gamificationApi from "../domain/gamification.js";
import * as objectivesApi from "../domain/objectives.js";
import * as preferencesApi from "../domain/preferences.js";

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
      <div class="section-title" id="gamification-deblocages-title">🔓 Déblocages</div>
      <div id="gamification-deblocages"></div>
    </div>
  `;

  const subtitleEl = container.querySelector("#gamification-subtitle");
  const filtersEl = container.querySelector("#gamification-filters");
  const listEl = container.querySelector("#gamification-list");
  const deblocagesEl = container.querySelector("#gamification-deblocages");

  let state = null;
  let collaborateursDistincts = 0;
  let activeRarete = "toutes";
  // Icône équipée (LOT G7) — lue une seule fois au montage (préférences.js n'a pas d'abonnement
  // temps réel, voir js/views/dashboard.js#refreshGamificationIcon pour la même limite côté
  // Accueil) puis tenue à jour localement à chaque clic "Équiper" ci-dessous, qui écrit ET met
  // à jour cette variable dans la foulée pour un retour visuel immédiat sans réaller-retour
  // Firestore avant de rafraîchir l'écran.
  let iconeEquipeeId = null;
  preferencesApi.getPreferences().then((prefs) => {
    iconeEquipeeId = prefs.gamificationIconeEquipeeId || null;
    render();
  });

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

    renderDeblocages();
  }

  /**
   * Section "🔓 Déblocages" (LOT G7, TODO_GAMIFICATION.md §6) — groupée par
   * `gamificationApi.CATEGORIES_DEBLOCAGES`, jamais filtrée par la rareté (qui n'a de sens que
   * pour les badges ci-dessus) : toujours les 5 catégories, dans l'ordre du catalogue.
   */
  function renderDeblocages() {
    deblocagesEl.innerHTML = "";
    gamificationApi.CATEGORIES_DEBLOCAGES.forEach((categorie, i) => {
      const deblocagesCategorie = gamificationApi.DEBLOCAGES.filter((d) => d.categorie === categorie.id);
      if (!deblocagesCategorie.length) return;

      const header = document.createElement("div");
      header.className = "section-title";
      if (i === 0) header.style.marginTop = "0";
      header.textContent = categorie.label;
      deblocagesEl.appendChild(header);

      const noteDifferee = renderNoteCategorieDifferee(categorie.id);
      if (noteDifferee) deblocagesEl.appendChild(noteDifferee);

      const grid = document.createElement("div");
      grid.className = "badges-grid";
      deblocagesCategorie.forEach((deblocage) => grid.appendChild(renderTuileDeblocage(deblocage, categorie)));
      deblocagesEl.appendChild(grid);
    });
  }

  /** Note explicative pour Thème/Fond/Ruban (18 des 34 déblocages, arbitrage AskUserQuestion du
   *  25/09/2026 — voir le commentaire en tête de ce fichier) : "acquis" est réel et daté, mais
   *  aucune application visuelle n'existe encore, jamais un silence qui laisserait croire à un
   *  oubli. */
  function renderNoteCategorieDifferee(categorieId) {
    if (categorieId !== "theme" && categorieId !== "fond" && categorieId !== "ruban") return null;
    const note = document.createElement("div");
    note.className = "empty-state";
    note.style.textAlign = "left";
    note.style.padding = "0 0 12px";
    note.style.margin = "0";
    note.textContent =
      categorieId === "ruban"
        ? "Ces déblocages sont détectés et acquis dès leur condition remplie, mais leur affichage (carte de progression) n'existe pas encore — écran Progression, LOT G8."
        : "Ces déblocages sont détectés et acquis dès leur condition remplie, mais leur application visuelle n'existe pas encore — infrastructure de thème nommé à construire.";
    return note;
  }

  /** Libellé de la condition d'un déblocage — dérivé des mêmes données que
   *  `deblocageAtteint()` côté moteur (js/domain/gamification.js), jamais recalculé
   *  différemment ici : uniquement mis en forme pour l'affichage. */
  function conditionDeblocage(deblocage) {
    if (deblocage.type === "niveau") return `Niveau ${deblocage.niveau}`;
    const badge = gamificationApi.BADGES.find((b) => b.id === deblocage.badgeId);
    const nomBadge = badge ? badge.nom : deblocage.badgeId;
    if (deblocage.type === "badge") return `Badge « ${nomBadge} »`;
    return `Niveau ${deblocage.niveau} + Badge « ${nomBadge} »`;
  }

  function renderTuileDeblocage(deblocage, categorie) {
    const obtenuAtMs = state.deblocagesAcquis[deblocage.id];
    const locked = !obtenuAtMs;
    const tile = document.createElement("div");
    tile.className = `badge-tuile badge-tuile--deblocage${locked ? " badge-tuile--verrouille" : ""}`;
    tile.title = deblocage.nom;

    // L'emoji de la catégorie sert d'illustration par défaut (même stand-in que
    // FAMILLES_BADGES/LOT G6) ; la catégorie Icône fait exception, `deblocage.valeur` porte déjà
    // l'emoji réellement affiché sur l'Accueil une fois équipé — plus parlant qu'un emoji
    // générique de catégorie.
    const emoji = deblocage.categorie === "icone" ? deblocage.valeur : categorie.label.split(" ")[0];

    let etatHtml;
    if (!locked) {
      const dateObtenu = new Date(obtenuAtMs).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
      etatHtml = `<div class="badge-tuile-obtenu">Acquis le ${dateObtenu}</div>`;
    } else {
      etatHtml = `<div class="badge-tuile-progression">${escapeHtml(conditionDeblocage(deblocage))}</div>`;
    }

    tile.innerHTML = `
      <div class="badge-tuile-emoji">${emoji}</div>
      <div class="badge-tuile-nom">${escapeHtml(deblocage.nom)}</div>
      <div class="badge-tuile-condition">${escapeHtml(conditionDeblocage(deblocage))}</div>
      ${etatHtml}
    `;

    // Contrôle "Équiper" — uniquement la catégorie Icône (seule `equipable: true`), et
    // uniquement une fois le déblocage acquis (jamais équipable avant).
    if (!locked && categorie.equipable) {
      const equipe = iconeEquipeeId === deblocage.id;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-secondary btn-sm";
      btn.style.marginTop = "4px";
      btn.textContent = equipe ? "✓ Équipée" : "Équiper";
      btn.addEventListener("click", async () => {
        const nouvelleValeur = equipe ? null : deblocage.id;
        await preferencesApi.setGamificationIconeEquipee(nouvelleValeur);
        iconeEquipeeId = nouvelleValeur;
        renderDeblocages();
      });
      tile.appendChild(btn);
    }

    return tile;
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
