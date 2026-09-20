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
  setDoc,
  writeBatch,
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
// identifié par l'email (toujours en minuscules) de la personne. INVITER quelqu'un reste manuel
// (Charles-Henri crée le document depuis la console Firebase, voir le tutoriel 🔥 Firebase de
// adminPanel.js) — mais FERMER/OUVRIR un compte déjà invité se fait désormais depuis l'app (voir
// js/services/accountAdmin.js, 🔧 Administration → "👥 Comptes") : un champ `disabled` sur ce
// même document, plutôt qu'une nouvelle collection. Un document sans ce champ (tous ceux créés
// avant cette fonctionnalité) reste autorisé — `disabled` absent équivaut à `false`.
export async function isEmailAllowed(email) {
  if (!email) return false;
  const ref = doc(db, "allowedUsers", email.toLowerCase());
  const snap = await getDoc(ref);
  if (!snap.exists()) return false;
  return snap.data().disabled !== true;
}

/** Liste complète des comptes invités (existence dans `allowedUsers`), réservée à l'admin côté
 * app (le vrai rempart reste la règle Firestore — voir `firestore.rules` à la racine du dépôt,
 * qui autorise un `list`, pas seulement un `get`, sur cette collection pour ADMIN_EMAIL). */
export async function listAllowedAccounts() {
  const snap = await getDocs(collection(db, "allowedUsers"));
  return snap.docs.map((d) => ({ email: d.id, ...d.data() }));
}

/** Ferme (`closed: true`) ou rouvre (`closed: false`) un compte déjà invité — ne touche à rien
 * d'autre sur le document (`setDoc` en fusion). Rien à faire si le compte n'a jamais été invité :
 * il n'a alors de toute façon aucun accès (voir isEmailAllowed ci-dessus). */
export async function setAccountClosed(email, closed) {
  const ref = doc(db, "allowedUsers", email.toLowerCase());
  await setDoc(ref, { disabled: closed }, { merge: true });
}

/** Marque un compte comme vidé (horodatage informatif affiché dans 👥 Comptes) — n'efface rien
 * d'autre sur son document `allowedUsers` (le compte reste identifiable, juste marqué). */
export async function markAccountContentWiped(email) {
  const ref = doc(db, "allowedUsers", email.toLowerCase());
  await setDoc(ref, { contentWipedAt: Date.now() }, { merge: true });
}

// Collections applicatives vivant sous users/{uid}/... (voir storage.js) — la liste EXACTE des
// constantes `COLLECTION` de js/domain/*.js à la date de cette vague (14/09/2026), obtenue par
// `grep -n "^const COLLECTION" js/domain/*.js`. AUCUN moyen, côté client Firestore, de découvrir
// tout seul les sous-collections existantes sous un uid (contrairement à l'Admin SDK) — cette
// liste doit donc être tenue à jour À LA MAIN à chaque nouveau domaine qui introduit sa propre
// collection, sans quoi son contenu échapperait silencieusement à l'export ET à la suppression
// ci-dessous. Précédent connu et documenté deux fois dans ce dépôt pour `APP_SHELL` de sw.js
// (des fichiers oubliés lors de leur création) : même risque ici, à ne pas reproduire — rejouer
// la commande ci-dessus avant chaque vague qui ajoute un domaine, pas seulement s'y fier de
// mémoire.
export const USER_DATA_COLLECTIONS = [
  "tasks",
  "projects",
  "people",
  "followUps",
  "resources",
  "meetings",
  "decisions",
  "objectives",
  "tags",
  "links",
  "history",
  "preferences",
  "prompts",
  "inboxItems",
];

/** Exporte l'intégralité du contenu applicatif d'un compte (les collections ci-dessus, sous
 * users/{uid}/...) — utilisé pour la sauvegarde JSON proposée avant toute suppression (voir
 * accountAdmin.js). Nécessite que ADMIN_EMAIL puisse lire n'importe quel users/{uid}/... — voir
 * `firestore.rules` à la racine du dépôt (et le tutoriel 🔥 Firebase de adminPanel.js). */
export async function exportAllUserData(uid) {
  const result = {};
  for (const name of USER_DATA_COLLECTIONS) {
    const snap = await getDocs(collection(db, "users", uid, name));
    result[name] = snap.docs.map((d) => d.data());
  }
  return result;
}

/** Supprime TOUT le contenu applicatif d'un compte (les collections ci-dessus, sous
 * users/{uid}/...) — irréversible. Ne touche ni à `usageEvents` (historique d'activité, conservé
 * comme trace d'administration) ni au document `allowedUsers` du compte lui-même (voir
 * markAccountContentWiped). Par lots de 400 (marge sous la limite de 500 opérations par batch
 * Firestore) plutôt qu'un `deleteDoc` par document un par un, pour un compte qui aurait accumulé
 * beaucoup d'historique (voir la mise en garde sur ce point dans le guide d'hébergement). */
export async function deleteAllUserData(uid) {
  let deletedCount = 0;
  for (const name of USER_DATA_COLLECTIONS) {
    const snap = await getDocs(collection(db, "users", uid, name));
    const refs = snap.docs.map((d) => d.ref);
    for (let i = 0; i < refs.length; i += 400) {
      const batch = writeBatch(db);
      refs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
    deletedCount += refs.length;
  }
  return deletedCount;
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
