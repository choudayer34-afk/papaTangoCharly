// Rendu réutilisable d'un historique (§46) — la même petite frise chronologique s'affiche
// depuis la fiche Projet, Tâche, Personne, etc. Aucune donnée n'est chargée ici : le
// composant se contente d'afficher les entrées déjà filtrées/triées par l'appelant, dans
// l'ordre où elles sont fournies.

import * as historyApi from "../domain/history.js";

export function renderHistoryTimeline(container, entries) {
  if (!entries.length) {
    container.innerHTML = `<div class="empty-state" style="padding:16px;">Aucun historique pour l'instant.</div>`;
    return;
  }
  container.innerHTML = "";
  for (const entry of entries) {
    const { emoji, label, detail } = historyApi.describe(entry);
    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
      <div class="item-main">
        <div class="item-title">${emoji} ${label}${detail ? " · " + escapeHtml(detail) : ""}</div>
        <div class="item-meta">${formatDateTime(entry.date)}</div>
      </div>
    `;
    container.appendChild(row);
  }
}

function formatDateTime(ts) {
  return new Date(ts).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
