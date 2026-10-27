// Écran "📦 Dossier de passation" (27/10/2026, retour de Charles-Henri : arrêt maladie, besoin de
// remettre à son chef ce qui est en cours) — voir js/domain/handover.js pour le périmètre et
// js/domain/handoverExport.js pour les fichiers produits. Ce que l'écran ajoute : le choix des
// personnes incluses, l'option (décochée par défaut) d'inclure ses notes privées sur chaque
// personne, un mot d'introduction facultatif, et un aperçu des chiffres avant de générer.
import * as peopleApi from "../domain/people.js";
import { loadHandoverSource, computeHandover, downloadGlobalPdf, downloadHandoverExcel, downloadPeopleZip } from "../domain/handoverExport.js";
import { showToast } from "../components/toast.js";
import { saveDraft, getDraft, clearDraft } from "../services/draftStore.js";

const INTRO_DRAFT_KEY = "handover-intro";

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export async function renderHandover(container) {
  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>📦 Dossier de passation</h1>
        <div class="subtitle">Ce qui est en cours, à remettre à ton chef : projets, tâches, suivi de l'équipe</div>
      </div>
      <a href="#/more" class="btn btn-secondary btn-sm">← Retour</a>
    </div>
    <div class="view" id="handover-body"><p class="item-meta">Chargement de tes données…</p></div>
  `;
  const body = container.querySelector("#handover-body");

  let source;
  try {
    source = await loadHandoverSource();
  } catch (err) {
    body.innerHTML = `<div class="empty-state" style="padding:16px;text-align:center;">⚠️ Impossible de charger tes données pour l'instant.<br /><span class="item-meta">${escapeHtml(err?.message || String(err))}</span><br /><button type="button" id="handover-retry" class="btn btn-secondary btn-sm" style="margin-top:10px;">🔄 Réessayer</button></div>`;
    body.querySelector("#handover-retry").addEventListener("click", () => renderHandover(container));
    return;
  }

  const team = peopleApi.sortPeople(source.people.filter((p) => p.type !== "manager"));
  const draft = getDraft(INTRO_DRAFT_KEY);

  body.innerHTML = `
    <p class="item-meta" style="margin-bottom:12px;">
      Uniquement ce qui <strong>n'est pas terminé</strong>, avec les notes, échéances, checklists et
      ressources (liens) associées. Les sujets que tu as <strong>masqués du point</strong> ne sortent jamais.
    </p>
    <div class="section-title" style="margin-top:0;">Aperçu</div>
    <div class="card" id="handover-preview" style="margin-bottom:16px;"></div>
    <div class="section-title">Personnes incluses dans les fiches</div>
    <div class="card" id="handover-people" style="margin-bottom:16px;">
      ${
        team.length
          ? team
              .map(
                (p) => `<label class="item-row" style="cursor:pointer;gap:10px;">
        <input type="checkbox" class="handover-person" value="${escapeHtml(p.id)}" checked />
        <div class="item-main"><div class="item-title">${escapeHtml(p.name)}</div>${p.role ? `<div class="item-meta">${escapeHtml(p.role)}</div>` : ""}</div>
      </label>`
              )
              .join("")
          : '<p class="item-meta">Aucun collaborateur enregistré.</p>'
      }
    </div>
    <div class="card" style="margin-bottom:16px;">
      <label class="item-row" style="cursor:pointer;gap:10px;border-bottom:none;">
        <input type="checkbox" id="handover-private-notes" />
        <div class="item-main">
          <div class="item-title">Inclure mes notes privées sur chaque personne</div>
          <div class="item-meta">Décoché par défaut : le journal de notes et le contexte de la fiche Personne ne sortent pas.</div>
        </div>
      </label>
    </div>
    <div class="field">
      <label for="handover-intro">Mot d'introduction pour ton chef (facultatif)</label>
      <textarea id="handover-intro" rows="4" placeholder="Ex. : Voici l'état de mes sujets en cours. Les points les plus urgents sont en page 1…">${escapeHtml(draft?.value || "")}</textarea>
    </div>
    <div class="section-title">Générer</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
      <button type="button" id="handover-global-btn" class="btn btn-primary btn-block">📄 Dossier global (PDF)</button>
      <button type="button" id="handover-xlsx-btn" class="btn btn-secondary btn-block">📊 Tableau Excel (une ligne par sujet)</button>
      <button type="button" id="handover-people-btn" class="btn btn-secondary btn-block">👥 Fiches de l'équipe (ZIP de PDF, une par personne)</button>
    </div>
    <p class="item-meta">
      Le PDF global ne contient que des chiffres sur l'équipe, pas le détail des personnes : celui-ci est
      dans les fiches (confidentielles) et dans l'Excel pour les personnes cochées. Les émojis ne
      s'impriment pas dans les PDF.
    </p>
  `;

  const previewEl = body.querySelector("#handover-preview");
  const introEl = body.querySelector("#handover-intro");
  const privateEl = body.querySelector("#handover-private-notes");

  const getOptions = () => ({
    personIds: [...body.querySelectorAll(".handover-person:checked")].map((el) => el.value),
    includePersonNotes: privateEl.checked,
  });
  const compute = () => computeHandover(source, getOptions());

  function refreshPreview() {
    const s = compute().summary;
    previewEl.innerHTML = `
      <div class="item-row"><div class="item-main"><div class="item-title">📦 ${s.projectsCount} projet(s) en cours</div></div></div>
      <div class="item-row"><div class="item-main"><div class="item-title">✅ ${s.tasksCount} tâche(s) non terminée(s)</div><div class="item-meta">${s.tasksLate} en retard · ${s.due7} d'ici 7 jours · ${s.due30} d'ici 30 jours</div></div></div>
      <div class="item-row" style="border-bottom:none;"><div class="item-main"><div class="item-title">👥 ${s.followUpsCount} suivi(s) d'équipe en cours pour ${s.peopleCount} personne(s)</div><div class="item-meta">${s.followUpsLate} en retard de contrôle ou d'échéance</div></div></div>
    `;
  }
  refreshPreview();
  body.querySelectorAll(".handover-person").forEach((el) => el.addEventListener("change", refreshPreview));

  introEl.addEventListener("input", () => {
    if (introEl.value.trim()) saveDraft(INTRO_DRAFT_KEY, { value: introEl.value });
    else clearDraft(INTRO_DRAFT_KEY);
  });

  function run(button, task) {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      button.disabled = true;
      try {
        task();
      } catch (err) {
        console.error("[handover] Génération en échec :", err);
        showToast("⚠️ La génération a échoué : " + (err?.message || "erreur technique"));
      } finally {
        button.disabled = false;
      }
    });
  }

  run(body.querySelector("#handover-global-btn"), () => {
    downloadGlobalPdf(compute(), { intro: introEl.value });
    showToast("📄 Dossier global généré");
  });
  run(body.querySelector("#handover-xlsx-btn"), () => {
    const n = downloadHandoverExcel(compute());
    showToast(`📊 Tableau généré : ${n} ligne(s)`);
  });
  run(body.querySelector("#handover-people-btn"), () => {
    const data = compute();
    if (!data.people.length) {
      showToast("Aucune personne cochée");
      return;
    }
    const n = downloadPeopleZip(data);
    showToast(`👥 ${n} fiche(s) générée(s)`);
  });
}
