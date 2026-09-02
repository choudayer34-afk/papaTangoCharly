// Fenêtre de masquage privée, ouverte AVANT "🗒️ Préparer mon point" (retour de Charles-Henri,
// vague 22 sexies) : "il faut qu'avant je puisse cocher ce que je ne veux pas remonter dans cet
// écran en mode privé et que cette modale soit déportée et déplaçable seule sur un autre
// écran." — voir js/views/people.js#openPrepMaskThenPrep pour le déclenchement (window.open)
// et le raisonnement complet sur pourquoi ceci doit être une vraie fenêtre de navigateur plutôt
// qu'une modale du composant habituel (js/components/modal.js) : seule une vraie fenêtre peut
// être glissée par l'OS sur un second écran, indépendamment de la fenêtre principale — celle
// que Charles-Henri partage en visio pendant le point.
//
// Rendue par js/app.js sur la route dédiée `#/prep-mask?person=<id>`, en dehors du montage
// habituel de la navigation/des FAB (mountApp) : un outil ponctuel et concentré, pas un second
// onglet de travail complet.
//
// Le masquage est PERSISTANT par Suivi (`hiddenFromPrep`, retour explicite de Charles-Henri :
// "mémorisé pour cette personne" plutôt que remis à zéro à chaque préparation) — un sujet
// durablement sensible (RH, personnel) reste masqué tant qu'il n'est pas explicitement
// redécoché, y compris lors d'une prochaine préparation un autre jour.

import * as peopleApi from "../domain/people.js";
import * as followUpsApi from "../domain/followups.js";
import * as projectsApi from "../domain/projects.js";
import { computePrepSections } from "./people.js";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

export async function renderPrepMask(container) {
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  const personId = params.get("person");
  const person = personId ? await peopleApi.getPerson(personId) : null;

  if (!person) {
    container.innerHTML = `
      <div class="view" style="max-width:420px;margin:0 auto;padding:15vh 20px 0;text-align:center;">
        <p>Personne introuvable — ferme cette fenêtre et réessaye depuis « 🗒️ Préparer mon point ».</p>
      </div>
    `;
    return null;
  }

  document.title = `Masquer — Point avec ${person.name}`;

  async function refresh() {
    const [allFollowUps, projects] = await Promise.all([followUpsApi.listAll(), projectsApi.listAll()]);
    const { overdue, toTell, upcoming, upcomingGroups, recentlyDone } = computePrepSections(person, allFollowUps, projects, {
      includeHidden: true,
    });
    const hiddenCount = [...overdue, ...toTell, ...upcoming, ...recentlyDone].filter((f) => f.hiddenFromPrep).length;

    container.innerHTML = `
      <div class="view" style="max-width:520px;margin:0 auto;padding:20px;">
        <h1 style="margin-top:0;">🙈 Avant de partager</h1>
        <p class="item-meta" style="margin-bottom:8px;">
          Coche ce que tu veux garder privé — ça n'apparaîtra pas dans le point avec
          <strong>${escapeHtml(person.name)}</strong>. Une fois décoché, un sujet reste masqué
          la prochaine fois aussi, jusqu'à ce que tu le redécoches ici.
        </p>
        <p class="item-meta" style="margin-bottom:20px;">
          Cette fenêtre est privée — garde-la sur ton écran, ou déplace-la sur un second si tu
          en as un. Ferme-la quand tu es prêt : le point s'ouvrira automatiquement dans l'autre
          fenêtre${hiddenCount ? `, avec ${hiddenCount} sujet${hiddenCount > 1 ? "s" : ""} masqué${hiddenCount > 1 ? "s" : ""}` : ""}.
        </p>
        <div class="section-title" style="margin-top:0;">🔴 En retard de contrôle (${overdue.length})</div>
        <div class="card" id="mask-overdue" style="margin-bottom:16px;"></div>
        <div class="section-title">📣 À transmettre (${toTell.length})</div>
        <div class="card" id="mask-to-tell" style="margin-bottom:16px;"></div>
        <div class="section-title">🎯 À aborder (${upcoming.length})</div>
        <div class="card" id="mask-upcoming" style="margin-bottom:16px;"></div>
        <div class="section-title">🟢 Terminé récemment (${recentlyDone.length})</div>
        <div class="card" id="mask-done" style="margin-bottom:20px;"></div>
        <button type="button" id="mask-close-btn" class="btn btn-primary btn-block">✅ Terminé — fermer cette fenêtre</button>
      </div>
    `;

    renderMaskList(container.querySelector("#mask-overdue"), overdue, refresh);
    renderMaskList(container.querySelector("#mask-to-tell"), toTell, refresh);
    renderMaskGroupedList(container.querySelector("#mask-upcoming"), upcomingGroups, refresh);
    renderMaskList(container.querySelector("#mask-done"), recentlyDone, refresh);

    container.querySelector("#mask-close-btn").addEventListener("click", () => window.close());
  }

  await refresh();
  return null; // rien à nettoyer — cette fenêtre n'a pas de cycle de vie de route habituel
}

function renderMaskList(el, items, onChange) {
  if (!items.length) {
    el.innerHTML = `<div class="empty-state" style="padding:16px;">Rien ici.</div>`;
    return;
  }
  el.innerHTML = "";
  for (const f of items) appendMaskRow(el, f, onChange);
}

function renderMaskGroupedList(el, groups, onChange) {
  if (!groups.some((g) => g.items.length)) {
    el.innerHTML = `<div class="empty-state" style="padding:16px;">Rien ici.</div>`;
    return;
  }
  el.innerHTML = "";
  for (const group of groups) {
    if (!group.items.length) continue;
    const label = document.createElement("div");
    label.className = "prep-group-label";
    label.textContent = group.label;
    el.appendChild(label);
    for (const f of group.items) appendMaskRow(el, f, onChange);
  }
}

function appendMaskRow(el, f, onChange) {
  const row = document.createElement("label");
  row.className = "item-row";
  row.style.cursor = "pointer";
  row.innerHTML = `
    <input type="checkbox" class="mask-checkbox" ${f.hiddenFromPrep ? "checked" : ""} style="width:auto;margin-right:10px;flex-shrink:0;" aria-label="Masquer ce sujet" />
    <div class="item-main">
      <div class="item-title" style="${f.hiddenFromPrep ? "text-decoration:line-through;color:var(--color-text-muted);" : ""}">${escapeHtml(f.title)}</div>
    </div>
  `;
  row.querySelector(".mask-checkbox").addEventListener("change", async (e) => {
    await followUpsApi.updateFollowUp(f.id, { hiddenFromPrep: e.target.checked });
    onChange();
  });
  el.appendChild(row);
}
