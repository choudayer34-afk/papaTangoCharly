// Suivis — §29. Deux sens possibles (retour de Charles-Henri : comment noter que je dois
// pousser une info à quelqu'un, pas seulement attendre quelque chose de lui) :
//  - "waiting_on" (par défaut, comportement historique) : "quelqu'un doit faire quelque
//    chose et je dois vérifier" — le champ qui compte est "quand est-ce que MOI je dois
//    contrôler / relancer" (controlDate), alimente §33 (point collaborateur automatique)
//    et les automatisations "suivi à faire" (§28).
//  - "to_tell" (nouveau) : "je dois transmettre/dire quelque chose à cette personne" —
//    controlDate devient "avant quand dois-je lui en parler ?". Alimente aussi §33 (section
//    "📣 À transmettre") et, quand la personne est de type "manager", §34/§35 (écran
//    Management, voir js/views/management.js) via `category`.
//
// `category` ne qualifie que les suivis "to_tell" destinés au Management (§34/§35) :
// difficulté à signaler, décision attendue, sujet à discuter, ou réalisation à mentionner —
// reste facultatif pour un "to_tell" ordinaire vers un collaborateur ou l'équipe.

import * as storage from "../services/storage.js";
import { generateId } from "../services/id.js";
import { STATUSES, STATUS_LABELS } from "./tasks.js";

const COLLECTION = "followUps";

export { STATUSES, STATUS_LABELS };

export const DIRECTIONS = ["waiting_on", "to_tell"];
export const DIRECTION_LABELS = {
  waiting_on: "👀 J'attends quelque chose de cette personne",
  to_tell: "📣 Je dois lui transmettre quelque chose",
};

export const CATEGORIES = ["topic", "decision", "difficulty", "achievement"];
export const CATEGORY_LABELS = {
  topic: "📌 Sujet à discuter",
  decision: "🗳️ Décision attendue",
  difficulty: "⚠️ Difficulté",
  achievement: "🟢 Réalisation à mentionner",
};

// "Notable" (§ préparation EADP, retour de Charles-Henri) : un suivi peut être marqué comme
// un élément notable positif ou négatif, indépendamment de sa direction/catégorie — sert à
// ressortir les points marquants d'une personne sur une période (voir openPrepareEadpModal,
// js/views/people.js), sans avoir à relire tout l'historique des suivis un par un.
export const NOTABLE_VALUES = ["positive", "negative"];
export const NOTABLE_LABELS = { positive: "👍 Notable positif", negative: "👎 Notable négatif" };

export async function createFollowUp(data) {
  const followUp = await storage.put(COLLECTION, {
    title: data.title, // l'engagement pris par la personne, ou ce que je dois lui dire
    personId: data.personId,
    direction: DIRECTIONS.includes(data.direction) ? data.direction : "waiting_on",
    category: data.category || null,
    notable: NOTABLE_VALUES.includes(data.notable) ? data.notable : null,
    expectedResult: data.expectedResult || "",
    dueDate: data.dueDate || null, // échéance de la personne (direction "waiting_on")
    controlDate: data.controlDate || data.dueDate || null, // quand JE dois vérifier / en parler
    status: data.status || "waiting",
    successCriteria: data.successCriteria || "",
    projectId: data.projectId || null,
    notesLog: [], // journal de notes horodaté, voir addNote() plus bas
  });
  await storage.logHistory("FollowUp", followUp.id, "created", { title: followUp.title });
  return followUp;
}

/** Journal de notes horodaté (retour de Charles-Henri, 01/09/2026) — voir addNote() dans
 *  domain/tasks.js pour le principe complet (additif uniquement). */
export async function addNote(id, text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Suivi introuvable : " + id);
  const notesLog = [...(current.notesLog || []), { id: generateId(), text: trimmed, createdAt: Date.now() }];
  const updated = await storage.put(COLLECTION, { ...current, notesLog });
  await storage.logHistory("FollowUp", id, "note_added", { text: trimmed });
  return updated.notesLog;
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
