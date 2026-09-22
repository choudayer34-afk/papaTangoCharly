// LOT 13 (TODO-027, TODO_TECHNIQUE.md) — "🧠 Mon bureau" : parcours UI du composant
// js/components/bureau.js (création, texte/checklist, couleur, épingler, archiver/restaurer/
// supprimer, glisser-déposer, redimensionnement). Complète tests/unit/lot13-sticky-notes-model.spec.js
// (vérification directe des données) et tests/e2e/lot13-bureau-conversion.spec.js (les 5 chemins
// de conversion), sur le même principe que le reste de ce dossier (émulateur Firebase, jamais la
// production).
//
// Compte de test PARTAGÉ (E2E_TEST_USER, voir tests/README.md — "un seul jeu de comptes de test
// partagé") : la section "Mon bureau" peut déjà contenir des post-it laissés par d'autres
// exécutions (aucune purge automatique de l'émulateur entre deux lancements). Chaque test isole
// le post-it qu'il vient de créer par son `data-id` (jamais par sa position dans le canevas ni
// par un contenu par défaut, qui pourrait entrer en collision avec un post-it déjà présent) et
// supprime ce qu'il a créé à la fin, pour ne pas faire grossir indéfiniment le Bureau du compte
// de test au fil des exécutions.
//
// Glisser-déposer/redimensionnement : simulés via `page.mouse` (Pointer Events réels envoyés par
// Chromium pour un pointeur de type souris, voir le commentaire en tête de js/components/bureau.js)
// plutôt qu'en appelant directement `stickyNotesApi.setLayout` — c'est justement le seul moyen de
// vérifier le geste lui-même (attachDrag/attachResize), déjà couvert côté données par
// tests/unit/lot13-sticky-notes-model.spec.js#setLayout.
//
// AVERTISSEMENT (22/09/2026, complété le 23/09/2026) : écrit et relu manuellement à partir du
// code réel, mais jamais exécuté dans l'environnement où il a été rédigé (registre npm bloqué,
// voir tests/README.md). À reconfirmer au premier lancement réel — en particulier la simulation
// de glisser/redimensionner via `page.mouse`, jamais utilisée ailleurs dans ce dossier avant ce
// lot.
//
// MISE À JOUR du 23/09/2026 (complément du même jour, retour direct de Charles-Henri : "je dois
// pouvoir [épingler] n'importe où dans l'écran [...] au-dessus des autres modales") : un nouveau
// post-it est désormais créé ÉPINGLÉ par défaut et n'apparaît donc plus directement dans l'Accueil
// comme avant — il apparaît immédiatement comme widget flottant (`.pinned-float-note`, voir
// tests/e2e/lot13-pinned-float-notes.spec.js pour la couverture dédiée à ce widget) et son
// contenu ne se manipule (texte/checklist/glisser/redimensionner, `.sticky-note`) que dans le
// plan de travail complet ouvert via "🔍 Tout voir" (`#bureau-full-canvas`) — plus jamais
// directement sur l'Accueil (`#bureau-canvas` n'existe plus en dehors de cette modale). Chaque
// test ci-dessous crée donc son post-it, récupère son `data-id` via le widget flottant (seul
// endroit où il apparaît avant l'ouverture de la modale), PUIS ouvre "🔍 Tout voir" pour le reste
// de l'interaction.

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

/** Ouvre le plan de travail complet et attend qu'il soit prêt — remplace les anciennes attentes
 *  sur `#bureau-canvas` (retiré de l'Accueil, voir la note du 23/09/2026 en tête de ce fichier). */
async function openFullCanvas(page) {
  await page.click("#bureau-see-all-btn");
  await expect(page.locator("#bureau-full-canvas")).toBeVisible({ timeout: 10_000 });
}

/** Crée un nouveau post-it via l'UI et renvoie son locator (dans le plan de travail complet,
 *  ouvert par cette fonction), identifié par `data-id` diffé sur les widgets FLOTTANTS (créé
 *  épinglé par défaut, voir la note du 23/09/2026 en tête de ce fichier) — robuste face aux
 *  post-it déjà présents dans le Bureau du compte de test partagé. */
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
  return el;
}

/** Supprime définitivement un post-it encore visible sur le canevas (menu "⋯" → "Supprimer" →
 *  confirmation) — nettoyage de fin de test, voir le commentaire en tête de ce fichier. */
async function deleteNote(page, noteEl) {
  await noteEl.locator(".sticky-note-menu-btn").click();
  await page.getByRole("button", { name: "🗑️ Supprimer" }).click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page.getByText("Post-it supprimé")).toBeVisible({ timeout: 5_000 });
}

test.describe.serial("LOT 13 — Mon bureau (post-it libres de l'Accueil)", () => {
  test("Création, texte libre : contenu et titre sauvegardés automatiquement, survivent à un rechargement", async ({ page }) => {
    const uniqueTitle = `Test LOT 13 — titre ${Date.now()}`;
    const uniqueContent = `Contenu libre du test LOT 13 — ${Date.now()}`;
    await loginAndGoToDashboard(page);

    const noteEl = await createNoteAndLocate(page);
    const noteId = await noteEl.getAttribute("data-id");

    await noteEl.locator(".sticky-note-title-input").fill(uniqueTitle);
    await noteEl.locator(".sticky-note-title-input").press("Tab"); // déclenche le blur → sauvegarde immédiate
    await noteEl.locator(".sticky-note-textarea").fill(uniqueContent);
    await noteEl.locator(".sticky-note-textarea").press("Tab");

    // CORRECTIF (premier passage réel du 22/09/2026, GitHub Actions — `content` retrouvé vide
    // après rechargement) : la sauvegarde déclenchée par le blur (`stickyNotesApi.setContent`)
    // est un aller-retour réseau non attendu par l'écouteur — un `page.reload()` immédiatement
    // après le `press("Tab")` pouvait couper la page avant que l'écriture n'ait atteint
    // l'émulateur. `page.waitForLoadState("networkidle")` n'est PAS la bonne solution ici : les
    // écoutes `onSnapshot` (js/services/storage.js#subscribe) maintiennent une connexion réseau
    // permanente au flux Firestore, donc "networkidle" ne se stabilise jamais tant qu'une section
    // de l'Accueil est montée. Une courte attente fixe est le compromis le plus simple et le plus
    // robuste, largement supérieure au temps d'aller-retour réel vers l'émulateur local.
    await page.waitForTimeout(500);

    // Rechargement complet : le Bureau se remonte depuis Firestore (mountBureau + subscribe),
    // pas depuis un état mémoire — seule façon de prouver une vraie sauvegarde automatique. La
    // modale "Tout voir" se referme au rechargement (jamais restaurée automatiquement) — il faut
    // la rouvrir pour retrouver le contenu du post-it.
    await page.reload();
    await expect(page.locator("#bureau-new-note-btn")).toBeVisible({ timeout: 10_000 });
    await openFullCanvas(page);
    const reloadedNote = page.locator(`.sticky-note[data-id="${noteId}"]`);
    await expect(reloadedNote.locator(".sticky-note-title-input")).toHaveValue(uniqueTitle, { timeout: 10_000 });
    await expect(reloadedNote.locator(".sticky-note-textarea")).toHaveValue(uniqueContent);

    await deleteNote(page, reloadedNote);
  });

  test("Bascule texte ↔ checklist : la checklist se construit, se coche, et le texte libre n'est jamais perdu", async ({ page }) => {
    const uniqueContent = `Texte gardé pendant le passage en checklist — ${Date.now()}`;
    const itemText = `Ligne de checklist du test LOT 13 — ${Date.now()}`;
    await loginAndGoToDashboard(page);

    const noteEl = await createNoteAndLocate(page);
    const noteId = await noteEl.getAttribute("data-id");
    await noteEl.locator(".sticky-note-textarea").fill(uniqueContent);
    await noteEl.locator(".sticky-note-textarea").press("Tab");

    await noteEl.locator('.sticky-note-mode-btn[data-mode="checklist"]').click();
    await expect(noteEl.locator('.sticky-note-mode-btn[data-mode="checklist"]')).toHaveClass(/active/);
    await expect(noteEl.locator(".sticky-note-textarea")).toHaveCount(0); // le mode checklist remplace l'affichage du texte

    // CI du 24/09/2026 (premier passage réel du workflow GitHub Actions, sur le code du
    // complément post-it flottants du 23/09/2026, voir TODO_TECHNIQUE.md) :
    // ce test échouait par intermittence ici, avec la trace montrant "element was detached from
    // the DOM, retrying" pendant le fill() suivant, puis l'élément retrouvé mais durablement
    // "hidden" pour Playwright. Cause : le changement de mode ci-dessus déclenche une écriture
    // Firestore, qui émet DEUX snapshots (optimiste local puis confirmé serveur — comportement
    // Firestore standard) ; renderFullCanvas (js/components/bureau.js) reconstruit tout le DOM du
    // "Tout voir" à CHAQUE snapshot, sans diffing. Si la frappe suivante démarre entre ces deux
    // snapshots, l'input est reconstruit en plein milieu de l'action.
    //
    // CORRECTIF (CI du 25/09/2026, ce même test a échoué UNE SECONDE FOIS malgré l'attente
    // ci-dessous — voir aussi lot13-bureau-conversion.spec.js#"Conversion d'UNE SEULE ligne",
    // touché par la même cause) : l'attente fixe réduisait la fenêtre de course sans l'éliminer
    // (toujours possible qu'un aller-retour Firestore réel dépasse 500ms sous charge CI). Cause
    // racine identifiée : le bouton de bascule de mode (js/components/bureau.js) ne faisait QUE
    // lancer l'écriture Firestore (`stickyNotesApi.setType`), sans mettre à jour `note.type` ni
    // réafficher le corps du post-it localement — contrairement à
    // js/components/stickyNoteShared.js#openStickyNoteEditor, qui applique déjà ce même
    // changement de façon optimiste. Le passage en mode "checklist" restait donc ENTIÈREMENT
    // suspendu aux deux snapshots Firestore, sans que le mécanisme de suspension de rendu
    // (`shouldSuspend`/`focusedInside`) ne puisse encore protéger quoi que ce soit, puisque le
    // focus n'était pas encore posé dans le nouveau `#checklist-new-text` tant que ce dernier
    // n'existait pas. Corrigé À LA SOURCE dans js/components/bureau.js (bascule de mode
    // désormais optimiste, réaffichage local immédiat, même principe déjà appliqué à
    // `note.checklist` — voir le commentaire de renderNoteBody) : le focus se pose maintenant
    // dans le nouveau champ avant même la réponse de Firestore, et la suspension de rendu déjà en
    // place protège normalement la frappe qui suit. L'attente ci-dessous est conservée par
    // précaution (marge de sécurité, plus la cause du bug) mais ne devrait plus être nécessaire
    // pour ce cas précis. Non exécuté dans cet environnement (voir tests/README.md) — à
    // reconfirmer au premier lancement réel.
    await page.waitForTimeout(500);

    // Ajout d'une ligne via le composant checklist générique (js/components/checklist.js) —
    // même champ que Tâche/Suivi (`#checklist-new-text`/`#checklist-add-btn` : des ids RÉPÉTÉS
    // une fois par post-it Checklist affiché, chaque instance du composant les pose dans son
    // propre conteneur — `noteEl.locator(...)` reste sans ambiguïté car scopé au sous-arbre de
    // CE post-it, contrairement à un `page.locator("#checklist-new-text")` global qui violerait
    // le mode strict de Playwright dès qu'un second post-it Checklist existe sur la page).
    await noteEl.locator("#checklist-new-text").fill(itemText);
    await noteEl.locator("#checklist-new-text").press("Enter");
    await expect(noteEl.getByText(itemText)).toBeVisible({ timeout: 5_000 });

    // Coche la ligne — la checklist reste affichée immédiatement (pas d'attente d'un aller-retour
    // Firestore), voir le commentaire de renderNoteBody dans js/components/bureau.js.
    const checkbox = noteEl.locator(".checklist-item", { hasText: itemText }).locator('input[type="checkbox"]');
    await checkbox.check();
    await expect(checkbox).toBeChecked();

    // Retour en texte libre : le contenu tapé avant la bascule doit être toujours là.
    await noteEl.locator('.sticky-note-mode-btn[data-mode="text"]').click();
    await expect(noteEl.locator(".sticky-note-textarea")).toHaveValue(uniqueContent, { timeout: 5_000 });

    await deleteNote(page, page.locator(`.sticky-note[data-id="${noteId}"]`));
  });

  test("Menu ⋯ : couleur, désépingler/réépingler, archiver/restaurer, puis suppression définitive depuis les archives", async ({ page }) => {
    const uniqueTitle = `Test LOT 13 — menu ${Date.now()}`;
    await loginAndGoToDashboard(page);
    const noteEl = await createNoteAndLocate(page);
    const noteId = await noteEl.getAttribute("data-id");
    // Titre unique posé tout de suite : la fiche "🗄️ Post-it archivés" (openArchivedNotesModal)
    // n'affiche ni data-id ni aucun autre identifiant technique sur sa ligne, seulement
    // `item.title || "Post-it sans titre"` — sans titre distinctif, ce post-it serait
    // indiscernable d'un autre post-it déjà archivé sans titre par une exécution précédente
    // (compte de test partagé, voir le commentaire en tête de ce fichier).
    await noteEl.locator(".sticky-note-title-input").fill(uniqueTitle);
    await noteEl.locator(".sticky-note-title-input").press("Tab");

    // Créé épinglé par défaut (retour direct de Charles-Henri, 23/09/2026 : "je dois toujours
    // pouvoir créer un post-it à la volée qui sera épinglé par défaut") — l'icône 📌 est donc déjà
    // visible dans l'en-tête, sans action supplémentaire.
    await expect(page.locator(`.sticky-note[data-id="${noteId}"] .sticky-note-pin`)).toBeVisible({ timeout: 5_000 });

    // Couleur — la classe CSS fixe (jamais réactive au thème, voir styles/components.css) change.
    await noteEl.locator(".sticky-note-menu-btn").click();
    await page.locator('#note-menu-colors [data-color="blue"]').click();
    await expect(page.locator(`.sticky-note[data-id="${noteId}"]`)).toHaveClass(/sticky-note--blue/, { timeout: 5_000 });

    // Désépingler puis réépingler — le libellé du bouton s'inverse selon l'état courant, l'icône
    // 📌 disparaît/réapparaît dans l'en-tête en conséquence.
    await page.locator(`.sticky-note[data-id="${noteId}"]`).locator(".sticky-note-menu-btn").click();
    await page.getByRole("button", { name: "📌 Désépingler" }).click();
    await expect(page.locator(`.sticky-note[data-id="${noteId}"] .sticky-note-pin`)).toHaveCount(0, { timeout: 5_000 });
    await page.locator(`.sticky-note[data-id="${noteId}"]`).locator(".sticky-note-menu-btn").click();
    await page.getByRole("button", { name: "📌 Épingler" }).click();
    await expect(page.locator(`.sticky-note[data-id="${noteId}"] .sticky-note-pin`)).toBeVisible({ timeout: 5_000 });

    // Archiver — disparaît du canevas, réapparaît dans "🗄️ Archivés (N)".
    await page.locator(`.sticky-note[data-id="${noteId}"]`).locator(".sticky-note-menu-btn").click();
    await page.getByRole("button", { name: "🗄️ Archiver" }).click();
    await expect(page.getByText("Post-it archivé")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator(`.sticky-note[data-id="${noteId}"]`)).toHaveCount(0);

    await page.click("#bureau-archived-btn");
    const archivedRow = page.locator(".item-row", { hasText: uniqueTitle });
    await expect(archivedRow).toBeVisible({ timeout: 5_000 });

    // Restaurer — réapparaît sur le canevas, épinglé toujours actif (l'archivage ne le retire pas).
    await archivedRow.locator(".btn", { hasText: "↩️ Restaurer" }).click();
    await expect(page.getByText("Post-it restauré")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator(`.sticky-note[data-id="${noteId}"]`)).toBeVisible({ timeout: 5_000 });
    await expect(page.locator(`.sticky-note[data-id="${noteId}"] .sticky-note-pin`)).toBeVisible();

    await deleteNote(page, page.locator(`.sticky-note[data-id="${noteId}"]`));
  });

  test("Glisser-déposer et redimensionnement (souris) : position/taille visibles en direct puis persistées après rechargement", async ({ page }) => {
    await loginAndGoToDashboard(page);
    const noteEl = await createNoteAndLocate(page);
    const noteId = await noteEl.getAttribute("data-id");

    // --- Glisser, à partir de l'en-tête, en évitant le titre/le bouton menu (voir attachDrag :
    // ignoré si le geste démarre sur `input, button`) — un point proche du bord gauche de l'en-tête.
    const headerBox = await noteEl.locator(".sticky-note-header").boundingBox();
    const startX = headerBox.x + 3;
    const startY = headerBox.y + headerBox.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 80, startY + 60, { steps: 8 });
    await page.mouse.up();

    const styleAfterDrag = await noteEl.evaluate((el) => ({ left: el.style.left, top: el.style.top }));
    expect(parseInt(styleAfterDrag.left, 10)).toBeGreaterThan(0);
    expect(parseInt(styleAfterDrag.top, 10)).toBeGreaterThan(0);

    // --- Redimensionner, à partir de la poignée bas-droite.
    const handleBox = await noteEl.locator(".sticky-note-resize-handle").boundingBox();
    const handleX = handleBox.x + handleBox.width / 2;
    const handleY = handleBox.y + handleBox.height / 2;
    await page.mouse.move(handleX, handleY);
    await page.mouse.down();
    await page.mouse.move(handleX + 60, handleY + 50, { steps: 8 });
    await page.mouse.up();

    const styleAfterResize = await noteEl.evaluate((el) => ({ width: el.style.width, height: el.style.height }));
    const widthAfterResize = parseInt(styleAfterResize.width, 10);
    const heightAfterResize = parseInt(styleAfterResize.height, 10);
    expect(widthAfterResize).toBeGreaterThanOrEqual(160); // MIN_WIDTH, voir js/domain/stickyNotes.js
    expect(heightAfterResize).toBeGreaterThanOrEqual(120); // MIN_HEIGHT

    // Même précaution que pour le test de sauvegarde texte plus haut : l'écriture déclenchée au
    // relâchement du pointeur (attachDrag/attachResize) n'est pas attendue avant de continuer.
    await page.waitForTimeout(500);

    // Persistance : la position/taille visibles à l'écran juste avant rechargement doivent être
    // celles retrouvées après (écrite au relâchement du pointeur, voir attachDrag/attachResize).
    // La modale "Tout voir" se referme au rechargement — il faut la rouvrir (voir le commentaire
    // du 23/09/2026 en tête de ce fichier).
    await page.reload();
    await expect(page.locator("#bureau-new-note-btn")).toBeVisible({ timeout: 10_000 });
    await openFullCanvas(page);
    const reloadedNote = page.locator(`.sticky-note[data-id="${noteId}"]`);
    await expect(reloadedNote).toBeVisible({ timeout: 10_000 });
    const styleAfterReload = await reloadedNote.evaluate((el) => ({ left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height }));
    expect(parseInt(styleAfterReload.left, 10)).toBe(parseInt(styleAfterDrag.left, 10));
    expect(parseInt(styleAfterReload.top, 10)).toBe(parseInt(styleAfterDrag.top, 10));
    expect(parseInt(styleAfterReload.width, 10)).toBe(widthAfterResize);
    expect(parseInt(styleAfterReload.height, 10)).toBe(heightAfterResize);

    await deleteNote(page, reloadedNote);
  });
});
