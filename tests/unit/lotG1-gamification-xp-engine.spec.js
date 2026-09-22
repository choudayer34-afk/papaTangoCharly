// LOT G1 (TODO_GAMIFICATION.md, moteur XP, 24/09/2026 — roadmap INDÉPENDANTE de
// TODO_TECHNIQUE.md, voir l'en-tête de TODO_GAMIFICATION.md) : un test par événement
// déclencheur du barème (§3), vérifiant que l'XP est créditée exactement une fois par
// événement (jamais deux fois pour la même entité — §2.3, "une action = une récompense"), plus
// un test de la clause spécifique "au plus une fois par jour calendaire et par Objectif" pour la
// ligne "Objectif mis à jour". Même harnais que le reste de ce dossier (tests/support/
// harness.html, émulateur Firebase) — voir tests/unit/lot11-objectives-model.spec.js pour le
// même principe.
//
// Les tests lisent le DELTA de `gamificationApi.getGamificationState().xpTotal` avant/après
// chaque action plutôt qu'une valeur absolue : ce compteur est partagé par tout le compte de
// test (un seul document `gamification/state`), et les autres fichiers de ce dossier créent
// eux aussi des Tâches/Réunions/Décisions/Ressources/Prompts qui créditent désormais de l'XP —
// seul l'écart provoqué par CE test est significatif, jamais le total absolu du compte.
//
// AVERTISSEMENT (24/09/2026, même principe que lot11-objectives-model.spec.js et
// tests/README.md) : écrit et relu manuellement à partir du code réel de js/domain/
// gamification.js et des 9 fichiers de domaine modifiés par ce lot, mais JAMAIS EXÉCUTÉ dans cet
// environnement (registre npm/émulateur Firebase indisponibles ici, voir tests/README.md) — à
// lancer réellement via `npm run test:e2e` (GitHub Actions ou poste de Charles-Henri) avant
// d'être considéré comme validé.

import { test, expect } from "@playwright/test";
import { E2E_TEST_USER } from "../e2e/global-setup.js";

test.describe("LOT G1 — Moteur XP (TODO_GAMIFICATION.md §3), une récompense par événement", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/support/harness.html");
    await page.waitForFunction(() => window.__pilotageTestApiReady === true);
    await page.evaluate(async ({ email, password }) => {
      await window.__pilotageTestApi.firebaseApi.signInEmail(email, password);
    }, E2E_TEST_USER);
    await page.waitForFunction(() => !!window.__pilotageTestApi.firebaseApi.getCurrentUser());
  });

  test("Tâche terminée : +10 XP à la première clôture, jamais recrédité sur réouverture/re-clôture", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { tasksApi, gamificationApi } = window.__pilotageTestApi;
      const task = await tasksApi.createTask({ title: `Test LOT G1 — tâche ${Date.now()}` });

      const before = await gamificationApi.getGamificationState();
      await tasksApi.updateTask(task.id, { status: "done" });
      await new Promise((r) => setTimeout(r, 300)); // le crédit XP est fire-and-forget (voir updateTask), laisse le temps à l'écriture asynchrone
      const afterFirstDone = await gamificationApi.getGamificationState();

      // Réouverture puis re-clôture — ne doit rapporter aucun XP supplémentaire (§2.3).
      await tasksApi.updateTask(task.id, { status: "todo" });
      await tasksApi.updateTask(task.id, { status: "done" });
      await new Promise((r) => setTimeout(r, 300));
      const afterSecondDone = await gamificationApi.getGamificationState();

      // Une modification qui ne touche pas le statut ne doit rien créditer non plus.
      await tasksApi.updateTask(task.id, { title: "Titre renommé après clôture" });
      await new Promise((r) => setTimeout(r, 300));
      const afterRename = await gamificationApi.getGamificationState();

      return {
        deltaFirst: afterFirstDone.xpTotal - before.xpTotal,
        deltaSecond: afterSecondDone.xpTotal - afterFirstDone.xpTotal,
        deltaRename: afterRename.xpTotal - afterSecondDone.xpTotal,
        rewardKeyPresent: !!afterFirstDone.rewardedKeys[`tache-terminee:${task.id}`],
      };
    });
    expect(result.deltaFirst).toBe(10);
    expect(result.deltaSecond).toBe(0);
    expect(result.deltaRename).toBe(0);
    expect(result.rewardKeyPresent).toBe(true);
  });

  test("Suivi terminé : +8 XP à la première clôture, jamais recrédité sur réouverture/re-clôture", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { followUpsApi, gamificationApi } = window.__pilotageTestApi;
      const followUp = await followUpsApi.createFollowUp({ personId: "fake-person-" + Date.now(), title: `Test LOT G1 — suivi ${Date.now()}` });

      const before = await gamificationApi.getGamificationState();
      await followUpsApi.updateFollowUp(followUp.id, { status: "done" });
      await new Promise((r) => setTimeout(r, 300));
      const afterFirstDone = await gamificationApi.getGamificationState();

      await followUpsApi.updateFollowUp(followUp.id, { status: "waiting" });
      await followUpsApi.updateFollowUp(followUp.id, { status: "done" });
      await new Promise((r) => setTimeout(r, 300));
      const afterSecondDone = await gamificationApi.getGamificationState();

      return {
        deltaFirst: afterFirstDone.xpTotal - before.xpTotal,
        deltaSecond: afterSecondDone.xpTotal - afterFirstDone.xpTotal,
      };
    });
    expect(result.deltaFirst).toBe(8);
    expect(result.deltaSecond).toBe(0);
  });

  test("Projet clôturé : +40 XP à la première clôture, jamais recrédité si closeProject() est rappelé", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { projectsApi, gamificationApi } = window.__pilotageTestApi;
      const project = await projectsApi.createProject({ title: `Test LOT G1 — projet ${Date.now()}` });

      const before = await gamificationApi.getGamificationState();
      await projectsApi.closeProject(project.id);
      await new Promise((r) => setTimeout(r, 300));
      const afterFirstClose = await gamificationApi.getGamificationState();

      // closeProject() ne vérifie pas lui-même le statut courant (voir js/domain/projects.js) —
      // c'est le registre "déjà récompensé" qui doit à lui seul empêcher un second crédit.
      await projectsApi.closeProject(project.id);
      await new Promise((r) => setTimeout(r, 300));
      const afterSecondClose = await gamificationApi.getGamificationState();

      return {
        deltaFirst: afterFirstClose.xpTotal - before.xpTotal,
        deltaSecond: afterSecondClose.xpTotal - afterFirstClose.xpTotal,
      };
    });
    expect(result.deltaFirst).toBe(40);
    expect(result.deltaSecond).toBe(0);
  });

  test("Réunion créée : +5 XP à la création, jamais recrédité pour la même Réunion", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { meetingsApi, gamificationApi } = window.__pilotageTestApi;
      const before = await gamificationApi.getGamificationState();
      const meeting = await meetingsApi.createMeeting({ title: `Test LOT G1 — réunion ${Date.now()}` });
      await new Promise((r) => setTimeout(r, 300));
      const after = await gamificationApi.getGamificationState();
      return { delta: after.xpTotal - before.xpTotal, rewardKeyPresent: !!after.rewardedKeys[`reunion-creee:${meeting.id}`] };
    });
    expect(result.delta).toBe(5);
    expect(result.rewardKeyPresent).toBe(true);
  });

  test("Décision créée : +6 XP à la création", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { decisionsApi, gamificationApi } = window.__pilotageTestApi;
      const before = await gamificationApi.getGamificationState();
      await decisionsApi.createDecision({ title: `Test LOT G1 — décision ${Date.now()}`, decision: "Décidé pour le test" });
      await new Promise((r) => setTimeout(r, 300));
      const after = await gamificationApi.getGamificationState();
      return { delta: after.xpTotal - before.xpTotal };
    });
    expect(result.delta).toBe(6);
  });

  test("Ressource créée : +3 XP à la création", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { resourcesApi, gamificationApi } = window.__pilotageTestApi;
      const before = await gamificationApi.getGamificationState();
      await resourcesApi.createResource({ title: `Test LOT G1 — ressource ${Date.now()}`, url: "https://example.com" });
      await new Promise((r) => setTimeout(r, 300));
      const after = await gamificationApi.getGamificationState();
      return { delta: after.xpTotal - before.xpTotal };
    });
    expect(result.delta).toBe(3);
  });

  test("Prompt créé : +3 XP à la création", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { promptsApi, gamificationApi } = window.__pilotageTestApi;
      const before = await gamificationApi.getGamificationState();
      await promptsApi.createPrompt({ title: `Test LOT G1 — prompt ${Date.now()}`, text: "Contenu du prompt de test" });
      await new Promise((r) => setTimeout(r, 300));
      const after = await gamificationApi.getGamificationState();
      return { delta: after.xpTotal - before.xpTotal };
    });
    expect(result.delta).toBe(3);
  });

  test("Inbox qualifiée : +4 XP quel que soit l'outcome (y compris \"archived\"), une fois par item", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { inboxApi, gamificationApi } = window.__pilotageTestApi;

      const item1 = await inboxApi.capture(`Test LOT G1 — inbox conservée ${Date.now()}`);
      const before1 = await gamificationApi.getGamificationState();
      await inboxApi.qualify(item1.id, "kept");
      await new Promise((r) => setTimeout(r, 300));
      const after1 = await gamificationApi.getGamificationState();

      // "archived" reste un traitement actif de l'Inbox (§3) — doit créditer comme les autres.
      const item2 = await inboxApi.capture(`Test LOT G1 — inbox archivée ${Date.now()}`);
      const before2 = await gamificationApi.getGamificationState();
      await inboxApi.qualify(item2.id, "archived");
      await new Promise((r) => setTimeout(r, 300));
      const after2 = await gamificationApi.getGamificationState();

      return {
        deltaKept: after1.xpTotal - before1.xpTotal,
        deltaArchived: after2.xpTotal - before2.xpTotal,
      };
    });
    expect(result.deltaKept).toBe(4);
    expect(result.deltaArchived).toBe(4);
  });

  test("Objectif mis à jour : +8 XP, au plus une fois par jour calendaire et par Objectif, partagé entre updateObjective/addIndicator/updateIndicator", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { objectivesApi, gamificationApi } = window.__pilotageTestApi;
      const objective = await objectivesApi.createObjective({ personId: null, title: `Test LOT G1 — objectif ${Date.now()}` });

      const before = await gamificationApi.getGamificationState();
      await objectivesApi.updateObjective(objective.id, { description: "Première modification du jour" });
      await new Promise((r) => setTimeout(r, 300));
      const afterFirstUpdate = await gamificationApi.getGamificationState();

      // Même jour, même Objectif, mais via addIndicator() puis updateIndicator() — ne doit rien
      // créditer de plus (§3 : la ligne "Objectif mis à jour" est partagée entre les trois
      // fonctions, throttle par objectif ET par jour, jamais par fonction appelante).
      const indicator = await objectivesApi.addIndicator(objective.id, { label: "Indicateur de test" });
      await new Promise((r) => setTimeout(r, 300));
      const afterAddIndicator = await gamificationApi.getGamificationState();

      await objectivesApi.updateIndicator(objective.id, indicator.id, { status: "in_progress" });
      await new Promise((r) => setTimeout(r, 300));
      const afterUpdateIndicator = await gamificationApi.getGamificationState();

      return {
        deltaFirstUpdate: afterFirstUpdate.xpTotal - before.xpTotal,
        deltaAddIndicator: afterAddIndicator.xpTotal - afterFirstUpdate.xpTotal,
        deltaUpdateIndicator: afterUpdateIndicator.xpTotal - afterAddIndicator.xpTotal,
      };
    });
    expect(result.deltaFirstUpdate).toBe(8);
    expect(result.deltaAddIndicator).toBe(0);
    expect(result.deltaUpdateIndicator).toBe(0);
  });

  test("Revue EADP ajoutée : +6 XP par point de suivi, cumulatif (jamais fusionné avec \"Objectif mis à jour\")", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { objectivesApi, gamificationApi } = window.__pilotageTestApi;
      const objective = await objectivesApi.createObjective({ personId: null, title: `Test LOT G1 — revues ${Date.now()}` });

      const before = await gamificationApi.getGamificationState();
      await objectivesApi.addEntry(objective.id, { date: "2026-09-24", note: "Premier point de suivi" });
      await new Promise((r) => setTimeout(r, 300));
      const afterFirstEntry = await gamificationApi.getGamificationState();

      // Une deuxième revue, distincte, sur le MÊME objectif le même jour : doit créditer à
      // nouveau (chaque point de suivi a son propre id, contrairement au throttle journalier de
      // "Objectif mis à jour").
      await objectivesApi.addEntry(objective.id, { date: "2026-09-24", note: "Deuxième point de suivi" });
      await new Promise((r) => setTimeout(r, 300));
      const afterSecondEntry = await gamificationApi.getGamificationState();

      return {
        deltaFirst: afterFirstEntry.xpTotal - before.xpTotal,
        deltaSecond: afterSecondEntry.xpTotal - afterFirstEntry.xpTotal,
      };
    });
    expect(result.deltaFirst).toBe(6);
    expect(result.deltaSecond).toBe(6);
  });
});
