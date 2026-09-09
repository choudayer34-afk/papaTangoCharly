// Répartition de la charge entre collaborateurs — vague 34 (retour de Charles-Henri,
// 07/09/2026, discussion OAD : "un assistant de répartition de charge pour tes décisions de
// délégation : en regardant les Suivis [...] déjà attribués à chaque collaborateur (volume,
// retard, stagnation), il te suggérerait à qui confier un nouveau sujet plutôt que de le
// décider à l'instinct ou par défaut sur la même personne").
//
// Une Tâche n'a jamais d'assignee dans cette app (§ toujours "ce que MOI je dois faire", voir
// js/domain/casquettes.js#taskHat) — seul un Suivi est attribué à une personne. La charge se
// calcule donc uniquement à partir des Suivis, et seulement ceux de sens "waiting_on"
// (js/domain/followups.js : "quelqu'un doit faire quelque chose et je dois vérifier") — un
// suivi "to_tell" est une obligation de CHARLES-HENRI envers la personne (lui dire quelque
// chose), pas un travail qu'elle porte elle-même : l'inclure fausserait la mesure de charge.
//
// Seuls les collaborateurs (`person.type !== "manager"`) entrent dans le classement — on ne
// répartit jamais une charge sur son propre manager.

import * as followUpsApi from "./followups.js";

// Même seuil que tasksApi.isStalled() (5 jours sans mouvement) — une seule définition de
// "stagnant" dans l'app, voir js/domain/tasks.js pour la justification complète.
const STALLED_THRESHOLD_MS = 5 * 24 * 60 * 60 * 1000;

function isFollowUpStalled(f) {
  if (f.status === "done") return false;
  const lastTouch = f.updatedAt || f.createdAt || 0;
  return Date.now() - lastTouch > STALLED_THRESHOLD_MS;
}

/** Charge d'UN collaborateur à partir de la liste complète des Suivis — volume (suivis actifs
 *  "waiting_on"), retard (contrôle dépassé) et stagnation (5 j sans mouvement), plus `total`,
 *  une somme simple et transparente des trois plutôt qu'une formule pondérée à régler : chaque
 *  suivi en retard ou stagnant pèse une fois de plus que son simple compte dans le volume,
 *  reflétant qu'il demande plus d'attention qu'un suivi actif ordinaire. */
export function computeLoad(person, allFollowUps) {
  const active = allFollowUps.filter((f) => f.personId === person.id && f.direction === "waiting_on" && f.status !== "done");
  const late = active.filter((f) => followUpsApi.isControlDue(f));
  const stalled = active.filter((f) => isFollowUpStalled(f));
  return { person, volume: active.length, late: late.length, stalled: stalled.length, total: active.length + late.length + stalled.length };
}

/** Classement de tous les collaborateurs (jamais les managers) du plus léger au plus chargé —
 *  celui en tête est la suggestion pour confier un nouveau sujet, à égalité départagé par ordre
 *  alphabétique plutôt qu'un tri qui semblerait arbitraire. */
export function rankByLoad(people, allFollowUps) {
  return people
    .filter((p) => p.type !== "manager")
    .map((p) => computeLoad(p, allFollowUps))
    .sort((a, b) => a.total - b.total || a.person.name.localeCompare(b.person.name, "fr"));
}
