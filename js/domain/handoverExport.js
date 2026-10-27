// Génération des fichiers du dossier de passation (27/10/2026) — voir js/domain/handover.js pour
// le périmètre et les règles de confidentialité. Trois sorties, toutes bâties sur les mêmes
// données :
//  - un PDF global (synthèse, projets en cours, tâches hors projet) — SANS le détail des
//    personnes (seulement des compteurs) : c'est ce qui permet de le remettre sans exposer les
//    suivis individuels ;
//  - une fiche PDF par membre de l'équipe, regroupées dans un ZIP (un seul téléchargement,
//    robuste sur mobile) ;
//  - un classeur Excel : une ligne par sujet non terminé, avec "Qui reprend ?" à remplir.
// Générateurs réutilisés tels quels : js/services/pdfWriter.js et js/services/xlsxWriter.js
// (aucune dépendance externe). La police PDF (Helvetica de base) ne sait pas dessiner les émojis
// (voir pdfWriter.js) : ils sont retirés des textes avant écriture dans le PDF.
import * as tasksApi from "./tasks.js";
import * as projectsApi from "./projects.js";
import * as followUpsApi from "./followups.js";
import * as peopleApi from "./people.js";
import * as objectivesApi from "./objectives.js";
import * as linksApi from "./links.js";
import * as resourcesApi from "./resources.js";
import { buildHandoverData, buildHandoverRows, HANDOVER_COLUMNS, HANDOVER_GUIDE, formatDateFr, pdfText } from "./handover.js";
import { createPdfDoc, downloadPdfBytes } from "../services/pdfWriter.js";
import { buildXlsxBytes, downloadXlsxBytes, buildZip } from "../services/xlsxWriter.js";

const ORANGE = [0.85, 0.42, 0.09];
const GRIS = [0.4, 0.4, 0.43];
const ROUGE = [0.75, 0.15, 0.15];

const LABELS = {
  taskStatus: (s) => tasksApi.STATUS_LABELS[s] || s || "",
  priority: (p) => ({ haute: "Haute", normale: "Normale", basse: "Basse" }[p] || p || ""),
  followUpStatus: (s) => (followUpsApi.STATUS_LABELS[s] || s || "").replace(/^\S+\s/, ""), // sans l'émoji d'en-tête
  partStatus: (s) => projectsApi.PART_STATUS_LABELS[s] || s || "",
  category: (c) => (followUpsApi.CATEGORY_LABELS[c] || c || "").replace(/^\S+\s/, ""),
  objectiveScope: (s) => objectivesApi.SCOPE_LABELS[s] || s || "",
  indicatorStatus: (s) => objectivesApi.INDICATOR_STATUS_LABELS[s] || s || "",
  resourceType: (t) => resourcesApi.typeInfo(t).label,
};

function slug(text) {
  return (
    (text || "fiche")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 50) || "fiche"
  );
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Charge toutes les données nécessaires (lecture seule). */
export async function loadHandoverSource() {
  const [tasks, projects, followUps, people, objectives, links, resources] = await Promise.all([
    tasksApi.listAll(),
    projectsApi.listAll(),
    followUpsApi.listAll(),
    peopleApi.listAll(),
    objectivesApi.listAll(),
    linksApi.listAll(),
    resourcesApi.listAll(),
  ]);
  return { tasks, projects, followUps, people, objectives, links, resources };
}

export function computeHandover(source, options) {
  return buildHandoverData(source, options, LABELS);
}

// --- Écriture PDF -------------------------------------------------------------------------------

function line(parts) {
  return parts.filter(Boolean).join(" · ");
}

function writeNotes(doc, notes, heading = "Notes et suivi") {
  if (!notes.length) return;
  doc.paragraph(`${heading} :\n` + notes.map((n) => `${n.date ? n.date + " : " : ""}${pdfText(n.text)}`).join("\n"), { size: 9, gapAfter: 4 });
}

function writeChecklist(doc, item) {
  if (!item.checklistTotal) return;
  doc.paragraph(`Reste à faire (${item.checklistTotal - item.checklistDone} sur ${item.checklistTotal}) :\n` + item.checklistOpen.map((t) => "- " + pdfText(t)).join("\n"), { size: 9, gapAfter: 4 });
}

function writeResources(doc, resources) {
  if (!resources.length) return;
  doc.paragraph("Ressources :", { size: 9, bold: true, gapAfter: 2 });
  doc.table(
    [
      { header: "Ressource", width: 230 },
      { header: "Type / emplacement", width: 140 },
      { header: "Lien", width: 125 },
    ],
    resources.map((r) => [{ text: pdfText(r.title) }, { text: pdfText(r.typeLabel + (r.location ? " : " + r.location : "")) }, r.url ? { text: "lien", link: r.url } : { text: "—" }]),
    { size: 8.5 }
  );
}

function writeTask(doc, t, { showProject = false } = {}) {
  doc.heading(pdfText(t.title), { size: 11, color: t.late ? ROUGE : null, keepWithNext: 55 });
  const when = t.dueDate ? `Échéance : ${formatDateFr(t.dueDate)}${t.late ? ` (en retard de ${t.daysLate} j)` : ""}` : "Sans échéance";
  doc.paragraph(line([`Statut : ${t.statusLabel}${t.blocked ? " (bloquée)" : ""}`, t.priorityLabel ? `Priorité : ${t.priorityLabel}` : "", when, showProject && t.projectName ? `Projet : ${pdfText(t.projectName)} (clos)` : ""]), { size: 9.5, gapAfter: 3 });
  if (t.waitingOn) doc.paragraph(`En attente de : ${pdfText(t.waitingOn)}`, { size: 9.5, gapAfter: 3 });
  else if (t.status === "waiting") doc.paragraph("En attente de : non précisé", { size: 9.5, gapAfter: 3 });
  if (t.parentTitle) doc.paragraph(`Sous-tâche de : ${pdfText(t.parentTitle)}`, { size: 9.5, gapAfter: 3 });
  if (t.description) doc.paragraph(pdfText(t.description), { size: 9.5, gapAfter: 3 });
  if (t.successCriteria) doc.paragraph(`Critère de réussite : ${pdfText(t.successCriteria)}`, { size: 9.5, gapAfter: 3 });
  writeChecklist(doc, t);
  writeNotes(doc, t.notes);
  writeResources(doc, t.resources);
  doc.spacer(6);
}

function writeFollowUp(doc, f, { toTell }) {
  const lateNote = f.controlLate ? " (dépassé)" : "";
  doc.heading(pdfText(f.title), { size: 11, color: f.controlLate || f.dueLate ? ROUGE : null, keepWithNext: 55 });
  const dates = toTell
    ? [f.controlDate ? `À lui dire avant le : ${formatDateFr(f.controlDate)}${lateNote}` : "Sans date"]
    : [f.dueDate ? `Échéance de la personne : ${formatDateFr(f.dueDate)}${f.dueLate ? " (dépassée)" : ""}` : "", f.controlDate ? `Prochain contrôle : ${formatDateFr(f.controlDate)}${lateNote}` : ""];
  doc.paragraph(line([`Statut : ${f.statusLabel}`, f.categoryLabel, ...dates, f.projectName ? `Projet : ${pdfText(f.projectName)}` : ""]), { size: 9.5, gapAfter: 3 });
  if (f.description) doc.paragraph(pdfText(f.description), { size: 9.5, gapAfter: 3 });
  if (f.expectedResult) doc.paragraph(`Résultat attendu : ${pdfText(f.expectedResult)}`, { size: 9.5, gapAfter: 3 });
  if (f.successCriteria) doc.paragraph(`Critère de réussite : ${pdfText(f.successCriteria)}`, { size: 9.5, gapAfter: 3 });
  writeChecklist(doc, f);
  writeNotes(doc, f.notes);
  writeResources(doc, f.resources);
  doc.spacer(6);
}

function sectionTitle(doc, text) {
  doc.spacer(6);
  doc.heading(pdfText(text), { size: 14, color: ORANGE, keepWithNext: 90 });
  doc.rule();
}

function writeCover(doc, title, subtitle, intro) {
  doc.heading(title, { size: 20, color: ORANGE });
  doc.paragraph(subtitle, { size: 10, gapAfter: 4 });
  doc.paragraph("Document confidentiel : il contient des données professionnelles et, le cas échéant, des informations sur des personnes. À ne partager qu'avec les personnes concernées.", { size: 8.5, gapAfter: 10 });
  if (intro) {
    doc.heading("Mot d'introduction", { size: 12 });
    doc.paragraph(pdfText(intro), { size: 10 });
  }
}

/** Page « Comment lire ce dossier » (texte HANDOVER_GUIDE, partagé avec le message copiable de l'écran). */
function writeGuide(doc) {
  const g = HANDOVER_GUIDE;
  // Typographie française : espaces insécables à l'intérieur des « guillemets » et avant « ? » / « : ».
  const nb = (t) => t.replace(/« /g, "«\u00a0").replace(/ (»|\?|:)/g, "\u00a0$1");
  doc.spacer(4);
  doc.heading(g.title, { size: 14, color: ORANGE, keepWithNext: 60 });
  doc.paragraph(nb(g.intro), { size: 10, gapAfter: 6 });
  for (const d of g.documents) {
    doc.heading(d.title, { size: 11, keepWithNext: 50 });
    doc.paragraph(nb(d.text), { size: 9.5, gapAfter: 5 });
  }
  doc.heading(g.readingTitle, { size: 11, keepWithNext: 50 });
  doc.paragraph(g.reading.map((r) => "- " + nb(r)).join("\n"), { size: 9.5, gapAfter: 5 });
  doc.heading(g.excludedTitle, { size: 11, keepWithNext: 40 });
  doc.paragraph(nb(g.excluded), { size: 9.5, gapAfter: 5 });
  doc.heading(g.startTitle, { size: 11, keepWithNext: 40 });
  doc.paragraph(nb(g.start), { size: 9.5, gapAfter: 5 });
  doc.pageBreak();
}

/** PDF global : synthèse, projets en cours, tâches hors projet. */
export function buildGlobalPdf(handover, { intro = "", generatedOn = todayIso() } = {}) {
  const s = handover.summary;
  const doc = createPdfDoc({ title: "Dossier de passation" });
  writeCover(doc, "Dossier de passation", `Établi le ${formatDateFr(generatedOn)} · uniquement ce qui n'est pas terminé`, intro);
  writeGuide(doc);

  doc.heading("Synthèse", { size: 14, color: ORANGE });
  doc.paragraph(
    [
      `Projets en cours : ${s.projectsCount}`,
      `Tâches non terminées : ${s.tasksCount} (dont ${s.tasksLate} en retard)`,
      `Échéances dans les 7 jours : ${s.due7} · dans les 30 jours : ${s.due30}`,
      s.peopleCount ? `Suivis d'équipe en cours : ${s.followUpsCount} (dont ${s.followUpsLate} en retard) — voir les fiches individuelles remises séparément.` : "",
    ]
      .filter(Boolean)
      .join("\n")
  );
  if (handover.priorities.length) {
    const more = handover.prioritiesTotal - handover.priorities.length;
    doc.heading(`À traiter en priorité (en retard ou à échéance sous 7 jours)${more > 0 ? ` : les ${handover.priorities.length} plus urgentes sur ${handover.prioritiesTotal}` : ""}`, { size: 11, keepWithNext: 60 });
    doc.table(
      [
        { header: "Tâche", width: 230 },
        { header: "Projet", width: 130 },
        { header: "Échéance", width: 135 },
      ],
      handover.priorities.map((t) => [{ text: pdfText(t.title) }, { text: pdfText(t.projectName || "—") }, { text: t.late ? `${formatDateFr(t.dueDate)} (retard ${t.daysLate} j)` : formatDateFr(t.dueDate) }]),
      { size: 9 }
    );
    if (more > 0) doc.paragraph(`… et ${more} autre(s) tâche(s) en retard ou proche(s) de l'échéance, détaillée(s) dans les projets ci-dessous et dans le tableau Excel.`, { size: 9, gapAfter: 6 });
  }

  sectionTitle(doc, `Projets en cours (${handover.projects.length})`);
  if (!handover.projects.length) doc.paragraph("Aucun projet en cours.");
  for (const p of handover.projects) {
    doc.heading(pdfText(p.name) + (p.critical ? " (critique)" : ""), { size: 13, keepWithNext: 80 });
    const progress = p.progress.percent === null ? "Avancement : aucune tâche rattachée" : `Avancement : ${p.progress.percent} % (${p.progress.done} tâche(s) terminée(s) sur ${p.progress.total})`;
    doc.paragraph(line([progress, p.partsTotal ? `Sous-parties : ${p.partsDone}/${p.partsTotal} terminées` : "", pdfText(p.category)]), { size: 9.5, gapAfter: 3 });
    if (p.objective) doc.paragraph(`Objectif : ${pdfText(p.objective)}`, { size: 9.5, gapAfter: 3 });
    if (p.successCriteria) doc.paragraph(`Critère de réussite : ${pdfText(p.successCriteria)}`, { size: 9.5, gapAfter: 3 });
    if (p.parts.length) doc.paragraph("Sous-parties non terminées :\n" + p.parts.map((x) => `- ${pdfText(x.label)} (${x.statusLabel})` + (x.notes.length ? "\n    " + x.notes.map((n) => `${n.date} : ${pdfText(n.text)}`).join("\n    ") : "")).join("\n"), { size: 9.5, gapAfter: 3 });
    writeNotes(doc, p.notes, "Notes du projet");
    writeResources(doc, p.resources);
    if (p.tasks.length) {
      doc.heading(`Tâches non terminées (${p.tasks.length})`, { size: 11, color: GRIS });
      for (const t of p.tasks) writeTask(doc, t);
    } else {
      doc.paragraph("Aucune tâche non terminée rattachée à ce projet.", { size: 9.5 });
    }
    doc.spacer(8);
  }

  sectionTitle(doc, `Tâches hors projet (${handover.looseTasks.length})`);
  if (!handover.looseTasks.length) doc.paragraph("Aucune tâche hors projet en cours.");
  for (const t of handover.looseTasks) writeTask(doc, t, { showProject: true });
  return doc.save();
}

/** Fiche PDF d'une personne. */
export function buildPersonPdf(person, { generatedOn = todayIso() } = {}) {
  const doc = createPdfDoc({ title: `Fiche de suivi - ${person.name}` });
  writeCover(doc, `Fiche de suivi : ${pdfText(person.name)}`, `${pdfText(line([person.role, person.team]))}${person.role || person.team ? " · " : ""}établie le ${formatDateFr(generatedOn)} · uniquement ce qui n'est pas terminé`, ""); // le mot d'introduction s'adresse au chef : réservé au dossier global
  doc.paragraph(`Sujets en cours : ${person.waitingOn.length + person.toTell.length} (dont ${person.lateCount} en retard de contrôle ou d'échéance). Les sujets que j'avais choisi de garder privés ne figurent pas ici.`, { size: 9.5 });

  sectionTitle(doc, `Ce que ${pdfText(person.name)} devait faire (${person.waitingOn.length})`);
  if (!person.waitingOn.length) doc.paragraph("Rien en attente.");
  for (const f of person.waitingOn) writeFollowUp(doc, f, { toTell: false });

  sectionTitle(doc, `Ce que je devais lui transmettre ou fournir (${person.toTell.length})`);
  if (!person.toTell.length) doc.paragraph("Rien à transmettre.");
  for (const f of person.toTell) writeFollowUp(doc, f, { toTell: true });

  if (person.objectives.length) {
    sectionTitle(doc, `Objectifs en cours (${person.objectives.length})`);
    for (const o of person.objectives) {
      doc.heading(pdfText(o.title), { size: 11, keepWithNext: 55 });
      doc.paragraph(line([o.period ? `Campagne : ${o.period}` : "", o.scopeLabel]), { size: 9.5, gapAfter: 3 });
      if (o.description) doc.paragraph(pdfText(o.description), { size: 9.5, gapAfter: 3 });
      if (o.indicators.length) doc.paragraph("Indicateurs :\n" + o.indicators.map((i) => `- ${pdfText(i.label)}${i.target ? " (cible : " + pdfText(i.target) + ")" : ""}${i.statusLabel ? " : " + i.statusLabel : ""}`).join("\n"), { size: 9.5, gapAfter: 3 });
      if (o.actionPlan) doc.paragraph(`Plan d'action : ${pdfText(o.actionPlan)}`, { size: 9.5, gapAfter: 3 });
      if (o.watchPoints) doc.paragraph(`Points d'attention : ${pdfText(o.watchPoints)}`, { size: 9.5, gapAfter: 3 });
      if (o.lastEntries.length) doc.paragraph(`Derniers suivis${o.entriesTotal > o.lastEntries.length ? ` (les ${o.lastEntries.length} plus récents sur ${o.entriesTotal})` : ""} :\n` + o.lastEntries.map((e) => `${e.date} : ${pdfText(e.note)}${e.nextSteps ? " (prévu : " + pdfText(e.nextSteps) + ")" : ""}`).join("\n"), { size: 9, gapAfter: 4 });
      doc.spacer(4);
    }
  }

  if (person.privateNotes) {
    const pn = person.privateNotes;
    sectionTitle(doc, "Mes notes et repères sur la personne");
    if (pn.markers.length) {
      doc.heading("Repères managériaux", { size: 11, keepWithNext: 50 });
      for (const m of pn.markers) {
        doc.paragraph(`${pdfText(m.label)} :\n${pdfText(m.text)}`, { size: 9.5, gapAfter: 4 });
      }
    }
    if (pn.notes) {
      doc.heading("Contexte", { size: 11, keepWithNext: 40 });
      doc.paragraph(pdfText(pn.notes), { size: 9.5 });
    }
    if (pn.journal.length) {
      doc.heading(`Notes datées (${pn.journal.length})`, { size: 11, keepWithNext: 40 });
      doc.paragraph(pn.journal.map((n) => `${n.date} : ${pdfText(n.text)}`).join("\n"), { size: 9 });
    }
    if (!pn.markers.length && !pn.notes && !pn.journal.length) doc.paragraph("Aucune note ni repère renseigné.");
  }
  return doc.save();
}

// --- Téléchargements ----------------------------------------------------------------------------

export function downloadGlobalPdf(handover, options) {
  downloadPdfBytes(buildGlobalPdf(handover, options), `passation-${todayIso()}.pdf`);
}

export function downloadHandoverExcel(handover) {
  const rows = buildHandoverRows(handover);
  downloadXlsxBytes(buildXlsxBytes(HANDOVER_COLUMNS, rows, { sheetName: "Passation", freezeHeader: true }), `passation-${todayIso()}.xlsx`);
  return rows.length;
}

export function buildPeopleZipBytes(handover, options) {
  const enc = new TextEncoder();
  const used = new Set();
  const files = handover.people.map((person) => {
    let name = `fiche-${slug(person.name)}`;
    while (used.has(name)) name += "-2";
    used.add(name);
    return { name: `${name}.pdf`, data: buildPersonPdf(person, options) };
  });
  files.push({ name: "LISEZ-MOI.txt", data: enc.encode("Fiches de suivi individuelles (confidentielles).\nChaque fichier concerne une seule personne : ne le transmettre qu'aux personnes habilitées.\n") });
  return buildZip(files);
}

export function downloadPeopleZip(handover, options) {
  const bytes = buildPeopleZipBytes(handover, options);
  const blob = new Blob([bytes], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `passation-equipe-${todayIso()}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return handover.people.length;
}
