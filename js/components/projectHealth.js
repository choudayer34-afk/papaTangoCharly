// Rendu de la vue "🩺 Santé" des projets (§49) — jauge en demi-cercle + puces de signaux par
// projet, du moins bon au meilleur (voir js/domain/projectHealth.js pour le calcul). Composant
// autonome monté depuis js/views/projects.js, même principe que renderWorkloadSection
// (js/views/workload.js) : reçoit les données déjà calculées, ne gère aucun état ni abonnement
// propre, un seul callback pour ouvrir la fiche Projet au clic sur une ligne.

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const LEVEL_COLOR = {
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
};

const SIGNAL_LEVEL_STYLE = {
  danger: "background:var(--color-danger-bg);color:var(--color-danger);",
  warning: "background:var(--color-warning-bg);color:var(--color-warning);",
  info: "background:var(--color-info-bg);color:var(--color-info);",
  ok: "background:var(--color-success-bg);color:var(--color-success);",
};

/** Jauge en demi-cercle (0-100) — même tracé qu'un anneau de progression, mais sur 180° au lieu
 *  de 360° : un arc de fond gris pâle, puis un arc coloré qui s'arrête à `score`. `A28 28 0 0 1`
 *  suffit pour tout arc jusqu'à 180° (le maximum possible ici), jamais besoin du grand-arc. */
function gaugeSvg(score, color) {
  const cx = 32, cy = 36, r = 28;
  const angle = (Math.PI * score) / 100;
  const x = (cx - r * Math.cos(angle)).toFixed(1);
  const y = (cy - r * Math.sin(angle)).toFixed(1);
  return `
    <svg width="64" height="40" viewBox="0 0 64 40" role="img" aria-label="Santé : ${score} sur 100">
      <path d="M4 36 A28 28 0 0 1 60 36" fill="none" stroke="var(--color-surface-alt)" stroke-width="7" stroke-linecap="round"/>
      ${score > 0 ? `<path d="M4 36 A28 28 0 0 1 ${x} ${y}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"/>` : ""}
    </svg>
  `;
}

/**
 * `ranked` : sortie de `projectHealthApi.rankByHealth()`. `onOpenProject(project)` : ouvre la
 * fiche Projet correspondante (même geste que cliquer une ligne côté Priorisation/Charge).
 */
export function renderProjectHealth(container, ranked, { onOpenProject } = {}) {
  if (!ranked.length) {
    container.innerHTML = `<div class="empty-state" style="padding:16px;"><span class="emoji">🩺</span>Aucun projet actif à surveiller pour l'instant.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="health-list">
      ${ranked
        .map(
          (r) => `
        <div class="health-row" data-project-id="${r.project.id}" style="cursor:pointer;">
          <div class="gauge-wrap">
            ${gaugeSvg(r.score, LEVEL_COLOR[r.level])}
            <div class="gauge-score" style="color:${LEVEL_COLOR[r.level]};">${r.score}</div>
          </div>
          <div style="min-width:0;">
            <div class="health-project-name">${r.project.critical ? "⭐ " : "📦 "}${escapeHtml(r.project.name)}</div>
            <div class="health-signals">
              ${r.signals.map((s) => `<span class="health-signal-chip" style="${SIGNAL_LEVEL_STYLE[s.level]}">${escapeHtml(s.text)}</span>`).join("")}
            </div>
          </div>
        </div>
      `
        )
        .join("")}
    </div>
    <div class="fine-print" style="color:var(--color-text-muted);font-size:var(--font-size-xs);margin-top:8px;">Score calculé à partir des tâches en retard, bloquées ou en pause, et des suivis en retard rattachés au projet — trié du moins bon au meilleur.</div>
  `;

  container.querySelectorAll(".health-row").forEach((row) => {
    const found = ranked.find((r) => r.project.id === row.dataset.projectId);
    if (!found) return;
    row.addEventListener("click", () => onOpenProject?.(found.project));
  });
}
