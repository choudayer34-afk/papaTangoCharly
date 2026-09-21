// Tests de règles Firestore contre l'émulateur — TEST-027 (AUDIT_TESTS.md) et TEST-002
// (régression du correctif FIREBASE-001, TODO-001/LOT 0A). Voir TODO_TECHNIQUE.md → TODO-002.
//
// Couvre au minimum ce que TEST-027 demande explicitement :
//  - lecture/écriture users/{uid} par son propriétaire (doit réussir) ;
//  - lecture/écriture users/{uid} par un autre utilisateur authentifié (doit échouer) ;
//  - lecture allowedUsers (doit maintenant refléter la règle CORRIGÉE en LOT 0A, plus la
//    permissive documentée comme risque par FIREBASE-002 avant correction) ;
//  - écriture sur usageEvents avec un email/uid usurpé (doit échouer).
// Plus TEST-002 (compte `disabled: true` bloqué au niveau de la règle, pas seulement de l'UI)
// et une vérification de l'accès admin permanent (SEC-002).
//
// AVERTISSEMENT (20/09/2026) : écrit et relu manuellement, mais jamais exécuté dans cet
// environnement — le registre npm y est bloqué par la politique réseau, `@firebase/rules-unit-
// testing` et `firebase-tools` n'ont pas pu être installés (voir tests/README.md). À exécuter et
// corriger si besoin dans un environnement où `npm install` fonctionne, avant de considérer ce
// lot comme validé.

import { before, beforeEach, after, describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, collection, getDocs, addDoc } from "firebase/firestore";
import { createRulesTestEnvironment, seedFirestoreFixtures, FIXTURE_USERS } from "../support/seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RULES_PATH = path.join(__dirname, "..", "..", "firestore.rules");

let testEnv;

before(async () => {
  const rulesText = fs.readFileSync(RULES_PATH, "utf8");
  testEnv = await createRulesTestEnvironment(rulesText);
});

after(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedFirestoreFixtures(testEnv);
});

describe("users/{uid} — SEC-001, FIREBASE-001, SEC-002", () => {
  it("le propriétaire d'un compte autorisé peut lire/écrire son propre espace", async () => {
    const alice = testEnv.authenticatedContext(FIXTURE_USERS.alice.uid, { email: FIXTURE_USERS.alice.email });
    const ref = doc(alice.firestore(), `users/${FIXTURE_USERS.alice.uid}/tasks/t1`);
    await assertSucceeds(setDoc(ref, { title: "Tâche de test" }));
    await assertSucceeds(getDoc(ref));
  });

  it("TEST-002 — un compte fermé (disabled: true) perd son accès direct malgré un uid valide", async () => {
    const bob = testEnv.authenticatedContext(FIXTURE_USERS.bob.uid, { email: FIXTURE_USERS.bob.email });
    const ref = doc(bob.firestore(), `users/${FIXTURE_USERS.bob.uid}/tasks/t1`);
    await assertFails(setDoc(ref, { title: "Ne doit pas passer" }));
    await assertFails(getDoc(ref));
  });

  it("un autre utilisateur authentifié (non admin) ne peut pas lire les données d'autrui", async () => {
    const alice = testEnv.authenticatedContext(FIXTURE_USERS.alice.uid, { email: FIXTURE_USERS.alice.email });
    const refOnBob = doc(alice.firestore(), `users/${FIXTURE_USERS.bob.uid}/tasks/t1`);
    await assertFails(getDoc(refOnBob));
  });

  it("un utilisateur non authentifié n'a aucun accès", async () => {
    const anon = testEnv.unauthenticatedContext();
    const ref = doc(anon.firestore(), `users/${FIXTURE_USERS.alice.uid}/tasks/t1`);
    await assertFails(getDoc(ref));
  });

  it("SEC-002 — l'administrateur conserve un accès permanent à toutes les données (décision produit du 15/09/2026)", async () => {
    const admin = testEnv.authenticatedContext(FIXTURE_USERS.admin.uid, { email: FIXTURE_USERS.admin.email });
    const ref = doc(admin.firestore(), `users/${FIXTURE_USERS.alice.uid}/tasks/t1`);
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(setDoc(ref, { title: "Écrit par l'admin" }, { merge: true }));
  });
});

describe("allowedUsers — FIREBASE-002 / SEC-004", () => {
  it("chacun peut lire son propre statut (get)", async () => {
    const alice = testEnv.authenticatedContext(FIXTURE_USERS.alice.uid, { email: FIXTURE_USERS.alice.email });
    await assertSucceeds(getDoc(doc(alice.firestore(), `allowedUsers/${FIXTURE_USERS.alice.email}`)));
  });

  it("un utilisateur authentifié ne peut plus lire le statut d'un autre email (corrigé en LOT 0A)", async () => {
    const alice = testEnv.authenticatedContext(FIXTURE_USERS.alice.uid, { email: FIXTURE_USERS.alice.email });
    await assertFails(getDoc(doc(alice.firestore(), `allowedUsers/${FIXTURE_USERS.bob.email}`)));
  });

  it("seul l'admin peut lister l'intégralité de la collection", async () => {
    const alice = testEnv.authenticatedContext(FIXTURE_USERS.alice.uid, { email: FIXTURE_USERS.alice.email });
    const admin = testEnv.authenticatedContext(FIXTURE_USERS.admin.uid, { email: FIXTURE_USERS.admin.email });
    await assertFails(getDocs(collection(alice.firestore(), "allowedUsers")));
    await assertSucceeds(getDocs(collection(admin.firestore(), "allowedUsers")));
  });

  it("seul l'admin peut fermer/rouvrir un compte (écriture sur allowedUsers, accountAdmin.js#setAccountClosed)", async () => {
    const alice = testEnv.authenticatedContext(FIXTURE_USERS.alice.uid, { email: FIXTURE_USERS.alice.email });
    const admin = testEnv.authenticatedContext(FIXTURE_USERS.admin.uid, { email: FIXTURE_USERS.admin.email });
    await assertFails(
      setDoc(doc(alice.firestore(), `allowedUsers/${FIXTURE_USERS.alice.email}`), { disabled: true }, { merge: true })
    );
    await assertSucceeds(
      setDoc(doc(admin.firestore(), `allowedUsers/${FIXTURE_USERS.alice.email}`), { disabled: true }, { merge: true })
    );
  });
});

describe("usageEvents — hors périmètre TODO-001, reproduit tel quel depuis usageTracking.js", () => {
  it("un compte peut écrire un événement sur lui-même", async () => {
    const alice = testEnv.authenticatedContext(FIXTURE_USERS.alice.uid, { email: FIXTURE_USERS.alice.email });
    await assertSucceeds(
      addDoc(collection(alice.firestore(), "usageEvents"), {
        email: FIXTURE_USERS.alice.email,
        uid: FIXTURE_USERS.alice.uid,
        screen: "#/dashboard",
        date: Date.now(),
      })
    );
  });

  it("TEST-027 — un événement avec un email usurpé (différent du compte connecté) est refusé", async () => {
    const alice = testEnv.authenticatedContext(FIXTURE_USERS.alice.uid, { email: FIXTURE_USERS.alice.email });
    await assertFails(
      addDoc(collection(alice.firestore(), "usageEvents"), {
        email: FIXTURE_USERS.bob.email,
        uid: FIXTURE_USERS.alice.uid,
        screen: "#/dashboard",
        date: Date.now(),
      })
    );
  });

  it("seul l'admin peut relire les événements de tous les comptes", async () => {
    const alice = testEnv.authenticatedContext(FIXTURE_USERS.alice.uid, { email: FIXTURE_USERS.alice.email });
    const admin = testEnv.authenticatedContext(FIXTURE_USERS.admin.uid, { email: FIXTURE_USERS.admin.email });
    await assertFails(getDocs(collection(alice.firestore(), "usageEvents")));
    await assertSucceeds(getDocs(collection(admin.firestore(), "usageEvents")));
  });
});
