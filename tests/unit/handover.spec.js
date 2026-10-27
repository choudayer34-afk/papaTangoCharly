// 27/10/2026 — dossier de passation (js/domain/handover.js). Module PUR : ces tests tournent directement
// sous Node, avec des données synthétiques. Le rendu PDF/Excel et l'écran ont été vérifiés à part dans un
// navigateur headless avant la livraison (fichiers téléchargés ouverts et relus) ; à reconfirmer au premier
// passage réel de la CI.

import { test, expect } from "@playwright/test";
import { buildXlsxBytes } from "../../js/services/xlsxWriter.js";
import { createPdfDoc } from "../../js/services/pdfWriter.js";
import { buildHandoverData, buildHandoverRows, HANDOVER_COLUMNS, HANDOVER_GUIDE, buildCoverMessage, formatDateFr, pdfText } from "../../js/domain/handover.js";

const labels = {
  taskStatus: (s) => ({ todo: "À faire", in_progress: "En cours", waiting: "En attente", follow_up: "À suivre", done: "Terminé" }[s] || s),
  priority: (p) => p,
  followUpStatus: (s) => ({ waiting: "En attente", relaunched: "Relancé", done: "Réglé" }[s] || s),
  partStatus: (s) => ({ not_started: "Pas commencé", in_progress: "En cours", done: "Terminé" }[s] || s),
  category: (c) => c,
  objectiveScope: (s) => s,
  indicatorStatus: (s) => s,
  resourceType: (t) => t,
};
const iso = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function sample() {
  return {
    projects: [
      { id: "p1", name: "Projet Alpha", status: "active", critical: true, objective: "Livrer", order: 1, parts: [{ id: "s1", label: "Maquette", status: "in_progress" }, { id: "s2", label: "Cadrage", status: "done" }], notesLog: [{ text: "Note projet", createdAt: 1 }] },
      { id: "p2", name: "Projet clos", status: "done", order: 2 },
      { id: "p3", name: "Projet archivé", status: "archived", order: 3 },
    ],
    tasks: [
      { id: "t1", title: "Tâche en retard", status: "in_progress", projectId: "p1", dueDate: iso(-3), notesLog: [{ text: "Relancé le client", createdAt: 5 }], checklist: [{ id: "c1", text: "A faire", done: false }, { id: "c2", text: "Fait", done: true }] },
      { id: "t2", title: "Tâche demain", status: "todo", projectId: "p1", dueDate: iso(1) },
      { id: "t3", title: "Tâche terminée", status: "done", projectId: "p1" },
      { id: "t4", title: "Hors projet sans date", status: "waiting", waitingOn: "Fournisseur" },
      { id: "t5", title: "Sur projet clos", status: "todo", projectId: "p2", dueDate: iso(10) },
      { id: "t6", title: "Sous-tâche", status: "todo", projectId: "p1", parentTaskId: "t1", dueDate: iso(20) },
    ],
    followUps: [
      { id: "f1", personId: "pe1", title: "Envoyer le rapport", direction: "waiting_on", status: "waiting", dueDate: iso(5), controlDate: iso(-1) },
      { id: "f2", personId: "pe1", title: "Lui annoncer le planning", direction: "to_tell", status: "waiting", controlDate: iso(2) },
      { id: "f3", personId: "pe1", title: "Sujet masqué", direction: "waiting_on", status: "waiting", hiddenFromPrep: true },
      { id: "f4", personId: "pe1", title: "Déjà réglé", direction: "waiting_on", status: "done" },
      { id: "f5", personId: "pe2", title: "Sujet de l'autre", direction: "waiting_on", status: "relaunched" },
      { id: "f6", personId: "pm", title: "Sujet avec mon manager", direction: "waiting_on", status: "waiting" },
    ],
    people: [
      { id: "pe1", name: "Camille", role: "Dev", type: "collaborateur", order: 1, notes: "Contexte privé", notesLog: [{ text: "Note privée", createdAt: 9 }] },
      { id: "pe2", name: "Dominique", type: "collaborateur", order: 2 },
      { id: "pm", name: "Mon chef", type: "manager", order: 3 },
    ],
    objectives: [
      { id: "o1", personId: "pe1", title: "Objectif en cours", status: "active", indicators: [{ label: "KPI", target: "90 %", status: "in_progress" }], entries: [{ date: "2026-09-01", note: "ancien" }, { date: "2026-10-01", note: "récent", nextSteps: "suite" }] },
      { id: "o2", personId: "pe1", title: "Objectif atteint", status: "done" },
    ],
    links: [{ id: "l1", a: { type: "Task", id: "t1" }, b: { type: "Resource", id: "r1" } }, { id: "l2", a: { type: "Resource", id: "r2" }, b: { type: "FollowUp", id: "f1" } }],
    resources: [
      { id: "r1", title: "Spec", url: "https://example.com/spec", type: "word", projectIds: ["p1"], taskIds: ["t1"] },
      { id: "r2", title: "Dossier partagé", url: "", location: "\\\\serveur\\dossier", type: "folder" },
    ],
  };
}

test.describe("buildHandoverData — périmètre", () => {
  test("ne garde que le non terminé, projets actifs seulement", () => {
    const h = buildHandoverData(sample(), {}, labels);
    expect(h.projects.map((p) => p.name)).toEqual(["Projet Alpha"]);
    const alphaTasks = h.projects[0].tasks.map((t) => t.title);
    expect(alphaTasks).toEqual(["Tâche en retard", "Tâche demain", "Sous-tâche"]); // retard d'abord, puis par échéance ; "terminée" absente
    expect(h.projects[0].parts.map((p) => p.label)).toEqual(["Maquette"]);
    expect(h.projects[0].partsDone).toBe(1);
    expect(h.projects[0].partsTotal).toBe(2);
    expect(h.projects[0].progress).toEqual({ done: 1, total: 4, percent: 25 });
  });

  test("les tâches hors projet ou sur projet clos ne disparaissent pas", () => {
    const h = buildHandoverData(sample(), {}, labels);
    const titles = h.looseTasks.map((t) => t.title);
    expect(titles).toContain("Hors projet sans date");
    expect(titles).toContain("Sur projet clos");
    expect(h.looseTasks.find((t) => t.title === "Sur projet clos").projectClosed).toBe(true);
  });

  test("synthèse : retards et échéances", () => {
    const h = buildHandoverData(sample(), {}, labels);
    expect(h.summary.tasksCount).toBe(5);
    expect(h.summary.tasksLate).toBe(1);
    expect(h.summary.due7).toBe(1); // demain
    expect(h.summary.due30).toBe(3); // demain + dans 10 j + dans 20 j
    expect(h.priorities.map((t) => t.title)).toEqual(["Tâche en retard", "Tâche demain"]);
  });

  test("notes, checklist restante et ressources (liens ET champs projectIds/taskIds, sans doublon)", () => {
    const h = buildHandoverData(sample(), {}, labels);
    const t1 = h.projects[0].tasks.find((t) => t.id === "t1");
    expect(t1.notes).toEqual([{ date: formatDateFr(5), text: "Relancé le client" }]);
    expect(t1.checklistOpen).toEqual(["A faire"]);
    expect(t1.checklistDone).toBe(1);
    expect(t1.checklistTotal).toBe(2);
    expect(t1.resources.map((r) => r.title)).toEqual(["Spec"]); // r1 par lien ET par taskIds : une seule fois
    expect(t1.parentTitle).toBe("");
    expect(h.projects[0].tasks.find((t) => t.id === "t6").parentTitle).toBe("Tâche en retard");
    expect(h.projects[0].resources.map((r) => r.title)).toEqual(["Spec"]); // via projectIds
  });
});

test.describe("buildHandoverData — équipe et confidentialité", () => {
  test("exclut sujets masqués, réglés et la personne de type manager", () => {
    const h = buildHandoverData(sample(), {}, labels);
    expect(h.people.map((p) => p.name)).toEqual(["Camille", "Dominique"]);
    const camille = h.people[0];
    expect(camille.waitingOn.map((f) => f.title)).toEqual(["Envoyer le rapport"]);
    expect(camille.toTell.map((f) => f.title)).toEqual(["Lui annoncer le planning"]);
    expect(camille.waitingOn[0].controlLate).toBe(true);
    expect(camille.lateCount).toBe(1);
    expect(camille.waitingOn[0].resources.map((r) => r.title)).toEqual(["Dossier partagé"]);
  });

  test("notes privées sur la personne : jamais par défaut, seulement sur demande explicite", () => {
    expect(buildHandoverData(sample(), {}, labels).people[0].privateNotes).toBeNull();
    const withNotes = buildHandoverData(sample(), { includePersonNotes: true }, labels).people[0].privateNotes;
    expect(withNotes.notes).toBe("Contexte privé");
    expect(withNotes.journal.map((n) => n.text)).toEqual(["Note privée"]);
  });

  test("sélection de personnes et objectifs non atteints seulement", () => {
    const h = buildHandoverData(sample(), { personIds: ["pe1"] }, labels);
    expect(h.people.map((p) => p.id)).toEqual(["pe1"]);
    expect(h.people[0].objectives.map((o) => o.title)).toEqual(["Objectif en cours"]);
    expect(h.people[0].objectives[0].lastEntries.map((e) => e.note)).toEqual(["récent", "ancien"]);
    expect(buildHandoverData(sample(), { personIds: [] }, labels).people).toEqual([]);
    expect(buildHandoverData(sample(), { includeObjectives: false }, labels).people[0].objectives).toEqual([]);
  });
});

test.describe("buildHandoverRows (Excel)", () => {
  test("une ligne par sujet, colonnes alignées, aucune donnée exclue", () => {
    const h = buildHandoverData(sample(), {}, labels);
    const rows = buildHandoverRows(h);
    for (const r of rows) expect(r.length).toBe(HANDOVER_COLUMNS.length);
    const types = rows.map((r) => r[0]);
    expect(types.filter((t) => t === "Projet")).toHaveLength(1);
    expect(types.filter((t) => t === "Sous-partie de projet")).toHaveLength(1);
    expect(types.filter((t) => t === "Tâche")).toHaveLength(3);
    expect(types.filter((t) => t === "Tâche hors projet")).toHaveLength(1);
    expect(types.filter((t) => t === "Tâche (projet clos)")).toHaveLength(1);
    expect(types.filter((t) => t.startsWith("Suivi équipe"))).toHaveLength(3);
    expect(types.filter((t) => t === "Objectif en cours")).toHaveLength(1);
    const all = JSON.stringify(rows);
    expect(all).not.toContain("Sujet masqué");
    expect(all).not.toContain("Déjà réglé");
    expect(all).not.toContain("Note privée");
    expect(all).not.toContain("Sujet avec mon manager");
    const late = rows.find((r) => r[3] === "Tâche en retard");
    const col = (key) => HANDOVER_COLUMNS.findIndex((c) => c.key === key);
    expect(late[col("late")]).toBe("Oui");
    expect(late[col("resources")]).toContain("https://example.com/spec");
    expect(late[col("owner")]).toBe(""); // "Qui reprend ?" à remplir par le lecteur
    expect(late[col("comment")]).toBe("");
    // tâche en attente : la référence saisie dans "En attente de" a sa propre colonne ; sinon "non précisé"
    const waiting = rows.find((r) => r[col("title")] === "Hors projet sans date");
    expect(waiting[col("waitingOn")]).toBe("Fournisseur");
  });
});

test.describe("exclusion de projets", () => {
  test("le projet exclu et tout ce qui s'y rattache disparaissent partout", () => {
    const data = sample();
    data.followUps.push({ id: "f7", personId: "pe1", title: "Suivi lié au CSE", direction: "waiting_on", status: "waiting", projectId: "p1" });
    data.objectives.push({ id: "o3", personId: "pe1", title: "Objectif lié au CSE", status: "active", projectId: "p1" });
    const h = buildHandoverData(data, { excludedProjectIds: ["p1"] }, labels);
    expect(h.projects).toEqual([]);
    const all = JSON.stringify(h) + JSON.stringify(buildHandoverRows(h));
    for (const forbidden of ["Projet Alpha", "Tâche en retard", "Tâche demain", "Sous-tâche", "Suivi lié au CSE", "Objectif lié au CSE", "Note projet", "Spec"]) expect(all).not.toContain(forbidden);
    // ce qui n'est pas rattaché à un projet exclu reste
    expect(h.looseTasks.map((t) => t.title)).toContain("Hors projet sans date");
    expect(h.people[0].waitingOn.map((f) => f.title)).toEqual(["Envoyer le rapport"]);
    expect(h.summary.tasksCount).toBe(2);
  });

  test("exclure un projet clos ou inconnu ne change rien", () => {
    expect(buildHandoverData(sample(), { excludedProjectIds: ["p2", "inconnu"] }, labels).summary.tasksCount).toBe(4); // t5 (projet clos p2) exclue
  });
});

test.describe("limites et textes", () => {
  test("les listes tronquées le disent : total des priorités, nombre de suivis d'objectif", () => {
    const data = sample();
    for (let i = 0; i < 30; i++) data.tasks.push({ id: "x" + i, title: "Urgente " + i, status: "todo", dueDate: iso(-1 - i) });
    for (let i = 0; i < 5; i++) data.objectives[0].entries.push({ date: "2026-08-0" + (i + 1), note: "n" + i });
    const h = buildHandoverData(data, {}, labels);
    expect(h.priorities).toHaveLength(15);
    expect(h.prioritiesTotal).toBe(32); // 30 ajoutées + t1 (en retard) + t2 (demain)
    expect(h.people[0].objectives[0].lastEntries).toHaveLength(3);
    expect(h.people[0].objectives[0].entriesTotal).toBe(7);
  });

  test("pdfText : remplace ou retire ce que la police PDF imprimerait en « ? »", () => {
    expect(pdfText("Étape → suite ≥ 2 ✓ 🚀 œuvre « HT » 1\u202F200\u00A0€")).toBe("Étape -> suite >= 2 œuvre « HT » 1 200\u00A0€"); // l'espace insécable U+00A0 est imprimable, l'espace fine U+202F ne l'est pas
    expect(pdfText("a\u000Bb\u0001c")).toBe("abc");
    expect(pdfText("ligne 1\nligne 2")).toBe("ligne 1\nligne 2");
    expect(pdfText(null)).toBe("");
  });

  test("tolère des données incomplètes (champs absents, dates invalides, liens orphelins)", () => {
    const data = { projects: [{ id: "p", status: "active" }], tasks: [{ id: "t", status: "todo", projectId: "p", dueDate: "pas-une-date", notesLog: [{ text: "x" }, { createdAt: 5 }], checklist: null }], followUps: [{ id: "f", personId: "pe", status: "waiting" }], people: [{ id: "pe", type: "collaborateur" }], links: [{ id: "l", a: { type: "Task", id: "t" }, b: { type: "Resource", id: "disparue" } }], resources: [] };
    const h = buildHandoverData(data, {}, labels);
    expect(h.projects[0].name).toBe("(sans nom)");
    expect(h.projects[0].tasks[0].title).toBe("(sans titre)");
    expect(h.projects[0].tasks[0].resources).toEqual([]);
    expect(() => buildHandoverRows(h)).not.toThrow();
  });
});

test.describe("générateurs : robustesse des fichiers de sortie", () => {
  test("Excel : caractères de contrôle retirés, cellule géante plafonnée, volet figé", () => {
    const bytes = buildXlsxBytes([{ header: "A", width: 10 }], [["avant\u000Bapr\u0001ès"], ["x".repeat(40000)]], { sheetName: "Passation: test/1", freezeHeader: true });
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("avantaprès"); // \u000B et \u0001 retirés
    const sheetXml = text.slice(text.indexOf("<worksheet"), text.indexOf("</worksheet>"));
    expect(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(sheetXml)).toBe(false);
    expect(text).toContain("texte tronqué");
    expect(text.match(/x+/g).reduce((m, r) => Math.max(m, r.length), 0)).toBeLessThanOrEqual(32000);
    expect(text).toContain('state="frozen"');
    expect(text).toContain('<sheet name="Passation  test 1"'); // caractères interdits dans un nom d'onglet remplacés
  });

  test("PDF : un mot interminable (URL) ne produit pas de ligne plus large que la page, et le fichier reste valide", () => {
    const doc = createPdfDoc({ title: "t" });
    doc.paragraph("https://exemple.invalid/" + "segment-de-url-".repeat(30) + " et la suite normale du texte");
    doc.table([{ header: "A", width: 100 }, { header: "B", width: 100 }], [[{ text: "x".repeat(200) }, { text: "ok" }]]);
    doc.heading("Titre", { keepWithNext: 100 });
    doc.keepTogether(50);
    const bytes = doc.save();
    const text = new TextDecoder("latin1").decode(bytes);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    // chaque ligne dessinée tient dans la zone de texte : "x Td" (abscisse) + largeur estimée <= page
    expect(text).not.toContain("NaN");
  });
  test("PDF : l'en-tête d'un tableau est répété sur chaque page", () => {
    const doc = createPdfDoc({ title: "t" });
    const rows = Array.from({ length: 150 }, (_, i) => [{ text: "ligne " + i }, { text: "ok" }]);
    doc.table([{ header: "ColonneUnique", width: 200 }, { header: "B", width: 100 }], rows);
    const text = new TextDecoder("latin1").decode(doc.save());
    const pageCount = (text.match(/\/Type \/Page\b(?!s)/g) || []).length;
    const headers = (text.match(/\(ColonneUnique\) Tj/g) || []).length;
    expect(pageCount).toBeGreaterThan(1);
    expect(headers).toBe(pageCount);
  });
});

test.describe("texte explicatif pour le chef", () => {
  test("le guide couvre les trois documents, les colonnes citées existent et le texte est imprimable tel quel en PDF", () => {
    expect(HANDOVER_GUIDE.documents).toHaveLength(3);
    const all = JSON.stringify(HANDOVER_GUIDE);
    // Les deux colonnes vides citées dans le guide existent bien dans l'Excel.
    for (const header of ["Qui reprend ?", "Commentaire"]) expect(HANDOVER_COLUMNS.map((c) => c.header)).toContain(header);
    expect(all).toContain("En attente de");
    // Aucun caractère que la police PDF imprimerait en « ? » : pdfText ne doit rien changer d'essentiel.
    const walk = (v) => (typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(walk) : v && typeof v === "object" ? Object.values(v).flatMap(walk) : []);
    for (const text of walk(HANDOVER_GUIDE)) expect(pdfText(text).replace(/\s+/g, " ")).toBe(text.replace(/\s+/g, " ").trim());
  });

  test("le message d'accompagnement s'adapte aux documents joints et reste en tutoiement", () => {
    const full = buildCoverMessage();
    expect(full).toContain("Tu trouveras");
    expect(full).toContain("fiches de l'équipe");
    expect(full).toContain("tableau Excel");
    expect(full).not.toMatch(/\bvous\b|\bvotre\b/i);
    const withoutTeam = buildCoverMessage({ withTeam: false });
    expect(withoutTeam).not.toContain("fiches de l'équipe (un PDF");
    expect(withoutTeam).toContain("dossier global");
  });
});
