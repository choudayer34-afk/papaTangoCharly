// Préférences d'usage — pour l'instant uniquement l'état de la visite guidée. Un document
// unique à id fixe : pas encore de notion de "réglages multiples" qui justifierait une
// vraie collection, inutile de complexifier avant d'en avoir besoin.

import * as storage from "../services/storage.js";

const COLLECTION = "preferences";
const DOC_ID = "app";

export async function getPreferences() {
  const current = await storage.get(COLLECTION, DOC_ID);
  return current || { id: DOC_ID, seenTour: false };
}

export async function markTourSeen() {
  const current = await getPreferences();
  return storage.put(COLLECTION, { ...current, id: DOC_ID, seenTour: true });
}
