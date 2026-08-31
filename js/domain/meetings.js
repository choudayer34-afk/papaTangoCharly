// Réunions — §49. Version simplifiée pour l'instant : le strict nécessaire pour qu'une
// réunion capturée depuis l'Inbox (§12/§13) ne soit jamais perdue et reste retrouvable
// (rattachée à un projet si pertinent, sinon visible depuis "🧠 Récemment" au Dashboard —
// voir js/views/dashboard.js). Le déroulé complet Avant/Pendant/Après (objectif, sujets,
// notes, décisions, actions produites) viendra avec les canevas pilotés par données (§14-19,
// §78.9) plutôt que d'être codé en dur ici.

import * as storage from "../services/storage.js";
import { buildSteps } from "./templates.js";

const COLLECTION = "meetings";

/** Deux canevas possibles pour une réunion (§15 générique, §16 point collaborateur) —
 *  choisi à la création, "none" laisse la fiche sans canevas (ex. réunions déjà créées avant
 *  cette livraison). */
export const CANEVAS_OPTIONS = [
  { key: "none", label: "Aucun canevas" },
  { key: "meeting", label: "🗓️ Réunion (générique)" },
  { key: "one_on_one", label: "👀 Point collaborateur" },
];

export async function createMeeting(data) {
  const canevasKey = data.canevasKey && data.canevasKey !== "none" ? data.canevasKey : null;
  const meeting = await storage.put(COLLECTION, {
    title: data.title,
    date: data.date || null,
    objective: data.objective || "",
    notes: data.notes || "",
    participants: data.participants || [],
    projectId: data.projectId || null,
    canevasKey,
    steps: canevasKey ? buildSteps(canevasKey) : [],
  });
  await storage.logHistory("Meeting", meeting.id, "created", { title: meeting.title });
  return meeting;
}

/** Coche/décoche une étape du canevas — voir le même principe côté projects.js (jamais un
 *  remplacement complet du tableau). `doneAt` horodate la coche (affiché par
 *  js/components/canevas.js). */
export async function toggleStep(id, stepKey, done) {
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Réunion introuvable : " + id);
  const steps = (current.steps || []).map((s) => (s.key === stepKey ? { ...s, done, doneAt: done ? Date.now() : null } : s));
  return storage.put(COLLECTION, { ...current, steps });
}

export async function updateMeeting(id, patch) {
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Réunion introuvable : " + id);
  const updated = await storage.put(COLLECTION, { ...current, ...patch });
  await storage.logHistory("Meeting", id, "updated", { patch });
  return updated;
}

export function getMeeting(id) {
  return storage.get(COLLECTION, id);
}

export function listAll() {
  return storage.listAll(COLLECTION);
}

export function subscribe(callback) {
  return storage.subscribe(COLLECTION, callback);
}

export async function removeMeeting(id) {
  await storage.logHistory("Meeting", id, "deleted", {});
  return storage.remove(COLLECTION, id);
}
