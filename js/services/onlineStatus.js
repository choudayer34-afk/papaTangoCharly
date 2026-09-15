// Détection en ligne/hors ligne (15/09/2026, audit "usage en mode déconnecté") — BUG corrigé :
// l'app n'avait strictement AUCUN moyen de savoir, ni de signaler, qu'elle était hors-ligne
// (aucune occurrence de `navigator.onLine` ni d'écouteur `online`/`offline` nulle part avant ce
// correctif). Conséquence concrète la plus grave : créer/modifier une fiche hors-ligne laissait
// le bouton "Créer"/"Enregistrer" grisé indéfiniment (voir js/components/modal.js), sans le
// moindre message — Firestore n'accuse réception d'une écriture qu'au retour du réseau, la
// donnée est bien appliquée tout de suite en local mais la promesse JS, elle, reste en attente.
//
// Module minimal, sans dépendance : `navigator.onLine` + les événements natifs `online`/
// `offline` de la fenêtre. Sert à la fois le bandeau global (js/app.js#mountOfflineBanner) et le
// message affiché sur un bouton resté en attente d'écriture (js/components/modal.js).

const listeners = new Set();

export function isOnline() {
  return navigator.onLine;
}

/** Appelle `callback(online)` immédiatement avec l'état courant, puis à chaque changement. */
export function subscribeOnline(callback) {
  listeners.add(callback);
  callback(navigator.onLine);
  return () => listeners.delete(callback);
}

function notify() {
  const online = navigator.onLine;
  for (const cb of listeners) cb(online);
}

window.addEventListener("online", notify);
window.addEventListener("offline", notify);
