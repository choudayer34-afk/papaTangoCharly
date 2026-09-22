// "🧠 Mon bureau" — post-it libres de l'Accueil (LOT 13, TODO-027, besoin du 22/09/2026 transmis
// par Charles-Henri : "je veux disposer de plusieurs post-it libres sur mon écran d'accueil afin
// de capturer rapidement des notes pendant une réunion [...] et transformer ensuite ces notes en
// objets de Pilotage").
//
// Remplace l'ancien "📌 Pense-bête" (un post-it UNIQUE stocké dans js/domain/preferences.js) —
// arbitrage explicite de Charles-Henri (AskUserQuestion, 22/09/2026, "Mon bureau remplace le
// Pense-bête (Recommandé)") : une vraie collection Firestore cette fois (chaque post-it est une
// fiche à part entière, position/taille/couleur/z-index comprises), pour permettre un nombre
// illimité de post-it librement positionnés — ce qu'un simple champ de préférence ne pouvait pas
// représenter. La migration du contenu existant du Pense-bête vers le premier post-it se fait
// côté js/views/dashboard.js (voir son commentaire de migration, même principe que
// `postitMigratedV1`).
//
// Modèle de données (repris tel quel de la spec transmise par Charles-Henri) :
//   StickyNote { id, title, type ("text"|"checklist"), color, content, checklist[], x, y, width,
//                height, zIndex, pinned, archived, createdAt, updatedAt }
//   ChecklistItem { id, text, done, doneAt }
// Écart assumé avec la spec (à documenter dans le rapport de fin de lot) : le champ `checked` du
// modèle ChecklistItem de la spec devient `done`/`doneAt` ici, pour rester au même format que
// TOUTES les autres checklists de l'app (js/domain/tasks.js, js/domain/followups.js, l'ancien
// Pense-bête) — ce même format est ce que js/components/checklist.js#renderChecklist attend déjà
// en entrée, réutilisé tel quel plutôt que de lui apprendre un second format.
//
// `content` et `checklist` cohabitent TOUJOURS sur le même document, quel que soit `type` actif —
// changer de type (`setType`) ne perd donc jamais ce qui a été tapé dans l'autre mode, exactement
// le même principe que `postitMode`/`postitText`/`postitChecklist` avant cette vague.

import * as storage from "../services/storage.js";
import { generateId } from "../services/id.js";

const COLLECTION = "stickyNotes";

export const COLORS = ["yellow", "blue", "green", "pink", "purple", "gray"];
export const DEFAULT_COLOR = "yellow";

export const DEFAULT_WIDTH = 220;
export const DEFAULT_HEIGHT = 190;
export const MIN_WIDTH = 160;
export const MIN_HEIGHT = 120;

export async function createStickyNote(data = {}) {
  const note = await storage.put(COLLECTION, {
    title: data.title || "",
    type: data.type === "checklist" ? "checklist" : "text",
    color: COLORS.includes(data.color) ? data.color : DEFAULT_COLOR,
    content: data.content || "",
    checklist: data.checklist || [],
    x: Number.isFinite(data.x) ? data.x : 16,
    y: Number.isFinite(data.y) ? data.y : 16,
    width: Number.isFinite(data.width) ? data.width : DEFAULT_WIDTH,
    height: Number.isFinite(data.height) ? data.height : DEFAULT_HEIGHT,
    zIndex: Number.isFinite(data.zIndex) ? data.zIndex : 1,
    // `pinned` (23/09/2026, retour direct de Charles-Henri : "je dois toujours pouvoir créer un
    // post-it à la volée qui sera épinglé par défaut") — optionnel, `false` par défaut pour tout
    // appelant qui ne le précise pas (migration Pense-bête notamment, voir js/views/dashboard.js).
    pinned: !!data.pinned,
    archived: false,
  });
  return note;
}

export function listAll() {
  return storage.listAll(COLLECTION);
}

// `{ sort: false }` — l'ordre d'affichage sur le bureau vient de `x`/`y`/`zIndex`, jamais de
// `updatedAt` (voir js/components/bureau.js) : un post-it qu'on vient de cocher/déplacer n'a
// aucune raison de "sauter" en tête d'un tableau que l'app ne trie de toute façon jamais par cet
// ordre-là à l'écran.
export function subscribe(callback) {
  return storage.subscribe(COLLECTION, callback, { sort: false });
}

/**
 * Position ET taille ET ordre de superposition, en UN seul appel (retour de Charles-Henri,
 * §"Sauvegarde" : "toutes les modifications sont automatiques [...] position ; taille ; ordre
 * d'affichage") — voir js/components/bureau.js : un déplacement ou un redimensionnement en cours
 * ne réécrit jamais Firestore à chaque pixel, seulement une fois au relâchement, avec les 5
 * champs à jour d'un coup (même préoccupation que le risque déjà noté dans TODO_TECHNIQUE.md
 * pour ce lot : ne pas multiplier les écritures pendant le glisser). `storage.setFields()` — pas
 * `update()` — puisque la nouvelle valeur ne dépend jamais de l'ancienne.
 */
export async function setLayout(id, { x, y, width, height, zIndex }) {
  const fields = {};
  if (Number.isFinite(x)) fields.x = x;
  if (Number.isFinite(y)) fields.y = y;
  if (Number.isFinite(width)) fields.width = width;
  if (Number.isFinite(height)) fields.height = height;
  if (Number.isFinite(zIndex)) fields.zIndex = zIndex;
  return storage.setFields(COLLECTION, id, fields);
}

export async function setTitle(id, title) {
  return storage.setFields(COLLECTION, id, { title: title || "" });
}

export async function setContent(id, content) {
  return storage.setFields(COLLECTION, id, { content: content || "" });
}

export async function setColor(id, color) {
  return storage.setFields(COLLECTION, id, { color: COLORS.includes(color) ? color : DEFAULT_COLOR });
}

/** Change de type SANS jamais effacer `content`/`checklist` — voir le commentaire en tête de
 *  fichier, même principe que l'ancien `postitMode`. */
export async function setType(id, type) {
  return storage.setFields(COLLECTION, id, { type: type === "checklist" ? "checklist" : "text" });
}

export async function togglePin(id, pinned) {
  return storage.setFields(COLLECTION, id, { pinned: !!pinned });
}

export async function setArchived(id, archived) {
  return storage.setFields(COLLECTION, id, { archived: !!archived });
}

export async function removeStickyNote(id) {
  return storage.remove(COLLECTION, id);
}

// ---------- Checklist (post-it de type "checklist") — mêmes callbacks, même forme d'élément
// ({id, text, done, doneAt}) et même mécanique d'écriture que js/domain/tasks.js, pour que
// js/components/checklist.js#renderChecklist se comporte à l'identique ici. ----------

export async function addChecklistItem(id, text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  const item = { id: generateId(), text: trimmed, done: false, doneAt: null };
  await storage.appendToArray(COLLECTION, id, "checklist", item);
  return item;
}

export async function toggleChecklistItem(id, itemId, done) {
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Post-it introuvable : " + id);
    return {
      checklist: (current.checklist || []).map((c) => (c.id === itemId ? { ...c, done, doneAt: done ? Date.now() : null } : c)),
    };
  });
  return updated.checklist;
}

export async function removeChecklistItem(id, itemId) {
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Post-it introuvable : " + id);
    return { checklist: (current.checklist || []).filter((c) => c.id !== itemId) };
  });
  return updated.checklist;
}

export async function editChecklistItem(id, itemId, text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Post-it introuvable : " + id);
    return { checklist: (current.checklist || []).map((c) => (c.id === itemId ? { ...c, text: trimmed } : c)) };
  });
  return updated.checklist;
}

export async function reorderChecklist(id, orderedIds) {
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Post-it introuvable : " + id);
    const list = current.checklist || [];
    const byId = new Map(list.map((c) => [c.id, c]));
    const notDoneReordered = orderedIds.map((cid) => byId.get(cid)).filter(Boolean);
    const covered = new Set(orderedIds);
    const notDoneUncovered = list.filter((c) => !c.done && !covered.has(c.id));
    const done = list.filter((c) => c.done);
    return { checklist: [...notDoneReordered, ...notDoneUncovered, ...done] };
  });
  return updated.checklist;
}

/**
 * Contenu textuel équivalent d'un post-it, tous types confondus — utilisé pour préremplir les
 * formulaires de conversion (§"Conversion intelligente") : un post-it Texte donne directement son
 * `content`, un post-it Checklist énumère chaque ligne (cochée ou non) sous forme de texte lisible,
 * puisqu'aucun des formulaires cibles (Tâche/Suivi/Ressource/Décision) ne sait afficher une vraie
 * checklist dans son champ description.
 */
export function stickyNoteToText(note) {
  if (note.type === "checklist") {
    return (note.checklist || []).map((it) => `${it.done ? "☑" : "☐"} ${it.text}`).join("\n");
  }
  return note.content || "";
}
