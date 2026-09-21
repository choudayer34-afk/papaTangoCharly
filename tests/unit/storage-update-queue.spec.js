// TEST-006 (AUDIT_TESTS.md, P0) — régression sur la file de sérialisation en mémoire de
// `storage.js#update()` (protection contre les races lecture-modification-écriture au sein d'un
// même onglet, voir le commentaire au-dessus de `updateQueues` dans js/services/storage.js).
// Tourne dans un vrai navigateur (Playwright) contre l'émulateur Firebase, authentifié via le
// compte de test créé par e2e/global-setup.js — jamais contre la production.
//
// AVERTISSEMENT (20/09/2026) : non exécuté dans l'environnement où il a été écrit (registre npm
// bloqué, voir tests/README.md).

import { test, expect } from "@playwright/test";
import { E2E_TEST_USER } from "../e2e/global-setup.js";

test.describe("TEST-006 — storage.js#update (file de sérialisation par document)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/support/harness.html");
    await page.waitForFunction(() => window.__pilotageTestApiReady === true);
    await page.evaluate(
      async ({ email, password }) => {
        await window.__pilotageTestApi.firebaseApi.signInEmail(email, password);
      },
      E2E_TEST_USER
    );
    await page.waitForFunction(() => !!window.__pilotageTestApi.firebaseApi.getCurrentUser());
  });

  test("deux update() concurrents sur le même document n'en perdent aucun", async ({ page }) => {
    const counters = await page.evaluate(async () => {
      const { storageApi } = window.__pilotageTestApi;
      const id = `test-concurrent-${Date.now()}`;
      await storageApi.put("tasks", { id, title: "Départ (test TEST-006)", counters: { a: 0, b: 0 } });

      // Deux mutations concurrentes sur le MÊME document : sans la file de sérialisation
      // (`updateQueues`), l'une des deux lit l'état AVANT l'écriture de l'autre et l'écrase
      // silencieusement à son tour — c'est précisément la perte d'écriture que TEST-006 vise à
      // détecter si elle réapparaît un jour.
      await Promise.all([
        storageApi.update("tasks", id, (current) => ({ counters: { ...current.counters, a: 1 } })),
        storageApi.update("tasks", id, (current) => ({ counters: { ...current.counters, b: 1 } })),
      ]);

      const final = await storageApi.get("tasks", id);
      return final.counters;
    });
    expect(counters).toEqual({ a: 1, b: 1 });
  });

  test("update() sur des documents différents reste traité en parallèle (pas de file globale)", async ({ page }) => {
    const { durationMs, values } = await page.evaluate(async () => {
      const { storageApi } = window.__pilotageTestApi;
      const idA = `test-parallel-a-${Date.now()}`;
      const idB = `test-parallel-b-${Date.now()}`;
      await Promise.all([
        storageApi.put("tasks", { id: idA, title: "A" }),
        storageApi.put("tasks", { id: idB, title: "B" }),
      ]);
      const start = performance.now();
      await Promise.all([
        storageApi.update("tasks", idA, (current) => ({ title: `${current.title}-mis à jour` })),
        storageApi.update("tasks", idB, (current) => ({ title: `${current.title}-mis à jour` })),
      ]);
      const durationMs = performance.now() - start;
      const [a, b] = await Promise.all([storageApi.get("tasks", idA), storageApi.get("tasks", idB)]);
      return { durationMs, values: [a.title, b.title] };
    });
    expect(values).toEqual(["A-mis à jour", "B-mis à jour"]);
    // Vérification indicative seulement (pas un test de performance strict) : deux documents
    // différents ne doivent pas être artificiellement mis en file l'un derrière l'autre.
    expect(durationMs).toBeLessThan(5000);
  });
});
