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
    // `personId` optionnel depuis le 13/09/2026 (retour de Charles-Henri : "comment je suis
    // l'avancement de mes propres objectifs" → même mécanique que pour un collaborateur, mais
    // pour soi-même) — `null` désigne un objectif personnel plutôt qu'un objectif de campagne
    // rattaché à une Personne (voir js/views/dashboard.js#openMyObjectivesModal, qui liste
    // justement les objectifs SANS personId).
    personId: data.personId || null,
    title: data.title,
    status: "active", // active | done
    entries: [],
    // Retour de Charles-Henri, 13/09/2026 : "tout élément doit être rattachable à un projet" —
    // Objectif était, avec les Informations/Idées de l'Inbox, le seul type sans aucun moyen de
    // se rattacher à un projet (Tâche/Suivi/Réunion/Décision ont un champ direct ; Ressource se
    // lie a posteriori via `projectIds` + `linkToProject()`). Optionnel, comme partout ailleurs.
    projectId: data.projectId || null,
  });
  await storage.logHistory("Objective", objective.id, "created", { title: objective.title });
  return objective;
}

export async function updateObjective(id, patch) {
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Objectif introuvable : " + id);
    return patch;
  });
  await storage.logHistory("Objective", id, "updated", { patch });
  return updated;
}

/** Ajoute un point de suivi daté sur l'objectif — jamais un remplacement du tableau complet
 *  (même principe que toggleStep sur les canevas). */
export async function addEntry(id, { date, note }) {
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Objectif introuvable : " + id);
    return { entries: [...(current.entries || []), { id: generateId(), date: date || new Date().toISOString().slice(0, 10), note, createdAt: Date.now() }] };
  });
  await storage.logHistory("Objective", id, "entry_added", { note });
  return updated;
}

export async function removeEntry(id, entryId) {
  return storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Objectif introuvable : " + id);
    return { entries: (current.entries || []).filter((e) => e.id !== entryId) };
  });
}

export function listAll() {
  return storage.listAll(COLLECTION);
}

export function subscribe(callback) {
  return storage.subscribe(COLLECTION, callback);
}

// Ajouté le 21/09/2026 (TODO-009A, LOT 4A) : lire UN Objectif par son id, pour
// js/components/linkedItems.js#resolveRef — même besoin que tasksApi.getTask(), voir son
// commentaire.
export function getObjective(id) {
  return storage.get(COLLECTION, id);
}

export async function removeObjective(id) {
  await storage.logHistory("Objective", id, "deleted", {});
  return storage.remove(COLLECTION, id);
}
