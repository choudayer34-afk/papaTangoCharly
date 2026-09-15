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
import { showToast } from "../components/toast.js";

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

// BUG corrigé (15/09/2026, audit "anomalies silencieuses" : course lecture-modification-écriture) :
// tout `js/domain/*.js` suit le même schéma pour modifier un document existant — relire l'état
// courant via `get()`, calculer un patch dessus (ajouter une sous-étape, une note...), puis
// réécrire le document entier via `put()` (qui ne fait jamais de merge Firestore, seulement un
// `setDoc` complet — voir plus haut). Ce schéma n'est pas atomique : si deux de ces séquences se
// chevauchent sur le MÊME document (ex. deux réglages de `js/domain/preferences.js` — un document
// unique partagé par toute l'app — modifiés à quelques millisecondes d'intervalle, ou le même
// Suivi édité depuis deux onglets), la seconde peut lire l'état AVANT l'écriture de la première,
// puis réécrire par-dessus en l'ignorant complètement — la première modification disparaît sans
// la moindre erreur visible. `update()` sérialise ces séquences par document (clé
// `collection/id`) : un appel ne commence sa propre lecture qu'une fois l'écriture du précédent
// appel sur CE MÊME document terminée, ce qui élimine la fenêtre de course. Les documents
// différents restent traités en parallèle (une file par clé, pas une file globale).
const updateQueues = new Map();

/**
 * Lit puis modifie un document de façon sérialisée par (collectionName, id) — à utiliser à la
 * place de `get()` + `put()` séparés dès qu'une écriture dépend de l'état courant du document.
 * `mutate(current)` reçoit l'état actuel (ou `null` si le document n'existe pas encore) et
 * renvoie le patch à fusionner dessus ; peut être async. Si `mutate` renvoie `undefined`
 * (le patch entier, pas un champ), aucune écriture n'a lieu (cas d'un appel qui, après relecture,
 * n'a finalement rien à changer) et `current` est renvoyé tel quel. Dans le patch renvoyé, un
 * CHAMP individuel valant `undefined` supprime ce champ du document plutôt que de le fusionner
 * (ex. `{ grid: undefined }` pour retirer entièrement `grid` — un simple merge ne peut pas
 * exprimer une suppression). Renvoie sinon le document écrit (comme `put`).
 */
export async function update(collectionName, id, mutate) {
  const key = `${collectionName}/${id}`;
  const previous = updateQueues.get(key) || Promise.resolve();
  const run = previous.catch(() => {}).then(async () => {
    const current = await get(collectionName, id);
    const patch = await mutate(current);
    if (patch === undefined) return current;
    const merged = { ...current, ...patch, id };
    for (const k of Object.keys(patch)) {
      if (patch[k] === undefined) delete merged[k];
    }
    return put(collectionName, merged);
  });
  updateQueues.set(key, run);
  run.catch(() => {}).finally(() => {
    if (updateQueues.get(key) === run) updateQueues.delete(key);
  });
  return run;
}

// BUG corrigé (15/09/2026, audit "anomalies silencieuses" : échecs qui disparaissent) :
// `onSnapshot()` n'avait pas de 3e argument (callback d'erreur) — c'est le chemin de lecture
// central de TOUTE l'application (Kanban, Projets, Personnes, Accueil...). Une écoute qui
// échoue (règle de sécurité Firestore refusée, quota dépassé, jeton d'authentification expiré...)
// s'arrêtait alors sans qu'aucun écran ne le sache jamais : les données affichées restaient
// figées sur leur dernier état connu, indéfiniment, sans le moindre message. Le callback
// d'erreur ci-dessous journalise systématiquement (diagnostic) et affiche un toast — au plus un
// toutes les 10 secondes (`lastSubscribeErrorToastAt`) pour ne pas empiler un toast par
// collection si plusieurs écoutes échouent en même temps (cause la plus probable : jeton
// d'authentification expiré ou règle Firestore refusée globalement, qui affecte toutes les
// collections à la fois).
let lastSubscribeErrorToastAt = 0;

/**
 * S'abonne aux changements d'une collection (temps réel + cache local hors connexion).
 * Le callback est appelé immédiatement avec l'état courant, puis à chaque écriture.
 */
export function subscribe(collectionName, callback) {
  return onSnapshot(
    collectionRef(collectionName),
    (snap) => {
      callback(sortByUpdatedAtDesc(snap.docs.map((d) => d.data())));
    },
    (error) => {
      console.error(`[storage] Écoute temps réel interrompue sur "${collectionName}" :`, error);
      const now = Date.now();
      if (now - lastSubscribeErrorToastAt > 10000) {
        lastSubscribeErrorToastAt = now;
        showToast("⚠️ Synchronisation interrompue — certaines données peuvent ne plus se mettre à jour. Recharge la page si le problème persiste.");
      }
    }
  );
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
