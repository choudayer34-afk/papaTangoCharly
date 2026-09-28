// LOT G8 (TODO_GAMIFICATION.md, écran Progression, 28/09/2026 — roadmap INDÉPENDANTE de
// TODO_TECHNIQUE.md, voir l'en-tête de TODO_GAMIFICATION.md) : vérifie les DEUX seules données
// réellement nouvelles ajoutées à js/domain/gamification.js par ce lot — "Historique des gains"
// (`historiqueGains`, alimenté par `awardXpOnce()`) et "Répartition des XP" (`repartitionXpParAction`,
// décision de Charles-Henri du 28/09/2026, AskUserQuestion : total depuis toujours, recalculé
// depuis `rewardedKeys`, voir le commentaire détaillé sur `repartitionXpParAction` dans
// js/domain/gamification.js) — ainsi que l'intégrité du petit catalogue d'affichage des badges
// mensuels (`SEUILS_BADGES_MENSUELS`/`BADGES_MENSUELS_INFO`, désormais exportés pour ce lot). Les
// 6 autres éléments de l'écran Progression (niveau, XP, séries, activité mensuelle, badges
// mensuels eux-mêmes, prochain niveau) réutilisent tel quel des calculs déjà testés par LOT G2/
// G4/G5 — pas retestés ici, ce serait redondant avec tests/unit/lotG2-gamification-niveaux.spec.js/
// lotG4-gamification-badges-mensuels.spec.js/lotG5-gamification-series.spec.js. Même harnais que
// le reste de ce dossier (tests/support/harness.html, émulateur Firebase).
//
// PARTICULARITÉ COMPTE PARTAGÉ (même principe que lotG1/lotG3/lotG4) : `rewardedKeys` est
// cumulatif sur tout le compte de test partagé — les tests ci-dessous lisent donc un DELTA
// (occurrences/XP avant/après CETTE action précise), jamais une valeur absolue, sauf pour le test
// de bornage de `historiqueGains` qui sème un état de départ connu via `storageApi.setFields`
// (même technique que le test de bascule de mois de LOT G4) pour rester déterministe.
//
// AVERTISSEMENT (28/09/2026, même principe que les autres fichiers de ce dossier et
// tests/README.md) : écrit et relu manuellement à partir du code réel de js/domain/
// gamification.js, mais JAMAIS EXÉCUTÉ dans cet environnement (registre npm et émulateur Firebase
// indisponibles ici, voir tests/README.md) — à lancer réellement via `npm run test:e2e` (GitHub
// Actions ou poste de Charles-Henri) avant d'être considéré comme validé.

import { test, expect } from "@playwright/test";
import { E2E_TEST_USER } from "../e2e/global-setup.js";

test.describe("LOT G8 — Écran Progression (TODO_GAMIFICATION.md §9), agrégations sans nouvelle donnée persistée", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/support/harness.html");
    await page.waitForFunction(() => window.__pilotageTestApiReady === true);
    await page.evaluate(async ({ email, password }) => {
      await window.__pilotageTestApi.firebaseApi.signInEmail(email, password);
    }, E2E_TEST_USER);
    await page.waitForFunction(() => !!window.__pilotageTestApi.firebaseApi.getCurrentUser());
  });

  test("Répartition des XP : une ligne par type d'action réellement survenu, montant = occurrences × barème, jamais de ligne à 0", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { promptsApi, gamificationApi } = window.__pilotageTestApi;

      const avant = await gamificationApi.getGamificationState();
      const ligneAvant = gamificationApi.repartitionXpParAction(avant).find((l) => l.label === "Prompt créé");
      const occurrencesAvant = ligneAvant ? ligneAvant.occurrences : 0;
      const xpAvant = ligneAvant ? ligneAvant.xp : 0;

      const prompt = await promptsApi.createPrompt({ title: "LOT G8 — test répartition XP", text: "test" });

      const apres = await gamificationApi.getGamificationState();
      const lignesApres = gamificationApi.repartitionXpParAction(apres);
      const ligneApres = lignesApres.find((l) => l.label === "Prompt créé");

      // Toutes les lignes retournées ont au moins une occurrence (jamais de ligne à 0, §9).
      const aucuneLigneVide = lignesApres.every((l) => l.occurrences > 0);
      // Triées de la plus grande contribution d'XP à la plus petite.
      const bienTriees = lignesApres.every((l, i) => i === 0 || lignesApres[i - 1].xp >= l.xp);

      return {
        occurrencesAvant,
        xpAvant,
        occurrencesApres: ligneApres ? ligneApres.occurrences : 0,
        xpApres: ligneApres ? ligneApres.xp : 0,
        aucuneLigneVide,
        bienTriees,
      };
    });

    expect(result.occurrencesApres).toBe(result.occurrencesAvant + 1);
    expect(result.xpApres).toBe(result.xpAvant + 3); // barème §3 : "Prompt créé" = 3 XP
    expect(result.aucuneLigneVide).toBe(true);
    expect(result.bienTriees).toBe(true);
  });

  test("Historique des gains : la nouvelle entrée est en tête, avec le bon libellé/montant et une date récente", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { resourcesApi, gamificationApi } = window.__pilotageTestApi;
      const avantMs = Date.now();

      const resource = await resourcesApi.createResource({ title: "LOT G8 — test historique des gains" });

      const etat = await gamificationApi.getGamificationState();
      const entree = etat.historiqueGains[0];
      return {
        label: entree ? entree.label : null,
        xp: entree ? entree.xp : null,
        dateMsCoherente: entree ? entree.dateMs >= avantMs && entree.dateMs <= Date.now() : false,
        longueur: etat.historiqueGains.length,
      };
    });

    expect(result.label).toBe("Ressource créée");
    expect(result.xp).toBe(3); // barème §3 : "Ressource créée" = 3 XP
    expect(result.dateMsCoherente).toBe(true);
    expect(result.longueur).toBeGreaterThan(0);
  });

  test("Historique des gains : bornage à 30 entrées, la plus ancienne des 30 semées est bien évincée par un nouveau gain réel", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { storageApi, promptsApi, gamificationApi } = window.__pilotageTestApi;

      // Sème 30 entrées fictives connues à l'avance (même technique que le test de bascule de
      // mois de LOT G4 : seule façon de tester un bornage de façon déterministe sans dépendre de
      // 30 vraies actions).
      const semees = Array.from({ length: 30 }, (_, i) => ({
        label: "Semée LOT G8",
        xp: 1,
        dateMs: 1000 + i, // croissant : l'index 0 (le plus ancien) a le plus petit dateMs
      })).reverse(); // le plus récent en tête, cohérent avec l'ordre réel produit par awardXpOnce
      await storageApi.setFields("gamification", "state", { historiqueGains: semees });

      const avant = await gamificationApi.getGamificationState();
      const plusAncienneAvant = avant.historiqueGains[avant.historiqueGains.length - 1];

      const prompt = await promptsApi.createPrompt({ title: "LOT G8 — test bornage historique", text: "test" });

      const apres = await gamificationApi.getGamificationState();
      return {
        longueurAvant: avant.historiqueGains.length,
        longueurApres: apres.historiqueGains.length,
        premiereEntreeApres: apres.historiqueGains[0],
        plusAncienneEncoreLaApres: apres.historiqueGains.some((e) => e.dateMs === plusAncienneAvant.dateMs),
      };
    });

    expect(result.longueurAvant).toBe(30);
    expect(result.longueurApres).toBe(30); // toujours borné à 30, pas 31
    expect(result.premiereEntreeApres.label).toBe("Prompt créé");
    expect(result.premiereEntreeApres.xp).toBe(3);
    expect(result.plusAncienneEncoreLaApres).toBe(false); // la plus ancienne des 30 semées a bien été évincée
  });

  test("Badges mensuels — catalogue d'affichage (LOT G8) cohérent avec les seuils réels (LOT G4)", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { gamificationApi } = window.__pilotageTestApi;
      const idsAttendus = ["organise", "focus", "regulier", "decideur", "livreur"];
      const idsInfo = gamificationApi.BADGES_MENSUELS_INFO.map((i) => i.id);
      return {
        memesIds: idsAttendus.length === idsInfo.length && idsAttendus.every((id) => idsInfo.includes(id)),
        tousLabelsNonVides: gamificationApi.BADGES_MENSUELS_INFO.every((i) => typeof i.label === "string" && i.label.length > 0),
        tousEmojisNonVides: gamificationApi.BADGES_MENSUELS_INFO.every((i) => typeof i.emoji === "string" && i.emoji.length > 0),
        tousSeuilsPositifs: idsAttendus.every((id) => Number.isInteger(gamificationApi.SEUILS_BADGES_MENSUELS[id]) && gamificationApi.SEUILS_BADGES_MENSUELS[id] > 0),
      };
    });

    expect(result.memesIds).toBe(true);
    expect(result.tousLabelsNonVides).toBe(true);
    expect(result.tousEmojisNonVides).toBe(true);
    expect(result.tousSeuilsPositifs).toBe(true);
  });
});
