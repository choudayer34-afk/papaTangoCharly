// Ressources — §39 à §44. Le stockage reste principalement des liens/références
// (§65) : on ne copie jamais un fichier, seulement son URL/emplacement et son contexte.
// Règle 8 : une ressource ne doit pas être dupliquée — une même Resource peut être liée à
// plusieurs projets/tâches via projectIds/taskIds, jamais recréée pour chaque contexte.

import * as storage from "../services/storage.js";
import { generateId } from "../services/id.js";
import * as gamification from "./gamification.js";

const COLLECTION = "resources";

export const TYPES = [
  { key: "figma", label: "Figma", emoji: "🎨" },
  { key: "excel", label: "Excel", emoji: "📊" },
  { key: "word", label: "Word", emoji: "📄" },
  { key: "powerpoint", label: "PowerPoint", emoji: "📽️" },
  { key: "sharepoint_list", label: "Liste SharePoint", emoji: "📋" },
  { key: "sharepoint", label: "SharePoint", emoji: "🗂️" },
  { key: "teams", label: "Teams", emoji: "💬" },
  { key: "outlook", label: "Outlook", emoji: "📧" },
  { key: "folder", label: "Dossier", emoji: "📁" },
  { key: "website", label: "Site web", emoji: "🌐" },
  { key: "file", label: "Fichier", emoji: "📎" },
  { key: "other", label: "Autre", emoji: "🔗" },
];

const TYPE_MAP = Object.fromEntries(TYPES.map((t) => [t.key, t]));

export function typeInfo(key) {
  return TYPE_MAP[key] || TYPE_MAP.other;
}

/** Détection automatique du type depuis une URL (§10) — meilleur effort, jamais bloquant. */
export function detectType(url) {
  if (!url) return "other";
  const u = url.toLowerCase();
  if (u.includes("figma.com")) return "figma";
  if (u.includes("docs.google.com/spreadsheets") || /\.xlsx?$/.test(u)) return "excel";
  if (u.includes("docs.google.com/document") || /\.docx?$/.test(u)) return "word";
  if (u.includes("docs.google.com/presentation") || /\.pptx?$/.test(u)) return "powerpoint";
  if (u.includes("sharepoint.com") && u.includes("/lists/")) return "sharepoint_list";
  if (u.includes("sharepoint.com")) return "sharepoint";
  if (u.includes("teams.microsoft.com")) return "teams";
  if (u.includes("outlook.office.com") || u.includes("outlook.com")) return "outlook";
  if (u.includes("onedrive.live.com") || u.includes("1drv.ms") || u.includes("drive.google.com")) return "folder";
  if (u.startsWith("http://") || u.startsWith("https://")) return "website";
  return "other";
}

export async function createResource(data) {
  const resource = await storage.put(COLLECTION, {
    title: data.title,
    type: data.type || detectType(data.url),
    url: data.url || "",
    location: data.location || "",
    description: data.description || "",
    tags: data.tags || [],
    projectIds: data.projectIds || [],
    taskIds: data.taskIds || [],
    lastUsedAt: null,
    notesLog: [], // journal de notes horodaté, voir addNote() plus bas
  });
  await storage.logHistory("Resource", resource.id, "created", { title: resource.title });
  // Gamification (LOT G1, TODO_GAMIFICATION.md §3) : "Ressource créée", 3 XP, une seule fois
  // par Ressource — voir le commentaire détaillé de js/domain/tasks.js#updateTask pour le
  // raisonnement complet (système accessoire, jamais bloquant).
  gamification.recordResourceCreated(resource.id).catch((err) => console.error("[gamification] Échec du crédit XP (Ressource créée) :", err));
  return resource;
}

/** Journal de notes horodaté (retour de Charles-Henri, 01/09/2026) — voir addNote() dans
 *  domain/tasks.js pour le principe complet (additif uniquement).
 *
 *  Converti le 29/09/2026 (TODO-037, même conversion que TODO-010 sur tasks.js/projects.js/
 *  followups.js) vers `storage.appendToArray()` : écriture ATOMIQUE ciblée sur `notesLog`, sans
 *  relire ni retransmettre le reste du document. Ne renvoie plus que la note ajoutée seule
 *  (jamais le tableau complet, qui n'est jamais relu ici) — à l'appelant de reconstruire sa
 *  propre copie locale, voir js/views/resources.js#openResourceDetail (même principe que
 *  js/views/kanban.js#openTaskDetail pour tasksApi.addNote). */
export async function addNote(id, text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  const note = { id: generateId(), text: trimmed, createdAt: Date.now() };
  await storage.appendToArray(COLLECTION, id, "notesLog", note);
  await storage.logHistory("Resource", id, "note_added", { text: trimmed });
  return note;
}

// `updateNote`/`removeNote` (ajout du 28/09/2026, retour de Charles-Henri : "je dois pouvoir
// pour toutes les notes, les modifier si besoin") — la règle "additif seulement" documentée
// dans js/components/notesBlock.js est levée sur les 8 fiches qui partagent ce journal, celle-ci
// (la Ressource) comprise.
export async function updateNote(id, noteId, text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Ressource introuvable : " + id);
    return { notesLog: (current.notesLog || []).map((n) => (n.id === noteId ? { ...n, text: trimmed } : n)) };
  });
  return updated.notesLog;
}

export async function removeNote(id, noteId) {
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Ressource introuvable : " + id);
    return { notesLog: (current.notesLog || []).filter((n) => n.id !== noteId) };
  });
  return updated.notesLog;
}

export async function updateResource(id, patch) {
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Ressource introuvable : " + id);
    return patch;
  });
  await storage.logHistory("Resource", id, "updated", { patch });
  return updated;
}

export function getResource(id) {
  return storage.get(COLLECTION, id);
}

export function listAll() {
  return storage.listAll(COLLECTION);
}

export function subscribe(callback) {
  return storage.subscribe(COLLECTION, callback);
}

export async function removeResource(id) {
  await storage.logHistory("Resource", id, "deleted", {});
  return storage.remove(COLLECTION, id);
}

export async function touchLastUsed(id) {
  await storage.update(COLLECTION, id, (current) => {
    if (!current) return undefined;
    return { lastUsedAt: Date.now() };
  });
}

function toggleLink(idList, id, shouldLink) {
  const set = new Set(idList || []);
  if (shouldLink) set.add(id);
  else set.delete(id);
  return [...set];
}

export async function linkToProject(resourceId, projectId, shouldLink = true) {
  return storage.update(COLLECTION, resourceId, (current) => {
    if (!current) throw new Error("Ressource introuvable : " + resourceId);
    return { projectIds: toggleLink(current.projectIds, projectId, shouldLink) };
  });
}

export async function linkToTask(resourceId, taskId, shouldLink = true) {
  return storage.update(COLLECTION, resourceId, (current) => {
    if (!current) throw new Error("Ressource introuvable : " + resourceId);
    return { taskIds: toggleLink(current.taskIds, taskId, shouldLink) };
  });
}

export function isUnclassified(resource) {
  return (!resource.projectIds || resource.projectIds.length === 0) && (!resource.taskIds || resource.taskIds.length === 0);
}
