// TEST-006/TEST-007 (AUDIT_TESTS.md), déclinés pour LOT 4B (TODO-010) — régression sur les
// nouvelles primitives d'écriture ciblée `storage.appendToArray()`/`storage.setFields()`
// (js/services/storage.js), qui remplacent `storage.update()` (lecture complète + réécriture
// complète du document) pour les mutations additives sans logique conditionnelle (`addNote`,
// `addChecklistItem`, `addOutlookMeeting`, `addPart` sur tasks.js/projects.js/followups.js ;
// `setWaitingNote` sur tasks.js).
//
// Le risque explicitement cité par TODO-010 dans TODO_TECHNIQUE.md est de "casser la file de
// sérialisation par document (CODE-021)" — TEST-006 existant (storage-update-queue.spec.js) ne
// couvre que `storage.update()` seul ; ce fichier vérifie spécifiquement le cas MIXTE qui n'existait
// pas avant ce lot : un `appendToArray()`/`setFields()` et un `update()` concurrents sur le MÊME
// document. Les deux passent désormais par la même file interne (`enqueue()`, voir storage.js) —
// ce test prouve qu'aucune écriture n'est perdue dans ce scénario mixte, exactement comme
// storage-update-queue.spec.js le prouve déjà pour deux `update()` concurrents.
//
// AVERTISSEMENT (21/09/2026) : écrit et relu manuellement à partir du code réel
// (js/services/storage.js, js/domain/tasks.js/projects.js/followups.js), mais jamais exécuté dans
// l'environnement où il a été rédigé (registre npm bloqué, voir tests/README.md). À reconfirmer au
// premier lancement réel.

import { test, expect } from "@playwright/test";
import { E2E_TEST_USER } from "../e2e/global-setup.js";

test.describe("TEST-006/TEST-007 (déclinés) — écritures ciblées appendToArray/setFields (LOT 4B, TODO-010)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/support/harness.html");
    await page.waitForFunction(() => window.__pilotageTestApiReady === true);
    await page.evaluate(async ({ email, password }) => {
      await window.__pilotageTestApi.firebaseApi.signInEmail(email, password);
    }, E2E_TEST_USER);
    await page.waitForFunction(() => !!window.__pilotageTestApi.firebaseApi.getCurrentUser());
  });

  test("storage.appendToArray : ajoute l'élément sans effacer les autres champs du document", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { storageApi } = window.__pilotageTestApi;
      const id = `test-lot4b-append-${Date.now()}`;
      await storageApi.put("tasks", { id, title: "Départ (test LOT 4B)", notesLog: [], priority: "haute" });

      const item1 = { id: "n1", text: "Première note", createdAt: 1 };
      const item2 = { id: "n2", text: "Deuxième note", createdAt: 2 };
      await storageApi.appendToArray("tasks", id, "notesLog", item1);
      await storageApi.appendToArray("tasks", id, "notesLog", item2);

      const final = await storageApi.get("tasks", id);
      return { notesLog: final.notesLog, title: final.title, priority: final.priority, hasUpdatedAt: typeof final.updatedAt === "number" };
    });
    expect(result.notesLog).toEqual([
      { id: "n1", text: "Première note", createdAt: 1 },
      { id: "n2", text: "Deuxième note", createdAt: 2 },
    ]);
    // Les champs non concernés par l'écriture ciblée (title, priority) doivent survivre intacts —
    // c'est précisément ce qu'apporte `updateDoc()` par rapport à un `setDoc()` complet.
    expect(result.title).toBe("Départ (test LOT 4B)");
    expect(result.priority).toBe("haute");
    expect(result.hasUpdatedAt).toBe(true);
  });

  test("storage.setFields : remplace uniquement les champs donnés, sans toucher au reste du document", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { storageApi } = window.__pilotageTestApi;
      const id = `test-lot4b-setfields-${Date.now()}`;
      await storageApi.put("tasks", { id, title: "Départ (test LOT 4B)", waitingOn: "", status: "waiting" });

      await storageApi.setFields("tasks", id, { waitingOn: "Réponse de Jean" });

      const final = await storageApi.get("tasks", id);
      return { waitingOn: final.waitingOn, title: final.title, status: final.status };
    });
    expect(result.waitingOn).toBe("Réponse de Jean");
    expect(result.title).toBe("Départ (test LOT 4B)");
    expect(result.status).toBe("waiting");
  });

  test("appendToArray() et update() concurrents sur le MÊME document restent sérialisés : aucune écriture perdue (CODE-021, cas mixte)", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { storageApi } = window.__pilotageTestApi;
      const id = `test-lot4b-mixed-race-${Date.now()}`;
      await storageApi.put("tasks", { id, title: "Départ", notesLog: [], counter: 0 });

      // Deux écritures concurrentes sur le MÊME document : l'une via la nouvelle primitive
      // ciblée (appendToArray, sans lecture préalable), l'autre via update() classique (lecture
      // complète + patch). Sans la sérialisation partagée, update() pourrait lire l'état AVANT
      // que appendToArray() n'ait écrit sa note, puis réécrire par-dessus en l'effaçant
      // silencieusement — exactement la classe de bug que CODE-021 a corrigée pour deux update()
      // concurrents, ici testée pour la combinaison MIXTE introduite par ce lot.
      await Promise.all([
        storageApi.appendToArray("tasks", id, "notesLog", { id: "race-note", text: "Ajoutée pendant la course", createdAt: 1 }),
        storageApi.update("tasks", id, (current) => ({ counter: (current.counter || 0) + 1 })),
      ]);

      const final = await storageApi.get("tasks", id);
      return { notesLog: final.notesLog, counter: final.counter };
    });
    // Les deux écritures doivent être présentes, quel que soit l'ordre réel d'exécution.
    expect(result.notesLog).toEqual([{ id: "race-note", text: "Ajoutée pendant la course", createdAt: 1 }]);
    expect(result.counter).toBe(1);
  });

  test("tasksApi.addNote/addChecklistItem/addOutlookMeeting/setWaitingNote : comportement inchangé après conversion en écriture ciblée", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { tasksApi } = window.__pilotageTestApi;
      const task = await tasksApi.createTask({ title: `Test LOT 4B — tâche ${Date.now()}` });

      const note = await tasksApi.addNote(task.id, "  Une note avec espaces  ");
      const item = await tasksApi.addChecklistItem(task.id, "Sous-étape 1");
      const meeting = await tasksApi.addOutlookMeeting(task.id, { title: "Point hebdo", date: "2026-10-01" });
      await tasksApi.setWaitingNote(task.id, "  Attend la validation de Paul  ");

      // Note vide : ne doit rien écrire et renvoyer null, comme avant la conversion.
      const emptyNote = await tasksApi.addNote(task.id, "   ");

      const final = await tasksApi.getTask(task.id);
      return {
        noteReturned: note,
        itemReturned: item,
        meetingReturned: meeting,
        emptyNote,
        finalNotesLog: final.notesLog,
        finalChecklist: final.checklist,
        finalOutlookMeetings: final.outlookMeetings,
        finalWaitingOn: final.waitingOn,
      };
    });
    expect(result.noteReturned.text).toBe("Une note avec espaces");
    expect(result.itemReturned.text).toBe("Sous-étape 1");
    expect(result.itemReturned.done).toBe(false);
    expect(result.meetingReturned).toEqual(expect.objectContaining({ title: "Point hebdo", date: "2026-10-01" }));
    expect(result.emptyNote).toBeNull();
    expect(result.finalNotesLog).toHaveLength(1);
    expect(result.finalNotesLog[0].text).toBe("Une note avec espaces");
    expect(result.finalChecklist).toHaveLength(1);
    expect(result.finalOutlookMeetings).toHaveLength(1);
    expect(result.finalWaitingOn).toBe("Attend la validation de Paul");
  });

  test("projectsApi.addNote/addPart et followUpsApi.addNote/addChecklistItem : comportement inchangé après conversion", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { projectsApi, followUpsApi } = window.__pilotageTestApi;
      const project = await projectsApi.createProject({ name: `Test LOT 4B — projet ${Date.now()}` });
      const projectNote = await projectsApi.addNote(project.id, "Note de projet");
      const part = await projectsApi.addPart(project.id, "Lot A");

      const followUp = await followUpsApi.createFollowUp({ title: `Test LOT 4B — suivi ${Date.now()}`, personId: "test-lot4b-person" });
      const followUpNote = await followUpsApi.addNote(followUp.id, "Note de suivi");
      const followUpItem = await followUpsApi.addChecklistItem(followUp.id, "Relancer");

      const finalProject = await projectsApi.getProject(project.id);
      const finalFollowUp = await followUpsApi.getFollowUp(followUp.id);
      return {
        projectNote,
        part,
        followUpNote,
        followUpItem,
        finalProjectNotesLog: finalProject.notesLog,
        finalProjectParts: finalProject.parts,
        finalFollowUpNotesLog: finalFollowUp.notesLog,
        finalFollowUpChecklist: finalFollowUp.checklist,
      };
    });
    expect(result.projectNote.text).toBe("Note de projet");
    expect(result.part.label).toBe("Lot A");
    expect(result.part.status).toBe("not_started");
    expect(result.followUpNote.text).toBe("Note de suivi");
    expect(result.followUpItem.text).toBe("Relancer");
    expect(result.finalProjectNotesLog).toHaveLength(1);
    expect(result.finalProjectParts).toHaveLength(1);
    expect(result.finalFollowUpNotesLog).toHaveLength(1);
    expect(result.finalFollowUpChecklist).toHaveLength(1);
  });
});
