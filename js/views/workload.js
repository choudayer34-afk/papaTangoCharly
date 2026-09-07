// Section "⚖️ Charge" de l'onglet Équipe — vague 34 (retour de Charles-Henri, 07/09/2026 :
// assistant de répartition de charge). Même principe que "👔 Mon manager"
// (js/views/management.js#renderManagerSection, fusionné dans Équipe le 02/09/2026) : un 3e
// mode du même chip-row plutôt qu'un onglet séparé — `renderWorkloadSection` ne gère pas ses
// propres abonnements, elle reçoit `people`/`followUps` déjà à jour et dessine dans le
// conteneur fourni.

import * as workloadApi from "../domain/workload.js";
import { openPersonDetail, openCreateFollowUpModal } from "./people.js";
import { showToast } from "../components/toast.js";

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function renderWorkloadSection(container, people, followUps) {
  const ranked = workloadApi.rankByLoad(people, followUps);

  container.innerHTML = "";

  if (!ranked.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<span class="emoji">⚖️</span>Ajoute des collaborateurs pour voir comment la charge se répartit entre eux.`;
    container.appendChild(empty);
    return;
  }

  const intro = document.createElement("div");
  intro.className = "item-meta";
  intro.style.marginBottom = "12px";
  intro.textContent = "Suivis actifs que chaque collaborateur te doit (\"j'attends quelque chose de lui\") — volume, en retard, stagnants (5 j sans mouvement). Le plus léger est suggéré pour un nouveau sujet.";
  container.appendChild(intro);

  const card = document.createElement("div");
  card.className = "card";

  const maxTotal = Math.max(...ranked.map((r) => r.total), 1);
  ranked.forEach((r, idx) => {
    const isLightest = idx === 0 && r.total < ranked[ranked.length - 1].total;
    const isHeaviest = idx === ranked.length - 1 && r.total > 0 && r.total > ranked[0].total;
    const row = document.createElement("div");
    row.className = "item-row";
    row.style.cursor = "pointer";
    row.innerHTML = `
      <div class="item-main">
        <div class="item-title">👤 ${escapeHtml(r.person.name)}${isLightest ? ` <span class="badge badge-critical">💡 Charge la plus légère</span>` : ""}${isHeaviest ? ` <span class="badge badge-late">⚠️ Charge élevée</span>` : ""}</div>
        <div class="kanban-card-meta" style="margin:6px 0 0;">
          <span>📋 ${r.volume} suivi${r.volume > 1 ? "s" : ""} actif${r.volume > 1 ? "s" : ""}</span>
          ${r.late ? `<span class="badge badge-late">🔴 ${r.late} en retard</span>` : ""}
          ${r.stalled ? `<span class="badge badge-follow_up">⏸️ ${r.stalled} stagnant${r.stalled > 1 ? "s" : ""}</span>` : ""}
        </div>
        <div style="height:6px;background:var(--color-surface-alt);border-radius:var(--radius-pill);overflow:hidden;margin-top:8px;max-width:240px;">
          <div style="height:100%;width:${Math.round((r.total / maxTotal) * 100)}%;background:${isHeaviest ? "var(--color-danger)" : "var(--color-primary)"};"></div>
        </div>
      </div>
      <button type="button" class="btn btn-secondary btn-sm add-followup-btn">+ Suivi</button>
    `;
    row.querySelector(".item-main").addEventListener("click", () => openPersonDetail(r.person, followUps));
    row.querySelector(".add-followup-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      openCreateFollowUpModal({ person: r.person, onCreated: () => showToast("Suivi créé") });
    });
    card.appendChild(row);
  });
  container.appendChild(card);
}
