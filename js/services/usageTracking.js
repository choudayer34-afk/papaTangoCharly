// Suivi d'usage — mode superadmin (retour de Charles-Henri, 06/09/2026 : "est-ce que je peux
// avoir un mode superadmin ou moi seul ch-houdayer@hotmail.fr peux voir l'activité des autres
// comptes ? leurs usages avec des KPI sympa pour voir ce qui est utilisé, comment et quand ?").
//
// Portée confirmée avec Charles-Henri (3 questions posées avant toute implémentation) :
//  - Détail suivi : "Écrans + connexions" — quel écran est visité, quand, par qui, plus les
//    connexions — jamais le détail d'une action (créé/modifié/supprimé, contenus saisis).
//  - Transparence : "Non, rien d'affiché" — décision explicite de Charles-Henri après un rappel
//    factuel (pas un avis juridique) sur le droit du travail français en matière d'information
//    des salariés suivis. Décision à respecter telle quelle, à ne pas revisiter sans nouvelle
//    demande explicite de sa part.
//  - Emplacement : uniquement une nouvelle section dans 🔧 Administration
//    (js/components/adminPanel.js), jamais un nouvel onglet/écran de l'appli.
//
// Comme `allowedUsers` (voir js/services/firebase.js#isEmailAllowed), la collection Firestore
// `usageEvents` vit délibérément HORS du scope users/{uid} habituel (js/services/storage.js) :
// c'est l'inverse de la scope par utilisateur — chaque compte doit pouvoir écrire un événement
// sur lui-même sans jamais pouvoir relire ceux des autres. Le I/O Firestore brut reste dans
// firebase.js (seul fichier à parler à Firestore directement, voir son en-tête) ; ce module ne
// fait que construire les événements à écrire et agréger ceux qu'on relit — c'est ce qui le
// rend testable indépendamment de Firestore (voir computeUsageStats ci-dessous).
//
// Règle de sécurité Firestore à poser à la main dans la console (même principe self-serve que
// pour allowedUsers, voir le tutoriel intégré à adminPanel.js) :
//
//   match /usageEvents/{eventId} {
//     allow create: if request.auth != null
//                     && request.resource.data.email == request.auth.token.email.lower();
//     allow read: if request.auth != null
//                     && request.auth.token.email == "ch-houdayer@hotmail.fr";
//     allow update, delete: if false;
//   }

import { recordUsageEvent, listUsageEvents, getCurrentUser, ADMIN_EMAIL } from "./firebase.js";

/**
 * Enregistre la visite d'un écran. Volontairement "fire-and-forget" côté appelant (voir
 * js/app.js#renderRoute, appelé à chaque changement de hash) : un souci réseau ou une règle de
 * sécurité mal posée ne doit jamais gêner la navigation normale de qui que ce soit.
 */
export async function logView(route, label) {
  const user = getCurrentUser();
  if (!user) return;
  await recordUsageEvent({
    type: "view",
    uid: user.uid,
    email: (user.email || "").toLowerCase(),
    route,
    label: label || route,
    date: Date.now(),
  });
}

/**
 * Enregistre une connexion (voir js/app.js#onAuthChange). Une seconde fenêtre ouverte pendant
 * qu'on est déjà connecté (ex. la fenêtre de masquage privée, js/views/prepMask.js) compte
 * comme une connexion à part entière plutôt que d'essayer de dédupliquer entre onglets — ça
 * reste cohérent avec la portée retenue ("écrans + connexions"), sans machinerie supplémentaire
 * pour un cas marginal.
 */
export async function logLogin() {
  const user = getCurrentUser();
  if (!user) return;
  await recordUsageEvent({
    type: "login",
    uid: user.uid,
    email: (user.email || "").toLowerCase(),
    date: Date.now(),
  });
}

/**
 * Relit tous les événements — réservé à ADMIN_EMAIL. Ce garde-fou côté client ne remplace pas
 * la règle de sécurité Firestore documentée plus haut (seul rempart réel), exactement comme
 * pour isEmailAllowed() dans firebase.js.
 */
export async function fetchUsageEvents() {
  const user = getCurrentUser();
  if (!user || (user.email || "").toLowerCase() !== ADMIN_EMAIL) return [];
  return listUsageEvents();
}

/**
 * Agrégation pure (aucun accès réseau) — volontairement isolée du fetch ci-dessus pour rester
 * testable avec des événements construits à la main. Un compte = un email distinct parmi les
 * événements reçus.
 */
export function computeUsageStats(events) {
  const byEmail = new Map();
  const screenCounts = new Map();
  let earliest = null;

  for (const ev of events) {
    if (earliest === null || ev.date < earliest) earliest = ev.date;
    if (!byEmail.has(ev.email)) {
      byEmail.set(ev.email, { email: ev.email, lastSeen: null, loginCount: 0, viewCount: 0, screens: new Map() });
    }
    const acc = byEmail.get(ev.email);
    if (acc.lastSeen === null || ev.date > acc.lastSeen) acc.lastSeen = ev.date;
    if (ev.type === "login") {
      acc.loginCount++;
    } else if (ev.type === "view") {
      acc.viewCount++;
      const label = ev.label || ev.route || "?";
      acc.screens.set(label, (acc.screens.get(label) || 0) + 1);
      screenCounts.set(label, (screenCounts.get(label) || 0) + 1);
    }
  }

  const accounts = Array.from(byEmail.values())
    .map((acc) => ({
      email: acc.email,
      lastSeen: acc.lastSeen,
      loginCount: acc.loginCount,
      viewCount: acc.viewCount,
      topScreens: topEntries(acc.screens, 3),
    }))
    .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));

  return {
    totalEvents: events.length,
    since: earliest,
    accounts,
    topScreensGlobal: topEntries(screenCounts, 5),
  };
}

function topEntries(map, n) {
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}
