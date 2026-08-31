// Objectifs d'une personne (§ préparation EADP, retour de Charles-Henri) : au-delà des
// engagements ponctuels (Suivi), une personne a des objectifs de campagne suivis dans le
// temps, à plusieurs reprises. Un Objectif porte ses points de suivi datés directement en
// tableau embarqué (`entries`) plutôt qu'une collection séparée — un seul objectif possède
// ses propres entrées, jamais partagées ni consultées indépendamment de lui, même principe
// que `steps` sur Projet/Réunion/Tâche.

import * as storage from "../services/storage.js";
import { generateId } from "../services/id.js";

const COLLECTION = "objectives";

export async function createObjective(data) {
  const objective = await storage.put(COLLECTION, {
    personId: data.personId,
    title: data.title,
    status: "active", // active | done
    entries: [],
  });
  await storage.logHistory("Objective", objective.id, "created", { title: objective.title });
  return objective;
}

export async function updateObjective(id, patch) {
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Objectif introuvable : " + id);
  const updated = await storage.put(COLLECTION, { ...current, ...patch });
  await storage.logHistory("Objective", id, "updated", { patch });
  return updated;
}

/** Ajoute un point de suivi daté sur l'objectif — jamais un remplacement du tableau complet
 *  (même principe que toggleStep sur les canevas). */
export async function addEntry(id, { date, note }) {
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Objectif introuvable : " + id);
  const entries = [...(current.entries || []), { id: generateId(), date: date || new Date().toISOString().slice(0, 10), note, createdAt: Date.now() }];
  const updated = await storage.put(COLLECTION, { ...current, entries });
  await storage.logHistory("Objective", id, "entry_added", { note });
  return updated;
}

export async function removeEntry(id, entryId) {
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Objectif introuvable : " + id);
  const entries = (current.entries || []).filter((e) => e.id !== entryId);
  return storage.put(COLLECTION, { ...current, entries });
}

export function listAll() {
  return storage.listAll(COLLECTION);
}

export function subscribe(callback) {
  return storage.subscribe(COLLECTION, callback);
}

export async function removeObjective(id) {
  await storage.logHistory("Objective", id, "deleted", {});
  return storage.remove(COLLECTION, id);
}
