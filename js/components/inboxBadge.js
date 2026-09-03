// Pastille sur l'onglet Inbox de la barre de navigation (retour de Charles-Henri, vague 23) :
// « j'aimerai qu'une pastille s'affiche dans l'onglet inbox présent en bas des menus avec le
// nombre d'élément dedans. »
//
// Le nombre affiché est celui des éléments PAS ENCORE qualifiés (`status: "pending"`, voir
// js/domain/inbox.js#subscribePending — déjà utilisé par js/views/inbox.js pour sa propre
// liste) : c'est ce compte-là qui répond au besoin réel ("est-ce qu'il y a quelque chose qui
// m'attend dans l'Inbox ?"), pas le total de tout ce qui y est un jour passé (déjà qualifié en
// Tâche/Information/Idée, ou archivé, ce n'est plus "dans l'Inbox" au sens où Charles-Henri
// l'entend). Live via Firestore (`onSnapshot`, voir js/services/storage.js#subscribe) : la
// pastille se met à jour toute seule dès qu'un élément est capturé ou qualifié, sans attendre
// de changer d'onglet.

import * as inboxApi from "../domain/inbox.js";

let unsubscribe = null;

/** `navEl` = l'élément <nav> déjà monté par js/app.js#mountNav (une seule fois par montage de
 *  l'app, voir mountApp/unmountApp). Ne fait rien si le lien Inbox est introuvable — garde-fou
 *  silencieux plutôt qu'une erreur si cette route venait à disparaître un jour. */
export function mountInboxBadge(navEl) {
  const link = navEl?.querySelector('a[data-hash="#/inbox"]');
  const icon = link?.querySelector(".icon");
  if (!icon) return;

  const badge = document.createElement("span");
  badge.className = "nav-badge";
  badge.hidden = true;
  icon.appendChild(badge);

  unsubscribe = inboxApi.subscribePending((items) => {
    const count = items.length;
    badge.hidden = count === 0;
    badge.textContent = count > 99 ? "99+" : String(count);
  });
}

export function unmountInboxBadge() {
  unsubscribe?.();
  unsubscribe = null;
}
