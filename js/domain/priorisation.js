// Matrice de priorisation automatique — vague 33 (retour de Charles-Henri, 07/09/2026 : "une
// matrice de priorisation automatique qui irait plus loin que le Focus du jour actuel : au lieu
// de juste trier par échéance, elle croiserait urgence, impact (le projet est-il critique ?) et
// niveau de blocage pour te dire non seulement quoi faire en premier, mais pourquoi — un vrai
// "pourquoi ce sujet avant cet autre" plutôt qu'un tri implicite").
//
// Aucune nouvelle saisie obligatoire : les trois signaux existaient déjà dans l'app —
// `task.dueDate` (urgence), `project.critical` (impact, nouveau champ mais optionnel, faux par
// défaut) et `task.isBlocked` (blocage, déjà utilisé par le Focus du jour et le Kanban). Seul
// le marquage "⭐ Projet prioritaire" est une décision manuelle ponctuelle par projet.
//
// Poids paramétrables (retour de Charles-Henri : "le scoring doit être paramétrable par
// l'utilisateur mais on peut la définir avec valeur par défaut") — stockés dans les préférences
// (js/domain/preferences.js#setPriorityWeights), jamais codés en dur ailleurs que DEFAULT_WEIGHTS
// ici. "Les dates doivent être prises en compte aussi pour les échéances" (retour de
// Charles-Henri) : l'urgence reste calculée à partir de la vraie échéance (retard exact, jours
// restants), pas d'un simple booléen "en retard ou pas" — le score affine le tri de l'ancien
// Focus du jour, il ne l'ignore pas.

export const DEFAULT_WEIGHTS = { urgence: 50, impact: 30, blocage: 20 };

function daysUntil(dueDate) {
  const due = new Date(dueDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due - today) / 86400000);
}

/** Sous-score d'urgence (0 à 1) à partir de l'échéance réelle — plus le retard est important,
 *  plus le score grimpe (plafonné à 1), plutôt qu'un simple "en retard = 1". */
export function urgencyScore(task) {
  if (!task.dueDate) return 0.05;
  const days = daysUntil(task.dueDate);
  if (days < 0) return Math.min(1, 0.85 + Math.min(-days, 15) * 0.01);
  if (days === 0) return 0.8;
  if (days <= 2) return 0.65;
  if (days <= 7) return 0.45;
  if (days <= 30) return 0.25;
  return 0.1;
}

/** Sous-score d'impact (0 à 1) — un projet marqué "⭐ prioritaire" (`project.critical`) pèse
 *  plus lourd qu'un projet ordinaire, lui-même plus lourd qu'une tâche sans projet du tout. */
export function impactScore(task, project) {
  if (task.projectId && project?.critical) return 1;
  if (task.projectId) return 0.4;
  return 0.2;
}

/** Sous-score de blocage (0 ou 1) — réutilise `task.isBlocked`, déjà coché depuis la fiche
 *  Tâche (Kanban) et déjà affiché par le Focus du jour actuel. */
export function blockageScore(task) {
  return task.isBlocked ? 1 : 0;
}

/** Normalise des poids arbitraires (ex. 3 sliders 0-100) pour qu'ils totalisent 1 — un score
 *  final reste donc toujours comparable entre 0 et 1, quels que soient les poids choisis. */
export function normalizedWeights(weights) {
  const w = { ...DEFAULT_WEIGHTS, ...(weights || {}) };
  const sum = (Number(w.urgence) || 0) + (Number(w.impact) || 0) + (Number(w.blocage) || 0);
  if (sum <= 0) return { urgence: 0, impact: 0, blocage: 0 };
  return { urgence: (Number(w.urgence) || 0) / sum, impact: (Number(w.impact) || 0) / sum, blocage: (Number(w.blocage) || 0) / sum };
}

export function computeScore(task, project, weights) {
  const w = normalizedWeights(weights);
  const urgence = urgencyScore(task);
  const impact = impactScore(task, project);
  const blocage = blockageScore(task);
  return { total: urgence * w.urgence + impact * w.impact + blocage * w.blocage, urgence, impact, blocage, weights: w };
}

function dueLabel(task) {
  if (!task.dueDate) return "Pas d'échéance";
  const days = daysUntil(task.dueDate);
  if (days < 0) return `Échéance dépassée de ${-days} j`;
  if (days === 0) return "Échéance aujourd'hui";
  if (days === 1) return "Échéance demain";
  return `Échéance dans ${days} j`;
}

/** Phrase "pourquoi ce sujet avant cet autre" — le point explicite de la demande de
 *  Charles-Henri, distinct d'un simple tri implicite par échéance. */
export function explainScore(task, project) {
  const parts = [dueLabel(task)];
  if (task.projectId) {
    parts.push(project?.critical ? `projet ${project.name} ⭐ prioritaire` : `projet ${project?.name || "?"}`);
  } else {
    parts.push("sans projet");
  }
  if (task.isBlocked) parts.push("bloquée");
  return parts.join(" · ");
}

/** Classe une liste de tâches par score décroissant ; à score égal, garde l'échéance la plus
 *  proche en départage — continuité avec l'ancien tri (uniquement par échéance) du Focus du
 *  jour, plutôt qu'un ordre qui semblerait arbitraire entre deux tâches à score identique. */
export function rankTasks(tasks, projects, weights) {
  const projectById = new Map((projects || []).map((p) => [p.id, p]));
  return tasks
    .map((task) => {
      const project = task.projectId ? projectById.get(task.projectId) : null;
      const score = computeScore(task, project, weights);
      return { task, project, score, why: explainScore(task, project) };
    })
    .sort((a, b) => {
      if (b.score.total !== a.score.total) return b.score.total - a.score.total;
      if (!a.task.dueDate && !b.task.dueDate) return 0;
      if (!a.task.dueDate) return 1;
      if (!b.task.dueDate) return -1;
      return new Date(a.task.dueDate) - new Date(b.task.dueDate);
    });
}
