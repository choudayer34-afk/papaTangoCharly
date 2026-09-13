// Tags universels (retour de Charles-Henri, 13/09/2026 : "les tags peuvent être associé à
// n'importe quel élément d'une info au projet au suivi, etc." + "toujours préfixé par #") —
// généralisation du système de tags qui n'existait jusqu'ici que sur les Informations/Idées
// (js/domain/inbox.js#addKeptTag, vague 44) aux 9 types de fiches de l'app.
//
// Collection dédiée { entityType, entityId, tag } — un document par (fiche, tag) — plutôt qu'un
// tableau `tags` embarqué dans chaque entité : même principe que links.js (le StorageAdapter ne
// garantit aucune transaction multi-documents, donc un tableau à dupliquer sur 9 types de
// fiches différents serait plus fragile qu'une source unique) ET ça permet de répondre
// "quelles fiches portent ce tag ?" (`entitiesForTag`) sans devoir charger et scanner les 9
// collections à chaque frappe de la recherche globale par "#" (voir js/components/search.js).
//
// `entityType`/`entityId` plutôt que `type`/`id` tout court (bug rencontré en test) : `storage.
// put()` (js/services/storage.js) traite tout champ `id` fourni comme l'id DU DOCUMENT lui-même
// — passer directement l'id de la fiche taguée sous la clé `id` ferait donc écraser un tag
// existant par le suivant posé sur la même fiche (même document réutilisé à chaque fois) au lieu
// d'empiler un document par tag. Chaque document garde ici son propre id auto-généré, et
// `entityType`/`entityId` désignent la fiche taguée — même distinction que `history.js`
// (`entityType`/`entityId` sur logHistory).
//
// Le "#" n'est qu'un habillage d'affichage/de saisie (voir js/components/tagsEditor.js et
// search.js) — jamais persisté : un tag est toujours stocké SANS son "#" (`stripHash`), pour
// que "#Urgent" et "urgent" tapés à des moments différents restent le même tag.

import * as storage from "../services/storage.js";
import * as inboxApi from "./inbox.js";

const COLLECTION = "tags";

/** Enlève un éventuel "#" en tête (et les espaces superflus) — n'importe où le tag est saisi
 *  (avec ou sans #, retour de Charles-Henri : l'affichage l'impose toujours, la saisie reste
 *  tolérante), le "#" ne doit jamais faire partie du texte réellement stocké. */
export function stripHash(raw) {
  return (raw || "").trim().replace(/^#+/, "").trim();
}

function normalize(tag) {
  return stripHash(tag).toLowerCase();
}

/** Ajoute un tag à une fiche {type, id}, sans doublon (insensible à la casse et au "#" —
 *  même principe que addKeptTag() avant elle). Retourne le document existant si le même tag
 *  (normalisé) est déjà posé sur cette fiche, jamais un doublon. */
export async function addTag(type, id, rawTag) {
  const clean = stripHash(rawTag);
  if (!clean) return null;
  const key = normalize(clean);
  const all = await storage.listAll(COLLECTION);
  const existing = all.find((t) => t.entityType === type && t.entityId === id && normalize(t.tag) === key);
  if (existing) return existing;
  const created = await storage.put(COLLECTION, { entityType: type, entityId: id, tag: clean });
  await storage.logHistory(type, id, "tag_added", { tag: clean });
  return created;
}

/** Retire un tag. Prend le document complet (pas juste son id) pour pouvoir journaliser quel
 *  tag a été retiré — même principe que removeLink() dans links.js. */
export async function removeTag(tagDoc) {
  await storage.remove(COLLECTION, tagDoc.id);
  await storage.logHistory(tagDoc.entityType, tagDoc.entityId, "tag_removed", { tag: tagDoc.tag });
}

export function listAll() {
  return storage.listAll(COLLECTION);
}

export function subscribe(callback) {
  return storage.subscribe(COLLECTION, callback);
}

/** Tous les tags (documents complets, pour pouvoir les délier) d'une fiche donnée {type, id}. */
export function tagsFor(allTags, type, id) {
  return allTags.filter((t) => t.entityType === type && t.entityId === id);
}

/** Tous les noms de tags distincts déjà utilisés, triés — pour l'autocomplétion (saisie d'un
 *  tag sur une fiche, ou recherche globale par "#"). */
export function listAllTagNames(allTags) {
  const set = new Set();
  for (const t of allTags) set.add(t.tag);
  return [...set].sort((a, b) => a.localeCompare(b, "fr"));
}

/** Toutes les références {type, id} portant un tag donné (comparaison insensible à la casse
 *  et au "#") — utilisé par la recherche globale en mode "#tag". */
export function entitiesForTag(allTags, rawTag) {
  const key = normalize(rawTag);
  if (!key) return [];
  return allTags.filter((t) => normalize(t.tag) === key).map((t) => ({ type: t.entityType, id: t.entityId }));
}

/**
 * Migration unique (13/09/2026) : les tags posés sur les Informations/Idées avant l'existence
 * de cette collection générique vivaient dans un tableau `tags` embarqué sur l'InboxItem
 * (js/domain/inbox.js#addKeptTag, vague 44). Reprise ici pour ne perdre aucune donnée déjà
 * saisie par Charles-Henri — appelée une seule fois au démarrage (voir js/app.js), protégée
 * par un indicateur dans les préférences (`tagsMigratedV1`, voir js/domain/preferences.js),
 * même principe que `postitMigratedV1`/`dashboardHiddenMigratedV19` avant elle. Idempotente
 * de toute façon (addTag() ne crée jamais de doublon), mais le drapeau évite de la relancer à
 * chaque démarrage pour rien.
 */
export async function migrateInboxTags() {
  const items = await inboxApi.listKeptIncludingArchived();
  for (const item of items) {
    for (const tag of item.tags || []) {
      await addTag("Kept", item.id, tag);
    }
  }
}
