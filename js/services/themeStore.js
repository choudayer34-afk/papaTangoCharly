// Thème clair/sombre — retour de Charles-Henri, 13/09/2026 : "avoir un mode dark sur l'appli
// en ayant un petit interrupteur sur l'écran d'accueil en haut à gauche qui bascule pour passer
// en mode dark ou en mode light, il faut qu'on comprenne facilement sur quel mode on bascule".
//
// Réglage d'affichage propre à l'appareil, jamais de la donnée métier — mêmes principes
// défensifs que js/services/pilotageViewStore.js/draftStore.js/pomodoroStore.js : localStorage,
// jamais bloquant si indisponible (navigation privée, quota dépassé), silencieusement no-op.
//
// Trois états possibles, même si l'interrupteur lui-même n'en présente que deux : "system"
// (par défaut, tant que rien n'a été choisi — suit le réglage clair/sombre de l'appareil via
// `prefers-color-scheme`, déjà câblé dans styles/tokens.css avant cette vague) ; "light" et
// "dark" (un choix explicite qui l'emporte toujours sur l'appareil, dans les deux sens, posé
// dès le premier geste sur l'interrupteur). Appliqué comme attribut `data-theme` sur <html> —
// jamais une classe, pour rester cohérent avec la convention CSS déjà utilisée dans les tokens.
//
// Lu de façon SYNCHRONE dès <head> (voir le petit script inline d'index.html, avant même le
// chargement de ce module) pour ne jamais laisser flasher le mauvais thème le temps que l'app
// démarre — ce module reste la seule source de vérité pour la lecture/écriture de la clé, le
// script inline ne fait que la rejouer une première fois au tout premier rendu.

const KEY = "pilotage-theme";

/** "system" (aucun choix explicite posé sur cet appareil), "light" ou "dark". */
export function getTheme() {
  try {
    const value = localStorage.getItem(KEY);
    return value === "dark" || value === "light" ? value : "system";
  } catch {
    return "system";
  }
}

/** Le thème réellement appliqué à l'écran en ce moment : le choix explicite s'il y en a un,
 *  sinon le réglage de l'appareil — c'est CETTE valeur que l'interrupteur doit refléter, pas
 *  `getTheme()` seule (qui vaudrait "system" en permanence pour qui n'a jamais touché au
 *  réglage, alors que l'écran est peut-être déjà sombre). */
export function getEffectiveTheme() {
  const theme = getTheme();
  if (theme !== "system") return theme;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Pose (ou retire) l'attribut data-theme sur <html> — le seul endroit qui touche au DOM pour
 *  ce réglage, réutilisé à la fois par setTheme() et par le montage initial de l'app. */
function applyTheme(theme) {
  if (theme === "dark" || theme === "light") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

/** Pose le réglage EXPLICITE ("light" ou "dark" — jamais "system" depuis l'interrupteur, qui
 *  ne propose que ces deux-là) et l'applique immédiatement. */
export function setTheme(theme) {
  const value = theme === "dark" ? "dark" : "light";
  try {
    localStorage.setItem(KEY, value);
  } catch {
    // silencieux — réglage d'affichage, jamais bloquant.
  }
  applyTheme(value);
  return value;
}

// Applique le réglage déjà enregistré au chargement de ce module (redondant avec le script
// inline d'index.html dans le cas normal, mais garantit que l'attribut reste correct même si ce
// module est importé après coup, ou si le script inline n'a pas pu s'exécuter pour une raison
// quelconque — jamais un thème qui dépend d'un seul chemin pour s'appliquer).
applyTheme(getTheme());
