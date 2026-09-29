// Exports PDF/Excel des Objectifs (ajout du 28/09/2026, retour de Charles-Henri — "petite
// parenthèse" objectifs/EADP) — construit les documents à partir des fonctions pures de
// js/domain/objectives.js (consolidateIndicatorTracking, notamment : un seul calcul, jamais
// deux logiques qui pourraient diverger entre l'écran et l'export). Utilise
// js/services/pdfWriter.js et js/services/xlsxWriter.js (générateurs vanilla sans dépendance,
// voir leur commentaire en tête de fichier pour le contexte complet — ni npm ni CDN accessibles
// dans l'environnement où ce patch a été développé).

import * as objectivesApi from "./objectives.js";
import * as peopleApi from "./people.js";
import * as linksApi from "./links.js";
import * as resourcesApi from "./resources.js";
import { createPdfDoc, downloadPdfBytes } from "../services/pdfWriter.js";
import { buildXlsxBytes, downloadXlsxBytes } from "../services/xlsxWriter.js";

function slug(text) {
  return (text || "objectif")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "objectif";
}

/**
 * Ressources d'un Objectif pour le tableau du PDF (retour de Charles-Henri : "un tableau de
 * ressources [...] l'indicateur ou le suivi global, le nom de la ressource, l'url [...] trié
 * par indicateurs, puis par nom de ressource") — deux sources, jamais un nouveau mécanisme de
 * liaison : les fiches Ressource liées à l'OBJECTIF entier via "🔗 Lié" (js/domain/links.js,
 * étiquetées "Suivi global" — un indicateur ne peut pas avoir son propre "🔗 Lié", voir
 * l'arbitrage "Option A" en tête de js/domain/objectives.js), et les Ressources référencées par
 * le `ref` d'un suivi (entries[].ref, rattachées à l'indicateur de ce suivi, ou "Suivi global" si
 * le suivi n'a pas d'indicateur).
 */
export async function collectObjectiveResources(objective) {
  const allLinks = await linksApi.listAll();
  const linkedResourceIds = linksApi
    .linksFor(allLinks, "Objective", objective.id)
    .filter((l) => l.other.type === "Resource")
    .map((l) => l.other.id);
  const indicatorById = new Map((objective.indicators || []).map((i) => [i.id, i]));
  const raw = [];
  for (const id of linkedResourceIds) raw.push({ scope: "Suivi global", scopeSort: "", resourceId: id });
  for (const e of objective.entries || []) {
    if (!e.ref || e.ref.type !== "Resource") continue;
    const ind = e.indicatorId ? indicatorById.get(e.indicatorId) : null;
    raw.push({ scope: ind ? ind.label || "(indicateur)" : "Suivi global", scopeSort: ind ? ind.label || "" : "", resourceId: e.ref.id });
  }
  const cache = new Map();
  const resolved = [];
  for (const row of raw) {
    if (!cache.has(row.resourceId)) cache.set(row.resourceId, await resourcesApi.getResource(row.resourceId));
    const res = cache.get(row.resourceId);
    if (!res) continue; // ressource supprimée depuis
    resolved.push({ scope: row.scope, scopeSort: row.scopeSort, resourceName: res.title || "(sans titre)", url: res.url || "" });
  }
  resolved.sort((a, b) => a.scopeSort.localeCompare(b.scopeSort, "fr") || a.resourceName.localeCompare(b.resourceName, "fr"));
  return resolved;
}

// Couleurs demandées par Charles-Henri pour la maquette EADP du 29/09/2026 ("Titre [...] centrée
// en orange", "Sous titre [...] en Gris foncé", "Objectif [...] en gras bleu", "Indicateur [...]
// en italique bleu") — dérivées de styles/tokens.css plutôt qu'une palette inventée : BLEU
// reprend --color-primary (#4C56C4 → 0.298/0.337/0.769) ; aucun jeton "orange" n'existe dans
// tokens.css, ORANGE est donc un choix éditorial ponctuel pour ce seul titre ; GRIS_FONCE est un
// gris neutre foncé pour les sous-titres (distinct du gris 0.7/0.7/0.7 déjà utilisé par les
// filets `doc.rule()`).
const ORANGE = [0.85, 0.42, 0.09];
const GRIS_FONCE = [0.27, 0.27, 0.29];
const BLEU = [0.298, 0.337, 0.769];

/** Calcule le suivi consolidé (réalisé + dernier prévu) d'un indicateur, ou du suivi général si
 *  `indicator` est `null` — seule source, jamais une logique dupliquée (voir consolidateIndicatorTracking). */
function computeTrackingBody(objective, indicator) {
  return objectivesApi.consolidateIndicatorTracking(objective, indicator ? indicator.id : null);
}

/** Écrit le corps consolidé (jamais "X suivis distincts" — un seul paragraphe réalisé, un seul
 *  "prévu avant le prochain point", retour de Charles-Henri : "je ne dois pas voir X suivi
 *  distinct les uns des autres pour cette entité objectif globale"). */
function writeTrackingParagraphs(doc, tracking) {
  doc.paragraph(tracking.realise.length ? tracking.realise.map((r) => `${r.date} — ${r.text}`).join("\n") : "Rien de réalisé enregistré.");
  if (tracking.dernierPrevu) doc.paragraph(`Prévu avant le prochain point : ${tracking.dernierPrevu.text}`);
}

/** Un bloc "titre + réalisé consolidé + dernier prévu" pour un indicateur (ou le suivi général
 *  si `indicator` est `null`) — utilisé par le PDF par objectif (indicateurs ET suivi général) et,
 *  dans le PDF EADP/global, uniquement pour le suivi général (voir writeNumberedIndicatorBlock
 *  ci-dessous pour les indicateurs de ce second export, qui ne doivent eux jamais disparaître
 *  même sans aucun suivi saisi). Note 29/09/2026 : le préfixe "📊 " a été retiré — un émoji, hors
 *  de la table WINANSI_EXTRA_BYTES (pdfWriter.js), se traduisait par des "?" dans le PDF, exactement
 *  le bug rapporté par Charles-Henri, ici présent dans une zone du code qu'il n'avait pas signalée
 *  mais touchée par la même cause racine. */
function writeIndicatorBlock(doc, objective, indicator) {
  const tracking = computeTrackingBody(objective, indicator);
  if (!tracking.realise.length && !tracking.dernierPrevu) return;
  const label = indicator ? `${indicator.label || "(indicateur)"}${indicator.target ? " — Cible : " + indicator.target : ""}` : "Suivi général";
  doc.heading(label, { size: 12 });
  writeTrackingParagraphs(doc, tracking);
}

// BUG corrigé (29/09/2026, retour de Charles-Henri : "les indicateurs ne sont pas présents tant
// qu'il n'ont pas de suivi" + confirmation dans le message suivant : "je dois voir POUR CHAQUE
// indicateur - son titre, sa cible [...]") : contrairement à writeIndicatorBlock ci-dessus (qui
// masque un indicateur sans aucun suivi — comportement conservé tel quel pour downloadObjectivePdf,
// non remis en cause pour cet export-là, périmètre non demandé), cette variante NE fait jamais de
// retour anticipé : titre + cible s'affichent toujours pour chaque indicateur de l'objectif, que
// des suivis existent ou non ("Rien de réalisé enregistré." sinon, comme déjà prévu).
function writeNumberedIndicatorBlock(doc, objective, indicator, index) {
  const tracking = computeTrackingBody(objective, indicator);
  const label = `Indicateur ${index} : ${indicator.label || "(indicateur)"}${indicator.target ? " — Cible : " + indicator.target : ""}`;
  doc.heading(label, { size: 11, bold: false, italic: true, color: BLEU });
  writeTrackingParagraphs(doc, tracking);
}

/** Bloc "campagne / titre / statut / type / description" d'un Objectif — partagé par
 *  downloadObjectivePdf et, depuis le 29/09/2026, downloadObjectivesOverviewPdf (retour de
 *  Charles-Henri : "sur le PDF je dois avoir comme j'avais demandé par objectif - la campagne, le
 *  titre, son statut, le type, la description avec les retours à la ligne"). */
function writeObjectiveMetaBlock(doc, objective) {
  doc.paragraph(`Campagne : ${objective.period || "—"}`);
  doc.paragraph(`Statut : ${objective.status === "done" ? "Atteint" : "En cours"}`);
  doc.paragraph(`Type : ${objective.scope ? objectivesApi.SCOPE_LABELS[objective.scope] : "—"}`);
  if (objective.description) doc.paragraph(`Description :\n${objective.description}`);
}

/** Tableau de ressources (3 colonnes indicateur/ressource/lien, trié par indicateur puis nom de
 *  ressource — voir collectObjectiveResources) — partagé par downloadObjectivePdf et, depuis le
 *  29/09/2026, downloadObjectivesOverviewPdf (un tableau par Objectif : les 3 colonnes demandées
 *  par Charles-Henri ne comportent aucune colonne "objectif", ce qui n'aurait de sens que si ce
 *  tableau reste scopé à un seul Objectif à la fois — voir le bilan livré pour le détail de ce
 *  raisonnement). */
function writeResourcesTable(doc, resources) {
  doc.heading("Ressources", { size: 12 });
  if (resources.length) {
    doc.table(
      [
        { header: "Indicateur / suivi", width: 165 },
        { header: "Ressource", width: 195 },
        { header: "Lien", width: 135 },
      ],
      resources.map((r) => [{ text: r.scope }, { text: r.resourceName }, r.url ? { text: "lien", link: r.url } : { text: "—" }])
    );
  } else {
    doc.paragraph("Aucune ressource liée.");
  }
}

/**
 * PDF d'un seul Objectif (retour de Charles-Henri : "je dois pouvoir éditer la fiche de cet
 * objectif et que ça me ressorte en PDF [...] campagne, titre, statut, type, description avec
 * les retours à la ligne [...] suivis groupés et consolidés [...] pour chaque indicateur [...]
 * tableau de ressources"). Aucun filtre de période ici : la fiche d'un objectif montre tout son
 * historique, comme l'écran.
 */
export async function downloadObjectivePdf(objective) {
  const doc = createPdfDoc({ title: objective.title });
  doc.heading(objective.title);
  writeObjectiveMetaBlock(doc, objective);
  doc.rule();

  writeIndicatorBlock(doc, objective, null);
  for (const ind of objective.indicators || []) writeIndicatorBlock(doc, objective, ind);

  doc.rule();
  const resources = await collectObjectiveResources(objective);
  writeResourcesTable(doc, resources);

  downloadPdfBytes(doc.save(), `objectif-${slug(objective.title)}.pdf`);
}

/**
 * PDF global (EADP d'un collaborateur, ou "Mes objectifs" personnel — retour de Charles-Henri :
 * "je dois disposer de tout cela également dans la partie des objectifs qui me concerne
 * personnellement en plus des collaborateurs") : notables positifs/négatifs/neutres groupés
 * avec leur "pourquoi" en premier (`notableItems`, `null` pour l'export personnel — pas de
 * journal de notes pour soi-même), puis l'avancement de chaque Objectif. `range` (optionnel,
 * `{from, to}` en ms) filtre les suivis à la même période que l'écran d'où l'export est lancé ;
 * `null` = tout l'historique (cas "Mes objectifs", qui n'a pas de sélecteur de période).
 *
 * Aucune notion d'archivage n'existe aujourd'hui sur un Objectif (seulement actif/atteint, voir
 * js/domain/objectives.js) : "tous les objectifs non archivés" est donc interprété ici comme
 * "tous les objectifs" — à corriger si Charles-Henri introduit un jour un statut d'archivage.
 */
// Réécrit intégralement le 29/09/2026 (retour de Charles-Henri, maquette précise du PDF EADP +
// message complémentaire "par objectif" — voir les deux commentaires détaillés ci-dessous pour
// chaque partie de la mise en page). `titleStyle` (nouveau) laisse downloadEadpPdf demander un
// titre centré en orange sans imposer ce même style à downloadPersonalObjectivesPdf ("Mes
// objectifs"), qui n'a pas été concerné par la demande de maquette.
export async function downloadObjectivesOverviewPdf({ heading, filename, objectives, notableItems = null, range = null, titleStyle = {} }) {
  const doc = createPdfDoc({ title: heading });
  // "Titre : EADP [Nom] / format : centrée en orange / Ligne complète en dessous"
  doc.heading(heading, { size: 18, align: "left", color: null, ...titleStyle });
  doc.rule();
  doc.spacer(10);

  if (notableItems) {
    // "Sous titre : 'éléments notables de l'année' aligné gauche et en Gris foncé"
    doc.heading("Éléments notables de l'année", { size: 12, bold: false, color: GRIS_FONCE });
    doc.spacer(4);
    // Émojis (👍/👎/⚪) remplacés par des symboles simples +/-/= (choix de Charles-Henri, réponse à
    // la question posée avant développement : ce moteur PDF n'embarque aucune police capable de
    // dessiner un émoji — voir le commentaire sur WINANSI_EXTRA_BYTES dans pdfWriter.js — les
    // émojis littéraux redonnent exactement le bug des "?" signalé).
    for (const [symbole, label, list] of [
      ["+", "Notables positifs", notableItems.positive],
      ["-", "Notables négatifs", notableItems.negative],
      ["=", "Notables neutres", notableItems.neutral],
    ]) {
      // Tri chronologique croissant demandé explicitement "pour le PDF" (plus ancien → plus
      // récent) — appliqué ICI seulement : collectEadpNotableItems (js/views/people.js) ne trie
      // pas et reste inchangé, pour ne pas modifier l'ordre de l'écran "Préparer l'EADP" qui n'a
      // pas été mis en cause (portée strictement limitée à cette demande PDF).
      const sorted = [...list].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      doc.heading(`${symbole} ${label} (${sorted.length})`, { size: 11 });
      if (!sorted.length) {
        doc.paragraph("Rien sur cette période.");
      } else {
        for (const item of sorted) {
          doc.paragraph(item.title, { bold: true, gapAfter: item.reason ? 2 : 6 });
          if (item.reason) doc.paragraph(item.reason);
        }
      }
      doc.spacer(6);
    }
    doc.rule();
    doc.spacer(10);
  }

  // "Sous titre : Objectifs (nombre d'objectif) aligné gauche et en Gris foncé"
  doc.heading(`Objectifs (${objectives.length})`, { size: 12, bold: false, color: GRIS_FONCE });
  doc.spacer(6);

  let index = 0;
  for (const o of objectives) {
    index += 1;
    const scoped = range ? { ...o, entries: (o.entries || []).filter((e) => e.createdAt >= range.from && e.createdAt <= range.to) } : o;
    // "Objectif 1 : Titre en gras bleu" (le statut ✅/🎯 précédemment en préfixe est retiré : il
    // apparaît maintenant en toutes lettres dans writeObjectiveMetaBlock, "Statut : Atteint/En cours")
    doc.heading(`Objectif ${index} : ${o.title}`, { size: 13, color: BLEU });
    // Complément de Charles-Henri : "je dois avoir comme j'avais demandé par objectif - la
    // campagne, le titre, son statut, le type, la description avec les retours à la ligne"
    writeObjectiveMetaBlock(doc, scoped);
    doc.spacer(4);
    // Suivi de l'objectif global — consolidé, jamais "X suivis distincts" (inchangé)
    writeIndicatorBlock(doc, scoped, null);
    // "Indicateur 1 en italique bleu : Titre [...] Indicateur 2 : etc." — toujours affiché, même
    // sans aucun suivi saisi (corrige "les indicateurs ne sont pas présents tant qu'ils n'ont pas
    // de suivi")
    (scoped.indicators || []).forEach((ind, indIndex) => writeNumberedIndicatorBlock(doc, scoped, ind, indIndex + 1));
    doc.spacer(4);
    // "à la fin il me faut un tableau de ressource [...] trié par indicateurs, puis par nom de
    // ressource" — un tableau par Objectif (les 3 colonnes demandées, sans colonne "objectif",
    // n'ont de sens que scopées à un seul Objectif à la fois — voir collectObjectiveResources,
    // déjà bâtie objectif par objectif ; raisonnement détaillé dans le bilan livré avec ce patch).
    const resources = await collectObjectiveResources(scoped);
    writeResourcesTable(doc, resources);
    doc.spacer(10);
  }

  downloadPdfBytes(doc.save(), filename);
}

export async function downloadEadpPdf(person, objectives, notableItems, range) {
  await downloadObjectivesOverviewPdf({
    heading: `EADP ${person.name}`,
    filename: `eadp-${slug(person.name)}.pdf`,
    objectives,
    notableItems,
    range,
    titleStyle: { align: "center", color: ORANGE },
  });
}

export async function downloadPersonalObjectivesPdf(objectives) {
  await downloadObjectivesOverviewPdf({
    heading: "Mes objectifs",
    filename: "mes-objectifs.pdf",
    objectives,
    notableItems: null,
    range: null,
  });
}

// --- Export Excel (retour de Charles-Henri : "sortir les objectifs dans un fichier excel avec
// filtres : campagne, personne (facultatif)") ------------------------------------------------

function compileIndicatorsCell(o) {
  return (o.indicators || []).map((ind) => `${ind.label || "(sans libellé)"}${ind.target ? " — Cible : " + ind.target : ""}`).join("\n");
}

// "Suivi (compilé ensemble tout indicateur et objectif dans la même cellule)" — convention
// retenue faute de précision de Charles-Henri sur le format exact : une ligne par point de
// suivi réalisé, préfixée du nom de l'indicateur concerné ("[Général]" pour le suivi sans
// indicateur), retours à la ligne dans la cellule (voir xlsxWriter.js#wrapText).
function compileSuiviCell(o) {
  const lines = [];
  const general = objectivesApi.consolidateIndicatorTracking(o, null);
  for (const r of general.realise) lines.push(`[Général] ${r.date} — ${r.text}`);
  for (const ind of o.indicators || []) {
    const tracking = objectivesApi.consolidateIndicatorTracking(o, ind.id);
    for (const r of tracking.realise) lines.push(`[${ind.label || "indicateur"}] ${r.date} — ${r.text}`);
  }
  return lines.join("\n");
}

/** Périodes ("campagnes") distinctes déjà utilisées par au moins un Objectif — pour peupler le
 *  filtre de l'export Excel sans construire une véritable entité "campagne" (même arbitrage que
 *  js/views/people.js#groupObjectivesByPeriod). */
export function listDistinctPeriods(objectives) {
  return [...new Set(objectives.map((o) => o.period).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
}

export async function downloadObjectivesExcel({ period = null, personId = null } = {}) {
  const [allObjectives, allPeople] = await Promise.all([objectivesApi.listAll(), peopleApi.listAll()]);
  const peopleById = new Map(allPeople.map((p) => [p.id, p]));
  let filtered = allObjectives;
  if (period) filtered = filtered.filter((o) => (o.period || "") === period);
  if (personId) filtered = filtered.filter((o) => (o.personId || "__me__") === personId);

  const rows = filtered.map((o) => [
    o.personId ? peopleById.get(o.personId)?.name || "(personne supprimée)" : "Moi",
    o.title,
    o.description || "",
    compileIndicatorsCell(o),
    compileSuiviCell(o),
  ]);
  const columns = [
    { header: "Personne", width: 22 },
    { header: "Titre de l'objectif", width: 32 },
    { header: "Description de l'objectif", width: 40 },
    { header: "Indicateurs", width: 40 },
    { header: "Suivi", width: 55 },
  ];
  downloadXlsxBytes(buildXlsxBytes(columns, rows), "objectifs.xlsx");
}
