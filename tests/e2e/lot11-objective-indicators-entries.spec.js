// TODO-024 (LOT 11, TODO_TECHNIQUE.md) — indicateurs structurés et points de suivi enrichis d'un
// Objectif (js/domain/objectives.js#addIndicator/updateIndicator/removeIndicator/addEntry,
// js/views/people.js#openIndicatorModal/openAddObjectiveEntryModal). Arbitrage "Option A" de
// Charles-Henri : un indicateur est une simple donnée structurée PROPRE à l'objectif, jamais une
// fiche indépendante ni un élément "🔗 Lié" — voir le commentaire en tête de js/domain/
// objectives.js. La référence optionnelle "preuve/contexte" d'un suivi (`entries[].ref`) est,
// elle, une donnée en lecture seule pointant vers une fiche existante (js/components/
// linkedItems.js#pickRef/resolveRefDirect), délibérément SANS passer par js/domain/links.js.
//
// Ce fichier couvre les points 3/4/6/7 de la section 12 de son arbitrage : création/modification/
// suppression d'indicateurs, plusieurs indicateurs sur un même objectif, statut synchronisé
// depuis un suivi qui le concerne, conservation des données (un indicateur supprimé ne supprime
// pas les suivis qui le référençaient), contexte affiché lors de l'ajout d'un suivi, et suivi
// pointant vers une fiche existante (preuve/contexte).
//
// AVERTISSEMENT (22/09/2026) : écrit et relu manuellement à partir du code réel (LOT 11 tout
// juste implémenté), mais jamais exécuté dans cet environnement (registre npm bloqué, voir
// tests/README.md). À reconfirmer au premier lancement réel (GitHub Actions).

import { test, expect } from "@playwright/test";
import { E2E_TEST_USER } from "./global-setup.js";
import { dismissFirstRunModals } from "../support/firstRun.js";

async function login(page, hash) {
  await page.addInitScript(() => {
    window.__PILOTAGE_USE_FIREBASE_EMULATOR__ = true;
  });
  await page.goto(`/index.html${hash}`);
  await page.fill("#login-email", E2E_TEST_USER.email);
  await page.fill("#login-password", E2E_TEST_USER.password);
  await page.click("#login-email-submit");
  await dismissFirstRunModals(page);
}

async function createObjectiveForNewPerson(page, personName, objectiveTitle) {
  await page.click("#new-person-btn");
  await page.fill("#person-name", personName);
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText("Personne ajoutée")).toBeVisible({ timeout: 10_000 });

  await page.getByText(personName, { exact: false }).first().click();
  await page.click("#fiche-tab-objectives");
  await page.click("#add-objective-btn");
  await page.fill("#obj-title", objectiveTitle);
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText("Objectif ajouté")).toBeVisible({ timeout: 10_000 });
  await page.getByText(objectiveTitle, { exact: false }).click();
}

test("Indicateurs : création (plusieurs), modification de statut, suppression avec conservation des suivis déjà enregistrés", async ({ page }) => {
  const personName = `Test LOT 11 — personne indicateurs ${Date.now()}`;
  const objectiveTitle = `Test LOT 11 — objectif indicateurs ${Date.now()}`;
  const consoleErrors = [];
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await login(page, "#/people");
  await createObjectiveForNewPerson(page, personName, objectiveTitle);

  // 1er indicateur.
  await page.click("#add-indicator-btn");
  await page.fill("#ind-label", "Contacts terrain");
  await page.fill("#ind-target", "6 contacts sur la période");
  await page.fill("#ind-measurement", "Nombre de comptes rendus de contact");
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText("Indicateur ajouté")).toBeVisible({ timeout: 10_000 });

  // 2e indicateur, sur le même objectif (plusieurs indicateurs coexistent).
  await page.click("#add-indicator-btn");
  await page.fill("#ind-label", "Documentation à jour");
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText("Indicateur ajouté")).toBeVisible({ timeout: 10_000 });

  await expect(page.getByText("📊 Indicateurs (2)")).toBeVisible();
  const contactsRow = page.locator(".item-row", { hasText: "Contacts terrain" });
  await expect(contactsRow.locator(".badge-todo")).toBeVisible();

  // Modification du statut du 1er indicateur.
  await contactsRow.click();
  await page.locator('input[name="ind-status"][value="in_progress"]').check();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Indicateur mis à jour")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".item-row", { hasText: "Contacts terrain" }).locator(".badge-in_progress")).toBeVisible();

  // Ajout d'un suivi rattaché à "Documentation à jour" avant sa suppression, pour vérifier que sa
  // suppression ne fait pas disparaître ce suivi déjà enregistré.
  await page.click("#add-entry-btn");
  await page.locator("#oe-indicator").selectOption({ label: "Documentation à jour" });
  await page.fill("#oe-note", "Première revue de la documentation.");
  await page.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByText("Suivi ajouté")).toBeVisible({ timeout: 10_000 });

  // Suppression de "Documentation à jour".
  // CORRECTIF (premier passage réel du 22/09/2026, GitHub Actions — "strict mode violation",
  // 2 éléments) : "Documentation à jour" apparaît maintenant DEUX fois dans la fiche — la ligne
  // d'indicateur (#obj-indicators) ET la ligne du suivi qui la référence, juste ajoutée
  // ci-dessus (#obj-entries, qui affiche le nom de l'indicateur concerné) — il faut cibler
  // explicitement la ligne d'INDICATEUR, celle qu'on veut ouvrir pour la supprimer.
  const docRow = page.locator("#obj-indicators .item-row", { hasText: "Documentation à jour" });
  await docRow.click();
  await page.getByRole("button", { name: "🗑️ Supprimer" }).click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page.getByText("Indicateur supprimé")).toBeVisible({ timeout: 10_000 });

  await expect(page.getByText("📊 Indicateurs (1)")).toBeVisible();
  await expect(page.getByText("Contacts terrain", { exact: false })).toBeVisible();
  // Le suivi déjà enregistré (lié à l'indicateur supprimé) reste visible dans l'historique —
  // aucune cascade de suppression (js/domain/objectives.js#removeIndicator ne touche jamais
  // `entries`).
  await expect(page.getByText("🕒 Suivis récents (1)")).toBeVisible();
  await expect(page.getByText("Première revue de la documentation.")).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

test("Suivi lié à un indicateur : contexte affiché, statut synchronisé, référence vers une fiche existante conservée", async ({ page }) => {
  const personName = `Test LOT 11 — personne suivi ${Date.now()}`;
  const objectiveTitle = `Test LOT 11 — objectif suivi ${Date.now()}`;
  const projectName = `Test LOT 11 — projet preuve ${Date.now()}`;

  await login(page, "#/projects");
  await page.click("#new-project-btn");
  await page.fill("#project-name", projectName);
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText("Projet créé", { exact: false })).toBeVisible({ timeout: 10_000 });

  await page.goto("/index.html#/people");
  await createObjectiveForNewPerson(page, personName, objectiveTitle);

  await page.click("#add-indicator-btn");
  await page.fill("#ind-label", "Participation ateliers");
  await page.fill("#ind-target", "3 ateliers");
  await page.fill("#ind-measurement", "Présence émargée");
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText("Indicateur ajouté")).toBeVisible({ timeout: 10_000 });

  await page.click("#add-entry-btn");
  await page.locator("#oe-indicator").selectOption({ label: "Participation ateliers" });
  // Le contexte (cible/mesure/statut actuel) s'affiche sans re-demander ces informations.
  await expect(page.locator("#oe-context")).toContainText("Cible : 3 ateliers");
  await expect(page.locator("#oe-context")).toContainText("Mesure : Présence émargée");
  await expect(page.locator("#oe-context")).toContainText("Statut actuel : À démarrer");

  await page.locator('input[name="oe-status"][value="done"]').check();
  await page.fill("#oe-note", "Atelier du 20/09 fait, émargement signé.");
  await page.fill("#oe-next-steps", "Rien de prévu, indicateur atteint.");

  // Référence vers une fiche existante (le Projet créé ci-dessus) — snapshot des champs déjà
  // saisis avant réouverture du sélecteur (js/views/people.js#openAddObjectiveEntryModal#snapshot),
  // pour vérifier qu'aucune saisie n'est perdue au passage par le picker.
  await page.click("#oe-ref-pick-btn");
  await page.fill("#ref-picker-input", projectName);
  await page.locator(".item-row", { hasText: projectName }).click();

  // Les champs précédemment saisis sont toujours là après le choix de la fiche.
  await expect(page.locator("#oe-note")).toHaveValue("Atelier du 20/09 fait, émargement signé.");
  await expect(page.locator('input[name="oe-status"][value="done"]')).toBeChecked();
  await expect(page.locator("#oe-ref-display")).toContainText(projectName);

  await page.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByText("Suivi ajouté")).toBeVisible({ timeout: 10_000 });

  // Le statut de l'indicateur est synchronisé depuis le suivi (`updateIndicator` appelé quand
  // `indicatorId` ET `status` sont renseignés — js/views/people.js#openAddObjectiveEntryModal).
  // CORRECTIF (premier passage réel du 22/09/2026, GitHub Actions — "strict mode violation",
  // 2 éléments) : "Participation ateliers" + ".badge-done" matchent À LA FOIS la ligne
  // d'indicateur (#obj-indicators, ce qu'on veut vérifier ici) ET la ligne du suivi qui vient
  // d'être ajouté (#obj-entries, qui affiche aussi "Atteint") — même correctif que le test
  // précédent de ce fichier.
  await expect(page.locator("#obj-indicators .item-row", { hasText: "Participation ateliers" }).locator(".badge-done")).toBeVisible();
  // Le dernier suivi affiche l'indicateur concerné, son statut, la note et la référence résolue.
  const entryRow = page.locator("#obj-entries .item-row").first();
  await expect(entryRow).toContainText("Participation ateliers");
  await expect(entryRow).toContainText("Atelier du 20/09 fait");
  await expect(entryRow).toContainText(projectName);
});
