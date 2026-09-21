// Aides de préparation des données pour les tests LOT 0B (TODO-002) — partagées entre les tests
// de règles (rules/) et la préparation des tests E2E (e2e/global-setup.js). N'importe RIEN de
// l'application (js/...) : ne parle qu'aux émulateurs Firestore/Auth, directement.
//
// AVERTISSEMENT (20/09/2026) : ce fichier n'a pas pu être exécuté dans l'environnement où il a
// été écrit (registre npm bloqué par la politique réseau — voir tests/README.md). Les appels
// REST à l'émulateur Auth en particulier (format exact du payload `accounts:signUp`) sont écrits
// d'après la documentation Firebase connue au moment de la rédaction, mais n'ont pas été
// vérifiés contre une instance réelle de l'émulateur. À corriger si besoin au premier lancement.

import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";

export const FIRESTORE_EMULATOR_HOST = "127.0.0.1";
export const FIRESTORE_EMULATOR_PORT = 8080;
export const AUTH_EMULATOR_HOST = "127.0.0.1";
export const AUTH_EMULATOR_PORT = 9099;

// IMPORTANT : doit être le MÊME projectId que `firebaseConfig.projectId` dans
// js/services/firebase.js ("papatangocharly", en dur dans l'app). `connectFirestoreEmulator`/
// `connectAuthEmulator` redirigent le SDK vers l'émulateur local mais ne changent PAS le
// projectId avec lequel l'app a été initialisée — semer des fixtures sous un autre projectId
// (ex. un id de test arbitraire) les rendrait invisibles pour l'app réelle chargée par
// tests/support/harness.html ou par les parcours E2E. Aucune donnée réelle n'est concernée :
// tout reste local à l'émulateur, jamais envoyé au vrai projet Firebase.
export const TEST_PROJECT_ID = "papatangocharly";

// Comptes de test réutilisés par toutes les suites — un compte autorisé actif, un compte
// autorisé mais fermé (TEST-002 : `disabled: true`, comme le pose
// `accountAdmin.js#closeAccount`), et l'email admin réel (SEC-002, permanent par décision
// produit du 15/09/2026 — voir TODO_TECHNIQUE.md).
export const FIXTURE_USERS = {
  alice: { uid: "alice-uid", email: "alice@example.com" },
  bob: { uid: "bob-uid", email: "bob@example.com" }, // compte fermé (disabled: true)
  admin: { uid: "admin-uid", email: "ch-houdayer@hotmail.fr" },
};

/**
 * Sème les documents `allowedUsers` nécessaires aux tests de règles (rules/firestore.rules.test.js).
 * Écrit directement dans l'émulateur, règles de sécurité désactivées (`withSecurityRulesDisabled`)
 * — ne passe donc jamais par firestore.rules lui-même, pour ne pas fausser la mesure de ce qu'on
 * teste ensuite.
 */
export async function seedFirestoreFixtures(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "allowedUsers", FIXTURE_USERS.alice.email), {});
    await setDoc(doc(db, "allowedUsers", FIXTURE_USERS.bob.email), { disabled: true });
  });
}

/** Crée (ou réutilise) un environnement de test de règles pointé sur `firestore.rules` réel. */
export async function createRulesTestEnvironment(rulesText) {
  return initializeTestEnvironment({
    projectId: TEST_PROJECT_ID,
    firestore: {
      rules: rulesText,
      host: FIRESTORE_EMULATOR_HOST,
      port: FIRESTORE_EMULATOR_PORT,
    },
  });
}

/**
 * Crée un compte email/mot de passe dans l'émulateur Auth (utilisé par les tests E2E pour se
 * connecter via le vrai formulaire `#login-email`/`#login-password` de js/views/login.js, sans
 * jamais passer par un vrai compte Google — impossible à automatiser). Renvoie le `localId`
 * (uid) attribué par l'émulateur.
 */
export async function createEmulatorAuthUser({ email, password }) {
  const url = `http://${AUTH_EMULATOR_HOST}:${AUTH_EMULATOR_PORT}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!res.ok) {
    throw new Error(`Échec de création du compte de test dans l'émulateur Auth (${res.status}) : ${await res.text()}`);
  }
  const data = await res.json();
  return data.localId;
}

/** Vide entièrement les émulateurs Auth/Firestore entre deux exécutions complètes de la suite. */
export async function clearEmulators() {
  await fetch(
    `http://${FIRESTORE_EMULATOR_HOST}:${FIRESTORE_EMULATOR_PORT}/emulator/v1/projects/${TEST_PROJECT_ID}/databases/(default)/documents`,
    { method: "DELETE" }
  );
  await fetch(`http://${AUTH_EMULATOR_HOST}:${AUTH_EMULATOR_PORT}/emulator/v1/projects/${TEST_PROJECT_ID}/accounts`, {
    method: "DELETE",
  });
}
