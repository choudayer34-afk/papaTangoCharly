// TEST-010 (AUDIT_TESTS.md, P1) — "suppression d'un Projet/d'une Personne (politique assumée de
// non-cascade) laisse des références orphelines (`task.projectId`, `followUp.personId`) sans
// qu'aucun test ne vérifie que l'affichage les gère proprement partout (DATA-003)." Voir LOT 1
// (TODO-007) dans TODO_TECHNIQUE.md — ce test couvre le cas Tâche/Projet cité en exemple par
// l'audit ; le cas Suivi/Personne n'est pas traité ici (hors du périmètre explicite de ce lot,
// qui ne porte que sur le message de confirmation affiché avant suppression, pas sur un nouveau
// test dédié au rendu d'un Suivi orphelin).
//
// AVERTISSEMENT (21/09/2026) : écrit et relu manuellement à partir du code réel
// (js/views/kanban.js#renderCard, qui cherche déjà le projet via `projects.find(...)` sans jamais
// throw si absent), mais jamais exécuté dans l'environnement où il a été rédigé (registre npm
// bloqué, voir tests/README.md). À reconfirmer au premier lancement réel.

import { test, expect } from "@playwright/test";
import { E2E_TEST_USER } from "./global-setup.js";
import { dismissFirstRunModals } from "../support/firstRun.js";

test("Tâche liée à un projet supprimé : reste affichée sans son badge projet, sans erreur", async ({ page }) => {
  const projectName = `Test LOT 1 — projet orphelin ${Date.now()}`;
  const taskTitle = `Test LOT 1 — tâche orpheline ${Date.now()}`;
  const consoleErrors = [];
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.addInitScript(() => {
    window.__PILOTAGE_USE_FIREBASE_EMULATOR__ = true;
  });
  await page.goto("/index.html#/projects");
  await page.fill("#login-email", E2E_TEST_USER.email);
  await page.fill("#login-password", E2E_TEST_USER.password);
  await page.click("#login-email-submit");
  await dismissFirstRunModals(page);

  // 1. Projet + tâche liée (même parcours que e2e/projet-creation-cloture.spec.js).
  await page.getByRole("button", { name: /Nouveau projet/ }).or(page.locator("#new-project-btn")).click();
  await page.fill("#project-name", projectName);
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText("Projet créé")).toBeVisible({ timeout: 10_000 });

  await page.getByText(projectName, { exact: false }).first().click();
  await page.getByRole("tab", { name: "Contenu" }).click();
  await page.click("#add-task-inline");
  await page.fill("#new-task-title", taskTitle);
  await page.getByRole("button", { name: "Créer" }).click();
  await page.getByRole("tab", { name: "Contenu" }).click();
  await expect(page.locator("#detail-tasks").getByText(taskTitle)).toBeVisible({ timeout: 10_000 });

  // 2. Suppression DÉFINITIVE du projet (pas une clôture) — message d'impact ajouté par LOT 1
  // (TODO-007) avant confirmation. Assertion scopée à `.modal-body` (voir js/components/
  // modal.js#openModal) : un `getByText("tâche")` global est ambigu — il matche aussi l'onglet
  // "📋 Tâches" et un toast "Tâche créée" pas encore retiré du DOM (même famille de
  // strict-mode violation déjà rencontrée en LOT 0B, voir tests/README.md).
  await page.getByRole("button", { name: "Supprimer" }).click();
  await expect(page.locator(".modal-body").getByText("tâche")).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: "Supprimer" }).click();
  await expect(page.getByText("Projet supprimé")).toBeVisible({ timeout: 10_000 });

  // 3. La tâche reste visible dans le Kanban, sans badge projet (js/views/kanban.js#renderCard,
  // qui n'affiche `📦 ${project.name}` que si `projects.find(...)` trouve une correspondance) et
  // sans erreur JS levée par le rendu d'une référence désormais dans le vide.
  await page.goto("/index.html#/kanban");
  const card = page.locator(".kanban-card", { hasText: taskTitle });
  await expect(card).toBeVisible({ timeout: 10_000 });
  await expect(card.getByText("📦", { exact: false })).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
});