// TEST-018 (AUDIT_TESTS.md, P0) — "constituer une suite de tests de régression ciblée, un test
// par bug documenté trouvé en commentaire". TODO-002 ne couvre cette suite qu'en AMORCE (voir
// TODO_TECHNIQUE.md) : ce fichier ne traite qu'UN des quatre cas cités en exemple dans
// AUDIT_TESTS.md, celui qui touche directement le parcours de connexion déjà testé par ailleurs
// dans ce lot (TEST-001). Les trois autres cas cités par l'audit restent non couverts par cette
// amorce et NE SONT PAS traités ici (voir tests/README.md et le bilan de LOT 0B dans
// TODO_TECHNIQUE.md) :
//   - mapping legacy de js/domain/followups.js ;
//   - callback d'erreur manquant sur `onSnapshot()` dans js/services/storage.js (le bug lui-même
//     est corrigé et documenté dans le code, mais pas encore couvert par un test dédié) ;
//   - la file d'écriture de storage.js EST couverte, mais par tests/unit/storage-update-queue.spec.js
//     (TEST-006), pas ici, pour éviter un doublon.
//
// AVERTISSEMENT (20/09/2026) : non exécuté dans l'environnement où il a été écrit (registre npm
// bloqué, voir tests/README.md). L'interception réseau ci-dessous (`page.route`) cible le
// WebChannel Firestore par motif d'URL le plus courant connu au moment de la rédaction — à
// vérifier/ajuster au premier lancement réel si le SDK Firestore emprunte une autre route.

import { test, expect } from "@playwright/test";

test.describe("TEST-018 (amorce) — régression : vérification de liste blanche sans try/catch (BUG corrigé le 15/09/2026, js/app.js)", () => {
  test("une erreur pendant isEmailAllowed() affiche l'écran dédié, jamais un écran blanc silencieux", async ({ page }) => {
    // Reproduit la condition du bug déjà corrigé (voir le commentaire "BUG corrigé (15/09/2026,
    // audit \"anomalies silencieuses\")" dans js/app.js, autour de l'appel à isEmailAllowed()) :
    // une erreur réseau/Firestore pendant la vérification de la liste blanche. On la simule en
    // coupant les requêtes vers l'émulateur Firestore juste après la connexion.
    await page.route("**/google.firestore.v1.Firestore/**", (route) => route.abort());
    await page.route("**firestore.googleapis.com/**", (route) => route.abort());

    await page.goto("/index.html");
    await page.fill("#login-email", "alice@example.com");
    await page.fill("#login-password", "Test-Pilotage-0B!");
    await page.click("#login-email-submit");

    // Attendu : l'écran "Connexion interrompue" (js/views/login.js#renderAuthError), jamais un
    // écran blanc indéfini. Voir js/views/login.js pour le bouton #auth-error-retry.
    await expect(page.locator("#auth-error-retry")).toBeVisible({ timeout: 10_000 });
  });
});
