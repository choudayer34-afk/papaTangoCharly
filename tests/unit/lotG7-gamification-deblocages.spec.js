// LOT G7 (TODO_GAMIFICATION.md, Déblocages §6, 28/09/2026 — roadmap INDÉPENDANTE de
// TODO_TECHNIQUE.md) : 34 déblocages (Tables A/B/C) attribués par deux points d'écoute UNIQUES
// (`verifierDeblocages()`, appelée à la fin de `awardXpOnce()` et d'`awardBadgeOnce()`, voir
// js/domain/gamification.js) — jamais un troisième point d'écoute par `recordXxx()` individuel.
// `deblocageAtteint()`/`verifierDeblocages()` sont PRIVÉES (non exportées) : contrairement à
// `valeurCouranteFamille()` en LOT G6, elles ne sont donc jamais appelées directement ici — ce
// fichier vérifie (1) l'intégrité du catalogue exporté (`DEBLOCAGES`/`CATEGORIES_DEBLOCAGES`),
// pure et sans dépendance Firestore, et (2) par un test d'intégration, que l'état RÉEL du compte
// de test (`deblocagesAcquis`) reste cohérent avec les 3 règles du §6 reconstruites
// INDÉPENDAMMENT ici (même précaution que le dernier test de
// tests/unit/lotG6-gamification-galerie.spec.js : ne jamais valider une logique contre
// elle-même). Aucune tentative de forcer un NOUVEAU déblocage précis dans ce test (imposerait de
// contrôler l'XP exact du compte de test, fragile) — la cohérence est vérifiée sur l'état déjà
// atteint, quel qu'il soit.
//
// AVERTISSEMENT (même principe que tous les autres fichiers de ce dossier et tests/README.md) :
// écrit et relu manuellement à partir du code réel de js/domain/gamification.js, mais JAMAIS
// EXÉCUTÉ dans cet environnement (registre npm/émulateur Firebase indisponibles ici) — à lancer
// réellement via `npm run test:e2e` (GitHub Actions ou poste de Charles-Henri) avant d'être
// considéré comme validé. Aucune assertion sur le RENDU visuel de la nouvelle section
// "🔓 Déblocages" de js/views/gamification.js, ni sur l'icône affichée à côté de "Mon pilotage"
// (js/views/dashboard.js) — même limite que LOT G6, cet environnement ne permet aucune
// vérification Playwright réelle du DOM.

import { test, expect } from "@playwright/test";
import { E2E_TEST_USER } from "../e2e/global-setup.js";

test.describe("LOT G7 — Déblocages (TODO_GAMIFICATION.md §6) : catalogue, cohérence d'attribution, préférence d'icône équipée", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/support/harness.html");
    await page.waitForFunction(() => window.__pilotageTestApiReady === true);
    await page.evaluate(async ({ email, password }) => {
      await window.__pilotageTestApi.firebaseApi.signInEmail(email, password);
    }, E2E_TEST_USER);
    await page.waitForFunction(() => !!window.__pilotageTestApi.firebaseApi.getCurrentUser());
  });

  test("DEBLOCAGES contient exactement 34 entrées (6 Table A + 14 Table B + 14 Table C), ids uniques, chaque badgeId référencé existe réellement dans BADGES", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { gamificationApi } = window.__pilotageTestApi;
      const ids = gamificationApi.DEBLOCAGES.map((d) => d.id);
      const badgeIdsConnus = new Set(gamificationApi.BADGES.map((b) => b.id));
      const badgeIdsInconnus = gamificationApi.DEBLOCAGES.filter((d) => d.badgeId && !badgeIdsConnus.has(d.badgeId)).map((d) => d.id);
      return {
        total: gamificationApi.DEBLOCAGES.length,
        parType: {
          niveau: gamificationApi.DEBLOCAGES.filter((d) => d.type === "niveau").length,
          badge: gamificationApi.DEBLOCAGES.filter((d) => d.type === "badge").length,
          niveauEtBadge: gamificationApi.DEBLOCAGES.filter((d) => d.type === "niveauEtBadge").length,
        },
        idsUniques: new Set(ids).size,
        badgeIdsInconnus,
      };
    });

    expect(result.total).toBe(34);
    expect(result.parType).toEqual({ niveau: 6, badge: 14, niveauEtBadge: 14 });
    expect(result.idsUniques).toBe(34);
    expect(result.badgeIdsInconnus).toEqual([]); // aucun déblocage ne pointe vers un badge qui n'existe pas
  });

  test("CATEGORIES_DEBLOCAGES couvre exactement les 5 catégories utilisées par DEBLOCAGES, seule 'icone' est equipable", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { gamificationApi } = window.__pilotageTestApi;
      const categoriesDuCatalogue = new Set(gamificationApi.DEBLOCAGES.map((d) => d.categorie));
      const categoriesDeclarees = new Set(gamificationApi.CATEGORIES_DEBLOCAGES.map((c) => c.id));
      return {
        total: gamificationApi.CATEGORIES_DEBLOCAGES.length,
        manquantes: [...categoriesDuCatalogue].filter((c) => !categoriesDeclarees.has(c)),
        enTrop: [...categoriesDeclarees].filter((c) => !categoriesDuCatalogue.has(c)),
        equipables: gamificationApi.CATEGORIES_DEBLOCAGES.filter((c) => c.equipable).map((c) => c.id),
      };
    });

    expect(result.total).toBe(5);
    expect(result.manquantes).toEqual([]);
    expect(result.enTrop).toEqual([]);
    expect(result.equipables).toEqual(["icone"]); // seule catégorie réellement équipable dans ce lot (arbitrage 25/09/2026)
  });

  test("les 4 déblocages liés à Documentation/Régularité ne pourront structurellement jamais se déclencher (badges bloqués depuis LOT G3, non reconduit ici)", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { gamificationApi } = window.__pilotageTestApi;
      const idsBloques = ["icone-documentation", "icone-regularite", "ruban-documentation", "ruban-regularite"];
      return idsBloques.map((id) => {
        const d = gamificationApi.DEBLOCAGES.find((x) => x.id === id);
        return { id, existe: !!d, famille: d && d.famille };
      });
    });

    for (const entry of result) {
      expect(entry.existe).toBe(true);
      expect(["documentation", "regularite"]).toContain(entry.famille);
    }
  });

  test("l'état RÉEL du compte de test (deblocagesAcquis) est cohérent avec les 3 règles du §6, reconstruites indépendamment de deblocageAtteint()", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { gamificationApi } = window.__pilotageTestApi;
      const state = await gamificationApi.getGamificationState();
      const niveau = gamificationApi.niveauDepuisXP(state.xpTotal);

      // Reconstruction INDÉPENDANTE des 3 règles du §6 (jamais un appel à une fonction interne
      // de js/domain/gamification.js, qui n'est de toute façon pas exportée) — même précaution
      // que le test de cohérence de LOT G6 pour valeurCouranteFamille()/evaluerFamille().
      function estAtteintIndependamment(d) {
        if (d.type === "niveau") return niveau >= d.niveau;
        if (d.type === "badge") return !!state.badgesObtained[d.badgeId];
        if (d.type === "niveauEtBadge") return niveau >= d.niveau && !!state.badgesObtained[d.badgeId];
        return false;
      }

      const ecarts = [];
      for (const d of gamificationApi.DEBLOCAGES) {
        const devraitEtreAcquis = estAtteintIndependamment(d);
        const estMarqueAcquis = !!state.deblocagesAcquis[d.id];
        // Un déblocage dont la condition est remplie DOIT être marqué acquis (verifierDeblocages()
        // tourne à chaque gain d'XP et à chaque badge, donc jamais en retard une fois la condition
        // franchie) — l'inverse (marqué acquis sans condition remplie) ne peut pas arriver non
        // plus, un déblocage n'étant jamais retiré une fois accordé.
        if (devraitEtreAcquis !== estMarqueAcquis) {
          ecarts.push({ id: d.id, devraitEtreAcquis, estMarqueAcquis });
        }
      }
      return { ecarts, niveau, totalAcquis: Object.keys(state.deblocagesAcquis).length };
    });

    expect(result.ecarts).toEqual([]);
  });

  test("setGamificationIconeEquipee() : la préférence s'écrit, se relit, et se remet à null (déséquiper)", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { preferencesApi } = window.__pilotageTestApi;
      await preferencesApi.setGamificationIconeEquipee("icone-productivite");
      const apresEquipe = (await preferencesApi.getPreferences()).gamificationIconeEquipeeId;
      await preferencesApi.setGamificationIconeEquipee(null);
      const apresDesequipe = (await preferencesApi.getPreferences()).gamificationIconeEquipeeId;
      return { apresEquipe, apresDesequipe };
    });

    expect(result.apresEquipe).toBe("icone-productivite");
    expect(result.apresDesequipe).toBeNull();
  });
});
