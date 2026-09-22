// Catalogue des modules personnalisables + logique PURE de construction de la barre du bas
// (LOT 12, TODO-026 — US-026 du 21/09/2026, retour de Charles-Henri : "personnaliser sa barre de
// navigation en fonction de ses usages, tout en conservant une expérience cohérente entre le web
// et le mobile"). Centralisé ici pour que js/app.js (qui construit la vraie barre `.bottom-nav`)
// et js/views/dashboard.js (qui affiche l'écran "🧭 Personnaliser la navigation", ouvert depuis
// ⚙️ Personnaliser l'accueil — voir openNavCustomizationModal()) partagent la même source de
// vérité, sans que l'un importe l'autre : js/app.js importe déjà js/views/dashboard.js pour la
// route Accueil, un import dans l'autre sens créerait un cycle direct entre les deux modules,
// jamais nécessaire ici. La notification de changement ci-dessous (`subscribeNavChange`) suit le
// même principe d'écouteurs que js/services/onlineStatus.js, pour la même raison.
//
// "☰ Plus" n'est PAS un module de ce catalogue : conformément à la spec ("Plus reste toujours le
// 5e onglet", "Plus est permanent et ne peut pas être supprimé"), c'est un 5e emplacement FIXE
// ajouté après les 4 modules choisis, jamais une option qu'on pourrait glisser dans la barre
// principale ou en sortir.
//
// Projets/Calendrier/Priorisation ne figurent pas non plus dans ce catalogue : ce sont des
// sous-onglets à L'INTÉRIEUR de l'écran Pilotage (js/components/pilotageSubNav.js, vague 24/33),
// pas des destinations personnalisables indépendantes — la spec US-026 ne les mentionne
// d'ailleurs jamais. Ils restent rattachés au module "pilotage" via `extraActiveFor` ci-dessous,
// que ce module soit dans la barre principale ou dans Plus.
//
// "Mémoire & TDAH" est ici un seul module (clé "memory", une seule route #/memory), alors que
// l'exemple de la spec liste "Mémoire" et "TDAH" comme deux lignes distinctes : dans cette app,
// les deux ont toujours été un seul écran combiné (vague 24, TODO-020/LOT 9 déjà validé — voir
// js/views/more.js) ; les scinder en deux modules aurait supposé de créer un nouvel écran, ce qui
// dépasse le périmètre de ce lot. Adaptation signalée à Charles-Henri dans le bilan de LOT 12,
// pas revalidée séparément via une question bloquante (risque jugé faible : aucune route
// n'existe pour un "TDAH" indépendant de "Mémoire", donc aucune ambiguïté possible côté données).

export const MODULE_CATALOG = [
  { key: "home", hash: "#/dashboard", label: "Accueil", icon: "🏠" },
  { key: "inbox", hash: "#/inbox", label: "Inbox", icon: "📥" },
  { key: "pilotage", hash: "#/kanban", label: "Pilotage", icon: "📋", extraActiveFor: ["#/projects", "#/calendar", "#/priorisation"] },
  { key: "team", hash: "#/people", label: "Équipe", icon: "👥" },
  { key: "resources", hash: "#/resources", label: "Ressources", icon: "📎" },
  { key: "prompts", hash: "#/prompts", label: "Prompts", icon: "🤖" },
  { key: "guide", hash: "#/guide", label: "Guide", icon: "📖" },
  { key: "whatsnew", hash: "#/whatsnew", label: "Nouveautés", icon: "🆕" },
  { key: "memory", hash: "#/memory", label: "Mémoire & TDAH", icon: "🧠" },
];

// Critère d'acceptation explicite de la spec : "Restaurer remet : Accueil, Inbox, Pilotage,
// Équipe, Plus."
export const DEFAULT_NAV_MAIN = ["home", "inbox", "pilotage", "team"];

/** Valide un tableau de clés de catalogue pour la barre principale : exactement 4, connues, sans
 *  doublon — sinon on retombe silencieusement sur la configuration par défaut plutôt que
 *  d'afficher une barre à trous ou de planter (donnée corrompue, ancienne version du catalogue,
 *  document préférences modifié à la main). */
function isValidMain(mainKeys) {
  return (
    Array.isArray(mainKeys) &&
    mainKeys.length === 4 &&
    new Set(mainKeys).size === 4 &&
    mainKeys.every((k) => MODULE_CATALOG.some((m) => m.key === k))
  );
}

/**
 * Construit les items de la barre du bas (4 modules choisis + "☰ Plus" fixe en 5e position) à
 * partir des clés enregistrées en préférence (`navigationMain`, js/domain/preferences.js — un
 * tableau vide ou invalide signifie "pas de personnalisation", on applique alors
 * `DEFAULT_NAV_MAIN`). Fonction pure, sans DOM : js/app.js s'en sert pour construire la vraie
 * barre de navigation, ainsi que ses raccourcis clavier et le calcul de "quel onglet est actif".
 * Reproduit exactement, quand `mainKeys` est vide/absent, la table `NAV_ITEMS` codée en dur
 * avant ce lot (mêmes items, même ordre, mêmes `activeFor`).
 */
export function buildNavItems(mainKeys) {
  const main = isValidMain(mainKeys) ? mainKeys : DEFAULT_NAV_MAIN;
  const mainModules = main.map((k) => MODULE_CATALOG.find((m) => m.key === k));
  const plusModules = MODULE_CATALOG.filter((m) => !main.includes(m.key));
  const plusActiveFor = ["#/more", ...plusModules.flatMap((m) => [m.hash, ...(m.extraActiveFor || [])])];
  return [
    ...mainModules.map((m) => ({
      hash: m.hash,
      label: m.label,
      icon: m.icon,
      ...(m.extraActiveFor ? { activeFor: [m.hash, ...m.extraActiveFor] } : {}),
    })),
    { hash: "#/more", label: "Plus", icon: "☰", activeFor: plusActiveFor },
  ];
}

// Pub/sub minimal (même principe que js/services/onlineStatus.js#subscribeOnline) pour que
// js/views/dashboard.js puisse signaler "la personnalisation de la navigation vient de changer"
// sans jamais importer js/app.js — voir le commentaire d'en-tête de ce fichier.
const listeners = new Set();

/** Appelle `callback()` à chaque `notifyNavChanged()`. Retourne une fonction de désinscription. */
export function subscribeNavChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/** À appeler après `preferencesApi.setNavigationMain()` pour que js/app.js reconstruise sa barre
 *  du bas déjà montée, sans recharger toute l'application. */
export function notifyNavChanged() {
  for (const cb of listeners) cb();
}
