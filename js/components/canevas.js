// Rendu réutilisable d'un canevas (§14-19, §78.9) — la même petite checklist s'affiche
// depuis la fiche Réunion, Projet ou Tâche (canevas Communication). Ne connaît rien du
// domaine : reçoit juste `steps` (déjà chargées) et un callback `onToggle(stepKey, done)`
// laissé à l'appelant, qui sait lui de quel `toggleStep()` de quel domaine il s'agit.

import { renderInfoTip } from "./infoTip.js";

const HELP_HTML =
  "Ce canevas est un <strong>modèle enregistré comme donnée</strong> (§78.9), pas une checklist codée en dur pour cette fiche : Réunion, Point collaborateur, Projet et Communication ont chacun le leur (§15 à §18). Coche les étapes au fur et à mesure — la date de la coche reste affichée à côté. Certaines étapes (ex. « Créer les actions », « Planifier les suivis ») proposent aussitôt de créer la Tâche ou le Suivi qui suit, pour ne pas avoir à s'en souvenir plus tard. L'éditeur de canevas personnalisé (§19) n'existe pas encore — ces modèles sont fixes pour l'instant.";

export function renderCanevas(container, steps, onToggle) {
  if (!steps || !steps.length) {
    container.innerHTML = "";
    return;
  }
  const done = steps.filter((s) => s.done).length;
  container.innerHTML = "";

  const headerRow = document.createElement("div");
  headerRow.className = "section-header-row";
  const header = document.createElement("div");
  header.className = "section-title";
  header.textContent = `📋 Canevas (${done}/${steps.length})`;
  headerRow.appendChild(header);
  renderInfoTip(headerRow, HELP_HTML);
  container.appendChild(headerRow);

  const card = document.createElement("div");
  card.className = "card";
  card.style.marginBottom = "16px";
  for (const step of steps) {
    const row = document.createElement("label");
    row.className = "item-row";
    row.style.cursor = "pointer";
    row.innerHTML = `
      <input type="checkbox" ${step.done ? "checked" : ""} style="margin-right:10px;width:18px;height:18px;flex-shrink:0;" />
      <span style="${step.done ? "text-decoration:line-through;color:var(--color-text-muted);" : ""}">${escapeHtml(step.label)}</span>
      ${step.done && step.doneAt ? `<span class="item-meta" style="margin-left:auto;padding-left:8px;">✓ ${formatDoneAt(step.doneAt)}</span>` : ""}
    `;
    row.querySelector("input").addEventListener("change", (e) => onToggle(step.key, e.target.checked));
    card.appendChild(row);
  }
  container.appendChild(card);
}

function formatDoneAt(ts) {
  return new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
