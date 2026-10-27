// Écran "📦 Dossier de passation" (27/10/2026, retour de Charles-Henri : arrêt maladie, besoin de
// remettre à son chef ce qui est en cours) — voir js/domain/handover.js pour le périmètre et
// js/domain/handoverExport.js pour les fichiers produits. Ce que l'écran ajoute : le choix des
// personnes incluses, l'option (décochée par défaut) d'inclure ses notes privées sur chaque
// personne, un mot d'introduction facultatif, et un aperçu des chiffres avant de générer.
import * as peopleApi from "../domain/people.js";
import { loadHandoverSource, computeHandover, downloadGlobalPdf, downloadHandoverExcel, downloadPeopleZip } from "../domain/handoverExport.js";
import { buildCoverMessage } from "../domain/handover.js";
import { showToast } from "../components/toast.js";
import { saveDraft, getDraft, clearDraft } from "../services/draftStore.js";

const INTRO_DRAFT_KEY = "handover-intro";
const EXCLUDED_PROJECTS_KEY = "handover-excluded-projects"; // choix mémorisé sur cet appareil (ex. projets personnels comme le CSE)

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
      <a href="#/more" class="btn btn-secondary btn-sm" style="flex:none;white-space:nowrap;">← Retour</a>
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
  const activeProjects = source.projects.filter((p) => p.status === "active").sort((a, b) => (a.order ?? a.createdAt ?? 0) - (b.order ?? b.createdAt ?? 0));
  const openTaskCountByProject = new Map();
  for (const t of source.tasks) if (t.projectId && t.status !== "done") openTaskCountByProject.set(t.projectId, (openTaskCountByProject.get(t.projectId) || 0) + 1);
  const draft = getDraft(INTRO_DRAFT_KEY);
  const previouslyExcluded = new Set(getDraft(EXCLUDED_PROJECTS_KEY)?.ids || []);

  body.innerHTML = `
    <p class="item-meta" style="margin-bottom:12px;">
      Uniquement ce qui <strong>n'est pas terminé</strong>, avec les notes, échéances, checklists et
      ressources (liens) associées. Les sujets que tu as <strong>masqués du point</strong> ne sortent jamais.
    </p>
    <div class="section-title" style="margin-top:0;">Aperçu</div>
    <div class="card" id="handover-preview" style="margin-bottom:16px;"></div>
    <div class="section-header-row">
      <div class="section-title" style="margin-top:0;">Projets inclus</div>
      <span style="flex:none;white-space:nowrap;display:inline-flex"><button type="button" class="btn btn-ghost btn-sm" data-check-all="project">Tout</button><button type="button" class="btn btn-ghost btn-sm" data-check-none="project">Aucun</button></span>
    </div>
    <p class="item-meta" style="margin:0 0 6px;">Décoche les projets personnels (ex. CSE) : le projet et tout ce qui s'y rattache (tâches, suivis, objectifs) ne sortent dans aucun fichier. Ton choix est mémorisé sur cet appareil.</p>
    <div class="card" id="handover-projects" style="margin-bottom:16px;">
      ${
        activeProjects.length
          ? activeProjects
              .map((p) => {
                const n = openTaskCountByProject.get(p.id) || 0;
                return `<label class="item-row" style="cursor:pointer;gap:10px;">
        <input type="checkbox" class="handover-project" value="${escapeHtml(p.id)}" ${previouslyExcluded.has(p.id) ? "" : "checked"} />
        <div class="item-main"><div class="item-title">${escapeHtml(p.name)}</div><div class="item-meta">${n} tâche(s) non terminée(s)${p.category ? " · " + escapeHtml(p.category) : ""}</div></div>
      </label>`;
              })
              .join("")
          : '<p class="item-meta">Aucun projet en cours.</p>'
      }
    </div>
    <div class="section-header-row">
      <div class="section-title" style="margin-top:0;">Personnes incluses dans les fiches</div>
      <span style="flex:none;white-space:nowrap;display:inline-flex"><button type="button" class="btn btn-ghost btn-sm" data-check-all="person">Toutes</button><button type="button" class="btn btn-ghost btn-sm" data-check-none="person">Aucune</button></span>
    </div>
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
    <div class="field">
      <label for="handover-cover-message">Message d'accompagnement pour ton chef (à coller dans un mail)</label>
      <textarea id="handover-cover-message" rows="17" readonly style="font-size:13px;"></textarea>
      <button type="button" id="handover-copy-btn" class="btn btn-secondary btn-block" style="margin-top:8px;">📋 Copier le message</button>
      <p class="item-meta" style="margin-top:6px;">Il explique ce que contient chaque document joint ; la page « Comment lire ce dossier » du PDF global détaille la lecture. Tu pourras l'adapter une fois collé.</p>
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
    excludedProjectIds: [...body.querySelectorAll(".handover-project:not(:checked)")].map((el) => el.value),
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
  const coverEl = body.querySelector("#handover-cover-message");
  function refreshCoverMessage() {
    coverEl.value = buildCoverMessage({ withTeam: getOptions().personIds.length > 0, withExcel: true });
  }
  refreshCoverMessage();
  body.querySelector("#handover-copy-btn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(coverEl.value);
      showToast("📋 Message copié");
    } catch (_err) {
      // Repli (contexte non sécurisé, permission refusée) : sélection manuelle du texte.
      coverEl.removeAttribute("readonly");
      coverEl.focus();
      coverEl.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (_e) {
        ok = false;
      }
      coverEl.setAttribute("readonly", "");
      showToast(ok ? "📋 Message copié" : "Sélectionne le texte et copie-le manuellement");
    }
  });
  function persistExcludedProjects() {
    const ids = getOptions().excludedProjectIds;
    if (ids.length) saveDraft(EXCLUDED_PROJECTS_KEY, { ids });
    else clearDraft(EXCLUDED_PROJECTS_KEY);
  }
  body.querySelectorAll(".handover-person").forEach((el) =>
    el.addEventListener("change", () => {
      refreshPreview();
      refreshCoverMessage();
    })
  );
  body.querySelectorAll(".handover-project").forEach((el) =>
    el.addEventListener("change", () => {
      persistExcludedProjects();
      refreshPreview();
    })
  );
  // "Tout / Aucun" des deux listes.
  body.querySelectorAll("[data-check-all], [data-check-none]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const kind = btn.dataset.checkAll || btn.dataset.checkNone;
      const checked = btn.dataset.checkAll !== undefined;
      body.querySelectorAll(`.handover-${kind}`).forEach((el) => (el.checked = checked));
      if (kind === "project") persistExcludedProjects();
      refreshPreview();
      refreshCoverMessage();
    })
  );

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
