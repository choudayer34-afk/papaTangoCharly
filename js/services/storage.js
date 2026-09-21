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
  updateDoc,
  arrayUnion,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
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

// BUG corrigé (15/09/2026, audit performance) : plusieurs vues (fiche Tâche, fiche Ressource,
// fiche Personne...) rechargeaient l'intégralité de la collection `history` — potentiellement
// plusieurs milliers de documents après des mois d'usage — pour n'en garder qu'une poignée
// filtrée en mémoire ensuite. `listWhere` filtre côté Firestore, ne transfère que les documents
// réellement utiles. Volontairement limité à des filtres d'ÉGALITÉ (`==`) uniquement : c'est le
// seul cas où Firestore ne demande jamais d'index composite à créer manuellement (dès qu'on y
// mêle un `in`/`array-contains`/une inégalité ou un `orderBy` sur un autre champ, un index dédié
// peut devenir nécessaire) — n'étends cette fonction à d'autres opérateurs qu'après avoir vérifié
// qu'aucun index composite n'est requis, sous peine de casser la requête en production.
export async function listWhere(collectionName, equalityFilters) {
  const clauses = equalityFilters.map(([field, value]) => where(field, "==", value));
  const snap = await getDocs(query(collectionRef(collectionName), ...clauses));
  return sortByUpdatedAtDesc(snap.docs.map((d) => d.data()));
}

// BUG corrigé (15/09/2026, audit performance) : js/views/dashboard.js#openGlobalHistory
// téléchargeait l'historique ENTIER de l'app pour n'en garder que les 100 entrées les plus
// récentes (`.slice(0, 100)` après coup) — un `orderBy`+`limit` uniquement (sans filtre `where`
// combiné) ne demande jamais d'index composite, contrairement à `listWhere` ci-dessus qu'il ne
// faut donc pas mélanger avec ceci sans vérifier l'index requis.
export async function listRecent(collectionName, field, limitCount) {
  const snap = await getDocs(query(collectionRef(collectionName), orderBy(field, "desc"), limit(limitCount)));
  return snap.docs.map((d) => d.data());
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

// Extrait le 21/09/2026 (LOT 4B, TODO-010) : bookkeeping de la file par (collectionName, id),
// jusqu'ici dupliqué UNE seule fois dans `update()` ci-dessous. `appendToArray()`/`setFields()`
// (plus bas) en ont besoin à l'identique — mutualisé ici plutôt que recopié, pour qu'un futur
// correctif de cette mécanique de sérialisation (celle qui protège CODE-021, voir le commentaire
// original juste en dessous) n'ait qu'un seul endroit à corriger, jamais plusieurs copies
// susceptibles de diverger silencieusement entre elles.
function enqueue(collectionName, id, task) {
  const key = `${collectionName}/${id}`;
  const previous = updateQueues.get(key) || Promise.resolve();
  const run = previous.catch(() => {}).then(task);
  updateQueues.set(key, run);
  run.catch(() => {}).finally(() => {
    if (updateQueues.get(key) === run) updateQueues.delete(key);
  });
  return run;
}

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
  return enqueue(collectionName, id, async () => {
    const current = await get(collectionName, id);
    const patch = await mutate(current);
    if (patch === undefined) return current;
    const merged = { ...current, ...patch, id };
    for (const k of Object.keys(patch)) {
      if (patch[k] === undefined) delete merged[k];
    }
    return put(collectionName, merged);
  });
}

// Ajouté le 21/09/2026 (LOT 4B, TODO-010) : primitive d'écriture CIBLÉE pour le cas le plus
// fréquent des mutations "additives" identifiées par l'audit (`addNote`, `addChecklistItem`,
// `addOutlookMeeting`, `addPart`...) — ajouter un élément à un tableau du document SANS avoir
// besoin de connaître son contenu actuel. Contrairement à `update()` ci-dessus (lecture complète
// du document, patch calculé en mémoire, réécriture complète via `setDoc`), ceci utilise
// `updateDoc()` + `arrayUnion()` de Firestore : une écriture ATOMIQUE côté serveur, ciblée sur le
// seul champ `field`, sans jamais lire ni retransmettre le reste du document. `item` doit être un
// objet dont l'égalité profonde ne risque jamais de coïncider avec un élément déjà présent (voir
// les appelants : chacun pose son propre `id` généré via `generateId()`), car `arrayUnion` ne fait
// rien si Firestore juge l'élément déjà présent — ce n'est PAS adapté à un tableau d'éléments
// interchangeables sans identité propre. Volontairement réservé aux mutations SANS logique
// conditionnelle (jamais pour "trouver et modifier un élément existant par id", comme
// `toggleChecklistItem`/`toggleStep` — ces cas gardent `update()` ci-dessus, qui reste seul
// capable d'inspecter l'état courant). Passe par la MÊME file `enqueue()` que `update()` : un
// appel `update()` et un appel `appendToArray()` sur le MÊME document restent mutuellement
// sérialisés (jamais concurrents entre eux), donc un `update()` mis en file APRÈS un
// `appendToArray()` relira bien le tableau déjà complété par ce dernier — la garantie CODE-021
// (aucune écriture perdue) reste intacte malgré ce nouveau chemin d'écriture qui ne passe plus par
// `get()`+`put()`. Ne renvoie que l'élément ajouté (jamais le document complet, qui n'est jamais
// relu ici) — à l'appelant de mettre à jour sa propre copie locale en conséquence, voir les
// commentaires dans `js/domain/tasks.js#addNote` et ses équivalents.
export async function appendToArray(collectionName, id, field, item) {
  return enqueue(collectionName, id, async () => {
    await updateDoc(docRef(collectionName, id), { [field]: arrayUnion(item), updatedAt: Date.now() });
    return item;
  });
}

// Ajouté le 21/09/2026 (LOT 4B, TODO-010) : primitive d'écriture CIBLÉE pour un remplacement de
// champ(s) inconditionnel (ex. `setWaitingNote` — la nouvelle valeur ne dépend jamais de
// l'ancienne, contrairement aux mutations qui ont besoin de `update()`). Même principe et même
// garantie de sérialisation que `appendToArray()` ci-dessus (passe par la même file `enqueue()`),
// mais via `updateDoc()` seul (sans `arrayUnion`) puisqu'il s'agit ici de remplacer des champs
// scalaires, pas d'ajouter un élément à un tableau.
export async function setFields(collectionName, id, fields) {
  return enqueue(collectionName, id, async () => {
    await updateDoc(docRef(collectionName, id), { ...fields, updatedAt: Date.now() });
    return fields;
  });
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
 *
 * BUG corrigé (15/09/2026, audit performance) : le tri par `updatedAt` ci-dessous s'exécutait
 * systématiquement, à CHAQUE notification, même quand l'appelant retrie de toute façon selon un
 * autre critère juste après (ex. js/views/kanban.js — tâches retriées par échéance colonne par
 * colonne). `{ sort: false }` permet à un appelant qui sait déjà ne jamais avoir besoin de cet
 * ordre-là de s'en passer — `sort: true` reste le défaut pour ne rien changer ailleurs, la
 * plupart des vues affichant les résultats de `subscribe()` sans retri explicite.
 */
export function subscribe(collectionName, callback, { sort = true } = {}) {
  return onSnapshot(
    collectionRef(collectionName),
    (snap) => {
      const items = snap.docs.map((d) => d.data());
      callback(sort ? sortByUpdatedAtDesc(items) : items);
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
