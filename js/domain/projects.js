// Projets (§36, §37) : objectif, critère de réussite, avancement calculé à partir des
// tâches liées. Le calcul réutilise exactement les statuts des tâches (§78.8) — pas de
// nomenclature parallèle, une seule source de vérité pour les statuts.

import * as storage from "../services/storage.js";
import { STATUSES } from "./tasks.js";

const COLLECTION = "projects";

export async function createProject(data) {
  const project = await storage.put(COLLECTION, {
    name: data.name,
    objective: data.objective || "",
    successCriteria: data.successCriteria || "",
    color: data.color || "#4C56C4",
    status: "active", // active | done | archived
  });
  await storage.logHistory("Project", project.id, "created", { name: project.name });
  return project;
}

export async function updateProject(id, patch) {
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Projet introuvable : " + id);
  const updated = await storage.put(COLLECTION, { ...current, ...patch });
  await storage.logHistory("Project", id, "updated", { patch });
  return updated;
}

export function getProject(id) {
  return storage.get(COLLECTION, id);
}

export function listAll() {
  return storage.listAll(COLLECTION);
}

export function subscribe(callback) {
  return storage.subscribe(COLLECTION, callback);
}

/**
 * Calcule l'avancement d'un projet à partir de ses tâches (§37). `tasks` doit déjà être
 * filtré sur le projet — cette fonction ne fait que compter, jamais d'accès storage, pour
 * rester utilisable aussi bien côté Dashboard que côté fiche projet.
 */
export function computeProgress(tasks) {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  let blocked = 0;
  for (const task of tasks) {
    if (counts[task.status] !== undefined) counts[task.status]++;
    if (task.isBlocked) blocked++;
  }
  const total = tasks.length;
  const percent = total ? Math.round((counts.done / total) * 100) : 0;
  return { total, percent, blocked, ...counts };
}
