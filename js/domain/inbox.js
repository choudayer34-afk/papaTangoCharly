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

/**
 * Retour de Charles-Henri, vague 40, 09/09/2026 : "je n'ai jamais la possibilité de retrouver
 * une information ailleurs" — une fois auto-archivée après 15 jours (voir
 * autoArchiveStaleKept() plus bas), une Information/Idée devenait purement et simplement
 * introuvable : absente de listKept() (donc du Dashboard ET de la recherche globale, voir
 * js/components/search.js), et sans aucune vue pour parcourir les éléments archivés.
 *
 * L'auto-archivage réutilise `qualify(id, "archived")`, le même statut qu'un élément Inbox
 * classé sans suite (jamais devenu une information) — mais `keptAsType` (posé uniquement par
 * qualify() vers "kept"/"idea") survit à ce changement de statut puisque `storage.put` ne fait
 * que fusionner les champs. Sa seule présence permet donc de distinguer, même après archivage,
 * "c'était une information, juste devenue ancienne" de "classé sans suite, jamais une
 * information" — sans avoir besoin d'un champ ou d'un statut supplémentaire.
 */
export function listKeptIncludingArchived() {
  return storage.listAll(COLLECTION).then((items) => items.filter((i) => i.status === "kept" || (i.status === "archived" && i.keptAsType)));
}

export function subscribeKeptIncludingArchived(callback) {
  return storage.subscribe(COLLECTION, (items) =>
    callback(items.filter((i) => i.status === "kept" || (i.status === "archived" && i.keptAsType)))
  );
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
 * Corrige le texte brut d'une capture encore en attente (retour de Charles-Henri, 06/09/2026 :
 * "quand on prend une note rapide, quand elle est dans inbox, je dois pouvoir modifier le
 * titre même si je la qualifie pas") — jusqu'ici, la seule façon de toucher au texte capturé
 * passait par la qualification (openQualifyModal, qui l'affiche en lecture seule) : une
 * capture rapide (dictée, frappe pressée) contient parfois une coquille ou un mot à préciser,
 * et attendre d'avoir choisi Tâche/Suivi/Information/... pour la corriger va à l'encontre de
 * l'esprit "friction minimale" de l'Inbox (§11/§12). Ne change ni le statut ni rien d'autre —
 * la Règle 3 (ne jamais perdre la capture) reste respectée, on corrige juste son texte.
 */
export async function updateRawContent(id, rawContent) {
  const trimmed = (rawContent || "").trim();
  if (!trimmed) throw new Error("Le texte ne peut pas être vide");
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Élément Inbox introuvable : " + id);
  const updated = await storage.put(COLLECTION, { ...current, rawContent: trimmed });
  await storage.logHistory("InboxItem", id, "raw_content_edited", {});
  return updated;
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

// Tags libres sur les Informations/Idées (retour de Charles-Henri, 13/09/2026 : "pouvoir
// catégoriser des idées/informations et voir comment retrouver facilement les éléments d'une
// catégorie") — d'abord posés ici (tableau `item.tags`), puis généralisés le même jour à
// n'importe quelle fiche de l'app ("les tags peuvent être associé à n'importe quel élément
// d'une info au projet au suivi, etc.") : voir js/domain/tags.js, qui reprend ce même jour les
// tags déjà saisis ici (migrateInboxTags(), appelée une fois au démarrage depuis js/app.js) vers
// sa collection générique { type, id, tag }. addKeptTag/removeKeptTag/listAllKeptTags ont
// disparu au profit de tagsApi.addTag/removeTag/tagsFor (type "Kept") — l'ancien tableau
// `item.tags` n'est donc plus alimenté après cette migration, gardé uniquement le temps que la
// migration ait tourné au moins une fois sur chaque compte.

/** Rattache (ou détache, `projectId: null`) une Information/Idée à un projet. */
export async function setKeptProject(id, projectId) {
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Élément Inbox introuvable : " + id);
  const updated = await storage.put(COLLECTION, { ...current, projectId: projectId || null });
  await storage.logHistory("InboxItem", id, "project_set", { projectId: projectId || null });
  return updated;
}
