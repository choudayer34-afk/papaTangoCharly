// Tâches — cahier des charges §20 à §25.
// Statuts centralisés et configurables (§78.8) : le Kanban traduit ces statuts en
// colonnes, le Dashboard les traduit autrement — une seule source de vérité.

import * as storage from "../services/storage.js";

const COLLECTION = "tasks";

export const STATUSES = ["todo", "in_progress", "waiting", "follow_up", "done"];

export const STATUS_LABELS = {
  todo: "À faire",
  in_progress: "En cours",
  waiting: "En attente",
  follow_up: "À suivre",
  done: "Terminé",
};

export async function createTask(data) {
  const task = await storage.put(COLLECTION, {
    title: data.title,
    description: data.description || "",
    type: data.type || "action",
    status: data.status || "todo",
    priority: data.priority || "normale",
    dueDate: data.dueDate || null,
    projectId: data.projectId || null,
    parentTaskId: data.parentTaskId || null,
    successCriteria: data.successCriteria || "",
    isBlocked: false,
    sourceInboxItemId: data.sourceInboxItemId || null,
    completedAt: null,
  });
  await storage.logHistory("Task", task.id, "created", { title: task.title });
  return task;
}

export function listAll() {
  return storage.listAll(COLLECTION);
}

export function subscribe(callback) {
  return storage.subscribe(COLLECTION, callback);
}

/**
 * Met à jour une tâche. Si `patch.status` est présent, `completedAt` est géré
 * automatiquement (posé quand on passe à "done", effacé sinon) — quel que soit le
 * chemin par lequel le statut change (Kanban, fiche détail, etc.), pas seulement
 * setStatus(). Une seule règle, un seul endroit.
 */
export async function updateTask(id, patch) {
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Tâche introuvable : " + id);

  const finalPatch = { ...patch };
  if (patch.status && patch.status !== current.status) {
    finalPatch.completedAt = patch.status === "done" ? Date.now() : null;
  }

  const updated = await storage.put(COLLECTION, { ...current, ...finalPatch });
  if (patch.status && patch.status !== current.status) {
    await storage.logHistory("Task", id, "status_changed", { from: current.status, to: patch.status });
  } else {
    await storage.logHistory("Task", id, "updated", { patch });
  }
  return updated;
}

export async function setStatus(id, status) {
  if (!STATUSES.includes(status)) throw new Error("Statut inconnu : " + status);
  return updateTask(id, { status });
}

/**
 * Supprime la tâche. L'historique déjà journalisé n'est pas purgé (le fil global reste un
 * vrai journal d'audit) — il disparaît simplement des vues agrégées (fiche projet) qui ne
 * regardent que les tâches encore existantes.
 */
export async function removeTask(id) {
  await storage.logHistory("Task", id, "deleted", {});
  return storage.remove(COLLECTION, id);
}

export function isLate(task) {
  if (!task.dueDate || task.status === "done") return false;
  return new Date(task.dueDate).getTime() < startOfToday();
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
