// 📡 Veille — écran "accès centralisé" (01-02/10/2026, besoin direct de Charles-Henri, hors
// roadmap TODO_TECHNIQUE.md — voir claude/sources-veille-02-10-2026.md pour toute la réflexion
// qui a précédé ce code). Un seul endroit listant les sources à consulter par sujet, point de
// départ de la ronde quotidienne — préféré explicitement par Charles-Henri à une vue filtrée par
// tag dans l'Inbox ("pas sûr que la vue tags me convienne, j'ai besoin de centraliser l'accès").
//
// La MÉTHODE (pourquoi deux rythmes différents, comment dérouler le rituel quotidien) est
// expliquée une seule fois dans le Guide (js/views/guide.js, rubrique "📡 Comment faire sa
// veille") plutôt que répétée ici — ce fichier se contente d'un rappel très court + un lien direct
// vers cette rubrique, pour ne pas dupliquer le texte à deux endroits qui finiraient par diverger.
//
// 🔍 Détection de nouveautés (02/10/2026) — voir js/domain/veille.js pour le fonctionnement
// (proxy CORS gratuit + empreinte de contenu) et le pourquoi (pas de flux RSS exploitable pour la
// plupart des sources, abandon explicite de Charles-Henri : "Laisse tomber pour les flux"). Deux
// ajouts à cet écran : un badge "🆕" sur les sources surveillées ayant du nouveau depuis la
// dernière visite, et un bouton de vérification manuelle (jamais automatique — même principe que
// le reste de l'app). La configuration PAR SITE (activer, URL à surveiller si différente, sélecteur
// CSS de la zone à comparer) vit dans la modale d'édition de la source, avec un bouton "🔍 Tester"
// pour la régler contre la vraie page avant d'enregistrer — jamais à l'aveugle, vu que chaque site
// a sa propre structure (voir le retour de Charles-Henri : "ça doit dépendre aussi des sites en
// terme de structure").

import * as veilleApi from "../domain/veille.js";
import { openModal, closeModal, confirmDelete, guardClick } from "../components/modal.js";
import { validateRequiredFields, validateUrlField, clearFieldErrorOnInput } from "../components/formValidation.js";
import { showToast } from "../components/toast.js";
import { guideLinkHtml } from "./guide.js";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

export function renderVeille(container) {
  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>📡 Veille</h1>
        <div class="subtitle">Tes sources à consulter par sujet — le point de départ de ta ronde du matin</div>
      </div>
      <div style="display:flex;gap:8px;">
        <button id="veille-check-btn" class="btn btn-secondary btn-sm" style="display:none;">🔍 Vérifier</button>
        <button id="veille-new-btn" class="btn btn-primary btn-sm">+ Source</button>
      </div>
    </div>
    <div class="view">
      <p class="item-meta" style="margin-top:0;">
        Réglementation et marché/concurrence se scannent chaque jour (titres seulement, 5-10 min) ;
        management/pilotage se consulte plus librement, sans pression. ${guideLinkHtml(
          "guide-topics-title",
          "📖 Voir la méthode complète dans le guide"
        )}
      </p>
      <div id="veille-starter-prompt"></div>
      <div id="veille-sections"></div>
    </div>
  `;

  const newBtn = container.querySelector("#veille-new-btn");
  const checkBtn = container.querySelector("#veille-check-btn");
  const starterEl = container.querySelector("#veille-starter-prompt");
  const sectionsEl = container.querySelector("#veille-sections");

  newBtn.addEventListener("click", () => openSourceModal());

  // Bouton de vérification groupée (02/10/2026) : visible seulement s'il existe au moins une
  // source surveillée (`watchEnabled`) — inutile de l'afficher tant que personne n'a configuré de
  // détection. Séquentiel, pas en parallèle : un proxy public gratuit et partagé n'a aucune raison
  // d'être sollicité d'un coup pour 16 requêtes simultanées, et ça reste cohérent avec le rythme
  // "une ronde, pas une rafale" du reste de la veille.
  checkBtn.addEventListener(
    "click",
    guardClick(checkBtn, async () => {
      const watched = currentSources.filter((s) => s.watchEnabled);
      if (!watched.length) return;
      checkBtn.textContent = "🔍 Vérification…";
      let changed = 0;
      let failed = 0;
      for (const source of watched) {
        const result = await veilleApi.checkSourceForChanges(source);
        if (!result.ok) failed++;
        else if (result.changed) changed++;
      }
      checkBtn.textContent = "🔍 Vérifier";
      const parts = [`${watched.length} vérifiée${watched.length > 1 ? "s" : ""}`];
      if (changed) parts.push(`${changed} nouveauté${changed > 1 ? "s" : ""}`);
      if (failed) parts.push(`${failed} échec${failed > 1 ? "s" : ""}`);
      showToast(parts.join(" · "));
    })
  );

  let currentSources = [];

  let unsubscribe = null;
  unsubscribe = veilleApi.subscribe((sources) => {
    render(sources);
  });

  function render(sources) {
    currentSources = sources;
    checkBtn.style.display = sources.some((s) => s.watchEnabled) ? "" : "none";
    renderStarterPrompt(sources);
    renderSections(sources);
  }

  function renderStarterPrompt(sources) {
    if (sources.length > 0) {
      starterEl.innerHTML = "";
      return;
    }
    starterEl.innerHTML = `
      <div class="card" style="margin-bottom:16px;">
        <div class="item-title" style="margin-bottom:4px;">Aucune source pour l'instant</div>
        <div class="item-meta" style="margin-bottom:12px;">
          Une première liste de ${veilleApi.STARTER_SOURCES.length} sources a déjà été construite avec toi
          (réglementation semences, concurrence Agreo, podcasts management) — tu peux l'importer
          d'un clic puis l'ajuster librement, ou repartir de zéro avec "+ Source" ci-dessus.
        </div>
        <button type="button" id="veille-import-starter-btn" class="btn btn-secondary btn-sm">📥 Importer la liste proposée</button>
      </div>
    `;
    const importBtn = starterEl.querySelector("#veille-import-starter-btn");
    importBtn.addEventListener(
      "click",
      guardClick(importBtn, async () => {
        await Promise.all(veilleApi.STARTER_SOURCES.map((s) => veilleApi.createSource(s)));
        showToast(`${veilleApi.STARTER_SOURCES.length} sources importées`);
      })
    );
  }

  function renderSections(sources) {
    sectionsEl.innerHTML = "";
    for (const cat of veilleApi.CATEGORIES) {
      const items = sources.filter((s) => s.category === cat.key).sort((a, b) => a.title.localeCompare(b.title, "fr"));

      const title = document.createElement("div");
      title.className = "section-title";
      title.style.marginTop = sectionsEl.children.length === 0 ? "0" : "";
      title.textContent = `${cat.emoji} ${cat.label}${items.length ? ` (${items.length})` : ""}`;
      sectionsEl.appendChild(title);

      if (!items.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.style.marginBottom = "16px";
        empty.innerHTML = `<span class="emoji">${cat.emoji}</span>Pas encore de source ici.`;
        sectionsEl.appendChild(empty);
        continue;
      }

      const list = document.createElement("div");
      list.className = "card";
      list.style.marginBottom = "16px";
      for (const source of items) {
        const isNew = veilleApi.hasNewContent(source);
        const row = document.createElement("div");
        row.className = "item-row";
        row.innerHTML = `
          <div class="item-main">
            ${
              source.url
                ? `<a href="${escapeAttr(source.url)}" target="_blank" rel="noopener" class="item-title">${escapeHtml(source.title)}</a>`
                : `<div class="item-title">${escapeHtml(source.title)}</div>`
            }${isNew ? ` <span class="badge badge-new">🆕 Nouveau</span>` : ""}
            ${source.notes ? `<div class="item-meta">${escapeHtml(source.notes)}</div>` : ""}
          </div>
          <button type="button" class="btn btn-ghost btn-sm veille-edit-btn" aria-label="Modifier" title="Modifier">✏️</button>
        `;
        // Le badge "🆕" s'efface dès qu'on suit le lien — même principe que la pastille "Nouveau"
        // de ☰ Plus (js/views/more.js) sur Nouveautés : "vu" se déclenche en allant réellement
        // regarder, pas en ouvrant juste la fiche d'édition.
        if (isNew) {
          row.querySelector("a")?.addEventListener("click", () => veilleApi.acknowledgeSource(source.id));
        }
        row.querySelector(".veille-edit-btn").addEventListener("click", () => openSourceModal(source));
        list.appendChild(row);
      }
      sectionsEl.appendChild(list);
    }
  }

  function openSourceModal(existing = null) {
    const body = document.createElement("div");
    body.innerHTML = `
      <div class="field">
        <label for="veille-title">Titre</label>
        <input id="veille-title" type="text" placeholder="Ex. SEMAE — réglementation semences" value="${escapeAttr(existing?.title || "")}" />
      </div>
      <div class="field">
        <label for="veille-url">Lien (optionnel)</label>
        <input id="veille-url" type="url" placeholder="https://..." value="${escapeAttr(existing?.url || "")}" />
      </div>
      <div class="field">
        <label for="veille-category">Catégorie</label>
        <select id="veille-category">
          ${veilleApi.CATEGORIES.map(
            (c) => `<option value="${c.key}" ${existing && existing.category === c.key ? "selected" : ""}>${c.emoji} ${c.label}</option>`
          ).join("")}
        </select>
      </div>
      <div class="field">
        <label for="veille-notes">Note (optionnel)</label>
        <textarea id="veille-notes" placeholder="Ce que cette source apporte, mot-clé d'alerte à surveiller...">${escapeHtml(existing?.notes || "")}</textarea>
      </div>
      <details>
        <summary>🔍 Détection de nouveautés (expérimental)</summary>
        <label style="display:flex;align-items:center;gap:8px;margin-top:10px;">
          <input id="veille-watch-enabled" type="checkbox" style="width:auto;" ${existing?.watchEnabled ? "checked" : ""} />
          Activer la détection sur ce site
        </label>
        <div class="field">
          <label for="veille-watch-url">URL à surveiller (si différente du lien ci-dessus)</label>
          <input id="veille-watch-url" type="url" placeholder="https://..." value="${escapeAttr(existing?.watchUrl || "")}" />
        </div>
        <div class="field">
          <label for="veille-watch-selector">Sélecteur CSS de la zone à comparer (optionnel)</label>
          <input id="veille-watch-selector" type="text" placeholder="Ex. .liste-actualites — laisse vide pour comparer toute la page" value="${escapeAttr(existing?.watchSelector || "")}" />
          <div class="item-meta">La partie de la page à surveiller, pas toute la page (sinon une pub ou une date qui tourne déclenche un faux "nouveau" à chaque fois). Teste avant d'enregistrer : chaque site a sa propre structure, impossible de deviner sans vérifier contre la vraie page.</div>
        </div>
        <button type="button" id="veille-watch-test-btn" class="btn btn-secondary btn-sm">🔍 Tester maintenant</button>
        <div id="veille-watch-test-result" class="item-meta"></div>
        ${
          existing?.watchEnabled
            ? `<div class="item-meta">
                ${existing.lastCheckedAt ? `Dernière vérification : ${new Date(existing.lastCheckedAt).toLocaleString("fr-FR")}.` : "Jamais encore vérifiée."}
                ${existing.lastCheckError ? ` ⚠️ ${escapeHtml(veilleApi.WATCH_ERROR_LABELS[existing.lastCheckError] || existing.lastCheckError)}` : ""}
                ${veilleApi.hasNewContent(existing) ? ` 🆕 Nouveauté détectée le ${new Date(existing.lastChangedAt).toLocaleString("fr-FR")}.` : ""}
              </div>`
            : ""
        }
      </details>
    `;
    clearFieldErrorOnInput(body, ["#veille-title"]);

    const testBtn = body.querySelector("#veille-watch-test-btn");
    const testResultEl = body.querySelector("#veille-watch-test-result");
    testBtn.addEventListener(
      "click",
      guardClick(testBtn, async () => {
        testResultEl.textContent = "Vérification en cours...";
        const result = await veilleApi.previewWatch({
          url: body.querySelector("#veille-url").value.trim(),
          watchUrl: body.querySelector("#veille-watch-url").value.trim(),
          watchSelector: body.querySelector("#veille-watch-selector").value.trim(),
        });
        testResultEl.textContent = result.ok
          ? `✅ Zone trouvée (${result.text.length} caractères) — aperçu : « ${result.preview}${result.text.length > result.preview.length ? "…" : ""} »`
          : `⚠️ ${veilleApi.WATCH_ERROR_LABELS[result.error] || result.error}`;
      })
    );

    const actions = [
      { label: "Annuler", variant: "ghost" },
      {
        label: existing ? "Enregistrer" : "Ajouter",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          if (!validateRequiredFields(bodyEl, [{ selector: "#veille-title", label: "Le titre" }])) return;
          if (!validateUrlField(bodyEl, "#veille-url")) return;
          const patch = {
            title: bodyEl.querySelector("#veille-title").value.trim(),
            url: bodyEl.querySelector("#veille-url").value.trim(),
            category: bodyEl.querySelector("#veille-category").value,
            notes: bodyEl.querySelector("#veille-notes").value.trim(),
            watchEnabled: bodyEl.querySelector("#veille-watch-enabled").checked,
            watchUrl: bodyEl.querySelector("#veille-watch-url").value.trim(),
            watchSelector: bodyEl.querySelector("#veille-watch-selector").value.trim(),
          };
          if (existing) {
            await veilleApi.updateSource(existing.id, patch);
            showToast("Source modifiée");
          } else {
            await veilleApi.createSource(patch);
            showToast("Source ajoutée");
          }
          close();
        },
      },
    ];
    if (existing) {
      actions.push({
        label: "🗑️ Supprimer",
        variant: "danger",
        onClick: () => {
          // Ferme explicitement CETTE modale avant d'ouvrir confirmDelete (même principe que
          // js/components/stickyNoteShared.js#openStickyNoteMenu) — openModal() le ferait de
          // toute façon tout seul ("une seule modale à la fois"), mais fermer explicitement évite
          // un flash visuel entre les deux.
          closeModal();
          confirmDelete({
            title: "Supprimer cette source ?",
            message: `« ${existing.title} » sera retirée de ta liste de veille.`,
            onConfirm: async () => {
              await veilleApi.removeSource(existing.id);
              showToast("Source supprimée");
            },
          });
        },
      });
    }

    const { bodyEl, close } = openModal({ title: existing ? "Modifier la source" : "Nouvelle source de veille", body, actions });
  }

  return () => {
    unsubscribe?.();
  };
}
