// LOT 11 (TODO-024, TODO_TECHNIQUE.md) — modèle Objectif unifié (js/domain/objectives.js) :
// mêmes tests unitaires que le reste de ce dossier (harnais + émulateur Firebase, jamais la
// production — voir tests/unit/lot1-closure.spec.js pour le même principe). Complète les tests
// e2e (tests/e2e/lot11-*.spec.js, qui couvrent le parcours UI) par une vérification directe des
// données, plus robuste pour les garanties de non-régression/non-cascade demandées par
// Charles-Henri (section 12 de son arbitrage LOT 11) : indicateurs, points de suivi structurés,
// et indépendance de `hiddenFromPrep` vis-à-vis de `direction` (TODO-025).
//
// AVERTISSEMENT (22/09/2026) : écrit et relu manuellement à partir du code réel, mais jamais
// exécuté dans cet environnement (registre npm bloqué, voir tests/README.md). À reconfirmer au
// premier lancement réel.

import { test, expect } from "@playwright/test";
import { E2E_TEST_USER } from "../e2e/global-setup.js";

test.describe("LOT 11 — modèle Objectif unifié, indicateurs, points de suivi, TODO-025", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/support/harness.html");
    await page.waitForFunction(() => window.__pilotageTestApiReady === true);
    await page.evaluate(async ({ email, password }) => {
      await window.__pilotageTestApi.firebaseApi.signInEmail(email, password);
    }, E2E_TEST_USER);
    await page.waitForFunction(() => !!window.__pilotageTestApi.firebaseApi.getCurrentUser());
  });

  test("Objectif personnel (personId: null) et objectif de collaborateur (personId renseigné) sont le même type de document, mêmes champs enrichis disponibles", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { objectivesApi } = window.__pilotageTestApi;
      const personal = await objectivesApi.createObjective({
        personId: null,
        title: `Test LOT 11 — perso ${Date.now()}`,
        category: "Managérial",
        period: "2026",
        smart: { specific: "Être plus clair en réunion" },
      });
      const eadp = await objectivesApi.createObjective({
        personId: "fake-person-id-" + Date.now(),
        title: `Test LOT 11 — eadp ${Date.now()}`,
        category: "Technique",
        scope: "individual",
        period: "2026",
      });
      return {
        personalPersonId: personal.personId,
        personalCategory: personal.category,
        personalSmartSpecific: personal.smart?.specific,
        personalIndicators: personal.indicators,
        eadpPersonId: eadp.personId,
        eadpScope: eadp.scope,
        sameShape: Object.keys(personal).sort().join(",") === Object.keys(eadp).sort().join(","),
      };
    });
    expect(result.personalPersonId).toBeNull();
    expect(result.personalCategory).toBe("Managérial");
    expect(result.personalSmartSpecific).toBe("Être plus clair en réunion");
    expect(result.personalIndicators).toEqual([]);
    expect(result.eadpPersonId).toContain("fake-person-id-");
    expect(result.eadpScope).toBe("individual");
    // Même jeu de champs pour les deux — un seul modèle, jamais deux structures distinctes
    // (arbitrage explicite de Charles-Henri, voir le commentaire en tête de ce fichier de
    // domaine).
    expect(result.sameShape).toBe(true);
  });

  test("Un objectif simple, sans aucun champ 'Détails' renseigné, reste utilisable tel quel (pas de régression pour l'usage minimal)", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { objectivesApi } = window.__pilotageTestApi;
      const o = await objectivesApi.createObjective({ personId: null, title: `Test LOT 11 — minimal ${Date.now()}` });
      return { title: o.title, status: o.status, entries: o.entries, indicators: o.indicators, period: o.period };
    });
    expect(result.status).toBe("active");
    expect(result.entries).toEqual([]);
    expect(result.indicators).toEqual([]);
    expect(result.period == null).toBe(true);
  });

  test("Indicateurs : création multiple, modification de statut, suppression sans cascade sur les points de suivi déjà enregistrés", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { objectivesApi } = window.__pilotageTestApi;
      const o = await objectivesApi.createObjective({ personId: null, title: `Test LOT 11 — indicateurs unitaire ${Date.now()}` });

      const ind1 = await objectivesApi.addIndicator(o.id, { label: "Contacts terrain", target: "6" });
      const ind2 = await objectivesApi.addIndicator(o.id, { label: "Documentation" });
      const afterTwoIndicators = await objectivesApi.getObjective(o.id);

      // updateIndicator (comme updateObjective) renvoie le document Objectif COMPLET mis à
      // jour, pas l'indicateur seul — il faut le retrouver dans `indicators` par son id.
      const updatedObjective = await objectivesApi.updateIndicator(o.id, ind1.id, { status: "in_progress", currentValue: "3" });
      const updatedInd1 = updatedObjective.indicators.find((i) => i.id === ind1.id);

      await objectivesApi.addEntry(o.id, { date: "2026-09-20", note: "Point sur la documentation", indicatorId: ind2.id, status: "done" });
      const afterEntry = await objectivesApi.getObjective(o.id);

      await objectivesApi.removeIndicator(o.id, ind2.id);
      const afterRemoval = await objectivesApi.getObjective(o.id);

      return {
        twoIndicatorsCount: afterTwoIndicators.indicators.length,
        ind1DefaultStatus: ind1.status,
        updatedStatus: updatedInd1.status,
        updatedCurrentValue: updatedInd1.currentValue,
        entryCountAfterEntry: afterEntry.entries.length,
        entryIndicatorId: afterEntry.entries[0].indicatorId,
        indicatorsAfterRemoval: afterRemoval.indicators.map((i) => i.id),
        // Le point de suivi qui référençait l'indicateur supprimé doit rester intact : pas de
        // cascade (js/domain/objectives.js#removeIndicator ne touche jamais `entries`).
        entryStillThereAfterRemoval: afterRemoval.entries.length,
        entryStillReferencesRemovedIndicator: afterRemoval.entries[0].indicatorId === ind2.id,
      };
    });
    expect(result.twoIndicatorsCount).toBe(2);
    expect(result.ind1DefaultStatus).toBe("todo");
    expect(result.updatedStatus).toBe("in_progress");
    expect(result.updatedCurrentValue).toBe("3");
    expect(result.entryCountAfterEntry).toBe(1);
    expect(result.entryIndicatorId).toBeTruthy();
    expect(result.indicatorsAfterRemoval).toHaveLength(1);
    expect(result.entryStillThereAfterRemoval).toBe(1);
    expect(result.entryStillReferencesRemovedIndicator).toBe(true);
  });

  test("Points de suivi : ajout, historique conservé, référence optionnelle vers une fiche existante, valeurs par défaut sûres", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { objectivesApi } = window.__pilotageTestApi;
      const o = await objectivesApi.createObjective({ personId: null, title: `Test LOT 11 — suivis unitaire ${Date.now()}` });

      await objectivesApi.addEntry(o.id, { date: "2026-09-01", note: "Premier point" });
      await objectivesApi.addEntry(o.id, {
        date: "2026-09-15",
        note: "Deuxième point",
        nextSteps: "Relancer la semaine prochaine",
        ref: { type: "Project", id: "some-project-id" },
      });
      // Statut/indicateur invalides ou absents : ne doivent jamais planter ni être acceptés tels
      // quels (js/domain/objectives.js#addEntry — `INDICATOR_STATUSES.includes(status) ? status :
      // null`).
      await objectivesApi.addEntry(o.id, { date: "2026-09-20", note: "Troisième point", status: "not-a-real-status" });

      const after = await objectivesApi.getObjective(o.id);
      return {
        count: after.entries.length,
        secondRef: after.entries[1].ref,
        secondNextSteps: after.entries[1].nextSteps,
        thirdStatus: after.entries[2].status,
        firstIndicatorId: after.entries[0].indicatorId,
      };
    });
    expect(result.count).toBe(3);
    expect(result.secondRef).toEqual({ type: "Project", id: "some-project-id" });
    expect(result.secondNextSteps).toBe("Relancer la semaine prochaine");
    expect(result.thirdStatus).toBeNull();
    expect(result.firstIndicatorId).toBeNull();
  });

  test("TODO-025 : hiddenFromPrep est indépendant de direction, coché/décoché à la création, sans nouvelle valeur de direction", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { followUpsApi } = window.__pilotageTestApi;
      const waitingHidden = await followUpsApi.createFollowUp({
        personId: "fake-person-" + Date.now(),
        title: "Test LOT 11 — waiting_on masqué",
        direction: "waiting_on",
        hiddenFromPrep: true,
      });
      const waitingVisible = await followUpsApi.createFollowUp({
        personId: "fake-person-" + Date.now(),
        title: "Test LOT 11 — waiting_on visible",
        direction: "waiting_on",
      });
      const toTellHidden = await followUpsApi.createFollowUp({
        personId: "fake-person-" + Date.now(),
        title: "Test LOT 11 — to_tell masqué",
        direction: "to_tell",
        hiddenFromPrep: true,
      });
      return {
        directions: followUpsApi.DIRECTIONS,
        waitingHidden: waitingHidden.hiddenFromPrep,
        waitingHiddenDirection: waitingHidden.direction,
        waitingVisible: waitingVisible.hiddenFromPrep,
        toTellHidden: toTellHidden.hiddenFromPrep,
        toTellHiddenDirection: toTellHidden.direction,
      };
    });
    // Aucune nouvelle valeur de direction créée pour ce lot (en particulier pas de "suivi
    // personnel", explicitement écarté par Charles-Henri).
    expect(result.directions).toEqual(["waiting_on", "to_tell"]);
    expect(result.waitingHidden).toBe(true);
    expect(result.waitingHiddenDirection).toBe("waiting_on");
    expect(result.waitingVisible).toBe(false);
    expect(result.toTellHidden).toBe(true);
    expect(result.toTellHiddenDirection).toBe("to_tell");
  });
});
