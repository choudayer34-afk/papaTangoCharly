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
//
// Complément du 28/09/2026 (même avertissement, jamais exécuté) — retour direct de Charles-Henri :
// "pouvoir agrandir ou réduire un post-it en dimension qui serait épinglé [...] quand je rentre
// dans le post-it, pouvoir agrandir le champ de description pour voir l'intégralité du contenu
// [...] sur un post-it épinglé, je dois pouvoir cocher les éléments ou en ajouter en mode
// checklist et si je suis en mode texte, je dois pouvoir ajouter ou modifier le texte directement."
// Deux nouveaux tests couvrent respectivement la poignée de redimensionnement
// (js/components/pinnedNotesOverlay.js#attachFloatResize) et l'édition rapide en modale large
// (js/components/stickyNoteShared.js#openStickyNoteEditor) — cette dernière confirme surtout
// l'ABSENCE de régression : cocher/ajouter une ligne de checklist et taper/modifier du texte
// libre fonctionnaient déjà directement dans cette modale (renderNoteBody, partagé avec le plan
// de travail) avant ce complément, seule sa largeur et la hauteur du champ de texte changent ici.

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

  test("Redimensionner le widget flottant (poignée bas-droite) : taille mise à jour en direct, ne déplace jamais la carte, persistée après rechargement", async ({ page }) => {
    await loginAndGoToDashboard(page);
    const note = await createPinnedNote(page);

    const boxBefore = await note.el.boundingBox();
    const handleBox = await note.el.locator(".sticky-note-resize-handle").boundingBox();
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + 150, handleBox.y + 100, { steps: 8 });
    await page.mouse.up();

    const styleAfterResize = await note.el.evaluate((el) => ({ width: el.style.width, height: el.style.height }));
    expect(parseInt(styleAfterResize.width, 10)).toBeGreaterThan(Math.round(boxBefore.width));
    expect(parseInt(styleAfterResize.height, 10)).toBeGreaterThan(Math.round(boxBefore.height));

    // Le redimensionnement ne doit JAMAIS déplacer la carte (voir e.stopPropagation() dans
    // attachFloatResize, qui empêche le pointerdown de la poignée de remonter jusqu'à celui,
    // posé sur toute la carte, d'attachFloatDrag).
    const boxAfter = await note.el.boundingBox();
    expect(Math.round(boxAfter.x)).toBe(Math.round(boxBefore.x));
    expect(Math.round(boxAfter.y)).toBe(Math.round(boxBefore.y));

    // Même précaution que le test de glisser ci-dessus : l'écriture (`setFloatSize`, déclenchée
    // au relâchement) n'est pas attendue avant de continuer.
    await page.waitForTimeout(500);
    await page.reload();
    await expect(page.locator("#bureau-new-note-btn")).toBeVisible({ timeout: 10_000 });
    const reloadedNote = page.locator(`.pinned-float-note[data-id="${note.id}"]`);
    await expect(reloadedNote).toBeVisible({ timeout: 10_000 });
    const styleAfterReload = await reloadedNote.evaluate((el) => ({ width: el.style.width, height: el.style.height }));
    expect(parseInt(styleAfterReload.width, 10)).toBe(parseInt(styleAfterResize.width, 10));
    expect(parseInt(styleAfterReload.height, 10)).toBe(parseInt(styleAfterResize.height, 10));

    await reloadedNote.locator(".pinned-float-unpin-btn").click();
    await deleteViaFullCanvas(page, note.id);
  });

  test("Édition rapide en modale large : champ de description manuellement agrandissable, checklist cochée/complétée et texte libre modifié directement", async ({ page }) => {
    await loginAndGoToDashboard(page);
    const note = await createPinnedNote(page);

    await note.el.click();
    await expect(page.getByRole("heading", { name: "📝 Post-it" })).toBeVisible({ timeout: 5_000 });

    // Modale large (complément du 28/09/2026, retour de Charles-Henri : "agrandir le champ de
    // description pour voir l'intégralité du contenu") — voir `.modal--wide`
    // (styles/components.css) et `wide: true` sur openStickyNoteEditor
    // (js/components/stickyNoteShared.js).
    await expect(page.locator(".modal.modal--wide")).toBeVisible();

    // Texte libre : modification directe (déjà le comportement de renderNoteBody, partagé avec le
    // plan de travail) — ce test vérifie surtout l'absence de régression, plus le champ devenu
    // manuellement redimensionnable (`.modal-body .sticky-note-textarea`, styles/components.css).
    const textarea = page.locator(".modal-body .sticky-note-textarea");
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveCSS("resize", "vertical");
    await textarea.fill("Contenu tapé directement depuis le widget flottant");
    await textarea.blur();

    // Bascule en checklist puis ajout ET coche DIRECTEMENT, toujours dans cette même modale, sans
    // ouvrir aucun autre écran.
    await page.locator(".sticky-note-mode-btn[data-mode='checklist']").click();
    await page.locator("#checklist-new-text").fill("Première ligne ajoutée depuis le widget flottant");
    await page.locator("#checklist-new-text").press("Enter");
    const firstItem = page.locator(".checklist-item").first();
    await expect(firstItem).toBeVisible({ timeout: 5_000 });
    await firstItem.locator("input[type='checkbox']").check();
    await expect(firstItem.locator("input[type='checkbox']")).toBeChecked();

    await page.getByRole("button", { name: "Fermer" }).click();
    await note.el.locator(".pinned-float-unpin-btn").click();
    await deleteViaFullCanvas(page, note.id);
  });
});
