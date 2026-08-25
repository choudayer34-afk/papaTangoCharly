// StorageAdapter — couche unique d'accès aux données (cahier des charges §78.18).
//
// Aujourd'hui : IndexedDB, 100% local, offline-first par construction.
// Demain : un second adaptateur (Firestore, pour la synchro multi-appareils) pourra
// implémenter exactement la même interface (listAll/get/put/remove/subscribe) sans que
// le reste de l'application (js/domain/*, js/views/*) n'ait à changer une seule ligne.
//
// C'est le principe non négociable : la logique métier ne dépend JAMAIS directement
// d'IndexedDB ou de Firebase, seulement de cette interface.

import { generateId } from "./id.js";

const DB_NAME = "pilotage";
const DB_VERSION = 1;
const STORES = ["inboxItems", "tasks", "projects", "history"];

let dbPromise = null;
const subscribers = new Map(); // collection -> Set<callback>

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: "id" });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode) {
  return openDb().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

function notify(collection) {
  const subs = subscribers.get(collection);
  if (!subs || subs.size === 0) return;
  listAll(collection).then((items) => {
    for (const cb of subs) cb(items);
  });
}

/** Retourne tous les éléments d'une collection, triés par updatedAt décroissant. */
export async function listAll(collection) {
  const store = await tx(collection, "readonly");
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const items = req.result || [];
      items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function get(collection, id) {
  const store = await tx(collection, "readonly");
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/** Crée ou met à jour un objet. Ajoute id/createdAt/updatedAt si absents. */
export async function put(collection, obj) {
  const now = Date.now();
  const record = {
    ...obj,
    id: obj.id || generateId(),
    createdAt: obj.createdAt || now,
    updatedAt: now,
  };
  const store = await tx(collection, "readwrite");
  await new Promise((resolve, reject) => {
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  notify(collection);
  return record;
}

export async function remove(collection, id) {
  const store = await tx(collection, "readwrite");
  await new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  notify(collection);
}

/**
 * S'abonne aux changements d'une collection. Le callback est appelé immédiatement
 * avec l'état courant, puis à chaque écriture/suppression — même contrat qu'un futur
 * onSnapshot Firestore, pour que le remplacement de backend soit transparent.
 */
export function subscribe(collection, callback) {
  if (!subscribers.has(collection)) subscribers.set(collection, new Set());
  subscribers.get(collection).add(callback);
  listAll(collection).then(callback);
  return () => subscribers.get(collection)?.delete(callback);
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
