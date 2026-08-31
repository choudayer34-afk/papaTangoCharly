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

import * as storage from "../services/storage.js";

const COLLECTION = "preferences";
const DOC_ID = "app";

// Cycle d'icônes assignées automatiquement aux nouvelles catégories, dans l'ordre de
// première apparition — pas de configuration manuelle nécessaire pour un usage aussi simple.
const CATEGORY_ICON_PALETTE = ["🏛️", "🚀", "💡", "🔧", "📊", "🌐", "🎯", "📢", "🧩", "🎨", "📚", "⚙️"];
export const DEFAULT_CATEGORY_ICON = "📁";

export async function getPreferences() {
  const current = await storage.get(COLLECTION, DOC_ID);
  return { id: DOC_ID, seenTour: false, categories: {}, projectSort: "manual", ...current };
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
