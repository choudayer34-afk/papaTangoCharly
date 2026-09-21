// TEST-023 (AUDIT_TESTS.md, P2) — "aucun test sur le report d'échéance dans les 3 vues (Kanban
// détail, Tableau inline, Calendrier glisser-déposer) qui doivent aboutir au même résultat en
// base. Test recommandé : test vérifiant la cohérence du résultat final (task.dueDate) quel que
// soit le chemin emprunté." Voir LOT 2 (TODO-003) dans TODO_TECHNIQUE.md — ce lot ajoute un 4e
// chemin de report (le contrôle rapide "📅" sur la carte Kanban, "+1j / +7j / date libre",
// js/views/kanban.js#renderCard). Ce test vérifie que ce nouveau chemin aboutit bien au même
// résultat que le chemin déjà existant (fiche détail, `#detail-due`) plutôt que de dupliquer un
// test de report par tableau/calendrier déjà hors du périmètre de ce lot (TODO-003 ne touche que
// js/views/kanban.js, pas le tableau ni le calendrier).
//
// AVERTISSEMENT (21/09/2026) : écrit et relu manuellement à partir du code réel
// (js/views/kanban.js#renderCard, #addDaysToIsoDate — parsing/reformatage en date LOCALE, jamais
// UTC, même précaution documentée dans js/services/dateUtils.js), mais jamais exécuté dans
// l'environnement où il a été rédigé (registre npm bloqué, voir tests/README.md). À reconfirmer
// au premier lancement réel.

import { test, expect } from "@playwright/test";
import { E2E_TEST_USER } from "./global-setup.js";
import { dismissFirstRunModals } from "../support/firstRun.js";

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

test("Report rapide '+1 jour' sur la carte Kanban : cohérent avec la fiche détail (#detail-due)", async ({ page }) => {
  const taskTitle = `Test LOT 2 — report +1j ${Date.now()}`;
  const today = new Date();
  const todayIso = isoDate(today);
  const expected = new Date(today);
  expected.setDate(expected.getDate() + 1);
  const expectedIso = isoDate(expected);

  await page.addInitScript(() => {
    window.__PILOTAGE_USE_FIREBASE_EMULATOR__ = true;
  });
  await page.goto("/index.html#/kanban");
  await page.fill("#login-email", E2E_TEST_USER.email);
  await page.fill("#login-password", E2E_TEST_USER.password);
  await page.click("#login-email-submit");
  await dismissFirstRunModals(page);

  // 1. Tâche avec une échéance connue (aujourd'hui) — bouton "+ Tâche" ajouté en LOT 1
  // (TODO-007), déjà couvert par ses propres tests ; ici seulement un moyen d'obtenir une tâche
  // avec échéance de départ prévisible.
  await page.click("#new-task-btn");
  await page.fill("#new-task-title", taskTitle);
  await page.fill("#new-task-due", todayIso);
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText("Tâche créée")).toBeVisible({ timeout: 10_000 });

  // 2. Report rapide "+1 jour" via le nouveau contrôle "📅" de la carte (TODO-003) — jamais une
  // popover positionnée en absolu (voir commentaire sur expandedDateMenus dans kanban.js), donc
  // pas de risque d'être coupée par le scroll de la colonne.
  const card = page.locator(".kanban-card", { hasText: taskTitle });
  await card.locator("[data-postpone-toggle]").click();
  await card.locator('[data-postpone-offset="1"]').click();
  await expect(page.locator(".toast")).toContainText("Échéance reportée au", { timeout: 5_000 });

  // 3. Cohérence inter-chemins (TEST-023) : la fiche détail, chemin déjà existant (`#detail-due`,
  // utilisé par le tableau et par tout appel direct à tasksApi.updateTask), affiche la MÊME date
  // que celle posée par le nouveau contrôle rapide de la carte.
  await page.locator(".kanban-card", { hasText: taskTitle }).click();
  await expect(page.locator("#detail-due")).toHaveValue(expectedIso, { timeout: 10_000 });
});

test("Report rapide 'date libre' sur la carte Kanban : la date choisie est bien celle enregistrée", async ({ page }) => {
  const taskTitle = `Test LOT 2 — date libre ${Date.now()}`;
  const chosen = new Date();
  chosen.setDate(chosen.getDate() + 14);
  const chosenIso = isoDate(chosen);

  await page.addInitScript(() => {
    window.__PILOTAGE_USE_FIREBASE_EMULATOR__ = true;
  });
  await page.goto("/index.html#/kanban");
  await page.fill("#login-email", E2E_TEST_USER.email);
  await page.fill("#login-password", E2E_TEST_USER.password);
  await page.click("#login-email-submit");
  await dismissFirstRunModals(page);

  // Tâche créée SANS échéance : le contrôle rapide doit rester utilisable même dans ce cas
  // (base de calcul "aujourd'hui" par défaut — voir kanban.js#addDaysToIsoDate).
  await page.click("#new-task-btn");
  await page.fill("#new-task-title", taskTitle);
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText("Tâche créée")).toBeVisible({ timeout: 10_000 });

  const card = page.locator(".kanban-card", { hasText: taskTitle });
  await card.locator("[data-postpone-toggle]").click();
  await card.locator("[data-postpone-custom]").fill(chosenIso);
  await expect(page.locator(".toast")).toContainText("Échéance reportée au", { timeout: 5_000 });

  await page.locator(".kanban-card", { hasText: taskTitle }).click();
  await expect(page.locator("#detail-due")).toHaveValue(chosenIso, { timeout: 10_000 });
});
