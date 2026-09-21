// TODO-004 (LOT 2, TODO_TECHNIQUE.md) — "étendre `maybeNotifyStalledOrLate()` aux suivis en
// contrôle dépassé (`followUpsApi.isControlDue`)." Validation directement inspirée de TEST-005
// (AUDIT_TESTS.md, "couverture des cas d'erreur/retard"), déclinée ici pour ce cas précis plutôt
// que reprise telle quelle (TEST-005 porte à l'origine sur l'écran d'erreur d'authentification,
// un sujet sans rapport — voir TODO-004 dans TODO_TECHNIQUE.md pour cette précision).
//
// Portée assumée : ce test valide la logique de détection ajoutée (`followUpsApi.isControlDue`,
// utilisée telle quelle par `js/app.js#maybeNotifyStalledOrLate`) et le changement de statut
// utilisé par les boutons "🔁 Relancer / ✅ Réglé" (`followUpsApi.setStatus`). Il ne déclenche PAS
// la vraie notification navigateur : `maybeNotifyStalledOrLate` n'est pas exportée par js/app.js
// (fonction interne au module), et l'API `Notification` du navigateur n'a d'intérêt à tester que
// bout en bout (permission accordée, contenu du message) — hors de portée d'un test unitaire via
// harness.html. Voir tests/README.md pour cette limite assumée.
//
// AVERTISSEMENT (21/09/2026) : écrit et relu manuellement à partir du code réel
// (js/domain/followups.js#isControlDue/setStatus), mais jamais exécuté dans l'environnement où
// il a été rédigé (registre npm bloqué, voir tests/README.md). À reconfirmer au premier
// lancement réel.

import { test, expect } from "@playwright/test";
import { E2E_TEST_USER } from "../e2e/global-setup.js";

test.describe("TEST-005 (décliné) — détection des Suivis en retard de contrôle, action rapide de statut", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/support/harness.html");
    await page.waitForFunction(() => window.__pilotageTestApiReady === true);
    await page.evaluate(async ({ email, password }) => {
      await window.__pilotageTestApi.firebaseApi.signInEmail(email, password);
    }, E2E_TEST_USER);
    await page.waitForFunction(() => !!window.__pilotageTestApi.firebaseApi.getCurrentUser());
  });

  test("isControlDue : vrai seulement pour une date de contrôle dépassée et un statut non 'done'", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { followUpsApi } = window.__pilotageTestApi;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayIso = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowIso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

      const overdue = await followUpsApi.createFollowUp({
        title: `Test LOT 2 — suivi en retard ${Date.now()}`,
        personId: "test-lot2-person",
        controlDate: yesterdayIso,
      });
      const future = await followUpsApi.createFollowUp({
        title: `Test LOT 2 — suivi pas encore dû ${Date.now()}`,
        personId: "test-lot2-person",
        controlDate: tomorrowIso,
      });
      const overdueButDone = await followUpsApi.createFollowUp({
        title: `Test LOT 2 — suivi en retard mais réglé ${Date.now()}`,
        personId: "test-lot2-person",
        controlDate: yesterdayIso,
        status: "done",
      });
      const noDate = await followUpsApi.createFollowUp({
        title: `Test LOT 2 — suivi sans date de contrôle ${Date.now()}`,
        personId: "test-lot2-person",
      });

      return {
        overdue: followUpsApi.isControlDue(overdue),
        future: followUpsApi.isControlDue(future),
        overdueButDone: followUpsApi.isControlDue(overdueButDone),
        noDate: followUpsApi.isControlDue(noDate),
      };
    });
    expect(result.overdue).toBe(true);
    expect(result.future).toBe(false);
    expect(result.overdueButDone).toBe(false);
    expect(result.noDate).toBe(false);
  });

  test("setStatus : chemin exact utilisé par les boutons '🔁 Relancer' / '✅ Réglé' (js/views/people.js, followupsOverview.js)", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { followUpsApi } = window.__pilotageTestApi;
      const f = await followUpsApi.createFollowUp({
        title: `Test LOT 2 — relance puis règlement ${Date.now()}`,
        personId: "test-lot2-person",
      });
      const initialStatus = f.status;
      const relaunched = await followUpsApi.setStatus(f.id, "relaunched");
      const done = await followUpsApi.setStatus(f.id, "done");
      return { initialStatus, relaunchedStatus: relaunched.status, doneStatus: done.status, title: done.title };
    });
    expect(result.initialStatus).toBe("waiting");
    expect(result.relaunchedStatus).toBe("relaunched");
    expect(result.doneStatus).toBe("done");
    expect(result.title).toContain("relance puis règlement");
  });
});
