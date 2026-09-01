// Inbox — le sas d'entrée (cahier des charges §6, §11, §78.6).
// Principe non négociable : une capture ne devient JAMAIS directement une tâche.
// CAPTURE → InboxItem (status: pending) → Qualification → Task / Information / Archivé.
// Le contenu brut original est toujours conservé, quoi qu'il arrive (Règle 3).

import * as storage from "../services/storage.js";
import { generateId } from "../services/id.js";
import { createTask } from "./tasks.js";

const COLLECTION = "inboxItems";

/** Capture express : enregistre le texte brut tel quel, sans qualification. */
export async function capture(rawContent, source = "manuel") {
  const item = await storage.put(COLLECTION, {
    rawContent,
    source,
    status: "pending", // pending | processed | archived | kept
  });
  await storage.logHistory("InboxItem", item.id, "captured", { source });
  return item;
}

export function listPending() {
  return storage.listAll(COLLECTION).then((items) => items.filter((i) => i.status === "pending"));
}

export function subscribePending(callback) {
  return storage.subscribe(COLLECTION, (items) => callback(items.filter((i) => i.status === "pending")));
}

/**
 * Éléments qualifiés en "Information" ou "Idée" (§47 "information de contexte") : ils ne
 * deviennent jamais une tâche, mais restaient jusqu'ici invisibles une fois qualifiés — retour
 * de Charles-Henri ("les informations, idées, ne remontent pas"). Exposés au Dashboard.
 */
export function listKept() {
  return storage.listAll(COLLECTION).then((items) => items.filter((i) => i.status === "kept"));
}

export function subscribeKept(callback) {
  return storage.subscribe(COLLECTION, (items) => callback(items.filter((i) => i.status === "kept")));
}

const KEPT_MAX_AGE_MS = 15 * 24 * 60 * 60 * 1000;

/**
 * Auto-archivage des Informations/Idées après 15 jours (retour de Charles-Henri du 31/08 :
 * "les info ou idées sont automatiquement archivées au bout de 15 jours") — pour que la
 * section "🧠 Informations & idées" du Dashboard reste naturellement courte plutôt que de
 * s'allonger indéfiniment. L'app n'a pas de tâche de fond côté serveur (tout vit côté client +
 * Firestore) : ce balayage se fait donc au chargement de l'app (voir js/app.js) plutôt que sur
 * une vraie tâche planifiée — un léger différé plutôt qu'un instant exact à J+15, largement
 * suffisant pour ce besoin ("ne pas laisser traîner", pas "supprimer pile à la seconde près").
 * Utilise qualify() comme le bouton "Archiver" manuel existant : même chemin, même historique.
 */
export async function autoArchiveStaleKept() {
  const kept = await listKept();
  const cutoff = Date.now() - KEPT_MAX_AGE_MS;
  const stale = kept.filter((item) => (item.createdAt || 0) < cutoff);
  await Promise.all(stale.map((item) => qualify(item.id, "archived")));
  return stale.length;
}

/**
 * Journal de notes horodaté sur une Information/Idée "gardée" (retour de Charles-Henri,
 * 01/09/2026, généralisé à "tout les éléments") — même principe que addNote() dans
 * domain/tasks.js (additif uniquement), mais posé directement ici plutôt que via une fonction
 * updateXxx générique : un InboxItem n'en a pas, ses différents statuts se posent chacun via
 * leur propre chemin dédié (qualify(), capture()...) plutôt qu'un patch libre.
 */
export async function addKeptNote(id, text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Élément Inbox introuvable : " + id);
  const notesLog = [...(current.notesLog || []), { id: generateId(), text: trimmed, createdAt: Date.now() }];
  const updated = await storage.put(COLLECTION, { ...current, notesLog });
  await storage.logHistory("InboxItem", id, "note_added", { text: trimmed });
  return updated.notesLog;
}

// Pour ces issues, l'entité résultante est déjà créée par la vue (js/views/inbox.js), qui
// réutilise directement le domaine et — quand c'est possible — la modale de création déjà
// existante (Projet, Ressource) plutôt que de dupliquer cette logique ici. `qualify()` se
// contente de retenir quel objet a résulté de la capture, pour ne jamais perdre le lien
// entre l'InboxItem original et ce qu'il est devenu (§78.6).
const RESULT_KEY = {
  followup: "resultFollowUpId",
  project: "resultProjectId",
  meeting: "resultMeetingId",
  decision: "resultDecisionId",
  resource: "resultResourceId",
};

/**
 * Qualifie un élément d'Inbox.
 * - "task"     → crée une vraie Tâche à partir du contenu (le reste des champs se fait
 *                dans la fiche tâche, pas ici — traitement guidé §13, aussi peu de champs
 *                obligatoires que possible).
 * - "followup" / "project" / "meeting" / "decision" / "resource" → l'entité a déjà été
 *                créée côté vue ; on marque juste l'InboxItem traité et on garde le lien
 *                (extra.id) vers l'objet résultant.
 * - "kept"     → l'information est conservée telle quelle, sans devenir une tâche
 *                (§47 "information de contexte").
 * - "archived" → l'élément est classé sans suite.
 * Dans tous les cas, la capture brute originale n'est jamais perdue (Règle 3).
 */
export async function qualify(itemId, outcome, extra = {}) {
  const item = await storage.get(COLLECTION, itemId);
  if (!item) throw new Error("Élément Inbox introuvable : " + itemId);

  if (outcome === "task") {
    const task = await createTask({
      title: extra.title || item.rawContent.slice(0, 120),
      // La capture brute part toujours dans la description (Règle 3 : ne jamais rien
      // perdre), même quand `extra.description` a été retouché à la qualification — pour
      // ne jamais réduire "titre court" à "seule trace conservée" (retour de
      // Charles-Henri : le détail semblait tronqué à la transformation en action).
      description: extra.description !== undefined ? extra.description : item.rawContent,
      projectId: extra.projectId || null,
      dueDate: extra.dueDate || null,
      type: extra.type || "action",
      sourceInboxItemId: item.id,
    });
    await storage.put(COLLECTION, { ...item, status: "processed", resultTaskId: task.id });
    await storage.logHistory("InboxItem", item.id, "qualified_as_task", { taskId: task.id });
    return { outcome: "task", task };
  }

  if (RESULT_KEY[outcome]) {
    const patch = { status: "processed" };
    if (extra.id) patch[RESULT_KEY[outcome]] = extra.id;
    await storage.put(COLLECTION, { ...item, ...patch });
    await storage.logHistory("InboxItem", item.id, "qualified_as_" + outcome, { id: extra.id });
    return { outcome };
  }

  if (outcome === "archived") {
    await storage.put(COLLECTION, { ...item, status: "archived" });
    await storage.logHistory("InboxItem", item.id, "archived", {});
    return { outcome: "archived" };
  }

  // "kept" et tout type non prévu ci-dessus : on conserve l'information brute plutôt que
  // de la perdre (Règle 3).
  await storage.put(COLLECTION, { ...item, status: "kept", keptAsType: outcome });
  await storage.logHistory("InboxItem", item.id, "kept", { asType: outcome });
  return { outcome: "kept" };
}
