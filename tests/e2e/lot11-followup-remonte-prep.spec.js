// TODO-025 (LOT 11, TODO_TECHNIQUE.md) — "Remonter au prochain point" : décision indépendante du
// "Sens" du Suivi (`direction`, "waiting_on"/"to_tell"), disponible dès la création depuis la
// fiche Personne (js/views/people.js#openCreateFollowUpModal), et non plus seulement via l'écran
// de masquage privé (js/views/prepMask.js) — voir le commentaire explicite au-dessus du champ
// dans le formulaire (js/views/people.js, ~ligne 1911) pour l'arbitrage complet de Charles-Henri :
// réutilise le champ `hiddenFromPrep` déjà existant, AUCUNE nouvelle valeur de `direction` créée
// (en particulier pas de "suivi personnel" — explicitement écarté), et coché par défaut (un Suivi
// remonte normalement au prochain point).
//
// Ce fichier couvre le point 9 de la section 12 de son arbitrage : comportement par défaut,
// indépendance vis-à-vis de "waiting_on" ET "to_tell", et absence de toute valeur "personal" dans
// `js/domain/followups.js#DIRECTIONS`.
//
// AVERTISSEMENT (22/09/2026) : écrit et relu manuellement à partir du code réel (LOT 11 tout
// juste implémenté), mais jamais exécuté dans cet environnement (registre npm bloqué, voir
// tests/README.md). À reconfirmer au premier lancement réel (GitHub Actions).

import { test, expect } from "@playwright/test";
import { E2E_TEST_USER } from "./global-setup.js";
import { dismissFirstRunModals } from "../support/firstRun.js";

async function login(page) {
  await page.addInitScript(() => {
    window.__PILOTAGE_USE_FIREBASE_EMULATOR__ = true;
  });
  await page.goto("/index.html#/people");
  await page.fill("#login-email", E2E_TEST_USER.email);
  await page.fill("#login-password", E2E_TEST_USER.password);
  await page.click("#login-email-submit");
  await dismissFirstRunModals(page);
}

test("Nouveau suivi : la case 'Remonter au prochain point' est cochée par défaut et indépendante du Sens", async ({ page }) => {
  const personName = `Test LOT 11 — personne remonte-prep ${Date.now()}`;

  await login(page);
  await page.click("#new-person-btn");
  await page.fill("#person-name", personName);
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText("Personne ajoutée")).toBeVisible({ timeout: 10_000 });
  await page.getByText(personName, { exact: false }).first().click();

  await page.click("#add-followup-btn");
  // Par défaut coché, quel que soit le Sens déjà sélectionné par défaut ("waiting_on").
  await expect(page.locator("#fu-remonte-prep")).toBeChecked();
  // Changer le Sens vers "to_tell" ne décoche pas la case : les deux réglages sont indépendants.
  await page.locator('input[name="fu-direction"][value="to_tell"]').check();
  await expect(page.locator("#fu-remonte-prep")).toBeChecked();
});

test("Suivi 'waiting_on' avec 'Remonter au prochain point' décoché : hiddenFromPrep=true, direction inchangée", async ({ page }) => {
  const personName = `Test LOT 11 — personne waiting_on ${Date.now()}`;
  const followUpTitle = `Test LOT 11 — suivi waiting masqué ${Date.now()}`;

  await login(page);
  await page.click("#new-person-btn");
  await page.fill("#person-name", personName);
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText("Personne ajoutée")).toBeVisible({ timeout: 10_000 });
  await page.getByText(personName, { exact: false }).first().click();

  await page.click("#add-followup-btn");
  await page.fill("#fu-title", followUpTitle);
  // Sens par défaut "waiting_on" — laissé tel quel.
  await page.locator("#fu-remonte-prep").uncheck();
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText("Suivi créé")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Terminé" }).click();

  // Le suivi reste un "waiting_on" normal (visible dans les Engagements en cours) — seule sa
  // remontée en préparation change, jamais son Sens. La valeur persistée de `hiddenFromPrep`
  // elle-même (son effet réel sur "Préparer mon point", js/views/people.js#
  // computePrepSections) est vérifiée au niveau des données par tests/unit/
  // lot11-objectives-model.spec.js, plus robuste ici qu'une navigation UI à travers la fenêtre
  // de masquage privée (`window.open`, voir js/views/people.js#openPrepMaskThenPrep).
  const row = page.locator("#active-followups .item-row", { hasText: followUpTitle });
  await expect(row).toBeVisible({ timeout: 10_000 });
});

test("Suivi 'to_tell' avec 'Remonter au prochain point' décoché : hiddenFromPrep=true sans dépendre du Sens 'à transmettre'", async ({ page }) => {
  const personName = `Test LOT 11 — personne to_tell ${Date.now()}`;
  const followUpTitle = `Test LOT 11 — suivi à transmettre masqué ${Date.now()}`;

  await login(page);
  await page.click("#new-person-btn");
  await page.fill("#person-name", personName);
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText("Personne ajoutée")).toBeVisible({ timeout: 10_000 });
  await page.getByText(personName, { exact: false }).first().click();

  await page.click("#add-followup-btn");
  await page.fill("#fu-title", followUpTitle);
  await page.locator('input[name="fu-direction"][value="to_tell"]').check();
  await page.locator("#fu-remonte-prep").uncheck();
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText("Suivi créé")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Terminé" }).click();

  // Le suivi apparaît bien comme "à transmettre" (onglet dédié), et non "waiting_on" — la case
  // décochée n'a pas déduit ou modifié le Sens.
  const row = page.locator("#to-tell-followups .item-row", { hasText: followUpTitle });
  await expect(row).toBeVisible({ timeout: 10_000 });
});
