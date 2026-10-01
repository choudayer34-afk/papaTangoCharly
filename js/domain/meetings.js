// Réunions — §49. Version simplifiée pour l'instant : le strict nécessaire pour qu'une
// réunion capturée depuis l'Inbox (§12/§13) ne soit jamais perdue et reste retrouvable
// (rattachée à un projet si pertinent, sinon visible depuis "🧠 Récemment" au Dashboard —
// voir js/views/dashboard.js). Le déroulé complet Avant/Pendant/Après (objectif, sujets,
// notes, décisions, actions produites) viendra avec les canevas pilotés par données (§14-19,
// §78.9) plutôt que d'être codé en dur ici.

import * as storage from "../services/storage.js";
import { generateId } from "../services/id.js";
import { buildSteps } from "./templates.js";
import * as gamification from "./gamification.js";

const COLLECTION = "meetings";

/** Deux canevas possibles pour une réunion (§15 générique, §16 point collaborateur) —
 *  choisi à la création, "none" laisse la fiche sans canevas (ex. réunions déjà créées avant
 *  cette livraison). */
export const CANEVAS_OPTIONS = [
  { key: "none", label: "Aucun canevas" },
  { key: "meeting", label: "🗓️ Réunion (générique)" },
  { key: "one_on_one", label: "👀 Point collaborateur" },
];

export async function createMeeting(data) {
  const canevasKey = data.canevasKey && data.canevasKey !== "none" ? data.canevasKey : null;
  const meeting = await storage.put(COLLECTION, {
    title: data.title,
    date: data.date || null,
    objective: data.objective || "",
    notes: data.notes || "",
    participants: data.participants || [],
    projectId: data.projectId || null,
    canevasKey,
    steps: canevasKey ? buildSteps(canevasKey) : [],
    notesLog: [], // journal de notes horodaté, voir addNote() plus bas — distinct du champ `notes` (contexte libre non daté)
  });
  await storage.logHistory("Meeting", meeting.id, "created", { title: meeting.title });
  // Gamification (LOT G1, TODO_GAMIFICATION.md §3) : "Réunion créée", 5 XP, une seule fois par
  // Réunion — voir le commentaire détaillé de js/domain/tasks.js#updateTask pour le
  // raisonnement complet (système accessoire, jamais bloquant).
  gamification.recordMeetingCreated(meeting.id).catch((err) => console.error("[gamification] Échec du crédit XP (Réunion créée) :", err));
  return meeting;
}

/** Journal de notes horodaté (retour de Charles-Henri, 01/09/2026) — voir addNote() dans
 *  domain/tasks.js pour le principe complet (additif uniquement).
 *
 *  Converti le 29/09/2026 (TODO-037, même conversion que TODO-010 sur tasks.js/projects.js/
 *  followups.js) vers `storage.appendToArray()` : écriture ATOMIQUE ciblée sur `notesLog`, sans
 *  relire ni retransmettre le reste du document. Ne renvoie plus que la note ajoutée seule
 *  (jamais le tableau complet, qui n'est jamais relu ici) — à l'appelant de reconstruire sa
 *  propre copie locale, voir js/views/dashboard.js#openRecentDetail (même principe que
 *  js/views/kanban.js#openTaskDetail pour tasksApi.addNote). */
export async function addNote(id, text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  const note = { id: generateId(), text: trimmed, createdAt: Date.now() };
  await storage.appendToArray(COLLECTION, id, "notesLog", note);
  await storage.logHistory("Meeting", id, "note_added", { text: trimmed });
  return note;
}

// `updateNote`/`removeNote` (ajout du 28/09/2026, retour de Charles-Henri : "je dois pouvoir
// pour toutes les notes, les modifier si besoin") — la règle "additif seulement" documentée
// dans js/components/notesBlock.js est levée sur les 8 fiches qui partagent ce journal, celle-ci
// (la Réunion) comprise.
export async function updateNote(id, noteId, text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Réunion introuvable : " + id);
    return { notesLog: (current.notesLog || []).map((n) => (n.id === noteId ? { ...n, text: trimmed } : n)) };
  });
  return updated.notesLog;
}

export async function removeNote(id, noteId) {
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Réunion introuvable : " + id);
    return { notesLog: (current.notesLog || []).filter((n) => n.id !== noteId) };
  });
  return updated.notesLog;
}

/** Coche/décoche une étape du canevas — voir le même principe côté projects.js (jamais un
 *  remplacement complet du tableau). `doneAt` horodate la coche (affiché par
 *  js/components/canevas.js). */
export async function toggleStep(id, stepKey, done) {
  return storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Réunion introuvable : " + id);
    return { steps: (current.steps || []).map((s) => (s.key === stepKey ? { ...s, done, doneAt: done ? Date.now() : null } : s)) };
  });
}

export async function updateMeeting(id, patch) {
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Réunion introuvable : " + id);
    return patch;
  });
  await storage.logHistory("Meeting", id, "updated", { patch });
  return updated;
}

export function getMeeting(id) {
  return storage.get(COLLECTION, id);
}

export function listAll() {
  return storage.listAll(COLLECTION);
}

export function subscribe(callback) {
  return storage.subscribe(COLLECTION, callback);
}

export async function removeMeeting(id) {
  await storage.logHistory("Meeting", id, "deleted", {});
  return storage.remove(COLLECTION, id);
}
