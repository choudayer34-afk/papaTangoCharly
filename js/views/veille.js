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
import { renderInfoTip } from "../components/infoTip.js";

// Aide "à la demande" sur le sélecteur CSS (02/10/2026, demande directe de Charles-Henri après
// son premier sélecteur trouvé sur SEMAE via F12 : "dis-moi la démarche via la console [...]
// intègre ça directement dans pilotage à côté de détection des nouveautés"). Rédigée à partir de
// son propre cas réel (`.hpo-acf-section.section-classic.container-fluid.dark`) : un nom de
// classe de bloc générique, très probablement réutilisé par plusieurs sections de la page (cas
// typique d'un site construit par blocs de contenu réutilisables) — d'où l'étape de vérification
// `querySelectorAll(...).length` ci-dessous, qui est le vrai cœur de la méthode : un sélecteur qui
// correspond à PLUSIEURS endroits de la page ne cible pas forcément le bon, puisque Pilotage (comme
// `document.querySelector()`) ne regarde que le premier trouvé.
const WATCH_SELECTOR_HELP_HTML = `
  <p style="margin-top:0;">Méthode simplifiée : un seul script à coller dans la Console, qui remonte tout seul dans la page et te dit où t'arrêter.</p>
  <ol style="padding-left:20px;margin:8px 0;">
    <li>Clic droit sur <strong>un titre d'actualité</strong> dans la liste de la page → <strong>Inspecter</strong> (ou touche F12). Ça sélectionne l'élément cliqué comme <code>$0</code>.</li>
    <li>Bascule sur l'onglet <strong>Console</strong>, colle ce script entier et valide (Entrée) :
      <pre style="white-space:pre-wrap;word-break:break-word;background:#1e1e1e;color:#ddd;padding:8px;border-radius:4px;font-size:12px;overflow-x:auto;margin:6px 0;">(() =&gt; {
  let el = $0;
  let level = 0;
  while (el &amp;&amp; el.tagName !== "BODY") {
    const cls = typeof el.className === "string" ? el.className : "";
    const idPart = el.id ? \` id="\${el.id}"\` : "";
    const clsPart = cls ? \` class="\${cls}"\` : "";
    const len = el.textContent.trim().length;
    const preview = el.textContent.trim().replace(/\\s+/g, " ").slice(0, 150);
    console.log(\`[\${level}] &lt;\${el.tagName.toLowerCase()}\${idPart}\${clsPart}&gt; — \${len} caractères — "\${preview}"\`);
    el = el.parentElement;
    level++;
  }
})();</pre>
    </li>
    <li>Ça affiche une ligne par niveau, du titre cliqué (<code>[0]</code>) jusqu'au bas de la page. Lis la colonne "caractères" : elle reste petite tant que c'est UN SEUL article, puis fait un saut quand plusieurs articles se retrouvent regroupés ensemble — arrête-toi à ce niveau-là (ni un seul article, ni toute la page).</li>
    <li>Note la classe ou l'<code>id</code> affiché à ce niveau, puis vérifie son unicité sur la page : <code>document.querySelectorAll('TON-SÉLECTEUR').length</code>. Résultat <strong>1</strong> → tu peux l'utiliser, passe à l'étape 6. Résultat supérieur à 1 (fréquent avec un nom de bloc générique type "section", réutilisé plusieurs fois sur une page construite par blocs) → passe à l'étape 5.</li>
    <li>Sélecteur ambigu (résultat &gt; 1) : cherche un repère unique tout près de l'élément plutôt que de t'appuyer sur sa classe seule.
      <ul style="padding-left:20px;margin:6px 0;">
        <li>Beaucoup de sites ont un "sommaire" en haut de page (des liens du type <code>&gt; Actualités</code>, <code>&gt; Autre rubrique</code>...). Ces liens pointent vers des ancres qui, par construction, sont uniques sur la page — un bon repère à chercher près de la zone qui t'intéresse.</li>
        <li>Dans la Console, sur l'élément ambigu (toujours <code>$0</code>) : tape <code>$0.previousElementSibling?.outerHTML</code>. Si ça affiche un <code>&lt;a name="..."&gt;</code> ou un élément avec un <code>id="..."</code>, tu tiens ton repère unique.</li>
        <li>Sinon, Ctrl+F dans l'onglet Elements (ou Ctrl+U puis Ctrl+F pour voir le code source) sur un mot du titre de la section qui t'intéresse — ça montre souvent l'ancre ou l'id juste à côté dans le code.</li>
        <li>Une fois le repère trouvé (ex. <code>&lt;a name="ma-rubrique"&gt;</code> juste avant la bonne section), combine-le avec <code>+</code> (= "l'élément juste après") : <code>a[name="ma-rubrique"] + section .ta-classe-ici</code>. Revérifie l'unicité avec <code>querySelectorAll(...).length</code>.</li>
        <li>Si vraiment aucun repère n'existe : <code>:nth-of-type(n)</code> pour viser la Nième occurrence (moins solide si l'ordre des sections change un jour).</li>
      </ul>
    </li>
    <li>Avant de coller le sélecteur dans le champ ci-dessous : vérifie ce qu'il donnerait vraiment avec <code>document.querySelector('TON-SÉLECTEUR')?.textContent.slice(0, 200)</code> dans la Console. Si ça commence par un vrai titre d'actualité (pas un menu, pas un bandeau de cookies), c'est gagné — confirme ensuite avec "🔍 Tester maintenant" ci-dessous.</li>
  </ol>
  <p style="margin-bottom:0;">Exemple réel (site SEMAE) : en remontant depuis le titre d'un article avec ce script, chaque actualité était déjà isolée dans son propre bloc de page (classes génériques type <code>.hpo-acf-section.section-classic.container-fluid.dark</code> et <code>.col-xs-12.texte</code>, réutilisées ailleurs sur le site — 27 occurrences pour cette dernière, <code>querySelectorAll(...).length</code> bien supérieur à 1, écarté telles quelles). Le menu en haut de page contenait un lien <code>#actualites-reglementaires</code> ; dans le code source, ce lien correspondait à une ancre <code>&lt;a name="actualites-reglementaires"&gt;</code> placée juste avant la bonne section. Sélecteur final, combinant cette ancre unique et la classe répétée : <code>a[name="actualites-reglementaires"] + section .texte</code> — confirmé par <code>querySelectorAll(...).length</code> égal à <strong>1</strong>, et un aperçu qui commence bien par un vrai titre d'actualité.</p>
`;

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
          <label for="veille-watch-selector" style="display:inline-flex;align-items:center;gap:2px;">
            Sélecteur CSS de la zone à comparer (optionnel)
            <span id="veille-watch-selector-info"></span>
          </label>
          <input id="veille-watch-selector" type="text" placeholder="Ex. .liste-actualites — laisse vide pour comparer toute la page" value="${escapeAttr(existing?.watchSelector || "")}" />
          <div class="item-meta">La partie de la page à surveiller, pas toute la page (sinon une pub ou une date qui tourne déclenche un faux "nouveau" à chaque fois). Teste avant d'enregistrer : chaque site a sa propre structure, impossible de deviner sans vérifier contre la vraie page.</div>
        </div>
        <button type="button" id="veille-watch-test-btn" class="btn btn-secondary btn-sm">🔍 Tester maintenant</button>
        <div id="veille-watch-test-result" class="item-meta"></div>
        ${
          existing?.watchEnabled
            ? `<div class="item-meta">
                ${existing.lastCheckedAt ? `Dernière vérification : ${new Date(existing.lastCheckedAt).toLocaleString("fr-FR")}.` : "Jamais encore vérifiée."}
                ${existing.lastCheckError ? ` ⚠️ ${escapeHtml(veilleApi.WATCH_ERROR_LABELS[existing.lastCheckError] || existing.lastCheckError)}${existing.lastCheckDetail ? ` (${escapeHtml(existing.lastCheckDetail)})` : ""}` : ""}
                ${veilleApi.hasNewContent(existing) ? ` 🆕 Nouveauté détectée le ${new Date(existing.lastChangedAt).toLocaleString("fr-FR")}.` : ""}
              </div>`
            : ""
        }
      </details>
    `;
    clearFieldErrorOnInput(body, ["#veille-title"]);
    renderInfoTip(body.querySelector("#veille-watch-selector-info"), WATCH_SELECTOR_HELP_HTML);

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
          : `⚠️ ${veilleApi.WATCH_ERROR_LABELS[result.error] || result.error}${result.detail ? ` (${result.detail})` : ""}`;
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
