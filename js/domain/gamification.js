// Gamification — LOT G1 (moteur XP), voir TODO_GAMIFICATION.md, roadmap indépendante de
// TODO_TECHNIQUE.md (24/09/2026). Ce fichier est le SEUL point d'entrée du moteur de
// gamification : les 9 fichiers de domaine qui déclenchent un gain d'XP (tasks.js,
// followups.js, projects.js, meetings.js, decisions.js, objectives.js, inbox.js, resources.js,
// prompts.js) appellent une fonction `recordXxx()` ci-dessous, jamais `awardXpOnce()`
// directement — c'est ce niveau d'indirection qui garde le barème XP (§3 de la roadmap)
// entièrement rassemblé ici plutôt qu'éclaté dans neuf fichiers.
//
// Système ACCESSOIRE (§1 de la roadmap) : il observe des écritures déjà faites par ailleurs, ne
// modifie jamais le document métier qui a déclenché le gain, et ne doit JAMAIS faire échouer
// l'action métier qui l'a appelé. Chaque appelant capture donc lui-même les erreurs de ce
// module (voir le commentaire ajouté à chaque point d'écoute) — une panne du moteur XP ne doit
// jamais empêcher de terminer une Tâche, clôturer un Projet, etc.
//
// Portée EXACTE de LOT G1 (voir TODO_GAMIFICATION.md → §11, LOT G1) : détecter les 10
// événements du barème (§3), calculer/stocker l'XP total, garantir "une action = une
// récompense" (§2.3) via un registre "déjà récompensé". Le niveau (§4), les badges (§5), les
// séries (§5.3/§6) et les déblocages ne font PAS partie de ce lot (LOT G2/G3/G5/G7) — ce fichier
// ne fait donc, pour l'instant, que créditer de l'XP brut, rien de plus.

import * as storage from "../services/storage.js";

const COLLECTION = "gamification";
const DOC_ID = "state";

function withDefaults(raw) {
  return {
    id: DOC_ID,
    xpTotal: 0,
    // Registre "déjà récompensé" (§2.3, §10 point 5 de la roadmap) : une entrée par
    // événement déjà crédité, clé = `${type-évènement}:${entité ou entité+jour}`. Jamais
    // recalculé à la volée depuis l'état courant des entités métier (impossible de distinguer
    // une première clôture d'une réouverture/re-clôture autrement) — voir `awardXpOnce()`.
    rewardedKeys: {},
    ...raw,
  };
}

export async function getGamificationState() {
  const current = await storage.get(COLLECTION, DOC_ID);
  return withDefaults(current);
}

/** Date locale du jour, au format "YYYY-MM-DD" (§2.2 de la roadmap : toujours la date locale de
 *  l'utilisateur, jamais `toISOString()` qui repasse en UTC — même précaution que
 *  js/services/dateUtils.js#addDaysToIsoDate, reprise ici à l'identique plutôt que dupliquée
 *  différemment). Fonction privée : dateUtils.js n'est pas un fichier concerné par LOT G1,
 *  cette clé de journée ne sert qu'au throttle de l'événement "Objectif mis à jour" ci-dessous. */
function localDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Crédite `xp` points pour la clé `key`, UNE SEULE FOIS (§2.3) : si cette clé a déjà été
 * récompensée, ne fait rien (idempotent, aucune écriture). Passe par `storage.update()`
 * (sérialisé par document, voir storage.js) : deux appels concurrents pour la MÊME clé ne
 * peuvent donc jamais créditer l'XP deux fois, y compris si l'événement déclencheur se produit
 * deux fois de suite très rapidement (ex. double clic).
 */
async function awardXpOnce(key, xp) {
  return storage.update(COLLECTION, DOC_ID, (raw) => {
    const current = withDefaults(raw);
    if (current.rewardedKeys[key]) return undefined; // déjà récompensé — aucune écriture
    return {
      xpTotal: (current.xpTotal || 0) + xp,
      rewardedKeys: { ...current.rewardedKeys, [key]: true },
    };
  });
}

// --- Barème XP (§3 de la roadmap) — une fonction par ligne du tableau, montants et clés de
// dédoublonnage figés ici, jamais recalculés ni redéfinis par un appelant. ------------------

/** Tâche terminée — 10 XP, une fois par Tâche (première transition vers "done" seulement,
 *  voir js/domain/tasks.js#updateTask). */
export async function recordTaskCompleted(taskId) {
  return awardXpOnce(`tache-terminee:${taskId}`, 10);
}

/** Suivi terminé — 8 XP, une fois par Suivi (voir js/domain/followups.js#updateFollowUp). */
export async function recordFollowUpCompleted(followUpId) {
  return awardXpOnce(`suivi-termine:${followUpId}`, 8);
}

/** Projet clôturé — 40 XP, une fois par Projet (voir js/domain/projects.js#closeProject). */
export async function recordProjectClosed(projectId) {
  return awardXpOnce(`projet-cloture:${projectId}`, 40);
}

/** Réunion créée — 5 XP, une fois par Réunion (voir js/domain/meetings.js#createMeeting). */
export async function recordMeetingCreated(meetingId) {
  return awardXpOnce(`reunion-creee:${meetingId}`, 5);
}

/** Décision créée — 6 XP, une fois par Décision (voir js/domain/decisions.js#createDecision). */
export async function recordDecisionCreated(decisionId) {
  return awardXpOnce(`decision-creee:${decisionId}`, 6);
}

/**
 * Objectif mis à jour — 8 XP, **au plus une fois par jour calendaire et par Objectif** (§3,
 * clause explicite de cette ligne du barème — seule exception à "une fois pour toujours" parmi
 * les 10 actions). Appelée à l'identique par js/domain/objectives.js#updateObjective,
 * #addIndicator et #updateIndicator (les trois fonctions citées par cette ligne du barème) : la
 * clé de dédoublonnage inclut la date locale du jour (§2.2) plutôt que d'être fixe pour
 * l'Objectif, ce qui permet au gain de se reproduire le lendemain sans jamais dépasser une fois
 * par jour.
 */
export async function recordObjectiveUpdated(objectiveId) {
  return awardXpOnce(`objectif-maj:${objectiveId}:${localDateKey()}`, 8);
}

/** Revue EADP ajoutée — 6 XP, une fois par point de suivi ajouté (`entry.id`, généré à chaque
 *  appel — voir js/domain/objectives.js#addEntry). Distincte de `recordObjectiveUpdated`
 *  ci-dessus : ce sont deux lignes différentes du barème (§3), jamais fusionnées. */
export async function recordObjectiveReviewAdded(entryId) {
  return awardXpOnce(`revue-eadp:${entryId}`, 6);
}

/** Inbox qualifiée — 4 XP, une fois par item, quel que soit le type de qualification choisi (y
 *  compris "Archiver", voir §3 et js/domain/inbox.js#qualify). */
export async function recordInboxItemQualified(itemId) {
  return awardXpOnce(`inbox-qualifiee:${itemId}`, 4);
}

/** Ressource créée — 3 XP, une fois par Ressource (voir js/domain/resources.js#createResource). */
export async function recordResourceCreated(resourceId) {
  return awardXpOnce(`ressource-creee:${resourceId}`, 3);
}

/** Prompt créé — 3 XP, une fois par Prompt (voir js/domain/prompts.js#createPrompt). */
export async function recordPromptCreated(promptId) {
  return awardXpOnce(`prompt-cree:${promptId}`, 3);
}
