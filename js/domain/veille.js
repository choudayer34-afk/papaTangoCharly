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

/**
 * Liste de départ proposée à Charles-Henri, construite avec lui le 02/10/2026 (voir
 * claude/sources-veille-02-10-2026.md pour le détail et les sources écartées par prudence).
 * JAMAIS importée automatiquement — js/views/veille.js propose un bouton explicite tant qu'aucune
 * source n'existe encore, pour que Charles-Henri reste maître de ce qui entre dans sa propre
 * liste plutôt que de se retrouver avec du contenu injecté sans l'avoir demandé (même principe de
 * prudence que partout ailleurs dans l'app pour une action qui écrit plusieurs fiches d'un coup).
 */
export const STARTER_SOURCES = [
  { title: "SEMAE — réglementation semences", url: "https://www.semae.fr/reglementation-semences/", category: "reglementation", notes: "Interprofession semences (ex-GNIS) — publie directement la réglementation." },
  { title: "UFS — À la une", url: "https://www.ufs-semenciers.org/alaune/", category: "reglementation", notes: "Union Française des Semenciers — prises de position sur les textes en cours (NGT, CIR...)." },
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
