// Initialisation Firebase — Auth + Firestore avec cache local persistant (offline-first),
// même pattern que EnVie (§78.16 : reprendre la stack existante plutôt qu'en inventer une).
// C'est le SEUL fichier qui connaît la config Firebase : tout le reste de l'app ne parle
// qu'à js/services/storage.js.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBvda3Z922N1ZyP_0IPItBZv5DJcWzDWj4",
  authDomain: "papatangocharly.firebaseapp.com",
  projectId: "papatangocharly",
  storageBucket: "papatangocharly.firebasestorage.app",
  messagingSenderId: "103835154411",
  appId: "1:103835154411:web:8d780408808ce7ee9f0bae",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser() {
  return auth.currentUser;
}

export async function signInGoogle() {
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export async function signInEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signOutUser() {
  return signOut(auth);
}

// Email de Charles-Henri lui-même — source unique partagée avec js/components/adminPanel.js
// (bouton 🔧 Administration) et js/views/login.js (message "Accès restreint" plus précis pour
// lui que pour les autres, voir plus bas). Ne joue AUCUN rôle dans isEmailAllowed() ci-dessous :
// son propre accès reste soumis exactement à la même liste blanche `allowedUsers` que tout le
// monde, sans court-circuit caché — cohérent avec les règles de sécurité Firestore qu'il doit
// appliquer lui-même, qui elles non plus ne prévoient aucune exception pour son propre email.
export const ADMIN_EMAIL = "ch-houdayer@hotmail.fr";

// Liste blanche (retour de Charles-Henri : "quelques personnes précises que je choisis") —
// il ne veut pas ouvrir l'appli en libre inscription, seulement à des personnes qu'il désigne
// lui-même. Collection Firestore top-niveau `allowedUsers`, volontairement HORS du scope
// users/{uid} de storage.js : elle doit pouvoir être consultée dès la connexion, avant même de
// savoir si cet uid a le droit d'avoir un espace de données. Chaque document autorisé est
// identifié par l'email (toujours en minuscules) de la personne ; son contenu importe peu,
// seule l'EXISTENCE du document compte. Il n'y a aucune UI dans l'app pour gérer cette liste —
// ce n'est pas un réglage que l'app expose, c'est Charles-Henri qui ajoute/retire ces documents
// à la main depuis la console Firebase (voir les instructions livrées à part), exactement comme
// il l'a demandé : lui seul choisit qui entre.
export async function isEmailAllowed(email) {
  if (!email) return false;
  const ref = doc(db, "allowedUsers", email.toLowerCase());
  const snap = await getDoc(ref);
  return snap.exists();
}
