// Préparation avant les tests E2E (Playwright) et les tests unitaires navigateur (tests/unit/) :
// crée le compte de test dans l'émulateur Auth et son entrée `allowedUsers` (non désactivée)
// dans l'émulateur Firestore, pour que la connexion par email/mot de passe (`#login-email`,
// js/views/login.js) et `isEmailAllowed()` fonctionnent contre l'émulateur exactement comme un
// vrai compte autorisé en production. Ne modifie aucun fichier applicatif.
//
// Correction du 21/09/2026 (premier passage réel du workflow GitHub Actions) : TEST-001
// (tests/unit/isEmailAllowed.spec.js) vérifie `isEmailAllowed()` pour trois emails différents
// (inconnu, alice, bob). Or la règle corrigée en LOT 0A (FIREBASE-002/SEC-004) n'autorise plus
// la lecture de `allowedUsers/{email}` que par son propre titulaire authentifié — il faut donc
// un compte Auth dédié PAR email testé, pas seulement pour alice (E2E_TEST_USER, réutilisé par
// les 2 parcours E2E qui n'authentifient jamais que ce seul compte).

import { createEmulatorAuthUser, createRulesTestEnvironment, seedFirestoreFixtures } from "../support/seed.js";

export const E2E_TEST_USER = {
  email: "alice@example.com",
  password: "Test-Pilotage-0B!",
};

// Comptes Auth supplémentaires, uniquement pour TEST-001 (tests/unit/isEmailAllowed.spec.js) —
// mots de passe arbitraires, valables uniquement dans l'émulateur. `alice` réutilise
// E2E_TEST_USER (même compte, pas de doublon de création).
export const UNIT_TEST_USERS = {
  alice: E2E_TEST_USER,
  bob: { email: "bob@example.com", password: "Test-Pilotage-0B!" },
  inconnu: { email: "personne-inconnue@example.com", password: "Test-Pilotage-0B!" },
};

export default async function globalSetup() {
  await createEmulatorAuthUser(E2E_TEST_USER);
  await createEmulatorAuthUser(UNIT_TEST_USERS.bob);
  await createEmulatorAuthUser(UNIT_TEST_USERS.inconnu);

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
