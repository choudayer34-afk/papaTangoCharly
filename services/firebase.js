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
