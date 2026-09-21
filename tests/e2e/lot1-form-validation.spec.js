// TEST-017 (AUDIT_TESTS.md, P1) — "validation silencieuse des formulaires de création
// (Tâche/Projet/Ressource — `if (!title) return;` sans retour visuel, UX-002/UX-012) : une fois
// corrigée, aucun test n'empêchera une régression vers le silence." Voir LOT 1 (TODO-006) dans
// TODO_TECHNIQUE.md et js/components/formValidation.js, introduit par ce lot pour remplacer les
// trois `if (!x) return;` muets qui existaient jusqu'ici dans js/views/kanban.js,
// js/views/projects.js et js/views/resources.js.
//
// AVERTISSEMENT (21/09/2026) : écrit et relu manuellement à partir du code réel, mais — comme
// tout le reste de tests/e2e/ et tests/unit/ — jamais exécuté dans l'environnement où il a été
// rédigé (registre npm bloqué par la politique réseau, voir tests/README.md). À reconfirmer au
// premier lancement réel du workflow GitHub Actions, sur le même principe que les corrections
// de LOT 0B déjà documentées dans ce même dossier.

import { test, expect } from "@playwright/test";
import { E2E_TEST_USER } from "./global-setup.js";
import { dismissFirstRunModals } from "../support/firstRun.js";

async function login(page) {
  await page.addInitScript(() => {
    window.__PILOTAGE_USE_FIREBASE_EMULATOR__ = true;
  });
  await page.goto("/index.html");
  await page.fill("#login-email", E2E_TEST_USER.email);
  await page.fill("#login-password", E2E_TEST_USER.password);
  await page.click("#login-email-submit");
  await expect(page.locator(".fab")).toBeVisible({ timeout: 10_000 });
  await dismissFirstRunModals(page);
}

test.describe("TEST-017 — retour visuel explicite sur un champ obligatoire vide", () => {
  test("Tâche : cliquer Créer sans titre affiche un toast et surligne le champ, sans fermer la modale", async ({ page }) => {
    await login(page);
    await page.goto("/index.html#/kanban");
    await page.click("#new-task-btn");
    await expect(page.locator("#new-task-title")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Créer" }).click();

    // La modale reste ouverte (pas de close() tant que la validation échoue) et le champ est
    // visuellement marqué en défaut (voir styles/components.css, `.field-invalid`).
    await expect(page.getByText("Le titre obligatoire")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("#new-task-title")).toHaveClass(/field-invalid/);
    await expect(page.locator("#new-task-title")).toBeVisible();

    // Taper quelque chose retire le style d'erreur (clearFieldErrorOnInput) sans qu'il soit
    // nécessaire de re-cliquer Créer.
    await page.fill("#new-task-title", "Test LOT 1 — validation tâche");
    await expect(page.locator("#new-task-title")).not.toHaveClass(/field-invalid/);
  });

  test("Projet : cliquer Créer sans nom affiche un toast et surligne le champ", async ({ page }) => {
    await login(page);
    await page.goto("/index.html#/projects");
    await page.click("#new-project-btn");
    await expect(page.locator("#project-name")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Créer" }).click();

    await expect(page.getByText("Le nom obligatoire")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("#project-name")).toHaveClass(/field-invalid/);
  });

  test("Ressource : cliquer Créer sans titre affiche un toast et surligne le champ", async ({ page }) => {
    await login(page);
    await page.goto("/index.html#/resources");
    await page.click("#new-resource-btn");
    await expect(page.locator("#res-title")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Créer" }).click();

    await expect(page.getByText("Le titre obligatoire")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("#res-title")).toHaveClass(/field-invalid/);
  });

  test("Ressource : une URL mal formée est rejetée avec un message dédié (UX-012)", async ({ page }) => {
    await login(page);
    await page.goto("/index.html#/resources");
    await page.click("#new-resource-btn");
    await expect(page.locator("#res-title")).toBeVisible({ timeout: 10_000 });
    await page.fill("#res-title", "Test LOT 1 — validation URL");
    await page.fill("#res-url", "pas une url");
    await page.getByRole("button", { name: "Créer" }).click();

    await expect(page.getByText("n'est pas une URL valide")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("#res-url")).toHaveClass(/field-invalid/);
  });
});
