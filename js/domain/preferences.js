// Préférences d'usage — un document unique à id fixe : pas encore de notion de "réglages
// multiples" qui justifierait une vraie collection, inutile de complexifier avant d'en avoir
// besoin.
//
// `categories` (nouveau) : registre des catégories de Projet (CSE, Modernisation, ...) créées
// à la volée par Charles-Henri, avec l'icône qui leur a été assignée automatiquement à la
// première utilisation — une seule source de vérité pour l'icône d'une catégorie, plutôt que
// de la dupliquer sur chaque Project (qui ne stocke que le nom de la catégorie).
//
// `projectSort` (nouveau) : mode d'affichage de l'onglet Projets (avancement / manuel),
// repris tel quel par le Dashboard pour que l'ordre des projets soit cohérent entre les deux
// écrans plutôt que chacun ayant sa propre logique.
//
// Pistes UX du 31/08/2026 (retour de Charles-Henri : "il y a tellement de chose que je ne
// sais plus comment les utiliser") :
//  - `casquette` : la casquette active (js/domain/casquettes.js) sur Accueil/Pilotage — "all"
//    par défaut, mémorisée pour que le filtre reste le même en revenant sur l'app.
//  - `dashboardHidden` : sections de l'Accueil repliées/masquées par choix (bouton ⚙️),
//    pour empêcher l'Accueil de s'allonger indéfiniment au fil des rounds.
//  - `seenHints` : bandeaux d'aide contextuelle déjà vus une fois (js/components/hint.js),
//    par clé — jamais réaffichés une fois fermés, comme la visite guidée.
//  - `lastWeeklyReviewAt` : horodatage de la dernière Revue hebdomadaire lancée, pour afficher
//    un rappel doux sur l'Accueil si le rythme de revue a été perdu (§ "il y a du retard
//    partout").
//
// Piste TDAH du 01/09/2026 (retour de Charles-Henri, voir claude/etat-avancement-pilotage.md) :
//  - `focusOverride` : les 3 tâches mises en avant aujourd'hui par la section "🎯 Focus du
//    jour" de l'Accueil (js/views/dashboard.js) sont proposées automatiquement (en retard
//    d'abord, puis échéance la plus proche), mais restent modifiables par Charles-Henri d'un
//    clic — `taskIds` ne vaut que pour `date` (au format YYYY-MM-DD) : dès le lendemain, la
//    sélection automatique reprend la main sans rien à réinitialiser explicitement.
//
// Deuxième discussion TDAH du 01/09/2026 (permanence/repérage — "je commence un truc mais ne
// le finis pas et ne sais plus où j'en suis ni comment retrouver mes éléments") :
//  - `recentlyViewed` : les dernières fiches *consultées* (pas créées), tous types confondus
//    (`{type, id, viewedAt}`, le plus récent en tête, plafonné à 3 — réduit de 6 à 3 le
//    02/09/2026 à la demande de Charles-Henri) — alimente "🔄 Reprendre où j'en étais" sur
//    l'Accueil. Volontairement pas de `title` mémorisé : résolu à l'affichage
//    via `resolveRef()` (comme le lien profond du .ics) pour ne jamais afficher un titre
//    devenu obsolète si la fiche a été renommée depuis.
//  - `notifOptIn` : `null` tant que Charles-Henri n'a pas répondu à la proposition d'alerte au
//    démarrage (voir le bandeau sur l'Accueil), `true`/`false` ensuite — jamais reproposé une
//    fois tranché.
//  - `lastNotifShownDate` : évite de répéter l'alerte plusieurs fois le même jour à chaque
//    ouverture de l'app (YYYY-MM-DD, même principe que `focusOverride.date`).
//
// "🎯 Mes objectifs" (retour de Charles-Henri, vague 21 : "j'aimerai aussi me noter mes
// objectifs qq part que ça soit ma ligne directrice") :
//  - `myObjectives` : un simple texte libre, volontairement PAS structuré comme les objectifs
//    par Personne (js/domain/objectives.js, qui suivent un collaborateur avec des points de
//    suivi datés) — ici il n'y a qu'une seule "ligne directrice" à relire, pas une progression
//    à tracer dans le temps. Accessible depuis l'Accueil (js/views/dashboard.js), comme le
//    reste des raccourcis de premier niveau.

// Raccourcis clavier personnalisés (retour de Charles-Henri, vague 20 : "je veux pouvoir
// affecter un raccourci moi-même... pour aller directement sur une personne ou un projet") :
//  - `customShortcuts` : `{ "ctrl+alt+<touche>": { type: "Person"|"Project", id, label } }`.
//    Cet espace de combinaisons (toujours Ctrl+Alt+une lettre ou un chiffre) n'entre jamais en
//    collision avec les raccourcis fixes de l'app (voir js/services/shortcuts.js#
//    BUILTIN_SHORTCUTS, aucun n'utilise Ctrl+Alt ensemble) ni avec ceux du navigateur.
//    Synchronisé comme le reste des préférences : un raccourci assigné suit Charles-Henri
//    d'un appareil à l'autre (au prochain chargement de l'app sur cet autre appareil).

import * as storage from "../services/storage.js";

const COLLECTION = "preferences";
const DOC_ID = "app";

// Cycle d'icônes assignées automatiquement aux nouvelles catégories, dans l'ordre de
// première apparition — pas de configuration manuelle nécessaire pour un usage aussi simple.
const CATEGORY_ICON_PALETTE = ["🏛️", "🚀", "💡", "🔧", "📊", "🌐", "🎯", "📢", "🧩", "🎨", "📚", "⚙️"];
export const DEFAULT_CATEGORY_ICON = "📁";

export async function getPreferences() {
  const current = await storage.get(COLLECTION, DOC_ID);
  return {
    id: DOC_ID,
    seenTour: false,
    categories: {},
    projectSort: "manual",
    casquette: "all",
    dashboardHidden: [],
    dashboardHiddenMigratedV19: false,
    seenHints: {},
    lastWeeklyReviewAt: null,
    focusOverride: { date: null, taskIds: [] },
    recentlyViewed: [],
    notifOptIn: null,
    lastNotifShownDate: null,
    customShortcuts: {},
    myObjectives: "",
    ...current,
  };
}

/** "🎯 Mes objectifs" (ligne directrice personnelle de Charles-Henri, vague 21) — un texte
 *  libre unique, toujours remplacé en entier, pas de journal ni de sous-structure. */
export async function setMyObjectives(text) {
  const current = await getPreferences();
  return storage.put(COLLECTION, { ...current, myObjectives: text || "" });
}

export async function markTourSeen() {
  const current = await getPreferences();
  return storage.put(COLLECTION, { ...current, id: DOC_ID, seenTour: true });
}

/**
 * Assigne (ou retrouve) l'icône d'une catégorie de projet. Idempotent : si la catégorie
 * existe déjà dans le registre, son icône ne change jamais — sinon chaque renommage de la
 * même catégorie recycler mentalement son icône changerait la lecture visuelle de tous les
 * projets qui la portent déjà.
 */
export async function registerCategory(name) {
  if (!name) return DEFAULT_CATEGORY_ICON;
  const current = await getPreferences();
  if (current.categories[name]) return current.categories[name];
  const icon = CATEGORY_ICON_PALETTE[Object.keys(current.categories).length % CATEGORY_ICON_PALETTE.length];
  await storage.put(COLLECTION, { ...current, categories: { ...current.categories, [name]: icon } });
  return icon;
}

export function categoryIcon(categories, name) {
  if (!name) return null;
  return (categories || {})[name] || DEFAULT_CATEGORY_ICON;
}

export async function setProjectSort(mode) {
  const current = await getPreferences();
  return storage.put(COLLECTION, { ...current, projectSort: mode });
}

/** Casquette active sur Accueil/Pilotage (js/domain/casquettes.js) — "all" = pas de filtre. */
export async function setCasquette(hatId) {
  const current = await getPreferences();
  return storage.put(COLLECTION, { ...current, casquette: hatId });
}

/** Sections de l'Accueil masquées par choix (bouton ⚙️ Personnaliser) — remplace toujours la
 *  liste complète plutôt que de l'accumuler, la case à cocher côté vue reflète déjà l'état
 *  cible souhaité. */
export async function setDashboardHidden(keys) {
  const current = await getPreferences();
  return storage.put(COLLECTION, { ...current, dashboardHidden: keys });
}

/**
 * Bascule one-shot (audit de simplification du 02/09/2026, retour de Charles-Henri : "on fait
 * l'ensemble des modifications suggérées") — force le nouveau profil "épuré" de l'Accueil
 * (voir js/views/dashboard.js) la toute première fois que ce round tourne, plutôt que de
 * laisser la nouvelle valeur par défaut sans effet tant que Charles-Henri ne rouvre pas lui-même
 * les réglages. Ne se redéclenche jamais ensuite : une fois ce drapeau posé, toute
 * personnalisation faite après (y compris "tout réafficher") est respectée.
 */
export async function markDashboardHiddenMigratedV19() {
  const current = await getPreferences();
  return storage.put(COLLECTION, { ...current, dashboardHiddenMigratedV19: true });
}

/** Marque un bandeau d'aide contextuelle (js/components/hint.js) comme déjà vu — ne
 *  réapparaît plus jamais ensuite pour cette clé. */
export async function markHintSeen(key) {
  const current = await getPreferences();
  return storage.put(COLLECTION, { ...current, seenHints: { ...current.seenHints, [key]: true } });
}

/** Horodate le lancement de la Revue hebdomadaire (js/components/weeklyReview.js) — sert
 *  uniquement au rappel de rythme sur l'Accueil, pas à une vraie notion de "session terminée". */
export async function markWeeklyReviewDone() {
  const current = await getPreferences();
  return storage.put(COLLECTION, { ...current, lastWeeklyReviewAt: Date.now() });
}

/** Sélection manuelle du "🎯 Focus du jour" (js/views/dashboard.js) — remplace toujours
 *  l'override du jour en cours plutôt que de l'accumuler ; `date` (YYYY-MM-DD) est ce qui
 *  rend l'override caduc tout seul le lendemain, sans action explicite de remise à zéro. */
export async function setFocusOverride(date, taskIds) {
  const current = await getPreferences();
  return storage.put(COLLECTION, { ...current, focusOverride: { date, taskIds } });
}

const RECENTLY_VIEWED_MAX = 3;

/** Enregistre l'ouverture d'une fiche pour "🔄 Reprendre où j'en étais" (js/views/
 *  dashboard.js) — déplace l'entrée en tête si elle existe déjà plutôt que de la dupliquer,
 *  plafonné à `RECENTLY_VIEWED_MAX`. Appelé depuis chaque fonction "ouvrir le détail de..."
 *  des 7 types de fiches consultables (Tâche, Suivi, Projet, Personne, Ressource, Réunion,
 *  Décision, Information/Idée). */
export async function recordRecentlyViewed(type, id) {
  const current = await getPreferences();
  const withoutThis = (current.recentlyViewed || []).filter((e) => !(e.type === type && e.id === id));
  const recentlyViewed = [{ type, id, viewedAt: Date.now() }, ...withoutThis].slice(0, RECENTLY_VIEWED_MAX);
  return storage.put(COLLECTION, { ...current, recentlyViewed });
}

/** Réponse (une seule fois) à la proposition d'alerte au démarrage — voir le bandeau sur
 *  l'Accueil. `true`/`false`, jamais re-proposé une fois tranché. */
export async function setNotifOptIn(value) {
  const current = await getPreferences();
  return storage.put(COLLECTION, { ...current, notifOptIn: value });
}

/** Marque l'alerte de démarrage comme déjà montrée aujourd'hui (YYYY-MM-DD) — évite de la
 *  répéter à chaque ouverture de l'app dans la même journée. */
export async function markNotifShown(dateKey) {
  const current = await getPreferences();
  return storage.put(COLLECTION, { ...current, lastNotifShownDate: dateKey });
}

/**
 * Assigne un raccourci Ctrl+Alt+<touche> à une Personne ou un Projet (retour de Charles-Henri,
 * vague 20). Une même fiche ne garde jamais deux raccourcis à la fois : réassigner une fiche
 * déjà raccourcie retire d'abord son ancienne combinaison plutôt que d'en accumuler deux —
 * cohérent avec "un raccourci, une destination" tel qu'on le connaît dans d'autres apps.
 */
export async function setCustomShortcut(combo, target) {
  const current = await getPreferences();
  const customShortcuts = { ...current.customShortcuts };
  for (const [key, value] of Object.entries(customShortcuts)) {
    if (value.type === target.type && value.id === target.id) delete customShortcuts[key];
  }
  customShortcuts[combo] = target;
  return storage.put(COLLECTION, { ...current, customShortcuts });
}

/** Retire un raccourci personnalisé (bouton "Retirer" sur la fiche qui le porte). */
export async function removeCustomShortcut(combo) {
  const current = await getPreferences();
  const customShortcuts = { ...current.customShortcuts };
  delete customShortcuts[combo];
  return storage.put(COLLECTION, { ...current, customShortcuts });
}

/** Retrouve le raccourci déjà assigné à une fiche donnée (pour l'afficher dessus), ou `null`. */
export function findShortcutForTarget(customShortcuts, type, id) {
  const entry = Object.entries(customShortcuts || {}).find(([, v]) => v.type === type && v.id === id);
  return entry ? entry[0] : null;
}
