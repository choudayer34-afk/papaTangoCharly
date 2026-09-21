// Préparation avant les tests E2E (Playwright) et les tests unitaires navigateur (tests/unit/) :
// crée le compte de test dans l'émulateur Auth et son entrée `allowedUsers` (non désactivée)
// dans l'émulateur Firestore, pour que la connexion par email/mot de passe (`#login-email`,
// js/views/login.js) et `isEmailAllowed()` fonctionnent contre l'émulateur exactement comme un
// vrai compte autorisé en production. Ne modifie aucun fichier applicatif.
//
// AVERTISSEMENT (20/09/2026) : non exécuté dans l'environnement où il a été écrit (registre npm
// bloqué, voir tests/README.md) — à vérifier/corriger au premier lancement réel.

import { createEmulatorAuthUser, createRulesTestEnvironment, seedFirestoreFixtures } from "../support/seed.js";

export const E2E_TEST_USER = {
  email: "alice@example.com",
  password: "Test-Pilotage-0B!",
};

export default async function globalSetup() {
  await createEmulatorAuthUser(E2E_TEST_USER);

  // Réutilise les mêmes fixtures que les tests de règles (allowedUsers/alice, non désactivé) —
  // voir tests/support/seed.js. Les règles réelles (firestore.rules) s'appliquent normalement :
  // ce n'est PAS un contournement, seule la préparation initiale du document contourne les
  // règles (comme le ferait un administrateur créant l'invitation depuis la console).
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const rulesText = fs.readFileSync(path.join(__dirname, "..", "..", "firestore.rules"), "utf8");
  const testEnv = await createRulesTestEnvironment(rulesText);
  await seedFirestoreFixtures(testEnv);
  await testEnv.cleanup();
}
