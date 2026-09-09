// Pastille sur l'onglet ☰ Plus (audit TDAH ciblé du 07/09/2026, retour de Charles-Henri : "ça
// manque de notes de mises à jour... il faut qu'on sache que c'est une nouveauté... guider où
// aller pour voir la note de mise à jour") — même mécanique que js/components/inboxBadge.js
// (vague 23), appliquée à ☰ Plus plutôt qu'à ❓ Aide : depuis la vague 24, Guide/Nouveautés/
// Mémoire ont quitté ❓ Aide pour l'onglet ☰ Plus (js/views/more.js) — c'est donc là, et pas sur
// ❓ Aide (qui ne mène plus à Nouveautés), que la pastille doit guider.
//
// Compte les entrées de js/views/whatsnew.js#WHATS_NEW jamais vues par ce compte
// (preferences.seenWhatsNewCount, voir js/domain/preferences.js) — s'abonne directement à la
// collection `preferences` (comme inboxBadge.js s'abonne à l'Inbox) pour se mettre à jour tout
// seul dès que la page Nouveautés est ouverte, sans attendre un changement d'onglet.

import * as storage from "../services/storage.js?v=3";
import { WHATS_NEW_TOTAL_COUNT } from "../views/whatsnew.js?v=3";

let unsubscribe = null;

/** `navEl` = l'élément <nav> déjà monté par js/app.js#mountNav. Ne fait rien si le lien "Plus"
 *  est introuvable — garde-fou silencieux plutôt qu'une erreur si cette route venait à changer. */
export function mountWhatsNewBadge(navEl) {
  const link = navEl?.querySelector('a[data-hash="#/more"]');
  const icon = link?.querySelector(".icon");
  if (!icon) return;

  const badge = document.createElement("span");
  badge.className = "nav-badge";
  badge.hidden = true;
  icon.appendChild(badge);

  unsubscribe = storage.subscribe("preferences", (items) => {
    const prefs = items.find((p) => p.id === "app");
    const unseen = WHATS_NEW_TOTAL_COUNT - (prefs?.seenWhatsNewCount || 0);
    badge.hidden = unseen <= 0;
    badge.textContent = unseen > 9 ? "9+" : String(unseen);
  });
}

export function unmountWhatsNewBadge() {
  unsubscribe?.();
  unsubscribe = null;
}
