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
// Un nouveau test couvre la poignée de redimensionnement
// (js/components/pinnedNotesOverlay.js#attachFloatResize).
//
// RETOUR SUR CE MÊME COMPLÉMENT, plus tard le 28/09/2026 — Charles-Henri a confirmé vouloir la
// lecture alternative proposée puis d'abord écartée (voir
// claude/postits-epingles-redimensionnement-28-09-2026.md §2) : le contenu (titre, type,
// checklist/texte) s'édite désormais DIRECTEMENT sur la carte flottante, à la manière du plan de
// travail "Tout voir" — la modale d'édition rapide (`openStickyNoteEditor`) a été RETIRÉE, elle
// n'avait plus aucun autre appelant. Les deux premiers tests de ce fichier (titre édité en place
// dans l'en-tête, glisser restreint à l'en-tête) et le dernier (checklist/texte édités en place
// dans le corps) reflètent ce changement — plus aucun test de ce fichier n'ouvre de modale
// d'édition pour le CONTENU d'un post-it flottant (le menu "⋯", couleur/épingle/archive/
// suppression/transformation, reste lui une modale, inchangé).

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
  test("Un nouveau post-it épinglé apparaît immédiatement comme widget flottant ; son titre s'édite directement dans l'en-tête, sans ouvrir de modale", async ({ page }) => {
    const uniqueTitle = `Test LOT 13 — flottant ${Date.now()}`;
    await loginAndGoToDashboard(page);
    const note = await createPinnedNote(page);

    // Titre édité EN PLACE (complément du 28/09/2026, voir le commentaire en tête de fichier) —
    // même sauvegarde anti-rebond + immédiate au blur que js/components/bureau.js#buildNoteEl.
    // Aucune modale ne doit s'ouvrir pour ça.
    const titleInput = note.el.locator(".sticky-note-title-input");
    await titleInput.fill(uniqueTitle);
    await titleInput.blur();
    await expect(page.locator(".modal-overlay")).toHaveCount(0);

    // Persisté après rechargement — preuve que la sauvegarde a bien eu lieu, pas seulement un
    // état local optimiste.
    await page.reload();
    await expect(page.locator("#bureau-new-note-btn")).toBeVisible({ timeout: 10_000 });
    const reloadedNote = page.locator(`.pinned-float-note[data-id="${note.id}"]`);
    await expect(reloadedNote.locator(".sticky-note-title-input")).toHaveValue(uniqueTitle, { timeout: 10_000 });

    await reloadedNote.locator(".pinned-float-unpin-btn").click();
    await expect(reloadedNote).toHaveCount(0, { timeout: 5_000 });
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

    // Glisser à partir de l'en-tête, en évitant le titre (désormais un vrai champ de saisie) et
    // les boutons épingler/⋯ — un point proche du bord gauche de l'en-tête, même technique que
    // tests/e2e/lot13-bureau-notes.spec.js pour le même en-tête sur le plan de travail complet
    // (voir js/components/pinnedNotesOverlay.js#attachFloatDrag, ignoré si le geste démarre sur
    // `input, button`).
    const headerBox = await note.el.locator(".pinned-float-note-header").boundingBox();
    const startX = headerBox.x + 3;
    const startY = headerBox.y + headerBox.height / 2;
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
    // posé sur l'en-tête, d'attachFloatDrag).
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

  test("Édition en place, directement sur la carte flottante, sans jamais ouvrir de modale : texte libre modifié, puis checklist ajoutée et cochée", async ({ page }) => {
    await loginAndGoToDashboard(page);
    const note = await createPinnedNote(page);

    // RETOUR direct de Charles-Henri (28/09/2026, voir le commentaire en tête de fichier) : ni le
    // texte libre ni la checklist ne doivent plus passer par une modale — tout se tape et se coche
    // directement dans le corps de la carte flottante elle-même.
    await expect(page.locator(".modal-overlay")).toHaveCount(0);

    // Texte libre — mode par défaut d'un nouveau post-it (js/domain/stickyNotes.js).
    const textarea = note.el.locator(".sticky-note-textarea");
    await expect(textarea).toBeVisible();
    await textarea.fill("Contenu tapé directement depuis le widget flottant");
    await textarea.blur();
    await expect(page.locator(".modal-overlay")).toHaveCount(0);

    // Bascule en checklist puis ajout ET coche DIRECTEMENT sur la carte, toujours sans la moindre
    // modale — même correctif "réaffichage immédiat" que js/components/bureau.js#buildNoteEl
    // (CI du 25/09/2026) : le nouveau champ #checklist-new-text doit être immédiatement utilisable.
    await note.el.locator(".sticky-note-mode-btn[data-mode='checklist']").click();
    await note.el.locator("#checklist-new-text").fill("Première ligne ajoutée depuis le widget flottant");
    await note.el.locator("#checklist-new-text").press("Enter");
    const firstItem = note.el.locator(".checklist-item").first();
    await expect(firstItem).toBeVisible({ timeout: 5_000 });
    await firstItem.locator("input[type='checkbox']").check();
    await expect(firstItem.locator("input[type='checkbox']")).toBeChecked();
    await expect(page.locator(".modal-overlay")).toHaveCount(0);

    // Persisté après rechargement (type + contenu de la checklist).
    await page.waitForTimeout(500);
    await page.reload();
    await expect(page.locator("#bureau-new-note-btn")).toBeVisible({ timeout: 10_000 });
    const reloadedNote = page.locator(`.pinned-float-note[data-id="${note.id}"]`);
    await expect(reloadedNote.locator(".sticky-note-mode-btn[data-mode='checklist']")).toHaveClass(/active/, { timeout: 10_000 });
    await expect(reloadedNote.locator(".checklist-item").first().locator("input[type='checkbox']")).toBeChecked();

    await reloadedNote.locator(".pinned-float-unpin-btn").click();
    await deleteViaFullCanvas(page, note.id);
  });

  test("Convertir une ligne de checklist depuis la carte flottante masque la carte le temps de la modale de conversion, sans la laisser recouvrir son fond", async ({ page }) => {
    await loginAndGoToDashboard(page);
    const note = await createPinnedNote(page);

    // Complément du 28/09/2026 (édition en place) — la checklist vit désormais directement sur la
    // carte, TOUJOURS au-dessus de tout (z-index 55, voir le commentaire en tête de fichier) : sans
    // le mécanisme dédié (js/components/pinnedNotesOverlay.js#beginOwnModalChain), la carte
    // recouvrirait le fond de la modale de conversion ouverte depuis sa propre ligne de checklist.
    await note.el.locator(".sticky-note-mode-btn[data-mode='checklist']").click();
    await note.el.locator("#checklist-new-text").fill("Ligne à convertir en Tâche");
    await note.el.locator("#checklist-new-text").press("Enter");
    const item = note.el.locator(".checklist-item").first();
    await expect(item).toBeVisible({ timeout: 5_000 });

    await item.locator(".checklist-line-menu-btn").click();
    await expect(page.getByRole("heading", { name: "Créer depuis cette ligne" })).toBeVisible({ timeout: 5_000 });
    // La carte est bien masquée (jamais juste "en dessous" visuellement — `visibility: hidden` la
    // retire entièrement, y compris de l'arbre d'accessibilité).
    await expect(note.el).toBeHidden();

    // Choisir "Tâche" ferme cette modale et en ouvre une seconde (création de tâche) SANS jamais
    // repasser par un état "aucune modale ouverte" observable — la carte doit rester masquée tout
    // du long, pas seulement le temps de la première.
    await page.getByRole("button", { name: /Tâche/ }).click();
    await expect(page.getByRole("heading", { name: "Nouvelle tâche" })).toBeVisible({ timeout: 5_000 });
    await expect(note.el).toBeHidden();

    await page.getByRole("button", { name: "Annuler" }).click();
    await expect(page.locator(".modal-overlay")).toHaveCount(0, { timeout: 5_000 });
    // La carte réapparaît d'elle-même dès qu'aucune modale ne reste ouverte.
    await expect(note.el).toBeVisible({ timeout: 5_000 });

    await note.el.locator(".pinned-float-unpin-btn").click();
    await deleteViaFullCanvas(page, note.id);
  });
});
