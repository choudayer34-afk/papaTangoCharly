// TEST-001 (AUDIT_TESTS.md, P0) — régression : un email absent de `allowedUsers` (ou dont le
// compte est fermé) doit être bloqué par `isEmailAllowed()` (js/services/firebase.js), pas
// seulement supposé bloqué par erreur silencieuse. Tourne dans un vrai navigateur (Playwright)
// via tests/support/harness.html, contre l'émulateur Firebase — jamais contre la production
// (voir la dérogation posée dans js/services/firebase.js pour LOT 0B). Aucun fichier applicatif
// n'est modifié par ce test lui-même.
//
// AVERTISSEMENT (20/09/2026) : non exécuté dans l'environnement où il a été écrit (registre npm
// bloqué, voir tests/README.md).

import { test, expect } from "@playwright/test";

test.describe("TEST-001 — firebase.js#isEmailAllowed", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/support/harness.html");
    await page.waitForFunction(() => window.__pilotageTestApiReady === true);
  });

  test("email absent de allowedUsers → refusé", async ({ page }) => {
    const allowed = await page.evaluate(() =>
      window.__pilotageTestApi.firebaseApi.isEmailAllowed("personne-inconnue@example.com")
    );
    expect(allowed).toBe(false);
  });

  test("email présent et non désactivé (fixture alice, voir tests/support/seed.js) → autorisé", async ({ page }) => {
    const allowed = await page.evaluate(() => window.__pilotageTestApi.firebaseApi.isEmailAllowed("alice@example.com"));
    expect(allowed).toBe(true);
  });

  test("compte fermé (fixture bob, disabled: true) → refusé", async ({ page }) => {
    const allowed = await page.evaluate(() => window.__pilotageTestApi.firebaseApi.isEmailAllowed("bob@example.com"));
    expect(allowed).toBe(false);
  });

  test("email vide/absent → refusé sans appel réseau", async ({ page }) => {
    const allowed = await page.evaluate(() => window.__pilotageTestApi.firebaseApi.isEmailAllowed(""));
    expect(allowed).toBe(false);
  });
});
