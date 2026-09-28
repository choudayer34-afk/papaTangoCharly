// Ad hoc du 28/09/2026 (TODO_GAMIFICATION.md §6/§10 point 4) — suite directe de LOT G7 (qui avait
// attribué les déblocages Thème/Fond/Ruban sans jamais les appliquer visuellement, faute
// d'infrastructure) et de LOT G8 (écran Progression, qui vient de fournir cette infrastructure
// pour Fond/Ruban) : retour de Charles-Henri ("on fait"), deux points d'ambiguïté clarifiés par
// AskUserQuestion avant tout développement (portée du Thème : toute l'app ; coexistence avec le
// mode clair/sombre : superposé, jamais remplacé — voir js/services/gamificationThemeStore.js
// pour le détail complet). Ce fichier vérifie uniquement ce qui est réellement NOUVEAU à cet
// ajout : les 3 nouvelles préférences d'équipement (`setGamificationThemeEquipee`/
// `setGamificationFondEquipee`/`setGamificationRubanEquipee`, même principe que
// `setGamificationIconeEquipee` déjà testé par tests/unit/lotG7-gamification-deblocages.spec.js),
// l'intégrité du catalogue mis à jour (`valeur` n'est plus jamais `null` pour ces 18 déblocages,
// `CATEGORIES_DEBLOCAGES` les marque toutes `equipable: true`) et `applyGamificationTheme()`
// (attribut DOM `data-gamification-theme`, pure fonction sans accès réseau). Jamais retesté ce qui
// l'est déjà par LOT G7 (attribution des 34 déblocages elle-même, moteur `verifierDeblocages()`).
// Même harnais que le reste de ce dossier (tests/support/harness.html, émulateur Firebase).
//
// AVERTISSEMENT (28/09/2026, même principe que les autres fichiers de ce dossier et
// tests/README.md) : écrit et relu manuellement à partir du code réel, mais JAMAIS EXÉCUTÉ dans
// cet environnement (registre npm et émulateur Firebase indisponibles ici, voir tests/README.md)
// — à lancer réellement via `npm run test:e2e` (GitHub Actions ou poste de Charles-Henri) avant
// d'être considéré comme validé.

import { test, expect } from "@playwright/test";
import { E2E_TEST_USER } from "../e2e/global-setup.js";

test.describe("Ad hoc 28/09/2026 — Application visuelle de Thème/Fond/Ruban (suite de LOT G7)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/support/harness.html");
    await page.waitForFunction(() => window.__pilotageTestApiReady === true);
    await page.evaluate(async ({ email, password }) => {
      await window.__pilotageTestApi.firebaseApi.signInEmail(email, password);
    }, E2E_TEST_USER);
    await page.waitForFunction(() => !!window.__pilotageTestApi.firebaseApi.getCurrentUser());
  });

  test("setGamificationThemeEquipee()/setGamificationFondEquipee()/setGamificationRubanEquipee() : chaque préférence s'écrit, se relit, et se remet à null", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { preferencesApi } = window.__pilotageTestApi;

      await preferencesApi.setGamificationThemeEquipee("theme-ardoise");
      const themeApresEquipe = (await preferencesApi.getPreferences()).gamificationThemeEquipeId;
      await preferencesApi.setGamificationThemeEquipee(null);
      const themeApresDesequipe = (await preferencesApi.getPreferences()).gamificationThemeEquipeId;

      await preferencesApi.setGamificationFondEquipee("fond-horizon");
      const fondApresEquipe = (await preferencesApi.getPreferences()).gamificationFondEquipeId;
      await preferencesApi.setGamificationFondEquipee(null);
      const fondApresDesequipe = (await preferencesApi.getPreferences()).gamificationFondEquipeId;

      await preferencesApi.setGamificationRubanEquipee("ruban-productivite");
      const rubanApresEquipe = (await preferencesApi.getPreferences()).gamificationRubanEquipeId;
      await preferencesApi.setGamificationRubanEquipee(null);
      const rubanApresDesequipe = (await preferencesApi.getPreferences()).gamificationRubanEquipeId;

      return {
        themeApresEquipe,
        themeApresDesequipe,
        fondApresEquipe,
        fondApresDesequipe,
        rubanApresEquipe,
        rubanApresDesequipe,
      };
    });

    expect(result.themeApresEquipe).toBe("theme-ardoise");
    expect(result.themeApresDesequipe).toBeNull();
    expect(result.fondApresEquipe).toBe("fond-horizon");
    expect(result.fondApresDesequipe).toBeNull();
    expect(result.rubanApresEquipe).toBe("ruban-productivite");
    expect(result.rubanApresDesequipe).toBeNull();
  });

  test("Catalogue : les 18 déblocages Thème/Fond/Ruban portent désormais une valeur réelle (jamais null), et leurs 3 catégories sont équipables", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { gamificationApi } = window.__pilotageTestApi;

      const dixHuit = gamificationApi.DEBLOCAGES.filter((d) => ["theme", "fond", "ruban"].includes(d.categorie));
      const aucuneValeurNulle = dixHuit.every((d) => d.valeur !== null && d.valeur !== undefined && d.valeur !== "");
      const rubansSontDesCouleursHex = dixHuit
        .filter((d) => d.categorie === "ruban")
        .every((d) => /^#[0-9A-Fa-f]{6}$/.test(d.valeur));
      // Aucune collision de couleur entre les 14 rubans (chaque famille doit rester
      // visuellement distincte, voir le commentaire sur DEBLOCAGES).
      const couleursRubans = dixHuit.filter((d) => d.categorie === "ruban").map((d) => d.valeur);
      const couleursUniques = new Set(couleursRubans).size === couleursRubans.length;

      const categoriesEquipables = gamificationApi.CATEGORIES_DEBLOCAGES.filter((c) =>
        ["theme", "fond", "ruban"].includes(c.id)
      ).every((c) => c.equipable === true);

      return {
        total: dixHuit.length,
        aucuneValeurNulle,
        rubansSontDesCouleursHex,
        couleursUniques,
        categoriesEquipables,
      };
    });

    expect(result.total).toBe(18); // 2 Thème + 2 Fond + 14 Ruban
    expect(result.aucuneValeurNulle).toBe(true);
    expect(result.rubansSontDesCouleursHex).toBe(true);
    expect(result.couleursUniques).toBe(true);
    expect(result.categoriesEquipables).toBe(true);
  });

  test("applyGamificationTheme() : pose l'attribut DOM pour un id valide, le retire pour null/un id inconnu", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { gamificationThemeStore } = window.__pilotageTestApi;
      const html = document.documentElement;

      gamificationThemeStore.applyGamificationTheme("ardoise");
      const posePourArdoise = html.dataset.gamificationTheme;

      gamificationThemeStore.applyGamificationTheme("nuit-profonde");
      const posePourNuitProfonde = html.dataset.gamificationTheme;

      gamificationThemeStore.applyGamificationTheme(null);
      const retirePourNull = "gamificationTheme" in html.dataset;

      gamificationThemeStore.applyGamificationTheme("id-inconnu");
      const retirePourIdInconnu = "gamificationTheme" in html.dataset;

      return { posePourArdoise, posePourNuitProfonde, retirePourNull, retirePourIdInconnu };
    });

    expect(result.posePourArdoise).toBe("ardoise");
    expect(result.posePourNuitProfonde).toBe("nuit-profonde");
    expect(result.retirePourNull).toBe(false);
    expect(result.retirePourIdInconnu).toBe(false);
  });
});
