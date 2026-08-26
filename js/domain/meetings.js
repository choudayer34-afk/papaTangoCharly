// Réunions — §49. Version simplifiée pour l'instant : le strict nécessaire pour qu'une
// réunion capturée depuis l'Inbox (§12/§13) ne soit jamais perdue et reste retrouvable
// (rattachée à un projet si pertinent, sinon visible depuis "🧠 Récemment" au Dashboard —
// voir js/views/dashboard.js). Le déroulé complet Avant/Pendant/Après (objectif, sujets,
// notes, décisions, actions produites) viendra avec les canevas pilotés par données (§14-19,
// §78.9) plutôt que d'être codé en dur ici.

import * as storage from "../services/storage.js";

const COLLECTION = "meetings";

export async function createMeeting(data) {
  const meeting = await storage.put(COLLECTION, {
    title: data.title,
    date: data.date || null,
    objective: data.objective || "",
    notes: data.notes || "",
    participants: data.participants || [],
    projectId: data.projectId || null,
  });
  await storage.logHistory("Meeting", meeting.id, "created", { title: meeting.title });
  return meeting;
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
