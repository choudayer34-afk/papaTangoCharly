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
import { parseCompetitorResearchResponse } from "../domain/veilleResearchImport.js";
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

// Valeur affichée par les 2 curseurs de positionnement (02/10/2026, Benchmark visuel) : 5 par
// défaut (neutre) tant que la fiche n'a jamais été enregistrée depuis l'ajout de ces champs — pas
// "non positionné" dans le FORMULAIRE (le curseur doit bien avoir une position de départ), mais
// bien "non positionné" sur la carte tant qu'aucun enregistrement n'a eu lieu (voir
// js/domain/veille.js#hasPositioning, qui distingue les deux).
function specializationValue(existing) {
  return typeof existing?.specializationScore === "number" ? existing.specializationScore : 5;
}
function roadmapVisibilityValue(existing) {
  return typeof existing?.roadmapVisibilityScore === "number" ? existing.roadmapVisibilityScore : 5;
}

// Fiche visuelle d'UN concurrent (02/10/2026, retour direct de Charles-Henri après avoir vu la
// page statique livrée à part : "ça doit être réalisable dans pilote et même pour tout les
// nouveaux que je rajouterai"). Construite UNIQUEMENT à partir des champs déjà stockés sur la
// source — aucun contenu écrit en dur comme sur la page statique à 3 concurrents fixes — donc
// disponible pour n'importe quel concurrent, y compris ceux ajoutés après coup. `swotCell()`
// factorise les 4 cases Forces/Faiblesses/Opportunités/Menaces, identiques à la mise en forme
// près (texte libre affiché tel quel, sauts de ligne conservés, placeholder si vide).
function swotCell(kind, label, text) {
  const value = (text || "").trim();
  return `
    <div class="swot-cell swot-${kind}">
      <span class="swot-cell-label">${label}</span>
      <p>${value ? escapeHtml(value).replace(/\n/g, "<br>") : "<em>— à compléter —</em>"}</p>
    </div>
  `;
}

function competitorFicheHTML(source) {
  const links = [
    source.url ? `<a href="${escapeAttr(source.url)}" target="_blank" rel="noopener">Site</a>` : "",
    source.linkedinUrl ? `<a href="${escapeAttr(source.linkedinUrl)}" target="_blank" rel="noopener">LinkedIn</a>` : "",
    source.pappersUrl ? `<a href="${escapeAttr(source.pappersUrl)}" target="_blank" rel="noopener">Pappers</a>` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const summary = (source.profileSummary || "").trim();
  const agreoStrengths = (source.agreoStrengths || "").trim();
  return `
    <div class="fiche-visual">
      <div class="fiche-visual-head">
        ${source.ca ? `<span class="badge badge-new">CA : ${escapeHtml(source.ca)}</span>` : ""}
        ${links ? `<div class="item-meta">${links}</div>` : ""}
      </div>
      <div class="item-meta">
        ${
          typeof source.ficheUpdatedAt === "number"
            ? `Dernière mise à jour : ${new Date(source.ficheUpdatedAt).toLocaleString("fr-FR")}`
            : "Pas encore enregistrée — ceci est un aperçu du formulaire en cours de saisie."
        }
      </div>
      <p class="fiche-visual-summary">${summary ? escapeHtml(summary).replace(/\n/g, "<br>") : "<em>Résumé non renseigné — à compléter dans la fiche.</em>"}</p>
      <div class="swot-grid">
        ${swotCell("good", "Forces", source.competitorStrengths)}
        ${swotCell("bad", "Faiblesses", source.competitorWeaknesses)}
        ${swotCell("info", "Opportunités", source.opportunities)}
        ${swotCell("warn", "Menaces", source.threats)}
      </div>
      <div class="agreo-callout">
        <span class="agreo-callout-label">🎯 Force d'Agreo face à ce concurrent</span>
        <p>${agreoStrengths ? escapeHtml(agreoStrengths).replace(/\n/g, "<br>") : "<em>— à compléter —</em>"}</p>
        <div class="item-meta">Basé uniquement sur des informations publiques sur Agreo — à corriger avec ta propre connaissance du produit.</div>
      </div>
    </div>
  `;
}

function openCompetitorFicheModal(source) {
  const body = document.createElement("div");
  body.innerHTML = competitorFicheHTML(source);
  openModal({ title: `🪪 ${source.title || "Fiche concurrent"}`, body, actions: [{ label: "Fermer", variant: "ghost" }], wide: true });
}

// Carte de positionnement du Benchmark visuel (02/10/2026) — SVG dessiné à la main (pas de
// librairie de graphique : seul point de l'app qui en aurait l'usage, pas justifié d'en ajouter
// une pour ça seul, cohérent avec "pas de dépendance" de tout le reste du projet). Couleur des
// points et des axes puisée dans les jetons CSS existants (var(--color-...), styles/tokens.css)
// plutôt qu'une palette codée en dur : suit donc le thème clair/sombre de l'app automatiquement,
// sans media query ici. Un seul point par concurrent, étiquette TOUJOURS affichée (jamais
// sélective) et couleur UNIFORME (pas une teinte par concurrent) : le nombre de concurrents n'est
// pas borné (Charles-Henri peut en ajouter indéfiniment), donc l'identité repose sur le texte de
// l'étiquette plutôt que sur une palette catégorielle qui ne passerait plus au-delà de quelques
// entrées (voir la skill dataviz sur ce point). Les étiquettes alternent au-dessus/en-dessous du
// point selon la parité de l'index pour limiter les recouvrements les plus évidents — pas un vrai
// anti-collision, suffisant pour le nombre de concurrents attendu ici.
function renderPositionChartSVG(items) {
  const W = 560,
    H = 360,
    padL = 50,
    padR = 16,
    padT = 16,
    padB = 42;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const x = (v) => padL + (v / 10) * plotW;
  const y = (v) => padT + plotH - (v / 10) * plotH;
  const points = items
    .map((s, i) => {
      const px = x(s.specializationScore);
      const py = y(s.roadmapVisibilityScore);
      const labelY = i % 2 === 0 ? py - 14 : py + 22;
      return `
        <g>
          <circle cx="${px}" cy="${py}" r="7" fill="var(--color-primary)" stroke="var(--color-surface)" stroke-width="2"/>
          <text x="${px}" y="${labelY}" text-anchor="middle" font-size="12" font-weight="600" fill="var(--color-text)">${escapeHtml(s.title)}</text>
        </g>
      `;
    })
    .join("");
  return `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Carte de positionnement : spécialisation semences en abscisse, visibilité publique de la roadmap en ordonnée." style="width:100%;max-width:560px;height:auto;display:block;">
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H - padB}" stroke="var(--color-border)" />
      <line x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}" stroke="var(--color-border)" />
      <line x1="${padL + plotW / 2}" y1="${padT}" x2="${padL + plotW / 2}" y2="${H - padB}" stroke="var(--color-border)" stroke-dasharray="3 5"/>
      <line x1="${padL}" y1="${padT + plotH / 2}" x2="${W - padR}" y2="${padT + plotH / 2}" stroke="var(--color-border)" stroke-dasharray="3 5"/>
      <text x="${padL + plotW / 2}" y="${H - 8}" text-anchor="middle" font-size="10" fill="var(--color-text-muted)" letter-spacing="0.03em">GÉNÉRALISTE ← SPÉCIALISATION SEMENCES → SPÉCIALISTE</text>
      <text x="12" y="${padT + plotH / 2}" text-anchor="middle" font-size="10" fill="var(--color-text-muted)" letter-spacing="0.03em" transform="rotate(-90 12 ${padT + plotH / 2})">OPAQUE ← VISIBILITÉ ROADMAP → PUBLIQUE</text>
      ${points}
    </svg>
  `;
}

// Modale "demande à coller à Claude" (02/10/2026, veille concurrentielle enrichie — voir le
// commentaire d'en-tête de js/domain/veille.js#competitorResearchPrompt pour le pourquoi).
// Partagée par les deux usages (mise à jour d'une fiche existante, découverte de nouveaux
// concurrents) plutôt que dupliquée : les deux ne font que générer un texte différent, l'affichage
// est identique. Le texte est à la fois copiable automatiquement (bouton "📋 Copier") ET affiché/
// sélectionné dans un textarea, pour rester utilisable même si `navigator.clipboard` échoue
// (contexte non sécurisé, permission refusée...) plutôt que de dépendre uniquement de l'API.
function openPromptModal(title, text) {
  const body = document.createElement("div");
  body.innerHTML = `
    <p class="item-meta" style="margin-top:0;">
      Colle ce texte dans une conversation avec Claude (où qu'elle soit) — Pilotage ne peut pas
      interroger LinkedIn ou Pappers tout seul, voir la note à côté du bouton qui a ouvert cette
      fenêtre.
    </p>
    <textarea id="veille-prompt-text" readonly rows="10" style="width:100%;font-family:inherit;">${escapeHtml(text)}</textarea>
  `;
  const textarea = body.querySelector("#veille-prompt-text");
  openModal({
    title,
    body,
    actions: [
      { label: "Fermer", variant: "ghost" },
      {
        label: "📋 Copier",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          textarea.select();
          try {
            await navigator.clipboard.writeText(text);
            showToast("Copié — colle-le dans une conversation avec Claude");
          } catch {
            showToast("Copie automatique indisponible — le texte est sélectionné, copie-le avec Ctrl+C (ou Cmd+C)");
          }
        },
      },
    ],
  });
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
      // Boutons "🔎 Chercher de nouveaux concurrents" / "📊 Benchmark" réservés à la catégorie
      // concurrence (02/10/2026, demande directe de Charles-Henri) — pas de sens pour
      // réglementation/management, donc pas affichés là pour ne pas surcharger ces sections sans
      // raison. "Benchmark" seulement s'il existe au moins un concurrent à comparer.
      if (cat.key === "concurrence") {
        title.style.display = "flex";
        title.style.justifyContent = "space-between";
        title.style.alignItems = "center";
        title.style.gap = "8px";
        title.style.flexWrap = "wrap";
        title.innerHTML = `
          <span>${cat.emoji} ${cat.label}${items.length ? ` (${items.length})` : ""}</span>
          <span style="display:flex;gap:6px;flex-wrap:wrap;">
            <button type="button" id="veille-competitor-discover-btn" class="btn btn-ghost btn-sm">🔎 Chercher de nouveaux concurrents</button>
            ${items.length ? `<button type="button" id="veille-competitor-benchmark-btn" class="btn btn-ghost btn-sm">📊 Benchmark visuel</button>` : ""}
          </span>
        `;
      } else {
        title.textContent = `${cat.emoji} ${cat.label}${items.length ? ` (${items.length})` : ""}`;
      }
      sectionsEl.appendChild(title);
      if (cat.key === "concurrence") {
        title.querySelector("#veille-competitor-discover-btn").addEventListener("click", () => openDiscoverModal());
        title.querySelector("#veille-competitor-benchmark-btn")?.addEventListener("click", () => openBenchmarkModal(items));
      }

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
          ${
            cat.key === "concurrence"
              ? `<button type="button" class="btn btn-ghost btn-sm veille-fiche-btn" aria-label="Voir la fiche visuelle" title="Voir la fiche visuelle">🪪</button>`
              : ""
          }
          <button type="button" class="btn btn-ghost btn-sm veille-edit-btn" aria-label="Modifier" title="Modifier">✏️</button>
        `;
        // Le badge "🆕" s'efface dès qu'on suit le lien — même principe que la pastille "Nouveau"
        // de ☰ Plus (js/views/more.js) sur Nouveautés : "vu" se déclenche en allant réellement
        // regarder, pas en ouvrant juste la fiche d'édition.
        if (isNew) {
          row.querySelector("a")?.addEventListener("click", () => veilleApi.acknowledgeSource(source.id));
        }
        // "🪪 Voir la fiche visuelle" directement depuis la liste (02/10/2026, retour direct de
        // Charles-Henri : "la fiche doit être consultable dans la partie veille" — jusque-là
        // accessible uniquement depuis l'intérieur de la fiche d'édition ✏️, un détour inutile
        // pour une simple consultation). Ouvre la source RÉELLEMENT enregistrée (pas un brouillon
        // de formulaire comme le bouton équivalent à l'intérieur de la fiche d'édition).
        row.querySelector(".veille-fiche-btn")?.addEventListener("click", () => openCompetitorFicheModal(source));
        row.querySelector(".veille-edit-btn").addEventListener("click", () => openSourceModal(source));
        list.appendChild(row);
      }
      sectionsEl.appendChild(list);
    }
  }

  // Découverte de nouveaux concurrents par mot-clé (02/10/2026, demande directe de Charles-Henri :
  // "je veux pouvoir en rechercher d'autres si besoin par rapport à des mots clé"). Même principe
  // que la mise à jour d'une fiche : Pilotage prépare la demande, Charles-Henri la colle à Claude,
  // et ajoute lui-même les candidats retenus via "+ Source" une fois la recherche faite — jamais
  // d'ajout automatique à sa liste.
  function openDiscoverModal() {
    const body = document.createElement("div");
    body.innerHTML = `
      <div class="field">
        <label for="veille-discover-keywords">Mots-clés (marché, technologie, nom de concurrent déjà connu...)</label>
        <input id="veille-discover-keywords" type="text" placeholder="Ex. ERP station semences France" />
      </div>
    `;
    const { bodyEl, close } = openModal({
      title: "🔎 Chercher de nouveaux concurrents",
      body,
      actions: [
        { label: "Annuler", variant: "ghost" },
        {
          label: "📋 Générer la demande",
          variant: "primary",
          closesModal: false,
          onClick: () => {
            const keywords = bodyEl.querySelector("#veille-discover-keywords").value.trim();
            if (!keywords) {
              showToast("Indique au moins un mot-clé");
              return;
            }
            close();
            openPromptModal("🔎 Demande à coller à Claude", veilleApi.competitorDiscoveryPrompt(keywords));
          },
        },
      ],
    });
  }

  // Benchmark concurrents (02/10/2026, demande directe de Charles-Henri : "que ça me fasse un
  // benchmark et une étude de concurrence [...] pour l'ensemble") — vue comparative construite
  // uniquement à partir des fiches déjà enregistrées (aucune recherche déclenchée ici), toujours
  // à jour avec leur contenu plutôt qu'un document séparé à régénérer. `.pilotage-table` réutilisé
  // tel quel (styles/components.css) — même langage visuel que la vue Tableau du Kanban plutôt
  // qu'un nouveau composant pour ce seul usage.
  function openBenchmarkModal(items) {
    const sorted = items.slice().sort((a, b) => a.title.localeCompare(b.title, "fr"));
    const positioned = sorted.filter(veilleApi.hasPositioning);
    const unpositioned = sorted.filter((s) => !veilleApi.hasPositioning(s));

    const rows = sorted
      .map((s, i) => {
        const links =
          [
            s.url ? `<a href="${escapeAttr(s.url)}" target="_blank" rel="noopener">Site</a>` : "",
            s.linkedinUrl ? `<a href="${escapeAttr(s.linkedinUrl)}" target="_blank" rel="noopener">LinkedIn</a>` : "",
            s.pappersUrl ? `<a href="${escapeAttr(s.pappersUrl)}" target="_blank" rel="noopener">Pappers</a>` : "",
          ]
            .filter(Boolean)
            .join(" · ") || "—";
        const notesPreview = s.notes ? escapeHtml(s.notes.length > 140 ? `${s.notes.slice(0, 140)}…` : s.notes) : "—";
        const profilePreview = s.profileSummary
          ? escapeHtml(s.profileSummary.length > 140 ? `${s.profileSummary.slice(0, 140)}…` : s.profileSummary)
          : "—";
        return `
          <tr>
            <td>${escapeHtml(s.title)}${veilleApi.hasNewContent(s) ? ` <span class="badge badge-new">🆕</span>` : ""}</td>
            <td>${s.ca ? escapeHtml(s.ca) : "—"}</td>
            <td>${profilePreview}</td>
            <td>${notesPreview}</td>
            <td>${links}</td>
            <td><button type="button" class="btn btn-ghost btn-sm" data-benchmark-fiche-idx="${i}">🪪 Fiche</button></td>
          </tr>
        `;
      })
      .join("");

    const chartSection = positioned.length
      ? `
        <div class="position-chart-wrap">
          ${renderPositionChartSVG(positioned)}
          ${
            unpositioned.length
              ? `<p class="item-meta">Non positionnés (curseurs jamais réglés) : ${unpositioned.map((s) => escapeHtml(s.title)).join(", ")} — ouvre leur fiche (✏️) pour les régler.</p>`
              : ""
          }
        </div>
      `
      : `
        <div class="empty-state">
          <span class="emoji">📍</span>
          Aucun concurrent positionné pour l'instant. Ouvre la fiche d'un concurrent (✏️), dérouler "🎯 Fiche
          comparative face à Agreo" et régler les 2 curseurs en bas (Spécialisation, Visibilité de leur
          roadmap) pour qu'il apparaisse ici.
        </div>
      `;

    const body = document.createElement("div");
    body.innerHTML = `
      <p class="item-meta" style="margin-top:0;">
        Construit à partir des fiches déjà enregistrées. Pour le mettre à jour : édite chaque fiche (✏️) ou
        utilise "📋 Générer la demande de recherche" depuis sa fiche, puis colle le résultat dans ses champs.
        Le détail complet (SWOT, face à Agreo) est dans la fiche visuelle de chaque concurrent ("🪪 Fiche" sur
        sa ligne ci-dessous) — ce tableau n'en montre qu'un résumé court pour comparer d'un coup d'œil.
      </p>
      ${chartSection}
      <div class="pilotage-table-wrap">
        <table class="pilotage-table">
          <thead>
            <tr>
              <th>Concurrent</th>
              <th>CA</th>
              <th>Positionnement</th>
              <th>Dernière note / évolution</th>
              <th>Liens</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    body.querySelectorAll("[data-benchmark-fiche-idx]").forEach((btn) => {
      btn.addEventListener("click", () => openCompetitorFicheModal(sorted[Number(btn.dataset.benchmarkFicheIdx)]));
    });
    openModal({ title: "📊 Benchmark visuel concurrents", body, actions: [{ label: "Fermer", variant: "ghost" }], wide: true });
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
      <div id="veille-competitor-fields" style="display:none;">
        <div class="field">
          <label for="veille-ca">Chiffre d'affaires (CA)</label>
          <input id="veille-ca" type="text" placeholder="Ex. ~15M€ (2024, source Pappers)" value="${escapeAttr(existing?.ca || "")}" />
        </div>
        <div class="field">
          <label for="veille-linkedin">LinkedIn (optionnel)</label>
          <input id="veille-linkedin" type="url" placeholder="https://www.linkedin.com/company/..." value="${escapeAttr(existing?.linkedinUrl || "")}" />
        </div>
        <div class="field">
          <label for="veille-pappers">Pappers (optionnel)</label>
          <input id="veille-pappers" type="url" placeholder="https://www.pappers.fr/entreprise/..." value="${escapeAttr(existing?.pappersUrl || "")}" />
        </div>
        <button type="button" id="veille-competitor-prompt-btn" class="btn btn-secondary btn-sm">📋 Générer la demande de recherche (CA, fiche, actus...)</button>
        <div class="item-meta">
          Pilotage ne peut pas interroger LinkedIn ou Pappers tout seul (pas de compte, pas de clé API) — ce bouton
          prépare le texte à coller dans une conversation avec Claude, qui fait la recherche (y compris les
          champs de la fiche "face à Agreo" ci-dessous) ; reporte ensuite son résultat dans les champs
          correspondants.
        </div>
        <div class="ai-import-box">
          <div class="ai-import-title">🤖 Recherche assistée par IA — remplissage en un clic</div>
          <div class="item-meta">
            1) "Copier la demande et ouvrir Perplexity", colle-la et lance la recherche · 2) copie toute la
            réponse (le bloc JSON) · 3) colle-la ci-dessous et clique "Remplir la fiche". Rien n'est
            enregistré tant que tu ne cliques pas "Enregistrer" ("Annuler" remet tout comme avant).
          </div>
          <button type="button" id="veille-ai-open-btn" class="btn btn-secondary btn-sm">🔎 Copier la demande et ouvrir Perplexity</button>
          <div class="field" style="margin-top:var(--space-2);">
            <label for="veille-ai-response">Réponse de l'IA</label>
            <textarea id="veille-ai-response" rows="4" placeholder="Colle ici la réponse complète (le bloc JSON)…"></textarea>
          </div>
          <button type="button" id="veille-ai-import-btn" class="btn btn-primary btn-sm">📥 Remplir la fiche avec cette réponse</button>
          <div id="veille-ai-import-result" class="item-meta" role="status" aria-live="polite"></div>
        </div>
        <details id="veille-competitor-details">
          <summary>🎯 Fiche comparative face à Agreo (SWOT)</summary>
          <div class="field">
            <label for="veille-profile">Résumé (qui ils sont, positionnement, marché)</label>
            <textarea id="veille-profile" placeholder="Ex. Suite logicielle spécialisée semences, SaaS, positionnement...">${escapeHtml(existing?.profileSummary || "")}</textarea>
          </div>
          <div class="field">
            <label for="veille-their-strengths">Forces</label>
            <textarea id="veille-their-strengths" placeholder="Ce qu'ils font mieux ou différemment">${escapeHtml(existing?.competitorStrengths || "")}</textarea>
          </div>
          <div class="field">
            <label for="veille-their-weaknesses">Faiblesses</label>
            <textarea id="veille-their-weaknesses" placeholder="Limites, angles morts, retours clients négatifs trouvés">${escapeHtml(existing?.competitorWeaknesses || "")}</textarea>
          </div>
          <div class="field">
            <label for="veille-opportunities">Opportunités</label>
            <textarea id="veille-opportunities" placeholder="Ce qui pourrait les faire progresser sur leur marché">${escapeHtml(existing?.opportunities || "")}</textarea>
          </div>
          <div class="field">
            <label for="veille-threats">Menaces</label>
            <textarea id="veille-threats" placeholder="Ce qui pourrait les freiner ou les fragiliser (hors de leur contrôle)">${escapeHtml(existing?.threats || "")}</textarea>
          </div>
          <div class="field">
            <label for="veille-agreo-strengths">Force d'Agreo face à eux</label>
            <textarea id="veille-agreo-strengths" placeholder="Ce qu'Agreo fait mieux face à ce concurrent précis">${escapeHtml(existing?.agreoStrengths || "")}</textarea>
          </div>
          <div class="item-meta">
            Le champ "Force d'Agreo" est une analyse basée uniquement sur des informations publiques (sites,
            avis en ligne) — à corriger ou compléter avec ta propre connaissance du produit, des retours
            clients et de la roadmap réelle, que Pilotage n'a aucun moyen de connaître de lui-même.
          </div>
          <div class="field">
            <label for="veille-specialization">Spécialisation — <span id="veille-specialization-value">${specializationValue(existing)}</span>/10</label>
            <input id="veille-specialization" type="range" min="0" max="10" step="1" value="${specializationValue(existing)}" style="width:100%;" />
            <div class="item-meta">0 = généraliste, 10 = spécialiste pur de la production de semences. Réglé à la main — alimente la carte de positionnement du Benchmark visuel.</div>
          </div>
          <div class="field">
            <label for="veille-roadmap-visibility">Visibilité de leur roadmap — <span id="veille-roadmap-visibility-value">${roadmapVisibilityValue(existing)}</span>/10</label>
            <input id="veille-roadmap-visibility" type="range" min="0" max="10" step="1" value="${roadmapVisibilityValue(existing)}" style="width:100%;" />
            <div class="item-meta">0 = aucune visibilité publique sur leurs évolutions, 10 = feuille de route et retours clients entièrement publics.</div>
          </div>
          <button type="button" id="veille-competitor-fiche-btn" class="btn btn-secondary btn-sm">🪪 Voir la fiche visuelle</button>
        </details>
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

    // Champs concurrent (CA, LinkedIn, Pappers) masqués tant que la catégorie choisie n'est pas
    // "concurrence" (02/10/2026) — inutiles ailleurs, et les afficher partout aurait embrouillé la
    // fiche d'une source réglementation/management. Valeurs déjà saisies jamais effacées par un
    // changement de catégorie : seul l'AFFICHAGE change, pas ce qui est enregistré.
    const categorySelect = body.querySelector("#veille-category");
    const competitorFieldsEl = body.querySelector("#veille-competitor-fields");
    function syncCompetitorFieldsVisibility() {
      competitorFieldsEl.style.display = categorySelect.value === "concurrence" ? "" : "none";
    }
    syncCompetitorFieldsVisibility();
    categorySelect.addEventListener("change", syncCompetitorFieldsVisibility);

    const competitorPromptBtn = body.querySelector("#veille-competitor-prompt-btn");
    competitorPromptBtn.addEventListener("click", () => {
      openPromptModal(
        "📋 Demande à coller à Claude",
        veilleApi.competitorResearchPrompt({
          title: body.querySelector("#veille-title").value.trim(),
          url: body.querySelector("#veille-url").value.trim(),
          linkedinUrl: body.querySelector("#veille-linkedin").value.trim(),
          pappersUrl: body.querySelector("#veille-pappers").value.trim(),
        })
      );
    });

    // Recherche assistée par IA (06/10/2026, option "A. Import en 1 clic" — retour de Charles-Henri :
    // "la recherche sur les concurrents devrait pouvoir se faire beaucoup plus facilement et de manière
    // automatisée via les IA"). Tout se passe DANS ce formulaire, sans ouvrir de nouvelle modale
    // (openModal() n'en garde qu'une à la fois : en ouvrir une ici aurait fait disparaître le
    // formulaire et tout ce qui y est déjà saisi pendant l'aller-retour vers l'IA).
    // Pilotage reste 100 % client, sans clé API ni serveur : il prépare la demande et lit la réponse,
    // c'est Charles-Henri qui fait tourner l'IA (Perplexity). Voir js/domain/veilleResearchImport.js.
    const aiOpenBtn = body.querySelector("#veille-ai-open-btn");
    aiOpenBtn.addEventListener("click", async () => {
      const title = body.querySelector("#veille-title").value.trim();
      if (!title) {
        showToast("Renseigne d'abord le titre (le nom du concurrent)");
        body.querySelector("#veille-title").focus();
        return;
      }
      const prompt = veilleApi.competitorResearchPrompt({
        title,
        url: body.querySelector("#veille-url").value.trim(),
        linkedinUrl: body.querySelector("#veille-linkedin").value.trim(),
        pappersUrl: body.querySelector("#veille-pappers").value.trim(),
      });
      // Ouverture de l'onglet AVANT tout `await` : après une opération asynchrone, certains
      // navigateurs (Safari en tête) ne considèrent plus le clic comme un geste utilisateur et
      // bloquent la fenêtre. Page d'accueil de Perplexity plutôt qu'un lien "?q=<demande>" : cette
      // demande est longue (modèle JSON inclus) et une adresse trop longue peut être tronquée en
      // silence, ce qui lancerait une recherche avec une demande amputée de son format de réponse.
      window.open("https://www.perplexity.ai/", "_blank", "noopener");
      try {
        await navigator.clipboard.writeText(prompt);
        showToast("Demande copiée — colle-la dans Perplexity (Ctrl+V ou Cmd+V)");
      } catch {
        showToast("Copie automatique indisponible — utilise \"📋 Générer la demande\" pour la copier à la main");
      }
    });

    // Champs du formulaire alimentés par l'import. `IMPORT_FILL_IF_EMPTY` = liens : jamais écrasés s'ils
    // sont déjà renseignés (une URL saisie par Charles-Henri vaut mieux qu'une URL retrouvée par une IA).
    const IMPORT_TARGETS = [
      ["ca", "#veille-ca", "CA"],
      ["notes", "#veille-notes", "Note"],
      ["profileSummary", "#veille-profile", "Résumé"],
      ["competitorStrengths", "#veille-their-strengths", "Forces"],
      ["competitorWeaknesses", "#veille-their-weaknesses", "Faiblesses"],
      ["opportunities", "#veille-opportunities", "Opportunités"],
      ["threats", "#veille-threats", "Menaces"],
      ["agreoStrengths", "#veille-agreo-strengths", "Force d'Agreo"],
    ];
    const IMPORT_FILL_IF_EMPTY = [
      ["url", "#veille-url", "Site"],
      ["linkedinUrl", "#veille-linkedin", "LinkedIn"],
      ["pappersUrl", "#veille-pappers", "Pappers"],
    ];
    function markImported(el) {
      el.classList.add("field-imported");
      el.addEventListener("input", () => el.classList.remove("field-imported"), { once: true });
    }
    const aiImportBtn = body.querySelector("#veille-ai-import-btn");
    const aiResultEl = body.querySelector("#veille-ai-import-result");
    aiResultEl.style.whiteSpace = "pre-line";
    aiImportBtn.addEventListener("click", () => {
      const result = parseCompetitorResearchResponse(body.querySelector("#veille-ai-response").value);
      if (!result.ok) {
        aiResultEl.textContent = `⚠️ ${result.error}`;
        return;
      }
      const { fields } = result;
      const replaced = [];
      const kept = [];
      const skipped = []; // liens déjà saisis, non touchés (identiques ou non) : retirés du "Fiche remplie"
      for (const [key, selector, label] of IMPORT_TARGETS) {
        if (!(key in fields)) continue;
        const el = body.querySelector(selector);
        const previous = el.value.trim();
        if (previous && previous !== fields[key]) replaced.push(label);
        el.value = fields[key];
        markImported(el);
      }
      for (const [key, selector, label] of IMPORT_FILL_IF_EMPTY) {
        if (!(key in fields)) continue;
        const el = body.querySelector(selector);
        if (el.value.trim()) {
          skipped.push(label);
          if (el.value.trim() !== fields[key]) kept.push(label);
          continue;
        }
        el.value = fields[key];
        markImported(el);
      }
      // Curseurs : on déclenche "input" pour que la valeur affichée à côté du libellé suive.
      for (const [key, selector] of [
        ["specializationScore", "#veille-specialization"],
        ["roadmapVisibilityScore", "#veille-roadmap-visibility"],
      ]) {
        if (!(key in fields)) continue;
        const el = body.querySelector(selector);
        el.value = String(fields[key]);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        markImported(el);
      }
      body.querySelector("#veille-competitor-details").open = true;
      const lines = [`✅ Fiche remplie : ${result.filled.filter((l) => !skipped.includes(l)).join(", ")}.`];
      if (replaced.length) lines.push(`↻ Remplacé (valeur précédente écrasée) : ${replaced.join(", ")}.`);
      if (kept.length) lines.push(`Liens déjà saisis conservés : ${kept.join(", ")}.`);
      if (result.missing.length) lines.push(`Non trouvé par l'IA : ${result.missing.join(", ")}.`);
      lines.push("Relis les champs surlignés (\"🪪 Voir la fiche visuelle\" pour l'aperçu), corrige, puis clique \"Enregistrer\". Les 2 curseurs et la Force d'Agreo sont des propositions de l'IA, à ajuster avec ta propre connaissance.");
      aiResultEl.textContent = lines.join("\n");
    });

    // Curseurs de positionnement (02/10/2026, Benchmark visuel) : valeur affichée à côté du
    // libellé mise à jour en direct, même principe que js/views/priorisation.js#openWeightsModal
    // (seul autre endroit de l'app avec un <input type="range">) — repris pour cohérence plutôt
    // que réinventé.
    const specializationInput = body.querySelector("#veille-specialization");
    const specializationValueEl = body.querySelector("#veille-specialization-value");
    specializationInput.addEventListener("input", () => {
      specializationValueEl.textContent = specializationInput.value;
    });
    const roadmapVisibilityInput = body.querySelector("#veille-roadmap-visibility");
    const roadmapVisibilityValueEl = body.querySelector("#veille-roadmap-visibility-value");
    roadmapVisibilityInput.addEventListener("input", () => {
      roadmapVisibilityValueEl.textContent = roadmapVisibilityInput.value;
    });

    // "Voir la fiche visuelle" (02/10/2026) : construit à partir des champs du FORMULAIRE en
    // cours de saisie, pas de la source déjà enregistrée — même principe que le bouton
    // "📋 Générer la demande" ci-dessus, pour prévisualiser avant même d'avoir cliqué "Enregistrer".
    const competitorFicheBtn = body.querySelector("#veille-competitor-fiche-btn");
    competitorFicheBtn.addEventListener("click", () => {
      openCompetitorFicheModal({
        title: body.querySelector("#veille-title").value.trim(),
        url: body.querySelector("#veille-url").value.trim(),
        ca: body.querySelector("#veille-ca").value.trim(),
        linkedinUrl: body.querySelector("#veille-linkedin").value.trim(),
        pappersUrl: body.querySelector("#veille-pappers").value.trim(),
        profileSummary: body.querySelector("#veille-profile").value.trim(),
        competitorStrengths: body.querySelector("#veille-their-strengths").value.trim(),
        competitorWeaknesses: body.querySelector("#veille-their-weaknesses").value.trim(),
        opportunities: body.querySelector("#veille-opportunities").value.trim(),
        threats: body.querySelector("#veille-threats").value.trim(),
        agreoStrengths: body.querySelector("#veille-agreo-strengths").value.trim(),
      });
    });

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
            ca: bodyEl.querySelector("#veille-ca").value.trim(),
            linkedinUrl: bodyEl.querySelector("#veille-linkedin").value.trim(),
            pappersUrl: bodyEl.querySelector("#veille-pappers").value.trim(),
            profileSummary: bodyEl.querySelector("#veille-profile").value.trim(),
            competitorStrengths: bodyEl.querySelector("#veille-their-strengths").value.trim(),
            competitorWeaknesses: bodyEl.querySelector("#veille-their-weaknesses").value.trim(),
            opportunities: bodyEl.querySelector("#veille-opportunities").value.trim(),
            threats: bodyEl.querySelector("#veille-threats").value.trim(),
            agreoStrengths: bodyEl.querySelector("#veille-agreo-strengths").value.trim(),
            specializationScore: Number(bodyEl.querySelector("#veille-specialization").value),
            roadmapVisibilityScore: Number(bodyEl.querySelector("#veille-roadmap-visibility").value),
            // Horodatage DÉDIÉ à la fiche (02/10/2026, retour direct de Charles-Henri : "il faut
            // une date de dernière mise à jour") — PAS le `updatedAt` générique de
            // js/services/storage.js#setFields, qui est aussi touché par un simple "🔍 Vérifier"
            // ou un clic sur le lien pour effacer le badge "🆕" (voir acknowledgeSource) : avec le
            // générique, la fiche aurait affiché "mise à jour il y a 2 minutes" après une action
            // qui n'a rien changé à son contenu. `ficheUpdatedAt` n'avance que quand ce formulaire
            // est réellement enregistré.
            ficheUpdatedAt: Date.now(),
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
