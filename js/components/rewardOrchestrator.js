// Orchestrateur des écrans de récompense — LOT G10, TODO_GAMIFICATION.md §13.2/§13.3/§13.4/§13.5,
// ajout du 28/09/2026 (retour de Charles-Henri "TODO-001 est validé et on fait la gamification
// §13/§14"). Monté UNE SEULE FOIS pour toute la session (js/app.js#mountApp), même principe que
// js/components/pomodoroWidget.js/pinnedNotesOverlay.js : un composant transversal, visible quel
// que soit l'écran ouvert, pas une vue avec sa propre route.
//
// S'abonne à js/domain/gamification.js#subscribeRewardEvents (voir son commentaire détaillé pour
// le mécanisme complet) et affiche les écrans reçus les uns après les autres, JAMAIS superposés
// (§13.2 : "les écrans s'affichent successivement, jamais superposés"), dans l'ordre déjà imposé
// par `diffRewardEvents()` — ce fichier ne retrie jamais la file reçue.
//
// §14 "La gamification ne doit jamais interrompre une action critique" : un écran de récompense
// n'apparaît jamais par-dessus une modale métier déjà ouverte (saisie en cours) — `tick()` attend
// qu'aucune modale ne soit ouverte (js/components/modal.js#isModalOpen, ajouté pour ce lot) avant
// d'en ouvrir une lui-même, en réessayant à intervalle régulier plutôt qu'une seule fois. Aucune
// des modales de récompense n'est elle-même bloquante pour la suite de l'app : dismissible (clic en
// dehors, Échap, bouton "Continuer") fait toujours avancer la file, jamais de piège.
import { openModal, isModalOpen } from "./modal.js";
import * as gamificationApi from "../domain/gamification.js";
import * as preferencesApi from "../domain/preferences.js";
import { applyGamificationTheme } from "../services/gamificationThemeStore.js";

const INTERVALLE_VERIFICATION_MS = 400;

const RARETE_LABELS = { bronze: "Bronze", argent: "Argent", or: "Or", platine: "Platine", legendaire: "Légendaire" };

// Un setter de préférence par catégorie équipable — même mapping que js/views/gamification.js
// (`SETTERS_EQUIPEMENT`), dupliqué ici plutôt que partagé : les deux fichiers n'ont par ailleurs
// aucune dépendance croisée, et TODO_TECHNIQUE.md/cette roadmap n'imposent pas de module utilitaire
// commun pour un mapping de 4 lignes.
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

/** Emoji de la famille d'un badge — même source que js/views/gamification.js (`FAMILLES_BADGES`,
 *  LOT G6), jamais une seconde table qui risquerait de diverger. */
function emojiFamille(familleId) {
  const famille = gamificationApi.FAMILLES_BADGES.find((f) => f.id === familleId);
  return famille ? famille.emoji : "🏅";
}

export function mountRewardOrchestrator() {
  let queue = [];
  let verificationTimer = null;
  let arretee = false;

  const unsubscribe = gamificationApi.subscribeRewardEvents((events) => {
    queue = [...queue, ...events];
    programmerVerification();
  });

  function programmerVerification() {
    if (verificationTimer || arretee) return;
    verificationTimer = setTimeout(verifier, INTERVALLE_VERIFICATION_MS);
  }

  function verifier() {
    verificationTimer = null;
    if (arretee || !queue.length) return;
    // §14 : jamais par-dessus une saisie en cours, ni pendant que l'onglet est masqué (un écran de
    // récompense qui s'affiche hors champ pendant que Charles-Henri regarde un autre onglet serait
    // manqué de toute façon — autant attendre qu'il revienne, l'unicité §13.2 garantit qu'il ne
    // sera jamais rejoué automatiquement, mais reste consultable dans le Centre de récompenses).
    if (isModalOpen() || document.hidden) {
      programmerVerification();
      return;
    }
    const evenement = queue.shift();
    afficherEcran(evenement, () => {
      if (queue.length) programmerVerification();
    });
  }

  function afficherEcran(evenement, onDone) {
    if (evenement.type === "niveau") return afficherEcranNiveau(evenement, onDone);
    if (evenement.type === "badge") return afficherEcranBadge(evenement, onDone);
    if (evenement.type === "deblocage") return afficherEcranDeblocage(evenement, onDone);
    onDone(); // type inconnu (ne devrait jamais arriver) — n'immobilise jamais la file
  }

  /** Bouton "Équiper maintenant" générique — Table A (niveau) comme Table B/C (déblocage),
   *  identique au bouton déjà en place dans la Galerie (js/views/gamification.js) : une seule
   *  primitive `preferencesApi.setGamificationXxxEquipee`, plus l'application immédiate du Thème
   *  (seul cosmétique dont la portée dépasse un écran, voir gamificationThemeStore.js). Absent
   *  pour la catégorie Palette (§13.4/§13.5, arbitrage LOT G7 : pas de notion d'équipement séparée
   *  pour cette catégorie) — l'appelant ne construit ce bouton que pour les autres catégories.
   */
  function attacherBoutonEquiper(container, deblocage) {
    const btn = container.querySelector("[data-action='equiper']");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      const setter = SETTERS_EQUIPEMENT[deblocage.categorie];
      await setter(deblocage.id);
      if (deblocage.categorie === "theme") applyGamificationTheme(deblocage.valeur);
      btn.textContent = "✓ Équipé";
    });
  }

  function afficherEcranNiveau(evenement, onDone) {
    const { niveau, progression, deblocagesTableA } = evenement;

    const body = document.createElement("div");
    body.className = "reward-screen reward-screen--niveau";
    let deblocageHtml = "";
    if (deblocagesTableA.length) {
      deblocageHtml = deblocagesTableA
        .map((deblocage) => {
          const estPalette = deblocage.categorie === "palette";
          const emoji = deblocage.categorie === "icone" ? deblocage.valeur : "🎁";
          return `
            <div class="reward-deblocage-bloc">
              <div>Tu débloques :</div>
              <div class="reward-deblocage-nom">${emoji} ${escapeHtml(deblocage.nom)}</div>
              ${
                estPalette
                  ? `<p class="reward-note">Nouvelle couleur disponible sur tes post-it.</p>`
                  : `<button type="button" class="btn btn-primary" data-action="equiper">Équiper maintenant</button>`
              }
            </div>
          `;
        })
        .join("");
    }

    body.innerHTML = `
      <div class="reward-titre">🎉 Niveau ${niveau} atteint</div>
      <div class="reward-palier">${escapeHtml(progression.palier)}</div>
      <div class="reward-xp-total">${progression.xpTotal} XP</div>
      ${deblocageHtml}
    `;

    openModal({
      title: "Niveau atteint",
      body,
      actions: [{ label: "Continuer", variant: "primary" }],
      onClose: onDone,
    });
    deblocagesTableA.forEach((deblocage) => {
      if (deblocage.categorie !== "palette") attacherBoutonEquiper(body, deblocage);
    });
  }

  function afficherEcranBadge(evenement, onDone) {
    const { badge, progression } = evenement;
    const pourcent = Math.max(0, Math.min(1, progression.progressionRatio)) * 100;
    const emoji = emojiFamille(badge.famille);

    const body = document.createElement("div");
    body.className = "reward-screen reward-screen--badge";
    body.innerHTML = `
      <div class="reward-titre">✨ Nouveau badge débloqué !</div>
      <div class="reward-illustration reward-illustration--${badge.rarete}" aria-hidden="true">${emoji}</div>
      <div class="reward-badge-nom">${escapeHtml(badge.nom)}</div>
      <div class="reward-badge-rarete">Rareté : ${RARETE_LABELS[badge.rarete] || badge.rarete}</div>
      <div class="reward-badge-condition">${escapeHtml(badge.condition)}</div>
      <div class="reward-xp-gagne">+${badge.xp} XP</div>
      <div class="progression-bar-track"><div class="progression-bar-fill" style="width:${pourcent}%"></div></div>
    `;

    openModal({
      title: "Badge débloqué",
      body,
      actions: [
        { label: "Continuer", variant: "primary" },
        { label: "Voir la galerie", variant: "ghost", onClick: () => { location.hash = "#/gamification-galerie"; } },
      ],
      onClose: onDone,
    });
  }

  function afficherEcranDeblocage(evenement, onDone) {
    const { deblocage } = evenement;
    const badgeDeclencheur = gamificationApi.BADGES.find((b) => b.id === deblocage.badgeId);
    const nomBadge = badgeDeclencheur ? badgeDeclencheur.nom : deblocage.badgeId;
    const contexte =
      deblocage.type === "niveauEtBadge"
        ? `Débloquée au niveau ${deblocage.niveau} grâce au badge « ${escapeHtml(nomBadge)} »`
        : `Débloquée grâce au badge « ${escapeHtml(nomBadge)} »`;
    const estPalette = deblocage.categorie === "palette"; // en pratique jamais atteint ici (Palette
    // n'a que des déblocages de Table A, jamais annoncés par cet écran — voir diffRewardEvents()) ;
    // conservé par cohérence avec le §13.5, qui documente explicitement cette exception.
    const emoji =
      deblocage.categorie === "icone"
        ? deblocage.valeur
        : deblocage.categorie === "ruban"
          ? `<span class="ruban-pastille" style="background:${deblocage.valeur}"></span>`
          : "🔓";

    const CATEGORIE_LABELS = { icone: "Icône", theme: "Thème", fond: "Fond", ruban: "Ruban", palette: "Palette" };

    const body = document.createElement("div");
    body.className = "reward-screen reward-screen--deblocage";
    body.innerHTML = `
      <div class="reward-titre">🔓 Nouveau déblocage</div>
      <div class="reward-illustration" aria-hidden="true">${emoji}</div>
      <div class="reward-badge-nom">${escapeHtml(deblocage.nom)}</div>
      <div class="reward-badge-condition">${CATEGORIE_LABELS[deblocage.categorie] || ""}</div>
      <p class="reward-note">${contexte}</p>
      ${!estPalette ? `<button type="button" class="btn btn-primary" data-action="equiper">Équiper</button>` : ""}
    `;

    openModal({
      title: "Déblocage cosmétique",
      body,
      actions: [{ label: "Continuer", variant: "primary" }],
      onClose: onDone,
    });
    if (!estPalette) attacherBoutonEquiper(body, deblocage);
  }

  return function cleanup() {
    arretee = true;
    clearTimeout(verificationTimer);
    unsubscribe();
    queue = [];
  };
}
