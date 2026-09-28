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
    order: data.order ?? Date.now(), // position manuelle (glisser-déposer, onglet Équipe) — voir sortPeople()/reorderPeople() plus bas
  });
  await storage.logHistory("Person", person.id, "created", { name: person.name });
  return person;
}

/** Ordre d'affichage de l'onglet Équipe (retour de Charles-Henri, vague 20 : "je veux aussi
 *  pouvoir réordonner les personnes au sein de mon équipe") — même principe que
 *  `Project.order`/`sortProjects()`/`reorderProjects()` dans js/domain/projects.js : `order`
 *  vaut `createdAt` par défaut (donc déjà trié par ordre d'ajout tant que personne n'a
 *  glissé-déposé), réécrit en bloc à chaque réordonnancement. */
export function sortPeople(list) {
  return [...list].sort((a, b) => (a.order ?? a.createdAt ?? 0) - (b.order ?? b.createdAt ?? 0));
}

export async function reorderPeople(orderedIds) {
  await Promise.all(orderedIds.map((id, index) => updatePerson(id, { order: index })));
}

/** Journal de notes horodaté (retour de Charles-Henri, 01/09/2026) — voir addNote() dans
 *  domain/tasks.js pour le principe complet (additif uniquement). */
export async function addNote(id, text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Personne introuvable : " + id);
    return { notesLog: [...(current.notesLog || []), { id: generateId(), text: trimmed, createdAt: Date.now(), eadpFlag: null }] };
  });
  await storage.logHistory("Person", id, "note_added", { text: trimmed });
  return updated.notesLog;
}

// `EADP_FLAG_VALUES` (ajout du 28/09/2026, retour de Charles-Henri : "je dois pouvoir
// identifier dans notes & repères [...] si c'est une note que je veux remonter dans l'EADP, qui
// est positif ou négatif ou neutre") — SEUL le journal de notes d'une Personne porte ce tag (les
// 7 autres fiches qui partagent js/components/notesBlock.js n'ont pas de notion d'EADP). Une
// note taguée se range dans "Préparer l'EADP" (js/views/people.js#openPrepareEadpModal) au même
// titre que les Suivis marqués `notable` (voir js/domain/followups.js) — le texte de la note
// elle-même sert de "en quoi c'est notable", pas besoin d'un champ séparé ici.
export const EADP_FLAG_VALUES = ["positive", "negative", "neutral"];
export const EADP_FLAG_LABELS = { positive: "👍 Positif", negative: "👎 Négatif", neutral: "⚪ Neutre" };

/** `updateNote`/`removeNote` — même signature `(id, noteId, text)` que sur les 7 autres fiches
 *  qui partagent js/components/notesBlock.js (la règle "additif seulement" y est levée partout,
 *  celle-ci comprise) : ne touche jamais `eadpFlag`, voir `setNoteEadpFlag` juste en dessous
 *  pour ça, qui reste un point d'écriture séparé et dédié à la Personne uniquement. */
export async function updateNote(id, noteId, text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Personne introuvable : " + id);
    return { notesLog: (current.notesLog || []).map((n) => (n.id === noteId ? { ...n, text: trimmed } : n)) };
  });
  return updated.notesLog;
}

export async function removeNote(id, noteId) {
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Personne introuvable : " + id);
    return { notesLog: (current.notesLog || []).filter((n) => n.id !== noteId) };
  });
  return updated.notesLog;
}

/** Tag EADP d'une note (positif/négatif/neutre/aucun) — voir EADP_FLAG_VALUES ci-dessus.
 *  Point d'écriture séparé de updateNote() : poser le tag n'est pas "corriger le texte", et
 *  seule la Personne a cette notion (jamais les 7 autres fiches à journal de notes). */
export async function setNoteEadpFlag(id, noteId, flag) {
  const value = EADP_FLAG_VALUES.includes(flag) ? flag : null;
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Personne introuvable : " + id);
    return { notesLog: (current.notesLog || []).map((n) => (n.id === noteId ? { ...n, eadpFlag: value } : n)) };
  });
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
  let migratedText = null;
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current || !(current.notes || "").trim()) return undefined; // rien à migrer, pas d'écriture
    migratedText = current.notes.trim();
    const notesLog = [...(current.notesLog || []), { id: generateId(), text: migratedText, createdAt: current.createdAt || Date.now() }];
    return { notes: "", notesLog };
  });
  if (migratedText !== null) {
    await storage.logHistory("Person", id, "note_added", { text: migratedText });
  }
  return updated;
}

export async function updatePerson(id, patch) {
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Personne introuvable : " + id);
    return patch;
  });
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
