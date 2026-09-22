// Utilitaires de date partagés (audit "anomalies silencieuses" du 15/09/2026).
//
// BUG corrigé : au moins trois implémentations indépendantes du calcul "combien de jours avant/
// après aujourd'hui" cohabitaient dans l'app (js/domain/tasks.js#isLate, followups.js#
// isControlDue, projectHealth.js#daysLate/daysUntil, js/views/dashboard.js#daysFromToday,
// js/views/kanban.js#daysFromToday — copie exacte de celle de dashboard.js), la plupart
// construisant la date à comparer via `new Date(dateStr)` (une chaîne "YYYY-MM-DD" SANS heure
// est alors parsée comme minuit UTC, cas particulier du constructeur Date — voir MDN) puis
// comparée à `startOfToday()` (minuit LOCAL, via `new Date()` + `setHours(0,0,0,0)`). Mélanger
// un minuit UTC et un minuit local ne se voit que pour un compte dans un fuseau à décalage
// négatif (Amériques) : minuit UTC du 15 y tombe encore le 14 en heure locale, ce qui peut faire
// apparaître une tâche due "aujourd'hui" comme déjà en retard, ou décaler d'un jour l'affichage
// "dans X jours". Seule js/domain/priorisation.js#daysUntil évitait déjà le piège, en forçant un
// parsing LOCAL via `new Date(dateStr + "T00:00:00")` (une chaîne AVEC heure mais sans fuseau est
// alors interprétée en heure locale — l'autre cas particulier du même constructeur). C'est cette
// version robuste qui devient ici la seule référence, réutilisée par tous les appelants listés
// ci-dessus plutôt que chacun sa propre copie.

/** Minuit local du jour courant, en millisecondes. */
export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Parse une date "YYYY-MM-DD" comme minuit LOCAL — jamais minuit UTC (`new Date(dateStr)` seul),
 *  qui décale le jour obtenu d'une unité dans les fuseaux à décalage négatif. */
export function parseLocalDate(dateStr) {
  return new Date(dateStr + "T00:00:00");
}

/** Nombre de jours (entier, arrondi) entre aujourd'hui et `dateStr` : positif si dans le futur,
 *  négatif si déjà passé, 0 si aujourd'hui même. */
export function daysFromToday(dateStr) {
  return Math.round((parseLocalDate(dateStr).getTime() - startOfToday()) / 86400000);
}

/**
 * Report rapide "+N jours" d'une date "YYYY-MM-DD" — extrait de `js/views/kanban.js#
 * addDaysToIsoDate` (TODO-003, LOT 2) le 22/09/2026 (retour direct de Charles-Henri : mêmes
 * boutons "+1 j"/"+7 j" désormais nécessaires sur les dates de Suivi, `js/views/people.js`,
 * voir TODO-030) plutôt que dupliqué une seconde fois — exactement la mutualisation que
 * TODO-030 envisageait déjà lui-même sans la trancher ("à l'occasion, envisager de mutualiser
 * le calcul de date dans un module partagé"). Base de calcul : la date actuelle si elle existe
 * et n'est pas déjà dépassée, sinon aujourd'hui — reporter une échéance déjà en retard "+1 jour"
 * doit l'amener à demain, pas la laisser en retard un jour de plus. `parseLocalDate` (minuit
 * LOCAL, jamais `new Date(dateStr)` seul) pour le parsing, reformatage à partir des composants
 * locaux (jamais `toISOString()`, qui repasse en UTC) — même précaution que documentée plus haut
 * dans ce fichier.
 */
export function addDaysToIsoDate(currentIsoDate, days) {
  const base = currentIsoDate && daysFromToday(currentIsoDate) >= 0 ? parseLocalDate(currentIsoDate) : new Date();
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + days);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
}
