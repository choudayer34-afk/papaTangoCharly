// "Petite parenthèse" Objectifs/EADP (28/09/2026, retour de Charles-Henri, hors numérotation LOT)
// — édition/suppression du journal "Notes & repères" PARTOUT où il existe (retour explicite de
// Charles-Henri, en réponse à la question posée avant développement : "Partout où ce journal
// existe", pas seulement sur la fiche Personne comme recommandé), tag EADP positif/négatif/neutre
// sur les notes de Personne, et `notableReason` sur un Suivi notable. Même principe que le reste
// de ce dossier (émulateur Firebase, jamais la production).
//
// Une seule suite par domaine (au lieu de 8 fichiers séparés) : la garantie testée est identique
// partout (parité stricte addNote → updateNote → removeNote, même forme de retour, jamais de
// cascade sur les autres notes) — un `test.describe` par domaine documente clairement quel fichier
// est couvert sans dupliquer 8 fois la même prose.
//
// AVERTISSEMENT (28/09/2026) : écrit et relu manuellement à partir du code réel, mais jamais
// exécuté dans cet environnement (registre npm bloqué, voir tests/README.md). À reconfirmer au
// premier lancement réel. `support/harness.html` a été complété avec `peopleApi` (absent
// jusqu'ici) pour ce fichier — aucun autre changement à ce fichier de harnais.

import { test, expect } from "@playwright/test";
import { E2E_TEST_USER } from "../e2e/global-setup.js";

test.describe("Notes & repères modifiables/supprimables partout (28/09/2026)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/support/harness.html");
    await page.waitForFunction(() => window.__pilotageTestApiReady === true);
    await page.evaluate(async ({ email, password }) => {
      await window.__pilotageTestApi.firebaseApi.signInEmail(email, password);
    }, E2E_TEST_USER);
    await page.waitForFunction(() => !!window.__pilotageTestApi.firebaseApi.getCurrentUser());
  });

  test("Tâche (js/domain/tasks.js) : addNote → updateNote → removeNote, sans cascade sur une deuxième note", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { tasksApi } = window.__pilotageTestApi;
      const t = await tasksApi.createTask({ title: `Test notes tâche ${Date.now()}` });
      await tasksApi.addNote(t.id, "Première note");
      await tasksApi.addNote(t.id, "Deuxième note (témoin)");
      const current1 = await tasksApi.getTask(t.id);
      const noteToEdit = current1.notesLog[0];
      const witnessNote = current1.notesLog[1];
      const afterUpdate = await tasksApi.updateNote(t.id, noteToEdit.id, "Note corrigée");
      const afterRemoveList = await tasksApi.removeNote(t.id, noteToEdit.id);
      return {
        // updateNote/removeNote (comme partout ailleurs dans ce dossier) renvoient le tableau
        // notesLog COMPLET, pas seulement la note touchée.
        editedText: afterUpdate.find((n) => n.id === noteToEdit.id).text,
        witnessUntouched: afterUpdate.find((n) => n.id === witnessNote.id).text,
        remainingCount: afterRemoveList.length,
        remainingIsWitness: afterRemoveList[0].id === witnessNote.id,
      };
    });
    expect(result.editedText).toBe("Note corrigée");
    expect(result.witnessUntouched).toBe("Deuxième note (témoin)");
    expect(result.remainingCount).toBe(1);
    expect(result.remainingIsWitness).toBe(true);
  });

  test("Suivi/FollowUp (js/domain/followups.js) : addNote → updateNote → removeNote, mêmes garanties", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { followUpsApi } = window.__pilotageTestApi;
      const fu = await followUpsApi.createFollowUp({ personId: "fake-person-" + Date.now(), title: `Test notes suivi ${Date.now()}` });
      await followUpsApi.addNote(fu.id, "Note initiale");
      const after = await followUpsApi.getFollowUp(fu.id);
      const noteId = after.notesLog[0].id;
      const updated = await followUpsApi.updateNote(fu.id, noteId, "Note modifiée");
      const removed = await followUpsApi.removeNote(fu.id, noteId);
      return {
        updatedText: updated.find((n) => n.id === noteId)?.text,
        countAfterRemove: removed.length,
      };
    });
    expect(result.updatedText).toBe("Note modifiée");
    expect(result.countAfterRemove).toBe(0);
  });

  test("Projet — journal du projet ET journal d'un volet (js/domain/projects.js) : les deux paires updateNote/removeNote et updatePartNote/removePartNote coexistent sans se marcher dessus", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { projectsApi } = window.__pilotageTestApi;
      const p = await projectsApi.createProject({ name: `Test notes projet ${Date.now()}` });
      const part = await projectsApi.addPart(p.id, "Volet A");

      await projectsApi.addNote(p.id, "Note du projet");
      await projectsApi.addPartNote(p.id, part.id, "Note du volet");

      const project1 = await projectsApi.getProject(p.id);
      const projectNoteId = project1.notesLog[0].id;
      const partNoteId = project1.parts.find((pt) => pt.id === part.id).notesLog[0].id;

      await projectsApi.updateNote(p.id, projectNoteId, "Note du projet corrigée");
      await projectsApi.updatePartNote(p.id, part.id, partNoteId, "Note du volet corrigée");
      const after2 = await projectsApi.getProject(p.id);

      await projectsApi.removeNote(p.id, projectNoteId);
      const after3 = await projectsApi.getProject(p.id);

      return {
        projectNoteEdited: after2.notesLog.find((n) => n.id === projectNoteId)?.text,
        partNoteEdited: after2.parts.find((pt) => pt.id === part.id).notesLog.find((n) => n.id === partNoteId)?.text,
        // Supprimer la note du PROJET ne doit jamais toucher celle du VOLET.
        partNoteStillThereAfterProjectNoteRemoved: after3.parts.find((pt) => pt.id === part.id).notesLog.length,
        projectNotesCountAfterRemoval: after3.notesLog.length,
      };
    });
    expect(result.projectNoteEdited).toBe("Note du projet corrigée");
    expect(result.partNoteEdited).toBe("Note du volet corrigée");
    expect(result.partNoteStillThereAfterProjectNoteRemoved).toBe(1);
    expect(result.projectNotesCountAfterRemoval).toBe(0);
  });

  test("Ressource (js/domain/resources.js) : addNote → updateNote → removeNote", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { resourcesApi } = window.__pilotageTestApi;
      const r = await resourcesApi.createResource({ title: `Test notes ressource ${Date.now()}`, url: "https://example.com" });
      await resourcesApi.addNote(r.id, "Note ressource");
      const withNote = (await resourcesApi.getResource(r.id));
      const noteId = withNote.notesLog[0].id;
      const updated = await resourcesApi.updateNote(r.id, noteId, "Note ressource corrigée");
      const removed = await resourcesApi.removeNote(r.id, noteId);
      return { updatedText: updated.find((n) => n.id === noteId)?.text, countAfterRemove: removed.length };
    });
    expect(result.updatedText).toBe("Note ressource corrigée");
    expect(result.countAfterRemove).toBe(0);
  });

  test("Réunion (js/domain/meetings.js) : addNote → updateNote → removeNote", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { meetingsApi } = window.__pilotageTestApi;
      const m = await meetingsApi.createMeeting({ title: `Test notes réunion ${Date.now()}` });
      await meetingsApi.addNote(m.id, "Note réunion");
      const list1 = await meetingsApi.listAll();
      const noteId = list1.find((x) => x.id === m.id).notesLog[0].id;
      const updated = await meetingsApi.updateNote(m.id, noteId, "Note réunion corrigée");
      const removed = await meetingsApi.removeNote(m.id, noteId);
      return { updatedText: updated.find((n) => n.id === noteId)?.text, countAfterRemove: removed.length };
    });
    expect(result.updatedText).toBe("Note réunion corrigée");
    expect(result.countAfterRemove).toBe(0);
  });

  test("Décision (js/domain/decisions.js) : addNote → updateNote → removeNote", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { decisionsApi } = window.__pilotageTestApi;
      const d = await decisionsApi.createDecision({ title: `Test notes décision ${Date.now()}`, decision: "On fait X" });
      await decisionsApi.addNote(d.id, "Note décision");
      const list1 = await decisionsApi.listAll();
      const noteId = list1.find((x) => x.id === d.id).notesLog[0].id;
      const updated = await decisionsApi.updateNote(d.id, noteId, "Note décision corrigée");
      const removed = await decisionsApi.removeNote(d.id, noteId);
      return { updatedText: updated.find((n) => n.id === noteId)?.text, countAfterRemove: removed.length };
    });
    expect(result.updatedText).toBe("Note décision corrigée");
    expect(result.countAfterRemove).toBe(0);
  });

  test("Inbox — journal \"Gardés\" (js/domain/inbox.js) : addKeptNote → updateKeptNote → removeKeptNote", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { inboxApi } = window.__pilotageTestApi;
      const item = await inboxApi.capture(`Test notes gardé ${Date.now()}`, "manuel");
      await inboxApi.addKeptNote(item.id, "Note gardée");
      const current = await inboxApi.getInboxItem(item.id);
      const noteId = current.notesLog[0].id;
      const updated = await inboxApi.updateKeptNote(item.id, noteId, "Note gardée corrigée");
      const removed = await inboxApi.removeKeptNote(item.id, noteId);
      return { updatedText: updated.find((n) => n.id === noteId)?.text, countAfterRemove: removed.length };
    });
    expect(result.updatedText).toBe("Note gardée corrigée");
    expect(result.countAfterRemove).toBe(0);
  });

  test("Personne (js/domain/people.js) : addNote → updateNote → removeNote, ET tag EADP (setNoteEadpFlag) séparé de la modification de texte", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { peopleApi } = window.__pilotageTestApi;
      const p = await peopleApi.createPerson({ name: `Test notes personne ${Date.now()}` });
      await peopleApi.addNote(p.id, "Note personne");
      const after1 = await peopleApi.getPerson(p.id);
      const noteId = after1.notesLog[0].id;
      const defaultFlag = after1.notesLog[0].eadpFlag;

      await peopleApi.setNoteEadpFlag(p.id, noteId, "positive");
      const after2 = await peopleApi.getPerson(p.id);

      // updateNote (texte) ne doit JAMAIS toucher au flag EADP posé séparément.
      const updated = await peopleApi.updateNote(p.id, noteId, "Note personne corrigée");
      const flagAfterTextUpdate = updated.find((n) => n.id === noteId).eadpFlag;

      const removed = await peopleApi.removeNote(p.id, noteId);

      return {
        eadpFlagValues: peopleApi.EADP_FLAG_VALUES,
        defaultFlag,
        flagAfterSet: after2.notesLog.find((n) => n.id === noteId).eadpFlag,
        editedText: updated.find((n) => n.id === noteId).text,
        flagAfterTextUpdate,
        countAfterRemove: removed.length,
      };
    });
    expect(result.eadpFlagValues).toEqual(["positive", "negative", "neutral"]);
    // Valeur par défaut sûre à la création : jamais indéfini, toujours null tant que non qualifié.
    expect(result.defaultFlag).toBeNull();
    expect(result.flagAfterSet).toBe("positive");
    expect(result.editedText).toBe("Note personne corrigée");
    expect(result.flagAfterTextUpdate).toBe("positive");
    expect(result.countAfterRemove).toBe(0);
  });
});

test.describe("Suivi notable : notableReason (28/09/2026)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/support/harness.html");
    await page.waitForFunction(() => window.__pilotageTestApiReady === true);
    await page.evaluate(async ({ email, password }) => {
      await window.__pilotageTestApi.firebaseApi.signInEmail(email, password);
    }, E2E_TEST_USER);
    await page.waitForFunction(() => !!window.__pilotageTestApi.firebaseApi.getCurrentUser());
  });

  test("notableReason est enregistré à la création aux côtés de notable, absent (chaîne vide) si non fourni", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { followUpsApi } = window.__pilotageTestApi;
      const withReason = await followUpsApi.createFollowUp({
        personId: "fake-person-" + Date.now(),
        title: "Test notableReason renseigné",
        notable: "positive",
        notableReason: "A débloqué un dossier bloqué depuis 3 semaines",
      });
      const withoutReason = await followUpsApi.createFollowUp({
        personId: "fake-person-" + Date.now(),
        title: "Test notableReason absent",
        notable: "negative",
      });
      return {
        notableValues: followUpsApi.NOTABLE_VALUES,
        reasonPresent: withReason.notableReason,
        notablePresent: withReason.notable,
        reasonAbsent: withoutReason.notableReason,
      };
    });
    // Jamais "neutre" pour un FollowUp — cette valeur n'existe QUE sur les notes de Personne
    // (EADP_FLAG_VALUES), arbitrage explicite documenté dans js/domain/followups.js.
    expect(result.notableValues).toEqual(["positive", "negative"]);
    expect(result.reasonPresent).toBe("A débloqué un dossier bloqué depuis 3 semaines");
    expect(result.notablePresent).toBe("positive");
    expect(result.reasonAbsent).toBe("");
  });
});
