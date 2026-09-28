// Application VISUELLE du Thème cosmétique équipé (TODO_GAMIFICATION.md §6/§10 point 4, Table A —
// "Thème Ardoise"/"Thème Nuit profonde") — ad hoc du 28/09/2026, suite directe de LOT G7 (qui
// avait attribué ces 2 déblocages sans les appliquer, faute d'infrastructure de thème nommé) et de
// LOT G8 (écran Progression, qui vient de livrer l'infrastructure d'affichage du reste des
// déblocages différés). Retour de Charles-Henri ("on fait"), deux points d'ambiguïté clarifiés
// par AskUserQuestion avant d'écrire ce fichier :
//  - **Portée** : un Thème recolore TOUTE l'app, pas seulement les écrans de gamification —
//    contrairement à Fond (écran Progression uniquement) et Ruban (carte "Prochain niveau"
//    uniquement, voir js/views/gamification.js), qui restent scopés à un seul endroit comme tous
//    les autres déblocages déjà appliqués (Palette, Icône).
//  - **Coexistence avec le mode clair/sombre** : un Thème se SUPERPOSE au mode clair/sombre
//    existant (js/services/themeStore.js) plutôt que de le remplacer — il ne recolore QUE
//    l'accent (`--color-primary`/`-dark`/`-light`, styles/tokens.css), jamais les surfaces, le
//    texte ni les couleurs sémantiques (succès/attention/danger, qui ne doivent jamais changer de
//    sens, §6 : "aucun avantage métier, uniquement des personnalisations visuelles"). D'où un
//    attribut SÉPARÉ (`data-gamification-theme`) plutôt que de détourner `data-theme` (réservé au
//    clair/sombre) — les deux réglages restent indépendants et combinables dans les deux sens
//    (ex. Nuit profonde + mode clair, ou Ardoise + mode sombre).
//
// Différence structurelle avec js/services/themeStore.js : le thème clair/sombre est un réglage
// LOCAL à l'appareil (localStorage, lu de façon SYNCHRONE dès <head> pour ne jamais flasher le
// mauvais thème). Le Thème cosmétique, lui, est une préférence de COMPTE (Firestore, comme le
// reste de la gamification, js/domain/preferences.js#gamificationThemeEquipeId) : il n'existe pas
// d'équivalent synchrone possible avant le premier rendu — le tout premier affichage après
// connexion peut donc brièvement montrer l'accent par défaut avant que ce module ne l'applique
// (appelé depuis js/app.js#mountApp, une fois les préférences chargées). Limitation déjà acceptée
// pour l'Icône équipée (LOT G7, même raisonnement), pas nouvelle à ce fichier.

const IDS_VALIDES = ["ardoise", "nuit-profonde"];

/**
 * Pose (ou retire) l'attribut `data-gamification-theme` sur `<html>` — le seul endroit qui touche
 * au DOM pour ce réglage, réutilisé à la fois par le montage initial de l'app (js/app.js) et par
 * l'écran qui permet de changer de Thème (js/views/gamification.js#renderGamificationGallery,
 * pour un retour visuel immédiat sans recharger l'app). Un id inconnu, `null` ou absent retire
 * simplement l'attribut — retombe sur l'accent par défaut de styles/tokens.css, jamais bloquant :
 * un Thème mal enregistré ne doit jamais casser l'affichage.
 */
export function applyGamificationTheme(themeId) {
  if (IDS_VALIDES.includes(themeId)) document.documentElement.dataset.gamificationTheme = themeId;
  else delete document.documentElement.dataset.gamificationTheme;
}
