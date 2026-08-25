// Inbox — le sas d'entrée (cahier des charges §6, §11, §78.6).
// Principe non négociable : une capture ne devient JAMAIS directement une tâche.
// CAPTURE → InboxItem (status: pending) → Qualification → Task / Information / Archivé.
// Le contenu brut original est toujours conservé, quoi qu'il arrive (Règle 3).

import * as storage from "../services/storage.js";
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
 * Qualifie un élément d'Inbox. Pour l'instant, 3 issues sont réellement implémentées :
 * - "task"     → crée une vraie Tâche à partir du contenu (le reste des champs se fait
 *                dans la fiche tâche, pas ici — traitement guidé §13, aussi peu de champs
 *                obligatoires que possible).
 * - "kept"     → l'information est conservée telle quelle, sans devenir une tâche
 *                (§47 "information de contexte").
 * - "archived" → l'élément est classé sans suite.
 * Les autres types du cahier des charges (Suivi, Projet, Réunion, Décision, Ressource,
 * Idée) arriveront avec leurs entités dédiées dans une itération suivante ; en attendant,
 * on ne perd jamais la capture (Règle 3) : elle reste "kept" si on ne sait pas encore quoi
 * en faire.
 */
export async function qualify(itemId, outcome, extra = {}) {
  const item = await storage.get(COLLECTION, itemId);
  if (!item) throw new Error("Élément Inbox introuvable : " + itemId);

  if (outcome === "task") {
    const task = await createTask({
      title: extra.title || item.rawContent.slice(0, 120),
      description: item.rawContent,
      projectId: extra.projectId || null,
      dueDate: extra.dueDate || null,
      sourceInboxItemId: item.id,
    });
    await storage.put(COLLECTION, { ...item, status: "processed", resultTaskId: task.id });
    await storage.logHistory("InboxItem", item.id, "qualified_as_task", { taskId: task.id });
    return { outcome: "task", task };
  }

  if (outcome === "archived") {
    await storage.put(COLLECTION, { ...item, status: "archived" });
    await storage.logHistory("InboxItem", item.id, "archived", {});
    return { outcome: "archived" };
  }

  // "kept" et tout type non encore implémenté : on conserve l'information brute.
  await storage.put(COLLECTION, { ...item, status: "kept", keptAsType: outcome });
  await storage.logHistory("InboxItem", item.id, "kept", { asType: outcome });
  return { outcome: "kept" };
}
