// Administration des comptes (retour de Charles-Henri, 14/09/2026 : "en tant qu'administrateur
// je veux pouvoir fermer / ouvrir un compte puis supprimer tout son contenu pour libérer
// l'espace sur firebase si besoin") — même esprit que usageTracking.js juste à côté : ce module
// ajoute la logique métier et le garde-fou côté client (réservé à ADMIN_EMAIL) par-dessus l'I/O
// Firestore brut qui reste dans firebase.js (seul fichier à parler à Firestore directement).
//
// Fermer/ouvrir un compte réutilise la collection `allowedUsers` déjà en place (voir
// firebase.js#isEmailAllowed) : un champ `disabled` sur le document existant, plutôt qu'une
// nouvelle collection. Fermer un compte ne coupe qu'à la PROCHAINE reconnexion (une session déjà
// ouverte ailleurs continue jusqu'à sa reconnexion suivante — même limite déjà documentée pour
// une suppression pure et simple d'accès dans le tutoriel 🔥 Firebase de adminPanel.js) :
// Firestore continue d'appliquer ses propres règles de sécurité (propriétaire uniquement),
// indépendantes de ce champ qui ne gouverne que l'écran de connexion de l'app elle-même.
//
// Supprimer le contenu d'un compte, en revanche, exige que l'admin (un uid DIFFÉRENT du
// propriétaire) puisse lire/écrire sous users/{uid}/... d'un tiers — impossible avec la règle de
// sécurité "propriétaire uniquement" en place aujourd'hui. Nécessite une règle Firestore
// supplémentaire, à poser à la main dans la console (voir le tutoriel 🔥 Firebase de
// adminPanel.js pour le texte exact) — même principe self-serve que pour allowedUsers/
// usageEvents avant elle. Tant que cette règle n'est pas posée, les fonctions ci-dessous qui en
// dépendent (listAccounts, exportAccountData, deleteAccountContent) échouent avec une erreur
// Firestore "permission-denied" plutôt que de renvoyer un résultat silencieusement incomplet.
//
// Volontairement IRRÉVERSIBLE et verrouillé à deux niveaux côté UI (adminPanel.js) : le compte
// doit déjà être fermé, ET une sauvegarde JSON doit avoir été téléchargée dans la même modale
// avant que le bouton de suppression définitive ne s'active — "jamais de perte silencieuse",
// ici plus que jamais puisqu'il s'agit de la totalité des données de quelqu'un d'autre.

import {
  getCurrentUser,
  ADMIN_EMAIL,
  listAllowedAccounts,
  setAccountClosed,
  markAccountContentWiped,
  exportAllUserData,
  deleteAllUserData,
} from "./firebase.js";
import { fetchUsageEvents } from "./usageTracking.js";

function isAdmin() {
  const user = getCurrentUser();
  return !!user && (user.email || "").toLowerCase() === ADMIN_EMAIL;
}

/**
 * Une ligne par compte invité — fusion de `allowedUsers` (autorisation/état, seule source de
 * vérité pour la LISTE des comptes) et des événements d'usage (uid le plus récent connu pour cet
 * email, dernière activité — même principe d'agrégation que usageTracking.js#computeUsageStats).
 * Un compte invité mais jamais connecté n'a pas d'uid connu : il n'a jamais eu d'espace de
 * données, donc rien à exporter ni à supprimer pour lui (voir deleteAccountContent).
 */
export async function listAccounts() {
  if (!isAdmin()) return [];
  const [allowed, events] = await Promise.all([listAllowedAccounts(), fetchUsageEvents()]);
  const byEmail = new Map();
  for (const ev of events) {
    const email = (ev.email || "").toLowerCase();
    if (!email) continue;
    const acc = byEmail.get(email) || { uid: null, lastSeen: null };
    if (ev.uid) acc.uid = ev.uid;
    if (acc.lastSeen === null || ev.date > acc.lastSeen) acc.lastSeen = ev.date;
    byEmail.set(email, acc);
  }
  return allowed
    .map((a) => {
      const usage = byEmail.get(a.email.toLowerCase()) || { uid: null, lastSeen: null };
      return {
        email: a.email,
        disabled: a.disabled === true,
        contentWipedAt: a.contentWipedAt || null,
        uid: usage.uid,
        lastSeen: usage.lastSeen,
      };
    })
    .sort((a, b) => a.email.localeCompare(b.email, "fr"));
}

export async function closeAccount(email) {
  if (!isAdmin()) return;
  await setAccountClosed(email, true);
}

export async function reopenAccount(email) {
  if (!isAdmin()) return;
  await setAccountClosed(email, false);
}

/** Génère et déclenche le téléchargement d'une sauvegarde JSON du compte (toutes ses collections
 * applicatives) — proposé comme filet de sécurité avant toute suppression définitive. */
export async function downloadAccountBackup(account) {
  if (!isAdmin()) throw new Error("Réservé à l'administrateur.");
  if (!account.uid) throw new Error("Ce compte ne s'est jamais connecté — rien à sauvegarder.");
  const collections = await exportAllUserData(account.uid);
  const payload = { email: account.email, uid: account.uid, exportedAt: Date.now(), collections };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const datePart = new Date().toISOString().slice(0, 10);
  a.download = `pilotage-sauvegarde-${account.email.replace(/[^a-z0-9]+/gi, "-")}-${datePart}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Supprime tout le contenu applicatif d'un compte. Refuse si le compte n'est pas fermé ou n'a
 * pas d'uid connu — garde-fou côté client EN PLUS du verrou déjà posé dans l'interface
 * (adminPanel.js), jamais la seule protection : si un futur écran appelle cette fonction sans
 * repasser par cette modale, l'erreur reste la même.
 */
export async function deleteAccountContent(account) {
  if (!isAdmin()) throw new Error("Réservé à l'administrateur.");
  if (!account.uid) throw new Error("Ce compte ne s'est jamais connecté — rien à supprimer.");
  if (!account.disabled) throw new Error("Ferme le compte avant de supprimer son contenu.");
  const count = await deleteAllUserData(account.uid);
  await markAccountContentWiped(account.email);
  return count;
}
