// Liens entre fiches — le "fil conducteur" que Charles-Henri a signalé manquer : les
// éléments (Tâche, Projet, Personne, Suivi, Ressource, Réunion, Décision) semblaient
// toujours séparés les uns des autres, même quand ils venaient clairement du même sujet
// ("créer à la volée la tâche pour moi, capturer le point collaborateur en réunion, etc.").
//
// Un lien est une arête entre deux entités, de types éventuellement différents (ex. une
// Réunion liée à la Décision qui en est sortie, un Suivi lié à la Tâche que sa relance a
// produite). Collection dédiée plutôt que des tableaux embarqués dans chaque entité — même
// principe que history.js : le StorageAdapter ne garantit aucune transaction
// multi-documents, donc deux tableaux à synchroniser des deux côtés d'un lien pourraient
// diverger si une des deux écritures échoue.

import * as storage from "../services/storage.js";

const COLLECTION = "links";

/**
 * Crée un lien entre deux fiches. a et b : { type, id, label } — label est le titre/nom au
 * moment de la création du lien, gardé pour un affichage lisible dans l'historique même si
 * l'autre fiche est ensuite renommée ou supprimée.
 */
export async function createLink(a, b) {
  const link = await storage.put(COLLECTION, { a, b });
  await storage.logHistory(a.type, a.id, "linked", { to: b });
  await storage.logHistory(b.type, b.id, "linked", { to: a });
  return link;
}

/** Supprime un lien. Prend le lien complet (pas juste son id) pour pouvoir journaliser des
 *  deux côtés dans l'historique. */
export async function removeLink(link) {
  await storage.remove(COLLECTION, link.id);
  await storage.logHistory(link.a.type, link.a.id, "unlinked", { from: link.b });
  await storage.logHistory(link.b.type, link.b.id, "unlinked", { from: link.a });
}

export function listAll() {
  return storage.listAll(COLLECTION);
}

export function subscribe(callback) {
  return storage.subscribe(COLLECTION, callback);
}

/** Tous les liens touchant une entité donnée, avec le lien complet et l'"autre bout". */
export function linksFor(allLinks, type, id) {
  const out = [];
  for (const link of allLinks) {
    if (link.a.type === type && link.a.id === id) out.push({ link, other: link.b });
    else if (link.b.type === type && link.b.id === id) out.push({ link, other: link.a });
  }
  return out;
}
