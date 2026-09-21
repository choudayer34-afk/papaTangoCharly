// Historique / mémoire (§46). Le moteur d'écriture (storage.logHistory, §78.23) existe
// depuis le début et est déjà appelé par tous les domaines ; ce module n'ajoute que la
// lecture et une présentation lisible — pour que "qu'est-ce qui a été fait, quand" devienne
// une vraie question qu'on peut poser à l'app plutôt qu'à sa mémoire (§46, exemple :
// 25/08 — Demande reçue / 27/08 — Réunion / 27/08 — Décision / 29/08 — Action créée...).

import * as storage from "../services/storage.js";

const COLLECTION = "history";

// Politique de rétention (TODO-011, LOT 4B, 21/09/2026 — documentation uniquement, aucune purge
// implémentée à ce stade) : décision produit du 15/09/2026 (voir TODO_TECHNIQUE.md, section 1) —
// conservation cible de 24 à 36 mois pour cette collection. Au-delà de cette fenêtre, toute purge
// ou anonymisation ne pourra intervenir qu'après une confirmation explicite de l'utilisateur —
// jamais une suppression automatique ou silencieuse, cohérent avec la promesse produit "ne rien
// perdre silencieusement". Contrairement à `usageEvents` (js/services/usageTracking.js), rien
// dans les règles Firestore n'empêche techniquement une suppression ici (`history` vit sous
// `users/{uid}/{document=**}`, en écriture complète pour son propriétaire) — seule
// l'IMPLÉMENTATION de l'écran de purge assistée avec confirmation reste à faire, voir TODO-036
// (section 5, TODO_TECHNIQUE.md). Cette collection grandit aujourd'hui sans aucune purge
// (`storage.logHistory()` n'écrit jamais que de nouvelles entrées, jamais de suppression).

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
  "Task:deleted": { emoji: "🗑️", label: "Tâche supprimée" },
  "Project:created": { emoji: "📦", label: "Projet créé" },
  "Project:updated": { emoji: "✏️", label: "Projet modifié" },
  "Project:deleted": { emoji: "🗑️", label: "Projet supprimé" },
  "Person:created": { emoji: "👤", label: "Personne ajoutée" },
  "Person:updated": { emoji: "✏️", label: "Personne modifiée" },
  "Person:deleted": { emoji: "🗑️", label: "Personne supprimée" },
  "FollowUp:created": { emoji: "👀", label: "Suivi créé" },
  "FollowUp:updated": { emoji: "✏️", label: "Suivi modifié" },
  "FollowUp:deleted": { emoji: "🗑️", label: "Suivi supprimé" },
  "Resource:created": { emoji: "📎", label: "Ressource ajoutée" },
  "Resource:updated": { emoji: "✏️", label: "Ressource modifiée" },
  "Resource:deleted": { emoji: "🗑️", label: "Ressource supprimée" },
  "Meeting:created": { emoji: "🗓️", label: "Réunion créée" },
  "Meeting:updated": { emoji: "✏️", label: "Réunion modifiée" },
  "Meeting:deleted": { emoji: "🗑️", label: "Réunion supprimée" },
  "Decision:created": { emoji: "🗳️", label: "Décision enregistrée" },
  "Decision:updated": { emoji: "✏️", label: "Décision modifiée" },
  "Decision:deleted": { emoji: "🗑️", label: "Décision supprimée" },
  // Grille de décision structurée (§49, retour de Charles-Henri : "la logique de la décision
  // resterait tracée dans l'historique, retrouvable trois mois plus tard") — entrée dédiée et
  // lisible plutôt que noyée dans "Décision modifiée", voir js/domain/decisions.js#saveGrid().
  "Decision:grid_recorded": { emoji: "⚖️", label: "Grille de décision enregistrée" },
  "Decision:grid_removed": { emoji: "⚖️", label: "Grille de décision retirée" },
  // BUG corrigé (15/09/2026, audit "anomalies silencieuses") : ces actions, journalisées de
  // longue date par js/domain/convert.js et js/domain/inbox.js, n'avaient jamais leur entrée
  // ici — elles retombaient sur le libellé générique "EntityType — action" plutôt qu'une icône
  // et un texte lisibles, seule anomalie visible (aucune perte de données, l'entrée existait
  // bel et bien dans l'historique, juste mal présentée).
  "Task:converted_to_followup": { emoji: "🔁", label: "Converti en suivi" },
  "Task:converted_from_followup": { emoji: "🔁", label: "Devenu une tâche (depuis un suivi)" },
  "Task:converted_to_kept": { emoji: "🔁", label: "Converti en information/idée" },
  "FollowUp:converted_from_task": { emoji: "🔁", label: "Devenu un suivi (depuis une tâche)" },
  "FollowUp:converted_to_task": { emoji: "🔁", label: "Converti en tâche" },
  "FollowUp:converted_to_kept": { emoji: "🔁", label: "Converti en information/idée" },
  "InboxItem:raw_content_edited": { emoji: "✏️", label: "Texte de la capture corrigé" },
  "InboxItem:project_set": { emoji: "📦", label: "Projet rattaché" },
  // BUG corrigé (15/09/2026, audit "anomalies silencieuses" : journalisation manquante) —
  // js/domain/projects.js#addPart/updatePartStatus/removePart et js/domain/tasks.js#
  // addOutlookMeeting/removeOutlookMeeting ne journalisaient rien du tout jusqu'ici.
  "Project:part_added": { emoji: "🧩", label: "Sous-partie ajoutée" },
  "Project:part_status_changed": { emoji: "🧩", label: "Statut de sous-partie changé" },
  "Project:part_removed": { emoji: "🧩", label: "Sous-partie retirée" },
  "Task:outlook_meeting_added": { emoji: "🗓️", label: "Réunion Outlook associée" },
  "Task:outlook_meeting_removed": { emoji: "🗓️", label: "Réunion Outlook dissociée" },
};

// Le "fil conducteur" (§ retour de Charles-Henri : "les éléments semblent séparés") ajoute
// deux actions communes à tous les types plutôt que d'écrire 14 entrées à la main.
for (const type of ["Task", "Project", "Person", "FollowUp", "Resource", "Meeting", "Decision"]) {
  ACTION_META[`${type}:linked`] = { emoji: "🔗", label: "Lien ajouté" };
  ACTION_META[`${type}:unlinked`] = { emoji: "🔗", label: "Lien retiré" };
}

// Journal de notes (§ retour de Charles-Henri, 01/09/2026) — une note ajoutée sur n'importe
// quel type de fiche apparaît aussi dans son historique, comme n'importe quel autre événement.
for (const type of ["Task", "Project", "Person", "FollowUp", "Resource", "Meeting", "Decision", "InboxItem"]) {
  ACTION_META[`${type}:note_added`] = { emoji: "🗒️", label: "Note ajoutée" };
}

// Tags universels (§ retour de Charles-Henri, 13/09/2026, voir js/domain/tags.js) — posés sur
// les 9 types de fiches qui acceptent un tag (js/components/tagsEditor.js) ; "Kept" est le
// type utilisé par tags.js pour une Information/Idée, distinct de "InboxItem" (utilisé lui pour
// ses propres notes/historique) — BUG corrigé (15/09/2026, audit "anomalies silencieuses") :
// absent d'ici jusqu'ici, comme "Objective".
for (const type of ["Task", "Project", "Person", "FollowUp", "Resource", "Meeting", "Decision", "Kept", "Objective"]) {
  ACTION_META[`${type}:tag_added`] = { emoji: "#️⃣", label: "Tag ajouté" };
  ACTION_META[`${type}:tag_removed`] = { emoji: "#️⃣", label: "Tag retiré" };
}

export function listAll() {
  return storage.listAll(COLLECTION);
}

// BUG corrigé (15/09/2026, audit performance) : voir le commentaire de storage.js#listWhere —
// utilisé par les fiches Tâche/Ressource/Personne pour n'aller chercher que LEUR historique
// plutôt que la collection entière (js/views/kanban.js#openTaskDetail,
// js/views/resources.js#openResourceDetail, js/views/people.js — fiche Personne). Filtres
// d'égalité uniquement (entityType + entityId), donc jamais besoin d'index composite.
export function listForEntity(entityType, entityId) {
  return storage.listWhere(COLLECTION, [
    ["entityType", entityType],
    ["entityId", entityId],
  ]);
}

/** Même correctif que `listForEntity` ci-dessus, pour les fiches dont l'historique affiché est
 *  celui de PLUSIEURS entités à la fois (ex. fiche Personne : elle-même + tous ses Suivis, voir
 *  js/views/people.js ; fiche Projet : lui-même + ses Tâches/Suivis/Ressources liés, voir
 *  js/views/projects.js). Une requête par entité plutôt qu'un `in` groupé par type : reste dans
 *  le cas 100% "filtres d'égalité" qui ne demande jamais d'index composite (voir storage.js#
 *  listWhere) — le nombre d'entités liées à une fiche reste toujours mesuré en unités, jamais en
 *  milliers comme l'historique global, donc le coût de plusieurs petites requêtes en parallèle
 *  reste largement inférieur à celui de tout rapatrier. `refs` = [{entityType, entityId}, ...]. */
export async function listForEntities(refs) {
  const results = await Promise.all(refs.map((r) => listForEntity(r.entityType, r.entityId)));
  return results.flat();
}

// BUG corrigé (15/09/2026, audit performance) : voir js/views/dashboard.js#openGlobalHistory,
// qui téléchargeait toute la collection pour n'en garder que les `limitCount` plus récentes.
export function listRecent(limitCount) {
  return storage.listRecent(COLLECTION, "date", limitCount);
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
  let detail = "";
  if (entry.action === "part_status_changed" && entry.metadata?.status) {
    detail = `${entry.metadata.label ? entry.metadata.label + " · " : ""}${entry.metadata.status}`;
  }
  if (!detail) detail = entry.metadata?.title || entry.metadata?.name || entry.metadata?.label || "";
  if (!detail && entry.action === "note_added" && entry.metadata?.text) {
    detail = entry.metadata.text.length > 60 ? entry.metadata.text.slice(0, 60) + "…" : entry.metadata.text;
  }
  if (!detail && entry.action === "status_changed" && entry.metadata?.from && entry.metadata?.to) {
    detail = `${entry.metadata.from} → ${entry.metadata.to}`;
  }
  if (!detail && entry.action === "linked" && entry.metadata?.to) {
    detail = `Lié à ${entry.metadata.to.label || entry.metadata.to.type}`;
  }
  if (!detail && entry.action === "unlinked" && entry.metadata?.from) {
    detail = `Délié de ${entry.metadata.from.label || entry.metadata.from.type}`;
  }
  if (!detail && entry.action === "grid_recorded" && entry.metadata?.recommended) {
    detail = `${entry.metadata.recommended} conseillée · ${entry.metadata.summary || ""}`.trim();
  }
  if (!detail && (entry.action === "tag_added" || entry.action === "tag_removed") && entry.metadata?.tag) {
    detail = "#" + entry.metadata.tag;
  }
  return { emoji: meta.emoji, label: meta.label, detail };
}
