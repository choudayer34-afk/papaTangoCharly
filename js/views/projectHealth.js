// Détecteur de signaux faibles — §49 (suite de la discussion OAD du 07/09/2026, "point
// suivant"/"suivant" après la matrice de priorisation, la répartition de charge et la grille de
// décision structurée) : "un score de santé par projet, calculé depuis ce qui existe déjà — pour
// repérer une dérive avant qu'elle ne devienne un franc retard, plutôt qu'à la Revue hebdomadaire
// seulement."
//
// Comme pour js/domain/workload.js (répartition de charge), la maquette d'origine évoquait des
// signaux qui n'existent pas tous tels quels dans le modèle de données réel (ex. "sous-partie
// bloquée depuis 12 j" suppose un horodatage par sous-partie de projet, qui n'existe pas —
// `parts[].status` n'a pas de date de dernier changement, seul `project.updatedAt` existe et
// bouge à CHAQUE édition du projet, pas seulement un changement de sous-partie : l'utiliser
// aurait produit un signal trompeur plutôt qu'utile). Le score ci-dessous n'utilise donc QUE des
// signaux déjà fiables ailleurs dans l'app :
//
// - Tâches en retard rattachées au projet (tasksApi.isLate) — le signal le plus lourd, à hauteur
//   du retard cumulé plutôt qu'un simple compte (10 tâches en retard d'1 jour chacune ne sont pas
//   pires qu'1 tâche en retard de 10 jours).
// - Tâche(s) bloquée(s) (task.isBlocked, déjà utilisé par la matrice de priorisation).
// - Tâche(s) "en pause" (tasksApi.isStalled — commencées puis plus retouchées depuis 5 jours).
// - Suivi(s) en retard rattachés au projet (followUpsApi.isControlDue).
//
// Chaque déduction est plafonnée indépendamment (voir DEDUCTION_CAPS) pour qu'un seul signal ne
// puisse jamais à lui seul écraser tout le score à 0 — un projet avec 10 tâches bloquées n'est pas
// nécessairement "aussi en péril que possible", mais mérite déjà le maximum d'alerte que CE signal
// peut donner.

import * as tasksApi from "./tasks.js?v=3";
import * as followUpsApi from "./followups.js?v=3";

const DEDUCTION_CAPS = { late: 40, blocked: 30, stalled: 25, followUps: 20 };
const POINTS_PER_LATE_DAY = 3;
const POINTS_PER_BLOCKED_TASK = 15;
const POINTS_PER_STALLED_TASK = 10;
const POINTS_PER_LATE_FOLLOWUP = 10;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function daysLate(dueDate) {
  return Math.max(0, Math.round((startOfToday() - new Date(dueDate).getTime()) / 86400000));
}

function daysUntil(dueDate) {
  return Math.max(0, Math.round((new Date(dueDate).getTime() - startOfToday()) / 86400000));
}

function plural(n, word) {
  return `${n} ${word}${n > 1 ? "s" : ""}`;
}

function taskRef(task) {
  return { type: "Task", id: task.id };
}

function followUpRef(followUp) {
  return { type: "FollowUp", id: followUp.id };
}

/**
 * Calcule le score de santé (0 à 100, 100 = aucun signal) et la liste des signaux qui
 * l'expliquent pour UN projet — `allTasks`/`allFollowUps` sont les flux complets de l'app,
 * filtrés ici sur `projectId` (même principe que workload.js#computeLoad).
 *
 * Chaque signal (hors "🟢 Aucun signal notable", qui ne pointe vers rien) porte un `target`
 * ({type: "Task"|"FollowUp", id}) — retour de Charles-Henri, 07/09/2026 : "qu'on puisse cliquer
 * sur l'élément [...] pour ouvrir l'élément ciblé par cette information, pas le projet". Un
 * signal qui agrège plusieurs éléments (ex. "2 tâches bloquées") pointe vers le plus parlant des
 * deux plutôt que de rester non cliquable faute d'un unique élément évident : le plus en retard
 * pour le retard cumulé, le moins retouché pour les tâches en pause, le plus tardif pour les
 * suivis en retard, une bloquée-ET-en-retard de préférence à une simplement bloquée.
 */
export function computeHealth(project, allTasks, allFollowUps) {
  const tasks = allTasks.filter((t) => t.projectId === project.id && t.status !== "done");
  const followUps = allFollowUps.filter((f) => f.projectId === project.id && f.status !== "done");

  const lateTasks = tasks.filter(tasksApi.isLate);
  const lateDays = lateTasks.reduce((sum, t) => sum + daysLate(t.dueDate), 0);
  const blockedTasks = tasks.filter((t) => t.isBlocked);
  const stalledTasks = tasks.filter(tasksApi.isStalled);
  const lateFollowUps = followUps.filter(followUpsApi.isControlDue);

  const deductions = {
    late: Math.min(DEDUCTION_CAPS.late, lateDays * POINTS_PER_LATE_DAY),
    blocked: Math.min(DEDUCTION_CAPS.blocked, blockedTasks.length * POINTS_PER_BLOCKED_TASK),
    stalled: Math.min(DEDUCTION_CAPS.stalled, stalledTasks.length * POINTS_PER_STALLED_TASK),
    followUps: Math.min(DEDUCTION_CAPS.followUps, lateFollowUps.length * POINTS_PER_LATE_FOLLOWUP),
  };
  const score = Math.max(0, Math.round(100 - deductions.late - deductions.blocked - deductions.stalled - deductions.followUps));

  // Du plus grave au plus léger — même ordre que la gravité des déductions ci-dessus, pour que
  // le premier signal affiché soit toujours celui qui pèse le plus sur le score.
  const signals = [];
  if (blockedTasks.length) {
    const n = blockedTasks.length;
    const target = blockedTasks.find((t) => tasksApi.isLate(t)) || blockedTasks[0];
    signals.push({ level: "danger", text: `🔴 ${n} tâche${n > 1 ? "s" : ""} bloquée${n > 1 ? "s" : ""}`, target: taskRef(target) });
  }
  if (lateTasks.length) {
    const worst = lateTasks.reduce((w, t) => (daysLate(t.dueDate) > daysLate(w.dueDate) ? t : w));
    signals.push({ level: "warning", text: `📈 Retard cumulé +${lateDays} j sur ${plural(lateTasks.length, "tâche")}`, target: taskRef(worst) });
  }
  if (stalledTasks.length) {
    const mostStale = stalledTasks.reduce((w, t) => ((t.updatedAt || t.createdAt || 0) < (w.updatedAt || w.createdAt || 0) ? t : w));
    signals.push({ level: "warning", text: `⏸️ ${plural(stalledTasks.length, "tâche")} en pause`, target: taskRef(mostStale) });
  }
  if (lateFollowUps.length) {
    const mostOverdue = lateFollowUps.reduce((w, f) => (new Date(f.controlDate).getTime() < new Date(w.controlDate).getTime() ? f : w));
    signals.push({ level: "warning", text: `👀 ${plural(lateFollowUps.length, "suivi")} en retard`, target: followUpRef(mostOverdue) });
  }

  if (!signals.length) {
    // Prochaine échéance affichée seulement quand tout va bien — sur un projet déjà en
    // difficulté, l'information la plus utile est déjà dans les signaux d'alerte ci-dessus.
    const upcoming = tasks.filter((t) => t.dueDate && !tasksApi.isLate(t)).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    signals.push(
      upcoming.length
        ? { level: "info", text: `🗓️ Prochaine échéance dans ${daysUntil(upcoming[0].dueDate)} j`, target: taskRef(upcoming[0]) }
        : { level: "ok", text: "🟢 Aucun signal notable" }
    );
  }

  const level = score >= 75 ? "success" : score >= 50 ? "warning" : "danger";
  return { project, score, level, signals };
}

/**
 * Classe les projets ACTIFS (ni fermés, ni déjà "terminé" — un projet clos n'a plus besoin de
 * surveillance) du moins bon au meilleur score, comme dans la maquette d'origine ("trié du moins
 * bon au meilleur").
 */
export function rankByHealth(projects, allTasks, allFollowUps) {
  return projects
    .filter((p) => p.status === "active")
    .map((p) => computeHealth(p, allTasks, allFollowUps))
    .sort((a, b) => a.score - b.score);
}
