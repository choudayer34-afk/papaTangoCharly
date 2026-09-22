// Inbox — le sas d'entrée (cahier des charges §6, §11, §78.6).
// Principe non négociable : une capture ne devient JAMAIS directement une tâche.
// CAPTURE → InboxItem (status: pending) → Qualification → Task / Information / Archivé.
// Le contenu brut original est toujours conservé, quoi qu'il arrive (Règle 3).

import * as storage from "../services/storage.js";
import { generateId } from "../services/id.js";
import { createTask } from "./tasks.js";
import * as linksApi from "./links.js";
import * as projectsApi from "./projects.js";
import * as followUpsApi from "./followups.js";
import * as meetingsApi from "./meetings.js";
import * as decisionsApi from "./decisions.js";
import * as resourcesApi from "./resources.js";

const COLLECTION = "inboxItems";

/** Capture express : enregistre le texte brut tel quel, sans qualification. */
export async function capture(rawContent, source = "manuel", { notesLog } = {}) {
  const item = await storage.put(COLLECTION, {
    rawContent,
    source,
    status: "pending", // pending | processed | archived | kept
    // `notesLog` optionnel (retour de Charles-Henri, 15/09/2026 : un changement de type
    // Tâche/Suivi → Information ne doit pas faire disparaître le journal de notes déjà pris) —
    // voir js/domain/convert.js#convertTaskToKept/convertFollowUpToKept, seuls appelants à s'en
    // servir aujourd'hui. Absent pour tout appel normal (capture manuelle), comme avant.
    ...(notesLog && notesLog.length ? { notesLog } : {}),
  });
  await storage.logHistory("InboxItem", item.id, "captured", { source });
  return item;
}

export function listPending() {
  return storage.listAll(COLLECTION).then((items) => items.filter((i) => i.status === "pending"));
}

// Ajouté le 21/09/2026 (TODO-009A, LOT 4A) : lire UN élément Inbox par son id, pour
// js/components/linkedItems.js#resolveRef — même besoin que tasksApi.getTask(), voir son
// commentaire. Accesseur brut, SANS filtre de statut (contrairement à listKept() ci-dessous) :
// à l'appelant de vérifier `status` si le filtre importe pour son usage (voir resolveRef, qui ne
// doit résoudre un lien "Kept" que vers un statut "kept", jamais "archived", exactement comme le
// fait aujourd'hui listKept() en amont de fetchBundle()).
export function getInboxItem(id) {
  return storage.get(COLLECTION, id);
}

// BUG corrigé (15/09/2026, audit performance) : subscribePending/subscribeKept/
// subscribeKeptIncludingArchived ouvraient chacune leur propre `storage.subscribe` — donc leur
// propre `onSnapshot` sur TOUTE la collection `inboxItems` — avec juste un filtre différent
// appliqué après coup. Le badge de navigation (js/components/inboxBadge.js) reste monté en
// permanence pour toute la session ; dès que le Dashboard (qui utilise à la fois
// subscribePending ET subscribeKept) ou l'Inbox (subscribePending) étaient ouverts, ça faisait
// jusqu'à 3 écoutes temps réel actives en même temps sur la même collection, chacune retriant et
// redécodant tout à chaque écriture. Un seul flux Firestore partagé désormais : démarré à la
// première inscription, arrêté à la dernière désinscription (compteur de références via
// `rawListeners`), chaque abonnement se contentant d'appliquer son propre filtre sur les mêmes
// données déjà reçues — le badge, le Dashboard et l'Inbox peuvent tous les trois être ouverts en
// même temps sans jamais dépasser une seule écoute réseau sur cette collection.
const rawListeners = new Set();
let rawUnsubscribe = null;
let lastRawItems = null;

function subscribeFiltered(filterFn, callback) {
  const listener = (items) => callback(items.filter(filterFn));
  rawListeners.add(listener);
  if (!rawUnsubscribe) {
    rawUnsubscribe = storage.subscribe(COLLECTION, (items) => {
      lastRawItems = items;
      for (const l of rawListeners) l(items);
    });
  } else if (lastRawItems) {
    // Le flux existe déjà (un autre abonnement l'a démarré) : `onSnapshot` ne rappellera pas
    // spontanément pour ce nouveau venu, on reproduit donc à la main la garantie "callback
    // appelé immédiatement avec l'état courant" que `storage.subscribe` offre normalement.
    listener(lastRawItems);
  }
  return () => {
    rawListeners.delete(listener);
    if (rawListeners.size === 0 && rawUnsubscribe) {
      rawUnsubscribe();
      rawUnsubscribe = null;
      lastRawItems = null;
    }
  };
}

export function subscribePending(callback) {
  return subscribeFiltered((i) => i.status === "pending", callback);
}

/**
 * Éléments qualifiés en "Information" (§47 "information de contexte") : ils ne deviennent
 * jamais une tâche, mais restaient jusqu'ici invisibles une fois qualifiés — retour de
 * Charles-Henri ("les informations, idées, ne remontent pas"). Exposés au Dashboard.
 *
 * TODO-021 (LOT 9, 21/09/2026) — « Information » et « Idée » n'étaient déjà que deux libellés
 * pour un même statut ("kept"), sans nuance réellement exploitée ; fusionnés en un seul libellé
 * utilisateur (décision produit du 15/09/2026, voir js/views/inbox.js#KEPT_TYPE_LABEL). Le champ
 * technique `keptAsType` documenté ci-dessous reste inchangé, y compris sa valeur historique
 * "idea" sur les éléments qualifiés avant cette fusion — seul l'affichage ne la distingue plus.
 */
export function listKept() {
  return storage.listAll(COLLECTION).then((items) => items.filter((i) => i.status === "kept"));
}

export function subscribeKept(callback) {
  return subscribeFiltered((i) => i.status === "kept", callback);
}

/**
 * Retour de Charles-Henri, vague 40, 09/09/2026 : "je n'ai jamais la possibilité de retrouver
 * une information ailleurs" — une fois auto-archivée après 15 jours (voir
 * autoArchiveStaleKept() plus bas), une Information/Idée devenait purement et simplement
 * introuvable : absente de listKept() (donc du Dashboard ET de la recherche globale, voir
 * js/components/search.js), et sans aucune vue pour parcourir les éléments archivés.
 *
 * L'auto-archivage réutilise `qualify(id, "archived")`, le même statut qu'un élément Inbox
 * classé sans suite (jamais devenu une information) — mais `keptAsType` (posé uniquement par
 * qualify() vers "kept"/"idea") survit à ce changement de statut puisque `storage.put` ne fait
 * que fusionner les champs. Sa seule présence permet donc de distinguer, même après archivage,
 * "c'était une information, juste devenue ancienne" de "classé sans suite, jamais une
 * information" — sans avoir besoin d'un champ ou d'un statut supplémentaire.
 */
export function listKeptIncludingArchived() {
  return storage.listAll(COLLECTION).then((items) => items.filter((i) => i.status === "kept" || (i.status === "archived" && i.keptAsType)));
}

export function subscribeKeptIncludingArchived(callback) {
  return subscribeFiltered((i) => i.status === "kept" || (i.status === "archived" && i.keptAsType), callback);
}

const KEPT_MAX_AGE_MS = 15 * 24 * 60 * 60 * 1000;

/**
 * Auto-archivage des Informations/Idées après 15 jours (retour de Charles-Henri du 31/08 :
 * "les info ou idées sont automatiquement archivées au bout de 15 jours") — pour que la
 * section "🧠 Informations & idées" du Dashboard reste naturellement courte plutôt que de
 * s'allonger indéfiniment. L'app n'a pas de tâche de fond côté serveur (tout vit côté client +
 * Firestore) : ce balayage se fait donc au chargement de l'app (voir js/app.js) plutôt que sur
 * une vraie tâche planifiée — un léger différé plutôt qu'un instant exact à J+15, largement
 * suffisant pour ce besoin ("ne pas laisser traîner", pas "supprimer pile à la seconde près").
 * Utilise qualify() comme le bouton "Archiver" manuel existant : même chemin, même historique.
 *
 * BUG corrigé (15/09/2026, audit "anomalies silencieuses") : le calcul se basait sur
 * `item.createdAt` — la date de la capture BRUTE d'origine, pas celle à laquelle l'élément est
 * devenu une Information/Idée (`qualify()` peut être appelé des jours, voire des semaines, après
 * la capture initiale si elle a dormi en Inbox). Une capture qualifiée en "kept" 20 jours après
 * sa création se retrouvait donc auto-archivée dès le balayage suivant, alors qu'elle venait
 * tout juste de devenir visible — contraire à l'intention "15 jours pour la retrouver". `keptAt`
 * (posé par qualify() ci-dessus) horodate désormais précisément ce moment ; `item.createdAt` en
 * repli pour les éléments déjà "kept" avant ce correctif, qui n'ont pas encore ce champ.
 */
export async function autoArchiveStaleKept() {
  const kept = await listKept();
  const cutoff = Date.now() - KEPT_MAX_AGE_MS;
  const stale = kept.filter((item) => (item.keptAt || item.createdAt || 0) < cutoff);
  await Promise.all(stale.map((item) => qualify(item.id, "archived")));
  return stale.length;
}

// Politique de rétention (TODO-011, LOT 4B, 21/09/2026 — documentation uniquement, aucune purge
// implémentée à ce stade) : décision produit du 15/09/2026 (voir TODO_TECHNIQUE.md, section 1) —
// conservation cible de 24 à 36 mois pour l'Inbox archivée (`status: "archived"`, y compris les
// Informations/Idées auto-archivées ci-dessus après 15 jours). Au-delà de cette fenêtre, toute
// purge ou anonymisation ne pourra intervenir qu'après une confirmation explicite de
// l'utilisateur — jamais une suppression automatique ou silencieuse. Point important à ne pas
// confondre : `autoArchiveStaleKept()` ci-dessus ne fait que CHANGER LE STATUT d'un élément
// ("kept" → "archived") après 15 jours, il ne le supprime jamais — la politique de rétention
// documentée ici porte sur une éventuelle suppression DÉFINITIVE, bien plus tard (24-36 mois), des
// éléments déjà archivés, distincte et non encore implémentée. Comme pour `history`
// (js/domain/history.js), rien dans les règles Firestore n'empêche techniquement une suppression
// ici — seule l'implémentation de l'écran de purge assistée reste à faire, voir TODO-036 (section
// 5, TODO_TECHNIQUE.md).

/**
 * Corrige le texte brut d'une capture encore en attente (retour de Charles-Henri, 06/09/2026 :
 * "quand on prend une note rapide, quand elle est dans inbox, je dois pouvoir modifier le
 * titre même si je la qualifie pas") — jusqu'ici, la seule façon de toucher au texte capturé
 * passait par la qualification (openQualifyModal, qui l'affiche en lecture seule) : une
 * capture rapide (dictée, frappe pressée) contient parfois une coquille ou un mot à préciser,
 * et attendre d'avoir choisi Tâche/Suivi/Information/... pour la corriger va à l'encontre de
 * l'esprit "friction minimale" de l'Inbox (§11/§12). Ne change ni le statut ni rien d'autre —
 * la Règle 3 (ne jamais perdre la capture) reste respectée, on corrige juste son texte.
 */
export async function updateRawContent(id, rawContent) {
  const trimmed = (rawContent || "").trim();
  if (!trimmed) throw new Error("Le texte ne peut pas être vide");
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Élément Inbox introuvable : " + id);
    return { rawContent: trimmed };
  });
  await storage.logHistory("InboxItem", id, "raw_content_edited", {});
  return updated;
}

/**
 * Journal de notes horodaté sur une Information/Idée "gardée" (retour de Charles-Henri,
 * 01/09/2026, généralisé à "tout les éléments") — même principe que addNote() dans
 * domain/tasks.js (additif uniquement), mais posé directement ici plutôt que via une fonction
 * updateXxx générique : un InboxItem n'en a pas, ses différents statuts se posent chacun via
 * leur propre chemin dédié (qualify(), capture()...) plutôt qu'un patch libre.
 */
export async function addKeptNote(id, text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Élément Inbox introuvable : " + id);
    return { notesLog: [...(current.notesLog || []), { id: generateId(), text: trimmed, createdAt: Date.now() }] };
  });
  await storage.logHistory("InboxItem", id, "note_added", { text: trimmed });
  return updated.notesLog;
}

// Pour ces issues, l'entité résultante est déjà créée par la vue (js/views/inbox.js), qui
// réutilise directement le domaine et — quand c'est possible — la modale de création déjà
// existante (Projet, Ressource) plutôt que de dupliquer cette logique ici. `qualify()` se
// contente de retenir quel objet a résulté de la capture, pour ne jamais perdre le lien
// entre l'InboxItem original et ce qu'il est devenu (§78.6).
const RESULT_KEY = {
  followup: "resultFollowUpId",
  project: "resultProjectId",
  meeting: "resultMeetingId",
  decision: "resultDecisionId",
  resource: "resultResourceId",
};

// TODO-008 (LOT 6, 21/09/2026, complété le même jour après arbitrage de Charles-Henri sur le
// point 1) — table unique décrivant, pour chaque issue de qualification dont l'entité est créée
// par l'appelant (RESULT_KEY ci-dessus — "task" est traité séparément dans qualify(), l'entité y
// étant déjà en mémoire), comment la retrouver par son id (`get`, pour lire son `projectId` et
// son titre) et comment la nommer dans un lien (`titleField`, même principe que le
// `titleField` déjà utilisé par js/components/linkedItems.js#openCreateFormFor).
// `projectLinkEligible` marque les issues qui posent EN PLUS un lien vers le projet (point 2 de
// TODO-008) quand `projectId` est connu à la création — Project (se lierait à lui-même) et
// Resource (pas de `projectId` à sa création, point 3) en sont exclues, mais les cinq issues
// restent toutes éligibles au lien InboxItem source ↔ entité créée (point 1), posé dans tous les
// cas via linkEntityToInboxSource() plus bas.
const OUTCOME_ENTITY = {
  followup: { type: "FollowUp", get: followUpsApi.getFollowUp, titleField: "title", projectLinkEligible: true },
  project: { type: "Project", get: projectsApi.getProject, titleField: "name", projectLinkEligible: false },
  meeting: { type: "Meeting", get: meetingsApi.getMeeting, titleField: "title", projectLinkEligible: true },
  decision: { type: "Decision", get: decisionsApi.getDecision, titleField: "title", projectLinkEligible: true },
  resource: { type: "Resource", get: resourcesApi.getResource, titleField: "title", projectLinkEligible: false },
};

/**
 * Point 2 de TODO-008 : pose le lien entité créée ↔ projet quand l'entité a effectivement un
 * `projectId` connu. Réutilise linksApi.createLink, exactement le mécanisme déjà écrit pour
 * "+ Créer et lier" (js/components/linkedItems.js#openCreateFormFor) — pas de nouvelle
 * architecture de gestion des liens (point 5 de TODO-008).
 */
async function linkEntityToProjectIfKnown(type, entity, titleField) {
  if (!entity || !entity.projectId) return;
  const project = await projectsApi.getProject(entity.projectId);
  if (!project) return;
  await linksApi.createLink(
    { type, id: entity.id, label: entity[titleField] },
    { type: "Project", id: project.id, label: project.name }
  );
}

/**
 * Point 1 de TODO-008 (arbitrage de Charles-Henri, 21/09/2026) : pose le lien InboxItem source ↔
 * entité créée, pour les six entités concernées (Task, FollowUp, Project, Meeting, Decision,
 * Resource). Réutilise linksApi.createLink comme linkEntityToProjectIfKnown() ci-dessus — seule
 * la RÉSOLUTION du nouveau type de référence "InboxSource" est ajoutée, dans
 * js/components/linkedItems.js#resolveRefDirect, résolue directement par son id (`getInboxItem`,
 * déjà existant), SANS exiger `status === "kept"` (contrairement au type "Kept" existant, qui
 * reste inchangé — voir son commentaire dans linkedItems.js). Un InboxItem qualifié n'est jamais
 * transformé en "kept" par ce mécanisme, et la politique d'auto-archivage à 15 jours
 * (autoArchiveStaleKept() plus haut, qui ne concerne que les Informations/Idées) n'est pas
 * modifiée : si l'InboxItem source venait à disparaître selon son propre cycle de vie, ce lien se
 * comporterait comme n'importe quel autre lien vers un élément disparu ("Élément supprimé"),
 * sans qu'aucune règle de conservation ne soit changée pour l'en préserver.
 */
async function linkEntityToInboxSource(type, entityId, entityLabel, inboxItemId, rawContent) {
  await linksApi.createLink(
    { type, id: entityId, label: entityLabel },
    { type: "InboxSource", id: inboxItemId, label: (rawContent || "").slice(0, 120) }
  );
}

/**
 * Qualifie un élément d'Inbox.
 * - "task"     → crée une vraie Tâche à partir du contenu (le reste des champs se fait
 *                dans la fiche tâche, pas ici — traitement guidé §13, aussi peu de champs
 *                obligatoires que possible).
 * - "followup" / "project" / "meeting" / "decision" / "resource" → l'entité a déjà été
 *                créée côté vue ; on marque juste l'InboxItem traité et on garde le lien
 *                (extra.id) vers l'objet résultant.
 * - "kept"     → l'information est conservée telle quelle, sans devenir une tâche
 *                (§47 "information de contexte").
 * - "archived" → l'élément est classé sans suite.
 * Dans tous les cas, la capture brute originale n'est jamais perdue (Règle 3).
 *
 * TODO-008 (LOT 6, 21/09/2026) : pose aussi, pour les six issues qui créent une entité, le lien
 * InboxItem source ↔ entité créée (point 1, linkEntityToInboxSource ci-dessus) et, quand elle
 * s'applique, le lien entité créée ↔ projet (point 2, linkEntityToProjectIfKnown ci-dessus). Voir
 * le commentaire de OUTCOME_ENTITY ci-dessus pour le détail de qui est éligible à quoi.
 */
export async function qualify(itemId, outcome, extra = {}) {
  // BUG corrigé (15/09/2026, audit "anomalies silencieuses") : lecture et écriture de
  // l'InboxItem regroupées dans un seul storage.update() sérialisé (voir js/services/
  // storage.js) — createTask() ci-dessous écrit dans une AUTRE collection (tasks), ce qui reste
  // sans risque à l'intérieur du callback puisque seule l'écriture sur CET InboxItem est
  // sérialisée par cette clé.
  let task = null;
  // Capturée pour construire le lien InboxSource (TODO-008 point 1) APRÈS le storage.update()
  // ci-dessous, une fois `itemId` seul encore en portée — évite une seconde lecture de
  // l'InboxItem pour récupérer un texte déjà lu une première fois ici.
  let sourceRawContent = null;
  await storage.update(COLLECTION, itemId, async (item) => {
    if (!item) throw new Error("Élément Inbox introuvable : " + itemId);
    sourceRawContent = item.rawContent;

    if (outcome === "task") {
      task = await createTask({
        title: extra.title || item.rawContent.slice(0, 120),
        // La capture brute part toujours dans la description (Règle 3 : ne jamais rien
        // perdre), même quand `extra.description` a été retouché à la qualification — pour
        // ne jamais réduire "titre court" à "seule trace conservée" (retour de
        // Charles-Henri : le détail semblait tronqué à la transformation en action).
        description: extra.description !== undefined ? extra.description : item.rawContent,
        projectId: extra.projectId || null,
        dueDate: extra.dueDate || null,
        type: extra.type || "action",
        sourceInboxItemId: item.id,
      });
      return { status: "processed", resultTaskId: task.id };
    }

    if (RESULT_KEY[outcome]) {
      const patch = { status: "processed" };
      if (extra.id) patch[RESULT_KEY[outcome]] = extra.id;
      return patch;
    }

    if (outcome === "archived") {
      return { status: "archived" };
    }

    // "kept" et tout type non prévu ci-dessus : on conserve l'information brute plutôt que
    // de la perdre (Règle 3). `keptAt` (15/09/2026, audit "anomalies silencieuses" — voir
    // autoArchiveStaleKept() plus haut) horodate précisément CE moment, distinct de
    // `item.createdAt` (date de la capture brute d'origine, potentiellement bien antérieure si
    // l'élément a dormi en Inbox avant d'être qualifié).
    return { status: "kept", keptAsType: outcome, keptAt: Date.now() };
  });

  if (outcome === "task") {
    await storage.logHistory("InboxItem", itemId, "qualified_as_task", { taskId: task.id });
    await linkEntityToProjectIfKnown("Task", task, "title");
    await linkEntityToInboxSource("Task", task.id, task.title, itemId, sourceRawContent);
    return { outcome: "task", task };
  }

  if (RESULT_KEY[outcome]) {
    await storage.logHistory("InboxItem", itemId, "qualified_as_" + outcome, { id: extra.id });
    const entityInfo = OUTCOME_ENTITY[outcome];
    if (entityInfo && extra.id) {
      const entity = await entityInfo.get(extra.id);
      if (entity) {
        if (entityInfo.projectLinkEligible) {
          await linkEntityToProjectIfKnown(entityInfo.type, entity, entityInfo.titleField);
        }
        await linkEntityToInboxSource(entityInfo.type, entity.id, entity[entityInfo.titleField], itemId, sourceRawContent);
      }
    }
    return { outcome };
  }

  if (outcome === "archived") {
    await storage.logHistory("InboxItem", itemId, "archived", {});
    return { outcome: "archived" };
  }

  await storage.logHistory("InboxItem", itemId, "kept", { asType: outcome });
  return { outcome: "kept" };
}

// Tags libres sur les Informations/Idées (retour de Charles-Henri, 13/09/2026 : "pouvoir
// catégoriser des idées/informations et voir comment retrouver facilement les éléments d'une
// catégorie") — d'abord posés ici (tableau `item.tags`), puis généralisés le même jour à
// n'importe quelle fiche de l'app ("les tags peuvent être associé à n'importe quel élément
// d'une info au projet au suivi, etc.") : voir js/domain/tags.js, qui reprend ce même jour les
// tags déjà saisis ici (migrateInboxTags(), appelée une fois au démarrage depuis js/app.js) vers
// sa collection générique { type, id, tag }. addKeptTag/removeKeptTag/listAllKeptTags ont
// disparu au profit de tagsApi.addTag/removeTag/tagsFor (type "Kept") — l'ancien tableau
// `item.tags` n'est donc plus alimenté après cette migration, gardé uniquement le temps que la
// migration ait tourné au moins une fois sur chaque compte.

/** Rattache (ou détache, `projectId: null`) une Information/Idée à un projet. */
export async function setKeptProject(id, projectId) {
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Élément Inbox introuvable : " + id);
    return { projectId: projectId || null };
  });
  await storage.logHistory("InboxItem", id, "project_set", { projectId: projectId || null });
  return updated;
}
