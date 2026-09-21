// TEST-022 (AUDIT_TESTS.md), étendu pour LOT 6 / TODO-008 point 1 — lien "InboxSource" (arbitrage
// de Charles-Henri, 21/09/2026) : l'entité créée à la qualification (ici une Tâche) doit afficher,
// dans sa section "🔗 Lié", un lien résolu vers la capture Inbox dont elle est issue — pas
// "Élément supprimé" — sans que le type de référence "Kept" existant (Informations/Idées,
// `status === "kept"`) n'en soit affecté.
//
// Complète tests/unit/lot6-inbox-qualify-project-links.spec.js (qui vérifie la CRÉATION du lien
// côté domaine) par la vérification de sa RÉSOLUTION côté UI (js/components/linkedItems.js), qui
// ne peut se tester qu'en conditions réelles de navigateur (resolveRefDirect n'est pas exportée).
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

test("TODO-008 point 1 — qualifier en Action pose un lien InboxSource résolu (pas 'Élément supprimé')", async ({ page }) => {
  const rawText = `Test LOT 6 — source link ${Date.now()}`;

  await login(page);
  await captureRaw(page, rawText);

  await page.goto("/index.html#/inbox");
  const row = page.locator(".item-row", { hasText: rawText });
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.getByRole("button", { name: "Traiter" }).click();
  await page.getByRole("button", { name: /Action/ }).click();
  await expect(page.locator("#new-task-title")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText("Action créée")).toBeVisible({ timeout: 10_000 });

  // La fiche Tâche s'ouvre automatiquement — sa section "🔗 Lié" doit afficher le lien vers la
  // capture d'origine, résolu (le texte capturé, pas "Élément supprimé").
  await expect(page.locator("#detail-description")).toBeVisible({ timeout: 10_000 });
  // La fiche Tâche est à onglets (vague 24) : "🔗 Lié" est regroupé sous l'onglet "Activité",
  // non visible par défaut (onglet "Détails" actif à l'ouverture) — voir js/views/kanban.js,
  // `.fiche-tabpanel[data-tabpanel="activity"]` porte `hidden` tant que cet onglet n'est pas
  // sélectionné.
  await page.getByRole("tab", { name: "Activité" }).click();
  const sourceRow = page.locator("#detail-links .item-row", { hasText: rawText });
  await expect(sourceRow).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("#detail-links")).not.toContainText("Élément supprimé");

  // Cliquer dessus ouvre la fiche minimale en lecture seule (openInboxSourceDetail), distincte de
  // la fiche "🧠 Information"/"💡 Idée" : pas de bouton "Archiver" ni "Changer de type" ici — ce
  // lien ne doit jamais permettre de re-qualifier ou modifier l'InboxItem source.
  await sourceRow.click();
  // `getByRole("heading", ...)` plutôt que `getByText` : ne matche que le titre <h2> de la
  // modale, jamais un texte identique affiché ailleurs dans son corps.
  await expect(page.getByRole("heading", { name: "📥 Capture d'origine" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(rawText)).toBeVisible();
  await expect(page.getByRole("button", { name: "🗄️ Archiver" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "🔁 Changer de type" })).toHaveCount(0);
  // `exact: true` : même ambiguïté que dans le test suivant — "Fermer" matche aussi par
  // sous-chaîne le bouton "Fermer ce conseil" d'un bandeau d'astuce par ailleurs présent sur
  // la page.
  await expect(page.getByRole("button", { name: "Fermer", exact: true })).toBeVisible();
});

test("Régression — le type de référence 'Kept' se résout toujours normalement après l'ajout d'InboxSource", async ({ page }) => {
  const rawInfo = `Test LOT 6 — info régression ${Date.now()}`;
  const rawTask = `Test LOT 6 — tâche pour lier ${Date.now()}`;

  await login(page);

  // 1. Une capture qualifiée en Information reste inchangée : status "kept", fiche "🧠
  //    Information" normale.
  await captureRaw(page, rawInfo);
  await page.goto("/index.html#/inbox");
  const infoRow = page.locator(".item-row", { hasText: rawInfo });
  await expect(infoRow).toBeVisible({ timeout: 10_000 });
  await infoRow.getByRole("button", { name: "Traiter" }).click();
  await page.getByRole("button", { name: /Information/ }).click();
  // `getByRole("heading", ...)` plutôt que `getByText` : js/views/inbox.js#openKeptItemDetail
  // affiche "🧠 Information" à la fois comme titre <h2> ET comme label de champ dans le corps
  // (comportement préexistant, hors périmètre de ce lot) — seul le titre doit être visé ici.
  await expect(page.getByRole("heading", { name: "🧠 Information" })).toBeVisible({ timeout: 10_000 });
  // `exact: true` : sans lui, "Fermer" matche aussi le bouton "Fermer ce conseil" d'un bandeau
  // d'astuce par ailleurs présent sur la page (getByRole matche par sous-chaîne par défaut).
  await page.getByRole("button", { name: "Fermer", exact: true }).click();

  // 2. Une Tâche, liée manuellement à cette Information via "🔗 Lier une fiche" — chemin
  //    totalement indépendant de la qualification/InboxSource, qui exerce directement le cas
  //    "Kept" de resolveRefDirect (le même code que ci-dessus, non touché par ce lot).
  await captureRaw(page, rawTask);
  await page.goto("/index.html#/inbox");
  const taskRow = page.locator(".item-row", { hasText: rawTask });
  await expect(taskRow).toBeVisible({ timeout: 10_000 });
  await taskRow.getByRole("button", { name: "Traiter" }).click();
  await page.getByRole("button", { name: /Action/ }).click();
  await expect(page.locator("#new-task-title")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText("Action créée")).toBeVisible({ timeout: 10_000 });

  // "🔗 Lier une fiche" est lui aussi regroupé sous l'onglet "Activité" (voir plus haut).
  await page.getByRole("tab", { name: "Activité" }).click();
  await page.click("#link-existing-btn");
  await page.fill("#link-picker-input", rawInfo);
  const pickerRow = page.locator("#link-picker-results .item-row", { hasText: rawInfo });
  await expect(pickerRow).toBeVisible({ timeout: 10_000 });
  await pickerRow.click();
  await expect(page.getByText("Lien créé")).toBeVisible({ timeout: 10_000 });

  // La fiche Tâche se rouvre (onLinked) avec une HTML fraîche : l'onglet "Détails" redevient
  // actif par défaut, il faut re-sélectionner "Activité" pour retrouver "🔗 Lié".
  await page.getByRole("tab", { name: "Activité" }).click();
  // La fiche Tâche se rouvre (onLinked) : le lien vers l'Information doit être résolu — même
  // comportement qu'avant ce lot, le cas "Kept" de resolveRefDirect n'a pas été modifié.
  const keptLinkRow = page.locator("#detail-links .item-row", { hasText: rawInfo });
  await expect(keptLinkRow).toBeVisible({ timeout: 10_000 });
  await expect(keptLinkRow).toContainText("🧠");
  await expect(page.locator("#detail-links")).not.toContainText("Élément supprimé");
});
