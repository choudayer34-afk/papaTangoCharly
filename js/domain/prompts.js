// Bibliothèque de prompts IA (retour de Charles-Henri) : un espace de stockage pour les
// prompts qu'il réutilise, avec leur description, pour pouvoir les envoyer facilement vers
// Copilot/ChatGPT/Claude. Version simple délibérée à l'origine : pas de catégorisation ni de
// rattachement au fil conducteur pour cette première passe (décision prise avec Charles-Henri).
//
// Lien vers une Tâche (retour de Charles-Henri, 07/09/2026 : "dans une tâche j'aimerai pouvoir
// lier un prompt") — revient sur ce choix initial, mais SEULEMENT pour la Tâche, pas pour le
// fil conducteur générique "🔗 Lié" : un prompt est un outil réutilisable qu'on garde sous la
// main pendant qu'on travaille, exactement comme une Ressource (js/domain/resources.js), pas
// un élément de contexte lié à un sujet. Même mécanique que Resource : un simple `taskIds`
// (many-to-many, un même prompt peut servir à plusieurs tâches) plutôt qu'un lien dans la
// collection `links` — voir js/views/kanban.js#openTaskDetail pour la section "🤖 Prompts",
// construite en symétrie exacte de "📎 Ressources". Toujours pas de catégorisation : seul le
// rattachement à une Tâche a été demandé.

import * as storage from "../services/storage.js?v=3";

const COLLECTION = "prompts";

export async function createPrompt(data) {
  const prompt = await storage.put(COLLECTION, {
    title: data.title,
    description: data.description || "",
    text: data.text,
    taskIds: data.taskIds || [],
  });
  await storage.logHistory("Prompt", prompt.id, "created", { title: prompt.title });
  return prompt;
}

function toggleLink(idList, id, shouldLink) {
  const set = new Set(idList || []);
  if (shouldLink) set.add(id);
  else set.delete(id);
  return [...set];
}

/** Lie/délie un prompt à une tâche — même signature que resourcesApi.linkToTask. */
export async function linkToTask(promptId, taskId, shouldLink = true) {
  const current = await storage.get(COLLECTION, promptId);
  if (!current) throw new Error("Prompt introuvable : " + promptId);
  return storage.put(COLLECTION, { ...current, taskIds: toggleLink(current.taskIds, taskId, shouldLink) });
}

export async function updatePrompt(id, patch) {
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Prompt introuvable : " + id);
  const updated = await storage.put(COLLECTION, { ...current, ...patch });
  await storage.logHistory("Prompt", id, "updated", { patch });
  return updated;
}

export function listAll() {
  return storage.listAll(COLLECTION);
}

export function subscribe(callback) {
  return storage.subscribe(COLLECTION, callback);
}

export async function removePrompt(id) {
  await storage.logHistory("Prompt", id, "deleted", {});
  return storage.remove(COLLECTION, id);
}
