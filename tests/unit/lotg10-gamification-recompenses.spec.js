// LOT G10 (TODO_GAMIFICATION.md §13/§14, 28/09/2026 — roadmap INDÉPENDANTE de TODO_TECHNIQUE.md,
// voir l'en-tête de TODO_GAMIFICATION.md) : vérifie les fonctions de lecture ajoutées à
// js/domain/gamification.js pour la carte "Progression" de l'Accueil (§13.1) et le Centre de
// récompenses (§13.6) — `xpDebutNiveau`, `xpGagneAujourdhui`, `prochainsBadgesPermanents`,
// `chronologieRecompenses` — ainsi que la garantie d'idempotence du système d'événements de
// récompense (§13.2, `subscribeRewardEvents`) : un gain déjà crédité ne doit jamais être publié
// une seconde fois, même appelé directement une seconde fois. Même harnais que le reste de ce
// dossier (tests/support/harness.html, émulateur Firebase).
//
// NON COUVERT ICI (limite assumée, pas un oubli) : l'ORDRE exact de publication (niveau(x) →
// badge(s) → déblocage(s), §13.2) et le routage Table A/B/C (§13.2) vivent dans `diffRewardEvents()`,
// une fonction INTERNE non exportée (volontairement — ce n'est pas une primitive que d'autres
// fichiers doivent pouvoir appeler directement, seule `subscribeRewardEvents()` est un contrat
// public). Les tester unitairement supposerait soit de l'exporter pour les seuls besoins du test
// (romprait l'encapsulation choisie), soit de faire franchir un vrai seuil de niveau/badge sur le
// COMPTE DE TEST PARTAGÉ (même limite documentée par tous les fichiers de ce dossier) — non
// déterministe puisque l'état déjà accumulé par ce compte n'est pas connu à l'avance. Cette
// garantie reste couverte manuellement (vérification visuelle des écrans de récompense en
// conditions réelles, voir le bilan de ce lot) plutôt que testée ici de façon non fiable.
//
// PARTICULARITÉ COMPTE PARTAGÉ (même principe que lotG1/lotG3/lotG4/lotG8) : `badgesObtained`/
// `deblocagesAcquis`/`xpTotal` sont cumulatifs sur tout le compte de test partagé — les tests sur
// `prochainsBadgesPermanents` ci-dessous vérifient donc des PROPRIÉTÉS STRUCTURELLES (exclusions,
// tri, bornes) plutôt que des valeurs absolues, et `chronologieRecompenses` est testée sur un état
// entièrement FABRIQUÉ en mémoire (fonction pure, ne lit jamais storage — même technique que les
// tests de `repartitionXpParAction`/`valeurCouranteFamille`, LOT G6/G8, qui passent déjà un `state`
// construit à la main plutôt que de dépendre de l'état réel du compte).
//
// AVERTISSEMENT (28/09/2026, même principe que les autres fichiers de ce dossier et
// tests/README.md) : écrit et relu manuellement à partir du code réel de js/domain/
// gamification.js, mais JAMAIS EXÉCUTÉ dans cet environnement (registre npm et émulateur Firebase
// indisponibles ici, voir tests/README.md) — à lancer réellement via `npm run test:e2e` (GitHub
// Actions ou poste de Charles-Henri) avant d'être considéré comme validé.

import { test, expect } from "@playwright/test";
import { E2E_TEST_USER } from "../e2e/global-setup.js";

test.describe("LOT G10 — Récompenses (TODO_GAMIFICATION.md §13/§14)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/support/harness.html");
    await page.waitForFunction(() => window.__pilotageTestApiReady === true);
    await page.evaluate(async ({ email, password }) => {
      await window.__pilotageTestApi.firebaseApi.signInEmail(email, password);
    }, E2E_TEST_USER);
    await page.waitForFunction(() => !!window.__pilotageTestApi.firebaseApi.getCurrentUser());
  });

  test("xpDebutNiveau : les mêmes 6 seuils exacts que le tableau du §4 (déjà vérifiés indépendamment par lotG2)", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { gamificationApi } = window.__pilotageTestApi;
      return {
        n1: gamificationApi.xpDebutNiveau(1),
        n2: gamificationApi.xpDebutNiveau(2),
        n3: gamificationApi.xpDebutNiveau(3),
        n6: gamificationApi.xpDebutNiveau(6),
        n15: gamificationApi.xpDebutNiveau(15),
        n30: gamificationApi.xpDebutNiveau(30),
      };
    });
    expect(result.n1).toBe(0);
    expect(result.n2).toBe(50);
    expect(result.n3).toBe(125);
    expect(result.n6).toBe(500);
    expect(result.n15).toBe(2975);
    expect(result.n30).toBe(11600);
  });

  test("xpGagneAujourdhui : ne somme que les entrées d'historiqueGains datées d'aujourd'hui, jamais celles d'hier", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { storageApi, gamificationApi } = window.__pilotageTestApi;
      const maintenant = new Date();
      const hier = new Date(maintenant.getTime() - 26 * 60 * 60 * 1000); // 26h avant : forcément la veille, quel que soit l'horaire d'exécution du test
      await storageApi.setFields("gamification", "state", {
        historiqueGains: [
          { label: "Semée aujourd'hui A", xp: 10, dateMs: maintenant.getTime() },
          { label: "Semée aujourd'hui B", xp: 6, dateMs: maintenant.getTime() - 1000 },
          { label: "Semée hier", xp: 100, dateMs: hier.getTime() },
        ],
      });
      const etat = await gamificationApi.getGamificationState();
      return gamificationApi.xpGagneAujourdhui(etat, maintenant);
    });
    expect(result).toBe(16); // 10 + 6, jamais les 100 XP d'hier
  });

  test("xpGagneAujourdhui : 0 si aucune entrée du jour n'est présente (jamais une estimation incertaine)", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { storageApi, gamificationApi } = window.__pilotageTestApi;
      const maintenant = new Date();
      const avantHier = new Date(maintenant.getTime() - 50 * 60 * 60 * 1000);
      await storageApi.setFields("gamification", "state", {
        historiqueGains: [{ label: "Semée avant-hier", xp: 42, dateMs: avantHier.getTime() }],
      });
      const etat = await gamificationApi.getGamificationState();
      return gamificationApi.xpGagneAujourdhui(etat, maintenant);
    });
    expect(result).toBe(0);
  });

  test("prochainsBadgesPermanents : exclut toujours Régularité/Documentation, jamais de distance négative, respecte la limite et le tri croissant", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { gamificationApi } = window.__pilotageTestApi;
      const etat = await gamificationApi.getGamificationState();
      const cinqPlusProches = gamificationApi.prochainsBadgesPermanents(etat, 0, 5);
      return {
        longueurAuPlusCinq: cinqPlusProches.length <= 5,
        aucunNiRegulariteNiDocumentation: cinqPlusProches.every((c) => c.badge.famille !== "regularite" && c.badge.famille !== "documentation"),
        aucunDejaObtenu: cinqPlusProches.every((c) => !etat.badgesObtained[c.badge.id]),
        toutesDistancesPositivesOuNulles: cinqPlusProches.every((c) => c.distance >= 0),
        trieCroissant: cinqPlusProches.every((c, i) => i === 0 || cinqPlusProches[i - 1].distance <= c.distance),
        // `limite: 1` (§13.1, "le" badge le plus proche) doit toujours renvoyer au plus 1 élément.
        unSeulAvecLimite1: gamificationApi.prochainsBadgesPermanents(etat, 0, 1).length <= 1,
      };
    });
    expect(result.longueurAuPlusCinq).toBe(true);
    expect(result.aucunNiRegulariteNiDocumentation).toBe(true);
    expect(result.aucunDejaObtenu).toBe(true);
    expect(result.toutesDistancesPositivesOuNulles).toBe(true);
    expect(result.trieCroissant).toBe(true);
    expect(result.unSeulAvecLimite1).toBe(true);
  });

  test("chronologieRecompenses : niveaux/badges/déblocages fabriqués, triés du plus récent au plus ancien, niveau reconstruit depuis historiqueGains", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { gamificationApi } = window.__pilotageTestApi;
      // État entièrement FABRIQUÉ (fonction pure, jamais lu depuis storage) : xpTotal=100 → niveau 2
      // (seuil niveau 2 = 50, seuil niveau 3 = 125, voir xpDebutNiveau ci-dessus). Une seule entrée
      // d'historiqueGains de +100 XP en partant d'un total de départ de 0 (100 - 100) : le passage
      // du seuil 50 (niveau 2) a donc lieu PENDANT cette entrée, dateMs=4000 attendu pour ce niveau.
      const etatFabrique = {
        xpTotal: 100,
        badgesObtained: { "productivite-1-tache": 5000 },
        deblocagesAcquis: { "palette-ocean": 6000 },
        historiqueGains: [{ label: "Fabriquée", xp: 100, dateMs: 4000 }],
      };
      const chronologie = gamificationApi.chronologieRecompenses(etatFabrique);
      return {
        longueur: chronologie.length,
        ordreDecroissant: chronologie.every((e, i) => i === 0 || (chronologie[i - 1].dateMs ?? -Infinity) >= (e.dateMs ?? -Infinity)),
        premier: chronologie[0] && { type: chronologie[0].type, dateMs: chronologie[0].dateMs },
        contientNiveau2: chronologie.some((e) => e.type === "niveau" && e.niveau === 2 && e.dateMs === 4000),
        contientBadge: chronologie.some((e) => e.type === "badge" && e.badge.id === "productivite-1-tache" && e.dateMs === 5000),
        contientDeblocage: chronologie.some((e) => e.type === "deblocage" && e.deblocage.id === "palette-ocean" && e.dateMs === 6000),
      };
    });
    expect(result.longueur).toBe(3);
    expect(result.ordreDecroissant).toBe(true);
    expect(result.premier).toEqual({ type: "deblocage", dateMs: 6000 }); // le plus récent des 3 (6000)
    expect(result.contientNiveau2).toBe(true);
    expect(result.contientBadge).toBe(true);
    expect(result.contientDeblocage).toBe(true);
  });

  test("chronologieRecompenses : un niveau atteint AVANT la plus ancienne entrée connue reçoit dateMs=null, jamais une date inventée", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { gamificationApi } = window.__pilotageTestApi;
      // xpTotal=200 → niveau 3 (seuil niveau 3 = 125, seuil niveau 4 = 225), mais historiqueGains
      // vide : impossible de dater le franchissement des niveaux 2 ET 3, tous deux "avant la
      // fenêtre connue" (voir le commentaire de chronologieRecompenses côté domaine).
      const etatFabrique = { xpTotal: 200, badgesObtained: {}, deblocagesAcquis: {}, historiqueGains: [] };
      const chronologie = gamificationApi.chronologieRecompenses(etatFabrique);
      return {
        niveau2: chronologie.find((e) => e.type === "niveau" && e.niveau === 2),
        niveau3: chronologie.find((e) => e.type === "niveau" && e.niveau === 3),
      };
    });
    expect(result.niveau2?.dateMs).toBeNull();
    expect(result.niveau3?.dateMs).toBeNull();
  });

  test("subscribeRewardEvents : jamais republié pour un gain déjà crédité (§2.3 idempotence, appelé directement une seconde fois)", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { promptsApi, gamificationApi } = window.__pilotageTestApi;
      const prompt = await promptsApi.createPrompt({ title: "LOT G10 — test idempotence récompense" });
      // Laisse le temps à la file interne de récompense de traiter le crédit RÉEL déclenché par la
      // création ci-dessus, avant de s'abonner pour le second appel (idempotent) qui nous intéresse.
      await new Promise((resolve) => setTimeout(resolve, 500));

      let appele = false;
      const unsubscribe = gamificationApi.subscribeRewardEvents(() => {
        appele = true;
      });
      // Recrédite manuellement la MÊME clé (même id de Prompt) — normalement impossible depuis
      // l'UI, mais `recordPromptCreated()` reste idempotent par construction (§2.3, LOT G1) : ce
      // second appel ne doit rien écrire, donc rien publier.
      await gamificationApi.recordPromptCreated(prompt.id);
      await new Promise((resolve) => setTimeout(resolve, 500));
      unsubscribe();
      return { appele };
    });
    expect(result.appele).toBe(false);
  });
});
