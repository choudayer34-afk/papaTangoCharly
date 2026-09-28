// Écran "🎁 Récompenses" (Centre de récompenses) — LOT G10, TODO_GAMIFICATION.md §13.6, ajout du
// 28/09/2026, retour de Charles-Henri "TODO-001 est validé et on fait la gamification §13/§14".
//
// **Tension signalée par la roadmap elle-même, résolue avec Charles-Henri avant tout développement
// (AskUserQuestion, 28/09/2026, option recommandée retenue : "3 écrans distincts")** : le §7
// documente un arbitrage du 24/09/2026 — Galerie (collection) et Progression (pilotage) sont deux
// écrans volontairement séparés pour ne jamais mélanger ces deux intentions. Un 3e écran dont
// l'onglet 1 recoupe une partie du contenu déjà couvert par la Galerie (badges verrouillés +
// progression) est en tension directe avec cette intention. Décision actée : les deux distinctions
// ("collection/pilotage" d'un côté, "chronologie proche/personnalisation" de l'autre) sont deux
// angles différents qui justifient chacun leur écran — ce fichier construit donc bien un 3e écran,
// pas une fusion dans la Galerie.
//
// Deux autres points signalés par la roadmap et résolus par la même consultation (28/09/2026) :
//  - Onglet 2 : aucune date de franchissement de niveau n'est persistée (§10) — dérivée de
//    manière approximative depuis `historiqueGains` plutôt que d'ajouter une donnée persistée
//    dédiée (option recommandée) — voir js/domain/gamification.js#chronologieRecompenses pour le
//    détail complet de cette approximation, assumée et documentée plutôt que cachée.
//  - Onglet 3 : la Palette (§6 Table A) n'a pas de notion d'équipement unique (arbitrage LOT G7,
//    chaque post-it garde sa propre couleur) — traitée ici de façon purement informative plutôt que
//    forcée dans le mécanisme de sélection unique des 4 autres catégories (option recommandée).
//
// Accessible depuis l'Accueil (js/components/progressionCard.js, bouton distinct de "Voir ma
// progression"), la Galerie et la Progression (boutons ajoutés à leur topbar respectif dans
// js/views/gamification.js) et ☰ Plus (js/views/more.js) — route `#/recompenses`, hors de
// ROUTES/NAV_ITEMS comme les deux autres écrans de gamification (js/app.js#HIDDEN_ROUTES).
import * as gamificationApi from "../domain/gamification.js";
import * as objectivesApi from "../domain/objectives.js";
import * as preferencesApi from "../domain/preferences.js";
import { applyGamificationTheme } from "../services/gamificationThemeStore.js";

const ONGLETS = [
  { id: "a-debloquer", label: "À débloquer" },
  { id: "deja-obtenus", label: "Déjà obtenus" },
  { id: "personnalisation", label: "Personnalisation" },
];

const CATEGORIE_LABELS = { icone: "🏷️ Icône", theme: "🌓 Thème", fond: "🖼️ Fond", ruban: "🎗️ Ruban" };

const SETTERS_EQUIPEMENT = {
  icone: preferencesApi.setGamificationIconeEquipee,
  theme: preferencesApi.setGamificationThemeEquipee,
  fond: preferencesApi.setGamificationFondEquipee,
  ruban: preferencesApi.setGamificationRubanEquipee,
};

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function formatDate(dateMs) {
  if (!dateMs) return "date non disponible";
  return new Date(dateMs).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export function renderRecompensesCentre(container) {
  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>🎁 Récompenses</h1>
        <div class="subtitle">À débloquer, déjà obtenu, et personnalisation de tes cosmétiques</div>
      </div>
    </div>
    <div class="view">
      <div class="chip-row" id="recompenses-onglets"></div>
      <div id="recompenses-contenu"></div>
    </div>
  `;

  const onglestEl = container.querySelector("#recompenses-onglets");
  const contenuEl = container.querySelector("#recompenses-contenu");

  let state = null;
  let collaborateursDistincts = 0;
  let ongletActif = "a-debloquer";
  // Équipements — même lecture unique au montage que js/views/gamification.js (préférences.js
  // n'a pas d'abonnement temps réel), tenue à jour localement à chaque clic "Équiper" ci-dessous.
  let equipements = { icone: null, theme: null, fond: null, ruban: null };
  preferencesApi.getPreferences().then((prefs) => {
    equipements = {
      icone: prefs.gamificationIconeEquipeeId || null,
      theme: prefs.gamificationThemeEquipeId || null,
      fond: prefs.gamificationFondEquipeId || null,
      ruban: prefs.gamificationRubanEquipeId || null,
    };
    render();
  });

  onglestEl.innerHTML = ONGLETS.map((o) => `<button type="button" class="chip" data-onglet="${o.id}">${o.label}</button>`).join("");
  onglestEl.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      ongletActif = chip.dataset.onglet;
      render();
    });
  });

  function render() {
    onglestEl.querySelectorAll(".chip").forEach((chip) => chip.classList.toggle("active", chip.dataset.onglet === ongletActif));

    if (!state) {
      contenuEl.innerHTML = `<div class="empty-state">Chargement...</div>`;
      return;
    }

    if (ongletActif === "a-debloquer") renderADebloquer();
    else if (ongletActif === "deja-obtenus") renderDejaObtenus();
    else renderPersonnalisation();
  }

  /**
   * Onglet 1 — "À débloquer" (§13.6) : le prochain niveau (même donnée que la carte Progression de
   * l'Accueil, `progressionNiveau()`), les 5 badges permanents les plus proches
   * (`prochainsBadgesPermanents`, `limite: 5`), et les déblocages associés à ces éléments (Table A
   * du prochain niveau, Table B/C des 5 badges), triés par proximité — même ordre que le badge/
   * niveau auquel chacun est rattaché.
   */
  function renderADebloquer() {
    const progression = gamificationApi.progressionNiveau(state.xpTotal);
    const pourcent = Math.max(0, Math.min(1, progression.progressionRatio)) * 100;
    const deblocagesProchainNiveau = gamificationApi.DEBLOCAGES.filter((d) => d.type === "niveau" && d.niveau === progression.niveau + 1);

    const prochainsBadges = gamificationApi.prochainsBadgesPermanents(state, collaborateursDistincts, 5);

    const lignesBadges = prochainsBadges
      .map(({ badge, valeurCourante }) => {
        const famille = gamificationApi.FAMILLES_BADGES.find((f) => f.id === badge.famille);
        const emoji = famille ? famille.emoji : "🏅";
        const deblocagesBadge = gamificationApi.DEBLOCAGES.filter((d) => d.badgeId === badge.id);
        const deblocagesHtml = deblocagesBadge.length
          ? `<div style="color: var(--color-text-muted); font-size: var(--font-size-xs);">
               Débloque aussi : ${deblocagesBadge.map((d) => escapeHtml(d.nom)).join(", ")}
             </div>`
          : "";
        return `
          <div class="progression-repartition-ligne">
            <div class="progression-repartition-tete">
              <span>${emoji} ${escapeHtml(badge.nom)}</span>
              <span>${valeurCourante} / ${badge.seuil}</span>
            </div>
            <div class="progression-bar-track"><div class="progression-bar-fill" style="width:${Math.min(100, (valeurCourante / badge.seuil) * 100)}%"></div></div>
            ${deblocagesHtml}
          </div>
        `;
      })
      .join("");

    contenuEl.innerHTML = `
      <div class="card">
        <div class="progression-repartition-tete">
          <strong>🚀 Prochain niveau : ${progression.niveau + 1}</strong>
          <span>${progression.xpDansNiveauCourant} / ${progression.xpPourNiveauSuivant} XP</span>
        </div>
        <div class="progression-bar-track"><div class="progression-bar-fill" style="width:${pourcent}%"></div></div>
        ${
          deblocagesProchainNiveau.length
            ? `<div style="color: var(--color-text-muted); font-size: var(--font-size-xs); margin-top: 4px;">
                 Débloquera : ${deblocagesProchainNiveau.map((d) => escapeHtml(d.nom)).join(", ")}
               </div>`
            : ""
        }
      </div>
      <div class="section-title">🏅 Badges les plus proches</div>
      ${lignesBadges || `<div class="empty-state">Aucun badge permanent restant à débloquer pour l'instant.</div>`}
    `;
  }

  /** Onglet 2 — "Déjà obtenus" (§13.6) : chronologie unique niveaux/badges/déblocages, la plus
   *  récente en tête (`chronologieRecompenses()`, voir son commentaire détaillé côté domaine pour
   *  l'approximation assumée des dates de niveau). */
  function renderDejaObtenus() {
    const chronologie = gamificationApi.chronologieRecompenses(state);
    if (!chronologie.length) {
      contenuEl.innerHTML = `<div class="empty-state"><span class="emoji">🎁</span>Rien d'obtenu pour l'instant — ça viendra !</div>`;
      return;
    }
    contenuEl.innerHTML = chronologie
      .map((entree) => {
        let emoji;
        let libelle;
        if (entree.type === "niveau") {
          emoji = "🎉";
          libelle = `Niveau ${entree.niveau} atteint`;
        } else if (entree.type === "badge") {
          const famille = gamificationApi.FAMILLES_BADGES.find((f) => f.id === entree.badge.famille);
          emoji = famille ? famille.emoji : "🏅";
          libelle = `Badge « ${escapeHtml(entree.badge.nom)} »`;
        } else {
          emoji = "🔓";
          libelle = `Déblocage « ${escapeHtml(entree.deblocage.nom)} »`;
        }
        return `
          <div class="notes-entry">
            <div>${emoji} ${libelle}</div>
            <div style="color: var(--color-text-muted); font-size: var(--font-size-xs);">${formatDate(entree.dateMs)}</div>
          </div>
        `;
      })
      .join("");
  }

  /**
   * Onglet 3 — "Personnalisation" (§13.6) : équiper Thème, Fond, Icône et Ruban — une seule
   * sélection active par catégorie (§6/§10 point 4), uniquement parmi les déblocages DÉJÀ ACQUIS
   * (les verrouillés se découvrent dans l'onglet "À débloquer" ci-dessus ou dans la Galerie).
   * Palette traitée à part, purement informative (voir le commentaire d'en-tête de ce fichier) :
   * jamais de sélection unique forcée sur une catégorie qui n'en a pas la notion.
   */
  function renderPersonnalisation() {
    const categoriesEquipables = ["theme", "fond", "icone", "ruban"];
    const blocsCategories = categoriesEquipables
      .map((categorieId) => {
        const acquis = gamificationApi.DEBLOCAGES.filter((d) => d.categorie === categorieId && state.deblocagesAcquis[d.id]);
        if (!acquis.length) {
          return `
            <div class="section-title">${CATEGORIE_LABELS[categorieId]}</div>
            <div class="empty-state">Aucun déblocage acquis pour l'instant dans cette catégorie.</div>
          `;
        }
        const lignes = acquis
          .map((deblocage) => {
            const equipe = equipements[categorieId] === deblocage.id;
            const emoji = categorieId === "icone" ? deblocage.valeur : categorieId === "ruban" ? `<span class="ruban-pastille" style="background:${deblocage.valeur}"></span>` : "";
            return `
              <div class="progression-mois-historique-ligne">
                <span class="progression-mois-historique-label">${emoji} ${escapeHtml(deblocage.nom)}</span>
                <button type="button" class="btn btn-secondary btn-sm" data-equiper="${deblocage.id}" data-categorie="${categorieId}">
                  ${equipe ? "✓ Équipé" : "Équiper"}
                </button>
              </div>
            `;
          })
          .join("");
        return `<div class="section-title">${CATEGORIE_LABELS[categorieId]}</div><div class="card">${lignes}</div>`;
      })
      .join("");

    const palettesAcquises = gamificationApi.DEBLOCAGES.filter((d) => d.categorie === "palette" && state.deblocagesAcquis[d.id]);

    contenuEl.innerHTML = `
      ${blocsCategories}
      <div class="section-title">🎨 Palette (post-it)</div>
      ${
        palettesAcquises.length
          ? `<div class="empty-state" style="text-align:left;">
               Couleurs débloquées disponibles sur tes post-it : ${palettesAcquises.map((d) => escapeHtml(d.nom)).join(", ")}.
               Chaque post-it garde sa propre couleur — pas de sélection unique pour cette catégorie.
             </div>`
          : `<div class="empty-state">Aucune couleur de post-it débloquée pour l'instant.</div>`
      }
    `;

    contenuEl.querySelectorAll("[data-equiper]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const deblocageId = btn.dataset.equiper;
        const categorieId = btn.dataset.categorie;
        const nouvelleValeur = equipements[categorieId] === deblocageId ? null : deblocageId;
        await SETTERS_EQUIPEMENT[categorieId](nouvelleValeur);
        equipements = { ...equipements, [categorieId]: nouvelleValeur };
        if (categorieId === "theme") {
          const deblocage = nouvelleValeur ? gamificationApi.DEBLOCAGES.find((d) => d.id === nouvelleValeur) : null;
          applyGamificationTheme(deblocage ? deblocage.valeur : null);
        }
        render();
      });
    });
  }

  const unsubGamification = gamificationApi.subscribe((newState) => {
    state = newState;
    render();
  });
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
