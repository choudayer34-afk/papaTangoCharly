// Décisions — §48. Objet dédié pour ne jamais perdre "on avait décidé quoi sur ce sujet ?"
// (§46). Comme pour meetings.js, version simplifiée pour l'instant : rattachement à un
// projet et/ou une réunion en option, visible via la fiche projet si rattachée, sinon via
// "🧠 Récemment" au Dashboard tant que la recherche globale (§45/§52) n'existe pas encore.

import * as storage from "../services/storage.js";
import { generateId } from "../services/id.js";

const COLLECTION = "decisions";

export async function createDecision(data) {
  const decision = await storage.put(COLLECTION, {
    title: data.title, // le sujet de la décision
    decision: data.decision, // ce qui a été décidé
    context: data.context || "",
    date: data.date || null,
    projectId: data.projectId || null,
    meetingId: data.meetingId || null,
    peopleIds: data.peopleIds || [],
    notesLog: [], // journal de notes horodaté, voir addNote() plus bas
  });
  await storage.logHistory("Decision", decision.id, "created", { title: decision.title });
  return decision;
}

/** Journal de notes horodaté (retour de Charles-Henri, 01/09/2026) — voir addNote() dans
 *  domain/tasks.js pour le principe complet (additif uniquement). */
export async function addNote(id, text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Décision introuvable : " + id);
  const notesLog = [...(current.notesLog || []), { id: generateId(), text: trimmed, createdAt: Date.now() }];
  const updated = await storage.put(COLLECTION, { ...current, notesLog });
  await storage.logHistory("Decision", id, "note_added", { text: trimmed });
  return updated.notesLog;
}

export async function updateDecision(id, patch) {
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Décision introuvable : " + id);
  const updated = await storage.put(COLLECTION, { ...current, ...patch });
  await storage.logHistory("Decision", id, "updated", { patch });
  return updated;
}

// Grille de décision structurée — §49 (retour de Charles-Henri, discussion OAD, 07/09/2026) :
// "une grille de décision structurée, rattachée à l'entité Décision déjà présente [...] un
// petit cadre à critères pondérés (coût, risque, réversibilité, urgence) rempli avant de
// trancher un sujet un peu lourd [...] la logique de la décision resterait tracée dans
// l'historique, retrouvable trois mois plus tard". Champ optionnel `grid` sur la Décision,
// jamais imposé à la création (openCreateDecisionModal, js/views/dashboard.js, reste
// inchangé) — une décision légère n'a pas besoin de ce cadre, seul un sujet plus lourd le
// mérite (§ voir js/components/decisionGrid.js pour le "+ Ajouter une grille" côté fiche).

export const DEFAULT_GRID_CRITERIA = [
  { id: "cout", label: "💰 Coût", weight: 3 },
  { id: "risque", label: "⚠️ Risque", weight: 2 },
  { id: "reversibilite", label: "↩️ Réversibilité", weight: 1 },
  { id: "urgence", label: "⏰ Urgence", weight: 2 },
];

/** Grille vierge avec les 4 critères par défaut de la demande initiale — modifiable ensuite
 *  (ajout/retrait de critère ou d'option, poids réglable) : ce ne sont que des valeurs de
 *  départ, pas un format figé. */
export function createEmptyGrid() {
  return {
    options: ["Option A", "Option B"],
    criteria: DEFAULT_GRID_CRITERIA.map((c) => ({ ...c })),
    scores: {}, // scores[optionIndex][criterionId] = note 1 à 5
  };
}

/** Total pondéré d'une option, ramené sur la même échelle 1-5 que les notes individuelles
 *  (moyenne pondérée, pas une somme brute) — reste lisible ("3,4/5") quel que soit le nombre
 *  de critères ou leurs poids, et un critère non encore noté ne fausse pas le total (exclu du
 *  calcul plutôt que compté comme 0). */
export function computeGridTotal(grid, optionIndex) {
  const scoresForOption = (grid.scores && grid.scores[optionIndex]) || {};
  let weightedSum = 0;
  let weightTotal = 0;
  for (const c of grid.criteria) {
    const score = scoresForOption[c.id];
    if (!score) continue;
    weightedSum += score * c.weight;
    weightTotal += c.weight;
  }
  return weightTotal ? weightedSum / weightTotal : 0;
}

/** Option recommandée (le total le plus haut) — à égalité, la première option l'emporte
 *  plutôt qu'un choix arbitraire caché. */
export function gridRecommendation(grid) {
  const totals = grid.options.map((_, i) => computeGridTotal(grid, i));
  let bestIndex = 0;
  for (let i = 1; i < totals.length; i++) {
    if (totals[i] > totals[bestIndex]) bestIndex = i;
  }
  return { totals, bestIndex };
}

/** Enregistre la grille ET trace la recommandation dans l'historique avec une entrée dédiée et
 *  lisible ("⚖️ Grille de décision enregistrée · Option B conseillée...") plutôt que noyée dans
 *  un "Décision modifiée" générique — c'est précisément le "tracée dans l'historique,
 *  retrouvable trois mois plus tard" de la demande initiale. Volontairement distincte
 *  d'updateDecision() ci-dessus pour ne jamais doubler l'entrée d'historique. */
export async function saveGrid(id, grid) {
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Décision introuvable : " + id);
  const updated = await storage.put(COLLECTION, { ...current, grid });
  const { totals, bestIndex } = gridRecommendation(grid);
  const summary = grid.options.map((opt, i) => `${opt} ${totals[i].toFixed(1)}/5`).join(" · ");
  await storage.logHistory("Decision", id, "grid_recorded", { recommended: grid.options[bestIndex], summary });
  return updated;
}

/** Retire la grille d'une décision (revient à une simple case "décision + date") — action
 *  distincte d'updateDecision() pour tracer explicitement le retrait plutôt qu'un "modifiée"
 *  générique muet sur ce qui a changé. */
export async function removeGrid(id) {
  const current = await storage.get(COLLECTION, id);
  if (!current) throw new Error("Décision introuvable : " + id);
  const { grid, ...rest } = current;
  const updated = await storage.put(COLLECTION, rest);
  await storage.logHistory("Decision", id, "grid_removed", {});
  return updated;
}

export function getDecision(id) {
  return storage.get(COLLECTION, id);
}

export function listAll() {
  return storage.listAll(COLLECTION);
}

export function subscribe(callback) {
  return storage.subscribe(COLLECTION, callback);
}

export async function removeDecision(id) {
  await storage.logHistory("Decision", id, "deleted", {});
  return storage.remove(COLLECTION, id);
}
