// Personnes — §31, §32. Collaborateurs suivis ou manager(s) avec qui on a des sujets.

import * as storage from "../services/storage.js";

const COLLECTION = "people";

export async function createPerson(data) {
  const person = await storage.put(COLLECTION, {
    name: data.name,
    role: data.role || "",
    team: data.team || "",
    type: data.type || "collaborateur", // collaborateur | manager
    notes: data.notes || "",
  });
  await storage.logHistory("Person", person.id, "created", { name: person.name });
  return person;
}

export async function updatePerson(id, patch) {
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Personne introuvable : " + id);
  const updated = await storage.put(COLLECTION, { ...current, ...patch });
  await storage.logHistory("Person", id, "updated", { patch });
  return updated;
}

export function getPerson(id) {
  return storage.get(COLLECTION, id);
}

export function listAll() {
  return storage.listAll(COLLECTION);
}

export function subscribe(callback) {
  return storage.subscribe(COLLECTION, callback);
}

/**
 * Supprime la personne. Ne supprime PAS en cascade ses suivis/décisions liés — mêmes
 * raisons que removeProject() dans projects.js : les entités liées gardent leur personId
 * dans le vide plutôt qu'un effet de bord risqué.
 */
export async function removePerson(id) {
  await storage.logHistory("Person", id, "deleted", {});
  return storage.remove(COLLECTION, id);
}
