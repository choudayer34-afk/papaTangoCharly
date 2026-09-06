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
  collection,
  getDocs,
  addDoc,
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

// Suivi d'usage superadmin (retour de Charles-Henri, 06/09/2026 : "est-ce que je peux avoir un
// mode superadmin ou moi seul ch-houdayer@hotmail.fr peux voir l'activité des autres comptes ?
// [...] avec des KPI sympa" — voir js/services/usageTracking.js pour la portée exacte retenue et
// toute la logique d'agrégation). Collection top-niveau `usageEvents`, même principe que
// `allowedUsers` ci-dessus : volontairement HORS du scope users/{uid} de storage.js, car c'est
// l'inverse de la scope par utilisateur qu'il faut ici — n'importe quel compte doit pouvoir
// écrire un événement sur lui-même, mais seul ADMIN_EMAIL doit pouvoir tous les relire. Ce
// fichier reste le SEUL à parler à Firestore directement (voir l'en-tête) : usageTracking.js ne
// fait que construire les événements à écrire et agréger ceux qu'on relit via ces deux
// fonctions. Comme pour allowedUsers, il n'y a aucune UI pour gérer la règle de sécurité
// correspondante — Charles-Henri l'applique lui-même à la main dans la console Firebase (voir
// le texte de règle documenté dans usageTracking.js).
export async function recordUsageEvent(event) {
  await addDoc(collection(db, "usageEvents"), event);
}

export async function listUsageEvents() {
  const snap = await getDocs(collection(db, "usageEvents"));
  return snap.docs.map((d) => d.data());
}
