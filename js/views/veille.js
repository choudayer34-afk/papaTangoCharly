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

// 🔔 Procédure Google Alerts de remplacement (06/10/2026, retour de Charles-Henri après le cas Terre-net :
// "si c'est le cas, donne la procédure via Google Alerts dans une popup"). Proposée quand la zone lue d'une
// source est trop courte pour contenir des actualités (voir `veilleApi.SHORT_ZONE_CHARS`) : la page se remplit
// par JavaScript, que Pilotage ne voit pas. Une alerte `site:` ne dépend pas de la page. Pilotage ne touche à
// aucun compte Google : il prépare la requête et explique les réglages, Charles-Henri crée l'alerte lui-même.
function buildAlertProcedure(source, { inForm = false } = {}) {
  const wrap = document.createElement("div");
  const alert = veilleApi.googleAlertForSource(source);
  if (!alert) {
    wrap.innerHTML = `<p class="item-meta">Cette source n'a pas d'adresse exploitable : renseigne son lien dans sa fiche (champ « Lien »), puis recommence.</p>`;
    return wrap;
  }
  wrap.innerHTML = `
    <ol class="alert-steps">
      <li>
        <strong>Copie la requête</strong> (tu peux la modifier avant) :
        <div class="alert-query-row">
          <div class="alert-query-main"><input type="text" class="alert-proc-query" value="${escapeAttr(alert.query)}" aria-label="Requête Google Alerts" /></div>
          <button type="button" class="btn btn-ghost btn-sm alert-proc-copy" aria-label="Copier la requête" title="Copier">📋</button>
        </div>
      </li>
      <li><strong>Ouvre Google Alerts</strong> : <a href="https://www.google.com/alerts" target="_blank" rel="noopener noreferrer">google.com/alerts ↗</a> (connecté à ton compte Google), puis colle la requête dans le champ « Créer une alerte sur… ».</li>
      <li><strong>Clique sur « Afficher les options »</strong> et règle :
        <ul class="alert-steps-settings">${veilleApi.GOOGLE_ALERT_SITE_SETTINGS.map(
          (o) => `<li><em>${escapeHtml(o.label)}</em> : ${escapeHtml(o.value)}</li>`
        ).join("")}</ul>
      </li>
      <li><strong>Clique sur « Créer une alerte ».</strong> Un aperçu des résultats s'affiche : s'il est vide ou hors sujet, ajuste la requête.</li>
      <li><strong>Dans Pilotage</strong>, ${
        inForm
          ? "dans la section « 🔍 Détection de nouveautés » de cette fiche, décoche « Activer la détection sur ce site » puis clique sur « Enregistrer »"
          : "ouvre la fiche de cette source (✏️ → « 🔍 Détection de nouveautés ») et décoche « Activer la détection sur ce site »"
      } : elle ne voit rien ici, autant ne pas s'y fier. Les alertes arriveront dans ta boîte mail.</li>
    </ol>
    <p class="item-meta" style="margin-bottom:0;">Les libellés de Google peuvent légèrement varier selon la langue de ton compte.</p>
  `;
  wrap.querySelector(".alert-proc-copy").addEventListener("click", async () => {
    const value = wrap.querySelector(".alert-proc-query").value;
    try {
      await navigator.clipboard.writeText(value);
      showToast("Requête copiée");
    } catch {
      wrap.querySelector(".alert-proc-query").select();
      showToast("Copie automatique indisponible — la requête est sélectionnée, copie-la (Ctrl+C / Cmd+C)");
    }
  });
  return wrap;
}

function openAlertProcedureModal(source) {
  const body = document.createElement("div");
  const intro = document.createElement("p");
  intro.className = "item-meta";
  intro.style.marginTop = "0";
  intro.textContent =
    "Pilotage ne voit pas les actualités de cette page : elles sont ajoutées par JavaScript après le chargement, et il ne lit que le code source de départ. Une alerte Google ne dépend pas de la page — Google te prévient dès qu'il repère une nouvelle page de ce site.";
  body.append(intro, buildAlertProcedure(source));
  openModal({
    title: `🔔 Surveiller « ${source.title} » via Google Alerts`,
    body,
    actions: [
      { label: "Fermer", variant: "ghost" },
      {
        label: "Ouvrir Google Alerts ↗",
        variant: "primary",
        closesModal: false,
        onClick: () => window.open("https://www.google.com/alerts", "_blank", "noopener,noreferrer"),
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
      <div id="veille-check-progress"></div>
      <div id="veille-quick-access"></div>
      <div id="veille-starter-prompt"></div>
      <div id="veille-sections"></div>
    </div>
  `;

  const newBtn = container.querySelector("#veille-new-btn");
  const checkBtn = container.querySelector("#veille-check-btn");
  const starterEl = container.querySelector("#veille-starter-prompt");
  const quickAccessEl = container.querySelector("#veille-quick-access");
  const checkProgressEl = container.querySelector("#veille-check-progress");
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
      // Panneau de progression (06/10/2026, retour de Charles-Henri : "quand je clique sur vérifier, je
      // sais pas trop ce qu'il se passe, y'a moyen de voir ce qu'il fait, où il en est par point et la
      // progression ?") : une ligne par source avec son état en direct + une barre globale. Les
      // vérifications restent séquentielles (voir plus haut) — c'est ce qui rend la progression lisible.
      const rows = watched.map((source) => ({ source, status: "pending", text: "En attente" }));
      let finished = false;
      const doneCount = () => rows.filter((r) => r.status !== "pending" && r.status !== "running").length;
      const renderProgress = () => {
        const done = doneCount();
        const pct = Math.round((done / rows.length) * 100);
        const ICONS = { pending: "⏳", running: "🔄", unchanged: "✅", first: "📌", changed: "🆕", failed: "⚠️", short: "⚠️" };
        const changed = rows.filter((r) => r.status === "changed").length;
        const failed = rows.filter((r) => r.status === "failed").length;
        const shortCount = rows.filter((r) => r.status === "short").length;
        checkProgressEl.innerHTML = `
          <div class="card veille-check-panel" role="status" aria-live="polite">
            <div class="veille-quick-head">
              <div class="item-title">🔍 Vérification des sources — ${done} / ${rows.length}</div>
              ${finished ? `<button type="button" class="btn btn-ghost btn-sm veille-check-close" aria-label="Fermer le détail de la vérification">Fermer</button>` : ""}
            </div>
            <div class="veille-check-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${rows.length}" aria-valuenow="${done}">
              <div class="veille-check-bar-fill" style="width:${pct}%"></div>
            </div>
            <ul class="veille-check-list">
              ${rows
                .map(
                  (r) => `<li class="veille-check-row veille-check-row--${r.status}">
                    <span class="veille-check-icon" aria-hidden="true">${ICONS[r.status]}</span>
                    <span class="veille-check-main"><strong>${escapeHtml(r.source.title)}</strong><span class="item-meta">${escapeHtml(r.text)}</span>${
                    r.status === "failed" && /^https?:\/\//i.test(r.source.watchUrl || r.source.url || "")
                      ? `<a class="item-meta" href="${escapeAttr(r.source.watchUrl || r.source.url)}" target="_blank" rel="noopener noreferrer">Ouvrir la page ↗</a>`
                      : ""
                  }${
                    r.status === "short"
                      ? `<button type="button" class="btn btn-secondary btn-sm veille-check-alert-btn" data-row-idx="${rows.indexOf(r)}">🔔 Procédure Google Alerts</button>`
                      : ""
                  }</span>
                  </li>`
                )
                .join("")}
            </ul>
            ${
              finished
                ? `<div class="item-meta" style="margin-top:8px;">Terminé : ${rows.length} vérifiée${rows.length > 1 ? "s" : ""}${
                    changed ? ` · ${changed} nouveauté${changed > 1 ? "s" : ""}` : " · aucune nouveauté"
                  }${failed ? ` · ${failed} échec${failed > 1 ? "s" : ""}` : ""}${
                    shortCount ? ` · ${shortCount} source${shortCount > 1 ? "s" : ""} illisible${shortCount > 1 ? "s" : ""} (zone trop courte)` : ""
                  }.</div>${
                    failed === rows.length && rows.length > 1
                      ? `<div class="item-meta" style="margin-top:6px;">Toutes les sources ont échoué en même temps : c'est presque toujours le service de relais (proxy) qui est indisponible, pas les sites eux-mêmes. Réessaie un peu plus tard ; « Ouvrir la page » permet de consulter une source à la main en attendant.</div>`
                      : ""
                  }`
                : ""
            }
          </div>`;
        checkProgressEl.querySelectorAll(".veille-check-alert-btn").forEach((btn) => {
          btn.addEventListener("click", () => openAlertProcedureModal(rows[Number(btn.dataset.rowIdx)].source));
        });
        checkProgressEl.querySelector(".veille-check-close")?.addEventListener("click", () => {
          checkProgressEl.innerHTML = "";
        });
        // Garde la ligne en cours visible dans la liste si elle déborde (nombreuses sources).
        checkProgressEl.querySelector(".veille-check-row--running")?.scrollIntoView?.({ block: "nearest" });
      };
      renderProgress();
      checkBtn.textContent = `🔍 Vérification 0/${rows.length}…`;
      for (const row of rows) {
        row.status = "running";
        row.text = "Récupération de la page…";
        renderProgress();
        const result = await veilleApi.checkSourceForChanges(row.source, {
          onProgress: (p) => {
            row.text =
              p.step === "analyse"
                ? "Analyse de la page…"
                : p.total > 1
                ? `Récupération de la page… (essai ${p.attempt}/${p.total} — ${p.proxy})`
                : "Récupération de la page…";
            renderProgress();
          },
        });
        if (!result.ok) {
          row.status = "failed";
          row.text = `${veilleApi.WATCH_ERROR_LABELS[result.error] || result.error}${result.detail ? ` (${result.detail})` : ""}`;
        } else if (result.short) {
          // Prioritaire sur "nouveauté"/"rien de nouveau"/"première vérification" : une zone de quelques
          // mots (message d'attente) n'est pas une liste d'actualités, aucun de ces verdicts n'aurait de sens.
          row.status = "short";
          row.text = `Zone lue très courte (${result.text.length} caractères : « ${result.preview} ») — le contenu est probablement chargé par JavaScript et invisible pour Pilotage : aucune nouveauté ne pourra être détectée ici.`;
        } else if (result.changed) {
          row.status = "changed";
          row.text = "Nouveauté détectée — la page a changé depuis la dernière vérification";
        } else if (result.firstCheck) {
          row.status = "first";
          row.text = "Première vérification : référence enregistrée (les prochaines détecteront les changements)";
        } else {
          row.status = "unchanged";
          row.text = "Rien de nouveau depuis la dernière vérification";
        }
        checkBtn.textContent = `🔍 Vérification ${doneCount()}/${rows.length}…`;
        renderProgress();
      }
      finished = true;
      renderProgress();
      checkBtn.textContent = "🔍 Vérifier";
      const changed = rows.filter((r) => r.status === "changed").length;
      const failed = rows.filter((r) => r.status === "failed").length;
      const shortCount = rows.filter((r) => r.status === "short").length;
      const parts = [`${rows.length} vérifiée${rows.length > 1 ? "s" : ""}`];
      if (changed) parts.push(`${changed} nouveauté${changed > 1 ? "s" : ""}`);
      if (failed) parts.push(`${failed} échec${failed > 1 ? "s" : ""}`);
      if (shortCount) parts.push(`${shortCount} illisible${shortCount > 1 ? "s" : ""}`);
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
    renderQuickAccess(sources);
    renderStarterPrompt(sources);
    renderSections(sources);
  }

  // Les raccourcis (catégorie "outils") ne sont pas des sources à scanner : ils vivent dans la zone
  // "Accès rapide" et ne comptent ni pour l'écran vide de départ ni pour les sections par sujet.
  const isTool = (s) => s.category === veilleApi.TOOLS_CATEGORY_KEY;

  // 🔗 Accès rapide (06/10/2026, demande directe de Charles-Henri : "met moi en accès direct le lien
  // vers les outils et boîte mail tiers dans la veille"). Un clic ouvre le service dans un nouvel
  // onglet ; la session reste celle du navigateur — Pilotage ne stocke ni identifiant ni mot de passe.
  // Un raccourci sans lien (la boîte mail livrée par défaut) s'affiche "à renseigner" et ouvre sa fiche.
  function renderQuickAccess(sources) {
    const tools = sources
      .filter(isTool)
      .sort((a, b) => sortKey(a.title).localeCompare(sortKey(b.title), "fr"));
    const hasHttp = (t) => /^https?:\/\//i.test(t.url || "");
    quickAccessEl.innerHTML = `
      <div class="card veille-quick-access">
        <div class="veille-quick-head">
          <div class="item-title">🔗 Accès rapide</div>
          <div class="veille-quick-head-actions">
            <button type="button" id="veille-alerts-btn" class="btn btn-ghost btn-sm">🔔 Requêtes Google Alerts</button>
            <button type="button" id="veille-tool-add-btn" class="btn btn-ghost btn-sm">+ Raccourci</button>
          </div>
        </div>
        ${
          tools.length
            ? `<div class="veille-quick-links">${tools
                .map((t, i) =>
                  hasHttp(t)
                    ? `<span class="veille-quick-link">
                        <a class="btn btn-secondary btn-sm" href="${escapeAttr(t.url)}" target="_blank" rel="noopener noreferrer" title="${escapeAttr(t.notes || t.url)}">${escapeHtml(t.title)} ↗</a>
                        <button type="button" class="btn btn-ghost btn-sm veille-quick-edit" data-tool-idx="${i}" aria-label="Modifier le raccourci ${escapeAttr(t.title)}" title="Modifier">✏️</button>
                      </span>`
                    : `<span class="veille-quick-link">
                        <button type="button" class="btn btn-secondary btn-sm veille-quick-edit veille-quick-link--todo" data-tool-idx="${i}" title="Aucun lien enregistré — clique pour le renseigner">${escapeHtml(t.title)} — à renseigner</button>
                      </span>`
                )
                .join("")}</div>`
            : `<div class="item-meta">
                Tes outils et ta boîte mail à un clic, depuis la veille. Une première liste est prête
                (boîte mail à renseigner, Google Alerts, Perplexity, Pappers, LinkedIn) — tu peux
                l'ajouter d'un clic puis l'ajuster, ou ajouter tes propres raccourcis avec « + Raccourci ».
                <div style="margin-top:8px;"><button type="button" id="veille-tools-starter-btn" class="btn btn-secondary btn-sm">📥 Ajouter les raccourcis proposés</button></div>
              </div>`
        }
      </div>
    `;
    quickAccessEl.querySelector("#veille-alerts-btn").addEventListener("click", () => openAlertsModal());
    quickAccessEl.querySelector("#veille-tool-add-btn").addEventListener("click", () =>
      openSourceModal(null, { category: veilleApi.TOOLS_CATEGORY_KEY })
    );
    quickAccessEl.querySelectorAll(".veille-quick-edit").forEach((btn) => {
      btn.addEventListener("click", () => openSourceModal(tools[Number(btn.dataset.toolIdx)]));
    });
    const starterBtn = quickAccessEl.querySelector("#veille-tools-starter-btn");
    starterBtn?.addEventListener(
      "click",
      guardClick(starterBtn, async () => {
        await Promise.all(veilleApi.STARTER_TOOLS.map((t) => veilleApi.createSource(t)));
        showToast(`${veilleApi.STARTER_TOOLS.length} raccourcis ajoutés`);
      })
    );
  }

  // Tri alphabétique qui ignore l'émoji/ponctuation de tête ("✉️ Boîte mail" se range au B).
  function sortKey(title) {
    return String(title || "").replace(/^[^\p{L}\p{N}]+/u, "");
  }

  // 🔔 Requêtes Google Alerts à recopier (06/10/2026) — une ligne = une alerte à coller dans le champ
  // de recherche de Google Alerts. Aucun accès à ton compte Google : on prépare le texte, tu le colles.
  function openAlertsModal() {
    const body = document.createElement("div");
    const syntaxHtml = veilleApi.GOOGLE_ALERTS_SYNTAX.map(
      (e) => `<li><code>${escapeHtml(e.code)}</code> — ${escapeHtml(e.text)}</li>`
    ).join("");
    const groupsHtml = veilleApi.GOOGLE_ALERTS_GROUPS.map(
      (g) => `
        <div class="section-title" style="margin-top:12px;">${g.emoji} ${escapeHtml(g.label)}</div>
        <div class="item-meta" style="margin-bottom:6px;">${escapeHtml(g.settings)}</div>
        ${g.queries
          .map(
            (item) => `
          <div class="alert-query-row">
            <div class="alert-query-main">
              <code class="alert-query-code">${escapeHtml(item.q)}</code>
              ${item.note ? `<div class="item-meta">${escapeHtml(item.note)}</div>` : ""}
            </div>
            <button type="button" class="btn btn-ghost btn-sm alert-query-copy" data-q="${escapeAttr(item.q)}" aria-label="Copier cette requête" title="Copier">📋</button>
          </div>`
          )
          .join("")}`
    ).join("");
    body.innerHTML = `
      <p class="item-meta" style="margin-top:0;">
        Une ligne = une alerte. Copie la requête (📋), ouvre Google Alerts, colle-la dans le champ de
        recherche, puis règle la fréquence indiquée au-dessus de chaque groupe.
      </p>
      <details>
        <summary class="item-meta" style="cursor:pointer;">Syntaxe utile</summary>
        <ul style="padding-left:20px;margin:6px 0;">${syntaxHtml}</ul>
      </details>
      ${groupsHtml}
      <p class="item-meta" style="margin-bottom:0;">${escapeHtml(veilleApi.GOOGLE_ALERTS_DELIVERY_TIP)}</p>
    `;
    body.querySelectorAll(".alert-query-copy").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(btn.dataset.q);
          showToast("Requête copiée");
        } catch {
          showToast("Copie automatique indisponible — sélectionne la requête et copie-la (Ctrl+C / Cmd+C)");
        }
      });
    });
    openModal({
      title: "🔔 Requêtes Google Alerts",
      body,
      wide: true,
      actions: [
        { label: "Fermer", variant: "ghost" },
        {
          label: "Ouvrir Google Alerts ↗",
          variant: "primary",
          closesModal: false,
          onClick: () => window.open("https://www.google.com/alerts", "_blank", "noopener,noreferrer"),
        },
      ],
    });
  }

  function renderStarterPrompt(sources) {
    if (sources.some((s) => !isTool(s))) {
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
    for (const cat of veilleApi.CATEGORIES.filter((c) => c.key !== veilleApi.TOOLS_CATEGORY_KEY)) {
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

  function openSourceModal(existing = null, presets = {}) {
    const body = document.createElement("div");
    body.innerHTML = `
      <div class="field">
        <label for="veille-title">Titre</label>
        <input id="veille-title" type="text" placeholder="Ex. SEMAE — réglementation semences" value="${escapeAttr(existing?.title || presets.title || "")}" />
      </div>
      <div class="field">
        <label for="veille-url">Lien (optionnel)</label>
        <input id="veille-url" type="url" placeholder="https://..." value="${escapeAttr(existing?.url || "")}" />
      </div>
      <div class="field">
        <label for="veille-category">Catégorie</label>
        <select id="veille-category">
          ${veilleApi.CATEGORIES.map(
            (c) => `<option value="${c.key}" ${(existing?.category || presets.category) === c.key ? "selected" : ""}>${c.emoji} ${c.label}</option>`
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
          ? `${result.short ? "⚠️ Zone très courte" : "✅ Zone trouvée"} (${result.text.length} caractères) — aperçu : « ${result.preview}${result.text.length > result.preview.length ? "…" : ""} »`
          : `⚠️ ${veilleApi.WATCH_ERROR_LABELS[result.error] || result.error}${result.detail ? ` (${result.detail})` : ""}`;
        if (result.ok && result.short) {
          // Procédure affichée ICI plutôt que dans une fenêtre : `openModal()` n'en garde qu'une à la fois,
          // en ouvrir une autre fermerait cette fiche et ferait perdre ce qui n'est pas encore enregistré.
          const warn = document.createElement("div");
          warn.style.marginTop = "6px";
          warn.textContent =
            "Probablement du contenu chargé par JavaScript, invisible pour Pilotage : aucune nouveauté ne sera détectée sur cette page.";
          const details = document.createElement("details");
          details.open = true;
          details.style.marginTop = "8px";
          const summary = document.createElement("summary");
          summary.innerHTML = "<strong>🔔 Surveiller ce site via Google Alerts à la place</strong>";
          details.append(
            summary,
            buildAlertProcedure({
              title: body.querySelector("#veille-title").value.trim(),
              url: body.querySelector("#veille-url").value.trim(),
              watchUrl: body.querySelector("#veille-watch-url").value.trim(),
              category: body.querySelector("#veille-category").value,
            }, { inForm: true })
          );
          testResultEl.append(warn, details);
        }
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
