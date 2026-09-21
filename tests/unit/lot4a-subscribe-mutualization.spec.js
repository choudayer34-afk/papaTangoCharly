// TEST-013 (AUDIT_TESTS.md) — "test vérifiant qu'un seul `onSnapshot` Firestore est ouvert quel
// que soit le nombre d'abonnés simultanés". TEST-013 a été rédigé à l'origine pour `inboxItems`
// (js/domain/inbox.js#subscribeFiltered, déjà en production) ; ce fichier le décline pour la
// mutualisation ajoutée en LOT 4A (TODO-009B) sur `tasksApi`/`projectsApi`/`followUpsApi`, qui
// reprend le même mécanisme (voir le commentaire au-dessus de `subscribeShared` dans
// js/domain/tasks.js).
//
// Portée assumée : un test Playwright ne peut pas monkey-patcher un export nommé d'un module ES
// (`storageApi.subscribe = wrapper` ne change pas ce que `tasks.js` a déjà importé — les bindings
// d'un module ES sont en lecture seule côté importateur), donc "compter les vrais appels
// onSnapshot" n'est pas exprimable tel quel depuis ces tests. La preuve apportée ici est
// comportementale, à la place : (a) plusieurs abonnés simultanés reçoivent des mises à jour
// synchronisées (une seule écriture Firestore produit un seul rappel par abonné, avec le même
// contenu) ; (b) un abonné qui arrive APRÈS le premier reçoit immédiatement l'état courant sans
// attendre une nouvelle écriture (rejoue `lastRawItems`, comme le ferait `onSnapshot` pour un
// tout premier abonné) ; (c) désabonner un abonné ne casse pas les autres, qui continuent de
// recevoir les mises à jour suivantes — c'est précisément la classe de régression que
// TODO-009B mentionne comme risque ("moyen") de cette mutualisation.
//
// AVERTISSEMENT (21/09/2026) : écrit et relu manuellement à partir du code réel
// (js/domain/tasks.js, projects.js, followups.js), mais jamais exécuté dans l'environnement où il
// a été rédigé (registre npm bloqué, voir tests/README.md). À reconfirmer au premier lancement réel.

import { test, expect } from "@playwright/test";
import { E2E_TEST_USER } from "../e2e/global-setup.js";

test.describe("TEST-013 (décliné) — subscribe() mutualisé (tasks/projects/followUps, LOT 4A)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/support/harness.html");
    await page.waitForFunction(() => window.__pilotageTestApiReady === true);
    await page.evaluate(async ({ email, password }) => {
      await window.__pilotageTestApi.firebaseApi.signInEmail(email, password);
    }, E2E_TEST_USER);
    await page.waitForFunction(() => !!window.__pilotageTestApi.firebaseApi.getCurrentUser());
  });

  test("tasksApi.subscribe : deux abonnés simultanés reçoivent la même liste à jour, un abonné tardif est rejoué immédiatement", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { tasksApi } = window.__pilotageTestApi;
      const marker = `test-lot4a-tasks-${Date.now()}`;

      const callsA = [];
      const callsB = [];
      const unsubA = tasksApi.subscribe((items) => callsA.push(items.filter((t) => t.title?.includes(marker)).length));

      // Premier abonné déjà actif : on crée une tâche et on attend le rappel Firestore.
      await tasksApi.createTask({ title: `${marker} — une` });
      await new Promise((resolve) => {
        const check = () => (callsA.some((n) => n === 1) ? resolve() : setTimeout(check, 50));
        check();
      });

      // Abonné B arrive APRÈS coup : doit être rejoué immédiatement avec l'état courant (1),
      // sans attendre une nouvelle écriture — c'est le comportement que `onSnapshot` seul
      // n'offre qu'au tout premier abonné.
      const unsubB = tasksApi.subscribe((items) => callsB.push(items.filter((t) => t.title?.includes(marker)).length));
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Nouvelle écriture : les DEUX abonnés doivent recevoir la mise à jour synchronisée (2).
      await tasksApi.createTask({ title: `${marker} — deux` });
      await new Promise((resolve) => {
        const check = () => (callsA.some((n) => n === 2) && callsB.some((n) => n === 2) ? resolve() : setTimeout(check, 50));
        check();
      });

      // Désabonnement de A : B doit continuer de recevoir les mises à jour suivantes.
      unsubA();
      const callsBBeforeThird = callsB.length;
      await tasksApi.createTask({ title: `${marker} — trois` });
      await new Promise((resolve) => {
        const check = () => (callsB.some((n) => n === 3) ? resolve() : setTimeout(check, 50));
        check();
      });

      unsubB();

      return {
        bWasReplayedImmediately: callsB.length > 0 && callsB[0] === 1,
        bReceivedThree: callsB.includes(3),
        bKeptReceivingAfterAUnsubscribed: callsB.length > callsBBeforeThird,
      };
    });

    expect(result.bWasReplayedImmediately).toBe(true);
    expect(result.bReceivedThree).toBe(true);
    expect(result.bKeptReceivingAfterAUnsubscribed).toBe(true);
  });

  test("projectsApi.subscribe et followUpsApi.subscribe : même garantie de mutualisation (abonné tardif rejoué, désabonnement partiel sans casse)", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { projectsApi, followUpsApi } = window.__pilotageTestApi;
      const marker = `test-lot4a-${Date.now()}`;

      const outcomes = {};

      // Projects
      {
        const calls = [];
        const unsub1 = projectsApi.subscribe((items) => calls.push(items.filter((p) => p.name?.includes(marker)).length));
        await projectsApi.createProject({ name: `${marker}-projet` });
        await new Promise((resolve) => {
          const check = () => (calls.some((n) => n === 1) ? resolve() : setTimeout(check, 50));
          check();
        });
        const lateCalls = [];
        const unsub2 = projectsApi.subscribe((items) => lateCalls.push(items.filter((p) => p.name?.includes(marker)).length));
        await new Promise((resolve) => setTimeout(resolve, 200));
        outcomes.projectsLateSubscriberReplayed = lateCalls.length > 0 && lateCalls[0] === 1;
        unsub1();
        unsub2();
      }

      // FollowUps
      {
        const calls = [];
        const unsub1 = followUpsApi.subscribe((items) => calls.push(items.filter((f) => f.title?.includes(marker)).length));
        await followUpsApi.createFollowUp({ title: `${marker}-suivi`, personId: "test-lot4a-person" });
        await new Promise((resolve) => {
          const check = () => (calls.some((n) => n === 1) ? resolve() : setTimeout(check, 50));
          check();
        });
        const lateCalls = [];
        const unsub2 = followUpsApi.subscribe((items) => lateCalls.push(items.filter((f) => f.title?.includes(marker)).length));
        await new Promise((resolve) => setTimeout(resolve, 200));
        outcomes.followUpsLateSubscriberReplayed = lateCalls.length > 0 && lateCalls[0] === 1;
        unsub1();
        unsub2();
      }

      return outcomes;
    });

    expect(result.projectsLateSubscriberReplayed).toBe(true);
    expect(result.followUpsLateSubscriberReplayed).toBe(true);
  });
});
