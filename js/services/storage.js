// StorageAdapter — couche unique d'accès aux données (cahier des charges §78.18).
//
// Implémentation Firestore : offline-first (cache local persistant, voir firebase.js)
// avec synchronisation automatique entre appareils dès que la connexion est disponible.
// Chaque document vit sous users/{uid}/{collection}/{id} — usage strictement personnel
// (§ réponse de Charles-Henri), pas de partage multi-utilisateur.
//
// La logique métier (js/domain/*, js/views/*) ne connaît que cette interface
// (listAll/get/put/remove/subscribe/logHistory) — jamais Firestore directement. C'est ce
// qui permet à storage-local.js (IndexedDB) d'exister en implémentation alternative sans
// qu'une seule ligne ailleurs dans l'app n'ait besoin de changer.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { generateId } from "./id.js";

function requireUid() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Aucun utilisateur connecté — storage indisponible.");
  return uid;
}

function collectionRef(name) {
  return collection(db, "users", requireUid(), name);
}

function docRef(name, id) {
  return doc(db, "users", requireUid(), name, id);
}

function sortByUpdatedAtDesc(items) {
  return items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function listAll(collectionName) {
  const snap = await getDocs(collectionRef(collectionName));
  return sortByUpdatedAtDesc(snap.docs.map((d) => d.data()));
}

export async function get(collectionName, id) {
  const snap = await getDoc(docRef(collectionName, id));
  return snap.exists() ? snap.data() : null;
}

/** Crée ou met à jour un objet. Ajoute id/createdAt/updatedAt si absents. */
export async function put(collectionName, obj) {
  const now = Date.now();
  const record = {
    ...obj,
    id: obj.id || generateId(),
    createdAt: obj.createdAt || now,
    updatedAt: now,
  };
  await setDoc(docRef(collectionName, record.id), record);
  return record;
}

export async function remove(collectionName, id) {
  await deleteDoc(docRef(collectionName, id));
}

/**
 * S'abonne aux changements d'une collection (temps réel + cache local hors connexion).
 * Le callback est appelé immédiatement avec l'état courant, puis à chaque écriture.
 */
export function subscribe(collectionName, callback) {
  return onSnapshot(collectionRef(collectionName), (snap) => {
    callback(sortByUpdatedAtDesc(snap.docs.map((d) => d.data())));
  });
}

/**
 * Moteur d'historique central (§78.23) : chaque service métier doit journaliser ses
 * événements importants ici plutôt que d'inventer son propre mécanisme.
 */
export async function logHistory(entityType, entityId, action, metadata = {}) {
  return put("history", {
    entityType,
    entityId,
    action,
    metadata,
    date: Date.now(),
  });
}
