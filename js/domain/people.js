// Personnes — §31, §32. Collaborateurs suivis ou manager(s) avec qui on a des sujets.

import * as storage from "../services/storage.js";
import { generateId } from "../services/id.js";

const COLLECTION = "people";

export async function createPerson(data) {
  const person = await storage.put(COLLECTION, {
    name: data.name,
    role: data.role || "",
    team: data.team || "",
    type: data.type || "collaborateur", // collaborateur | manager
    notes: data.notes || "",
    notesLog: [], // journal de notes horodaté, voir addNote() plus bas — distinct de `notes` (contexte libre non daté)
  });
  await storage.logHistory("Person", person.id, "created", { name: person.name });
  return person;
}

/** Journal de notes horodaté (retour de Charles-Henri, 01/09/2026) — voir addNote() dans
 *  domain/tasks.js pour le principe complet (additif uniquement). */
export async function addNote(id, text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Personne introuvable : " + id);
  const notesLog = [...(current.notesLog || []), { id: generateId(), text: trimmed, createdAt: Date.now() }];
  const updated = await storage.put(COLLECTION, { ...current, notesLog });
  await storage.logHistory("Person", id, "note_added", { text: trimmed });
  return updated.notesLog;
}

/**
 * Migration one-shot (vague 19, audit de simplification demandé par Charles-Henri) : le champ
 * "Notes" simple et le "Journal de notes" horodaté cohabitaient sans raison claire sur cette
 * fiche — seul endroit de l'app avec ce doublon (voir createPerson ci-dessus). Le texte déjà
 * écrit dans "Notes" devient la première entrée du Journal, puis le champ simple est vidé —
 * rien n'est perdu. Idempotente : ne fait rien si `notes` est déjà vide (donc sans effet une
 * fois la migration faite, ou sur une personne créée après ce round).
 */
export async function migrateLegacyNotes(id) {
  const current = await storage.get(COLLECTION, id);
  if (!current || !(current.notes || "").trim()) return current;
  const text = current.notes.trim();
  const notesLog = [...(current.notesLog || []), { id: generateId(), text, createdAt: current.createdAt || Date.now() }];
  const updated = await storage.put(COLLECTION, { ...current, notes: "", notesLog });
  await storage.logHistory("Person", id, "note_added", { text });
  return updated;
}

export async function updatePerson(id, patch) {
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Personne introuvable : " + id);
  const updated = await storage.put(COLLECTION, { ...current, ...patch });
  await storage.logHistory("Person", id, "updated", { patch });
  return updated;
}

export function getPerson(id) {
  return storage.get(COLLECTION, id);
}

export function listAll() {
  return storage.listAll(COLLECTION);
}

export function subscribe(callback) {
  return storage.subscribe(COLLECTION, callback);
}

/**
 * Supprime la personne. Ne supprime PAS en cascade ses suivis/décisions liés — mêmes
 * raisons que removeProject() dans projects.js : les entités liées gardent leur personId
 * dans le vide plutôt qu'un effet de bord risqué.
 */
export async function removePerson(id) {
  await storage.logHistory("Person", id, "deleted", {});
  return storage.remove(COLLECTION, id);
}
