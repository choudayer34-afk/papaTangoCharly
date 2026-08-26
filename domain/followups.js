// Suivis — §29. "Quelqu'un doit faire quelque chose et je dois vérifier."
// Distinct d'une tâche : le champ qui compte n'est pas "qui fait", mais "quand est-ce que
// MOI je dois contrôler / relancer" (controlDate) — c'est ce qui alimente §33 (point
// collaborateur automatique) et les automatisations "suivi à faire" (§28).

import * as storage from "../services/storage.js";
import { STATUSES, STATUS_LABELS } from "./tasks.js";

const COLLECTION = "followUps";

export { STATUSES, STATUS_LABELS };

export async function createFollowUp(data) {
  const followUp = await storage.put(COLLECTION, {
    title: data.title, // l'engagement pris par la personne
    personId: data.personId,
    expectedResult: data.expectedResult || "",
    dueDate: data.dueDate || null, // échéance de la personne
    controlDate: data.controlDate || data.dueDate || null, // quand JE dois vérifier
    status: data.status || "waiting",
    successCriteria: data.successCriteria || "",
    projectId: data.projectId || null,
  });
  await storage.logHistory("FollowUp", followUp.id, "created", { title: followUp.title });
  return followUp;
}

export async function updateFollowUp(id, patch) {
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Suivi introuvable : " + id);
  const updated = await storage.put(COLLECTION, { ...current, ...patch });
  await storage.logHistory("FollowUp", id, "updated", { patch });
  return updated;
}

export async function setStatus(id, status) {
  return updateFollowUp(id, { status });
}

export function listAll() {
  return storage.listAll(COLLECTION);
}

export function subscribe(callback) {
  return storage.subscribe(COLLECTION, callback);
}

export async function removeFollowUp(id) {
  await storage.logHistory("FollowUp", id, "deleted", {});
  return storage.remove(COLLECTION, id);
}

export function isControlDue(followUp) {
  if (!followUp.controlDate || followUp.status === "done") return false;
  return new Date(followUp.controlDate).getTime() < startOfToday();
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
