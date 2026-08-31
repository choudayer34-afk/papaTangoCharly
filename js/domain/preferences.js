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
    seenHints: {},
    lastWeeklyReviewAt: null,
    ...current,
  };
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
