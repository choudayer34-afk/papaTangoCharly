// LOT 13 (TODO-027, TODO_TECHNIQUE.md) — "🧠 Mon bureau" : les 5 chemins de "Conversion
// intelligente" (spec transmise par Charles-Henri, §"Conversion intelligente") — Tâche / Suivi /
// Ressource / Décision / Information — pour le post-it ENTIER (menu "⋯" → "🔀 Transformer en")
// ET pour UNE SEULE ligne de checklist (bouton "⋯" par ligne, js/components/checklist.js).
// Complète tests/e2e/lot13-bureau-notes.spec.js (CRUD/glisser/redimensionner) et
// tests/unit/lot13-sticky-notes-model.spec.js (données), sur le même principe que le reste de ce
// dossier (émulateur Firebase, jamais la production).
//
// Vérifie en particulier :
//  - le préremplissage du formulaire cible (titre + contenu, voir
//    js/domain/stickyNotes.js#stickyNoteToText) — dont les DEUX bugs corrigés à l'occasion de ce
//    lot (js/views/resources.js#res-description, js/views/people.js#fu-description, voir
//    TODO_TECHNIQUE.md → LOT 13) ;
//  - l'écart assumé documenté pour "Décision" (le contenu part dans "Contexte", jamais dans "Ce
//    qui a été décidé", voir js/components/bureau.js#convertWholeNote) ;
//  - l'ARCHIVAGE (jamais la suppression) du post-it source après une conversion de post-it
//    ENTIER, retrouvable dans "🗄️ Post-it archivés" (Règle 3 de l'app, "ne jamais perdre une
//    capture") ;
//  - qu'une conversion de LIGNE ne retire QUE cette ligne, jamais tout le post-it ni le reste de
//    la checklist (spec : "le reste de la checklist reste intact").
//
// Compte de test PARTAGÉ (voir tests/e2e/lot13-bureau-notes.spec.js pour le même avertissement) :
// chaque post-it créé ici porte un titre unique (`Date.now()`), et est supprimé définitivement en
// fin de test pour ne pas faire grossir indéfiniment le Bureau/les archives du compte de test.
//
// AVERTISSEMENT (22/09/2026) : écrit et relu manuellement à partir du code réel, mais jamais
// exécuté dans l'environnement où il a été rédigé (registre npm bloqué, voir tests/README.md).
// À reconfirmer au premier lancement réel.
//
// MISE À JOUR du 23/09/2026 (complément du même jour, retour direct de Charles-Henri : "je dois
// pouvoir [épingler] n'importe où dans l'écran [...] au-dessus des autres modales") : un nouveau
// post-it est désormais créé ÉPINGLÉ par défaut et apparaît donc d'abord comme widget flottant
// (`.pinned-float-note`) — son contenu (`.sticky-note`) ne se manipule que dans le plan de travail
// complet ouvert via "🔍 Tout voir" (`#bureau-full-canvas`), plus jamais directement sur l'Accueil
// (`#bureau-canvas` n'existe plus en dehors de cette modale). Même adaptation que
// tests/e2e/lot13-bureau-notes.spec.js — voir son commentaire pour le détail.

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

async function openFullCanvas(page) {
  await page.click("#bureau-see-all-btn");
  await expect(page.locator("#bureau-full-canvas")).toBeVisible({ timeout: 10_000 });
}

async function createNoteAndLocate(page) {
  const idsBefore = await page.locator(".pinned-float-note").evaluateAll((els) => els.map((e) => e.dataset.id));
  await page.click("#bureau-new-note-btn");
  await expect(page.locator(".pinned-float-note")).toHaveCount(idsBefore.length + 1, { timeout: 10_000 });
  const idsAfter = await page.locator(".pinned-float-note").evaluateAll((els) => els.map((e) => e.dataset.id));
  const newId = idsAfter.find((id) => !idsBefore.includes(id));
  expect(newId).toBeTruthy();
  await openFullCanvas(page);
  const el = page.locator(`.sticky-note[data-id="${newId}"]`);
  await expect(el).toBeVisible({ timeout: 10_000 });
  return { id: newId, el };
}

/** Supprime DÉFINITIVEMENT un post-it déjà archivé (nettoyage de fin de test), identifié par son
 *  titre unique — la ligne de "🗄️ Post-it archivés" n'expose aucun `data-id` (voir le même
 *  constat dans lot13-bureau-notes.spec.js). */
async function deleteArchivedNoteByTitle(page, title) {
  await page.click("#bureau-archived-btn");
  const row = page.locator(".item-row", { hasText: title });
  await expect(row).toBeVisible({ timeout: 5_000 });
  await row.locator("button[aria-label='Supprimer définitivement']").click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page.getByText("Post-it supprimé")).toBeVisible({ timeout: 5_000 });
}

/** Supprime DÉFINITIVEMENT un post-it encore visible sur le canevas (menu "⋯" → "Supprimer"). */
async function deleteLiveNote(page, noteId) {
  await page.locator(`.sticky-note[data-id="${noteId}"]`).locator(".sticky-note-menu-btn").click();
  await page.getByRole("button", { name: "🗑️ Supprimer" }).click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page.getByText("Post-it supprimé")).toBeVisible({ timeout: 5_000 });
}

async function openWholeNoteConvertMenu(page, noteId, targetLabel) {
  await page.locator(`.sticky-note[data-id="${noteId}"]`).locator(".sticky-note-menu-btn").click();
  await page.locator("#note-menu-convert").getByRole("button", { name: targetLabel }).click();
}

test.describe.serial("LOT 13 — Mon bureau : conversion intelligente (post-it entier)", () => {
  test("Post-it ENTIER → Tâche : titre + description préremplis, post-it archivé après création", async ({ page }) => {
    const title = `Test LOT 13 — conversion tâche ${Date.now()}`;
    const content = `Contenu à retrouver en description — ${Date.now()}`;
    await loginAndGoToDashboard(page);

    const note = await createNoteAndLocate(page);
    await note.el.locator(".sticky-note-title-input").fill(title);
    await note.el.locator(".sticky-note-title-input").press("Tab");
    await note.el.locator(".sticky-note-textarea").fill(content);
    await note.el.locator(".sticky-note-textarea").press("Tab");

    await openWholeNoteConvertMenu(page, note.id, "Tâche");
    await expect(page.locator("#new-task-title")).toHaveValue(title, { timeout: 5_000 });
    await expect(page.locator("#new-task-description")).toHaveValue(content);
    await page.getByRole("button", { name: "Créer", exact: true }).click();
    await expect(page.getByText("Tâche créée")).toBeVisible({ timeout: 10_000 });

    // Archivé (jamais supprimé) — disparu du canevas, retrouvable dans les archives.
    await expect(page.locator(`.sticky-note[data-id="${note.id}"]`)).toHaveCount(0, { timeout: 5_000 });
    await deleteArchivedNoteByTitle(page, title);
  });

  test("Post-it ENTIER → Ressource : titre + description préremplis (bug corrigé à l'occasion de ce lot)", async ({ page }) => {
    const title = `Test LOT 13 — conversion ressource ${Date.now()}`;
    const content = `Description à ne plus perdre (LOT 13) — ${Date.now()}`;
    await loginAndGoToDashboard(page);

    const note = await createNoteAndLocate(page);
    await note.el.locator(".sticky-note-title-input").fill(title);
    await note.el.locator(".sticky-note-title-input").press("Tab");
    await note.el.locator(".sticky-note-textarea").fill(content);
    await note.el.locator(".sticky-note-textarea").press("Tab");

    await openWholeNoteConvertMenu(page, note.id, "Ressource");
    await expect(page.locator("#res-title")).toHaveValue(title, { timeout: 5_000 });
    // BUG corrigé (LOT 13) : avant ce lot, `prefill.description` n'était jamais posé dans ce
    // champ — voir le commentaire dans js/views/resources.js#openCreateResourceModal.
    await expect(page.locator("#res-description")).toHaveValue(content);
    await page.getByRole("button", { name: "Créer", exact: true }).click();
    await expect(page.getByText("Ressource ajoutée")).toBeVisible({ timeout: 10_000 });

    await expect(page.locator(`.sticky-note[data-id="${note.id}"]`)).toHaveCount(0, { timeout: 5_000 });
    await deleteArchivedNoteByTitle(page, title);
  });

  test("Post-it ENTIER → Décision : contenu dans 'Contexte' (jamais 'Ce qui a été décidé', écart assumé documenté)", async ({ page }) => {
    const title = `Test LOT 13 — conversion décision ${Date.now()}`;
    const content = `Contexte de la décision — ${Date.now()}`;
    await loginAndGoToDashboard(page);

    const note = await createNoteAndLocate(page);
    await note.el.locator(".sticky-note-title-input").fill(title);
    await note.el.locator(".sticky-note-title-input").press("Tab");
    await note.el.locator(".sticky-note-textarea").fill(content);
    await note.el.locator(".sticky-note-textarea").press("Tab");

    await openWholeNoteConvertMenu(page, note.id, "Décision");
    await expect(page.locator("#new-decision-title")).toHaveValue(title, { timeout: 5_000 });
    await expect(page.locator("#new-decision-context")).toHaveValue(content);
    // Écart assumé (js/components/bureau.js#convertWholeNote) : une décision ne se déduit jamais
    // automatiquement d'une note, "Ce qui a été décidé" reste vide.
    await expect(page.locator("#new-decision-decision")).toHaveValue("");
    await page.getByRole("button", { name: "Créer", exact: true }).click();

    // "Créer une action ?" (suggestNextStep) s'affiche systématiquement après une décision créée
    // — "Plus tard" (déclin explicite) est le seul chemin qui déclenche onCreated ici, voir
    // js/views/dashboard.js#openCreateDecisionModal.
    await page.getByRole("button", { name: "Plus tard" }).click();
    await expect(page.getByText("Décision enregistrée")).toBeVisible({ timeout: 10_000 });

    await expect(page.locator(`.sticky-note[data-id="${note.id}"]`)).toHaveCount(0, { timeout: 5_000 });
    await deleteArchivedNoteByTitle(page, title);
  });

  test("Post-it ENTIER → Suivi : titre + description préremplis (bug corrigé), post-it archivé une fois la série de suivis terminée", async ({ page }) => {
    const personName = `Test LOT 13 — personne conversion ${Date.now()}`;
    const title = `Test LOT 13 — conversion suivi ${Date.now()}`;
    const content = `Description du suivi à ne plus perdre (LOT 13) — ${Date.now()}`;

    // Au moins une personne doit exister — js/components/bureau.js#convertWholeNote refuse
    // silencieusement (toast) sinon : "Ajoute d'abord une personne dans l'onglet Équipe...".
    await loginAndGoToDashboard(page);
    await page.goto("/index.html#/people");
    await page.click("#new-person-btn");
    await page.fill("#person-name", personName);
    await page.getByRole("button", { name: "Créer" }).click();
    await expect(page.getByText("Personne ajoutée")).toBeVisible({ timeout: 10_000 });
    await page.goto("/index.html#/dashboard");
    await expect(page.locator("#bureau-new-note-btn")).toBeVisible({ timeout: 10_000 });

    const note = await createNoteAndLocate(page);
    await note.el.locator(".sticky-note-title-input").fill(title);
    await note.el.locator(".sticky-note-title-input").press("Tab");
    await note.el.locator(".sticky-note-textarea").fill(content);
    await note.el.locator(".sticky-note-textarea").press("Tab");

    await openWholeNoteConvertMenu(page, note.id, "Suivi");
    await expect(page.locator("#fu-title")).toHaveValue(title, { timeout: 5_000 });
    // BUG corrigé (LOT 13) : avant ce lot, `defaultDescription` n'existait pas comme paramètre —
    // voir le commentaire dans js/views/people.js#openCreateFollowUpModal.
    await expect(page.locator("#fu-description")).toHaveValue(content);
    await page.getByRole("button", { name: "Créer", exact: true }).click();
    await expect(page.getByText("Suivi créé")).toBeVisible({ timeout: 10_000 });

    // `onCreated` (donc l'archivage du post-it source) n'est déclenché qu'à la fin de la série
    // "Encore un suivi ?" — voir le commentaire détaillé dans js/views/people.js#openCreateFollowUpModal.
    await page.getByRole("button", { name: "Terminé" }).click();

    await expect(page.locator(`.sticky-note[data-id="${note.id}"]`)).toHaveCount(0, { timeout: 5_000 });
    await deleteArchivedNoteByTitle(page, title);
  });

  test("Post-it ENTIER → Information : capturé puis qualifié 'kept' directement, fiche détail ouverte", async ({ page }) => {
    const title = `Test LOT 13 — conversion information ${Date.now()}`;
    const content = `Contenu qui devient le rawContent de l'Information — ${Date.now()}`;
    await loginAndGoToDashboard(page);

    const note = await createNoteAndLocate(page);
    await note.el.locator(".sticky-note-title-input").fill(title);
    await note.el.locator(".sticky-note-title-input").press("Tab");
    await note.el.locator(".sticky-note-textarea").fill(content);
    await note.el.locator(".sticky-note-textarea").press("Tab");

    // Aucune modale intermédiaire à remplir (js/components/bureau.js#convertToInformation) : la
    // fiche "Information" s'ouvre directement, avec le contenu du post-it comme `rawContent`.
    await openWholeNoteConvertMenu(page, note.id, "Information");
    await expect(page.locator(".modal-body", { hasText: content })).toBeVisible({ timeout: 10_000 });

    await expect(page.locator(`.sticky-note[data-id="${note.id}"]`)).toHaveCount(0, { timeout: 5_000 });
    await deleteArchivedNoteByTitle(page, title);
  });
});

test.describe("LOT 13 — Mon bureau : conversion intelligente (une seule ligne de checklist)", () => {
  test("Conversion d'UNE SEULE ligne : seule cette ligne disparaît, le reste de la checklist et le post-it restent intacts", async ({ page }) => {
    const noteTitle = `Test LOT 13 — conversion ligne ${Date.now()}`;
    const lineToConvert = `Ligne à convertir — ${Date.now()}`;
    const lineToKeep = `Ligne à garder — ${Date.now()}`;
    await loginAndGoToDashboard(page);

    const note = await createNoteAndLocate(page);
    await note.el.locator(".sticky-note-title-input").fill(noteTitle);
    await note.el.locator(".sticky-note-title-input").press("Tab");
    await note.el.locator('.sticky-note-mode-btn[data-mode="checklist"]').click();
    await expect(note.el.locator('.sticky-note-mode-btn[data-mode="checklist"]')).toHaveClass(/active/);

    await note.el.locator("#checklist-new-text").fill(lineToConvert);
    await note.el.locator("#checklist-new-text").press("Enter");
    await expect(note.el.getByText(lineToConvert)).toBeVisible({ timeout: 5_000 });
    await note.el.locator("#checklist-new-text").fill(lineToKeep);
    await note.el.locator("#checklist-new-text").press("Enter");
    await expect(note.el.getByText(lineToKeep)).toBeVisible({ timeout: 5_000 });

    // Menu "⋯" DE LA LIGNE (pas celui du post-it) — voir js/components/checklist.js#onLineMenu.
    const rowToConvert = note.el.locator(".checklist-item", { hasText: lineToConvert });
    await rowToConvert.getByRole("button", { name: "Créer une fiche à partir de cette ligne" }).click();

    await expect(page.getByRole("heading", { name: "Créer depuis cette ligne" })).toBeVisible({ timeout: 5_000 });
    // Conversion de ligne → Tâche : seul le TITRE est préreempli (js/components/bureau.js#convertLine),
    // pas de description pour une simple ligne de checklist.
    await page.getByRole("button", { name: "Tâche" }).click();
    await expect(page.locator("#new-task-title")).toHaveValue(lineToConvert, { timeout: 5_000 });
    await expect(page.locator("#new-task-description")).toHaveValue("");
    await page.getByRole("button", { name: "Créer", exact: true }).click();
    await expect(page.getByText("Tâche créée")).toBeVisible({ timeout: 10_000 });

    // Le post-it reste sur le canevas (JAMAIS archivé par une conversion de ligne), seule la
    // ligne convertie a disparu — l'autre ligne reste intacte.
    await expect(page.locator(`.sticky-note[data-id="${note.id}"]`)).toBeVisible({ timeout: 5_000 });
    await expect(note.el.getByText(lineToConvert)).toHaveCount(0, { timeout: 5_000 });
    await expect(note.el.getByText(lineToKeep)).toBeVisible();

    await deleteLiveNote(page, note.id);
  });
});
