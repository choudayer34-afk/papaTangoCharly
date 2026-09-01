// Liens profonds vers une fiche précise (retour de Charles-Henri, 01/09/2026 : le lien collé
// dans la description d'un rendez-vous .ics doit ramener directement sur la bonne fiche, pas
// juste sur l'onglet général). Zéro dépendance : un simple format `#/route?open=Type:id`
// réutilisé par js/app.js (pour ouvrir la fiche au chargement) et par
// js/components/meetingLauncher.js (pour construire le lien inséré dans le .ics). Le
// résolveur lui-même vit dans js/components/linkedItems.js (resolveRef), qui sait déjà ouvrir
// n'importe laquelle des 7 fiches liables — ce module ne fait que le format d'URL.

export function buildDeepLink(routeHash, type, id) {
  const base = `${location.origin}${location.pathname}`;
  return `${base}${routeHash}?open=${encodeURIComponent(type)}:${encodeURIComponent(id)}`;
}

/** `queryString` = la partie après le "?" du hash courant (sans le "?" lui-même). */
export function parseOpenParam(queryString) {
  if (!queryString) return null;
  const open = new URLSearchParams(queryString).get("open");
  if (!open) return null;
  const sep = open.indexOf(":");
  if (sep === -1) return null;
  const type = open.slice(0, sep);
  const id = open.slice(sep + 1);
  if (!type || !id) return null;
  return { type, id };
}
