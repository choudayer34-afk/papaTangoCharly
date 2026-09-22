// LOT G4 (TODO_GAMIFICATION.md, badges mensuels, 25/09/2026 — roadmap INDÉPENDANTE de
// TODO_TECHNIQUE.md, voir l'en-tête de TODO_GAMIFICATION.md) : vérifie le moteur de badges
// mensuels ajouté à js/domain/gamification.js (`enregistrerJoursMensuels`, `estJourOuvre`,
// `SEUILS_BADGES_MENSUELS`) — jours OUVRÉS DISTINCTS d'activité par famille dans le mois courant
// (§5.2), jamais un total d'actions, et bascule au 1ᵉʳ du mois avec archivage de l'obtenu/
// non-obtenu du mois précédent (jamais sa progression). Même harnais que le reste de ce dossier
// (tests/support/harness.html, émulateur Firebase).
//
// PARTICULARITÉ CALENDRIER (§2.1) : le week-end est totalement ignoré — une action un samedi ou
// un dimanche ne doit RIEN écrire. Comme ce fichier de test s'exécute un jour réel quelconque
// (jamais fixé à l'avance), chaque test détecte lui-même si "aujourd'hui" est un jour ouvré et
// adapte ses assertions en conséquence plutôt que de supposer un jour de semaine particulier —
// c'est la seule façon d'obtenir un test qui ne devienne pas flaky selon la date d'exécution
// réelle (CI ou poste de Charles-Henri).
//
// PARTICULARITÉ COMPTE PARTAGÉ : comme LOT G3, les compteurs de jours distincts sont CUMULATIFS
// sur tout le compte de test partagé (jamais réinitialisés entre deux exécutions de ce fichier le
// même jour calendaire) — chaque test lit donc l'état AVANT d'agir et vérifie un DELTA cohérent
// (jour déjà compté aujourd'hui ⇒ aucun changement de longueur ; jour pas encore compté ⇒ +1
// exactement), jamais une valeur absolue.
//
// Le dernier test (bascule de mois) contourne volontairement le moteur via `storageApi.setFields`
// pour semer un "ancien mois" fictif (`2020-01`, qui n'est jamais un mois réel de ce compte de
// test) avec une progression et un obtenu/non-obtenu connus à l'avance — seule façon de tester la
// bascule de façon déterministe sans dépendre d'un vrai changement de mois calendaire (aucune
// horloge injectable dans `js/domain/gamification.js`, qui utilise directement `new Date()`,
// cohérent avec le reste de ce moteur — voir aussi l'avertissement en fin de fichier).
//
// AVERTISSEMENT (25/09/2026, même principe que les autres fichiers de ce dossier et
// tests/README.md) : écrit et relu manuellement à partir du code réel de js/domain/
// gamification.js, mais JAMAIS EXÉCUTÉ dans cet environnement (registre npm et émulateur Firebase
// indisponibles ici, voir tests/README.md) — à lancer réellement via `npm run test:e2e` (GitHub
// Actions ou poste de Charles-Henri) avant d'être considéré comme validé.

import { test, expect } from "@playwright/test";
import { E2E_TEST_USER } from "../e2e/global-setup.js";

// Chaque test ci-dessous redéfinit sa propre copie locale de `jourLocal()` (reproduisant
// indépendamment js/domain/gamification.js#localDateKey, format "YYYY-MM-DD" en date locale) à
// l'intérieur de son propre `page.evaluate()` : une fonction déclarée en dehors ne serait pas
// visible dans ce contexte de page, sérialisé séparément à chaque appel.

test.describe("LOT G4 — Badges mensuels (TODO_GAMIFICATION.md §5.2), jours ouvrés distincts par famille", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/support/harness.html");
    await page.waitForFunction(() => window.__pilotageTestApiReady === true);
    await page.evaluate(async ({ email, password }) => {
      await window.__pilotageTestApi.firebaseApi.signInEmail(email, password);
    }, E2E_TEST_USER);
    await page.waitForFunction(() => !!window.__pilotageTestApi.firebaseApi.getCurrentUser());
  });

  test("Focus + Régulier : une Tâche terminée compte le jour ouvré une fois, une deuxième Tâche le même jour ne recompte pas", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { tasksApi, gamificationApi } = window.__pilotageTestApi;
      function jourLocal() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }
      const isBusinessDay = ![0, 6].includes(new Date().getDay());
      const aujourdhui = jourLocal();

      const before = await gamificationApi.getGamificationState();
      const focusAvant = before.badgesMensuelsCourant.jours.focus;
      const regulierAvant = before.badgesMensuelsCourant.jours.regulier;

      const task1 = await tasksApi.createTask({ title: `Test LOT G4 — focus 1 ${Date.now()}` });
      await tasksApi.updateTask(task1.id, { status: "done" });
      const task2 = await tasksApi.createTask({ title: `Test LOT G4 — focus 2 ${Date.now()}` });
      await tasksApi.updateTask(task2.id, { status: "done" });
      await new Promise((r) => setTimeout(r, 500));
      const after = await gamificationApi.getGamificationState();

      return {
        isBusinessDay,
        aujourdhui,
        focusAvantInclutAujourdhui: focusAvant.includes(aujourdhui),
        focusAvantLength: focusAvant.length,
        regulierAvantInclutAujourdhui: regulierAvant.includes(aujourdhui),
        regulierAvantLength: regulierAvant.length,
        focusApres: after.badgesMensuelsCourant.jours.focus,
        regulierApres: after.badgesMensuelsCourant.jours.regulier,
      };
    });

    if (!result.isBusinessDay) {
      // Week-end (§2.1) : aucune écriture, même après deux Tâches terminées.
      expect(result.focusApres.length).toBe(result.focusAvantLength);
      expect(result.regulierApres.length).toBe(result.regulierAvantLength);
      return;
    }

    expect(result.focusApres).toContain(result.aujourdhui);
    expect(result.regulierApres).toContain(result.aujourdhui);
    expect(result.focusApres.length).toBe(result.focusAvantLength + (result.focusAvantInclutAujourdhui ? 0 : 1));
    expect(result.regulierApres.length).toBe(result.regulierAvantLength + (result.regulierAvantInclutAujourdhui ? 0 : 1));
  });

  test("Décideur + Régulier : une Décision créée alimente les deux, jamais Focus/Organisé/Livreur", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { decisionsApi, gamificationApi } = window.__pilotageTestApi;
      function jourLocal() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }
      const isBusinessDay = ![0, 6].includes(new Date().getDay());
      const aujourdhui = jourLocal();

      const before = await gamificationApi.getGamificationState();
      const avant = before.badgesMensuelsCourant.jours;

      await decisionsApi.createDecision({ title: `Test LOT G4 — décideur ${Date.now()}`, decision: "Décidé pour le test LOT G4" });
      await new Promise((r) => setTimeout(r, 500));
      const after = await gamificationApi.getGamificationState();
      const apres = after.badgesMensuelsCourant.jours;

      return {
        isBusinessDay,
        aujourdhui,
        decideurInclutAvant: avant.decideur.includes(aujourdhui),
        decideurAvantLength: avant.decideur.length,
        decideurApres: apres.decideur,
        regulierInclutAvant: avant.regulier.includes(aujourdhui),
        regulierAvantLength: avant.regulier.length,
        regulierApres: apres.regulier,
        focusInchange: apres.focus.length === avant.focus.length,
        organiseInchange: apres.organise.length === avant.organise.length,
        livreurInchange: apres.livreur.length === avant.livreur.length,
      };
    });

    // Familles NON concernées par "Décision créée" : ne doivent JAMAIS bouger, quel que soit le
    // jour de la semaine.
    expect(result.focusInchange).toBe(true);
    expect(result.organiseInchange).toBe(true);
    expect(result.livreurInchange).toBe(true);

    if (!result.isBusinessDay) return; // week-end (§2.1) : rien d'autre à vérifier.

    expect(result.decideurApres).toContain(result.aujourdhui);
    expect(result.regulierApres).toContain(result.aujourdhui);
    expect(result.decideurApres.length).toBe(result.decideurAvantLength + (result.decideurInclutAvant ? 0 : 1));
    expect(result.regulierApres.length).toBe(result.regulierAvantLength + (result.regulierInclutAvant ? 0 : 1));
  });

  test("Organisé + Régulier : qualifier un item Inbox alimente les deux, jamais Focus/Décideur/Livreur", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { inboxApi, gamificationApi } = window.__pilotageTestApi;
      function jourLocal() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }
      const isBusinessDay = ![0, 6].includes(new Date().getDay());
      const aujourdhui = jourLocal();

      const before = await gamificationApi.getGamificationState();
      const avant = before.badgesMensuelsCourant.jours;

      const item = await inboxApi.capture(`Test LOT G4 — organisé ${Date.now()}`);
      await inboxApi.qualify(item.id, "kept");
      await new Promise((r) => setTimeout(r, 500));
      const after = await gamificationApi.getGamificationState();
      const apres = after.badgesMensuelsCourant.jours;

      return {
        isBusinessDay,
        aujourdhui,
        organiseInclutAvant: avant.organise.includes(aujourdhui),
        organiseAvantLength: avant.organise.length,
        organiseApres: apres.organise,
        regulierInclutAvant: avant.regulier.includes(aujourdhui),
        regulierAvantLength: avant.regulier.length,
        regulierApres: apres.regulier,
        focusInchange: apres.focus.length === avant.focus.length,
        decideurInchange: apres.decideur.length === avant.decideur.length,
        livreurInchange: apres.livreur.length === avant.livreur.length,
      };
    });

    expect(result.focusInchange).toBe(true);
    expect(result.decideurInchange).toBe(true);
    expect(result.livreurInchange).toBe(true);

    if (!result.isBusinessDay) return;

    expect(result.organiseApres).toContain(result.aujourdhui);
    expect(result.regulierApres).toContain(result.aujourdhui);
    expect(result.organiseApres.length).toBe(result.organiseAvantLength + (result.organiseInclutAvant ? 0 : 1));
    expect(result.regulierApres.length).toBe(result.regulierAvantLength + (result.regulierInclutAvant ? 0 : 1));
  });

  test("Livreur : Suivi terminé ET Projet clôturé alimentent le MÊME jour distinct (règle « OR », §5.2), jamais compté deux fois le même jour", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { followUpsApi, projectsApi, gamificationApi } = window.__pilotageTestApi;
      const isBusinessDay = ![0, 6].includes(new Date().getDay());

      const before = await gamificationApi.getGamificationState();
      const livreurAvant = before.badgesMensuelsCourant.jours.livreur.length;

      const followUp = await followUpsApi.createFollowUp({ personId: `fake-person-lotg4-${Date.now()}`, title: `Test LOT G4 — livreur suivi ${Date.now()}` });
      await followUpsApi.updateFollowUp(followUp.id, { status: "done" });
      await new Promise((r) => setTimeout(r, 500));
      const apresSuivi = await gamificationApi.getGamificationState();
      const livreurApresSuivi = apresSuivi.badgesMensuelsCourant.jours.livreur.length;

      const project = await projectsApi.createProject({ title: `Test LOT G4 — livreur projet ${Date.now()}` });
      await projectsApi.closeProject(project.id);
      await new Promise((r) => setTimeout(r, 500));
      const apresProjet = await gamificationApi.getGamificationState();
      const livreurApresProjet = apresProjet.badgesMensuelsCourant.jours.livreur.length;

      return { isBusinessDay, livreurAvant, livreurApresSuivi, livreurApresProjet };
    });

    if (!result.isBusinessDay) {
      expect(result.livreurApresSuivi).toBe(result.livreurAvant);
      expect(result.livreurApresProjet).toBe(result.livreurAvant);
      return;
    }

    // Le Suivi ajoute le jour s'il n'y était pas déjà (0 ou +1 selon l'historique du compte).
    expect(result.livreurApresSuivi).toBeGreaterThanOrEqual(result.livreurAvant);
    expect(result.livreurApresSuivi).toBeLessThanOrEqual(result.livreurAvant + 1);
    // Le Projet, LE MÊME JOUR, ne doit RIEN ajouter de plus : le jour est déjà compté pour
    // "livreur" par le Suivi ci-dessus — "OR" entre les deux sources, jamais une addition.
    expect(result.livreurApresProjet).toBe(result.livreurApresSuivi);
  });

  test("Aucun badge mensuel dédié (Réunion créée, Ressource créée) : alimentent uniquement Régulier", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { meetingsApi, resourcesApi, gamificationApi } = window.__pilotageTestApi;
      const isBusinessDay = ![0, 6].includes(new Date().getDay());
      function jourLocal() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }
      const aujourdhui = jourLocal();

      const before = await gamificationApi.getGamificationState();
      const avant = before.badgesMensuelsCourant.jours;
      const regulierInclutAvant = avant.regulier.includes(aujourdhui);
      const regulierAvantLength = avant.regulier.length;

      await meetingsApi.createMeeting({ title: `Test LOT G4 — réunion ${Date.now()}` });
      await resourcesApi.createResource({ title: `Test LOT G4 — ressource ${Date.now()}`, url: "https://example.com" });
      await new Promise((r) => setTimeout(r, 500));
      const after = await gamificationApi.getGamificationState();
      const apres = after.badgesMensuelsCourant.jours;

      return {
        isBusinessDay,
        aujourdhui,
        regulierInclutAvant,
        regulierAvantLength,
        regulierApres: apres.regulier,
        focusInchange: apres.focus.length === avant.focus.length,
        organiseInchange: apres.organise.length === avant.organise.length,
        decideurInchange: apres.decideur.length === avant.decideur.length,
        livreurInchange: apres.livreur.length === avant.livreur.length,
      };
    });

    // Ni Réunion ni Ressource n'ont de badge mensuel dédié (§5.2) — aucune des 4 autres familles
    // ne doit bouger, quel que soit le jour de la semaine.
    expect(result.focusInchange).toBe(true);
    expect(result.organiseInchange).toBe(true);
    expect(result.decideurInchange).toBe(true);
    expect(result.livreurInchange).toBe(true);

    if (!result.isBusinessDay) return;

    expect(result.regulierApres).toContain(result.aujourdhui);
    expect(result.regulierApres.length).toBe(result.regulierAvantLength + (result.regulierInclutAvant ? 0 : 1));
  });

  test("Bascule de mois : l'obtenu/non-obtenu du mois précédent est figé dans l'historique, jamais sa progression, et un nouveau compteur à 0 démarre", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { tasksApi, storageApi, gamificationApi } = window.__pilotageTestApi;
      function jourLocal() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }
      const isBusinessDay = ![0, 6].includes(new Date().getDay());
      const aujourdhui = jourLocal();
      const moisCourantReel = aujourdhui.slice(0, 7);

      // S'assure que le document gamification/state existe déjà avant d'écrire directement
      // dessus via storageApi.setFields ci-dessous (updateDoc échoue sur un document absent).
      const bootstrapTask = await tasksApi.createTask({ title: `Test LOT G4 — bootstrap bascule ${Date.now()}` });
      await tasksApi.updateTask(bootstrapTask.id, { status: "done" });
      await new Promise((r) => setTimeout(r, 500));

      // Sème un "ancien mois" fictif (2020-01, jamais un mois réel de ce compte de test) avec une
      // progression et un obtenu/non-obtenu connus à l'avance — contourne volontairement le
      // moteur (aucune horloge injectable dans gamification.js) pour isoler la bascule de tout
      // état réellement accumulé par ailleurs.
      const ancienObtenus = { organise: true, focus: false, regulier: true, decideur: false, livreur: false };
      await storageApi.setFields("gamification", "state", {
        badgesMensuelsCourant: {
          mois: "2020-01",
          jours: { organise: ["2020-01-02", "2020-01-03"], focus: [], regulier: ["2020-01-02"], decideur: [], livreur: [] },
          obtenus: ancienObtenus,
        },
      });

      // Une action réelle (Tâche terminée) déclenche la détection de bascule au prochain appel
      // de enregistrerJoursMensuels() — sauf le week-end (§2.1), où l'action elle-même est un
      // no-op et ne déclenche donc rien, y compris la bascule (moteur paresseux, jamais de tâche
      // planifiée séparée — voir le commentaire de enregistrerJoursMensuels()).
      const task = await tasksApi.createTask({ title: `Test LOT G4 — bascule de mois ${Date.now()}` });
      await tasksApi.updateTask(task.id, { status: "done" });
      await new Promise((r) => setTimeout(r, 500));
      const apres = await gamificationApi.getGamificationState();

      return {
        isBusinessDay,
        aujourdhui,
        moisCourantReel,
        ancienObtenus,
        historiqueApres: apres.badgesMensuelsHistorique["2020-01"] || null,
        moisCourantApres: apres.badgesMensuelsCourant.mois,
        joursCourantApres: apres.badgesMensuelsCourant.jours,
      };
    });

    if (!result.isBusinessDay) {
      // Rien à vérifier de plus : l'action de ce test n'a elle-même rien pu écrire (week-end).
      return;
    }

    // L'historique du mois fictif reflète EXACTEMENT l'obtenu/non-obtenu semé, jamais recalculé
    // ni fusionné avec autre chose.
    expect(result.historiqueApres).toEqual(result.ancienObtenus);
    // Le compteur courant repart bien sur le VRAI mois local, jamais resté bloqué sur "2020-01".
    expect(result.moisCourantApres).toBe(result.moisCourantReel);
    // La progression de l'ancien mois (`jours`) n'est JAMAIS reportée — seul le jour du jour
    // courant apparaît, jamais "2020-01-02"/"2020-01-03" semés plus haut.
    expect(result.joursCourantApres.focus).toEqual([result.aujourdhui]);
    expect(result.joursCourantApres.regulier).toEqual([result.aujourdhui]);
    expect(result.joursCourantApres.organise).toEqual([]);
    expect(result.joursCourantApres.decideur).toEqual([]);
    expect(result.joursCourantApres.livreur).toEqual([]);
  });
});
