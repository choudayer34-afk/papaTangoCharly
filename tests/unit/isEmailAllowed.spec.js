// TEST-001 (AUDIT_TESTS.md, P0) — régression : un email absent de `allowedUsers` (ou dont le
// compte est fermé) doit être bloqué par `isEmailAllowed()` (js/services/firebase.js), pas
// seulement supposé bloqué par erreur silencieuse. Tourne dans un vrai navigateur (Playwright)
// via tests/support/harness.html, contre l'émulateur Firebase — jamais contre la production
// (voir la dérogation posée dans js/services/firebase.js pour LOT 0B). Aucun fichier applicatif
// n'est modifié par ce test lui-même.
//
// Correction du 21/09/2026 (premier passage réel du workflow GitHub Actions) : la règle
// corrigée en LOT 0A (FIREBASE-002/SEC-004) n'autorise la lecture de `allowedUsers/{email}` que
// par son propre titulaire authentifié — chaque cas ci-dessous doit donc se connecter avec
// EXACTEMENT l'email qu'il vérifie (comptes créés par e2e/global-setup.js#UNIT_TEST_USERS)
// avant d'appeler isEmailAllowed(), sans quoi l'appel est refusé par la règle elle-même
// (PERMISSION_DENIED) avant même d'avoir pu tester la logique de isEmailAllowed().

import { test, expect } from "@playwright/test";
import { UNIT_TEST_USERS } from "../e2e/global-setup.js";

test.describe("TEST-001 — firebase.js#isEmailAllowed", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/support/harness.html");
    await page.waitForFunction(() => window.__pilotageTestApiReady === true);
  });

  test("email absent de allowedUsers → refusé", async ({ page }) => {
    const { email, password } = UNIT_TEST_USERS.inconnu;
    await page.evaluate(
      ({ email, password }) => window.__pilotageTestApi.firebaseApi.signInEmail(email, password),
      { email, password }
    );
    const allowed = await page.evaluate(() =>
      window.__pilotageTestApi.firebaseApi.isEmailAllowed("personne-inconnue@example.com")
    );
    expect(allowed).toBe(false);
  });

  test("email présent et non désactivé (fixture alice, voir tests/support/seed.js) → autorisé", async ({ page }) => {
    const { email, password } = UNIT_TEST_USERS.alice;
    await page.evaluate(
      ({ email, password }) => window.__pilotageTestApi.firebaseApi.signInEmail(email, password),
      { email, password }
    );
    const allowed = await page.evaluate(() => window.__pilotageTestApi.firebaseApi.isEmailAllowed("alice@example.com"));
    expect(allowed).toBe(true);
  });

  test("compte fermé (fixture bob, disabled: true) → refusé", async ({ page }) => {
    const { email, password } = UNIT_TEST_USERS.bob;
    await page.evaluate(
      ({ email, password }) => window.__pilotageTestApi.firebaseApi.signInEmail(email, password),
      { email, password }
    );
    const allowed = await page.evaluate(() => window.__pilotageTestApi.firebaseApi.isEmailAllowed("bob@example.com"));
    expect(allowed).toBe(false);
  });

  test("email vide/absent → refusé sans appel réseau", async ({ page }) => {
    // Ne nécessite aucune connexion préalable : isEmailAllowed("") retourne false avant tout
    // appel Firestore (voir js/services/firebase.js#isEmailAllowed, `if (!email) return false;`).
    const allowed = await page.evaluate(() => window.__pilotageTestApi.firebaseApi.isEmailAllowed(""));
    expect(allowed).toBe(false);
  });
});
