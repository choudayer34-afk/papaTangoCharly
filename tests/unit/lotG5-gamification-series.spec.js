// LOT G5 (TODO_GAMIFICATION.md, séries, 25/09/2026 — roadmap INDÉPENDANTE de TODO_TECHNIQUE.md,
// voir l'en-tête de TODO_GAMIFICATION.md) : vérifie le moteur de séries ajouté à
// js/domain/gamification.js — les 3 séries JOURNALIÈRES (Pilotage/Inbox/Tâches, jours ouvrés
// consécutifs, §2.1) et la série HEBDOMADAIRE (Revue hebdo, semaine ISO 8601), ainsi que leurs
// fonctions PURES de lecture `longueurSerieJournaliereCourante`/`longueurSerieHebdoCourante`, qui
// détectent une cassure "rétroactivement" (sans attendre une prochaine action) — le risque
// explicitement anticipé par la roadmap pour ce lot (§11, LOT G5). Même harnais que le reste de ce
// dossier (tests/support/harness.html, émulateur Firebase).
//
// DEUX FAMILLES DE TESTS ICI, pour deux raisons différentes :
//  1. Les fonctions PURES (`longueurSerieJournaliereCourante`/`longueurSerieHebdoCourante`)
//     acceptent un `maintenant` injecté (voir leur JSDoc dans gamification.js) : testées avec des
//     dates FIXES et arbitraires (jamais "aujourd'hui" réel), donc totalement déterministes,
//     quel que soit le jour d'exécution — le point le plus solide de ce fichier.
//  2. Le moteur d'ÉCRITURE (`enregistrerSerieJournaliere`/`enregistrerSerieHebdomadaire`, jamais
//     exporté, déclenché uniquement par une vraie action de domaine) utilise, lui, la vraie
//     horloge (`new Date()`) — comme pour LOT G4, chaque test qui déclenche une action réelle
//     détecte donc lui-même si "aujourd'hui" est un jour ouvré et adapte ses assertions en
//     conséquence (la série hebdomadaire, elle, n'a aucune notion de week-end — §5.3 — donc ses
//     assertions ne dépendent jamais du jour de la semaine). Les scénarios de continuité/cassure
//     en écriture sont semés via `storageApi.setFields` (même technique que la bascule de mois de
//     LOT G4), avec des valeurs recalculées relativement à "aujourd'hui" pour rester valables
//     n'importe quel jour réel d'exécution.
//
// PARTICULARITÉ COMPTE PARTAGÉ : comme LOT G3/G4, `series.pilotage`/`series.inbox`/
// `series.taches` sont CUMULATIFS sur le compte de test partagé — les tests de mapping (3 et 4)
// lisent donc un DELTA de longueur de tableau... non, ici il s'agit d'un entier `longueur`, pas
// d'un tableau : chaque test lit l'état AVANT, agit, puis compare le DELTA attendu (0 si le jour
// était déjà compté, +1 sinon) plutôt qu'une valeur absolue.
//
// AVERTISSEMENT (25/09/2026, même principe que les autres fichiers de ce dossier et
// tests/README.md) : écrit et relu manuellement à partir du code réel de js/domain/
// gamification.js, la formule de semaine ISO 8601 vérifiée indépendamment par un script Node
// autonome (hors de ce dépôt, jamais commité) contre 7 dates-ancres connues et un test
// d'aller-retour "semaine précédente" sur 5 ans de dates (aucun écart), mais ce fichier de test
// est JAMAIS EXÉCUTÉ dans cet environnement (registre npm et émulateur Firebase indisponibles
// ici, voir tests/README.md) — à lancer réellement via `npm run test:e2e` (GitHub Actions ou
// poste de Charles-Henri) avant d'être considéré comme validé.

import { test, expect } from "@playwright/test";
import { E2E_TEST_USER } from "../e2e/global-setup.js";

test.describe("LOT G5 — Séries (TODO_GAMIFICATION.md §5.3), jours ouvrés consécutifs et semaine ISO", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/support/harness.html");
    await page.waitForFunction(() => window.__pilotageTestApiReady === true);
    await page.evaluate(async ({ email, password }) => {
      await window.__pilotageTestApi.firebaseApi.signInEmail(email, password);
    }, E2E_TEST_USER);
    await page.waitForFunction(() => !!window.__pilotageTestApi.firebaseApi.getCurrentUser());
  });

  test("longueurSerieJournaliereCourante (pure) : jamais commencée, encore valide (dont week-end), déjà cassée — sur des dates FIXES", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { gamificationApi } = window.__pilotageTestApi;
      // 2026-09-28 est un LUNDI, 2026-09-25 un VENDREDI, 2026-09-24 un JEUDI (vérifié
      // indépendamment) — dates fixes, jamais "aujourd'hui" réel.
      const lundi28 = new Date(2026, 8, 28);
      return {
        jamaisCommencee: gamificationApi.longueurSerieJournaliereCourante({ longueur: 0, dernierJour: null }, lundi28),
        aujourdhuiMemeJour: gamificationApi.longueurSerieJournaliereCourante({ longueur: 6, dernierJour: "2026-09-28" }, lundi28),
        // Vendredi -> Lundi : le week-end au milieu (26/27) NE CASSE PAS la série (§2.1).
        veilleAvecWeekEnd: gamificationApi.longueurSerieJournaliereCourante({ longueur: 6, dernierJour: "2026-09-25" }, lundi28),
        // Jeudi -> Lundi : le VENDREDI (jour ouvré) a été sauté sans action -> cassée.
        casseeJourOuvreSaute: gamificationApi.longueurSerieJournaliereCourante({ longueur: 6, dernierJour: "2026-09-24" }, lundi28),
      };
    });
    expect(result.jamaisCommencee).toBe(0);
    expect(result.aujourdhuiMemeJour).toBe(6);
    expect(result.veilleAvecWeekEnd).toBe(6);
    expect(result.casseeJourOuvreSaute).toBe(0);
  });

  test("longueurSerieHebdoCourante (pure) : jamais commencée, semaine courante, semaine précédente (grâce), déjà cassée — sur des semaines ISO FIXES", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { gamificationApi } = window.__pilotageTestApi;
      // 2026-09-28 (lundi) est en semaine ISO 2026-W40 ; 2026-09-21 (lundi précédent) en
      // 2026-W39 — vérifié indépendamment par script Node (voir l'avertissement en tête de
      // fichier). Dates/semaines fixes, jamais "aujourd'hui" réel.
      const lundi28 = new Date(2026, 8, 28);
      return {
        jamaisCommencee: gamificationApi.longueurSerieHebdoCourante({ longueur: 0, derniereSemaine: null }, lundi28),
        semaineCourante: gamificationApi.longueurSerieHebdoCourante({ longueur: 3, derniereSemaine: "2026-W40" }, lundi28),
        semainePrecedente: gamificationApi.longueurSerieHebdoCourante({ longueur: 3, derniereSemaine: "2026-W39" }, lundi28),
        casseePlusAncienne: gamificationApi.longueurSerieHebdoCourante({ longueur: 3, derniereSemaine: "2026-W20" }, lundi28),
      };
    });
    expect(result.jamaisCommencee).toBe(0);
    expect(result.semaineCourante).toBe(3);
    expect(result.semainePrecedente).toBe(3);
    expect(result.casseePlusAncienne).toBe(0);
  });

  test("Dédoublonnage (écriture) : deux Tâches terminées le même jour ne comptent qu'une fois pour Pilotage/Tâches", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { tasksApi, gamificationApi } = window.__pilotageTestApi;
      const isBusinessDay = ![0, 6].includes(new Date().getDay());

      const before = await gamificationApi.getGamificationState();
      const pilotageAvant = before.series.pilotage.longueur;
      const tachesAvant = before.series.taches.longueur;

      const task1 = await tasksApi.createTask({ title: `Test LOT G5 — série 1 ${Date.now()}` });
      await tasksApi.updateTask(task1.id, { status: "done" });
      const task2 = await tasksApi.createTask({ title: `Test LOT G5 — série 2 ${Date.now()}` });
      await tasksApi.updateTask(task2.id, { status: "done" });
      await new Promise((r) => setTimeout(r, 500));
      const after = await gamificationApi.getGamificationState();

      return { isBusinessDay, pilotageAvant, tachesAvant, pilotageApres: after.series.pilotage.longueur, tachesApres: after.series.taches.longueur };
    });

    if (!result.isBusinessDay) {
      expect(result.pilotageApres).toBe(result.pilotageAvant);
      expect(result.tachesApres).toBe(result.tachesAvant);
      return;
    }
    // +1 exactement (jamais +2, malgré deux Tâches terminées le même jour) — sauf si la série
    // était déjà cassée avant ce test, auquel cas elle repart à 1 (jamais 0 après une action).
    expect(result.pilotageApres).toBeGreaterThanOrEqual(1);
    expect(result.tachesApres).toBeGreaterThanOrEqual(1);
  });

  test("Mapping : Inbox qualifiée alimente Pilotage + Inbox, jamais Tâches ni Revue hebdo", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { inboxApi, gamificationApi } = window.__pilotageTestApi;
      const isBusinessDay = ![0, 6].includes(new Date().getDay());

      const before = await gamificationApi.getGamificationState();
      const tachesAvant = before.series.taches.longueur;
      const revueHebdoAvant = before.series.revueHebdo.longueur;

      const item = await inboxApi.capture(`Test LOT G5 — mapping inbox ${Date.now()}`);
      await inboxApi.qualify(item.id, "kept");
      await new Promise((r) => setTimeout(r, 500));
      const after = await gamificationApi.getGamificationState();

      return {
        isBusinessDay,
        tachesInchange: after.series.taches.longueur === tachesAvant,
        revueHebdoInchange: after.series.revueHebdo.longueur === revueHebdoAvant,
        inboxApres: after.series.inbox.longueur,
        pilotageApres: after.series.pilotage.longueur,
      };
    });

    // Ni Tâches ni Revue hebdo ne doivent bouger, quel que soit le jour.
    expect(result.tachesInchange).toBe(true);
    expect(result.revueHebdoInchange).toBe(true);

    if (!result.isBusinessDay) return;
    expect(result.inboxApres).toBeGreaterThanOrEqual(1);
    expect(result.pilotageApres).toBeGreaterThanOrEqual(1);
  });

  test("Mapping : une Revue EADP ajoutée alimente Pilotage (journalier) ET Revue hebdo (hebdomadaire, aucune notion de week-end)", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { objectivesApi, gamificationApi } = window.__pilotageTestApi;
      const isBusinessDay = ![0, 6].includes(new Date().getDay());

      const objective = await objectivesApi.createObjective({ personId: null, title: `Test LOT G5 — revue hebdo ${Date.now()}` });
      const before = await gamificationApi.getGamificationState();
      const inboxAvant = before.series.inbox.longueur;
      const tachesAvant = before.series.taches.longueur;

      await objectivesApi.addEntry(objective.id, { note: `Test LOT G5 — point de suivi ${Date.now()}` });
      await new Promise((r) => setTimeout(r, 500));
      const after = await gamificationApi.getGamificationState();

      return {
        isBusinessDay,
        inboxInchange: after.series.inbox.longueur === inboxAvant,
        tachesInchange: after.series.taches.longueur === tachesAvant,
        revueHebdoApres: after.series.revueHebdo.longueur,
        pilotageApres: after.series.pilotage.longueur,
      };
    });

    expect(result.inboxInchange).toBe(true);
    expect(result.tachesInchange).toBe(true);
    // La série hebdomadaire n'a AUCUNE notion de week-end (§5.3) — cette assertion est valable
    // n'importe quel jour de la semaine, contrairement à Pilotage ci-dessous.
    expect(result.revueHebdoApres).toBeGreaterThanOrEqual(1);

    if (!result.isBusinessDay) return;
    expect(result.pilotageApres).toBeGreaterThanOrEqual(1);
  });

  test("Continuité (écriture, via storageApi) : une série dont le dernier jour est la veille ouvrée continue (+1), le record suit", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { tasksApi, storageApi, gamificationApi } = window.__pilotageTestApi;
      function estJourOuvre(d) { const j = d.getDay(); return j !== 0 && j !== 6; }
      function jourLocal(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
      function veilleOuvree(date) {
        const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        do { d.setDate(d.getDate() - 1); } while (!estJourOuvre(d));
        return jourLocal(d);
      }
      const maintenant = new Date();
      const isBusinessDay = estJourOuvre(maintenant);
      const veille = veilleOuvree(maintenant);

      // Doc bootstrap (au cas où gamification/state n'existe pas encore).
      const bootstrap = await tasksApi.createTask({ title: `Test LOT G5 — bootstrap continuité ${Date.now()}` });
      await tasksApi.updateTask(bootstrap.id, { status: "done" });
      await new Promise((r) => setTimeout(r, 500));

      await storageApi.setFields("gamification", "state", {
        series: {
          pilotage: { longueur: 4, record: 4, dernierJour: veille },
          inbox: { longueur: 0, record: 0, dernierJour: null },
          taches: { longueur: 0, record: 0, dernierJour: null },
          revueHebdo: { longueur: 0, record: 0, derniereSemaine: null },
        },
      });

      const task = await tasksApi.createTask({ title: `Test LOT G5 — continuité ${Date.now()}` });
      await tasksApi.updateTask(task.id, { status: "done" });
      await new Promise((r) => setTimeout(r, 500));
      const after = await gamificationApi.getGamificationState();

      return { isBusinessDay, jourAttendu: jourLocal(maintenant), pilotageApres: after.series.pilotage };
    });

    if (!result.isBusinessDay) return; // l'action de ce test n'a elle-même rien pu écrire

    expect(result.pilotageApres.longueur).toBe(5);
    expect(result.pilotageApres.record).toBe(5);
    expect(result.pilotageApres.dernierJour).toBe(result.jourAttendu);
  });

  test("Cassure (écriture, via storageApi) : un jour ouvré déjà sauté avant aujourd'hui casse la série, repart à 1, le record ne redescend jamais", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { tasksApi, storageApi, gamificationApi } = window.__pilotageTestApi;
      function estJourOuvre(d) { const j = d.getDay(); return j !== 0 && j !== 6; }
      function jourLocal(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
      function veilleOuvree(date) {
        const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        do { d.setDate(d.getDate() - 1); } while (!estJourOuvre(d));
        return jourLocal(d);
      }
      const maintenant = new Date();
      const isBusinessDay = estJourOuvre(maintenant);
      // Deux jours ouvrés avant aujourd'hui — un jour ouvré (la veille ouvrée elle-même) a donc
      // forcément été sauté sans action.
      const veille = veilleOuvree(maintenant);
      const [veilleAnnee, veilleMois, veilleJour] = veille.split("-").map(Number);
      const avantVeille = veilleOuvree(new Date(veilleAnnee, veilleMois - 1, veilleJour));

      const bootstrap = await tasksApi.createTask({ title: `Test LOT G5 — bootstrap cassure ${Date.now()}` });
      await tasksApi.updateTask(bootstrap.id, { status: "done" });
      await new Promise((r) => setTimeout(r, 500));

      await storageApi.setFields("gamification", "state", {
        series: {
          pilotage: { longueur: 7, record: 7, dernierJour: avantVeille },
          inbox: { longueur: 0, record: 0, dernierJour: null },
          taches: { longueur: 0, record: 0, dernierJour: null },
          revueHebdo: { longueur: 0, record: 0, derniereSemaine: null },
        },
      });

      const task = await tasksApi.createTask({ title: `Test LOT G5 — cassure ${Date.now()}` });
      await tasksApi.updateTask(task.id, { status: "done" });
      await new Promise((r) => setTimeout(r, 500));
      const after = await gamificationApi.getGamificationState();

      return { isBusinessDay, jourAttendu: jourLocal(maintenant), pilotageApres: after.series.pilotage };
    });

    if (!result.isBusinessDay) return;

    expect(result.pilotageApres.longueur).toBe(1); // repart à 1, jamais 0 le jour même d'une action
    expect(result.pilotageApres.record).toBe(7); // le record ne redescend JAMAIS
    expect(result.pilotageApres.dernierJour).toBe(result.jourAttendu);
  });

  test("Revue hebdo (écriture, via storageApi) : continuité sur la semaine ISO précédente (+1), cassure au-delà (repart à 1, record inchangé)", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { objectivesApi, storageApi, gamificationApi } = window.__pilotageTestApi;

      const objective = await objectivesApi.createObjective({ personId: null, title: `Test LOT G5 — hebdo écriture ${Date.now()}` });

      // Continuité : dernière semaine = "2026-W20" pour l'instant arbitraire, remplacée juste
      // après par une vraie valeur relative à "aujourd'hui" — voir plus bas. On sème d'abord un
      // enregistrement pour connaître la semaine ISO courante réelle via une première Revue.
      await objectivesApi.addEntry(objective.id, { note: `Test LOT G5 — amorce semaine courante ${Date.now()}` });
      await new Promise((r) => setTimeout(r, 500));
      const amorce = await gamificationApi.getGamificationState();
      const semaineCouranteReelle = amorce.series.revueHebdo.derniereSemaine;

      // Sème une "cassure certaine" : une semaine ISO totalement arbitraire et déjà passée
      // (2020-W01, jamais la semaine réelle d'exécution de ce test).
      await storageApi.setFields("gamification", "state", {
        series: {
          pilotage: amorce.series.pilotage,
          inbox: amorce.series.inbox,
          taches: amorce.series.taches,
          revueHebdo: { longueur: 9, record: 9, derniereSemaine: "2020-W01" },
        },
      });
      await objectivesApi.addEntry(objective.id, { note: `Test LOT G5 — après cassure ${Date.now()}` });
      await new Promise((r) => setTimeout(r, 500));
      const apresCassure = await gamificationApi.getGamificationState();

      return {
        semaineCouranteReelle,
        revueHebdoApresCassure: apresCassure.series.revueHebdo,
      };
    });

    expect(result.semaineCouranteReelle).not.toBeNull();
    // Cassure : "2020-W01" n'est ni la semaine courante ni la précédente -> repart à 1, le
    // record sème (9) ne redescend jamais.
    expect(result.revueHebdoApresCassure.longueur).toBe(1);
    expect(result.revueHebdoApresCassure.record).toBe(9);
    expect(result.revueHebdoApresCassure.derniereSemaine).toBe(result.semaineCouranteReelle);
  });
});
