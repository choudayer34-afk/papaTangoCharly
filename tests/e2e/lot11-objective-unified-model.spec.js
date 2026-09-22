// TODO-024 (LOT 11, TODO_TECHNIQUE.md) — modèle Objectif unifié : "Mes objectifs" (Accueil,
// js/views/dashboard.js) et les objectifs de collaborateur (fiche Personne, js/views/people.js)
// utilisent désormais EXACTEMENT le même document Firestore (`objectives`, `personId: null` vs
// `personId` renseigné) et le même bloc "Détails" repliable (SMART, catégorie, campagne/période...
// js/views/people.js#renderObjectiveDetailsFieldset), réutilisé tel quel par les deux créations
// (js/views/dashboard.js#openCreatePersonalObjectiveModal, js/views/people.js#
// openCreateObjectiveModal) — voir le commentaire en tête de js/domain/objectives.js pour
// l'arbitrage complet de Charles-Henri.
//
// Ce fichier couvre les points 1/2/5/8 de la section 12 de son arbitrage : création personnelle,
// création EADP avec champs enrichis, absence de régression d'affichage pour un objectif simple
// (pas de champ "Détails" renseigné → pas de groupe de campagne si une seule période), et
// coexistence de plusieurs campagnes/périodes sans écrasement (js/views/people.js#
// groupObjectivesByPeriod, réutilisée par dashboard.js#openMyObjectivesModal).
//
// AVERTISSEMENT (22/09/2026) : écrit et relu manuellement à partir du code réel (LOT 11 tout
// juste implémenté), mais jamais exécuté dans cet environnement (registre npm bloqué, voir
// tests/README.md). À reconfirmer au premier lancement réel (GitHub Actions).

import { test, expect } from "@playwright/test";
import { E2E_TEST_USER } from "./global-setup.js";
import { dismissFirstRunModals } from "../support/firstRun.js";

async function login(page, hash = "#/dashboard") {
  await page.addInitScript(() => {
    window.__PILOTAGE_USE_FIREBASE_EMULATOR__ = true;
  });
  await page.goto(`/index.html${hash}`);
  await page.fill("#login-email", E2E_TEST_USER.email);
  await page.fill("#login-password", E2E_TEST_USER.password);
  await page.click("#login-email-submit");
  await dismissFirstRunModals(page);
}

test("Objectif personnel (Accueil → Mes objectifs) : création simple avec le bloc Détails, sans régression d'affichage", async ({ page }) => {
  const title = `Test LOT 11 — objectif perso ${Date.now()}`;
  const consoleErrors = [];
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await login(page);
  await page.click("#my-objectives-btn");
  await page.click("#add-my-objective-btn");
  await page.fill("#my-obj-title", title);
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText("Objectif ajouté")).toBeVisible({ timeout: 10_000 });

  // Réouverture de "Mes objectifs" : un seul objectif, sans période renseignée → PAS de titre de
  // groupe "Sans période" affiché (js/views/people.js#renderObjectivesList/#dashboard.js —
  // `showGroupTitles` uniquement si plusieurs groupes), exactement le rendu à plat d'avant LOT 11.
  await expect(page.getByText(title, { exact: false })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".prep-group-label")).toHaveCount(0);
  await expect(page.getByText("0 point(s) de suivi", { exact: false })).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

test("Objectif personnel : le bloc Détails (catégorie, campagne/période, SMART) est enregistré et redisponible à la réouverture", async ({ page }) => {
  const title = `Test LOT 11 — objectif perso détaillé ${Date.now()}`;

  await login(page);
  await page.click("#my-objectives-btn");
  await page.click("#add-my-objective-btn");
  await page.fill("#my-obj-title", title);
  // Le bloc "Détails" est replié par défaut (aucun champ pré-rempli) — l'ouvrir explicitement.
  await page.getByText("Détails (optionnel", { exact: false }).click();
  await page.fill("#objd-category", "Managérial");
  await page.fill("#objd-period", "2026-2027");
  await page.fill("#objd-smart-specific", "Monter en autonomie sur le pilotage de projet");
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText("Objectif ajouté")).toBeVisible({ timeout: 10_000 });

  await page.getByText(title, { exact: false }).click();
  // Objectif rattaché à une seule campagne pour l'instant : le bloc "Détails" s'ouvre
  // automatiquement (`hasAnyDetail`) et reprend les valeurs saisies.
  await expect(page.locator("#objd-category")).toHaveValue("Managérial");
  await expect(page.locator("#objd-period")).toHaveValue("2026-2027");
  await expect(page.locator("#objd-smart-specific")).toHaveValue("Monter en autonomie sur le pilotage de projet");
});

test("Objectif personnel : deux campagnes distinctes coexistent sans s'écraser, avec titres de groupe et statut Atteint", async ({ page }) => {
  const titleA = `Test LOT 11 — obj campagne A ${Date.now()}`;
  const titleB = `Test LOT 11 — obj campagne B ${Date.now()}`;

  await login(page);

  // Objectif de la campagne "2025".
  await page.click("#my-objectives-btn");
  await page.click("#add-my-objective-btn");
  await page.fill("#my-obj-title", titleA);
  await page.getByText("Détails (optionnel", { exact: false }).click();
  await page.fill("#objd-period", "2025");
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText("Objectif ajouté")).toBeVisible({ timeout: 10_000 });

  // Objectif de la campagne "2026-2027", depuis la même liste rouverte.
  await page.click("#add-my-objective-btn");
  await page.fill("#my-obj-title", titleB);
  await page.getByText("Détails (optionnel", { exact: false }).click();
  await page.fill("#objd-period", "2026-2027");
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText("Objectif ajouté")).toBeVisible({ timeout: 10_000 });

  // Les deux groupes apparaissent, chacun gardant son propre objectif (pas d'écrasement du champ
  // `period` d'un objectif par l'autre) — le plus récemment créé ("2026-2027") en premier
  // (js/views/people.js#groupObjectivesByPeriod, tri décroissant par récence).
  const groupLabels = page.locator(".prep-group-label");
  await expect(groupLabels).toHaveCount(2);
  await expect(groupLabels.nth(0)).toHaveText("2026-2027");
  await expect(groupLabels.nth(1)).toHaveText("2025");
  await expect(page.getByText(titleA, { exact: false })).toBeVisible();
  await expect(page.getByText(titleB, { exact: false })).toBeVisible();

  // Modification + statut : cocher "Objectif atteint" sur la campagne 2025 ne touche pas 2026-2027.
  await page.getByText(titleA, { exact: false }).click();
  await page.locator("#obj-done").check();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Objectif mis à jour")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(`✅ ${titleA}`, { exact: false })).toBeVisible();
  await expect(page.getByText(`🎯 ${titleB}`, { exact: false })).toBeVisible();
});

test("Objectif de collaborateur (fiche Personne → EADP) : création avec champs enrichis, même modèle que l'objectif personnel", async ({ page }) => {
  const personName = `Test LOT 11 — personne ${Date.now()}`;
  const title = `Test LOT 11 — objectif EADP ${Date.now()}`;

  await login(page, "#/people");
  await page.click("#new-person-btn");
  await page.fill("#person-name", personName);
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText("Personne ajoutée")).toBeVisible({ timeout: 10_000 });

  await page.getByText(personName, { exact: false }).first().click();
  await page.click("#fiche-tab-objectives");
  await page.click("#add-objective-btn");
  await page.fill("#obj-title", title);
  await page.getByText("Détails (optionnel", { exact: false }).click();
  await page.fill("#objd-category", "Technique");
  await page.locator('input[name="objd-scope"][value="individual"]').check();
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText("Objectif ajouté")).toBeVisible({ timeout: 10_000 });

  await page.getByText(title, { exact: false }).click();
  await expect(page.locator("#objd-category")).toHaveValue("Technique");
  await expect(page.locator('input[name="objd-scope"][value="individual"]')).toBeChecked();
  // Sections Indicateurs/Suivis/Tags/Lié présentes exactement comme pour un objectif personnel —
  // même fiche de détail (js/views/people.js#openObjectiveDetail), aucun second modèle.
  await expect(page.getByText("📊 Indicateurs (0)")).toBeVisible();
  await expect(page.getByText("🕒 Suivis récents (0)")).toBeVisible();
});
