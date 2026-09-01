// Décisions — §48. Objet dédié pour ne jamais perdre "on avait décidé quoi sur ce sujet ?"
// (§46). Comme pour meetings.js, version simplifiée pour l'instant : rattachement à un
// projet et/ou une réunion en option, visible via la fiche projet si rattachée, sinon via
// "🧠 Récemment" au Dashboard tant que la recherche globale (§45/§52) n'existe pas encore.

import * as storage from "../services/storage.js";
import { generateId } from "../services/id.js";

const COLLECTION = "decisions";

export async function createDecision(data) {
  const decision = await storage.put(COLLECTION, {
    title: data.title, // le sujet de la décision
    decision: data.decision, // ce qui a été décidé
    context: data.context || "",
    date: data.date || null,
    projectId: data.projectId || null,
    meetingId: data.meetingId || null,
    peopleIds: data.peopleIds || [],
    notesLog: [], // journal de notes horodaté, voir addNote() plus bas
  });
  await storage.logHistory("Decision", decision.id, "created", { title: decision.title });
  return decision;
}

/** Journal de notes horodaté (retour de Charles-Henri, 01/09/2026) — voir addNote() dans
 *  domain/tasks.js pour le principe complet (additif uniquement). */
export async function addNote(id, text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Décision introuvable : " + id);
  const notesLog = [...(current.notesLog || []), { id: generateId(), text: trimmed, createdAt: Date.now() }];
  const updated = await storage.put(COLLECTION, { ...current, notesLog });
  await storage.logHistory("Decision", id, "note_added", { text: trimmed });
  return updated.notesLog;
}

export async function updateDecision(id, patch) {
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Décision introuvable : " + id);
  const updated = await storage.put(COLLECTION, { ...current, ...patch });
  await storage.logHistory("Decision", id, "updated", { patch });
  return updated;
}

export function getDecision(id) {
  return storage.get(COLLECTION, id);
}

export function listAll() {
  return storage.listAll(COLLECTION);
}

export function subscribe(callback) {
  return storage.subscribe(COLLECTION, callback);
}

export async function removeDecision(id) {
  await storage.logHistory("Decision", id, "deleted", {});
  return storage.remove(COLLECTION, id);
}
