// LOT G2 (TODO_GAMIFICATION.md, niveaux, 25/09/2026 — roadmap INDÉPENDANTE de
// TODO_TECHNIQUE.md, voir l'en-tête de TODO_GAMIFICATION.md) : vérifie les fonctions PURES de
// niveau ajoutées à js/domain/gamification.js — `niveauDepuisXP`, `palierDuNiveau` et
// `progressionNiveau`. Aucune de ces trois fonctions ne lit ni n'écrit Firestore (§10 : "le
// niveau n'est jamais stocké"), mais le même harnais que le reste de ce dossier (tests/support/
// harness.html, émulateur Firebase) est réutilisé pour rester cohérent avec le principe déjà
// établi (voir tests/unit/lotG1-gamification-xp-engine.spec.js) plutôt que d'introduire un
// second mécanisme de test dans ce dossier pour la seule occasion d'une fonction pure.
//
// Critères de validation du lot (voir TODO_GAMIFICATION.md → §11, LOT G2) : "le niveau affiché
// correspond exactement au barème §4 pour toute valeur d'XP, sans aucune limite supérieure
// (niveau infini, §4)" — vérifié ici par les 30 seuils EXACTS du tableau du §4 (juste en dessous
// / juste au seuil de chaque niveau), par le franchissement du niveau 30 (dernier niveau
// documenté dans le tableau) vers le niveau 31 (formule identique, aucun changement), et par une
// valeur d'XP arbitrairement grande pour prouver l'absence de plafond.
//
// AVERTISSEMENT (25/09/2026, même principe que lotG1-gamification-xp-engine.spec.js et
// tests/README.md) : écrit et relu manuellement à partir du code réel de js/domain/
// gamification.js (et vérifié indépendamment par un script Node autonome reproduisant la même
// formule contre les 30 lignes du tableau du §4 avant d'écrire ce fichier), mais JAMAIS EXÉCUTÉ
// dans cet environnement (registre npm/émulateur Firebase indisponibles ici, voir
// tests/README.md) — à lancer réellement via `npm run test:e2e` (GitHub Actions ou poste de
// Charles-Henri) avant d'être considéré comme validé.

import { test, expect } from "@playwright/test";
import { E2E_TEST_USER } from "../e2e/global-setup.js";

// Les 30 niveaux du tableau du §4 : [niveau, XP total cumulé nécessaire pour l'atteindre].
const BAREME_NIVEAUX = [
  [1, 0], [2, 50], [3, 125], [4, 225], [5, 350], [6, 500],
  [7, 675], [8, 875], [9, 1100], [10, 1350], [11, 1625], [12, 1925],
  [13, 2250], [14, 2600], [15, 2975], [16, 3375], [17, 3800], [18, 4250],
  [19, 4725], [20, 5225], [21, 5750], [22, 6300], [23, 6875], [24, 7475],
  [25, 8100], [26, 8750], [27, 9425], [28, 10125], [29, 10850], [30, 11600],
];

test.describe("LOT G2 — Niveaux (TODO_GAMIFICATION.md §4), fonctions pures sans Firestore", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/support/harness.html");
    await page.waitForFunction(() => window.__pilotageTestApiReady === true);
    await page.evaluate(async ({ email, password }) => {
      await window.__pilotageTestApi.firebaseApi.signInEmail(email, password);
    }, E2E_TEST_USER);
    await page.waitForFunction(() => !!window.__pilotageTestApi.firebaseApi.getCurrentUser());
  });

  test("niveauDepuisXP : les 30 seuils exacts du barème (§4), juste en dessous et juste au seuil", async ({ page }) => {
    const result = await page.evaluate((bareme) => {
      const { gamificationApi } = window.__pilotageTestApi;
      return bareme.map(([niveau, xpCumule]) => ({
        niveau,
        xpCumule,
        auSeuil: gamificationApi.niveauDepuisXP(xpCumule),
        juesteEnDessous: xpCumule > 0 ? gamificationApi.niveauDepuisXP(xpCumule - 1) : null,
        juesteAuDessus: gamificationApi.niveauDepuisXP(xpCumule + 1),
      }));
    }, BAREME_NIVEAUX);

    for (const row of result) {
      expect(row.auSeuil, `niveau ${row.niveau} à xp=${row.xpCumule}`).toBe(row.niveau);
      if (row.juesteEnDessous !== null) {
        expect(row.juesteEnDessous, `xp=${row.xpCumule - 1} (juste avant niveau ${row.niveau})`).toBe(row.niveau - 1);
      }
      // Au niveau 30 (dernier documenté), xp+1 reste niveau 30 (le seuil du niveau 31 est plus
      // loin, voir le test dédié ci-dessous) — sinon xp+1 doit rester dans le même niveau que le
      // seuil tant qu'on n'a pas atteint le seuil du niveau suivant.
      expect(row.juesteAuDessus, `xp=${row.xpCumule + 1} (juste après le seuil du niveau ${row.niveau})`).toBe(row.niveau);
    }
  });

  test("niveauDepuisXP : niveau infini — aucun plafond au-delà du niveau 30, même formule, jamais d'erreur", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { gamificationApi } = window.__pilotageTestApi;
      return {
        // Niveau 30 → 31 : coût du niveau 30 = 50 + 25×29 = 775 ; seuil niveau 31 = 11600 + 775 = 12375.
        niveau30: gamificationApi.niveauDepuisXP(11600),
        justeAvant31: gamificationApi.niveauDepuisXP(12374),
        niveau31: gamificationApi.niveauDepuisXP(12375),
        // Valeur arbitrairement grande — ne doit ni planter, ni plafonner, ni boucler.
        niveauTresGrandXp: gamificationApi.niveauDepuisXP(1_000_000),
        // XP négatif ou invalide (donnée corrompue) — ramené à 0, jamais une erreur.
        niveauXpNegatif: gamificationApi.niveauDepuisXP(-500),
      };
    });
    expect(result.niveau30).toBe(30);
    expect(result.justeAvant31).toBe(30);
    expect(result.niveau31).toBe(31);
    expect(result.niveauTresGrandXp).toBeGreaterThan(30);
    expect(Number.isFinite(result.niveauTresGrandXp)).toBe(true);
    expect(result.niveauXpNegatif).toBe(1);
  });

  test("niveauDepuisXP : croissance strictement non décroissante sur une plage large, sans jamais redescendre", async ({ page }) => {
    const isNonDecreasing = await page.evaluate(() => {
      const { gamificationApi } = window.__pilotageTestApi;
      let prev = gamificationApi.niveauDepuisXP(0);
      for (let xp = 0; xp <= 50_000; xp += 41) {
        const niveau = gamificationApi.niveauDepuisXP(xp);
        if (niveau < prev) return false;
        prev = niveau;
      }
      return true;
    });
    expect(isNonDecreasing).toBe(true);
  });

  test("palierDuNiveau : les 5 paliers de 6 niveaux (§4), et 💎 Légendaire inchangé indéfiniment au-delà du niveau 30", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { gamificationApi } = window.__pilotageTestApi;
      return {
        n1: gamificationApi.palierDuNiveau(1).label,
        n6: gamificationApi.palierDuNiveau(6).label,
        n7: gamificationApi.palierDuNiveau(7).label,
        n12: gamificationApi.palierDuNiveau(12).label,
        n13: gamificationApi.palierDuNiveau(13).label,
        n18: gamificationApi.palierDuNiveau(18).label,
        n19: gamificationApi.palierDuNiveau(19).label,
        n24: gamificationApi.palierDuNiveau(24).label,
        n25: gamificationApi.palierDuNiveau(25).label,
        n30: gamificationApi.palierDuNiveau(30).label,
        n31: gamificationApi.palierDuNiveau(31).label,
        n282: gamificationApi.palierDuNiveau(282).label,
      };
    });
    expect(result.n1).toBe("🥉 Bronze");
    expect(result.n6).toBe("🥉 Bronze");
    expect(result.n7).toBe("🥈 Argent");
    expect(result.n12).toBe("🥈 Argent");
    expect(result.n13).toBe("🥇 Or");
    expect(result.n18).toBe("🥇 Or");
    expect(result.n19).toBe("🏆 Platine");
    expect(result.n24).toBe("🏆 Platine");
    expect(result.n25).toBe("💎 Légendaire");
    expect(result.n30).toBe("💎 Légendaire");
    // Niveau infini (§4) : aucun palier au-delà de 💎 Légendaire, quel que soit le niveau atteint.
    expect(result.n31).toBe("💎 Légendaire");
    expect(result.n282).toBe("💎 Légendaire");
  });

  test("progressionNiveau : XP dans le niveau courant, XP restant avant le niveau suivant, ratio [0,1]", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { gamificationApi } = window.__pilotageTestApi;
      return {
        // xp=100 : niveau 2 (seuil 50), niveau 3 au seuil 125 → coût du niveau 2 = 75.
        milieu: gamificationApi.progressionNiveau(100),
        // Pile au seuil d'un niveau : 0 XP consommé dans le niveau qui vient de commencer.
        pileAuSeuil: gamificationApi.progressionNiveau(500),
        // Juste avant le seuil suivant : progressionRatio proche de 1 mais jamais atteint tant
        // que le seuil exact n'est pas franchi.
        justeAvantSeuil: gamificationApi.progressionNiveau(674),
      };
    });

    expect(result.milieu.niveau).toBe(2);
    expect(result.milieu.palier).toBe("🥉 Bronze");
    expect(result.milieu.xpTotal).toBe(100);
    expect(result.milieu.xpDansNiveauCourant).toBe(50); // 100 - 50 (seuil niveau 2)
    expect(result.milieu.xpPourNiveauSuivant).toBe(75); // coût niveau 2 → 3
    expect(result.milieu.xpRestantAvantNiveauSuivant).toBe(25);
    expect(result.milieu.progressionRatio).toBeCloseTo(50 / 75, 5);

    expect(result.pileAuSeuil.niveau).toBe(6);
    expect(result.pileAuSeuil.xpDansNiveauCourant).toBe(0);
    expect(result.pileAuSeuil.progressionRatio).toBe(0);

    expect(result.justeAvantSeuil.niveau).toBe(6);
    expect(result.justeAvantSeuil.xpPourNiveauSuivant).toBe(175); // coût niveau 6 → 7
    expect(result.justeAvantSeuil.xpRestantAvantNiveauSuivant).toBe(1);
    expect(result.justeAvantSeuil.progressionRatio).toBeCloseTo(174 / 175, 5);
  });
});
