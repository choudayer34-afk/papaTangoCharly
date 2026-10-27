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
  };
}

/**
 * @param {Object} data - { projects, tasks, followUps, people, objectives, links, resources }
 * @param {Object} [options]
 * @param {string[]|null} [options.personIds] - personnes retenues (null = toute l'équipe).
 * @param {boolean} [options.includePersonNotes=false] - notes PRIVÉES sur la personne (champ
 *   "notes" et journal de la fiche Personne). Jamais incluses sans demande explicite.
 * @param {boolean} [options.includeObjectives=true] - objectifs non atteints de la personne.
 * @param {Object} labels - fonctions de libellé (statuts, priorités...) injectées par l'appelant :
 *   garde ce module pur (les constantes d'origine vivent dans des modules qui touchent le stockage).
 */
export function buildHandoverData(data, options = {}, labels) {
  const { personIds = null, includePersonNotes = false, includeObjectives = true } = options;
  const projects = data.projects || [];
  const tasks = data.tasks || [];
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
  const priorities = allOpenTaskViews
    .filter((t) => t.late || (t.daysUntilDue !== null && t.daysUntilDue <= 7))
    .sort(compareTasks)
    .slice(0, 12);

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
    projects: projectViews,
    looseTasks,
    people: peopleViews,
  };
}

function joinNotes(notes) {
  return notes.map((n) => (n.date ? `${n.date} : ${n.text}` : n.text)).join("\n");
}

function joinResources(resources) {
  return resources.map((r) => `${r.title}${r.url ? " : " + r.url : r.location ? " (" + r.location + ")" : ""}`).join("\n");
}

export const HANDOVER_COLUMNS = [
  { header: "Type", width: 22 },
  { header: "Projet", width: 24 },
  { header: "Personne", width: 20 },
  { header: "Titre", width: 40 },
  { header: "Statut", width: 16 },
  { header: "Priorité", width: 10 },
  { header: "Échéance", width: 12 },
  { header: "Prochain contrôle", width: 14 },
  { header: "En retard", width: 10 },
  { header: "Détail", width: 50 },
  { header: "Notes et suivi", width: 60 },
  { header: "Reste à faire (checklist)", width: 36 },
  { header: "Ressources (liens)", width: 60 },
  { header: "Qui reprend ?", width: 18 },
  { header: "Commentaire", width: 30 },
];

function detailOf(parts) {
  return parts.filter(Boolean).join("\n");
}

/** Lignes du classeur Excel : une ligne par projet, sous-partie, tâche, suivi d'équipe ou objectif
 *  non terminé, avec deux colonnes vides ("Qui reprend ?", "Commentaire") à remplir par le lecteur. */
export function buildHandoverRows(handover) {
  const rows = [];
  const yesNo = (v) => (v ? "Oui" : "Non");
  const taskRow = (t, typeLabel, projectName) => [
    typeLabel,
    projectName,
    "",
    t.title,
    t.statusLabel + (t.blocked ? " (bloquée)" : ""),
    t.priorityLabel,
    formatDateFr(t.dueDate),
    "",
    yesNo(t.late),
    detailOf([t.description, t.waitingOn ? `En attente de : ${t.waitingOn}` : "", t.successCriteria ? `Critère de réussite : ${t.successCriteria}` : "", t.parentTitle ? `Sous-tâche de : ${t.parentTitle}` : ""]),
    joinNotes(t.notes),
    t.checklistOpen.join("\n"),
    joinResources(t.resources),
    "",
    "",
  ];
  for (const p of handover.projects) {
    const progress = p.progress.percent === null ? "aucune tâche" : `${p.progress.percent} % (${p.progress.done}/${p.progress.total} tâches terminées)`;
    rows.push([
      "Projet",
      p.name,
      "",
      p.name + (p.critical ? " (critique)" : ""),
      "Actif",
      "",
      "",
      "",
      "",
      detailOf([p.objective ? `Objectif : ${p.objective}` : "", p.successCriteria ? `Critère de réussite : ${p.successCriteria}` : "", `Avancement : ${progress}`]),
      joinNotes(p.notes),
      "",
      joinResources(p.resources),
      "",
      "",
    ]);
    for (const part of p.parts) rows.push(["Sous-partie de projet", p.name, "", part.label, part.statusLabel, "", "", "", "", "", joinNotes(part.notes), "", "", "", ""]);
    for (const t of p.tasks) rows.push(taskRow(t, "Tâche", p.name));
  }
  for (const t of handover.looseTasks) rows.push(taskRow(t, t.projectName ? "Tâche (projet clos)" : "Tâche hors projet", t.projectName));
  for (const person of handover.people) {
    const fuRow = (f, typeLabel) => [
      typeLabel,
      f.projectName,
      person.name,
      f.title,
      f.statusLabel,
      "",
      formatDateFr(f.dueDate),
      formatDateFr(f.controlDate),
      yesNo(f.controlLate || f.dueLate),
      detailOf([f.categoryLabel, f.description, f.expectedResult ? `Résultat attendu : ${f.expectedResult}` : "", f.successCriteria ? `Critère de réussite : ${f.successCriteria}` : ""]),
      joinNotes(f.notes),
      f.checklistOpen.join("\n"),
      joinResources(f.resources),
      "",
      "",
    ];
    for (const f of person.waitingOn) rows.push(fuRow(f, "Suivi équipe : attendu de la personne"));
    for (const f of person.toTell) rows.push(fuRow(f, "Suivi équipe : à lui transmettre"));
    for (const o of person.objectives) {
      rows.push([
        "Objectif en cours",
        "",
        person.name,
        o.title,
        "En cours",
        "",
        "",
        "",
        "",
        detailOf([o.period ? `Campagne : ${o.period}` : "", o.description, ...o.indicators.map((i) => `Indicateur : ${i.label}${i.target ? " (cible : " + i.target + ")" : ""}${i.statusLabel ? " : " + i.statusLabel : ""}`)]),
        o.lastEntries.map((e) => [e.date, e.note, e.nextSteps ? `Prévu : ${e.nextSteps}` : ""].filter(Boolean).join(" : ")).join("\n"),
        "",
        "",
        "",
        "",
      ]);
    }
  }
  return rows;
}
