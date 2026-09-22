// Suivis — §29. Deux sens possibles (retour de Charles-Henri : comment noter que je dois
// pousser une info à quelqu'un, pas seulement attendre quelque chose de lui) :
//  - "waiting_on" (par défaut, comportement historique) : "quelqu'un doit faire quelque
//    chose et je dois vérifier" — le champ qui compte est "quand est-ce que MOI je dois
//    contrôler / relancer" (controlDate), alimente §33 (point collaborateur automatique)
//    et les automatisations "suivi à faire" (§28).
//  - "to_tell" (nouveau) : "je dois transmettre/dire quelque chose à cette personne" —
//    controlDate devient "avant quand dois-je lui en parler ?". Alimente aussi §33 (section
//    "📣 À transmettre") et, quand la personne est de type "manager", §34/§35 (écran
//    Management, voir js/views/management.js) via `category`.
//
// `category` ne qualifie que les suivis "to_tell" destinés au Management (§34/§35) :
// difficulté à signaler, décision attendue, sujet à discuter, ou réalisation à mentionner —
// reste facultatif pour un "to_tell" ordinaire vers un collaborateur ou l'équipe.

import * as storage from "../services/storage.js";
import { generateId } from "../services/id.js";
import * as dateUtils from "../services/dateUtils.js";
import * as gamification from "./gamification.js";

const COLLECTION = "followUps";

// Statut d'un Suivi — simplifié à 3 états le 02/09/2026 (piste TDAH, audit de simplification
// demandé par Charles-Henri : "un suivi est plus naturellement binaire" que le pipeline à 5
// statuts des Tâches, qu'il réutilisait tel quel jusqu'ici sans jamais avoir de "à faire"/
// "en cours" qui fasse vraiment sens pour un suivi). `done` garde exactement le même nom
// qu'avant (voir isControlDue() plus bas, et tous les `f.status !== "done"` déjà semés dans
// l'app) — seule la distinction "en attente" vs "déjà relancé" est nouvelle.
export const STATUSES = ["waiting", "relaunched", "done"];
export const STATUS_LABELS = { waiting: "⏳ En attente", relaunched: "🔁 Relancé", done: "✅ Réglé" };
export const STATUS_ICONS = { waiting: "⏳", relaunched: "🔁", done: "✅" };

// Légende ⓘ (audit de simplification du 02/09/2026) : le statut d'un Suivi et celui d'une Tâche
// (js/domain/tasks.js) partagent tous les deux une valeur "en attente" avec la même icône ⏳
// mais un sens différent — ce texte lève l'ambiguïté sur Équipe, où seul le vocabulaire Suivi
// est visible.
export const STATUS_INFO_HTML =
  "Statut d'un <strong>Suivi</strong> — différent de celui d'une Tâche (onglet Pilotage), qui utilise aussi ⏳ mais avec un sens propre : ⏳ En attente (tu n'as encore rien relancé) · 🔁 Relancé (tu as déjà relancé, tu attends la réponse) · ✅ Réglé.";

/**
 * Ramène une valeur de statut — potentiellement encore un des 5 anciens statuts Tâche
 * (todo/in_progress/waiting/follow_up/done) posés sur un Suivi créé avant ce round — vers l'un
 * des 3 nouveaux. Appliquée à la lecture (listAll/subscribe ci-dessous) plutôt qu'en réécrivant
 * chaque document existant : aucune migration risquée à lancer, chaque suivi se normalise tout
 * seul dès qu'il est relu, sans écriture supplémentaire tant qu'on n'y touche pas soi-même.
 */
// BUG corrigé (trouvé aux tests de la vague 21, jamais vu par Charles-Henri) : la table ne
// contenait QUE les anciens statuts (todo/in_progress/waiting/follow_up/done) — "relaunched",
// pourtant l'un des 3 statuts ACTUELS d'un Suivi, n'y figurait pas et retombait donc sur le
// "waiting" par défaut ci-dessous dès la relecture suivante. Concrètement : choisir "🔁 Relancé"
// dans la fiche d'un suivi l'enregistrait correctement, mais le statut revenait silencieusement
// à "⏳ En attente" au prochain rendu (fermer/rouvrir la fiche, ou même immédiatement dans la
// modale "Point avec..." après enregistrement). Toute valeur déjà normalisée doit repasser
// telle quelle, pas seulement ses anciens alias.
const LEGACY_STATUS_MAP = { todo: "waiting", in_progress: "waiting", waiting: "waiting", relaunched: "relaunched", follow_up: "relaunched", done: "done" };

export function normalizeStatus(status) {
  return LEGACY_STATUS_MAP[status] || "waiting";
}

function normalize(followUp) {
  const status = normalizeStatus(followUp.status);
  return status === followUp.status ? followUp : { ...followUp, status };
}

export const DIRECTIONS = ["waiting_on", "to_tell"];
export const DIRECTION_LABELS = {
  waiting_on: "👀 J'attends quelque chose de cette personne",
  to_tell: "📣 Je dois lui transmettre quelque chose",
};

export const CATEGORIES = ["topic", "decision", "difficulty", "achievement"];
export const CATEGORY_LABELS = {
  topic: "📌 Sujet à discuter",
  decision: "🗳️ Décision attendue",
  difficulty: "⚠️ Difficulté",
  achievement: "🟢 Réalisation à mentionner",
};

// "Notable" (§ préparation EADP, retour de Charles-Henri) : un suivi peut être marqué comme
// un élément notable positif ou négatif, indépendamment de sa direction/catégorie — sert à
// ressortir les points marquants d'une personne sur une période (voir openPrepareEadpModal,
// js/views/people.js), sans avoir à relire tout l'historique des suivis un par un.
export const NOTABLE_VALUES = ["positive", "negative"];
export const NOTABLE_LABELS = { positive: "👍 Notable positif", negative: "👎 Notable négatif" };

// Règle métier (retour de Charles-Henri, 06/09/2026 : "quand je mets une date d'échéance [...]
// si la date de contrôle n'est pas saisie ou est [postérieure] à la date d'échéance saisie ça
// doit mettre la date de contrôle à la date d'échéance") — la date de contrôle ne doit jamais
// être PLUS TARDIVE que l'échéance (on garde la possibilité de contrôler en avance, très
// largement le cas normal d'un suivi "waiting_on" — voir le commentaire en tête de fichier —
// on empêche seulement de contrôler après coup, ce qui n'aurait pas de sens). Sans échéance,
// la date de contrôle saisie est gardée telle quelle (un suivi "to_tell" n'a jamais de dueDate,
// voir plus bas). Factorisé ici pour être appliqué de façon identique à la création
// (`createFollowUp`) et à la modification (`updateFollowUp`) plutôt que dans chaque formulaire
// appelant (js/views/people.js) — un seul endroit qui fait foi, jamais désynchronisable.
//
// BUG corrigé (15/09/2026, retour de Charles-Henri : "je n'arrive pas à supprimer une date de
// contrôle même après enregistrer ça reste présent" + "quand je clique sur réinitialiser sur la
// date, ça réinitialise mais ça ne s'enregistre pas") : la règle ci-dessus a été écrite pour le
// cas "je viens de saisir une échéance, la date de contrôle n'a encore jamais été renseignée" —
// mais elle était appliquée à l'identique à CHAQUE enregistrement du formulaire d'édition
// (js/views/people.js#openEditFollowUpModal), qui renvoie systématiquement `dueDate` dans son
// patch, changée ou non. Résultat : vider le champ "Prochain contrôle" sans toucher à l'échéance
// tombait dans le même cas que "jamais saisie" ci-dessus, et la date de contrôle repartait
// silencieusement caler sur l'échéance — impossible de la vider pour de bon tant qu'une échéance
// restait présente, sans le moindre message expliquant pourquoi. Le correctif distingue
// maintenant explicitement les deux cas via `dueDateChanged` : si l'échéance elle-même change de
// valeur, une date de contrôle vide est toujours calée dessus par défaut (comportement de
// départ, inchangé) ; si l'échéance ne change pas, vider la date de contrôle la vide réellement —
// seul le plafond ("jamais après l'échéance") reste appliqué quand une date de contrôle est
// explicitement saisie.
function resolveControlDate(dueDate, controlDate, { dueDateChanged = true } = {}) {
  if (!dueDate) return controlDate || null;
  if (!controlDate) return dueDateChanged ? dueDate : null;
  if (new Date(controlDate).getTime() > new Date(dueDate).getTime()) return dueDate;
  return controlDate;
}

export async function createFollowUp(data) {
  const followUp = await storage.put(COLLECTION, {
    title: data.title, // l'engagement pris par la personne, ou ce que je dois lui dire
    personId: data.personId,
    direction: DIRECTIONS.includes(data.direction) ? data.direction : "waiting_on",
    category: data.category || null,
    notable: NOTABLE_VALUES.includes(data.notable) ? data.notable : null,
    expectedResult: data.expectedResult || "",
    description: data.description || "", // contexte libre non daté (retour de Charles-Henri, vague 21)
    dueDate: data.dueDate || null, // échéance de la personne (direction "waiting_on")
    controlDate: resolveControlDate(data.dueDate, data.controlDate), // quand JE dois vérifier / en parler
    status: data.status || "waiting",
    successCriteria: data.successCriteria || "",
    projectId: data.projectId || null,
    // `notesLog`/`checklist` acceptent une valeur initiale (retour de Charles-Henri, 15/09/2026 :
    // un changement de type Tâche→Suivi ne doit pas faire disparaître ce qu'on y avait déjà mis)
    // — voir js/domain/convert.js#convertTaskToFollowUp, seul appelant à s'en servir aujourd'hui.
    // Vide par défaut pour tous les autres appelants (création normale depuis people.js), aucun
    // changement de comportement pour eux.
    notesLog: data.notesLog || [], // journal de notes horodaté, voir addNote() plus bas
    checklist: data.checklist || [], // sous-étapes courtes libres, même principe que Task.checklist (js/domain/tasks.js)
    // LOT 11 (TODO-025, 22/09/2026) — `hiddenFromPrep` acceptait déjà une valeur initiale
    // implicitement (`storage.put` pose tout champ présent dans l'objet), mais aucun appelant
    // n'en passait une jusqu'ici : le champ ne prenait sa première valeur qu'après coup, via
    // l'écran de masquage privé (js/views/prepMask.js#updateFollowUp). Explicité ici pour que
    // js/views/people.js#openCreateFollowUpModal puisse la décider dès la création — décision
    // INDÉPENDANTE de `direction` (arbitrage explicite de Charles-Henri, pas de valeur déduite
    // de l'une à partir de l'autre). `false` par défaut si absent : un Suivi remonte
    // normalement au prochain point, comme avant ce lot pour tout Suivi jamais masqué.
    hiddenFromPrep: !!data.hiddenFromPrep,
  });
  await storage.logHistory("FollowUp", followUp.id, "created", { title: followUp.title });
  return followUp;
}

/**
 * Sous-étapes courtes libres sur un Suivi (retour de Charles-Henri, vague 21 : "dans un suivi
 * sur une personne, il faudrait que je puisse mettre une description et une checklist") — même
 * principe et même forme `{id, text, done, doneAt}` que la checklist des Tâches (voir
 * js/domain/tasks.js#addChecklistItem/toggleChecklistItem/removeChecklistItem), pour que
 * js/components/checklist.js reste le seul composant à connaître, sans variante par type de
 * fiche.
 */
// Convertie le 21/09/2026 (TODO-010, LOT 4B) en écriture ciblée (`storage.appendToArray`, voir
// son commentaire détaillé dans storage.js) — même raisonnement que
// js/domain/tasks.js#addChecklistItem. `toggleChecklistItem`/`removeChecklistItem` juste en
// dessous restent sur `storage.update()` : ils doivent localiser un élément EXISTANT par son id.
export async function addChecklistItem(id, text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  const item = { id: generateId(), text: trimmed, done: false, doneAt: null };
  await storage.appendToArray(COLLECTION, id, "checklist", item);
  return item;
}

export async function toggleChecklistItem(id, itemId, done) {
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Suivi introuvable : " + id);
    return { checklist: (current.checklist || []).map((c) => (c.id === itemId ? { ...c, done, doneAt: done ? Date.now() : null } : c)) };
  });
  return updated.checklist;
}

export async function removeChecklistItem(id, itemId) {
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Suivi introuvable : " + id);
    return { checklist: (current.checklist || []).filter((c) => c.id !== itemId) };
  });
  return updated.checklist;
}

// `editChecklistItem`/`reorderChecklist` — même besoin et mêmes choix que
// js/domain/tasks.js#editChecklistItem/reorderChecklist (voir son commentaire détaillé, et celui
// en tête de js/components/checklist.js), repris à l'identique pour la checklist d'un Suivi.
export async function editChecklistItem(id, itemId, text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Suivi introuvable : " + id);
    return { checklist: (current.checklist || []).map((c) => (c.id === itemId ? { ...c, text: trimmed } : c)) };
  });
  return updated.checklist;
}

export async function reorderChecklist(id, orderedIds) {
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Suivi introuvable : " + id);
    const list = current.checklist || [];
    const byId = new Map(list.map((c) => [c.id, c]));
    const notDoneReordered = orderedIds.map((cid) => byId.get(cid)).filter(Boolean);
    const covered = new Set(orderedIds);
    const notDoneUncovered = list.filter((c) => !c.done && !covered.has(c.id));
    const done = list.filter((c) => c.done);
    return { checklist: [...notDoneReordered, ...notDoneUncovered, ...done] };
  });
  return updated.checklist;
}

/** Journal de notes horodaté (retour de Charles-Henri, 01/09/2026) — voir addNote() dans
 *  domain/tasks.js pour le principe complet (additif uniquement). */
// Convertie le 21/09/2026 (TODO-010, LOT 4B) en écriture ciblée — même raisonnement que
// addChecklistItem() ci-dessus. Ne renvoie plus le tableau complet mais la note ajoutée seule.
export async function addNote(id, text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  const note = { id: generateId(), text: trimmed, createdAt: Date.now() };
  await storage.appendToArray(COLLECTION, id, "notesLog", note);
  await storage.logHistory("FollowUp", id, "note_added", { text: trimmed });
  return note;
}

export async function updateFollowUp(id, patch) {
  let finalPatch = patch;
  let previousStatus = null;
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Suivi introuvable : " + id);
    previousStatus = current.status;
    // Même règle qu'à la création (voir `resolveControlDate` plus haut) — seulement quand
    // `dueDate` fait partie de CE patch : un appelant qui ne touche pas l'échéance (ex. cocher
    // "terminé", ajouter une note) ne doit jamais voir sa date de contrôle recalculée dans son
    // dos. `dueDateChanged` (voir le correctif du 15/09/2026 dans `resolveControlDate`) compare à
    // la valeur déjà enregistrée plutôt que de supposer un changement : le formulaire d'édition
    // renvoie `dueDate` à chaque sauvegarde que l'échéance ait bougé ou non, donc seule cette
    // comparaison permet de distinguer "l'échéance change, caler la date de contrôle vide dessus"
    // de "l'échéance ne change pas, vider la date de contrôle la vide pour de bon".
    finalPatch = "dueDate" in patch
      ? {
          ...patch,
          controlDate: resolveControlDate(patch.dueDate, "controlDate" in patch ? patch.controlDate : current.controlDate, {
            dueDateChanged: patch.dueDate !== (current.dueDate || null),
          }),
        }
      : patch;
    return finalPatch;
  });
  await storage.logHistory("FollowUp", id, "updated", { patch: finalPatch });
  // Gamification (LOT G1, TODO_GAMIFICATION.md §3) : "Suivi terminé", 8 XP, une seule fois par
  // Suivi (première transition vers "done" seulement, même principe que
  // js/domain/tasks.js#updateTask) — voir le commentaire détaillé là-bas pour le raisonnement
  // complet (registre "déjà récompensé", jamais bloquant pour l'écriture métier ci-dessus).
  if (patch.status === "done" && previousStatus !== "done") {
    gamification.recordFollowUpCompleted(id).catch((err) => console.error("[gamification] Échec du crédit XP (Suivi terminé) :", err));
  }
  return updated;
}

export async function setStatus(id, status) {
  return updateFollowUp(id, { status });
}

export async function listAll() {
  const items = await storage.listAll(COLLECTION);
  return items.map(normalize);
}

// Ajouté le 21/09/2026 (TODO-009A, LOT 4A) : lire UN Suivi par son id, pour
// js/components/linkedItems.js#resolveRef — même besoin que tasksApi.getTask(), voir son
// commentaire. `normalize()` reste appliqué, comme pour listAll()/subscribe() ci-dessus, pour ne
// jamais renvoyer un ancien statut non migré.
export async function getFollowUp(id) {
  const doc = await storage.get(COLLECTION, id);
  return doc ? normalize(doc) : null;
}

// BUG corrigé (21/09/2026, audit performance, TODO-009B) : même correctif que
// js/domain/tasks.js#subscribe (voir son commentaire pour le détail) — `subscribe()` ouvrait un
// `onSnapshot` Firestore indépendant à chaque appel, jusqu'à 4 vues (Accueil, Calendrier,
// Personnes, Projets) écoutant simultanément la même collection `followUps`. Même mécanisme de
// mutualisation qu'`inboxItems` (js/domain/inbox.js), sans filtre (tous les appelants veulent la
// liste complète) — la normalisation (`normalize`, migration des anciens statuts) est faite UNE
// SEULE fois par notification, sur le flux partagé, plutôt que recalculée séparément par abonné.
const rawListeners = new Set();
let rawUnsubscribe = null;
let lastRawItems = null;

export function subscribe(callback) {
  rawListeners.add(callback);
  if (!rawUnsubscribe) {
    rawUnsubscribe = storage.subscribe(COLLECTION, (items) => {
      lastRawItems = items.map(normalize);
      for (const cb of rawListeners) cb(lastRawItems);
    });
  } else if (lastRawItems) {
    // Voir js/domain/tasks.js#subscribe pour l'explication de ce cas.
    callback(lastRawItems);
  }
  return () => {
    rawListeners.delete(callback);
    if (rawListeners.size === 0 && rawUnsubscribe) {
      rawUnsubscribe();
      rawUnsubscribe = null;
      lastRawItems = null;
    }
  };
}

export async function removeFollowUp(id) {
  await storage.logHistory("FollowUp", id, "deleted", {});
  return storage.remove(COLLECTION, id);
}

// BUG corrigé (15/09/2026, audit "anomalies silencieuses" : unification du calcul de dates) —
// voir js/services/dateUtils.js. Même mélange minuit UTC/minuit local que tasksApi.isLate().
export function isControlDue(followUp) {
  if (!followUp.controlDate || followUp.status === "done") return false;
  return dateUtils.daysFromToday(followUp.controlDate) < 0;
}
