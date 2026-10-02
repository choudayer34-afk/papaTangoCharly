// 📡 Veille — sources à surveiller par sujet, centralisées en un seul endroit. Besoin direct de
// Charles-Henri (01-02/10/2026, hors roadmap TODO_TECHNIQUE.md) : "je voudrais réfléchir à un
// outil de veille [...] je ne sais pas comment faire de la veille, quand, quoi ni comment et
// comment l'intégrer dans l'outil". Construit après une vraie phase de réflexion partagée
// (méthode, rythme, sources réelles par sujet) plutôt que codé directement — voir
// claude/sources-veille-02-10-2026.md pour le détail de chaque choix, et js/views/guide.js
// (rubrique "📡 Comment faire sa veille") pour la MÉTHODE (rythme flux/stock, rituel quotidien).
// Ce fichier-ci ne porte que la LISTE de sources elle-même, éditable sans toucher au code.
//
// Sur le choix d'architecture : une vue "accès centralisé" a été explicitement préférée par
// Charles-Henri à une simple vue filtrée par tag dans l'Inbox ("pas sûr que la vue tags me
// convienne, j'ai besoin de centraliser l'accès") — d'où une collection et un écran dédiés
// (js/views/veille.js) plutôt que de réutiliser l'Inbox ou les Ressources existantes. Modèle
// volontairement minimal (titre, lien, catégorie, note) — pas de liaison à un Projet/une Tâche
// comme js/domain/resources.js : une source de veille est un point d'entrée à consulter
// régulièrement, pas une pièce jointe de travail rattachée à autre chose dans l'app.
//
// 🔍 Détection de nouveautés (02/10/2026, suite directe du point ci-dessus — retour de
// Charles-Henri après la livraison de la liste de sources : "comment rendre cette analyse
// paramétrable par site"). Contexte : un flux RSS exploitable n'existe que pour une poignée de
// sources (confirmé : La France Agricole ; absent ou non trouvé : SEMAE, UFS, ISAGRI, Agro
// Matin) — abandonné par Charles-Henri lui-même ("Laisse tomber pour les flux"). Ce qui suit
// est donc une détection de CHANGEMENT DE PAGE, pas un flux structuré : on récupère le HTML
// d'une page (via un proxy CORS public, gratuit, sans inscription — un simple fetch() direct
// échoue sur la quasi-totalité de ces sites, qui n'exposent pas d'en-têtes CORS), on en isole
// une zone (si un sélecteur CSS est configuré, sinon un repli générique qui retire menus/pubs/
// scripts), on en garde une empreinte, et on compare à la précédente lors de la prochaine
// vérification. "Paramétrable par site" = chaque source porte ses propres `watchUrl` (si l'URL
// à surveiller diffère du lien affiché) et `watchSelector` (la zone précise à comparer) —
// JAMAIS un script générique unique pour les 16 sources, impossible vu à quel point leurs pages
// diffèrent. Le bouton "🔍 Tester" de js/views/veille.js permet de vérifier/ajuster ces deux
// champs contre la vraie page AVANT de les enregistrer, sans quoi régler un sélecteur à l'aveugle
// n'aurait aucun sens. Vérification toujours MANUELLE (un bouton), jamais en tâche de fond —
// même principe que partout ailleurs dans l'app, et une façon de ne pas solliciter sans retenue
// un service public gratuit, sans garantie de disponibilité, qu'on ne contrôle pas.

import * as storage from "../services/storage.js";

const COLLECTION = "veilleSources";

// Trois catégories actées avec Charles-Henri (02/10/2026) : réglementation et marché/concurrence
// sont du FLUX (actualité qui bouge, revue quotidienne), management/pilotage est du STOCK (contenu
// de fond, revu occasionnellement) — voir la rubrique Guide pour l'explication complète donnée à
// l'utilisateur.
export const CATEGORIES = [
  { key: "reglementation", label: "Réglementation", emoji: "⚖️" },
  { key: "concurrence", label: "Marché / concurrence", emoji: "🏢" },
  { key: "management", label: "Management / pilotage", emoji: "🧭" },
];

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));

export function categoryInfo(key) {
  return CATEGORY_MAP[key] || CATEGORIES[0];
}

export async function createSource(data) {
  return storage.put(COLLECTION, {
    title: (data.title || "").trim(),
    url: (data.url || "").trim(),
    category: CATEGORY_MAP[data.category] ? data.category : CATEGORIES[0].key,
    notes: (data.notes || "").trim(),
    // Détection de nouveautés (voir le commentaire d'en-tête du fichier) — optionnelle, désactivée
    // par défaut. Passée ici (plutôt que seulement via updateSource) pour que STARTER_SOURCES
    // ci-dessous puisse l'activer dès l'import sur les sources qui en bénéficient le plus (celles
    // sans flux RSS), sans étape manuelle supplémentaire.
    watchEnabled: !!data.watchEnabled,
    watchUrl: (data.watchUrl || "").trim(),
    watchSelector: (data.watchSelector || "").trim(),
  });
}

export async function updateSource(id, patch) {
  return storage.setFields(COLLECTION, id, patch);
}

export async function removeSource(id) {
  return storage.remove(COLLECTION, id);
}

export function listAll() {
  return storage.listAll(COLLECTION);
}

// `{ sort: false }` — l'ordre d'affichage vient du tri alphabétique par catégorie fait côté vue
// (js/views/veille.js), pas de "dernière modifiée en premier" (comportement par défaut de
// storage.subscribe) : une liste de référence qu'on consulte tous les jours n'a aucune raison de
// changer d'ordre simplement parce qu'une note a été corrigée dessus.
export function subscribe(callback) {
  return storage.subscribe(COLLECTION, callback, { sort: false });
}

// Proxies CORS publics, gratuits, sans inscription ni clé API — nécessaire car la quasi-totalité
// des sites de veille ciblés ne renvoient pas d'en-tête CORS autorisant un fetch() direct depuis
// le navigateur. Choisi pour rester à coût et configuration nuls (contrainte explicite de
// Charles-Henri : "je veux rester gratuit") plutôt qu'un service avec compte/clé API (rss2json...)
// ou une fonction serverless (Firebase Cloud Functions, qui imposerait le plan payant à l'usage).
// Contrepartie assumée : ressource communautaire sans garantie de disponibilité — un échec
// (`error: "fetch_failed"`) est une situation normale et prévue, jamais traitée comme "rien n'a
// changé".
//
// PLUSIEURS proxies, essayés dans l'ordre (02/10/2026, retour de Charles-Henri après un premier
// test réel sur SEMAE : "Échec de récupération") — un service public gratuit seul n'offre aucune
// garantie de disponibilité, et certains sites bloquent carrément les adresses IP des proxys les
// plus connus (protection anti-robot) : aucun moyen de savoir à l'avance lequel passera pour un
// site donné. Le premier qui répond est utilisé ; `detail` (voir `previewWatch()`) garde la trace
// de ce qui a été essayé, pour que l'échec reste diagnosticable plutôt qu'un simple "ça ne marche
// pas" sans piste.
//
// 3e proxy ajouté (02/10/2026, même jour) : le tout premier test réel a vu allorigins ET codetabs
// échouer EN MÊME TEMPS (confirmé par Charles-Henri via l'erreur Cloudflare 522 "Connection timed
// out" sur allorigins — une vraie panne côté service, pas un blocage réseau de son côté). Une
// coïncidence malheureuse plutôt qu'un problème de fond, mais qui montre que 2 services gratuits
// et non garantis peuvent très bien tomber ensemble : un 3e en secours augmente les chances qu'au
// moins un réponde.
//
// corsproxy.io RETIRÉ (02/10/2026, même jour) : un test réel a renvoyé HTTP 401 de façon répétée,
// pas une panne ponctuelle. Charles-Henri a vérifié en ouvrant l'URL directement dans son
// navigateur — réponse : {"error":"A valid API key is required. Get one at
// https://console.corsproxy.io/"}. Le service exige désormais une inscription/clé, incompatible
// avec la contrainte "rester gratuit, sans compte". On revient à la paire allorigins + codetabs,
// qui a fonctionné sans accroc sur un test réel juste après (source Terre-net, 4976 caractères
// extraits). Si une nouvelle source gratuite et sans compte est identifiée et testée (vérification
// manuelle de Charles-Henri obligatoire avant tout ajout, vu l'historique de ce fichier), elle
// pourra reprendre la 3e place.
const PROXIES = [
  { name: "allorigins", build: (target) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(target) },
  { name: "codetabs", build: (target) => "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(target) },
];
const PROXY_TIMEOUT_MS = 15000;

/** Empreinte simple (non cryptographique, suffisante pour détecter un changement) d'une chaîne. */
function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}

/**
 * Isole le texte à comparer dans une page HTML récupérée. Avec `selector` : prend le texte de CE
 * nœud précis (la zone configurée pour CE site) — si introuvable, erreur explicite plutôt qu'un
 * repli silencieux (le site a probablement changé de structure, mieux vaut le savoir que
 * continuer à comparer autre chose sans le dire). Sans `selector` : repli générique qui retire
 * les zones quasi certainement sans rapport avec le contenu (menus, pubs, scripts) avant de
 * prendre le texte restant — imparfait (peut encore inclure des blocs "articles les plus lus" qui
 * bougent sans rapport avec une vraie nouveauté), un sélecteur précis reste préférable dès qu'il
 * est identifié via le bouton "🔍 Tester".
 */
function extractTextForWatch(html, selector) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  let root;
  if (selector) {
    root = doc.querySelector(selector);
    if (!root) return { text: null, error: "selector_not_found" };
  } else {
    root = doc.body.cloneNode(true);
    root.querySelectorAll("script, style, nav, header, footer, aside, iframe, noscript").forEach((el) => el.remove());
  }
  const text = (root.textContent || "").replace(/\s+/g, " ").trim();
  if (!text) return { text: null, error: "empty" };
  return { text, error: null };
}

/** Libellés humains des codes d'erreur renvoyés par `previewWatch()`/`checkSourceForChanges()`. */
export const WATCH_ERROR_LABELS = {
  no_url: "Aucune URL à surveiller",
  fetch_failed: "Échec de récupération (site ou proxy indisponible pour l'instant)",
  selector_not_found: "Sélecteur introuvable sur la page (le site a peut-être changé de structure)",
  empty: "Aucun contenu trouvé à cet endroit",
};

/**
 * Récupère et analyse une page SANS rien écrire — utilisé par le bouton "🔍 Tester" de la modale
 * (contre les valeurs de champs en cours de saisie, pas encore enregistrées) et en interne par
 * `checkSourceForChanges()`. Essaie chaque proxy de `PROXIES` dans l'ordre jusqu'à ce que l'un
 * réponde — `detail` résume ce qui a été tenté (utile seulement quand `ok` est `false`).
 * @param {{url?:string, watchUrl?:string, watchSelector?:string}} fields
 * @returns {Promise<{ok:boolean, error?:string, detail?:string, text?:string, hash?:string, preview?:string}>}
 */
export async function previewWatch({ url, watchUrl, watchSelector } = {}) {
  const target = (watchUrl || url || "").trim();
  if (!target) return { ok: false, error: "no_url" };

  let html = null;
  const attempts = [];
  for (const proxy of PROXIES) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
    try {
      const res = await fetch(proxy.build(target), { signal: controller.signal });
      if (!res.ok) {
        attempts.push(`${proxy.name} : HTTP ${res.status}`);
        continue;
      }
      html = await res.text();
      break;
    } catch (e) {
      attempts.push(`${proxy.name} : ${e?.name === "AbortError" ? "délai dépassé" : "injoignable"}`);
    } finally {
      clearTimeout(timer);
    }
  }
  if (html === null) {
    return { ok: false, error: "fetch_failed", detail: attempts.join(" · ") };
  }

  const { text, error } = extractTextForWatch(html, (watchSelector || "").trim());
  if (error) return { ok: false, error };
  return { ok: true, text, hash: simpleHash(text), preview: text.slice(0, 220) };
}

/**
 * Vérifie une source déjà enregistrée et persiste le résultat (empreinte, horodatage, erreur
 * éventuelle). Ne marque "🆕 nouveauté" que si une empreinte précédente existait déjà — la toute
 * première vérification établit seulement une référence, jamais un faux "du nouveau" immédiat.
 */
export async function checkSourceForChanges(source) {
  const result = await previewWatch({ url: source.url, watchUrl: source.watchUrl, watchSelector: source.watchSelector });
  const now = Date.now();
  if (!result.ok) {
    await updateSource(source.id, { lastCheckedAt: now, lastCheckError: result.error, lastCheckDetail: result.detail || "" });
    return result;
  }
  const changed = !!source.lastContentHash && result.hash !== source.lastContentHash;
  const patch = { lastContentHash: result.hash, lastCheckedAt: now, lastCheckError: "", lastCheckDetail: "" };
  if (changed) patch.lastChangedAt = now;
  await updateSource(source.id, patch);
  return { ...result, changed };
}

/** `true` si cette source est surveillée ET porte une nouveauté pas encore "vue" (lien cliqué). */
export function hasNewContent(source) {
  return !!(source.watchEnabled && source.lastChangedAt && source.lastChangedAt > (source.lastAcknowledgedAt || 0));
}

/** À appeler quand l'utilisateur clique le lien d'une source surveillée — efface le badge "🆕". */
export async function acknowledgeSource(id) {
  return storage.setFields(COLLECTION, id, { lastAcknowledgedAt: Date.now() });
}

/**
 * Liste de départ proposée à Charles-Henri, construite avec lui le 02/10/2026 (voir
 * claude/sources-veille-02-10-2026.md pour le détail et les sources écartées par prudence).
 * JAMAIS importée automatiquement — js/views/veille.js propose un bouton explicite tant qu'aucune
 * source n'existe encore, pour que Charles-Henri reste maître de ce qui entre dans sa propre
 * liste plutôt que de se retrouver avec du contenu injecté sans l'avoir demandé (même principe de
 * prudence que partout ailleurs dans l'app pour une action qui écrit plusieurs fiches d'un coup).
 */
export const STARTER_SOURCES = [
  // `watchEnabled: true` sur ces deux-là seulement (02/10/2026) : ce sont les deux sources les
  // plus "flux" sans aucun flux RSS disponible par ailleurs (voir le commentaire d'en-tête du
  // fichier) — celles où la détection de changement de page apporte le plus. `watchSelector`
  // volontairement vide au départ (repli générique) : à affiner via le bouton "🔍 Tester" de la
  // modale d'édition une fois la page réellement observée, pas deviné depuis ce fichier.
  { title: "SEMAE — réglementation semences", url: "https://www.semae.fr/reglementation-semences/", category: "reglementation", notes: "Interprofession semences (ex-GNIS) — publie directement la réglementation.", watchEnabled: true },
  { title: "UFS — À la une", url: "https://www.ufs-semenciers.org/alaune/", category: "reglementation", notes: "Union Française des Semenciers — prises de position sur les textes en cours (NGT, CIR...).", watchEnabled: true },
  { title: "Ministère de l'Agriculture — Bulletin officiel (BO Agri)", url: "https://info.agriculture.gouv.fr/gedei/site/bo-agri/", category: "reglementation", notes: "Textes réglementaires officiels, inclut des RTA semences certifiées." },
  { title: "Ministère de l'Agriculture — Les actualités", url: "https://agriculture.gouv.fr/les-actualites", category: "reglementation", notes: "Fil d'actualités générales du ministère." },
  { title: "Alim'agri — le magazine du ministère", url: "https://agriculture.gouv.fr/alimagri-le-magazine-du-ministere", category: "reglementation", notes: "Format magazine, plus digeste que le Bulletin officiel." },
  { title: "La France Agricole — semences", url: "https://www.lafranceagricole.fr/semences/", category: "reglementation", notes: "Presse spécialisée." },
  { title: "Terre-net", url: "https://www.terre-net.fr/", category: "reglementation", notes: "Presse spécialisée agricole." },
  { title: "Agro Matin", url: "https://www.agromatin.com/", category: "reglementation", notes: "Presse spécialisée, bonne couverture semences/plants." },
  { title: "SemWare (Gus³)", url: "https://www.semware.fr/", category: "concurrence", notes: "Concurrent direct, France — ERP station semences (iGus/myGus/tiGus)." },
  { title: "Mprise Agriware (Agriware 365)", url: "https://www.mprise-agriware.com/", category: "concurrence", notes: "Concurrent direct, Pays-Bas (Mprise Agriware B.V.), portée internationale." },
  { title: "ISAGRI", url: "https://www.isagri.fr/", category: "concurrence", notes: "Généraliste français du logiciel agricole — adjacent plutôt que frontal, mais à surveiller." },
  { title: "Coulisses de CEO", url: "https://www.coulissesdeceo.fr/", category: "management", notes: "Podcast — des dirigeants qui parlent de leurs vraies décisions et de leurs erreurs." },
  { title: "La Juste Performance", url: "https://podcasts.apple.com/fr/podcast/la-juste-performance/id1506461989", category: "management", notes: "Podcast — pression au travail et défis de management vus par la psychologie/neurosciences." },
  { title: "Émotions (au travail)", url: "https://louiemedia.com/emotions-au-travail/", category: "management", notes: "Podcast — intelligence émotionnelle appliquée au management d'équipe (ex-« Travail en cours »)." },
  { title: "Vlan! (série Leadership)", url: "https://podcasts.apple.com/ca/podcast/vlan/id1233992877", category: "management", notes: "Podcast — posture de leader et culture d'organisation ; lien vers le podcast Vlan! dans son ensemble, à affiner sur l'épisode/la série précise une fois écouté." },
  { title: "Skills (Nadia Marouani)", url: "https://podcasts.apple.com/us/podcast/skills/id1783580702", category: "management", notes: "Podcast — compétences transverses (communication, influence) pour la montée en responsabilité." },
];
