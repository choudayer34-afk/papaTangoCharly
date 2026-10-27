// Dossier de passation — 27/10/2026, retour de Charles-Henri (arrêt maladie) : "il faut que je
// puisse sortir à mon chef les tâches et projets que j'avais en cours, leur note et état
// d'avancement, échéance et tout ce qui les concerne, pour ce qui n'est pas terminé ; il en est de
// même pour le suivi de chaque membre de mon équipe : ce qu'il devait faire pour quand, les notes
// et le suivi, et ce que je devais leur fournir".
//
// Ce module est PUR (aucun accès au stockage, au DOM ni à une bibliothèque de génération de
// fichier) : il reçoit les données déjà lues et renvoie une structure prête à être écrite en PDF
// (js/domain/handoverExport.js) ou en lignes Excel. C'est ce qui permet de le tester directement
// sous Node (tests/unit/handover.spec.js).
//
// Règles de périmètre décidées avec Charles-Henri (27/10/2026) :
//  - UNIQUEMENT ce qui n'est pas terminé (tâche ≠ Terminé, projet actif, suivi ≠ Réglé, objectif
//    non atteint, sous-partie de projet non terminée) ;
//  - les sujets masqués du point (`hiddenFromPrep`) et ses notes privées sur chaque personne ne
//    sortent JAMAIS par défaut (`includePersonNotes` doit être explicitement demandé) ;
//  - les ressources associées (liens) accompagnent chaque tâche, projet et suivi ;
//  - les personnes de type "manager" (son propre manager) ne sont pas des "membres de l'équipe" :
//    exclues de la liste des fiches.
import * as dateUtils from "../services/dateUtils.js";

const NO_DATE_SORT = Number.MAX_SAFE_INTEGER;

function dueSortKey(isoDate) {
  return isoDate ? dateUtils.parseLocalDate(isoDate).getTime() : NO_DATE_SORT;
}

/** "2026-10-27" ou millisecondes → "27/10/2026" (vide si absent/invalide). */
export function formatDateFr(value) {
  if (!value) return "";
  const date = typeof value === "number" ? new Date(value) : dateUtils.parseLocalDate(String(value).slice(0, 10));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function notesOf(entity) {
  return [...(entity.notesLog || [])]
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    .map((n) => ({ date: formatDateFr(n.createdAt), text: (n.text || "").trim() }))
    .filter((n) => n.text);
}

function checklistOf(entity) {
  const list = entity.checklist || [];
  return {
    checklistOpen: list.filter((c) => !c.done).map((c) => c.text),
    checklistDone: list.filter((c) => c.done).length,
    checklistTotal: list.length,
  };
}

/**
 * Ressources associées à une fiche, sans doublon : via "🔗 Lié" (collection `links`) ET via les
 * champs `projectIds`/`taskIds` portés par la Ressource elle-même — les deux mécanismes coexistent
 * dans l'app (voir js/domain/resources.js et js/domain/links.js).
 */
function resourcesFor(type, id, { links, resourcesById, resources, labels }) {
  const ids = new Set();
  for (const link of links) {
    const [here, other] = link.a.type === type && link.a.id === id ? [link.a, link.b] : link.b.type === type && link.b.id === id ? [link.b, link.a] : [null, null];
    if (here && other.type === "Resource") ids.add(other.id);
  }
  if (type === "Project" || type === "Task") {
    const field = type === "Project" ? "projectIds" : "taskIds";
    for (const r of resources) if ((r[field] || []).includes(id)) ids.add(r.id);
  }
  return [...ids]
    .map((rid) => resourcesById.get(rid))
    .filter(Boolean)
    .map((r) => ({ title: r.title || "(sans titre)", url: r.url || "", location: r.location || "", typeLabel: labels.resourceType(r.type) }))
    .sort((a, b) => a.title.localeCompare(b.title, "fr"));
}

function taskView(task, ctx) {
  const days = task.dueDate ? dateUtils.daysFromToday(task.dueDate) : null;
  const parent = task.parentTaskId ? ctx.tasksById.get(task.parentTaskId) : null;
  const project = task.projectId ? ctx.projectsById.get(task.projectId) : null;
  return {
    id: task.id,
    title: task.title || "(sans titre)",
    description: (task.description || "").trim(),
    status: task.status,
    statusLabel: ctx.labels.taskStatus(task.status),
    priority: task.priority || "",
    priorityLabel: task.priority && task.priority !== "normale" ? ctx.labels.priority(task.priority) : "", // champ historique : toujours "normale" tant qu'aucun écran ne le modifie
    dueDate: task.dueDate || null,
    late: days !== null && days < 0,
    daysLate: days !== null && days < 0 ? -days : 0,
    daysUntilDue: days,
    waitingOn: (task.waitingOn || "").trim(),
    blocked: !!task.isBlocked,
    successCriteria: (task.successCriteria || "").trim(),
    projectId: task.projectId || null,
    projectName: project ? project.name : "",
    projectClosed: !!project && project.status !== "active",
    parentTitle: parent ? parent.title : "",
    notes: notesOf(task),
    ...checklistOf(task),
    resources: resourcesFor("Task", task.id, ctx),
  };
}

function compareTasks(a, b) {
  if (a.late !== b.late) return a.late ? -1 : 1;
  return dueSortKey(a.dueDate) - dueSortKey(b.dueDate) || a.title.localeCompare(b.title, "fr");
}

function followUpView(f, ctx) {
  const controlDays = f.controlDate ? dateUtils.daysFromToday(f.controlDate) : null;
  const dueDays = f.dueDate ? dateUtils.daysFromToday(f.dueDate) : null;
  const project = f.projectId ? ctx.projectsById.get(f.projectId) : null;
  return {
    id: f.id,
    title: f.title || "(sans titre)",
    direction: f.direction,
    status: f.status,
    statusLabel: ctx.labels.followUpStatus(f.status),
    category: f.category || null,
    categoryLabel: f.category ? ctx.labels.category(f.category) : "",
    dueDate: f.dueDate || null,
    dueLate: dueDays !== null && dueDays < 0,
    controlDate: f.controlDate || null,
    controlLate: controlDays !== null && controlDays < 0,
    expectedResult: (f.expectedResult || "").trim(),
    description: (f.description || "").trim(),
    successCriteria: (f.successCriteria || "").trim(),
    notable: f.notable || null,
    notableReason: (f.notableReason || "").trim(),
    projectName: project ? project.name : "",
    notes: notesOf(f),
    ...checklistOf(f),
    resources: resourcesFor("FollowUp", f.id, ctx),
  };
}

function soonestKey(fu) {
  return Math.min(dueSortKey(fu.controlDate), dueSortKey(fu.dueDate));
}

function objectiveView(o, ctx) {
  const entriesTotal = (o.entries || []).length;
  const lastEntries = [...(o.entries || [])]
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .slice(0, 3)
    .map((e) => ({ date: formatDateFr(e.date), note: (e.note || "").trim(), nextSteps: (e.nextSteps || "").trim() }));
  return {
    id: o.id,
    title: o.title || "(sans titre)",
    period: o.period || "",
    scopeLabel: o.scope ? ctx.labels.objectiveScope(o.scope) : "",
    description: (o.description || "").trim(),
    actionPlan: (o.actionPlan || "").trim(),
    watchPoints: (o.watchPoints || "").trim(),
    indicators: (o.indicators || []).map((i) => ({ label: i.label || "(indicateur)", target: i.target || "", statusLabel: i.status ? ctx.labels.indicatorStatus(i.status) : "" })),
    lastEntries,
    entriesTotal,
  };
}

/**
 * @param {Object} data - { projects, tasks, followUps, people, objectives, links, resources }
 * @param {Object} [options]
 * @param {string[]|null} [options.personIds] - personnes retenues (null = toute l'équipe).
 * @param {boolean} [options.includePersonNotes=false] - notes PRIVÉES sur la personne (champ
 *   "notes" et journal de la fiche Personne). Jamais incluses sans demande explicite.
 * @param {boolean} [options.includeObjectives=true] - objectifs non atteints de la personne.
 * @param {string[]} [options.excludedProjectIds] - projets à exclure (avec leurs tâches, suivis et objectifs).
 * @param {Object} labels - fonctions de libellé (statuts, priorités...) injectées par l'appelant :
 *   garde ce module pur (les constantes d'origine vivent dans des modules qui touchent le stockage).
 */
export function buildHandoverData(data, options = {}, labels) {
  const { personIds = null, includePersonNotes = false, includeObjectives = true, excludedProjectIds = [] } = options;
  // Projets exclus à la demande de Charles-Henri (27/10/2026 : "exclure des projets plus perso comme
  // le CSE de l'export") : le projet ET tout ce qui s'y rattache (tâches, suivis d'équipe, objectifs)
  // sortent des trois fichiers — rien ne doit fuiter par un autre chemin.
  const excluded = new Set(excludedProjectIds);
  const projects = (data.projects || []).filter((p) => !excluded.has(p.id));
  const tasks = (data.tasks || []).filter((t) => !t.projectId || !excluded.has(t.projectId));
  data = {
    ...data,
    followUps: (data.followUps || []).filter((f) => !f.projectId || !excluded.has(f.projectId)),
    objectives: (data.objectives || []).filter((o) => !o.projectId || !excluded.has(o.projectId)),
  };
  const resources = data.resources || [];
  const ctx = {
    labels,
    links: data.links || [],
    resources,
    resourcesById: new Map(resources.map((r) => [r.id, r])),
    tasksById: new Map(tasks.map((t) => [t.id, t])),
    projectsById: new Map(projects.map((p) => [p.id, p])),
  };

  const openTasks = tasks.filter((t) => t.status !== "done");
  const activeProjects = projects.filter((p) => p.status === "active");
  const activeProjectIds = new Set(activeProjects.map((p) => p.id));

  const projectViews = [...activeProjects]
    .sort((a, b) => (a.order ?? a.createdAt ?? 0) - (b.order ?? b.createdAt ?? 0))
    .map((p) => {
      const own = tasks.filter((t) => t.projectId === p.id);
      const done = own.filter((t) => t.status === "done").length;
      const parts = p.parts || [];
      return {
        id: p.id,
        name: p.name || "(sans nom)",
        critical: !!p.critical,
        category: p.category || "",
        objective: (p.objective || "").trim(),
        successCriteria: (p.successCriteria || "").trim(),
        progress: { done, total: own.length, percent: own.length ? Math.round((done / own.length) * 100) : null },
        partsDone: parts.filter((x) => x.status === "done").length,
        partsTotal: parts.length,
        parts: parts
          .filter((x) => x.status !== "done")
          .map((x) => ({ label: x.label, statusLabel: labels.partStatus(x.status), notes: notesOf(x) })),
        notes: notesOf(p),
        tasks: openTasks.filter((t) => t.projectId === p.id).map((t) => taskView(t, ctx)).sort(compareTasks),
        resources: resourcesFor("Project", p.id, ctx),
      };
    });

  // Tâches sans projet, ou rattachées à un projet clos/archivé/supprimé : rien ne doit disparaître.
  const looseTasks = openTasks.filter((t) => !t.projectId || !activeProjectIds.has(t.projectId)).map((t) => taskView(t, ctx)).sort(compareTasks);

  const allOpenTaskViews = [...projectViews.flatMap((p) => p.tasks), ...looseTasks];
  const tasksLate = allOpenTaskViews.filter((t) => t.late).length;
  const due7 = allOpenTaskViews.filter((t) => t.daysUntilDue !== null && t.daysUntilDue >= 0 && t.daysUntilDue <= 7).length;
  const due30 = allOpenTaskViews.filter((t) => t.daysUntilDue !== null && t.daysUntilDue >= 0 && t.daysUntilDue <= 30).length;
  const allPriorities = allOpenTaskViews.filter((t) => t.late || (t.daysUntilDue !== null && t.daysUntilDue <= 7)).sort(compareTasks);
  const PRIORITIES_LIMIT = 15;
  const priorities = allPriorities.slice(0, PRIORITIES_LIMIT);

  const selected = personIds ? new Set(personIds) : null;
  const team = (data.people || []).filter((p) => p.type !== "manager" && (!selected || selected.has(p.id)));
  const peopleViews = [...team]
    .sort((a, b) => (a.order ?? a.createdAt ?? 0) - (b.order ?? b.createdAt ?? 0))
    .map((person) => {
      const own = (data.followUps || [])
        .filter((f) => f.personId === person.id && f.status !== "done" && !f.hiddenFromPrep)
        .map((f) => followUpView(f, ctx))
        .sort((a, b) => soonestKey(a) - soonestKey(b));
      return {
        id: person.id,
        name: person.name || "(sans nom)",
        role: person.role || "",
        team: person.team || "",
        waitingOn: own.filter((f) => f.direction !== "to_tell"),
        toTell: own.filter((f) => f.direction === "to_tell"),
        objectives: includeObjectives
          ? (data.objectives || []).filter((o) => o.personId === person.id && o.status !== "done").map((o) => objectiveView(o, ctx))
          : [],
        privateNotes: includePersonNotes
          ? { notes: (person.notes || "").trim(), journal: [...(person.notesLog || [])].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).map((n) => ({ date: formatDateFr(n.createdAt), text: (n.text || "").trim() })).filter((n) => n.text) }
          : null,
        lateCount: own.filter((f) => f.controlLate || f.dueLate).length,
      };
    });

  return {
    summary: {
      projectsCount: projectViews.length,
      tasksCount: allOpenTaskViews.length,
      tasksLate,
      due7,
      due30,
      followUpsCount: peopleViews.reduce((n, p) => n + p.waitingOn.length + p.toTell.length, 0),
      followUpsLate: peopleViews.reduce((n, p) => n + p.lateCount, 0),
      peopleCount: peopleViews.length,
    },
    priorities,
    prioritiesTotal: allPriorities.length,
    projects: projectViews,
    looseTasks,
    people: peopleViews,
  };
}

// Caractères que la police PDF (Helvetica de base) ne sait pas dessiner : sans traitement ils
// s'impriment en "?" (revue du 27/10/2026 : flèches, espaces fines insécables des claviers
// mobiles, symboles). Équivalents simples quand ils existent, sinon suppression (émojis compris).
const SPACE_LIKE = /[\u2000-\u200A\u202F\u205F\u3000\u00AD\u200B\u2060]/g;
const REPLACEMENTS = { "→": "->", "←": "<-", "↔": "<->", "⇒": "=>", "≥": ">=", "≤": "<=", "≠": "!=", "≈": "~", "−": "-", "‑": "-", "‒": "-", "✓": "", "✔": "", "✗": "x", "✘": "x", "★": "*", "☆": "*", "●": "-", "▪": "-", "■": "-", "◦": "-", "‣": "-", "※": "*" };
const UNSUPPORTED_GLYPHS = /[\u{1F000}-\u{1FFFF}\u2190-\u21FF\u2300-\u23FF\u25A0-\u27BF\u2900-\u297F\u2B00-\u2BFF\uFE00-\uFE0F\u200C\u200D]/gu;
const WIN_ANSI_EXTRA = new Set([0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178]);
export function pdfText(value) {
  let text = String(value ?? "").replace(SPACE_LIKE, " ");
  text = text.replace(/[→←↔⇒≥≤≠≈−‑‒✓✔✗✘★☆●▪■◦‣※]/g, (c) => REPLACEMENTS[c] ?? "");
  text = text.replace(UNSUPPORTED_GLYPHS, "");
  // Dernier filet : tout caractère encore hors Latin-1/Windows-1252 serait imprimé en "?".
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code === 10 || code === 9 || (code >= 32 && code <= 255) || WIN_ANSI_EXTRA.has(code)) out += ch === "\t" ? " " : ch;
  }
  return out.replace(/[ \t]{2,}/g, " ").replace(/ +\n/g, "\n").trim();
}

function joinNotes(notes) {
  return notes.map((n) => (n.date ? `${n.date} : ${n.text}` : n.text)).join("\n");
}

function joinResources(resources) {
  return resources.map((r) => `${r.title}${r.url ? " : " + r.url : r.location ? " (" + r.location + ")" : ""}`).join("\n");
}

// ─── Texte explicatif pour le destinataire du dossier (le chef) ─────────────────────────────────
// Rédigé en tutoiement (choix de Charles-Henri, 27/10/2026). Source unique : la page « Comment lire
// ce dossier » du PDF global ET le message d'accompagnement copiable sur l'écran Passation.
// Garder ces textes alignés avec ce que les PDF/Excel contiennent réellement (voir handoverExport.js).
export const HANDOVER_GUIDE = {
  title: "Comment lire ce dossier",
  intro:
    "Ce dossier te permet de reprendre mes sujets en cours pendant mon absence. Il ne contient que ce qui n'est pas terminé, tel que c'était au jour de son édition (date en première page). Il est composé de trois documents complémentaires.",
  documents: [
    {
      title: "1. Le dossier global (ce PDF)",
      text:
        "C'est la vue d'ensemble. Il contient une synthèse chiffrée, les tâches à traiter en priorité (en retard ou à échéance sous 7 jours), puis chaque projet en cours : avancement, objectif, critère de réussite, sous-parties non terminées, notes, et les tâches non terminées avec leur statut, leur échéance, ce que j'attends et de qui, ce qu'il reste à faire dans leur checklist et les ressources associées (liens cliquables). Il se termine par les tâches qui ne sont rattachées à aucun projet. Il ne contient pas le détail du suivi de chaque personne de l'équipe.",
    },
    {
      title: "2. Les fiches de l'équipe (un PDF par personne, confidentielles)",
      text:
        "Une fiche par membre de l'équipe : ce que la personne devait faire et pour quand (échéance, prochain contrôle, résultat attendu, notes de suivi), ce que je devais lui transmettre ou lui fournir, et ses objectifs en cours avec les derniers suivis. Ces fiches contiennent des informations sur des personnes : à ne consulter que toi et à ne partager qu'avec les personnes habilitées.",
    },
    {
      title: "3. Le tableau Excel",
      text:
        "Une ligne par sujet non terminé (projet, sous-partie, tâche, suivi d'équipe, objectif), avec statut, échéance, prochain contrôle, retard, notes, checklist et liens. Tu peux filtrer et trier les colonnes. Les deux dernières colonnes, « Qui reprend ? » et « Commentaire », sont volontairement vides : elles servent à répartir les sujets et à noter tes remarques.",
    },
  ],
  readingTitle: "Comment lire les mentions",
  reading: [
    "« retard N j » : l'échéance est dépassée depuis N jours. Les éléments en retard sont en rouge.",
    "« En attente de » : ce que j'attends (une personne, un fournisseur, une référence de commande ou de ticket). « non précisé » signifie que je ne l'avais pas renseigné.",
    "« Prochain contrôle » : la date à laquelle je comptais vérifier ou relancer. « À lui dire avant le » : la date limite pour transmettre une information à la personne.",
    "« Reste à faire » : les étapes de la checklist qui ne sont pas encore cochées.",
  ],
  excludedTitle: "Ce qui ne figure pas dans ces documents",
  excluded:
    "Les sujets terminés, ceux que j'avais masqués du point de suivi, mes notes privées sur les personnes (sauf mention contraire) et les projets sans rapport avec ton périmètre que j'ai volontairement écartés. Quand une liste est raccourcie, c'est indiqué (par exemple « les 15 plus urgentes sur 20 ») : l'intégralité est dans le tableau Excel.",
  startTitle: "Par où commencer",
  start:
    "Lis d'abord la synthèse et les priorités qui suivent, ouvre ensuite le tableau Excel pour répartir les sujets (colonne « Qui reprend ? »), puis consulte les fiches de l'équipe pour les points à traiter avec chaque personne.",
};

/** Message d'accompagnement prêt à coller dans un mail (texte brut). `withTeam`/`withExcel` adaptent
 *  la liste aux documents réellement joints. */
export function buildCoverMessage({ withTeam = true, withExcel = true } = {}) {
  const docs = ["- le dossier global (PDF) : synthèse, priorités, projets en cours avec avancement, notes, échéances, tâches et ressources associées, tâches hors projet"];
  if (withTeam) docs.push("- les fiches de l'équipe (un PDF par personne, confidentielles) : ce que chacun devait faire et pour quand, ce que je devais leur transmettre, notes de suivi et objectifs en cours");
  if (withExcel) docs.push("- le tableau Excel : une ligne par sujet non terminé, filtrable, avec deux colonnes vides (« Qui reprend ? » et « Commentaire ») pour répartir les sujets");
  return [
    "Bonjour,",
    "",
    "Tu trouveras ci-joint le dossier de passation de mes sujets en cours. Il ne contient que ce qui n'est pas terminé, à la date d'édition indiquée en première page :",
    ...docs,
    "",
    "Pour t'y retrouver : la page « Comment lire ce dossier » au début du PDF global explique chaque document et les mentions utilisées (retard, « En attente de », prochain contrôle). Je te conseille de commencer par la synthèse et les priorités, puis de répartir les sujets avec l'Excel.",
    "",
    "Les fiches de l'équipe contiennent des informations sur des personnes : merci de ne les partager qu'avec les personnes habilitées.",
    "",
    "Cordialement",
  ].join("\n");
}

export const HANDOVER_COLUMNS = [
  { key: "type", header: "Type", width: 24 },
  { key: "project", header: "Projet", width: 24 },
  { key: "person", header: "Personne", width: 20 },
  { key: "title", header: "Titre", width: 40 },
  { key: "status", header: "Statut", width: 16 },
  { key: "waitingOn", header: "En attente de (référence)", width: 30 },
  { key: "due", header: "Échéance", width: 12 },
  { key: "control", header: "Prochain contrôle", width: 14 },
  { key: "late", header: "En retard", width: 10 },
  { key: "detail", header: "Détail", width: 50 },
  { key: "notes", header: "Notes et suivi", width: 60 },
  { key: "checklist", header: "Reste à faire (checklist)", width: 36 },
  { key: "resources", header: "Ressources (liens)", width: 60 },
  { key: "owner", header: "Qui reprend ?", width: 18 },
  { key: "comment", header: "Commentaire", width: 30 },
];

function detailOf(parts) {
  return parts.filter(Boolean).join("\n");
}

/** Lignes du classeur Excel : une ligne par projet, sous-partie, tâche, suivi d'équipe ou objectif
 *  non terminé, avec deux colonnes vides ("Qui reprend ?", "Commentaire") à remplir par le lecteur.
 *  Chaque ligne est écrite par NOM de colonne (voir `row`) : ajouter ou réordonner une colonne ne
 *  peut plus décaler silencieusement les valeurs. */
export function buildHandoverRows(handover) {
  const rows = [];
  const yesNo = (v) => (v ? "Oui" : "Non");
  const row = (values) => HANDOVER_COLUMNS.map((c) => values[c.key] ?? "");
  const taskRow = (t, type, projectName) =>
    row({
      type,
      project: projectName,
      title: t.title,
      status: t.statusLabel + (t.blocked ? " (bloquée)" : ""),
      waitingOn: t.waitingOn || (t.status === "waiting" ? "non précisé" : ""),
      due: formatDateFr(t.dueDate),
      late: yesNo(t.late),
      detail: detailOf([t.description, t.successCriteria ? `Critère de réussite : ${t.successCriteria}` : "", t.parentTitle ? `Sous-tâche de : ${t.parentTitle}` : ""]),
      notes: joinNotes(t.notes),
      checklist: t.checklistOpen.join("\n"),
      resources: joinResources(t.resources),
    });
  for (const p of handover.projects) {
    const progress = p.progress.percent === null ? "aucune tâche" : `${p.progress.percent} % (${p.progress.done}/${p.progress.total} tâches terminées)`;
    rows.push(
      row({
        type: "Projet",
        project: p.name,
        title: p.name + (p.critical ? " (critique)" : ""),
        status: "Actif",
        detail: detailOf([p.objective ? `Objectif : ${p.objective}` : "", p.successCriteria ? `Critère de réussite : ${p.successCriteria}` : "", `Avancement : ${progress}`]),
        notes: joinNotes(p.notes),
        resources: joinResources(p.resources),
      })
    );
    for (const part of p.parts) rows.push(row({ type: "Sous-partie de projet", project: p.name, title: part.label, status: part.statusLabel, notes: joinNotes(part.notes) }));
    for (const t of p.tasks) rows.push(taskRow(t, "Tâche", p.name));
  }
  for (const t of handover.looseTasks) rows.push(taskRow(t, t.projectName ? "Tâche (projet clos)" : "Tâche hors projet", t.projectName));
  for (const person of handover.people) {
    const fuRow = (f, type) =>
      row({
        type,
        project: f.projectName,
        person: person.name,
        title: f.title,
        status: f.statusLabel,
        due: formatDateFr(f.dueDate),
        control: formatDateFr(f.controlDate),
        late: yesNo(f.controlLate || f.dueLate),
        detail: detailOf([f.categoryLabel, f.description, f.expectedResult ? `Résultat attendu : ${f.expectedResult}` : "", f.successCriteria ? `Critère de réussite : ${f.successCriteria}` : ""]),
        notes: joinNotes(f.notes),
        checklist: f.checklistOpen.join("\n"),
        resources: joinResources(f.resources),
      });
    for (const f of person.waitingOn) rows.push(fuRow(f, "Suivi équipe : attendu de la personne"));
    for (const f of person.toTell) rows.push(fuRow(f, "Suivi équipe : à lui transmettre"));
    for (const o of person.objectives) {
      rows.push(
        row({
          type: "Objectif en cours",
          person: person.name,
          title: o.title,
          status: "En cours",
          detail: detailOf([o.period ? `Campagne : ${o.period}` : "", o.description, ...o.indicators.map((i) => `Indicateur : ${i.label}${i.target ? " (cible : " + i.target + ")" : ""}${i.statusLabel ? " : " + i.statusLabel : ""}`)]),
          notes: o.lastEntries.map((e) => [e.date, e.note, e.nextSteps ? `Prévu : ${e.nextSteps}` : ""].filter(Boolean).join(" : ")).join("\n"),
        })
      );
    }
  }
  return rows;
}
