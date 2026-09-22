// LOT 13 (TODO-027, TODO_TECHNIQUE.md) — complément du 23/09/2026, retour direct de Charles-Henri
// le jour même de la livraison initiale : "je dois pouvoir [mettre un post-it épinglé] n'importe
// où dans l'écran même en dehors du bureau [...] il [ne doit pas passer] au dessous de toutes les
// autres modales". Couvre spécifiquement js/components/pinnedNotesOverlay.js (widget flottant
// "toujours visible", monté une seule fois pour toute la session comme le mini-minuteur Pomodoro)
// — complète tests/e2e/lot13-bureau-notes.spec.js (plan de travail "Tout voir") et
// tests/e2e/lot13-bureau-conversion.spec.js (conversions), qui ne couvrent pas le widget flottant
// lui-même.
//
// Compte de test PARTAGÉ (voir tests/README.md — "un seul jeu de comptes de test partagé") : même
// précaution que le reste de ce dossier — chaque post-it créé ici porte un titre unique
// (`Date.now()`) et est désépinglé PUIS supprimé définitivement (depuis "🔍 Tout voir", le widget
// flottant n'ayant pas de suppression directe) en fin de test.
//
// AVERTISSEMENT (23/09/2026) : écrit et relu manuellement à partir du code réel, mais jamais
// exécuté dans l'environnement où il a été rédigé (registre npm bloqué, voir tests/README.md). À
// reconfirmer au premier lancement réel — en particulier le test de superposition au-dessus d'une
// autre modale (reproduit avec `page.click()`, dont l'échec en cas de recouvrement est justement
// le comportement recherché ici, voir le commentaire du test concerné).

import { test, expect } from "@playwright/test";
import { E2E_TEST_USER } from "./global-setup.js";
import { dismissFirstRunModals } from "../support/firstRun.js";

async function loginAndGoToDashboard(page) {
  await page.addInitScript(() => {
    window.__PILOTAGE_USE_FIREBASE_EMULATOR__ = true;
  });
  await page.goto("/index.html#/dashboard");
  await page.fill("#login-email", E2E_TEST_USER.email);
  await page.fill("#login-password", E2E_TEST_USER.password);
  await page.click("#login-email-submit");
  await dismissFirstRunModals(page);
  await expect(page.locator("#bureau-new-note-btn")).toBeVisible({ timeout: 10_000 });
}

/** Crée un post-it (épinglé par défaut) et renvoie son widget flottant, identifié par `data-id`
 *  diffé sur `.pinned-float-note` — robuste face aux post-it déjà présents dans le compte de test
 *  partagé (même principe que createNoteAndLocate dans les autres fichiers de ce lot). */
async function createPinnedNote(page) {
  const idsBefore = await page.locator(".pinned-float-note").evaluateAll((els) => els.map((e) => e.dataset.id));
  await page.click("#bureau-new-note-btn");
  await expect(page.locator(".pinned-float-note")).toHaveCount(idsBefore.length + 1, { timeout: 10_000 });
  const idsAfter = await page.locator(".pinned-float-note").evaluateAll((els) => els.map((e) => e.dataset.id));
  const newId = idsAfter.find((id) => !idsBefore.includes(id));
  expect(newId).toBeTruthy();
  return { id: newId, el: page.locator(`.pinned-float-note[data-id="${newId}"]`) };
}

/** Nettoyage définitif — le widget flottant n'expose qu'un désépinglage direct (jamais de
 *  suppression), voir le commentaire "Désépingler" (AskUserQuestion, 23/09/2026) dans
 *  js/components/pinnedNotesOverlay.js : la suppression se fait depuis "🔍 Tout voir", comme pour
 *  n'importe quel autre post-it non épinglé. */
async function deleteViaFullCanvas(page, noteId) {
  await page.click("#bureau-see-all-btn");
  const noteEl = page.locator(`.sticky-note[data-id="${noteId}"]`);
  await expect(noteEl).toBeVisible({ timeout: 10_000 });
  await noteEl.locator(".sticky-note-menu-btn").click();
  await page.getByRole("button", { name: "🗑️ Supprimer" }).click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page.getByText("Post-it supprimé")).toBeVisible({ timeout: 5_000 });
}

test.describe.serial("LOT 13 — post-it flottants (widget \"toujours visible\")", () => {
  test("Un nouveau post-it épinglé apparaît immédiatement comme widget flottant ; un clic (sans glisser) ouvre l'édition rapide", async ({ page }) => {
    const uniqueTitle = `Test LOT 13 — flottant ${Date.now()}`;
    await loginAndGoToDashboard(page);
    const note = await createPinnedNote(page);

    // Un simple clic (sans mouvement) sur la carte ouvre l'édition rapide — voir CLICK_THRESHOLD
    // dans js/components/pinnedNotesOverlay.js#attachFloatDrag, jamais le glisser pour ce même
    // geste.
    await note.el.click();
    await expect(page.getByRole("heading", { name: "📝 Post-it" })).toBeVisible({ timeout: 5_000 });
    await page.locator("#note-editor-title").fill(uniqueTitle);
    await page.locator("#note-editor-title").press("Tab"); // déclenche le blur → sauvegarde immédiate
    await page.getByRole("button", { name: "Fermer" }).click();

    // La carte flottante réapparaît (masquée seulement le temps de l'édition — voir
    // suspend()/resume() dans pinnedNotesOverlay.js) avec le nouveau titre.
    await expect(note.el).toBeVisible({ timeout: 5_000 });
    await expect(note.el.locator(".pinned-float-note-title")).toHaveText(uniqueTitle);

    await note.el.locator(".pinned-float-unpin-btn").click();
    await expect(note.el).toHaveCount(0, { timeout: 5_000 });
    await deleteViaFullCanvas(page, note.id);
  });

  test("Reste visible au-dessus d'une autre modale ouverte ailleurs ; le bouton dédié désépingle sans passer par le menu ⋯", async ({ page }) => {
    await loginAndGoToDashboard(page);
    const note = await createPinnedNote(page);

    // Ouvre une AUTRE modale ("🗄️ Post-it archivés") — c'est exactement le problème signalé par
    // Charles-Henri le 23/09/2026 : avant ce complément, un post-it épinglé restait confiné dans
    // la section "Mon bureau" et passait DESSOUS toute modale ouverte par-dessus (z-index).
    await page.click("#bureau-archived-btn");
    await expect(page.locator(".modal-overlay")).toBeVisible({ timeout: 5_000 });

    // Le widget flottant doit rester au-dessus (z-index 55 > 50 de .modal-overlay, voir
    // styles/components.css) — un clic Playwright échouerait ici (élément jugé non actionnable,
    // recouvert par un autre) si le fond de la modale passait par-dessus : réussir CE clic PENDANT
    // que la modale reste ouverte est la preuve du bon ordre d'empilement, pas seulement une
    // vérification de présence dans le DOM.
    await note.el.locator(".pinned-float-unpin-btn").click();
    await expect(note.el).toHaveCount(0, { timeout: 5_000 });

    await page.getByRole("button", { name: "Fermer" }).click();
    await deleteViaFullCanvas(page, note.id);
  });

  test("Glisser le widget flottant : position mise à jour en direct, persistée après rechargement", async ({ page }) => {
    await loginAndGoToDashboard(page);
    const note = await createPinnedNote(page);

    // Glisser à partir du titre (au centre de l'en-tête, hors des boutons épingler/⋯ aux deux
    // extrémités — voir attachFloatDrag : ignoré si le geste démarre sur `button`).
    const box = await note.el.boundingBox();
    const startX = box.x + box.width / 2;
    const startY = box.y + 10;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 120, startY + 90, { steps: 8 });
    await page.mouse.up();

    const styleAfterDrag = await note.el.evaluate((el) => ({ left: el.style.left, top: el.style.top }));
    expect(parseInt(styleAfterDrag.left, 10)).toBeGreaterThan(0);
    expect(parseInt(styleAfterDrag.top, 10)).toBeGreaterThan(0);

    // Même précaution que le reste du lot (voir tests/e2e/lot13-bureau-notes.spec.js) : l'écriture
    // (`setFloatPosition`, déclenchée au relâchement) n'est pas attendue avant de continuer.
    await page.waitForTimeout(500);
    await page.reload();
    await expect(page.locator("#bureau-new-note-btn")).toBeVisible({ timeout: 10_000 });
    const reloadedNote = page.locator(`.pinned-float-note[data-id="${note.id}"]`);
    await expect(reloadedNote).toBeVisible({ timeout: 10_000 });
    const styleAfterReload = await reloadedNote.evaluate((el) => ({ left: el.style.left, top: el.style.top }));
    expect(parseInt(styleAfterReload.left, 10)).toBe(parseInt(styleAfterDrag.left, 10));
    expect(parseInt(styleAfterReload.top, 10)).toBe(parseInt(styleAfterDrag.top, 10));

    await reloadedNote.locator(".pinned-float-unpin-btn").click();
    await deleteViaFullCanvas(page, note.id);
  });
});
