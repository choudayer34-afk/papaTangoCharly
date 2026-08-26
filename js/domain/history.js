// Historique / mémoire (§46). Le moteur d'écriture (storage.logHistory, §78.23) existe
// depuis le début et est déjà appelé par tous les domaines ; ce module n'ajoute que la
// lecture et une présentation lisible — pour que "qu'est-ce qui a été fait, quand" devienne
// une vraie question qu'on peut poser à l'app plutôt qu'à sa mémoire (§46, exemple :
// 25/08 — Demande reçue / 27/08 — Réunion / 27/08 — Décision / 29/08 — Action créée...).

import * as storage from "../services/storage.js";

const COLLECTION = "history";

const ACTION_META = {
  "InboxItem:captured": { emoji: "📥", label: "Capture reçue" },
  "InboxItem:qualified_as_task": { emoji: "✅", label: "Qualifié en action" },
  "InboxItem:qualified_as_followup": { emoji: "👀", label: "Qualifié en suivi" },
  "InboxItem:qualified_as_project": { emoji: "📦", label: "Qualifié en projet" },
  "InboxItem:qualified_as_meeting": { emoji: "📅", label: "Qualifié en réunion" },
  "InboxItem:qualified_as_decision": { emoji: "🗳️", label: "Qualifié en décision" },
  "InboxItem:qualified_as_resource": { emoji: "📎", label: "Qualifié en ressource" },
  "InboxItem:archived": { emoji: "🗑️", label: "Archivé" },
  "InboxItem:kept": { emoji: "🧠", label: "Conservé en information" },
  "Task:created": { emoji: "✅", label: "Tâche créée" },
  "Task:status_changed": { emoji: "🔁", label: "Statut changé" },
  "Task:updated": { emoji: "✏️", label: "Tâche modifiée" },
  "Project:created": { emoji: "📦", label: "Projet créé" },
  "Project:updated": { emoji: "✏️", label: "Projet modifié" },
  "Person:created": { emoji: "👤", label: "Personne ajoutée" },
  "Person:updated": { emoji: "✏️", label: "Personne modifiée" },
  "FollowUp:created": { emoji: "👀", label: "Suivi créé" },
  "FollowUp:updated": { emoji: "✏️", label: "Suivi modifié" },
  "Resource:created": { emoji: "📎", label: "Ressource ajoutée" },
  "Resource:updated": { emoji: "✏️", label: "Ressource modifiée" },
  "Meeting:created": { emoji: "🗓️", label: "Réunion créée" },
  "Meeting:updated": { emoji: "✏️", label: "Réunion modifiée" },
  "Decision:created": { emoji: "🗳️", label: "Décision enregistrée" },
  "Decision:updated": { emoji: "✏️", label: "Décision modifiée" },
};

export function listAll() {
  return storage.listAll(COLLECTION);
}

export function subscribe(callback) {
  return storage.subscribe(COLLECTION, callback);
}

/**
 * Traduit une entrée brute {entityType, entityId, action, date, metadata} en
 * {emoji, label, detail} prêt à afficher, sans jamais planter si la forme des métadonnées
 * varie d'un domaine à l'autre — un type/action non prévu retombe sur un libellé générique
 * plutôt que de casser l'affichage.
 */
export function describe(entry) {
  const meta = ACTION_META[`${entry.entityType}:${entry.action}`] || {
    emoji: "•",
    label: `${entry.entityType} — ${entry.action}`,
  };
  let detail = entry.metadata?.title || entry.metadata?.name || "";
  if (!detail && entry.action === "status_changed" && entry.metadata?.from && entry.metadata?.to) {
    detail = `${entry.metadata.from} → ${entry.metadata.to}`;
  }
  return { emoji: meta.emoji, label: meta.label, detail };
}
