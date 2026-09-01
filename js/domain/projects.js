// Projets (§36, §37) : objectif, critère de réussite, avancement calculé à partir des
// tâches liées. Le calcul réutilise exactement les statuts des tâches (§78.8) — pas de
// nomenclature parallèle, une seule source de vérité pour les statuts.
//
// `category` (nouveau) : Charles-Henri porte plusieurs casquettes (CSE, Modernisation, ...) —
// un projet a une catégorie libre (nom + icône assignée automatiquement, voir
// js/domain/preferences.js) pour trier/filtrer ce qui appartient à chaque casquette.
//
// `parts` (nouveau) : sous-parties d'un projet avec leur propre avancement à trois états
// (⚪ pas commencé / 🔵 en cours / 🟢 terminé) — volontairement PAS des Tâches : le besoin
// exprimé est de voir "où en est l'équipe" sur un bloc (ex. "la traduction"), sans avoir à
// décomposer en actions dont Charles-Henri ne serait de toute façon pas responsable. Un
// tableau embarqué comme `steps` (canevas) plutôt qu'une collection séparée : une seule
// fiche projet possède ses propres sous-parties, jamais partagées.
//
// `order` (nouveau) : position manuelle dans l'onglet Projets (glisser-déposer) — alternative
// au tri par avancement, voir `sortProjects()`.

import * as storage from "../services/storage.js";
import { generateId } from "../services/id.js";
import { STATUSES } from "./tasks.js";
import { buildSteps } from "./templates.js";

const COLLECTION = "projects";

export const PART_STATUSES = ["not_started", "in_progress", "done"];
export const PART_STATUS_ICONS = { not_started: "⚪", in_progress: "🔵", done: "🟢" };
export const PART_STATUS_LABELS = { not_started: "Pas commencé", in_progress: "En cours", done: "Terminé" };

export async function createProject(data) {
  const project = await storage.put(COLLECTION, {
    name: data.name,
    objective: data.objective || "",
    successCriteria: data.successCriteria || "",
    color: data.color || "#4C56C4",
    category: data.category || null,
    status: "active", // active | done | archived
    steps: buildSteps("project"), // canevas Projet (§17, §78.9) — cochable depuis la fiche
    parts: [],
    order: data.order ?? Date.now(),
    notesLog: [], // journal de notes horodaté du projet, voir addNote() plus bas
  });
  await storage.logHistory("Project", project.id, "created", { name: project.name });
  return project;
}

/** Coche/décoche une étape du canevas — jamais un remplacement complet du tableau depuis la
 *  vue, pour ne jamais écraser une étape cochée entre-temps par une autre fenêtre/onglet.
 *  `doneAt` horodate la coche (retour de Charles-Henri : voir quand un élément a été traité). */
export async function toggleStep(id, stepKey, done) {
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Projet introuvable : " + id);
  const steps = (current.steps || []).map((s) => (s.key === stepKey ? { ...s, done, doneAt: done ? Date.now() : null } : s));
  return storage.put(COLLECTION, { ...current, steps });
}

export async function addPart(id, label) {
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Projet introuvable : " + id);
  const parts = [...(current.parts || []), { id: generateId(), label, status: "not_started", notesLog: [] }];
  return storage.put(COLLECTION, { ...current, parts });
}

export async function updatePartStatus(id, partId, status) {
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Projet introuvable : " + id);
  const parts = (current.parts || []).map((p) => (p.id === partId ? { ...p, status } : p));
  return storage.put(COLLECTION, { ...current, parts });
}

export async function removePart(id, partId) {
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Projet introuvable : " + id);
  const parts = (current.parts || []).filter((p) => p.id !== partId);
  return storage.put(COLLECTION, { ...current, parts });
}

/**
 * Journal de notes horodaté du PROJET lui-même (voir addNote() dans domain/tasks.js pour le
 * principe complet). Distinct de addPartNote() ci-dessous, qui note une sous-partie précise.
 */
export async function addNote(id, text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Projet introuvable : " + id);
  const notesLog = [...(current.notesLog || []), { id: generateId(), text: trimmed, createdAt: Date.now() }];
  const updated = await storage.put(COLLECTION, { ...current, notesLog });
  await storage.logHistory("Project", id, "note_added", { text: trimmed });
  return updated.notesLog;
}

/**
 * Journal de notes horodaté d'une SOUS-PARTIE (retour de Charles-Henri, 01/09/2026 : pouvoir
 * suivre "où en est l'équipe" sur un bloc avec un complément daté, pas juste un statut à trois
 * états). Le tableau vit sur le sous-objet `part.notesLog`, jamais sur le projet directement —
 * même principe d'embarquement que `parts` lui-même (une fiche projet possède ses sous-parties,
 * jamais partagées). Ne journalise pas dans l'Historique global du projet (bruit trop fin pour
 * un fil déjà partagé avec Tâches/Suivis/Réunions/Décisions) — la fiche affiche directement la
 * dernière note + son historique complet sur la ligne de la sous-partie concernée.
 */
export async function addPartNote(id, partId, text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Projet introuvable : " + id);
  const parts = (current.parts || []).map((p) =>
    p.id === partId ? { ...p, notesLog: [...(p.notesLog || []), { id: generateId(), text: trimmed, createdAt: Date.now() }] } : p
  );
  const updated = await storage.put(COLLECTION, { ...current, parts });
  return updated.parts.find((p) => p.id === partId)?.notesLog || [];
}

export async function updateProject(id, patch) {
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Projet introuvable : " + id);
  const updated = await storage.put(COLLECTION, { ...current, ...patch });
  await storage.logHistory("Project", id, "updated", { patch });
  return updated;
}

export function getProject(id) {
  return storage.get(COLLECTION, id);
}

export function listAll() {
  return storage.listAll(COLLECTION);
}

export function subscribe(callback) {
  return storage.subscribe(COLLECTION, callback);
}

/**
 * Supprime le projet. Ne supprime PAS en cascade les tâches/suivis/réunions/décisions/
 * ressources qui lui étaient rattachés — ils gardent leur projectId, qui pointe simplement
 * dans le vide (aucune vue ne plante pour autant : le badge projet disparaît juste). Une
 * suppression en cascade serait plus risquée qu'utile pour un usage strictement personnel.
 */
export async function removeProject(id) {
  await storage.logHistory("Project", id, "deleted", {});
  return storage.remove(COLLECTION, id);
}

/**
 * Calcule l'avancement d'un projet à partir de ses tâches (§37). `tasks` doit déjà être
 * filtré sur le projet — cette fonction ne fait que compter, jamais d'accès storage, pour
 * rester utilisable aussi bien côté Dashboard que côté fiche projet.
 */
export function computeProgress(tasks) {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  let blocked = 0;
  for (const task of tasks) {
    if (counts[task.status] !== undefined) counts[task.status]++;
    if (task.isBlocked) blocked++;
  }
  const total = tasks.length;
  const percent = total ? Math.round((counts.done / total) * 100) : 0;
  return { total, percent, blocked, ...counts };
}

/**
 * Tri unique pour l'onglet Projets ET le Dashboard (retour de Charles-Henri : l'accueil doit
 * reprendre l'ordonnancement de l'onglet Projets, pas avoir sa propre logique) — `tasksByProject`
 * n'est nécessaire qu'en mode "progress" (calcul de l'avancement).
 */
export function sortProjects(projects, mode, tasksByProject = new Map()) {
  const list = [...projects];
  if (mode === "progress") {
    return list.sort((a, b) => {
      const pa = computeProgress(tasksByProject.get(a.id) || []).percent;
      const pb = computeProgress(tasksByProject.get(b.id) || []).percent;
      return pb - pa;
    });
  }
  return list.sort((a, b) => (a.order ?? a.createdAt ?? 0) - (b.order ?? b.createdAt ?? 0));
}

/** Ordonnancement manuel (glisser-déposer, onglet Projets) : réécrit `order` = position dans
 *  la liste donnée pour chaque projet. */
export async function reorderProjects(orderedIds) {
  await Promise.all(orderedIds.map((id, index) => updateProject(id, { order: index })));
}
