// Tâches — cahier des charges §20 à §25.
// Statuts centralisés et configurables (§78.8) : le Kanban traduit ces statuts en
// colonnes, le Dashboard les traduit autrement — une seule source de vérité.

import * as storage from "../services/storage.js";
import { generateId } from "../services/id.js";
import { buildSteps } from "./templates.js";

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
  // Canevas Communication (§18, §78.9) : activé volontairement (case à cocher à la création),
  // pas déduit automatiquement du type — "communication" n'est pas l'un des types d'exemple
  // du §21 et forcer la détection serait plus fragile qu'utile pour un cas encore rare.
  const useCommunicationCanevas = data.type === "communication";
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
    steps: useCommunicationCanevas ? buildSteps("communication") : [],
    completedAt: null,
    outlookMeetings: [], // référence manuelle (pas de vraie intégration Outlook, voir plus bas)
    notesLog: [], // journal de notes horodaté, voir addNote() plus bas
  });
  await storage.logHistory("Task", task.id, "created", { title: task.title });
  return task;
}

/**
 * Journal de notes horodaté (retour de Charles-Henri, 01/09/2026) — voir
 * js/components/notesBlock.js. Additif uniquement, jamais d'édition ni de suppression d'une
 * note existante. Renvoie le tableau à jour pour que le composant puisse se rafraîchir sans
 * recharger toute la tâche.
 */
export async function addNote(id, text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Tâche introuvable : " + id);
  const notesLog = [...(current.notesLog || []), { id: generateId(), text: trimmed, createdAt: Date.now() }];
  const updated = await storage.put(COLLECTION, { ...current, notesLog });
  await storage.logHistory("Task", id, "note_added", { text: trimmed });
  return updated.notesLog;
}

/** Coche/décoche une étape du canevas Communication — même principe que projects.js/meetings.js.
 *  `doneAt` horodate la coche (retour de Charles-Henri : voir à quel moment un point de la
 *  checklist a été traité), affiché par js/components/canevas.js à côté de l'étape cochée. */
export async function toggleStep(id, stepKey, done) {
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Tâche introuvable : " + id);
  const steps = (current.steps || []).map((s) => (s.key === stepKey ? { ...s, done, doneAt: done ? Date.now() : null } : s));
  return storage.put(COLLECTION, { ...current, steps });
}

/**
 * Association manuelle à une réunion Outlook (§ retour de Charles-Henri) — pas de vraie
 * intégration Microsoft Graph (authentification, synchro) : juste un titre + une date que
 * Charles-Henri note lui-même sur la tâche, visible dans les deux sens... mais uniquement
 * depuis la tâche, puisque l'app n'a aucun accès à Outlook lui-même. Un vrai aller-retour
 * avec Outlook serait un chantier à part (OAuth, permissions IT) — voir le doc de suivi.
 */
export async function addOutlookMeeting(id, { title, date }) {
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Tâche introuvable : " + id);
  const outlookMeetings = [...(current.outlookMeetings || []), { id: generateId(), title, date: date || null }];
  return storage.put(COLLECTION, { ...current, outlookMeetings });
}

export async function removeOutlookMeeting(id, outlookId) {
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Tâche introuvable : " + id);
  const outlookMeetings = (current.outlookMeetings || []).filter((m) => m.id !== outlookId);
  return storage.put(COLLECTION, { ...current, outlookMeetings });
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
