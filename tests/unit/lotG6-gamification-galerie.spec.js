// LOT G6 (TODO_GAMIFICATION.md, Galerie des badges §7, 25/09/2026 — roadmap INDÉPENDANTE de
// TODO_TECHNIQUE.md) : ce lot est un écran de LECTURE SEULE (js/views/gamification.js) — aucune
// nouvelle attribution, aucun nouveau compteur écrit. La seule logique réellement nouvelle dans
// js/domain/gamification.js est `valeurCouranteFamille()`, une fonction PURE (aucune lecture ni
// écriture Firestore : elle ne fait que dériver une valeur d'un `state` et d'un
// `collaborateursDistincts` déjà fournis par l'appelant) — c'est donc elle, et la cohérence du
// catalogue exposé (`BADGES` désormais exporté, `FAMILLES_BADGES`), que ce fichier vérifie.
// Contrairement à LOT G3/G4/G5, PAS besoin de déclencher de vraies actions métier (créer une
// Tâche, un Projet...) pour la plupart des tests ci-dessous : des états `gamification` FABRIQUÉS
// en mémoire suffisent à exercer chaque branche de `valeurCouranteFamille()`, ce qui rend ces
// tests plus rapides et plus déterministes que ceux des lots précédents. Un seul test
// d'intégration (le dernier) vérifie que `valeurCouranteFamille()` retombe bien sur la même
// valeur que celle réellement utilisée par `evaluerFamille()` pour l'état RÉEL du compte de
// test, avec la même technique de mapping de préfixes déjà indépendamment vérifiée par
// tests/unit/lotG3-gamification-badges.spec.js.
//
// AVERTISSEMENT (25/09/2026, même principe que les autres fichiers de ce dossier et
// tests/README.md) : écrit et relu manuellement à partir du code réel de
// js/domain/gamification.js, mais JAMAIS EXÉCUTÉ dans cet environnement (registre npm/émulateur
// Firebase indisponibles ici, voir tests/README.md) — à lancer réellement via `npm run
// test:e2e` (GitHub Actions ou poste de Charles-Henri) avant d'être considéré comme validé.
// Aucune assertion sur le RENDU visuel de js/views/gamification.js elle-même (DOM, CSS, filtre
// de rareté) : cet environnement ne permet aucune vérification Playwright réelle, a fortiori
// pour un écran — voir le bilan de ce lot, section "Éléments restant à valider", qui signale
// explicitement cette limite comme plus significative ici que pour les lots précédents
// (purement backend) puisque LOT G6 est le premier lot dont le livrable principal EST un écran.

import { test, expect } from "@playwright/test";
import { E2E_TEST_USER } from "../e2e/global-setup.js";

test.describe("LOT G6 — Galerie des badges (TODO_GAMIFICATION.md §7) : lecture seule, catalogue et valeurCouranteFamille", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/support/harness.html");
    await page.waitForFunction(() => window.__pilotageTestApiReady === true);
    await page.evaluate(async ({ email, password }) => {
      await window.__pilotageTestApi.firebaseApi.signInEmail(email, password);
    }, E2E_TEST_USER);
    await page.waitForFunction(() => !!window.__pilotageTestApi.firebaseApi.getCurrentUser());
  });

  test("BADGES est exporté (70 entrées) et FAMILLES_BADGES couvre exactement les familles présentes dans BADGES", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { gamificationApi } = window.__pilotageTestApi;
      const famillesDuCatalogue = new Set(gamificationApi.BADGES.map((b) => b.famille));
      const famillesDeclarees = new Set(gamificationApi.FAMILLES_BADGES.map((f) => f.id));
      return {
        totalBadges: gamificationApi.BADGES.length,
        totalFamillesBadges: gamificationApi.FAMILLES_BADGES.length,
        // Différence dans un sens comme dans l'autre : aucune famille du catalogue ne doit
        // manquer à FAMILLES_BADGES (l'écran l'ignorerait silencieusement), et aucune famille
        // déclarée ne doit être un id inventé sans aucun badge (une section vide inutile).
        famillesManquantes: [...famillesDuCatalogue].filter((f) => !famillesDeclarees.has(f)),
        famillesEnTrop: [...famillesDeclarees].filter((f) => !famillesDuCatalogue.has(f)),
        // Chaque id de famille doit être unique dans FAMILLES_BADGES (sinon une section
        // dupliquée dans la Galerie).
        idsUniques: new Set(gamificationApi.FAMILLES_BADGES.map((f) => f.id)).size,
      };
    });

    expect(result.totalBadges).toBe(70);
    expect(result.totalFamillesBadges).toBe(14);
    expect(result.famillesManquantes).toEqual([]);
    expect(result.famillesEnTrop).toEqual([]);
    expect(result.idsUniques).toBe(14);
  });

  test("valeurCouranteFamille() : familles 'management'/'expert'/'regularite'/'documentation' lisent la bonne source, sans passer par rewardedKeys", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { gamificationApi } = window.__pilotageTestApi;
      // État FABRIQUÉ, jamais écrit en base — valeurCouranteFamille() est une fonction pure,
      // aucun besoin de storageApi.setFields ici (contrairement aux tests LOT G4/G5 qui
      // devaient, eux, simuler un état de départ pour un moteur d'ÉCRITURE).
      const stateFake = {
        xpTotal: 1234,
        rewardedKeys: { "tache-terminee:abc": Date.now(), "tache-terminee:def": Date.now() },
        badgesObtained: {},
        series: { pilotage: { longueur: 3, record: 17, dernierJour: "2026-09-24" } },
      };
      return {
        management: gamificationApi.valeurCouranteFamille(stateFake, "management", 7),
        expert: gamificationApi.valeurCouranteFamille(stateFake, "expert"),
        regularite: gamificationApi.valeurCouranteFamille(stateFake, "regularite"),
        documentation: gamificationApi.valeurCouranteFamille(stateFake, "documentation"),
        productivite: gamificationApi.valeurCouranteFamille(stateFake, "productivite"),
        familleInconnue: gamificationApi.valeurCouranteFamille(stateFake, "cette-famille-n-existe-pas"),
      };
    });

    expect(result.management).toBe(7); // paramètre collaborateursDistincts, PAS rewardedKeys
    expect(result.expert).toBe(1234); // state.xpTotal
    expect(result.regularite).toBe(17); // state.series.pilotage.record (§5.3), pas 0
    expect(result.documentation).toBe(0); // aucune donnée fiable, toujours 0 (voir le commentaire sur BADGES)
    expect(result.productivite).toBe(2); // compterParPrefixe("tache-terminee:") = 2 entrées
    expect(result.familleInconnue).toBe(0); // pas de préfixe connu → 0, jamais une exception
  });

  test("valeurCouranteFamille() : un state minimal (aucun champ optionnel rempli) ne lève jamais d'exception", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { gamificationApi } = window.__pilotageTestApi;
      // Simule un compte gamification tout juste créé, avant `withDefaults()` — vérifie que
      // l'accès à `state.series?.pilotage?.record` (chaînage optionnel) ne casse pas si
      // `series` est absent, un cas plausible si cette fonction est un jour appelée avant le
      // premier passage par `getGamificationState()`.
      const stateVide = { rewardedKeys: {} };
      return {
        regularite: gamificationApi.valeurCouranteFamille(stateVide, "regularite"),
        expert: gamificationApi.valeurCouranteFamille(stateVide, "expert"),
        management: gamificationApi.valeurCouranteFamille(stateVide, "management"),
      };
    });

    expect(result.regularite).toBe(0);
    expect(result.expert).toBe(0);
    expect(result.management).toBe(0); // collaborateursDistincts non fourni → valeur par défaut 0
  });

  test("valeurCouranteFamille() sur l'état RÉEL du compte de test retombe sur le même mapping de préfixes que evaluerFamille() (cohérence avec LOT G3)", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { gamificationApi, objectivesApi } = window.__pilotageTestApi;
      const state = await gamificationApi.getGamificationState();
      const objectifs = await objectivesApi.listAll();
      const collaborateursDistincts = new Set(objectifs.filter((o) => o.personId).map((o) => o.personId)).size;

      // Même mapping que le test de cohérence globale de LOT G3 (tests/unit/lotG3-gamification-
      // badges.spec.js), reconstruit ici de façon indépendante plutôt qu'importé, pour ne pas
      // valider PREFIXES_PAR_FAMILLE contre lui-même.
      function compterParPrefixe(prefixe) {
        return Object.keys(state.rewardedKeys).filter((k) => k.startsWith(prefixe)).length;
      }
      const prefixesParFamille = {
        productivite: "tache-terminee:",
        delivery: "projet-cloture:",
        collaboration: "lien-cree:",
        objectifs: "revue-eadp:",
        inbox: "inbox-qualifiee:",
        ressources: "ressource-creee:",
        prompts: "prompt-cree:",
        decisions: "decision-creee:",
        reunions: "reunion-creee:",
        organisation: "postit-cree:",
      };

      const ecarts = [];
      for (const famille of Object.keys(prefixesParFamille)) {
        const attendu = compterParPrefixe(prefixesParFamille[famille]);
        const obtenu = gamificationApi.valeurCouranteFamille(state, famille, collaborateursDistincts);
        if (attendu !== obtenu) ecarts.push({ famille, attendu, obtenu });
      }
      // Management et Expert vérifiés séparément (sources différentes, pas de préfixe).
      if (gamificationApi.valeurCouranteFamille(state, "management", collaborateursDistincts) !== collaborateursDistincts) {
        ecarts.push({ famille: "management", attendu: collaborateursDistincts, obtenu: gamificationApi.valeurCouranteFamille(state, "management", collaborateursDistincts) });
      }
      if (gamificationApi.valeurCouranteFamille(state, "expert") !== state.xpTotal) {
        ecarts.push({ famille: "expert", attendu: state.xpTotal, obtenu: gamificationApi.valeurCouranteFamille(state, "expert") });
      }
      return { ecarts };
    });

    expect(result.ecarts).toEqual([]);
  });
});
