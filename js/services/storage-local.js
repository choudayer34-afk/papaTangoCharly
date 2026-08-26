// StorageAdapter (IndexedDB) — implémentation de référence, 100% locale, mono-appareil.
//
// N'EST PLUS UTILISÉE PAR L'APPLICATION depuis le passage à Firestore (voir storage.js) :
// conservée comme second exemple concret d'implémentation de l'interface StorageAdapter
// (§78.18), et comme filet de secours si on veut un jour un mode "local pur" sans compte.
//
// L'interface (listAll/get/put/remove/subscribe/logHistory) est strictement identique à
// celle de storage.js — c'est ce qui a permis de basculer d'IndexedDB à Firestore sans
// toucher à js/domain/*.js ni js/views/*.js.

import { generateId } from "./id.js";

const DB_NAME = "pilotage";
const DB_VERSION = 2;
const STORES = ["inboxItems", "tasks", "projects", "people", "followUps", "resources", "meetings", "decisions", "history"];

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
