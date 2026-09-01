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

// Retour de Charles-Henri, 02/09/2026 : afficher le statut sur "🗓️ À échéance dans les 7
// jours" et "🎯 Focus du jour" (Dashboard) — un badge icône + libellé plutôt que le seul
// libellé texte déjà utilisé ailleurs (ex. le Kanban), pour rester repérable au coup d'œil
// dans une liste qui mélange plusieurs tâches.
export const STATUS_ICONS = {
  todo: "⚪",
  in_progress: "🔵",
  waiting: "⏳",
  follow_up: "👀",
  done: "🟢",
};

// Légende ⓘ (audit de simplification du 02/09/2026) : le statut d'une Tâche et celui d'un Suivi
// (js/domain/followups.js) partagent tous les deux une valeur "en attente" avec la même icône
// ⏳ mais un sens différent — ce texte lève l'ambiguïté sur Pilotage, où seul le vocabulaire
// Tâche est visible.
export const STATUS_INFO_HTML =
  "Statut d'une <strong>Tâche</strong> : ⚪ À faire · 🔵 En cours · ⏳ En attente (bloquée par quelqu'un ou quelque chose d'extérieur) · 👀 À suivre (à relancer) · 🟢 Terminé. Différent du statut d'un Suivi (onglet Équipe), qui utilise aussi ⏳ mais avec un sens propre.";

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
    checklist: [], // sous-étapes courtes libres, voir addChecklistItem() plus bas
    waitingOn: "", // "⏳ En attente de..." — voir setWaitingNote() plus bas
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

/**
 * Sous-étapes courtes libres (retour de Charles-Henri, 01/09/2026 — piste TDAH : découper une
 * tâche en petits pas concrets et cochables, distinct du canevas Communication à cases fixes
 * ci-dessous). Volontairement sans historique dédié : une checklist personnelle se coche
 * plusieurs fois par jour, journaliser chaque case ferait du bruit dans le fil d'audit sans
 * rien apporter — même choix que toggleStep().
 */
export async function addChecklistItem(id, text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Tâche introuvable : " + id);
  const checklist = [...(current.checklist || []), { id: generateId(), text: trimmed, done: false }];
  const updated = await storage.put(COLLECTION, { ...current, checklist });
  return updated.checklist;
}

export async function toggleChecklistItem(id, itemId, done) {
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Tâche introuvable : " + id);
  const checklist = (current.checklist || []).map((c) => (c.id === itemId ? { ...c, done } : c));
  const updated = await storage.put(COLLECTION, { ...current, checklist });
  return updated.checklist;
}

export async function removeChecklistItem(id, itemId) {
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Tâche introuvable : " + id);
  const checklist = (current.checklist || []).filter((c) => c.id !== itemId);
  const updated = await storage.put(COLLECTION, { ...current, checklist });
  return updated.checklist;
}

/**
 * "⏳ En attente de..." (retour de Charles-Henri, 02/09/2026) : une information libre affichée
 * bien en évidence sur la carte Kanban tant qu'une Tâche est "En attente"/"À suivre" — ce
 * qu'on attend, et de qui. S'efface automatiquement dès que la tâche change de statut (voir
 * `updateTask` ci-dessous), pour ne jamais laisser un texte périmé sur une tâche qui a avancé
 * depuis. Volontairement sans historique dédié, même principe que la checklist ci-dessus —
 * une information qu'on ajuste au fil de l'eau, pas un événement à journaliser.
 */
export async function setWaitingNote(id, text) {
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Tâche introuvable : " + id);
  return storage.put(COLLECTION, { ...current, waitingOn: (text || "").trim() });
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
const WAITING_NOTE_STATUSES = ["waiting", "follow_up"];

export async function updateTask(id, patch) {
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Tâche introuvable : " + id);

  const finalPatch = { ...patch };
  if (patch.status && patch.status !== current.status) {
    finalPatch.completedAt = patch.status === "done" ? Date.now() : null;
    // "⏳ En attente de..." ne vaut que pendant En attente/À suivre — effacé automatiquement
    // dès qu'on en sort, sauf si ce même appel fixe volontairement une nouvelle valeur.
    if (!WAITING_NOTE_STATUSES.includes(patch.status) && !("waitingOn" in patch)) {
      finalPatch.waitingOn = "";
    }
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

// "En pause" (piste TDAH du 01/09/2026, discussion permanence/repérage) : une tâche
// commencée (donc pas "todo") mais pas retouchée depuis un moment, distincte du retard (qui
// dépend d'une échéance — beaucoup de tâches abandonnées n'en ont pas). `updatedAt` est déjà
// posé par storage.put() à CHAQUE mutation (statut, note, sous-étape, édition...), donc aucun
// nouveau champ à ajouter : "dernière touche" existe déjà de fait, il suffisait de la lire.
const STALLED_ACTIVE_STATUSES = ["in_progress", "waiting", "follow_up"];
const STALLED_THRESHOLD_MS = 5 * 24 * 60 * 60 * 1000; // 5 jours

export function isStalled(task) {
  if (!STALLED_ACTIVE_STATUSES.includes(task.status)) return false;
  const lastTouch = task.updatedAt || task.createdAt || 0;
  return Date.now() - lastTouch > STALLED_THRESHOLD_MS;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
