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

export async function updateTask(id, patch) {
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Tâche introuvable : " + id);
  const updated = await storage.put(COLLECTION, { ...current, ...patch });
  await storage.logHistory("Task", id, "updated", { patch });
  return updated;
}

export async function setStatus(id, status) {
  if (!STATUSES.includes(status)) throw new Error("Statut inconnu : " + status);
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Tâche introuvable : " + id);
  const patch = { status };
  if (status === "done" && !current.completedAt) patch.completedAt = Date.now();
  if (status !== "done") patch.completedAt = null;
  const updated = await storage.put(COLLECTION, { ...current, ...patch });
  await storage.logHistory("Task", id, "status_changed", { from: current.status, to: status });
  return updated;
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
