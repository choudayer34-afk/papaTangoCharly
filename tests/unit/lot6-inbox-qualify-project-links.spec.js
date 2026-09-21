// TEST-022 (AUDIT_TESTS.md), étendu pour LOT 6 / TODO-008 — lien automatique entité créée ↔
// projet, posé par inboxApi.qualify() quand un `projectId` de contexte est déjà connu à la
// création de l'entité (voir OUTCOME_PROJECT_LINK / linkEntityToProjectIfKnown dans
// js/domain/inbox.js).
//
// IMPORTANT — périmètre de ce fichier : TODO-008 comporte deux liens distincts.
//   1. InboxItem source ↔ entité créée — PAS COUVERT ICI, ce point reste en attente d'arbitrage
//      (voir TODO_TECHNIQUE.md, TODO-008, note LOT 6 : le seul type de référence permettant de
//      représenter un InboxItem dans js/components/linkedItems.js, "Kept", est filtré sur
//      `status === "kept"`, alors que ces 6 issues posent `status: "processed"` — un tel lien
//      serait résolu à null dès sa création).
//   2. Entité créée ↔ projet, quand connu à la création — c'est le seul des deux liens
//      effectivement implémenté par ce lot, et c'est ce que ce fichier vérifie.
//
// Vérifie aussi que les 9 issues de qualification existantes ne régressent pas (mêmes champs
// posés qu'avant ce lot sur l'InboxItem lui-même).
//
// AVERTISSEMENT (21/09/2026) : écrit et relu manuellement à partir du code réel
// (js/domain/inbox.js, js/domain/links.js), mais jamais exécuté dans l'environnement où il a été
// rédigé (registre npm bloqué, voir tests/README.md). À reconfirmer au premier lancement réel.

import { test, expect } from "@playwright/test";
import { E2E_TEST_USER } from "../e2e/global-setup.js";

test.describe("TEST-022 (étendu) — inboxApi.qualify() : régression des 9 issues + lien entité↔projet (LOT 6, TODO-008)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/support/harness.html");
    await page.waitForFunction(() => window.__pilotageTestApiReady === true);
    await page.evaluate(async ({ email, password }) => {
      await window.__pilotageTestApi.firebaseApi.signInEmail(email, password);
    }, E2E_TEST_USER);
    await page.waitForFunction(() => !!window.__pilotageTestApi.firebaseApi.getCurrentUser());
  });

  test("les 9 issues de qualification existantes ne régressent pas", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { inboxApi } = window.__pilotageTestApi;
      const cap = (suffix) => inboxApi.capture(`Test LOT 6 — régression ${suffix} ${Date.now()}`);

      const taskItem = await cap("task");
      const taskResult = await inboxApi.qualify(taskItem.id, "task", { title: "Tâche de test" });
      const taskFinal = await inboxApi.getInboxItem(taskItem.id);

      const followupItem = await cap("followup");
      const followupResult = await inboxApi.qualify(followupItem.id, "followup", { id: "fake-followup-id" });
      const followupFinal = await inboxApi.getInboxItem(followupItem.id);

      const projectItem = await cap("project");
      const projectResult = await inboxApi.qualify(projectItem.id, "project", { id: "fake-project-id" });
      const projectFinal = await inboxApi.getInboxItem(projectItem.id);

      const meetingItem = await cap("meeting");
      await inboxApi.qualify(meetingItem.id, "meeting", { id: "fake-meeting-id" });
      const meetingFinal = await inboxApi.getInboxItem(meetingItem.id);

      const decisionItem = await cap("decision");
      await inboxApi.qualify(decisionItem.id, "decision", { id: "fake-decision-id" });
      const decisionFinal = await inboxApi.getInboxItem(decisionItem.id);

      const resourceItem = await cap("resource");
      await inboxApi.qualify(resourceItem.id, "resource", { id: "fake-resource-id" });
      const resourceFinal = await inboxApi.getInboxItem(resourceItem.id);

      const keptItem = await cap("kept");
      const keptResult = await inboxApi.qualify(keptItem.id, "kept");
      const keptFinal = await inboxApi.getInboxItem(keptItem.id);

      const ideaItem = await cap("idea");
      const ideaResult = await inboxApi.qualify(ideaItem.id, "idea");
      const ideaFinal = await inboxApi.getInboxItem(ideaItem.id);

      const archivedItem = await cap("archived");
      const archivedResult = await inboxApi.qualify(archivedItem.id, "archived");
      const archivedFinal = await inboxApi.getInboxItem(archivedItem.id);

      return {
        taskResultOutcome: taskResult.outcome,
        taskFinalStatus: taskFinal.status,
        taskFinalResultId: taskFinal.resultTaskId,
        followupResultOutcome: followupResult.outcome,
        followupFinalStatus: followupFinal.status,
        followupFinalResultId: followupFinal.resultFollowUpId,
        projectResultOutcome: projectResult.outcome,
        projectFinalStatus: projectFinal.status,
        projectFinalResultId: projectFinal.resultProjectId,
        meetingFinalStatus: meetingFinal.status,
        meetingFinalResultId: meetingFinal.resultMeetingId,
        decisionFinalStatus: decisionFinal.status,
        decisionFinalResultId: decisionFinal.resultDecisionId,
        resourceFinalStatus: resourceFinal.status,
        resourceFinalResultId: resourceFinal.resultResourceId,
        keptResultOutcome: keptResult.outcome,
        keptFinalStatus: keptFinal.status,
        keptFinalKeptAsType: keptFinal.keptAsType,
        ideaResultOutcome: ideaResult.outcome,
        ideaFinalStatus: ideaFinal.status,
        ideaFinalKeptAsType: ideaFinal.keptAsType,
        archivedResultOutcome: archivedResult.outcome,
        archivedFinalStatus: archivedFinal.status,
      };
    });

    expect(result.taskResultOutcome).toBe("task");
    expect(result.taskFinalStatus).toBe("processed");
    expect(result.taskFinalResultId).toBeTruthy();
    expect(result.followupResultOutcome).toBe("followup");
    expect(result.followupFinalStatus).toBe("processed");
    expect(result.followupFinalResultId).toBe("fake-followup-id");
    expect(result.projectResultOutcome).toBe("project");
    expect(result.projectFinalStatus).toBe("processed");
    expect(result.projectFinalResultId).toBe("fake-project-id");
    expect(result.meetingFinalStatus).toBe("processed");
    expect(result.meetingFinalResultId).toBe("fake-meeting-id");
    expect(result.decisionFinalStatus).toBe("processed");
    expect(result.decisionFinalResultId).toBe("fake-decision-id");
    expect(result.resourceFinalStatus).toBe("processed");
    expect(result.resourceFinalResultId).toBe("fake-resource-id");
    expect(result.keptResultOutcome).toBe("kept");
    expect(result.keptFinalStatus).toBe("kept");
    expect(result.keptFinalKeptAsType).toBe("kept");
    expect(result.ideaResultOutcome).toBe("kept");
    expect(result.ideaFinalStatus).toBe("kept");
    expect(result.ideaFinalKeptAsType).toBe("idea");
    expect(result.archivedResultOutcome).toBe("archived");
    expect(result.archivedFinalStatus).toBe("archived");
  });

  test("Task/FollowUp/Meeting/Decision : projectId déjà connu à la création → lien entité↔projet posé", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { inboxApi, projectsApi, followUpsApi, meetingsApi, decisionsApi, linksApi } = window.__pilotageTestApi;
      const project = await projectsApi.createProject({ name: `Test LOT 6 — projet ${Date.now()}` });

      // Task : projectId transmis directement dans `extra` (créée PAR qualify() lui-même).
      const taskItem = await inboxApi.capture(`Test LOT 6 — task+projet ${Date.now()}`);
      const taskResult = await inboxApi.qualify(taskItem.id, "task", { title: "Tâche liée", projectId: project.id });

      // FollowUp/Meeting/Decision : l'entité est déjà créée par l'appelant (comme le fait
      // js/views/inbox.js), qualify() ne reçoit que son id.
      const followUp = await followUpsApi.createFollowUp({ title: "Suivi lié", personId: "test-lot6-person", projectId: project.id });
      const followupItem = await inboxApi.capture(`Test LOT 6 — followup+projet ${Date.now()}`);
      await inboxApi.qualify(followupItem.id, "followup", { id: followUp.id });

      const meeting = await meetingsApi.createMeeting({ title: "Réunion liée", projectId: project.id });
      const meetingItem = await inboxApi.capture(`Test LOT 6 — meeting+projet ${Date.now()}`);
      await inboxApi.qualify(meetingItem.id, "meeting", { id: meeting.id });

      const decision = await decisionsApi.createDecision({ title: "Décision liée", decision: "On fait X", projectId: project.id });
      const decisionItem = await inboxApi.capture(`Test LOT 6 — decision+projet ${Date.now()}`);
      await inboxApi.qualify(decisionItem.id, "decision", { id: decision.id });

      const allLinks = await linksApi.listAll();
      const hasLink = (type, id) =>
        allLinks.some(
          (l) =>
            (l.a.type === type && l.a.id === id && l.b.type === "Project" && l.b.id === project.id) ||
            (l.b.type === type && l.b.id === id && l.a.type === "Project" && l.a.id === project.id)
        );

      return {
        taskId: taskResult.task.id,
        hasTaskLink: hasLink("Task", taskResult.task.id),
        hasFollowUpLink: hasLink("FollowUp", followUp.id),
        hasMeetingLink: hasLink("Meeting", meeting.id),
        hasDecisionLink: hasLink("Decision", decision.id),
      };
    });

    expect(result.hasTaskLink).toBe(true);
    expect(result.hasFollowUpLink).toBe(true);
    expect(result.hasMeetingLink).toBe(true);
    expect(result.hasDecisionLink).toBe(true);
  });

  test("Aucun projectId connu à la création → aucun lien entité↔projet créé", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { inboxApi, followUpsApi, linksApi } = window.__pilotageTestApi;

      const taskItem = await inboxApi.capture(`Test LOT 6 — task sans projet ${Date.now()}`);
      const taskResult = await inboxApi.qualify(taskItem.id, "task", { title: "Tâche non rattachée" });

      const followUp = await followUpsApi.createFollowUp({ title: "Suivi non rattaché", personId: "test-lot6-person-2" });
      const followupItem = await inboxApi.capture(`Test LOT 6 — followup sans projet ${Date.now()}`);
      await inboxApi.qualify(followupItem.id, "followup", { id: followUp.id });

      const allLinks = await linksApi.listAll();
      const hasAnyProjectLink = (type, id) => allLinks.some((l) => (l.a.type === type && l.a.id === id) || (l.b.type === type && l.b.id === id));

      return {
        hasTaskLink: hasAnyProjectLink("Task", taskResult.task.id),
        hasFollowUpLink: hasAnyProjectLink("FollowUp", followUp.id),
      };
    });

    expect(result.hasTaskLink).toBe(false);
    expect(result.hasFollowUpLink).toBe(false);
  });

  test("Resource ne génère jamais de lien projet, même avec un projet existant en base", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { inboxApi, projectsApi, resourcesApi, linksApi } = window.__pilotageTestApi;
      const project = await projectsApi.createProject({ name: `Test LOT 6 — projet resource ${Date.now()}` });
      const resource = await resourcesApi.createResource({ title: "Ressource qualifiée" });

      const resourceItem = await inboxApi.capture(`Test LOT 6 — resource ${Date.now()}`);
      await inboxApi.qualify(resourceItem.id, "resource", { id: resource.id });

      const allLinks = await linksApi.listAll();
      const hasResourceLink = allLinks.some(
        (l) => (l.a.type === "Resource" && l.a.id === resource.id) || (l.b.type === "Resource" && l.b.id === resource.id)
      );
      return { hasResourceLink, projectId: project.id };
    });

    expect(result.hasResourceLink).toBe(false);
  });
});
