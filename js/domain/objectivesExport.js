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

/** Un bloc "titre + réalisé consolidé + dernier prévu" pour un indicateur (ou le suivi général
 *  si `indicator` est `null`) — partagé par le PDF par objectif et le PDF EADP global. */
function writeIndicatorBlock(doc, objective, indicator) {
  const tracking = objectivesApi.consolidateIndicatorTracking(objective, indicator ? indicator.id : null);
  if (!tracking.realise.length && !tracking.dernierPrevu) return;
  const label = indicator ? `📊 ${indicator.label || "(indicateur)"}${indicator.target ? " — Cible : " + indicator.target : ""}` : "Suivi général";
  doc.heading(label, { size: 12 });
  doc.paragraph(tracking.realise.length ? tracking.realise.map((r) => `${r.date} — ${r.text}`).join("\n") : "Rien de réalisé enregistré.");
  if (tracking.dernierPrevu) doc.paragraph(`Prévu avant le prochain point : ${tracking.dernierPrevu.text}`);
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
  doc.paragraph(`Campagne : ${objective.period || "—"}`);
  doc.paragraph(`Statut : ${objective.status === "done" ? "Atteint" : "En cours"}`);
  doc.paragraph(`Type : ${objective.scope ? objectivesApi.SCOPE_LABELS[objective.scope] : "—"}`);
  if (objective.description) doc.paragraph(`Description :\n${objective.description}`);
  doc.rule();

  writeIndicatorBlock(doc, objective, null);
  for (const ind of objective.indicators || []) writeIndicatorBlock(doc, objective, ind);

  doc.rule();
  doc.heading("Ressources", { size: 12 });
  const resources = await collectObjectiveResources(objective);
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
export async function downloadObjectivesOverviewPdf({ heading, filename, objectives, notableItems = null, range = null }) {
  const doc = createPdfDoc({ title: heading });
  doc.heading(heading);
  doc.rule();

  if (notableItems) {
    for (const [label, list] of [
      ["👍 Notables positifs", notableItems.positive],
      ["👎 Notables négatifs", notableItems.negative],
      ["⚪ Notables neutres", notableItems.neutral],
    ]) {
      doc.heading(`${label} (${list.length})`, { size: 12 });
      if (!list.length) {
        doc.paragraph("Rien sur cette période.");
      } else {
        for (const item of list) {
          doc.paragraph(item.title, { bold: true, gapAfter: item.reason ? 2 : 6 });
          if (item.reason) doc.paragraph(item.reason);
        }
      }
    }
    doc.rule();
  }

  doc.heading(`Objectifs (${objectives.length})`, { size: 14 });
  for (const o of objectives) {
    const scoped = range ? { ...o, entries: (o.entries || []).filter((e) => e.createdAt >= range.from && e.createdAt <= range.to) } : o;
    doc.heading(`${o.status === "done" ? "✅ " : "🎯 "}${o.title}`, { size: 12 });
    writeIndicatorBlock(doc, scoped, null);
    for (const ind of o.indicators || []) writeIndicatorBlock(doc, scoped, ind);
    doc.spacer(6);
  }

  downloadPdfBytes(doc.save(), filename);
}

export async function downloadEadpPdf(person, objectives, notableItems, range) {
  await downloadObjectivesOverviewPdf({
    heading: `Préparation EADP — ${person.name}`,
    filename: `eadp-${slug(person.name)}.pdf`,
    objectives,
    notableItems,
    range,
  });
}

export async function downloadPersonalObjectivesPdf(objectives) {
  await downloadObjectivesOverviewPdf({
    heading: "🎯 Mes objectifs",
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
