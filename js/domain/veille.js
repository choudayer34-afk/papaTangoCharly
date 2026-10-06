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
import { RESEARCH_JSON_TEMPLATE } from "./veilleResearchImport.js";
import { cleanLines, packSnapshot, unpackSnapshot, diffLines, mergeAdded } from "./veilleDiff.js";

const COLLECTION = "veilleSources";

// Trois catégories actées avec Charles-Henri (02/10/2026) : réglementation et marché/concurrence
// sont du FLUX (actualité qui bouge, revue quotidienne), management/pilotage est du STOCK (contenu
// de fond, revu occasionnellement) — voir la rubrique Guide pour l'explication complète donnée à
// l'utilisateur.
export const CATEGORIES = [
  { key: "reglementation", label: "Réglementation", emoji: "⚖️" },
  { key: "concurrence", label: "Marché / concurrence", emoji: "🏢" },
  { key: "management", label: "Management / pilotage", emoji: "🧭" },
  // Raccourcis vers les outils tiers et la boîte mail (06/10/2026, demande directe de Charles-Henri :
  // "met moi en accès direct le lien vers les outils et boîte mail tiers dans la veille"). Même
  // collection que les sources — donc même fenêtre d'édition, mêmes données synchronisées entre
  // appareils — mais PAS une source à scanner : js/views/veille.js les affiche dans la zone
  // "Accès rapide" en haut de l'écran, pas dans les sections par sujet (ni dans le benchmark).
  { key: "outils", label: "Outils & boîte mail", emoji: "🔗" },
];

/** Clé de la catégorie "raccourcis" — voir le commentaire ci-dessus. */
export const TOOLS_CATEGORY_KEY = "outils";

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
    // Fiche concurrent enrichie (02/10/2026, demande directe de Charles-Henri) — seulement
    // pertinents pour category:"concurrence" (js/views/veille.js masque ces champs pour les
    // autres catégories), mais stockés sans condition ici : un simple changement de catégorie ne
    // doit pas faire disparaître une info déjà saisie. CA en texte libre (jamais un nombre strict)
    // car un chiffre d'affaires vient toujours avec un contexte (année, source) qu'il faut garder
    // à côté, pas un montant nu invérifiable plus tard.
    ca: (data.ca || "").trim(),
    linkedinUrl: (data.linkedinUrl || "").trim(),
    pappersUrl: (data.pappersUrl || "").trim(),
    // Fiche comparative "face à Agreo" (02/10/2026, même jour, suite directe de la demande
    // ci-dessus : "une étude de leur marché, un SWOT [...] pour chacun pouvoir éditer une fiche
    // qui résume ce qu'ils sont et par rapport a Agreo, la force d'Agreo et leur force a eux,
    // faiblesses"). Quatre champs texte libre plutôt qu'une structure SWOT rigide à 4 cases : le
    // contenu réel (positionnement, forces/faiblesses) ne se découpe pas toujours proprement en
    // Forces/Faiblesses/Opportunités/Menaces, et du texte libre reste éditable par Charles-Henri
    // sans contrainte de forme. `agreoStrengths` documenté comme basé sur de l'info PUBLIQUE
    // uniquement (js/views/veille.js affiche l'avertissement) — Pilotage n'a aucun accès aux
    // retours clients ou à la roadmap interne réels d'Agreo, seul Charles-Henri les connaît.
    profileSummary: (data.profileSummary || "").trim(),
    competitorStrengths: (data.competitorStrengths || "").trim(),
    competitorWeaknesses: (data.competitorWeaknesses || "").trim(),
    agreoStrengths: (data.agreoStrengths || "").trim(),
    // SWOT complet + positionnement (02/10/2026, même jour, suite directe : "ça doit être
    // réalisable dans pilote et même pour tout les nouveaux que je rajouterai" — après avoir vu
    // la page visuelle livrée à part). Deux questions posées explicitement avant de coder : (1)
    // Opportunités/Menaces en plus des 4 champs ci-dessus pour un vrai SWOT à 4 cases — retenu ;
    // (2) comment généraliser la carte de positionnement à tout concurrent futur sans points codés
    // en dur comme dans la page statique — retenu : 2 curseurs 0-10 réglés à la main par
    // Charles-Henri plutôt qu'un score calculé (aucune donnée stockée ne permettrait de calculer
    // "spécialisation" ou "visibilité de la roadmap" de façon fiable et objective — mieux vaut un
    // jugement assumé, modifiable, que d'inventer un calcul qui aurait l'air objectif sans l'être).
    opportunities: (data.opportunities || "").trim(),
    threats: (data.threats || "").trim(),
    specializationScore: clampScore(data.specializationScore, 5),
    roadmapVisibilityScore: clampScore(data.roadmapVisibilityScore, 5),
    // Horodatage dédié de la fiche (02/10/2026) — voir le commentaire détaillé dans
    // js/views/veille.js#openSourceModal (bouton "Enregistrer") pour pourquoi ce n'est PAS le
    // `updatedAt` générique de storage.js. Posé dès la création : une fiche tout juste créée est,
    // par définition, à jour au moment de sa création.
    ficheUpdatedAt: Date.now(),
  });
}

function clampScore(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(10, Math.max(0, n));
}

/**
 * Un concurrent n'a de place sur la carte de positionnement du Benchmark visuel que s'il a déjà
 * été ouvert et enregistré au moins une fois DEPUIS l'ajout des curseurs ci-dessus — avant ça, ces
 * deux champs n'existent simplement pas sur le document (jamais écrits par `createSource` avant
 * cette date). js/views/veille.js s'en sert pour séparer "positionnés" (affichés sur la carte) de
 * "non positionnés" (listés à part, avec un rappel d'aller régler leurs curseurs).
 */
export function hasPositioning(source) {
  return typeof source.specializationScore === "number" && typeof source.roadmapVisibilityScore === "number";
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
//
// RELAIS PERSONNEL EN PREMIER (06/10/2026) : les deux proxys ci-dessous ont échoué ENSEMBLE sur toutes les
// sources (délai dépassé / injoignable) lors d'une vérification réelle, la panne déjà vue le 02/10.
// Retour de Charles-Henri : "les 3 du moment que ça reste gratuit" — dont un relais à lui, la fonction
// Cloudflare Pages `functions/api/veille-proxy.js` (déployée avec le reste de l'app, gratuite dans le quota
// habituel, voir le commentaire de ce fichier pour ses garde-fous). Appelée en premier, même origine que
// l'app ; si elle échoue (pas encore déployée, site qui bloque ses adresses...), la suite reste inchangée.
// `explain: true` : son corps de réponse d'erreur est un court message lisible, repris dans le détail.
const PROXIES = [
  { name: "Pilotage", explain: true, build: (target) => "/api/veille-proxy?url=" + encodeURIComponent(target) },
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
  // Même zone, mais découpée en LIGNES (un bloc de page = une ligne) pour "voir ce qui a changé" (06/10/2026,
  // voir js/domain/veilleDiff.js). `text` ci-dessus, et donc l'empreinte, reste calculé exactement comme
  // avant : sinon toutes les sources déjà suivies afficheraient une fausse nouveauté à la prochaine vérification.
  const clone = root.cloneNode(true);
  clone.querySelectorAll("br").forEach((el) => el.replaceWith("\n"));
  // Un titre suivi de sa date (<a>…</a><span>12/10</span>) s'affiche côte à côte sans espace dans le code :
  // on en glisse un pour ne pas coller les mots ("…réglementation12/10"). Normalisé ensuite par cleanLines.
  clone.querySelectorAll("a, span, time").forEach((el) => el.append(" "));
  clone
    .querySelectorAll("p, div, li, h1, h2, h3, h4, h5, h6, tr, td, th, section, article, header, footer, ul, ol, table, dt, dd, blockquote, figure, figcaption")
    .forEach((el) => {
      el.prepend("\n");
      el.append("\n");
    });
  const lines = cleanLines((clone.textContent || "").split("\n"));
  return { text, lines, error: null };
}

/** Libellés humains des codes d'erreur renvoyés par `previewWatch()`/`checkSourceForChanges()`. */
export const WATCH_ERROR_LABELS = {
  no_url: "Aucune URL à surveiller",
  fetch_failed: "Échec de récupération (site ou proxy indisponible pour l'instant)",
  selector_not_found: "Sélecteur introuvable sur la page (le site a peut-être changé de structure)",
  empty: "Aucun contenu trouvé à cet endroit",
};

// Seuil sous lequel la zone lue est jugée trop courte pour être une liste d'actualités (06/10/2026, cas réel
// Terre-net : la page ne contenait que "⏳Chargement…", 12 caractères — ses articles sont ajoutés par
// JavaScript APRÈS le chargement, donc invisibles pour une lecture du code source brut). Une liste de
// quelques titres dépasse largement ce seuil. Sans cet avertissement, le test dit "zone trouvée" (exact mais
// trompeur) et la vérification ne signale jamais rien : l'empreinte ne bouge pas, sans la moindre erreur.
export const SHORT_ZONE_CHARS = 200;

/**
 * Récupère et analyse une page SANS rien écrire — utilisé par le bouton "🔍 Tester" de la modale
 * (contre les valeurs de champs en cours de saisie, pas encore enregistrées) et en interne par
 * `checkSourceForChanges()`. Essaie chaque proxy de `PROXIES` dans l'ordre jusqu'à ce que l'un
 * réponde — `detail` résume ce qui a été tenté (utile seulement quand `ok` est `false`).
 * @param {{url?:string, watchUrl?:string, watchSelector?:string}} fields
 * @returns {Promise<{ok:boolean, error?:string, detail?:string, text?:string, hash?:string, preview?:string}>}
 */
export async function previewWatch({ url, watchUrl, watchSelector } = {}, { onAttempt } = {}) {
  const target = (watchUrl || url || "").trim();
  if (!target) return { ok: false, error: "no_url" };

  let html = null;
  const attempts = [];
  for (const [i, proxy] of PROXIES.entries()) {
    // Permet à l'écran d'afficher "où en est" la vérification (tentative n/N) — voir `onProgress` de
    // `checkSourceForChanges()` (06/10/2026).
    onAttempt?.({ step: "fetch", attempt: i + 1, total: PROXIES.length, proxy: proxy.name });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
    try {
      const res = await fetch(proxy.build(target), { signal: controller.signal });
      if (!res.ok) {
        let why = "";
        if (proxy.explain) {
          try {
            why = (await res.text()).trim().slice(0, 120);
          } catch {
            // message d'explication facultatif
          }
        }
        attempts.push(`${proxy.name} : HTTP ${res.status}${why ? ` (${why})` : ""}`);
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

  onAttempt?.({ step: "analyse" });
  const { text, lines, error } = extractTextForWatch(html, (watchSelector || "").trim());
  if (error) return { ok: false, error };
  return { ok: true, text, lines, hash: simpleHash(text), preview: text.slice(0, 220), short: text.length < SHORT_ZONE_CHARS };
}

/**
 * Vérifie une source déjà enregistrée et persiste le résultat (empreinte, horodatage, erreur
 * éventuelle). Ne marque "🆕 nouveauté" que si une empreinte précédente existait déjà — la toute
 * première vérification établit seulement une référence, jamais un faux "du nouveau" immédiat.
 */
export async function checkSourceForChanges(source, { onProgress } = {}) {
  const result = await previewWatch(
    { url: source.url, watchUrl: source.watchUrl, watchSelector: source.watchSelector },
    { onAttempt: onProgress }
  );
  const now = Date.now();
  if (!result.ok) {
    await updateSource(source.id, { lastCheckedAt: now, lastCheckError: result.error, lastCheckDetail: result.detail || "" });
    return result;
  }
  const firstCheck = !source.lastContentHash;
  const changed = !firstCheck && result.hash !== source.lastContentHash;
  const patch = { lastContentHash: result.hash, lastCheckedAt: now, lastCheckError: "", lastCheckDetail: "" };
  if (changed) patch.lastChangedAt = now;
  // "Voir ce qui a changé" (06/10/2026, voir js/domain/veilleDiff.js) : on garde la dernière version lue (en
  // lignes) à CHAQUE vérification réussie — c'est ce qui permet, au changement suivant, de dire QUOI est
  // apparu. Une source suivie avant cette fonction n'a pas encore de version conservée : son premier
  // changement n'aura pas de détail (`hasDetail: false`), le suivant en aura un.
  const hadSnapshot = !!source.lastContentSnapshot;
  patch.lastContentSnapshot = packSnapshot(result.lines);
  let changeDetail = null;
  if (changed) {
    if (hadSnapshot) {
      const d = diffLines(unpackSnapshot(source.lastContentSnapshot), result.lines);
      // Nouveauté pas encore vue + nouveau changement : on cumule (A→B puis B→C = ce qui est apparu dans les deux).
      const unseen = hasNewContent(source) && source.lastChangeHasDetail;
      const added = unseen ? mergeAdded(unpackSnapshot(source.lastChangeAdded), d.added) : d.added;
      const removedCount = (unseen ? Number(source.lastChangeRemovedCount) || 0 : 0) + d.removedCount;
      changeDetail = { hasDetail: true, added, removedCount, at: now };
    } else {
      changeDetail = { hasDetail: false, added: [], removedCount: 0, at: now };
    }
    patch.lastChangeHasDetail = changeDetail.hasDetail;
    patch.lastChangeAdded = changeDetail.added.join("\n");
    patch.lastChangeRemovedCount = changeDetail.removedCount;
  }
  await updateSource(source.id, patch);
  // `firstCheck` : aucune empreinte précédente — cette vérification a seulement posé la référence
  // (l'écran le dit explicitement plutôt que d'afficher un "rien de nouveau" trompeur).
  return { ...result, changed, firstCheck, changeDetail };
}

/**
 * Détail du dernier changement détecté, relu depuis la fiche (voir `checkSourceForChanges`). `hasDetail`
 * est faux pour une nouveauté détectée avant que Pilotage ne conserve la version précédente de la page.
 * @returns {{hasDetail:boolean, added:string[], removedCount:number, at:number|null}}
 */
export function changeDetailOf(source) {
  return {
    hasDetail: !!source?.lastChangeHasDetail,
    added: unpackSnapshot(source?.lastChangeAdded),
    removedCount: Number(source?.lastChangeRemovedCount) || 0,
    at: source?.lastChangedAt || null,
  };
}

/** `true` si cette source est surveillée ET porte une nouveauté pas encore "vue" (lien cliqué). */
export function hasNewContent(source) {
  return !!(source.watchEnabled && source.lastChangedAt && source.lastChangedAt > (source.lastAcknowledgedAt || 0));
}

// Veille concurrentielle enrichie (02/10/2026, demande directe de Charles-Henri : "je dois
// pouvoir [...] retrouver [les concurrents] avec leur CA, évolutions, nouveautés [...] en se
// basant sur différents site linkedin, pappers, le site officiel"). Contrainte actée avec lui
// (question posée explicitement avant de coder) : Pilotage est une app 100% navigateur, sans
// serveur — elle ne peut pas interroger LinkedIn (bloque le scraping, demande une connexion) ni
// Pappers (API payante/avec clé) toute seule, contrairement aux sites officiels via `PROXIES`
// ci-dessus. Choix retenu : Pilotage reste la MÉMOIRE structurée (champs `ca`/`linkedinUrl`/
// `pappersUrl` sur la source, voir `createSource()`) ; la recherche elle-même passe par une
// conversation avec Claude, à qui Charles-Henri colle une demande préparée ici — lui-même précise
// vouloir "un prompt pour chercher et mettre à jour pilote" plutôt qu'une recherche automatique
// dans l'app (de toute façon irréalisable sans compte/clé). Les deux fonctions ci-dessous ne
// FONT pas la recherche, elles préparent seulement le texte à copier-coller — js/views/veille.js
// l'affiche dans une petite modale avec un bouton "📋 Copier".

/**
 * Texte de la demande pour mettre à jour la fiche d'UN concurrent déjà suivi (CA, actualités,
 * évolutions, et depuis le 02/10/2026 la fiche "face à Agreo" : résumé/positionnement, leurs
 * forces, leurs faiblesses, force d'Agreo face à eux). `source` peut être un brouillon non encore
 * enregistré (valeurs des champs de la modale en cours de saisie) — seuls
 * `title`/`url`/`linkedinUrl`/`pappersUrl` sont utilisés.
 *
 * Extension du 02/10/2026 (même jour, suite de l'étude de marché livrée à part) : Charles-Henri
 * demande si le remplissage des 4 champs "face à Agreo" peut être automatique ou via l'IA —
 * réponse retenue après lui avoir exposé les deux options (étendre ce bouton existant, gratuit et
 * sans changement d'architecture, VS une vraie automatisation nécessitant clé API + serveur
 * relais + coût, écartée pour l'instant comme Pappers) : "Étendre le bouton existant". La demande
 * inclut maintenant une présentation minimale d'Agreo Seeds pour que la conversation Claude dans
 * laquelle ce texte est collé — potentiellement nouvelle, sans l'historique de ce projet — ait de
 * quoi produire une vraie comparaison plutôt qu'une fiche à trous.
 *
 * Extension du 02/10/2026 (même jour, suite — SWOT complet) : ajout d'Opportunités/Menaces à la
 * demande, pour remplir les 2 nouvelles cases du SWOT à 4 cases. Les 2 curseurs de positionnement
 * (spécialisation, visibilité de la roadmap) ne sont volontairement PAS demandés ici : un jugement
 * de positionnement relatif appartient à Charles-Henri, pas à une recherche externe à reformuler
 * en chiffre.
 *
 * Extension du 02/10/2026 (même jour, suite — retour direct : "il faut [...] que le prompt renvoi
 * également les notes qu'il faut saisir") : ajout d'une demande explicite de contenu pour le champ
 * générique "Note" (mot-clé d'alerte/point de vigilance — le "Note" de la fiche existait déjà comme
 * DESTINATION dans la dernière ligne de la demande, mais rien ne demandait explicitement quoi y
 * mettre). Ajout aussi d'une demande de lien source par info, utile avec n'importe quel outil mais
 * en particulier avec Perplexity (que Charles-Henri utilise pour coller cette demande) — un outil
 * de recherche justement construit autour de la citation de ses sources, donc une demande qui tire
 * parti de ce point fort plutôt que de l'ignorer.
 *
 * Refonte du 06/10/2026 (retour direct : "la recherche sur les concurrents devrait pouvoir se faire
 * beaucoup plus facilement et de manière automatisée via les IA" — option "A. Import en 1 clic"
 * choisie via AskUserQuestion) : la demande exige désormais UNE réponse en bloc JSON au modèle de
 * js/domain/veilleResearchImport.js#RESEARCH_JSON_TEMPLATE, que js/views/veille.js (bouton
 * "📥 Remplir la fiche") lit et déverse dans TOUS les champs du formulaire d'un coup, plus
 * d'aller-retour champ par champ. Les liens sources passent dans une clé "sources" (reprise dans la
 * Note, datée du jour) au lieu d'être glissés dans le texte, et les 2 curseurs de positionnement
 * sont désormais DEMANDÉS comme estimations (ce qui contredit le paragraphe du 02/10/2026 plus haut,
 * à dessein : Charles-Henri a confirmé l'import "CA, SWOT, note, sources, scores") — ils ne sont
 * jamais que des propositions, relues et corrigeables dans le formulaire avant l'enregistrement.
 */
export function competitorResearchPrompt(source) {
  const lines = [
    `Recherche les informations suivantes sur le concurrent "${source.title || "(sans titre)"}", à partir de LinkedIn, Pappers, son site officiel et toute autre source fiable :`,
    "",
    source.url ? `- Site officiel : ${source.url}` : null,
    source.linkedinUrl ? `- LinkedIn : ${source.linkedinUrl}` : null,
    source.pappersUrl ? `- Pappers : ${source.pappersUrl}` : null,
    "",
    "Donne-moi :",
    "- Le chiffre d'affaires (CA) le plus récent trouvé, avec l'année et la source",
    "- Les actualités et évolutions récentes (produits, levées de fonds, recrutements clés, partenariats...) — si disponible, une page de changelog/actualités produit ou un canal où les clients demandent des évolutions",
    "- Toute autre info utile pour une veille concurrentielle (positionnement, effectifs, zone géographique...)",
    "- Une note courte et pratique à garder sous les yeux (mot-clé d'alerte, point de vigilance, prochaine chose à vérifier) — pas un résumé, juste de quoi me rappeler quoi surveiller la prochaine fois",
    "- Un résumé de qui ils sont et de leur positionnement marché (2-3 phrases)",
    "- Leurs forces (ce qu'ils font mieux ou différemment)",
    "- Leurs faiblesses (limites, angles morts, retours clients négatifs trouvés publiquement)",
    "- Leurs opportunités (ce qui pourrait les faire progresser sur leur marché)",
    "- Leurs menaces (ce qui pourrait les freiner ou les fragiliser, hors de leur contrôle : réglementation, consolidation du secteur, dépendance à un partenaire...)",
    "",
    "Pour le point \"leurs forces\", compare-les aussi à Agreo Seeds (éditeur SMAG, groupe InVivo) : logiciel de gestion de production de semences (planification, suivi, traçabilité champ → usine, facturation). Donne la force d'Agreo face à CE concurrent précis, en te basant uniquement sur de l'info publique sur Agreo (ne pas inventer de retours clients ou de roadmap qui ne seraient pas publics).",
    "",
    "Réponds UNIQUEMENT avec un bloc de code JSON (sans aucun texte avant ni après), exactement sur ce modèle — Pilotage le lira pour remplir la fiche automatiquement :",
    "",
    "```json",
    RESEARCH_JSON_TEMPLATE,
    "```",
    "",
    "Règles du JSON :",
    "- Chaque champ texte est une chaîne (plusieurs points = lignes commençant par \"- \", séparées par \\n). Si une info est introuvable, mets une chaîne vide : n'invente rien.",
    "- \"specialisation\" : nombre de 0 à 10 (0 = éditeur généraliste, 10 = spécialiste pur de la production de semences). \"visibilite_roadmap\" : nombre de 0 à 10 (0 = aucune visibilité publique sur leurs évolutions, 10 = feuille de route et demandes clients entièrement publiques). Ce sont des estimations que je corrigerai.",
    "- Pas de marqueurs de citation du type [1] dans les valeurs : mets les liens dans \"sources\" (un par information importante : CA, actualités, point clé), pour que je puisse vérifier et dater l'info.",
  ].filter((l) => l !== null);
  return lines.join("\n");
}

/**
 * Texte de la demande pour découvrir de NOUVEAUX concurrents par mot-clé (ceux pas encore
 * suivis). Charles-Henri choisit ensuite lui-même lesquels ajouter via "+ Source" — jamais
 * d'ajout automatique, même principe de prudence que `STARTER_SOURCES` plus bas.
 */
export function competitorDiscoveryPrompt(keywords) {
  return [
    `Cherche des concurrents ou acteurs du marché en lien avec : ${keywords}.`,
    "",
    "Pour chaque résultat trouvé, donne-moi : le nom, le site officiel, et une phrase expliquant en quoi c'est un concurrent ou un acteur pertinent à surveiller.",
    "",
    "Je choisirai ensuite moi-même lesquels ajouter à ma liste de veille concurrence dans Pilotage.",
  ].join("\n");
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

/**
 * Raccourcis proposés à l'import en un clic (06/10/2026) — des liens VERS des services, jamais d'identifiant
 * ni de mot de passe (Pilotage n'en stocke aucun : on ouvre simplement la page, la session reste celle
 * du navigateur). La boîte mail est volontairement livrée SANS lien : son adresse dépend du fournisseur
 * (Outlook, Gmail...) et Pilotage n'a pas à le deviner — un raccourci sans lien s'affiche "à renseigner"
 * et ouvre la fiche d'édition pour coller le bon lien une fois pour toutes.
 */
export const STARTER_TOOLS = [
  { title: "✉️ Boîte mail", url: "", category: TOOLS_CATEGORY_KEY, notes: "Colle ici le lien de ta messagerie (ex. https://outlook.office.com/mail/ ou https://mail.google.com/)." },
  { title: "Google Alerts", url: "https://www.google.com/alerts", category: TOOLS_CATEGORY_KEY, notes: "Créer et régler les alertes — les requêtes à recopier sont dans le bouton « 🔔 Requêtes Google Alerts »." },
  { title: "Perplexity", url: "https://www.perplexity.ai/", category: TOOLS_CATEGORY_KEY, notes: "Recherche assistée par IA (fiches concurrents)." },
  { title: "Pappers", url: "https://www.pappers.fr/", category: TOOLS_CATEGORY_KEY, notes: "Données légales et financières des entreprises." },
  { title: "LinkedIn", url: "https://www.linkedin.com/", category: TOOLS_CATEGORY_KEY, notes: "Pages entreprises des concurrents." },
];

/**
 * Requêtes à recopier dans Google Alerts (06/10/2026, "je veux bien" à la proposition d'une liste prête à
 * recopier, après la question "quels mots me conseilles-tu pour Google Alert"). Une alerte = UNE requête
 * dans le champ de Google Alerts : on les a donc stockées une par une, regroupées par rythme/réglage.
 * Texte pur (aucune action ici) : js/views/veille.js les affiche avec un bouton "copier" par ligne.
 * Tout est à ajuster après 2 semaines selon le bruit réellement observé (voir `tip` de chaque groupe).
 */
export const GOOGLE_ALERTS_SYNTAX = [
  { code: '"expression exacte"', text: "les guillemets forcent l'expression exacte" },
  { code: "OR", text: "regroupe plusieurs termes dans une seule alerte (évite d'en multiplier)" },
  { code: "-emploi -recrutement", text: "le signe moins exclut le bruit (ici les offres d'emploi)" },
  { code: "site:semae.fr", text: "limite l'alerte à un site précis" },
];

export const GOOGLE_ALERTS_GROUPS = [
  {
    key: "reglementation",
    emoji: "⚖️",
    label: "Réglementation semences",
    settings: "Fréquence : une fois par jour · Sources : automatique · Langue : français · Région : France · Quantité : uniquement les meilleurs résultats (c'est le sujet le plus bavard).",
    queries: [
      { q: '"NGT" semences OR "nouvelles techniques génomiques"' },
      { q: '"réglementation semences" France' },
      { q: '"matériel de reproduction des végétaux" OR "plant reproductive material"', note: "règlement européen sur ces matériels, qui concerne directement les semences" },
      { q: 'SEMAE réglementation OR "catalogue officiel" semences' },
      { q: '"CIR" semences traitées', note: "sigle ambigu — à garder seulement si le sujet te concerne encore" },
      { q: "FranceAgriMer déclaration semences" },
      { q: '"facturation électronique" Factur-X logiciel', note: "touche tous les éditeurs de logiciels, donc aussi la concurrence" },
    ],
  },
  {
    key: "concurrence",
    emoji: "🏢",
    label: "Concurrence",
    settings: "Fréquence : une alerte par concurrent, une fois par jour (« dès qu'il y en a » seulement si tu veux être prévenu tout de suite) · Quantité : toutes les actualités — ils publient peu, tu ne dois rien rater.",
    queries: [
      { q: '"SemWare" OR "Gus3" OR "iGus" OR "myGus"' },
      { q: '"Mprise Agriware" OR "Agriware 365"' },
      { q: "ISAGRI (rachat OR acquisition OR lancement)" },
      { q: '"ERP semences" OR "logiciel station semences" OR "traçabilité semences" logiciel', note: "repérer de nouveaux entrants ou des appels d'offres publics" },
    ],
  },
  {
    key: "produit",
    emoji: "🧭",
    label: "Toi et ton produit",
    settings: "Fréquence : une fois par jour · Quantité : toutes les actualités.",
    queries: [
      { q: '"Agreo Seeds" OR "SMAG Agreo"' },
      { q: "SMAG InVivo logiciel", note: "ce qui se dit de vous, à l'inverse de la concurrence" },
    ],
  },
];

/** Conseil de livraison valable pour toutes les alertes. */
export const GOOGLE_ALERTS_DELIVERY_TIP =
  "Dans « Afficher les options » de chaque alerte, « Livrer à » propose un flux RSS à la place de la boîte mail : plus propre si tu ne veux pas recevoir d'e-mails d'alerte. Après deux semaines, resserre les alertes bruyantes avec des signes moins.";

/**
 * Procédure Google Alerts de remplacement pour une source dont la page ne peut pas être surveillée
 * directement (zone trop courte : contenu chargé par JavaScript — voir `SHORT_ZONE_CHARS`). Une alerte
 * "site:" demande à Google de prévenir dès qu'il indexe une nouvelle page de ce site : aucune lecture de la
 * page par Pilotage, donc aucun problème de JavaScript.
 * Réglementation : requête resserrée sur les mots-clés du sujet (un site de presse publie beaucoup de
 * contenu hors sujet) ; autres catégories : toutes les nouvelles pages du site.
 * @returns {{ domain: string, query: string } | null} `null` si la source n'a pas d'adresse exploitable.
 */
export function googleAlertForSource(source) {
  let host = "";
  for (const candidate of [source?.watchUrl, source?.url]) {
    try {
      if (candidate) {
        host = new URL(candidate).hostname.replace(/^www\./i, "");
        break;
      }
    } catch {
      // adresse invalide : on essaie la suivante
    }
  }
  if (!host) return null;
  const query =
    source?.category === "reglementation"
      ? `site:${host} (semences OR "nouvelles techniques génomiques" OR NGT)`
      : `site:${host}`;
  return { domain: host, query };
}

/** Réglages à choisir dans « Afficher les options » de Google Alerts, pour une alerte `site:` (peu de résultats). */
export const GOOGLE_ALERT_SITE_SETTINGS = [
  { label: "Fréquence", value: "Une fois par jour" },
  { label: "Sources", value: "Automatique" },
  { label: "Langue", value: "Français" },
  { label: "Région", value: "France" },
  { label: "Quantité", value: "Tous les résultats (un seul site : peu de bruit, tu ne dois rien rater)" },
  { label: "Envoyer à", value: "Ton adresse e-mail (ou un flux RSS si tu préfères ne pas recevoir d'e-mail)" },
];
