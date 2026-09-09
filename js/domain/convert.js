// Changement de type d'un élément mal qualifié (retour de Charles-Henri, vague 40, 09/09/2026 :
// "si je me suis trompé de type, je dois supprimer et recréer, il faudrait que je puisse
// éventuellement le changer") — trou fonctionnel déjà identifié comme point de friction
// fréquent (confusion Tâche/Suivi notamment, voir js/domain/followups.js §31/§32).
//
// Portée retenue : Tâche ⟷ Suivi, Tâche ⟷ Information/Idée, Suivi ⟷ Information/Idée — les
// trois confusions plausibles à la capture. PAS de conversion vers/depuis Projet (entité bien
// plus lourde — objectifs, avancement calculé, santé — trop de pertes de sens dans une
// conversion automatique pour être fiable) : une erreur de ce type-là reste à corriger à la
// main (créer le bon, migrer ce qui compte, supprimer l'ancien), comme aujourd'hui.
//
// Limite assumée : l'historique (js/domain/history.js) N'EST PAS transféré d'une collection à
// l'autre — chaque entité a son propre fil, et Firestore ne fusionne pas deux documents. On
// pose un repère explicite des deux côtés ("converted_to_x" / "converted_from_y") pour qu'on
// puisse au moins retrouver le lien en relisant l'historique de l'ancienne ET de la nouvelle
// entité, plutôt que la coupure totale du "supprimer puis recréer" d'avant cette vague. Les
// éléments liés (js/components/linkedItems.js) référençant l'ancienne entité par son
// {type, id} deviennent orphelins après conversion — non traité ici (même limite que la
// suppression pure et simple déjà existante).

import * as storage from "../services/storage.js?v=3";
import * as tasksApi from "./tasks.js?v=3";
import * as followUpsApi from "./followups.js?v=3";
import * as inboxApi from "./inbox.js?v=3";

function taskToRawContent(task) {
  return task.description ? `${task.title}\n\n${task.description}` : task.title;
}
function followUpToRawContent(followUp) {
  return followUp.description ? `${followUp.title}\n\n${followUp.description}` : followUp.title;
}

/** Tâche → Suivi. Un Suivi doit obligatoirement être rattaché à une personne — la Tâche n'en a
 *  pas, `personId` est donc requis en paramètre (demandé à la volée côté vue). */
export async function convertTaskToFollowUp(task, { personId, direction = "waiting_on" } = {}) {
  if (!personId) throw new Error("Un suivi doit être rattaché à une personne.");
  const followUp = await followUpsApi.createFollowUp({
    title: task.title,
    personId,
    direction,
    description: task.description || "",
    dueDate: task.dueDate || null,
    projectId: task.projectId || null,
  });
  await storage.logHistory("Task", task.id, "converted_to_followup", { followUpId: followUp.id });
  await storage.logHistory("FollowUp", followUp.id, "converted_from_task", { taskId: task.id, title: task.title });
  await tasksApi.removeTask(task.id);
  return followUp;
}

/** Suivi → Tâche. La personne rattachée est perdue (une Tâche n'a pas ce concept) — le nom de
 *  la personne est reporté dans la description pour ne pas disparaître silencieusement. */
export async function convertFollowUpToTask(followUp, personName = "") {
  const description = personName
    ? `${followUp.description || ""}${followUp.description ? "\n\n" : ""}(Suivi initialement rattaché à ${personName})`
    : followUp.description || "";
  const task = await tasksApi.createTask({
    title: followUp.title,
    description,
    dueDate: followUp.dueDate || null,
    projectId: followUp.projectId || null,
  });
  await storage.logHistory("FollowUp", followUp.id, "converted_to_task", { taskId: task.id });
  await storage.logHistory("Task", task.id, "converted_from_followup", { followUpId: followUp.id, title: followUp.title });
  await followUpsApi.removeFollowUp(followUp.id);
  return task;
}

/** Tâche → Information/Idée (§47) : redevient un InboxItem "kept", visible partout où les
 *  informations/idées le sont déjà (Dashboard, recherche globale). */
export async function convertTaskToKept(task, keptAsType = "kept") {
  const item = await inboxApi.capture(taskToRawContent(task), "converted");
  await inboxApi.qualify(item.id, keptAsType);
  await storage.logHistory("Task", task.id, "converted_to_kept", { inboxItemId: item.id, asType: keptAsType });
  await tasksApi.removeTask(task.id);
  return item;
}

/** Suivi → Information/Idée — même principe, la personne rattachée n'est pas reportée (une
 *  Information/Idée n'a pas ce concept) ; elle reste néanmoins nommée dans le texte brut. */
export async function convertFollowUpToKept(followUp, keptAsType = "kept", personName = "") {
  const rawContent = personName ? `${followUpToRawContent(followUp)}\n\n(Suivi initialement rattaché à ${personName})` : followUpToRawContent(followUp);
  const item = await inboxApi.capture(rawContent, "converted");
  await inboxApi.qualify(item.id, keptAsType);
  await storage.logHistory("FollowUp", followUp.id, "converted_to_kept", { inboxItemId: item.id, asType: keptAsType });
  await followUpsApi.removeFollowUp(followUp.id);
  return item;
}

/** Information/Idée → Tâche — l'InboxItem passe par le même chemin de qualification que
 *  depuis l'Inbox (`inboxApi.qualify`), sans distinction : "kept" n'est jamais qu'une
 *  qualification parmi d'autres, on peut toujours la corriger. */
export async function convertKeptToTask(item, { projectId, dueDate } = {}) {
  const result = await inboxApi.qualify(item.id, "task", {
    title: item.rawContent.slice(0, 120),
    description: item.rawContent,
    projectId: projectId || null,
    dueDate: dueDate || null,
  });
  return result.task;
}

/** Information/Idée → Suivi — nécessite `personId`, comme convertTaskToFollowUp ci-dessus. */
export async function convertKeptToFollowUp(item, { personId, direction = "waiting_on", projectId, dueDate } = {}) {
  if (!personId) throw new Error("Un suivi doit être rattaché à une personne.");
  const followUp = await followUpsApi.createFollowUp({
    title: item.rawContent.slice(0, 120),
    personId,
    direction,
    description: item.rawContent,
    projectId: projectId || null,
    dueDate: dueDate || null,
  });
  await inboxApi.qualify(item.id, "followup", { id: followUp.id });
  return followUp;
}
