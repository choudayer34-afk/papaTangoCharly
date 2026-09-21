// TEST-021 (AUDIT_TESTS.md, P0) — parcours E2E cœur "Création de projet → Ajout de tâche →
// Clôture du projet" (voir SYS-008 / TODO-002 dans TODO_TECHNIQUE.md, correction systémique
// n°1). Tourne contre l'émulateur Firebase (Auth + Firestore), authentifié avec le compte de
// test créé par e2e/global-setup.js — jamais contre la production.
//
// AVERTISSEMENT (20/09/2026) : écrit et relu manuellement à partir du code réel
// (js/views/projects.js#openCreateProjectModal/openProjectDetail/closeProject), mais jamais
// exécuté dans l'environnement où il a été rédigé (registre npm bloqué — voir tests/README.md).
// À reconfirmer au premier lancement réel.
//
// Correction du 21/09/2026 (premier passage réel du workflow GitHub Actions) : voir le
// commentaire équivalent dans e2e/capture-qualification.spec.js — sans `page.addInitScript`,
// l'app se connecte à la vraie production Firebase (compte de test inexistant là-bas) au lieu
// de l'émulateur.

import { test, expect } from "@playwright/test";
import { E2E_TEST_USER } from "./global-setup.js";

test("Création de projet → Ajout de tâche → Clôture du projet", async ({ page }) => {
  const projectName = `Test LOT 0B — projet ${Date.now()}`;
  const taskTitle = `Test LOT 0B — tâche ${Date.now()}`;

  // 1. Connexion (émulateur Auth).
  await page.addInitScript(() => {
    window.__PILOTAGE_USE_FIREBASE_EMULATOR__ = true;
  });
  await page.goto("/index.html#/projects");
  await page.fill("#login-email", E2E_TEST_USER.email);
  await page.fill("#login-password", E2E_TEST_USER.password);
  await page.click("#login-email-submit");

  // 2. Création du projet (js/views/projects.js#openCreateProjectModal).
  await page.getByRole("button", { name: /Nouveau projet/ }).or(page.locator("#new-project-btn")).click();
  await page.fill("#project-name", projectName);
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText("Projet créé")).toBeVisible({ timeout: 10_000 });

  // 3. Ouverture de la fiche projet depuis la liste (clic sur la carte, voir projects.js — le
  //    gestionnaire de clic est posé sur la carte entière, un clic sur le nom suffit).
  await page.getByText(projectName, { exact: false }).first().click();
  await expect(page.locator("#add-task-inline")).toBeVisible({ timeout: 10_000 });

  // 4. Ajout d'une tâche depuis la fiche projet (js/views/projects.js, bouton #add-task-inline
  //    → réutilise js/views/kanban.js#openCreateTaskModal).
  await page.click("#add-task-inline");
  await page.fill("#new-task-title", taskTitle);
  await page.getByRole("button", { name: "Créer" }).click();

  // 5. La fiche projet se rouvre automatiquement après création (onCreated: reopenProject) —
  //    la tâche ajoutée doit y apparaître.
  await expect(page.getByText(taskTitle)).toBeVisible({ timeout: 10_000 });

  // 6. Clôture du projet (js/views/projects.js, bouton "Clôturer le projet" puis confirmation
  //    "🗄️ Fermer le projet" — volontairement réversible, PAS une suppression, voir le
  //    commentaire de closeProject dans projects.js : Règle 3, rien n'est jamais perdu).
  await page.getByRole("button", { name: "Clôturer le projet" }).click();
  await page.getByRole("button", { name: "🗄️ Fermer le projet" }).click();
  await expect(page.getByText("Projet fermé")).toBeVisible({ timeout: 10_000 });
});
