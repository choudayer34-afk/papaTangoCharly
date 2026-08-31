// Bibliothèque de prompts IA (retour de Charles-Henri) : un espace de stockage pour les
// prompts qu'il réutilise, avec leur description, pour pouvoir les envoyer facilement vers
// Copilot/ChatGPT/Claude. Version simple délibérée : pas de catégorisation ni de rattachement
// au fil conducteur pour cette première passe (décision prise avec Charles-Henri) — juste
// titre, description et texte, avec une recherche texte côté vue.

import * as storage from "../services/storage.js";

const COLLECTION = "prompts";

export async function createPrompt(data) {
  const prompt = await storage.put(COLLECTION, {
    title: data.title,
    description: data.description || "",
    text: data.text,
  });
  await storage.logHistory("Prompt", prompt.id, "created", { title: prompt.title });
  return prompt;
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
