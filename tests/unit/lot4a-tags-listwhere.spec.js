// TEST-013 (AUDIT_TESTS.md), décliné pour la partie TODO-009A concernant js/domain/tags.js —
// régression sur `addTag`/`removeTagByName`, convertis en LOT 4A de `storage.listAll()` vers
// `storage.listWhere(COLLECTION, [["entityType", type], ["entityId", id]])` (voir le commentaire
// détaillé au-dessus de `addTag` dans tags.js). Le comportement observable ne doit pas changer :
// toujours pas de doublon (insensible à la casse et au "#"), toujours scopé à la bonne fiche.
//
// `deleteTagEverywhere` n'est PAS couvert ici : volontairement laissé sur `storage.listAll()`
// (voir son commentaire dans tags.js), donc hors du changement que ce test vise à protéger — un
// test de régression dessus n'apporterait rien de plus que ce que couvrait déjà le comportement
// avant LOT 4A.
//
// AVERTISSEMENT (21/09/2026) : écrit et relu manuellement à partir du code réel
// (js/domain/tags.js), mais jamais exécuté dans l'environnement où il a été rédigé (registre npm
// bloqué, voir tests/README.md). À reconfirmer au premier lancement réel.

import { test, expect } from "@playwright/test";
import { E2E_TEST_USER } from "../e2e/global-setup.js";

test.describe("TEST-013 (décliné) — tags.js addTag/removeTagByName après conversion à listWhere (LOT 4A, TODO-009A)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/support/harness.html");
    await page.waitForFunction(() => window.__pilotageTestApiReady === true);
    await page.evaluate(async ({ email, password }) => {
      await window.__pilotageTestApi.firebaseApi.signInEmail(email, password);
    }, E2E_TEST_USER);
    await page.waitForFunction(() => !!window.__pilotageTestApi.firebaseApi.getCurrentUser());
  });

  test("addTag : pas de doublon insensible à la casse/au '#', scopé à la bonne fiche", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { tagsApi } = window.__pilotageTestApi;
      const entityId = `test-lot4a-tags-${Date.now()}`;
      const otherEntityId = `test-lot4a-tags-other-${Date.now()}`;

      const first = await tagsApi.addTag("Task", entityId, "#Urgent");
      const duplicate = await tagsApi.addTag("Task", entityId, "urgent"); // même tag, casse et # différents
      const other = await tagsApi.addTag("Task", otherEntityId, "Urgent"); // même nom, autre fiche : pas un doublon

      const allForEntity = await tagsApi.listAll();
      const entityTags = tagsApi.tagsFor(allForEntity, "Task", entityId);
      const otherTags = tagsApi.tagsFor(allForEntity, "Task", otherEntityId);

      return {
        duplicateReturnedExisting: duplicate.id === first.id,
        entityTagCount: entityTags.length,
        otherTagCount: otherTags.length,
        otherIsDistinctDoc: other.id !== first.id,
        storedTagKeepsOriginalCasing: first.tag === "Urgent",
      };
    });

    expect(result.duplicateReturnedExisting).toBe(true);
    expect(result.entityTagCount).toBe(1);
    expect(result.otherTagCount).toBe(1);
    expect(result.otherIsDistinctDoc).toBe(true);
    expect(result.storedTagKeepsOriginalCasing).toBe(true);
  });

  test("removeTagByName : retire par nom (insensible à la casse), ne touche pas la même étiquette sur une autre fiche, ne casse rien si absente", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { tagsApi } = window.__pilotageTestApi;
      const entityId = `test-lot4a-tags-rm-${Date.now()}`;
      const otherEntityId = `test-lot4a-tags-rm-other-${Date.now()}`;

      await tagsApi.addTag("Project", entityId, "#Prioritaire");
      await tagsApi.addTag("Project", otherEntityId, "Prioritaire");

      // Ne fait rien si la fiche ne porte pas ce tag (jamais une erreur) — vérifié avant le retrait réel.
      await tagsApi.removeTagByName("Project", entityId, "inexistant");

      await tagsApi.removeTagByName("Project", entityId, "prioritaire"); // casse différente de la saisie d'origine

      const all = await tagsApi.listAll();
      return {
        entityStillHasTag: tagsApi.tagsFor(all, "Project", entityId).length > 0,
        otherStillHasTag: tagsApi.tagsFor(all, "Project", otherEntityId).length === 1,
      };
    });

    expect(result.entityStillHasTag).toBe(false);
    expect(result.otherStillHasTag).toBe(true);
  });
});
