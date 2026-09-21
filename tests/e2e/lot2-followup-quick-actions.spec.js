// TODO-004 (LOT 2, TODO_TECHNIQUE.md) — "ajouter un bouton « 🔁 Relancer / ✅ Réglé » à 1 clic sur
// chaque ligne de Suivi." Ce test couvre le principal chemin d'affichage d'une ligne de Suivi,
// la fiche Personne (js/views/people.js#appendFollowUpRows, onglet "Suivis" → "🎯 Engagements en
// cours") : la fiche y affiche un INSTANTANÉ non réactif (pas de followUpsApi.subscribe propre à
// la modale, contrairement à la liste "👀 Suivis"), donc l'action rapide doit mettre à jour la
// ligne elle-même plutôt que de compter sur un redessin externe qui n'arriverait jamais tant que
// la fiche reste ouverte — c'est précisément ce que ce test vérifie (badge à jour, boutons
// disparus, SANS rouvrir la fiche complète d'édition).
//
// AVERTISSEMENT (21/09/2026) : écrit et relu manuellement à partir du code réel, mais jamais
// exécuté dans l'environnement où il a été rédigé (registre npm bloqué, voir tests/README.md).
// À reconfirmer au premier lancement réel.

import { test, expect } from "@playwright/test";
import { E2E_TEST_USER } from "./global-setup.js";
import { dismissFirstRunModals } from "../support/firstRun.js";

test("Suivi (fiche Personne) : '✅ Réglé' à 1 clic met à jour le badge sans ouvrir la fiche d'édition", async ({ page }) => {
  const personName = `Test LOT 2 — personne ${Date.now()}`;
  const followUpTitle = `Test LOT 2 — suivi à régler ${Date.now()}`;
  const consoleErrors = [];
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.addInitScript(() => {
    window.__PILOTAGE_USE_FIREBASE_EMULATOR__ = true;
  });
  await page.goto("/index.html#/people");
  await page.fill("#login-email", E2E_TEST_USER.email);
  await page.fill("#login-password", E2E_TEST_USER.password);
  await page.click("#login-email-submit");
  await dismissFirstRunModals(page);

  // 1. Personne + Suivi rattaché (même parcours que people.js#openPersonDetail → "+ Suivi").
  await page.click("#new-person-btn");
  await page.fill("#person-name", personName);
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText("Personne ajoutée")).toBeVisible({ timeout: 10_000 });

  await page.getByText(personName, { exact: false }).first().click();
  await page.click("#add-followup-btn");
  await page.fill("#fu-title", followUpTitle);
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText("Suivi créé")).toBeVisible({ timeout: 10_000 });
  // "Encore un suivi ?" s'affiche systématiquement après création (people.js#
  // promptAnotherFollowUp) — "Terminé" déclenche onCreated (reopen() de la fiche Personne).
  await page.getByRole("button", { name: "Terminé" }).click();

  // 2. La fiche se rouvre (onCreated: () => reopen()) — le Suivi apparaît dans "🎯 Engagements
  // en cours" (statut par défaut "waiting"), avec les boutons d'action rapide (le Suivi n'est
  // pas encore réglé).
  const row = page.locator("#active-followups .item-row", { hasText: followUpTitle });
  await expect(row).toBeVisible({ timeout: 10_000 });
  await expect(row.locator(".badge")).toHaveClass(/badge-waiting/);
  await expect(row.locator("[data-quick-done]")).toBeVisible();

  // 3. Action rapide "✅ Réglé" : le badge passe à "Réglé" et les boutons disparaissent,
  // SANS que la fiche complète d'édition (modale "Nouveau suivi"/"Modifier le suivi") ne se soit
  // ouverte par-dessus — la fiche Personne (#person-detail-name) reste affichée telle quelle.
  await row.locator("[data-quick-done]").click();
  await expect(page.getByText("Suivi réglé")).toBeVisible({ timeout: 5_000 });
  await expect(row.locator(".badge")).toHaveClass(/badge-done/);
  await expect(row.locator("[data-quick-done]")).toHaveCount(0);
  await expect(page.locator("#person-detail-name")).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

test("Suivi (liste transverse '👀 Suivis') : '🔁 Relancer' fonctionne sans ouvrir la fiche complète", async ({ page }) => {
  const personName = `Test LOT 2 — personne 2 ${Date.now()}`;
  const followUpTitle = `Test LOT 2 — suivi à relancer ${Date.now()}`;

  await page.addInitScript(() => {
    window.__PILOTAGE_USE_FIREBASE_EMULATOR__ = true;
  });
  await page.goto("/index.html#/people");
  await page.fill("#login-email", E2E_TEST_USER.email);
  await page.fill("#login-password", E2E_TEST_USER.password);
  await page.click("#login-email-submit");
  await dismissFirstRunModals(page);

  await page.click("#new-person-btn");
  await page.fill("#person-name", personName);
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText("Personne ajoutée")).toBeVisible({ timeout: 10_000 });

  await page.getByText(personName, { exact: false }).first().click();
  await page.click("#add-followup-btn");
  await page.fill("#fu-title", followUpTitle);
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText("Suivi créé")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Terminé" }).click();

  // Vue transverse "👀 Suivis" (js/views/followupsOverview.js) — même action rapide.
  await page.locator('[data-mode="followups"]').click();
  const row = page.locator(".item-row", { hasText: followUpTitle });
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.locator("[data-quick-relance]").click();
  await expect(page.getByText("Suivi relancé")).toBeVisible({ timeout: 5_000 });
  // Toujours sur la liste transverse, aucune fiche d'édition ouverte par-dessus.
  await expect(page.locator('[data-mode="followups"].active')).toBeVisible();
});
