// "Petite parenthèse" Objectifs/EADP (28/09/2026, retour de Charles-Henri, hors numérotation LOT)
// — suivi consolidé par indicateur : `js/domain/objectives.js#updateEntry` (édition d'un suivi
// existant), `#consolidateIndicatorTracking` (vue consolidée à l'affichage — confirmée par
// Charles-Henri en réponse à la question posée avant développement : les suivis restent des
// entrées datées individuelles, AUCUNE restructuration du stockage) et `previousStepOutcome`
// (qualification du "prévu" du suivi précédent). Même principe que le reste de ce dossier
// (émulateur Firebase, jamais la production, voir tests/unit/lot1-closure.spec.js) — complète
// les futurs tests e2e (parcours UI, js/views/people.js) par une vérification directe des
// données.
//
// AVERTISSEMENT (28/09/2026) : écrit et relu manuellement à partir du code réel, mais jamais
// exécuté dans cet environnement (registre npm bloqué, voir tests/README.md). À reconfirmer au
// premier lancement réel. `support/harness.html` expose déjà `objectivesApi` (depuis LOT 11) et
// n'a pas eu besoin d'être modifié pour ce fichier.

import { test, expect } from "@playwright/test";
import { E2E_TEST_USER } from "../e2e/global-setup.js";

test.describe("Objectifs/EADP (28/09/2026) — updateEntry, consolidateIndicatorTracking, previousStepOutcome", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/support/harness.html");
    await page.waitForFunction(() => window.__pilotageTestApiReady === true);
    await page.evaluate(async ({ email, password }) => {
      await window.__pilotageTestApi.firebaseApi.signInEmail(email, password);
    }, E2E_TEST_USER);
    await page.waitForFunction(() => !!window.__pilotageTestApi.firebaseApi.getCurrentUser());
  });

  test("updateEntry modifie un suivi existant en place (note/nextSteps/status), sans jamais toucher id ni createdAt, et sans créer de nouveau suivi", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { objectivesApi } = window.__pilotageTestApi;
      const o = await objectivesApi.createObjective({ personId: null, title: `Test updateEntry ${Date.now()}` });
      await objectivesApi.addEntry(o.id, { date: "2026-09-01", note: "Premier texte", status: "in_progress" });
      const afterAdd = await objectivesApi.getObjective(o.id);
      const entry = afterAdd.entries[0];

      const updated = await objectivesApi.updateEntry(o.id, entry.id, { note: "Texte corrigé", status: "done", nextSteps: "Relancer" });
      const editedEntry = updated.entries.find((e) => e.id === entry.id);

      return {
        countAfterAdd: afterAdd.entries.length,
        countAfterUpdate: updated.entries.length,
        originalId: entry.id,
        originalCreatedAt: entry.createdAt,
        editedId: editedEntry.id,
        editedCreatedAt: editedEntry.createdAt,
        editedNote: editedEntry.note,
        editedStatus: editedEntry.status,
        editedNextSteps: editedEntry.nextSteps,
      };
    });
    expect(result.countAfterAdd).toBe(1);
    // Une édition ne doit jamais créer un second suivi — même tableau, même longueur.
    expect(result.countAfterUpdate).toBe(1);
    expect(result.editedId).toBe(result.originalId);
    expect(result.editedCreatedAt).toBe(result.originalCreatedAt);
    expect(result.editedNote).toBe("Texte corrigé");
    expect(result.editedStatus).toBe("done");
    expect(result.editedNextSteps).toBe("Relancer");
  });

  test("removeEntry (via l'action 'Supprimer' de l'édition) retire bien le suivi visé, sans toucher aux autres", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { objectivesApi } = window.__pilotageTestApi;
      const o = await objectivesApi.createObjective({ personId: null, title: `Test removeEntry ${Date.now()}` });
      await objectivesApi.addEntry(o.id, { date: "2026-09-01", note: "À garder" });
      await objectivesApi.addEntry(o.id, { date: "2026-09-05", note: "À supprimer" });
      const before = await objectivesApi.getObjective(o.id);
      const toRemove = before.entries.find((e) => e.note === "À supprimer");
      await objectivesApi.removeEntry(o.id, toRemove.id);
      const after = await objectivesApi.getObjective(o.id);
      return { beforeCount: before.entries.length, afterCount: after.entries.length, remainingNote: after.entries[0]?.note };
    });
    expect(result.beforeCount).toBe(2);
    expect(result.afterCount).toBe(1);
    expect(result.remainingNote).toBe("À garder");
  });

  test("consolidateIndicatorTracking : historique décroissant, réalisé croissant (note seule), dernier prévu = seulement celui du suivi le plus récent", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { objectivesApi } = window.__pilotageTestApi;
      const o = await objectivesApi.createObjective({ personId: null, title: `Test consolidation ${Date.now()}` });
      const ind = await objectivesApi.addIndicator(o.id, { label: "Contacts terrain", target: "6" });

      await objectivesApi.addEntry(o.id, { date: "2026-09-01", note: "Premier point", indicatorId: ind.id, nextSteps: "Relancer avant le 10" });
      await objectivesApi.addEntry(o.id, { date: "2026-09-15", note: "Deuxième point", indicatorId: ind.id, nextSteps: "Boucler avant fin de mois" });
      // Un suivi sans note (ex. juste un changement de statut) ne doit jamais polluer "réalisé".
      await objectivesApi.addEntry(o.id, { date: "2026-09-20", note: "", indicatorId: ind.id, nextSteps: "" });
      // Un suivi sur le suivi général (indicatorId absent) ne doit jamais apparaître dans la
      // consolidation scopée à l'indicateur.
      await objectivesApi.addEntry(o.id, { date: "2026-09-10", note: "Suivi général, hors indicateur" });

      const objective = await objectivesApi.getObjective(o.id);
      const forIndicator = objectivesApi.consolidateIndicatorTracking(objective, ind.id);
      const general = objectivesApi.consolidateIndicatorTracking(objective, null);

      return {
        historiqueDates: forIndicator.historique.map((e) => e.date),
        realiseTexts: forIndicator.realise.map((r) => r.text),
        realiseDatesOrder: forIndicator.realise.map((r) => r.date),
        dernierPrevu: forIndicator.dernierPrevu,
        generalRealiseTexts: general.realise.map((r) => r.text),
      };
    });
    // Historique : décroissant (le plus récent d'abord) — inclut aussi le suivi sans note.
    expect(result.historiqueDates).toEqual(["2026-09-20", "2026-09-15", "2026-09-01"]);
    // Réalisé : croissant, note-only, jamais l'entrée vide.
    expect(result.realiseTexts).toEqual(["Premier point", "Deuxième point"]);
    expect(result.realiseDatesOrder).toEqual(["2026-09-01", "2026-09-15"]);
    // Dernier prévu : uniquement celui du suivi le PLUS RÉCENT (20/09, nextSteps vide) → null,
    // jamais un cumul ni celui du 15/09 malgré son texte non vide.
    expect(result.dernierPrevu).toBeNull();
    // Le suivi général (sans indicateur) reste bien isolé de celui de l'indicateur.
    expect(result.generalRealiseTexts).toEqual(["Suivi général, hors indicateur"]);
  });

  test("consolidateIndicatorTracking : dernierPrevu reflète bien le nextSteps du suivi le plus récent quand il est renseigné", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { objectivesApi } = window.__pilotageTestApi;
      const o = await objectivesApi.createObjective({ personId: null, title: `Test dernierPrevu ${Date.now()}` });
      await objectivesApi.addEntry(o.id, { date: "2026-09-01", note: "Ancien point", nextSteps: "Ancien prévu (ne doit plus apparaître)" });
      await objectivesApi.addEntry(o.id, { date: "2026-09-15", note: "Point récent", nextSteps: "Prévu avant le prochain point" });
      const objective = await objectivesApi.getObjective(o.id);
      return objectivesApi.consolidateIndicatorTracking(objective, null).dernierPrevu;
    });
    expect(result).toEqual({ date: "2026-09-15", text: "Prévu avant le prochain point" });
  });

  test("previousStepOutcome : persiste une valeur valide sur le NOUVEAU suivi, retombe à null pour une valeur invalide ou absente", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { objectivesApi } = window.__pilotageTestApi;
      const o = await objectivesApi.createObjective({ personId: null, title: `Test previousStepOutcome ${Date.now()}` });
      await objectivesApi.addEntry(o.id, { date: "2026-09-01", note: "Premier suivi" }); // rien à qualifier, pas de previousStepOutcome
      await objectivesApi.addEntry(o.id, { date: "2026-09-10", note: "Deuxième suivi", previousStepOutcome: "postponed" });
      await objectivesApi.addEntry(o.id, { date: "2026-09-20", note: "Troisième suivi", previousStepOutcome: "not-a-real-value" });
      const after = await objectivesApi.getObjective(o.id);
      return {
        values: objectivesApi.PREVIOUS_STEP_OUTCOMES,
        first: after.entries[0].previousStepOutcome,
        second: after.entries[1].previousStepOutcome,
        third: after.entries[2].previousStepOutcome,
      };
    });
    expect(result.values).toEqual(["done", "not_done", "postponed"]);
    expect(result.first).toBeNull();
    expect(result.second).toBe("postponed");
    expect(result.third).toBeNull();
  });
});
