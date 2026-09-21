// TEST-020 (AUDIT_TESTS.md, P0) — parcours E2E cœur "Capture → Qualification → Tâche créée"
// (voir SYS-008 / TODO-002 dans TODO_TECHNIQUE.md, correction systémique n°1). Tourne contre
// l'émulateur Firebase (Auth + Firestore), authentifié avec le compte de test créé par
// e2e/global-setup.js — jamais contre la production.
//
// AVERTISSEMENT (20/09/2026) : écrit et relu manuellement à partir du code réel
// (js/components/capture.js, js/views/inbox.js, js/views/kanban.js#openCreateTaskModal), mais
// jamais exécuté dans l'environnement où il a été rédigé (registre npm bloqué par la politique
// réseau — voir tests/README.md). Le clic d'ouverture de la fiche projet/tâche et le texte exact
// des toasts sont fidèles au code au moment de la rédaction, mais à reconfirmer au premier
// lancement réel (l'app a pu évoluer depuis).

import { test, expect } from "@playwright/test";
import { E2E_TEST_USER } from "./global-setup.js";

test("Capture → Qualification (Action) → Tâche créée", async ({ page }) => {
  const rawText = `Test LOT 0B — capture ${Date.now()}`;

  // 1. Connexion (émulateur Auth, compte créé par global-setup.js — jamais un vrai compte Google).
  await page.goto("/index.html");
  await page.fill("#login-email", E2E_TEST_USER.email);
  await page.fill("#login-password", E2E_TEST_USER.password);
  await page.click("#login-email-submit");
  await expect(page.locator(".fab")).toBeVisible({ timeout: 10_000 });

  // 2. Capture rapide (js/components/capture.js) — bouton flottant "+".
  await page.click(".fab");
  await page.fill("#capture-input", rawText);
  await page.getByRole("button", { name: "Enregistrer" }).click();

  // 3. Qualification (js/views/inbox.js#openQualifyModal) — l'item capturé apparaît en attente.
  await page.goto("/index.html#/inbox");
  const row = page.locator(".item-row", { hasText: rawText });
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.getByRole("button", { name: "Traiter" }).click();

  // 4. Choix "Action" (= qualifie en Tâche, voir QUALIFY_CHOICES dans inbox.js).
  await page.getByRole("button", { name: /Action/ }).click();

  // 5. Formulaire de création de Tâche (js/views/kanban.js#openCreateTaskModal), préremplit le
  //    titre avec le texte capturé — on confirme tel quel.
  await expect(page.locator("#new-task-title")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Créer" }).click();

  // 6. Confirmation : toast dédié posé par inbox.js#openTaskFromInboxModal ("Action créée").
  await expect(page.getByText("Action créée")).toBeVisible({ timeout: 10_000 });

  // 7. La fiche complète de la tâche s'ouvre ensuite automatiquement (retour de Charles-Henri,
  //    13/09/2026, voir openTaskFromInboxModal) — confirmation supplémentaire, indépendante du
  //    texte exact du toast, que la qualification a bien abouti à une vraie tâche.
  await expect(page.getByText(rawText)).toBeVisible({ timeout: 10_000 });
});
