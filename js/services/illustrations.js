// Détection automatique de la disponibilité des illustrations réelles LOT G9 (29/09/2026, retour
// de Charles-Henri : « on fait la détection automatique » — livraison progressive des 86 fichiers
// prévus par claude/lotg9-prompts-chatgpt-illustrations-28-09-2026.md, au fur et à mesure de leur
// génération via ChatGPT, sans jamais avoir à toucher au code à chaque lot de fichiers déposés).
//
// Principe : l'app est un PWA vanilla JS sans backend — la seule façon de savoir si un fichier
// `illustrations/**/*.png` existe déjà est de tenter de le charger côté client. Le repli actuel
// (emoji + traitement CSS par rareté/catégorie, déjà en place partout où ce module est utilisé)
// reste TOUJOURS ce qui s'affiche en premier ; l'image réelle ne le remplace que si/quand elle
// charge avec succès, de façon asynchrone — jamais de "flash" d'icône cassée, jamais de dépendance
// à un fichier qui n'existe pas encore. Un fichier absent aujourd'hui et déposé demain apparaît de
// lui-même au prochain rendu, sans renommage ni changement de code (voir le document ci-dessus
// pour la correspondance exacte entre chaque `id` du catalogue et son nom de fichier attendu).
//
// Volontairement PAS ajouté à `sw.js#APP_SHELL` : ces chemins n'existent pas tous encore, et même
// si `Promise.allSettled` (voir sw.js, correctif du 15/09/2026) empêche un fichier manquant de
// faire échouer l'installation du service worker, précacher 86 chemins pour la plupart absents
// serait un bruit inutile tant que Charles-Henri n'a pas confirmé le jeu complet livré.

const disponibilite = new Map(); // url -> Promise<boolean>, mémoïsé pour la session (jamais purgé :
// au plus 86 entrées possibles, ce catalogue ne grandit jamais en cours de session).

function sondeIllustration(url) {
  if (!disponibilite.has(url)) {
    disponibilite.set(
      url,
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
      })
    );
  }
  return disponibilite.get(url);
}

/** Chemin attendu pour l'illustration d'un badge (Section A du document de prompts, 70 fichiers) —
 *  `badge.id` du catalogue `BADGES` (js/domain/gamification.js) EST le nom de fichier, sans
 *  renommage. */
export function badgeIllustrationUrl(badgeId) {
  return `illustrations/badges/${badgeId}.png`;
}

/** Chemin attendu pour l'illustration d'une icône de déblocage (Section B, 14 fichiers,
 *  catégorie "icone" uniquement — Thème/Ruban ont déjà leur rendu définitif, voir le document de
 *  prompts §1) — `deblocage.id` du catalogue `DEBLOCAGES` EST le nom de fichier. */
export function iconeIllustrationUrl(deblocageId) {
  return `illustrations/icones/${deblocageId}.png`;
}

/** Chemin attendu pour un fond d'écran discret (Section C, 2 fichiers, catégorie "fond") —
 *  `deblocage.valeur` ("horizon"/"sommet") EST la partie variable du nom de fichier. */
export function fondIllustrationUrl(valeur) {
  return `illustrations/fonds/fond-${valeur}.png`;
}

/**
 * Tente de faire apparaître l'illustration réelle à la place du contenu de repli déjà présent
 * dans `container` (emoji, pastille CSS, etc.) — ne touche à RIEN si le fichier n'est pas
 * disponible, ou si `container` a été retiré du DOM entre-temps (changement d'écran pendant le
 * chargement). `.illustration-image` porte la taille/l'ajustement propres à chaque contexte
 * d'appel (styles/components.css) — ce module ne connaît volontairement aucune mise en forme.
 */
export function upgradeToIllustration(container, url, altText = "") {
  if (!container) return;
  sondeIllustration(url).then((disponible) => {
    if (!disponible || !container.isConnected) return;
    container.innerHTML = "";
    const img = document.createElement("img");
    img.src = url;
    img.alt = altText;
    img.className = "illustration-image";
    container.appendChild(img);
  });
}

/** Variante pour un fond d'écran (pas un `container` à remplacer, mais un élément dont on pose
 *  `style.backgroundImage` — une image en ligne l'emporte de toute façon sur le dégradé posé par
 *  classe CSS, sans qu'il soit nécessaire de retirer cette classe). Repose `backgroundImage` à
 *  vide si le fichier n'est pas (ou plus) disponible, pour que le dégradé de repli réapparaisse. */
export function upgradeFondIllustration(el, url) {
  if (!el) return;
  sondeIllustration(url).then((disponible) => {
    if (!el.isConnected) return;
    el.style.backgroundImage = disponible ? `url("${url}")` : "";
    el.style.backgroundRepeat = disponible ? "no-repeat" : "";
    el.style.backgroundPosition = disponible ? "top center" : "";
    el.style.backgroundSize = disponible ? "100% auto" : "";
  });
}
