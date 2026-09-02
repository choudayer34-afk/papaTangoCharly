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

const COLLECTION = "followUps";

// Statut d'un Suivi — simplifié à 3 états le 02/09/2026 (piste TDAH, audit de simplification
// demandé par Charles-Henri : "un suivi est plus naturellement binaire" que le pipeline à 5
// statuts des Tâches, qu'il réutilisait tel quel jusqu'ici sans jamais avoir de "à faire"/
// "en cours" qui fasse vraiment sens pour un suivi). `done` garde exactement le même nom
// qu'avant (voir isControlDue() plus bas, et tous les `f.status !== "done"` déjà semés dans
// l'app) — seule la distinction "en attente" vs "déjà relancé" est nouvelle.
export const STATUSES = ["waiting", "relaunched", "done"];
export const STATUS_LABELS = { waiting: "⏳ En attente", relaunched: "🔁 Relancé", done: "✅ Réglé" };
export const STATUS_ICONS = { waiting: "⏳", relaunched: "🔁", done: "✅" };

// Légende ⓘ (audit de simplification du 02/09/2026) : le statut d'un Suivi et celui d'une Tâche
// (js/domain/tasks.js) partagent tous les deux une valeur "en attente" avec la même icône ⏳
// mais un sens différent — ce texte lève l'ambiguïté sur Équipe, où seul le vocabulaire Suivi
// est visible.
export const STATUS_INFO_HTML =
  "Statut d'un <strong>Suivi</strong> — différent de celui d'une Tâche (onglet Pilotage), qui utilise aussi ⏳ mais avec un sens propre : ⏳ En attente (tu n'as encore rien relancé) · 🔁 Relancé (tu as déjà relancé, tu attends la réponse) · ✅ Réglé.";

/**
 * Ramène une valeur de statut — potentiellement encore un des 5 anciens statuts Tâche
 * (todo/in_progress/waiting/follow_up/done) posés sur un Suivi créé avant ce round — vers l'un
 * des 3 nouveaux. Appliquée à la lecture (listAll/subscribe ci-dessous) plutôt qu'en réécrivant
 * chaque document existant : aucune migration risquée à lancer, chaque suivi se normalise tout
 * seul dès qu'il est relu, sans écriture supplémentaire tant qu'on n'y touche pas soi-même.
 */
// BUG corrigé (trouvé aux tests de la vague 21, jamais vu par Charles-Henri) : la table ne
// contenait QUE les anciens statuts (todo/in_progress/waiting/follow_up/done) — "relaunched",
// pourtant l'un des 3 statuts ACTUELS d'un Suivi, n'y figurait pas et retombait donc sur le
// "waiting" par défaut ci-dessous dès la relecture suivante. Concrètement : choisir "🔁 Relancé"
// dans la fiche d'un suivi l'enregistrait correctement, mais le statut revenait silencieusement
// à "⏳ En attente" au prochain rendu (fermer/rouvrir la fiche, ou même immédiatement dans la
// modale "Point avec..." après enregistrement). Toute valeur déjà normalisée doit repasser
// telle quelle, pas seulement ses anciens alias.
const LEGACY_STATUS_MAP = { todo: "waiting", in_progress: "waiting", waiting: "waiting", relaunched: "relaunched", follow_up: "relaunched", done: "done" };

export function normalizeStatus(status) {
  return LEGACY_STATUS_MAP[status] || "waiting";
}

function normalize(followUp) {
  const status = normalizeStatus(followUp.status);
  return status === followUp.status ? followUp : { ...followUp, status };
}

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
    description: data.description || "", // contexte libre non daté (retour de Charles-Henri, vague 21)
    dueDate: data.dueDate || null, // échéance de la personne (direction "waiting_on")
    controlDate: data.controlDate || data.dueDate || null, // quand JE dois vérifier / en parler
    status: data.status || "waiting",
    successCriteria: data.successCriteria || "",
    projectId: data.projectId || null,
    notesLog: [], // journal de notes horodaté, voir addNote() plus bas
    checklist: [], // sous-étapes courtes libres, même principe que Task.checklist (js/domain/tasks.js)
  });
  await storage.logHistory("FollowUp", followUp.id, "created", { title: followUp.title });
  return followUp;
}

/**
 * Sous-étapes courtes libres sur un Suivi (retour de Charles-Henri, vague 21 : "dans un suivi
 * sur une personne, il faudrait que je puisse mettre une description et une checklist") — même
 * principe et même forme `{id, text, done, doneAt}` que la checklist des Tâches (voir
 * js/domain/tasks.js#addChecklistItem/toggleChecklistItem/removeChecklistItem), pour que
 * js/components/checklist.js reste le seul composant à connaître, sans variante par type de
 * fiche.
 */
export async function addChecklistItem(id, text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Suivi introuvable : " + id);
  const checklist = [...(current.checklist || []), { id: generateId(), text: trimmed, done: false, doneAt: null }];
  const updated = await storage.put(COLLECTION, { ...current, checklist });
  return updated.checklist;
}

export async function toggleChecklistItem(id, itemId, done) {
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Suivi introuvable : " + id);
  const checklist = (current.checklist || []).map((c) => (c.id === itemId ? { ...c, done, doneAt: done ? Date.now() : null } : c));
  const updated = await storage.put(COLLECTION, { ...current, checklist });
  return updated.checklist;
}

export async function removeChecklistItem(id, itemId) {
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Suivi introuvable : " + id);
  const checklist = (current.checklist || []).filter((c) => c.id !== itemId);
  const updated = await storage.put(COLLECTION, { ...current, checklist });
  return updated.checklist;
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

export async function listAll() {
  const items = await storage.listAll(COLLECTION);
  return items.map(normalize);
}

export function subscribe(callback) {
  return storage.subscribe(COLLECTION, (items) => callback(items.map(normalize)));
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
