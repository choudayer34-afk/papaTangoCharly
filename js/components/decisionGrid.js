// Grille de décision structurée — §49 (retour de Charles-Henri, discussion OAD, 07/09/2026,
// confirmé comme "point suivant" après la matrice de priorisation et la répartition de
// charge) : "une grille de décision structurée, rattachée à l'entité Décision déjà présente
// [...] plutôt qu'une simple case "décision + date", un petit cadre à critères pondérés
// (coût, risque, réversibilité, urgence) rempli avant de trancher un sujet un peu lourd
// (garder un prestataire, lancer un chantier Modernisation) — la logique de la décision
// resterait tracée dans l'historique, retrouvable trois mois plus tard."
//
// Rattachée à l'entité Décision déjà présente (js/domain/decisions.js) plutôt qu'une nouvelle
// entité — un champ optionnel `grid`, jamais imposé à la création d'une Décision
// (openCreateDecisionModal, js/views/dashboard.js, reste inchangé) : une décision légère
// n'a pas besoin de ce cadre, seul un sujet plus lourd le mérite.
//
// Réutilisable depuis n'importe quelle fiche Décision (aujourd'hui : openRecentDetail,
// js/views/dashboard.js) — même principe que notesBlock.js/checklist.js : ce composant reçoit
// la décision déjà chargée et gère sa propre édition locale (brouillon en mémoire), sans ses
// propres abonnements. Rien n'est persisté avant un clic explicite sur "🗳️ Enregistrer la
// grille" — même logique que le reste de la fiche, qui exige "💾 Enregistrer" — un indicateur
// "Modifications non enregistrées" évite que ça se perde silencieusement en attendant.

import * as decisionsApi from "../domain/decisions.js?v=3";
import { generateId } from "../services/id.js?v=3";
import { closeModal, confirmDelete } from "./modal.js?v=3";
import { showToast } from "./toast.js?v=3";

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/**
 * `decision` : l'objet Décision déjà chargé (peut avoir `.grid` ou non — muté en place ici
 * après un enregistrement/retrait réussi, pour que la fiche appelante reste cohérente si elle
 * se rouvre sans recharger depuis le stockage). `onReopen()` : rouvre la fiche parente après le
 * flux de confirmation du retrait, qui doit fermer/rouvrir la modale (même idiome que le bouton
 * "🗑️ Supprimer" de la fiche Décision elle-même).
 */
export function renderDecisionGrid(container, decision, { onReopen } = {}) {
  let grid = decision.grid ? structuredClone(decision.grid) : null;
  let dirty = false;

  function render() {
    if (!grid) {
      container.innerHTML = `
        <p class="item-meta" style="margin:0 0 8px;">Pour un sujet un peu plus lourd (garder un prestataire, lancer un chantier...) : un cadre à critères pondérés pour comparer plusieurs options plutôt qu'une simple case "décision".</p>
        <button type="button" id="grid-add-btn" class="btn btn-secondary btn-sm">+ Ajouter une grille de décision</button>
      `;
      container.querySelector("#grid-add-btn").addEventListener("click", () => {
        grid = decisionsApi.createEmptyGrid();
        dirty = true;
        render();
      });
      return;
    }

    const { totals, bestIndex } = decisionsApi.gridRecommendation(grid);
    const hasAnyScore = grid.options.some((_, i) => Object.keys(grid.scores[i] || {}).length > 0);

    container.innerHTML = `
      <div style="overflow-x:auto;">
        <table class="decision-grid" style="width:100%;border-collapse:collapse;font-size:var(--font-size-sm);">
          <thead>
            <tr style="border-bottom:1px solid var(--color-border);">
              <th style="text-align:left;padding:6px 8px;">Critère</th>
              <th style="text-align:center;padding:6px 8px;width:64px;">Poids</th>
              ${grid.options
                .map(
                  (opt, i) => `
                <th style="text-align:center;padding:6px 8px;min-width:120px;">
                  <div style="display:flex;align-items:center;justify-content:center;gap:2px;">
                    <input type="text" class="grid-option-name" data-index="${i}" value="${escapeHtml(opt)}" style="width:90px;text-align:center;border:none;border-bottom:1px dashed var(--color-border);background:transparent;font-weight:600;font-size:inherit;color:inherit;padding:2px;" />
                    ${grid.options.length > 2 ? `<button type="button" class="btn btn-ghost btn-sm grid-remove-option" data-index="${i}" aria-label="Retirer cette option" style="padding:0 4px;">✕</button>` : ""}
                  </div>
                </th>
              `
                )
                .join("")}
            </tr>
          </thead>
          <tbody>
            ${grid.criteria
              .map(
                (c) => `
              <tr style="border-bottom:1px solid var(--color-border);">
                <td style="padding:6px 8px;">${escapeHtml(c.label)} <button type="button" class="btn btn-ghost btn-sm grid-remove-criterion" data-id="${c.id}" aria-label="Retirer ce critère" style="padding:0 4px;">✕</button></td>
                <td style="text-align:center;padding:6px 8px;">
                  <input type="number" min="1" max="5" class="grid-weight" data-id="${c.id}" value="${c.weight}" style="width:48px;text-align:center;" />
                </td>
                ${grid.options
                  .map((_, i) => {
                    const score = (grid.scores[i] || {})[c.id] || "";
                    return `
                  <td style="text-align:center;padding:6px 8px;">
                    <select class="grid-score" data-option="${i}" data-criterion="${c.id}">
                      <option value="">—</option>
                      ${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${String(score) === String(n) ? "selected" : ""}>${n}</option>`).join("")}
                    </select>
                  </td>
                `;
                  })
                  .join("")}
              </tr>
            `
              )
              .join("")}
          </tbody>
          <tfoot>
            <tr style="border-top:2px solid var(--color-border);font-weight:700;">
              <td style="padding:6px 8px;">Total pondéré</td>
              <td></td>
              ${grid.options
                .map(
                  (_, i) => `
                <td style="text-align:center;padding:6px 8px;${i === bestIndex && hasAnyScore ? "color:var(--color-success);" : ""}">
                  ${i === bestIndex && hasAnyScore ? "🏆 " : ""}${totals[i].toFixed(1)}/5
                </td>
              `
                )
                .join("")}
            </tr>
          </tfoot>
        </table>
      </div>
      <div style="display:flex;gap:8px;margin:8px 0;flex-wrap:wrap;align-items:center;">
        <button type="button" id="grid-add-option-btn" class="btn btn-ghost btn-sm">+ Option</button>
        <button type="button" id="grid-add-criterion-btn" class="btn btn-ghost btn-sm">+ Critère</button>
      </div>
      <div id="grid-new-criterion-row" style="display:none;gap:8px;margin-bottom:8px;">
        <input id="grid-new-criterion-name" type="text" placeholder="Nom du critère" style="flex:1;border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:var(--space-3);" />
        <button type="button" id="grid-new-criterion-confirm" class="btn btn-secondary btn-sm">Ajouter</button>
      </div>
      <div class="item-meta" style="margin-bottom:8px;">
        ${
          hasAnyScore
            ? `🏆 <strong>${escapeHtml(grid.options[bestIndex])}</strong> conseillée (${totals.map((t, i) => `${escapeHtml(grid.options[i])} ${t.toFixed(1)}/5`).join(" · ")}) — les poids restent modifiables avant de trancher.`
            : "Note chaque option de 1 à 5 sur chaque critère pour voir apparaître une recommandation."
        }
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <button type="button" id="grid-save-btn" class="btn btn-primary btn-sm">🗳️ Enregistrer la grille</button>
        <button type="button" id="grid-remove-btn" class="btn btn-ghost btn-sm">🗑️ Retirer la grille</button>
        ${dirty ? `<span class="item-meta" style="color:var(--color-warning);">Modifications non enregistrées</span>` : ""}
      </div>
    `;

    container.querySelectorAll(".grid-option-name").forEach((input) => {
      input.addEventListener("change", () => {
        const idx = Number(input.dataset.index);
        grid.options[idx] = input.value.trim() || `Option ${idx + 1}`;
        dirty = true;
        render();
      });
    });

    // Retirer une option : jamais en dessous de 2 (une grille compare toujours au moins 2
    // choix) — le bouton n'existe même pas dans ce cas (voir grid.options.length > 2 ci-dessus).
    // Les scores des options suivantes sont décalés d'un cran plutôt que perdus.
    container.querySelectorAll(".grid-remove-option").forEach((btn) => {
      btn.addEventListener("click", () => {
        const removedIdx = Number(btn.dataset.index);
        grid.options.splice(removedIdx, 1);
        const newScores = {};
        grid.options.forEach((_, newIdx) => {
          const oldIdx = newIdx < removedIdx ? newIdx : newIdx + 1;
          if (grid.scores[oldIdx]) newScores[newIdx] = grid.scores[oldIdx];
        });
        grid.scores = newScores;
        dirty = true;
        render();
      });
    });
    container.querySelector("#grid-add-option-btn").addEventListener("click", () => {
      grid.options.push(`Option ${grid.options.length + 1}`);
      dirty = true;
      render();
    });

    container.querySelectorAll(".grid-weight").forEach((input) => {
      input.addEventListener("change", () => {
        const c = grid.criteria.find((c) => c.id === input.dataset.id);
        if (c) c.weight = Math.max(1, Math.min(5, Number(input.value) || 1));
        dirty = true;
        render();
      });
    });
    container.querySelectorAll(".grid-remove-criterion").forEach((btn) => {
      btn.addEventListener("click", () => {
        grid.criteria = grid.criteria.filter((c) => c.id !== btn.dataset.id);
        for (const optionScores of Object.values(grid.scores)) delete optionScores[btn.dataset.id];
        dirty = true;
        render();
      });
    });

    // "+ Critère" : rangée révélée plutôt qu'un window.prompt() (cette app n'utilise jamais de
    // boîte de dialogue native pour une saisie, voir js/components/modal.js) — même geste que
    // "+ Nouveau projet" dans le formulaire Suivi (js/views/people.js).
    const newCritRow = container.querySelector("#grid-new-criterion-row");
    container.querySelector("#grid-add-criterion-btn").addEventListener("click", () => {
      newCritRow.style.display = newCritRow.style.display === "none" ? "flex" : "none";
      if (newCritRow.style.display === "flex") container.querySelector("#grid-new-criterion-name").focus();
    });
    container.querySelector("#grid-new-criterion-confirm").addEventListener("click", () => {
      const name = container.querySelector("#grid-new-criterion-name").value.trim();
      if (!name) return;
      grid.criteria.push({ id: generateId(), label: name, weight: 2 });
      dirty = true;
      render();
    });

    container.querySelectorAll(".grid-score").forEach((select) => {
      select.addEventListener("change", () => {
        const optionIndex = Number(select.dataset.option);
        const criterionId = select.dataset.criterion;
        if (!grid.scores[optionIndex]) grid.scores[optionIndex] = {};
        if (select.value) grid.scores[optionIndex][criterionId] = Number(select.value);
        else delete grid.scores[optionIndex][criterionId];
        dirty = true;
        render();
      });
    });

    container.querySelector("#grid-save-btn").addEventListener("click", async () => {
      await decisionsApi.saveGrid(decision.id, grid);
      decision.grid = structuredClone(grid);
      dirty = false;
      showToast("Grille de décision enregistrée");
      render();
    });

    container.querySelector("#grid-remove-btn").addEventListener("click", () => {
      // Un brouillon jamais enregistré n'a rien à retirer côté stockage — pas besoin de
      // confirmation pour abandonner une saisie en cours.
      if (!decision.grid) {
        grid = null;
        dirty = false;
        render();
        return;
      }
      closeModal();
      confirmDelete({
        title: "Retirer la grille de décision ?",
        message: "Les critères et les notes seront perdus ; la décision elle-même reste intacte.",
        onConfirm: async () => {
          await decisionsApi.removeGrid(decision.id);
          delete decision.grid;
          showToast("Grille de décision retirée");
          onReopen?.();
        },
        onCancel: () => onReopen?.(),
      });
    });
  }

  render();
}
