// TEST-025 (AUDIT_TESTS.md, P1) — "aucun test sur la clôture (Tâche/Projet/Suivi) vérifiant
// l'absence de cascade et la mise à jour correcte du statut/`completedAt`. Test recommandé :
// test unitaire par entité." Voir LOT 1 (TODO-007) dans TODO_TECHNIQUE.md. Tourne dans un vrai
// navigateur (Playwright) contre l'émulateur Firebase, via le harnais de test (voir TEST-006
// pour le même principe) — jamais contre la production.
//
// AVERTISSEMENT (21/09/2026) : écrit et relu manuellement à partir du code réel
// (js/domain/tasks.js#updateTask, js/domain/projects.js#closeProject,
// js/domain/followups.js#setStatus), mais jamais exécuté dans l'environnement où il a été
// rédigé (registre npm bloqué, voir tests/README.md). À reconfirmer au premier lancement réel.

import { test, expect } from "@playwright/test";
import { E2E_TEST_USER } from "../e2e/global-setup.js";

test.describe("TEST-025 — clôture Tâche/Projet/Suivi : statut correct, aucune cascade", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/support/harness.html");
    await page.waitForFunction(() => window.__pilotageTestApiReady === true);
    await page.evaluate(async ({ email, password }) => {
      await window.__pilotageTestApi.firebaseApi.signInEmail(email, password);
    }, E2E_TEST_USER);
    await page.waitForFunction(() => !!window.__pilotageTestApi.firebaseApi.getCurrentUser());
  });

  test("Tâche : passer à 'done' pose completedAt, en ressortir l'efface — sans cascade sur un autre document", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { tasksApi, storageApi } = window.__pilotageTestApi;
      const untouched = await tasksApi.createTask({ title: `Test LOT 1 — témoin ${Date.now()}` });
      const task = await tasksApi.createTask({ title: `Test LOT 1 — clôture tâche ${Date.now()}` });

      const closed = await tasksApi.updateTask(task.id, { status: "done" });
      const reopened = await tasksApi.updateTask(task.id, { status: "todo" });
      const untouchedAfter = await storageApi.get("tasks", untouched.id);

      return {
        closedStatus: closed.status,
        closedCompletedAt: closed.completedAt,
        reopenedStatus: reopened.status,
        reopenedCompletedAt: reopened.completedAt,
        untouchedTitle: untouchedAfter.title,
      };
    });
    expect(result.closedStatus).toBe("done");
    expect(typeof result.closedCompletedAt).toBe("number");
    expect(result.reopenedStatus).toBe("todo");
    expect(result.reopenedCompletedAt).toBeNull();
    // Le témoin n'a jamais été touché par la clôture de l'autre tâche — même principe que
    // storage-update-queue.spec.js (TEST-006) : un update() ne doit affecter que son propre
    // document.
    expect(result.untouchedTitle).toContain("témoin");
  });

  test("Projet : clôturer ne supprime ni ne modifie les tâches qui lui sont rattachées (pas de cascade, DATA-003)", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { tasksApi, projectsApi } = window.__pilotageTestApi;
      const project = await projectsApi.createProject({ name: `Test LOT 1 — clôture projet ${Date.now()}` });
      const task = await tasksApi.createTask({ title: `Test LOT 1 — tâche du projet ${Date.now()}`, projectId: project.id });

      const closedProject = await projectsApi.closeProject(project.id);
      const taskAfter = await tasksApi.listAll().then((all) => all.find((t) => t.id === task.id));

      return {
        projectId: project.id,
        projectStatus: closedProject.status,
        taskStillExists: !!taskAfter,
        taskProjectId: taskAfter?.projectId,
        taskStatus: taskAfter?.status,
      };
    });
    expect(result.projectStatus).toBe("archived");
    expect(result.taskStillExists).toBe(true);
    // La tâche garde son `projectId` intact (pas de cascade qui l'aurait effacé ou modifié) et
    // son statut n'a pas bougé — seul `project.status` change à la clôture (js/domain/
    // projects.js#closeProject, commentaire : "ne supprime ni ne déplace rien").
    expect(result.taskProjectId).toBe(result.projectId);
    expect(result.taskStatus).toBe("todo");
  });

  test("Suivi : passer à 'done' met à jour le statut sans toucher aux autres champs", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { followUpsApi } = window.__pilotageTestApi;
      const followUp = await followUpsApi.createFollowUp({
        title: `Test LOT 1 — clôture suivi ${Date.now()}`,
        personId: "test-lot1-person",
      });
      const closed = await followUpsApi.setStatus(followUp.id, "done");
      return { status: closed.status, title: closed.title, personId: closed.personId };
    });
    expect(result.status).toBe("done");
    expect(result.title).toContain("clôture suivi");
    expect(result.personId).toBe("test-lot1-person");
  });
});
