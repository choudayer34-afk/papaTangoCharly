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

// Détail au clic (retour direct de Charles-Henri, 28/09/2026, hors numérotation LOT — ajout
// ad hoc à la Galerie, pas une entrée de TODO_GAMIFICATION.md) : chaque tuile de badge est
// désormais cliquable et ouvre une fiche détaillée (comment l'obtenir/progression réelle, ET
// ce que le badge donne EN PLUS de lui-même — le ou les déblocages de Table B/Table C, §6, qui
// dépendent de CE badge précis) — voir openBadgeDetailModal() plus bas. Avant ce jour, seul un
// `title` HTML (info-bulle native, peu découvrable) portait `badge.description`.
import { openModal } from "../components/modal.js";
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

    // Fiche détaillée au clic (28/09/2026, voir le commentaire sur l'import d'openModal en tête
    // de fichier) — le `title` HTML ci-dessus reste en place comme repli natif (survol souris),
    // la tuile devient en plus un vrai contrôle activable au clavier.
    tile.setAttribute("role", "button");
    tile.tabIndex = 0;
    const ouvrir = () => openBadgeDetailModal(badge, currentState, collabs, emoji, locked, obtenuAtMs);
    tile.addEventListener("click", ouvrir);
    tile.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        ouvrir();
      }
    });

    return tile;
  }

  /**
   * Fiche détaillée d'un badge (28/09/2026, retour de Charles-Henri : "il faudrait une petite
   * explication [...] de comment on l'obtient et ce que ça permet d'avoir en plus"). Deux
   * informations, jamais recalculées différemment de la tuile elle-même (mêmes données,
   * `badge.condition`/`valeurCouranteFamille()` pour "comment l'obtenir", `state.badgesObtained`
   * pour la date d'obtention) :
   *  - "Comment l'obtenir" — condition exacte (§5.1) + progression réelle si verrouillé, date
   *    d'obtention + bonus XP si déjà obtenu.
   *  - "Ce que ça débloque en plus" — les déblocages de Table B/Table C (§6) qui dépendent
   *    SPÉCIFIQUEMENT de ce badge (`gamificationApi.DEBLOCAGES` filtré sur `badgeId ===
   *    badge.id`), s'il y en a : un badge Or de famille en débloque un (icône Accueil), un
   *    badge Bronze de famille en débloque un autre (ruban, combiné au niveau 15) — les badges
   *    Argent/Platine/Légendaire n'en déclenchent structurellement aucun (aucune ligne du §6 ne
   *    les référence), auquel cas la section l'indique plutôt que de rester silencieuse.
   */
  function openBadgeDetailModal(badge, currentState, collabs, emoji, locked, obtenuAtMs) {
    const body = document.createElement("div");

    let obtentionHtml;
    if (!locked) {
      const dateObtenu = new Date(obtenuAtMs).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
      obtentionHtml = `<p><strong>Obtenu le ${dateObtenu}</strong> · +${badge.xp} XP crédités à ce moment-là.</p>`;
    } else {
      const valeurCourante = gamificationApi.valeurCouranteFamille(currentState, badge.famille, collabs);
      const valeurAffichee = Math.max(0, Math.min(valeurCourante, badge.seuil));
      obtentionHtml = `<p><strong>Pas encore obtenu</strong> — progression actuelle : ${valeurAffichee} / ${badge.seuil}. Une fois obtenu, ce badge créditera +${badge.xp} XP.</p>`;
    }

    const noteFamilleBloquee = renderNoteFamilleBloquee(badge.famille);

    const deblocageIcone = gamificationApi.DEBLOCAGES.find((d) => d.type === "badge" && d.badgeId === badge.id);
    const deblocageRuban = gamificationApi.DEBLOCAGES.find((d) => d.type === "niveauEtBadge" && d.badgeId === badge.id);

    let deblocagesHtml;
    if (deblocageIcone) {
      deblocagesHtml = `<p>Débloque l'icône ${deblocageIcone.valeur} (« ${escapeHtml(deblocageIcone.nom)} »), à afficher à côté du titre « Mon pilotage » sur l'Accueil une fois équipée (section « 🔓 Déblocages » ci-dessous).</p>`;
    } else if (deblocageRuban) {
      deblocagesHtml = `<p>Combiné au niveau 15, débloque le « ${escapeHtml(
        deblocageRuban.nom
      )} » — détecté et acquis dès que les deux conditions sont réunies, mais pas encore affiché à l'écran (dépend de l'écran Progression, LOT G8, pas encore construit).</p>`;
    } else {
      deblocagesHtml = `<p>Aucun déblocage cosmétique n'est associé à ce badge précis (seuls un badge Or et un badge Bronze par famille en déclenchent un, voir la section « 🔓 Déblocages » ci-dessous) — juste le bonus XP.</p>`;
    }

    body.innerHTML = `
      <p>${escapeHtml(badge.description)}</p>
      <div class="section-title" style="margin-top:0;">🔑 Comment l'obtenir</div>
      <p>${escapeHtml(badge.condition)}</p>
      ${obtentionHtml}
      <div id="badge-detail-note-famille"></div>
      <div class="section-title">🎁 Ce que ça débloque en plus</div>
      ${deblocagesHtml}
    `;
    if (noteFamilleBloquee) body.querySelector("#badge-detail-note-famille").appendChild(noteFamilleBloquee);

    openModal({
      title: `${emoji} ${badge.nom}`,
      body,
      actions: [{ label: "Fermer", variant: "ghost" }],
    });
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

// ================================================================================================
// Écran "📊 Progression" (LOT G8, TODO_GAMIFICATION.md §9) — le pilotage de l'activité : niveau,
// XP, séries, activité mensuelle, historique des gains, répartition des XP, badges mensuels,
// prochain niveau. Écran STRICTEMENT distinct de la Galerie ci-dessus (§9, décision actée le
// 24/09/2026 : "il ne montre ni grille de badges obtenus/verrouillés, ni illustrations de badges,
// ni déblocages") — aucune tuile de badge ni de déblocage ici, uniquement des données de pilotage.
// Toute la logique de calcul (répartition de l'XP, seuils/labels des badges mensuels, position
// dans le barème de niveaux, séries affichables) vit dans js/domain/gamification.js — ce fichier
// ne fait que LIRE cet état et l'afficher, exactement comme la Galerie plus haut.
//
// Route dédiée `#/progression` (voir js/app.js#HIDDEN_ROUTES et js/views/more.js), tranchée lors du
// cadrage de ce lot — même principe que `#/gamification-galerie` (une page de consultation, pas un
// écran de travail, donc hors de ROUTES/NAV_ITEMS).
// ================================================================================================

const SERIES_INFO = [
  { id: "pilotage", label: "🧭 Pilotage", type: "jour" },
  { id: "inbox", label: "📥 Inbox", type: "jour" },
  { id: "taches", label: "✅ Tâches", type: "jour" },
  { id: "revueHebdo", label: "📅 Revue hebdo", type: "semaine" },
];

const NOMS_MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Mois local courant au format "YYYY-MM" (§2.2 : date locale, jamais `toISOString()`, même
 *  précaution que le domaine) — pure mise en forme d'affichage pour comparer au mois enregistré
 *  dans `badgesMensuelsCourant.mois` et construire la grille du calendrier-heatmap ci-dessous,
 *  aucune règle métier dupliquée ici. */
function moisActuel() {
  const maintenant = new Date();
  return `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, "0")}`;
}

/** Date locale du jour au format "YYYY-MM-DD" (même format que js/domain/gamification.js) —
 *  utilisée uniquement pour griser visuellement, dans le calendrier-heatmap, les jours ouvrés du
 *  mois pas encore atteints. */
function todayKey() {
  const maintenant = new Date();
  return `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, "0")}-${String(maintenant.getDate()).padStart(2, "0")}`;
}

/** Tous les jours OUVRÉS (lundi-vendredi, calendrier local) du mois "YYYY-MM" donné, au format
 *  "YYYY-MM-DD" — même définition que js/domain/gamification.js#estJourOuvre (aucun jour férié),
 *  reformulée ici uniquement pour construire la grille d'affichage du calendrier-heatmap (§9,
 *  "même principe visuel qu'un calendrier de contributions") : ce fichier ne fait QUE lire l'état
 *  déjà calculé par le domaine (`badgesMensuelsCourant.jours.regulier`), jamais une nouvelle règle
 *  métier de comptage. */
function joursOuvresDuMois(moisStr) {
  const [annee, mois] = moisStr.split("-").map(Number);
  const dernierJour = new Date(annee, mois, 0).getDate();
  const jours = [];
  for (let j = 1; j <= dernierJour; j++) {
    const dow = new Date(annee, mois - 1, j).getDay();
    if (dow !== 0 && dow !== 6) jours.push(`${moisStr}-${String(j).padStart(2, "0")}`);
  }
  return jours;
}

/** Libellé "Septembre 2026" à partir de "2026-09" — affichage uniquement, pour l'historique des
 *  mois précédents de badges mensuels (§9). */
function formatMoisLabel(moisStr) {
  const [annee, mois] = moisStr.split("-").map(Number);
  const nom = NOMS_MOIS[mois - 1] || moisStr;
  return `${nom.charAt(0).toUpperCase()}${nom.slice(1)} ${annee}`;
}

export function renderGamificationProgression(container) {
  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>📊 Progression</h1>
        <div class="subtitle" id="progression-subtitle">—</div>
      </div>
    </div>
    <div class="view">
      <div class="stat-grid" id="progression-stats"></div>
      <div class="card" id="progression-niveau-suivant"></div>

      <div class="section-title">🔥 Séries</div>
      <div class="stat-grid" id="progression-series"></div>

      <div class="section-title">📅 Activité mensuelle</div>
      <div class="card"><div class="progression-heatmap" id="progression-heatmap"></div></div>

      <div class="section-title">🥇 Badges mensuels</div>
      <div class="card" id="progression-badges-mensuels-courant"></div>

      <div class="section-title">🗓️ Historique des mois précédents</div>
      <div class="card" id="progression-badges-mensuels-historique"></div>

      <div class="section-title">🧭 Répartition des XP</div>
      <div class="card" id="progression-repartition"></div>

      <div class="section-title">🕓 Historique des gains</div>
      <div id="progression-historique"></div>
    </div>
  `;

  const els = {
    subtitle: container.querySelector("#progression-subtitle"),
    stats: container.querySelector("#progression-stats"),
    niveauSuivant: container.querySelector("#progression-niveau-suivant"),
    series: container.querySelector("#progression-series"),
    heatmap: container.querySelector("#progression-heatmap"),
    badgesMensuelsCourant: container.querySelector("#progression-badges-mensuels-courant"),
    badgesMensuelsHistorique: container.querySelector("#progression-badges-mensuels-historique"),
    repartition: container.querySelector("#progression-repartition"),
    historique: container.querySelector("#progression-historique"),
  };

  let state = null;

  function render() {
    if (!state) {
      els.subtitle.textContent = "Chargement...";
      return;
    }

    const progression = gamificationApi.progressionNiveau(state.xpTotal);
    els.subtitle.textContent = `Niveau ${progression.niveau} · ${progression.palier} · ${state.xpTotal} XP cumulés`;

    els.stats.innerHTML = `
      <div class="stat-tile">
        <div class="stat-value">${progression.niveau}</div>
        <div class="stat-label">${progression.palier}</div>
      </div>
      <div class="stat-tile">
        <div class="stat-value">${state.xpTotal}</div>
        <div class="stat-label">⭐ XP total</div>
      </div>
    `;

    const pourcent = Math.max(0, Math.min(1, progression.progressionRatio)) * 100;
    els.niveauSuivant.innerHTML = `
      <div class="progression-repartition-tete">
        <strong>🚀 Prochain niveau</strong>
        <span>${progression.xpDansNiveauCourant} / ${progression.xpPourNiveauSuivant} XP</span>
      </div>
      <div class="progression-bar-track"><div class="progression-bar-fill" style="width:${pourcent}%"></div></div>
      <div style="color: var(--color-text-muted); font-size: var(--font-size-xs); margin-top: 4px;">
        ${progression.xpRestantAvantNiveauSuivant} XP avant le niveau ${progression.niveau + 1}
      </div>
    `;

    renderSeries();
    renderHeatmap();
    renderBadgesMensuels();
    renderRepartition();
    renderHistorique();
  }

  function renderSeries() {
    els.series.innerHTML = SERIES_INFO.map((info) => {
      const serieRaw = state.series[info.id];
      const longueur =
        info.type === "jour"
          ? gamificationApi.longueurSerieJournaliereCourante(serieRaw)
          : gamificationApi.longueurSerieHebdoCourante(serieRaw);
      return `
        <div class="stat-tile">
          <div class="stat-value">${longueur}</div>
          <div class="stat-label">${info.label} · record ${serieRaw.record}</div>
        </div>
      `;
    }).join("");
  }

  /** Calendrier-heatmap des jours ouvrés du mois courant (§9) — réutilise directement
   *  `badgesMensuelsCourant.jours.regulier` (LOT G4, déjà "les jours ouvrés du mois avec au moins
   *  une action valorisée", voir js/domain/gamification.js#enregistrerJoursMensuels) : AUCUNE
   *  nouvelle donnée persistée pour cet élément. Si l'état stocké n'a pas encore basculé sur le
   *  mois civil réel (aucune action depuis le début du mois, la bascule de LOT G4 est paresseuse —
   *  elle n'a lieu qu'au prochain appel réel), la grille s'affiche simplement sans aucun jour actif
   *  plutôt que de lire les jours d'un mois différent — cohérent avec la donnée réelle : aucune
   *  action valorisée n'a encore eu lieu ce mois-ci. */
  function renderHeatmap() {
    const mois = moisActuel();
    const joursActifs = state.badgesMensuelsCourant.mois === mois ? state.badgesMensuelsCourant.jours.regulier : [];
    const aujourdhui = todayKey();
    els.heatmap.innerHTML = joursOuvresDuMois(mois)
      .map((jour) => {
        const actif = joursActifs.includes(jour);
        const futur = jour > aujourdhui;
        const classes = ["progression-heatmap-jour"];
        if (actif) classes.push("progression-heatmap-jour--actif");
        if (futur) classes.push("progression-heatmap-jour--futur");
        return `<div class="${classes.join(" ")}" title="${jour}${actif ? " · actif" : ""}"></div>`;
      })
      .join("");
  }

  /** Badges mensuels (§9) — état du mois courant (jours distincts / seuil, §5.2, LOT G4) et bref
   *  historique des mois précédents (obtenu oui/non par mois, jamais la progression partielle,
   *  cohérent avec ce que `badgesMensuelsHistorique` conserve réellement, voir LOT G4). Même
   *  précaution de bascule paresseuse que `renderHeatmap()` ci-dessus pour le mois courant. */
  function renderBadgesMensuels() {
    const mois = moisActuel();
    const courant =
      state.badgesMensuelsCourant.mois === mois
        ? state.badgesMensuelsCourant
        : {
            jours: { organise: [], focus: [], regulier: [], decideur: [], livreur: [] },
            obtenus: { organise: false, focus: false, regulier: false, decideur: false, livreur: false },
          };

    els.badgesMensuelsCourant.innerHTML = gamificationApi.BADGES_MENSUELS_INFO.map((info) => {
      const jours = courant.jours[info.id].length;
      const seuil = gamificationApi.SEUILS_BADGES_MENSUELS[info.id];
      const obtenu = courant.obtenus[info.id];
      return `
        <div class="progression-mois-historique-ligne">
          <span class="progression-mois-historique-badge${obtenu ? " progression-mois-historique-badge--obtenu" : ""}">${info.emoji}</span>
          <span class="progression-mois-historique-label">${escapeHtml(info.label)}</span>
          <span style="color: var(--color-text-muted); font-size: var(--font-size-xs);">
            ${Math.min(jours, seuil)} / ${seuil} jours${obtenu ? " · obtenu" : ""}
          </span>
        </div>
      `;
    }).join("");

    const moisHistorique = Object.keys(state.badgesMensuelsHistorique)
      .sort()
      .reverse()
      .slice(0, 6);
    if (!moisHistorique.length) {
      els.badgesMensuelsHistorique.innerHTML = `<div class="empty-state">Aucun mois précédent enregistré pour l'instant.</div>`;
      return;
    }
    els.badgesMensuelsHistorique.innerHTML = moisHistorique
      .map((moisCle) => {
        const obtenus = state.badgesMensuelsHistorique[moisCle];
        const badges = gamificationApi.BADGES_MENSUELS_INFO.map(
          (info) =>
            `<span class="progression-mois-historique-badge${obtenus[info.id] ? " progression-mois-historique-badge--obtenu" : ""}" title="${escapeHtml(info.label)}">${info.emoji}</span>`
        ).join("");
        return `
          <div class="progression-mois-historique-ligne">
            <span class="progression-mois-historique-label">${formatMoisLabel(moisCle)}</span>
            <span>${badges}</span>
          </div>
        `;
      })
      .join("");
  }

  /** Répartition de l'XP total par type d'action (§9) — total depuis toujours (décision de
   *  Charles-Henri, AskUserQuestion du 28/09/2026, voir js/domain/gamification.js
   *  #repartitionXpParAction pour le détail de l'arbitrage §9/§10). Pourcentage relatif à la
   *  somme des lignes du barème (§3) uniquement — pas à `xpTotal`, qui inclut aussi les bonus de
   *  badges (§5.1, hors périmètre de cette répartition par action). */
  function renderRepartition() {
    const lignes = gamificationApi.repartitionXpParAction(state);
    if (!lignes.length) {
      els.repartition.innerHTML = `<div class="empty-state">Aucune action valorisée enregistrée pour l'instant.</div>`;
      return;
    }
    const totalXp = lignes.reduce((somme, ligne) => somme + ligne.xp, 0);
    els.repartition.innerHTML = lignes
      .map((ligne) => {
        const pourcent = totalXp > 0 ? Math.round((ligne.xp / totalXp) * 100) : 0;
        return `
          <div class="progression-repartition-ligne">
            <div class="progression-repartition-tete">
              <span>${escapeHtml(ligne.label)}</span>
              <span>${ligne.xp} XP · ${pourcent}%</span>
            </div>
            <div class="progression-bar-track"><div class="progression-bar-fill" style="width:${pourcent}%"></div></div>
          </div>
        `;
      })
      .join("");
  }

  /** Historique des gains (§9) — liste chronologique des derniers événements ayant rapporté de
   *  l'XP (action + montant + date), directement `state.historiqueGains` (LOT G8, déjà trié du
   *  plus récent au plus ancien et borné, voir js/domain/gamification.js#awardXpOnce). Réutilise
   *  `.notes-entry` (déjà le style d'une liste chronologique ailleurs dans l'app, voir le journal
   *  de notes horodaté) plutôt qu'un nouveau composant pour la même chose. */
  function renderHistorique() {
    if (!state.historiqueGains.length) {
      els.historique.innerHTML = `<div class="empty-state"><span class="emoji">🕓</span>Aucun gain d'XP enregistré pour l'instant.</div>`;
      return;
    }
    els.historique.innerHTML = state.historiqueGains
      .map((entree) => {
        const date = new Date(entree.dateMs).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
        return `
          <div class="notes-entry">
            <div>${escapeHtml(entree.label)} · +${entree.xp} XP</div>
            <div style="color: var(--color-text-muted); font-size: var(--font-size-xs);">${date}</div>
          </div>
        `;
      })
      .join("");
  }

  const unsubGamification = gamificationApi.subscribe((newState) => {
    state = newState;
    render();
  });

  render();

  return function cleanup() {
    unsubGamification();
  };
}
