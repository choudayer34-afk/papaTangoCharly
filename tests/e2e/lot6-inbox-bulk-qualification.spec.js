// TEST-022 (AUDIT_TESTS.md), étendu pour LOT 6 / TODO-013 — "Traiter en lot" dans l'Inbox
// (js/views/inbox.js) et dans la Revue hebdomadaire (js/components/weeklyReview.js).
//
// Périmètre couvert ici (voir TODO_TECHNIQUE.md, TODO-013) :
//  - le mode lot est désactivé par défaut (aucune case à cocher tant qu'il n'est pas activé
//    explicitement) ;
//  - une fois activé, seules les qualifications sans formulaire de création (Information,
//    Archiver) sont proposées en lot — jamais Action/Suivi/Projet/Réunion/Décision/Ressource ;
//  - le traitement en lot qualifie effectivement tous les éléments sélectionnés, sans qu'un
//    élément puisse être traité deux fois (la sélection et la barre d'actions disparaissent de
//    façon synchrone avant l'écriture réelle — voir processBulk() dans js/views/inbox.js) ;
//  - le comportement individuel ("Traiter" → les 8 choix) reste inchangé, y compris quand le
//    mode lot est actif ;
//  - la Revue hebdomadaire applique le même principe pour sa propre section Inbox, sans fermer
//    toute la revue (contrairement au traitement individuel, qui la ferme pour ouvrir la fiche
//    résultante).
//
// MIS À JOUR (22/09/2026, LOT 9, TODO-021) : « Idée » n'existe plus comme choix de qualification
// séparé — fusionné avec « Information » (décision produit du 15/09/2026, voir js/views/inbox.js
// #KEPT_TYPE_LABEL). Ce test attendait encore 3 choix en lot (Information/Idée/Archiver) et 9
// choix en qualification individuelle ; mis à jour à 2 et 8 respectivement, avec une assertion
// négative ajoutée pour verrouiller la disparition d'« Idée » contre une régression future.
//
// AVERTISSEMENT (21/09/2026) : écrit et relu manuellement à partir du code réel, mais jamais
// exécuté dans l'environnement où il a été rédigé (registre npm bloqué, voir tests/README.md).
// À reconfirmer au premier lancement réel via la CI GitHub Actions.

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

async function captureRaw(page, rawText) {
  await page.click(".fab");
  await page.fill("#capture-input", rawText);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Enregistré dans l'Inbox")).toBeVisible({ timeout: 10_000 });
}

test("Inbox — Traiter en lot : désactivé par défaut, limité à Information/Archiver, qualifie sans double traitement", async ({ page }) => {
  const rawA = `Test LOT 6 — lot A ${Date.now()}`;
  const rawB = `Test LOT 6 — lot B ${Date.now()}`;
  const consoleErrors = [];
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await login(page);
  await captureRaw(page, rawA);
  await captureRaw(page, rawB);

  await page.goto("/index.html#/inbox");
  const rowA = page.locator(".item-row", { hasText: rawA });
  const rowB = page.locator(".item-row", { hasText: rawB });
  await expect(rowA).toBeVisible({ timeout: 10_000 });
  await expect(rowB).toBeVisible({ timeout: 10_000 });

  // 1. Désactivé par défaut : aucune case à cocher, et le comportement individuel ("Traiter")
  //    reste le point d'entrée normal.
  await expect(page.locator("#inbox-list input[type=\"checkbox\"]")).toHaveCount(0);
  await expect(rowA.getByRole("button", { name: "Traiter" })).toBeVisible();

  // 2. Activation explicite du mode lot.
  await page.click("#inbox-bulk-toggle");
  await expect(rowA.locator('input[type="checkbox"]')).toBeVisible();
  await expect(rowB.locator('input[type="checkbox"]')).toBeVisible();
  // Le comportement individuel reste disponible même en mode lot (pas de remplacement, un ajout).
  await expect(rowA.getByRole("button", { name: "Traiter" })).toBeVisible();

  // 3. Sélection des deux éléments capturés par ce test — la barre d'actions n'apparaît que
  //    lorsqu'au moins un élément est sélectionné, et ne propose QUE les issues sans formulaire
  //    (jamais Action/Suivi/Projet/Réunion/Décision/Ressource). « Idée » n'existe plus comme
  //    choix séparé depuis la fusion TODO-021 (LOT 9) — assertion négative ajoutée ci-dessous.
  await rowA.locator('input[type="checkbox"]').check();
  await rowB.locator('input[type="checkbox"]').check();
  const toolbar = page.locator("#inbox-bulk-toolbar-slot .pilotage-bulk-toolbar");
  await expect(toolbar).toBeVisible();
  await expect(toolbar).toContainText("2 éléments sélectionnés");
  await expect(toolbar.locator("[data-bulk-choice]")).toHaveCount(2);
  await expect(toolbar.getByRole("button", { name: /Information/ })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: /Idée/ })).toHaveCount(0);
  await expect(toolbar.getByRole("button", { name: /Archiver/ })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: /^Action$/ })).toHaveCount(0);
  await expect(toolbar.getByRole("button", { name: /Suivi/ })).toHaveCount(0);
  await expect(toolbar.getByRole("button", { name: /Projet/ })).toHaveCount(0);
  await expect(toolbar.getByRole("button", { name: /Réunion/ })).toHaveCount(0);
  await expect(toolbar.getByRole("button", { name: /Décision/ })).toHaveCount(0);
  await expect(toolbar.getByRole("button", { name: /Ressource/ })).toHaveCount(0);

  // 4. Traitement en lot ("🗑️ Archiver") : les deux éléments sont qualifiés, la sélection et la
  //    barre d'actions disparaissent aussitôt (garde anti-double-traitement) — un double clic
  //    juste après ne retrouverait donc plus ni ids ni boutons à ré-envoyer.
  await toolbar.getByRole("button", { name: /Archiver/ }).click();
  await expect(page.getByText("2 éléments traités en lot")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("#inbox-bulk-toolbar-slot .pilotage-bulk-toolbar")).toHaveCount(0);
  await expect(rowA).toHaveCount(0);
  await expect(rowB).toHaveCount(0);

  expect(consoleErrors).toEqual([]);
});

test("Inbox — Traiter en lot désactivé n'affecte pas la qualification individuelle (8 choix toujours proposés)", async ({ page }) => {
  const rawText = `Test LOT 6 — individuel ${Date.now()}`;
  await login(page);
  await captureRaw(page, rawText);

  await page.goto("/index.html#/inbox");
  const row = page.locator(".item-row", { hasText: rawText });
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.getByRole("button", { name: "Traiter" }).click();

  // Les 8 issues de qualification restent toutes proposées (3 primaires visibles d'emblée + 5
  // sous "Autre") — TODO-013 n'a rien retiré ni changé au parcours individuel existant. « Idée »
  // n'existe plus comme choix séparé depuis la fusion TODO-021 (LOT 9, 22/09/2026) — assertion
  // négative ajoutée pour verrouiller cette absence contre une régression future.
  await expect(page.getByRole("button", { name: /Action/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Suivi/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Information/ })).toBeVisible();
  await page.locator(".qualify-other summary").click();
  await expect(page.getByRole("button", { name: /Projet/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Réunion/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Décision/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Ressource/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Idée/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Archiver/ })).toBeVisible();
});

test("Revue hebdomadaire — Traiter en lot dans la section Inbox ne ferme pas la revue", async ({ page }) => {
  const rawText = `Test LOT 6 — revue ${Date.now()}`;
  await login(page);
  await captureRaw(page, rawText);

  await page.goto("/index.html#/dashboard");
  await page.click("#weekly-review-btn");
  await expect(page.getByText("🧭 Revue hebdomadaire")).toBeVisible({ timeout: 10_000 });

  const inboxRow = page.locator("#wr-inbox .item-row", { hasText: rawText });
  await expect(inboxRow).toBeVisible({ timeout: 10_000 });

  // Mode lot désactivé par défaut ici aussi (état indépendant de celui de js/views/inbox.js).
  await expect(page.locator("#wr-inbox input[type=\"checkbox\"]")).toHaveCount(0);

  await page.click("#wr-inbox-bulk-toggle");
  await inboxRow.locator('input[type="checkbox"]').check();
  const toolbar = page.locator("#wr-inbox-bulk-toolbar .pilotage-bulk-toolbar");
  await expect(toolbar).toBeVisible();
  await toolbar.getByRole("button", { name: /Information/ }).click();

  // La revue reste ouverte (contrairement au clic individuel, qui ferme la modale pour ouvrir
  // la qualification complète) : seule la section Inbox se met à jour sur place. Pas
  // d'assertion sur le compte total de la section (d'autres éléments Inbox indépendants de ce
  // test peuvent déjà être en attente) — seule la disparition de CET élément est vérifiée.
  await expect(page.getByText("🧭 Revue hebdomadaire")).toBeVisible();
  await expect(inboxRow).toHaveCount(0);
});
