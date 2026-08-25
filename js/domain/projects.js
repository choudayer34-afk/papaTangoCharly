// Projets — version minimale pour le socle P0 (§36, §37).
// Objectif, critère de réussite et calcul d'avancement viendront enrichir cette entité
// au fur et à mesure ; pour l'instant elle sert surtout à regrouper des tâches.

import * as storage from "../services/storage.js";

const COLLECTION = "projects";

export async function createProject(data) {
  const project = await storage.put(COLLECTION, {
    name: data.name,
    objective: data.objective || "",
    color: data.color || "#4C56C4",
    status: "active",
  });
  await storage.logHistory("Project", project.id, "created", { name: project.name });
  return project;
}

export function listAll() {
  return storage.listAll(COLLECTION);
}

export function subscribe(callback) {
  return storage.subscribe(COLLECTION, callback);
}
