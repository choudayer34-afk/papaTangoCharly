// Objectifs d'une personne (§ préparation EADP, retour de Charles-Henri) : au-delà des
// engagements ponctuels (Suivi), une personne a des objectifs de campagne suivis dans le
// temps, à plusieurs reprises. Un Objectif porte ses points de suivi datés directement en
// tableau embarqué (`entries`) plutôt qu'une collection séparée — un seul objectif possède
// ses propres entrées, jamais partagées ni consultées indépendamment de lui, même principe
// que `steps` sur Projet/Réunion/Tâche.
//
// LOT 11 (TODO-024, 22/09/2026) — MODÈLE COMMUN, arbitrage explicite de Charles-Henri : il
// n'existe qu'UN SEUL modèle d'Objectif, utilisé à la fois pour "Mes objectifs" (personnel,
// `personId: null`, js/views/dashboard.js#openMyObjectivesModal) et pour les objectifs EADP
// d'un collaborateur (js/views/people.js). Aucun second modèle, aucune nouvelle collection.
// Tous les champs ajoutés par ce lot (voir `createObjective` ci-dessous) sont OPTIONNELS et
// absents/vides par défaut : un objectif personnel simple (titre + projet, comme avant ce
// lot) reste possible sans jamais avoir à renseigner la moindre dimension EADP — c'est le
// même document Firestore qui s'enrichit progressivement, jamais un formulaire imposé.
//
// Indicateurs (`indicators[]`) : éléments structurés (libellé, cible, mode de mesure, source
// de preuve, fréquence, valeur courante, statut) — voir INDICATOR_STATUSES plus bas.
// Volontairement PAS de score, de pourcentage automatique ni de moteur d'évaluation (arbitrage
// explicite de Charles-Henri) : trois statuts qualitatifs choisis à la main suffisent à rendre
// l'avancement compréhensible.
//
// Liens : arbitrage définitif de Charles-Henri (LOT 11, point 8) — un indicateur est une
// donnée structurée appartenant à l'Objectif, jamais une fiche indépendante. Le mécanisme
// "🔗 Lié" (js/components/linkedItems.js) continue donc de cibler l'Objectif dans son
// ensemble, exactement comme avant ce lot — AUCUNE extension du système de liens, aucun lien
// direct vers un indicateur. La seule référence introduite par ce lot (`entries[].ref`, voir
// `addEntry` plus bas) n'est PAS un lien au sens de `js/domain/links.js` : c'est une simple
// donnée `{type, id}` portée par le suivi lui-même, résolue en lecture seule via
// `linkedItemsApi.resolveRefDirect` (js/components/linkedItems.js, désormais exportée) pour
// l'affichage — rien n'est écrit dans la collection `links`, aucune section "🔗 Lié" n'en
// dépend.
//
// Campagne / période : arbitrage de Charles-Henri (LOT 11, "notion de campagne/période") — le
// modèle actuel (avant ce lot) n'avait AUCUN champ de période/campagne, seulement des
// commentaires de code employant le mot "campagne" au sens large. Un simple champ `period`
// (texte libre, ex. "2026-2027", optionnel) suffit à répondre au besoin exprimé (distinguer
// l'objectif de la campagne à laquelle il appartient, retrouver les objectifs d'une campagne
// précédente sans jamais les écraser puisque chaque Objectif reste son propre document) — voir
// le bilan de LOT 11 dans TODO_TECHNIQUE.md pour le détail de cette analyse et ce qui est
// volontairement écarté de ce lot (pas de véritable entité "campagne", pas de gestion de
// campagnes en cours/passées automatisée).

import * as storage from "../services/storage.js";
import { generateId } from "../services/id.js";
import * as gamification from "./gamification.js";

const COLLECTION = "objectives";

// Statuts d'un indicateur — LOT 11, TODO-024, point 3. Trois états qualitatifs seulement,
// jamais de score ni de pourcentage (arbitrage explicite de Charles-Henri). Représentation
// interne alignée sur le vocabulaire déjà utilisé ailleurs dans l'app pour des statuts très
// proches (ex. l'ancien pipeline Tâche, toujours visible dans
// js/domain/followups.js#LEGACY_STATUS_MAP) — réutilise au passage, sans aucune nouvelle règle
// CSS, les classes `.badge-todo`/`.badge-in_progress`/`.badge-done` déjà présentes dans
// styles/components.css.
export const INDICATOR_STATUSES = ["todo", "in_progress", "done"];
export const INDICATOR_STATUS_LABELS = { todo: "À démarrer", in_progress: "En cours", done: "Atteint" };

// "Individuel" / "Collectif" (LOT 11, TODO-024, point 2, volet EADP) — nommé `scope` en
// interne plutôt que `type` : `type` désigne déjà autre chose sur plusieurs autres entités de
// l'app (ex. Person.type = "manager"/"collaborator", QUALIFY_CHOICES[].type) ; un nom distinct
// évite toute ambiguïté de lecture dans le code, sans changer le sens du champ tel que décrit
// par Charles-Henri. Optionnel : `null` pour un objectif personnel qui n'a pas cette dimension.
export const SCOPES = ["individual", "collective"];
export const SCOPE_LABELS = { individual: "Individuel", collective: "Collectif" };

export async function createObjective(data) {
  const objective = await storage.put(COLLECTION, {
    // `personId` optionnel depuis le 13/09/2026 (retour de Charles-Henri : "comment je suis
    // l'avancement de mes propres objectifs" → même mécanique que pour un collaborateur, mais
    // pour soi-même) — `null` désigne un objectif personnel plutôt qu'un objectif de campagne
    // rattaché à une Personne (voir js/views/dashboard.js#openMyObjectivesModal, qui liste
    // justement les objectifs SANS personId).
    personId: data.personId || null,
    title: data.title,
    status: "active", // active | done
    entries: [],
    // Retour de Charles-Henri, 13/09/2026 : "tout élément doit être rattachable à un projet" —
    // Objectif était, avec les Informations/Idées de l'Inbox, le seul type sans aucun moyen de
    // se rattacher à un projet (Tâche/Suivi/Réunion/Décision ont un champ direct ; Ressource se
    // lie a posteriori via `projectIds` + `linkToProject()`). Optionnel, comme partout ailleurs.
    projectId: data.projectId || null,

    // --- LOT 11 (TODO-024) — tout ce qui suit est nouveau et OPTIONNEL. Un objectif créé sans
    // aucun de ces champs (ex. "Mes objectifs" dans sa forme la plus simple) obtient exactement
    // les mêmes valeurs vides qu'avant ce lot, sans aucune migration nécessaire pour les
    // documents déjà existants (relus tels quels, `undefined` traité comme absent partout où
    // ces champs sont lus — voir js/views/people.js).
    category: data.category || null,
    scope: SCOPES.includes(data.scope) ? data.scope : null,
    description: data.description || "", // intention / contexte libre
    period: data.period || null, // campagne/période libre, ex. "2026-2027"
    reviewFrequency: data.reviewFrequency || "", // fréquence de revue (EADP)
    actionPlan: data.actionPlan || "", // plan / actions (EADP)
    responsibilityLevels: data.responsibilityLevels || "", // niveaux de responsabilité (EADP)
    watchPoints: data.watchPoints || "", // points d'attention (EADP)
    // SMART (EADP) — 5 champs libres, chacun optionnel indépendamment des autres.
    smart: {
      specific: data.smart?.specific || "",
      measurable: data.smart?.measurable || "",
      achievable: data.smart?.achievable || "",
      relevant: data.smart?.relevant || "",
      timeBound: data.smart?.timeBound || "",
    },
    indicators: [], // voir addIndicator/updateIndicator/removeIndicator ci-dessous
  });
  await storage.logHistory("Objective", objective.id, "created", { title: objective.title });
  // Gamification (LOT G3, TODO_GAMIFICATION.md §5.1, famille "Management") : pas de compteur
  // persisté dédié — recordObjectiveCreated() recalcule à chaque appel, via une lecture directe
  // de la collection, le nombre de collaborateurs distincts ayant au moins un objectif
  // (personId non nul), pour éviter tout risque de désynchronisation d'un compteur maintenu à
  // la main. Aucun autre point de l'app ne modifie `personId` après création (vérifié), donc
  // aucun appel équivalent n'est nécessaire dans updateObjective() ci-dessous. Jamais bloquant
  // pour l'écriture métier ci-dessus.
  gamification.recordObjectiveCreated().catch((err) => console.error("[gamification] Échec de la mise à jour des badges (Management) :", err));
  return objective;
}

export async function updateObjective(id, patch) {
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Objectif introuvable : " + id);
    return patch;
  });
  await storage.logHistory("Objective", id, "updated", { patch });
  // Gamification (LOT G1, TODO_GAMIFICATION.md §3) : "Objectif mis à jour", 8 XP, au plus une
  // fois par jour calendaire et par Objectif (clé de dédoublonnage datée, voir
  // gamification.js#recordObjectiveUpdated) — même appel que addIndicator()/updateIndicator()
  // ci-dessous, qui partagent cette même ligne du barème (§3). Jamais bloquant pour l'écriture
  // métier ci-dessus.
  gamification.recordObjectiveUpdated(id).catch((err) => console.error("[gamification] Échec du crédit XP (Objectif mis à jour) :", err));
  return updated;
}

/**
 * Ajoute un point de suivi daté sur l'objectif — jamais un remplacement du tableau complet
 * (même principe que toggleStep sur les canevas).
 *
 * LOT 11 (TODO-024, points 5 et 7) — étendu avec 4 champs OPTIONNELS, en plus de `date`/`note`
 * déjà existants (`note` reste "qu'est-ce qui a été réalisé", son usage d'origine — jamais
 * renommé, pour ne rien casser sur les entrées déjà en base) :
 *  - `indicatorId` : quel indicateur ce suivi concerne (`null` — objectif sans indicateur, ou
 *    suivi général de l'objectif entier, ex. "Mes objectifs" simple) ;
 *  - `status` : statut de l'indicateur concerné AU MOMENT de ce suivi (voir INDICATOR_STATUSES
 *    — un instantané dans le journal, distinct du statut COURANT de l'indicateur lui-même) ;
 *  - `nextSteps` : "qu'est-ce qui est prévu avant le prochain point" (nouveau, distinct de
 *    `note`) ;
 *  - `ref` : `{type, id}` optionnel vers un élément existant servant de preuve/contexte —
 *    PAS un lien (voir le commentaire en tête de fichier), une simple donnée résolue en
 *    lecture seule par `linkedItemsApi.resolveRefForDisplay`.
 */
export async function addEntry(id, { date, note, indicatorId, status, nextSteps, ref } = {}) {
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Objectif introuvable : " + id);
    return {
      entries: [
        ...(current.entries || []),
        {
          id: generateId(),
          date: date || new Date().toISOString().slice(0, 10),
          note,
          indicatorId: indicatorId || null,
          status: INDICATOR_STATUSES.includes(status) ? status : null,
          nextSteps: nextSteps || "",
          ref: ref && ref.type && ref.id ? { type: ref.type, id: ref.id } : null,
          createdAt: Date.now(),
        },
      ],
    };
  });
  await storage.logHistory("Objective", id, "entry_added", { note });
  // Gamification (LOT G1, TODO_GAMIFICATION.md §3) : "Revue EADP ajoutée", 6 XP, une fois par
  // point de suivi (ligne du barème distincte de "Objectif mis à jour" ci-dessus — jamais
  // fusionnées). Clé de dédoublonnage sur l'id du point de suivi lui-même (généré ci-dessus,
  // toujours nouveau), donc jamais recrédité même si cette même fonction est rappelée sur le
  // même Objectif. Jamais bloquant pour l'écriture métier ci-dessus.
  const addedEntry = updated.entries[updated.entries.length - 1];
  gamification.recordObjectiveReviewAdded(addedEntry.id).catch((err) => console.error("[gamification] Échec du crédit XP (Revue EADP ajoutée) :", err));
  return updated;
}

export async function removeEntry(id, entryId) {
  return storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Objectif introuvable : " + id);
    return { entries: (current.entries || []).filter((e) => e.id !== entryId) };
  });
}

/**
 * Indicateurs de réussite (LOT 11, TODO-024, points 3 et 4) — même principe additif que les
 * `entries` ci-dessus : `addIndicator` ajoute, `updateIndicator`/`removeIndicator` retrouvent
 * l'élément par son `id` dans le tableau. Aucune nouvelle primitive `storage.js` : le motif
 * "retrouver un élément par id dans un tableau et le modifier" existe déjà tel quel
 * (`storage.update()` + `.map()`/`.filter()`), utilisé au même titre par
 * js/domain/followups.js#toggleChecklistItem — repris ici à l'identique plutôt que d'ajouter
 * une abstraction dédiée aux indicateurs.
 */
export async function addIndicator(id, { label, target, measurement, evidenceSource, frequency, currentValue } = {}) {
  const indicator = {
    id: generateId(),
    label: label || "",
    target: target || "",
    measurement: measurement || "",
    evidenceSource: evidenceSource || "",
    frequency: frequency || "",
    currentValue: currentValue || "",
    status: "todo",
    createdAt: Date.now(),
  };
  await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Objectif introuvable : " + id);
    return { indicators: [...(current.indicators || []), indicator] };
  });
  await storage.logHistory("Objective", id, "indicator_added", { label: indicator.label });
  // Gamification (LOT G1, TODO_GAMIFICATION.md §3) : "Objectif mis à jour", 8 XP, au plus une
  // fois par jour calendaire et par Objectif — voir le commentaire détaillé sur
  // updateObjective() ci-dessus.
  gamification.recordObjectiveUpdated(id).catch((err) => console.error("[gamification] Échec du crédit XP (Objectif mis à jour) :", err));
  return indicator;
}

export async function updateIndicator(id, indicatorId, patch) {
  const updated = await storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Objectif introuvable : " + id);
    return {
      indicators: (current.indicators || []).map((ind) => (ind.id === indicatorId ? { ...ind, ...patch } : ind)),
    };
  });
  await storage.logHistory("Objective", id, "indicator_updated", { indicatorId, patch });
  // Gamification (LOT G1, TODO_GAMIFICATION.md §3) : "Objectif mis à jour", 8 XP, au plus une
  // fois par jour calendaire et par Objectif — voir le commentaire détaillé sur
  // updateObjective() ci-dessus.
  gamification.recordObjectiveUpdated(id).catch((err) => console.error("[gamification] Échec du crédit XP (Objectif mis à jour) :", err));
  return updated;
}

export async function removeIndicator(id, indicatorId) {
  return storage.update(COLLECTION, id, (current) => {
    if (!current) throw new Error("Objectif introuvable : " + id);
    return { indicators: (current.indicators || []).filter((ind) => ind.id !== indicatorId) };
  });
}

export function listAll() {
  return storage.listAll(COLLECTION);
}

export function subscribe(callback) {
  return storage.subscribe(COLLECTION, callback);
}

// Ajouté le 21/09/2026 (TODO-009A, LOT 4A) : lire UN Objectif par son id, pour
// js/components/linkedItems.js#resolveRef — même besoin que tasksApi.getTask(), voir son
// commentaire.
export function getObjective(id) {
  return storage.get(COLLECTION, id);
}

export async function removeObjective(id) {
  await storage.logHistory("Objective", id, "deleted", {});
  return storage.remove(COLLECTION, id);
}

// --- Mode import depuis un texte généré par IA (22/09/2026, retour direct de Charles-Henri :
// "c'est pénible de saisir tout. mes indicateurs sont toujours structurés, il faudrait un mode
// import qui permet d'importer les indicateurs et de remplir les champs. L'indicateur actuel est
// formé par IA via le prompt suivant.") ---
//
// Charles-Henri fabrique ses objectifs avec un prompt IA (fourni intégralement) qui IMPOSE un
// format de sortie stable et toujours identique (sa section 14, "FORMAT DE SORTIE OBLIGATOIRE") :
// CATÉGORIE D'OBJECTIF, TITRE, TYPE, DESCRIPTION, SMART (S/M/A/R/T), INDICATEURS DE RÉUSSITE
// (liste numérotée, chacun avec 🎯 Cible / 📐 Mesure / 📂 Source de preuve / 🔍 Suivi et,
// optionnel, ⚠️ Point d'attention), PLAN D'ACTION, NIVEAU DE RESPONSABILITÉ, POINTS D'ATTENTION.
// C'est précisément cette stabilité de format qui rend un parseur texte réaliste : on ne cherche
// pas à comprendre du langage libre, seulement à repérer des en-têtes de section connus et à
// répartir ce qui suit chacun d'eux — Charles-Henri lui-même propose de faire évoluer son prompt
// si besoin pour faciliter l'intégration, mais ce premier parseur colle au format tel que fourni.
//
// Volontairement une fonction PURE (aucun accès storage/Firebase) : entrée = texte brut, sortie =
// objet simple. Deux conséquences volontaires :
//  1. Elle est testable directement (voir le prototype validé avant intégration) sans DOM ni
//     mock de storage — contrairement à la plupart des flux de cette app qui ne se vérifient
//     qu'en e2e.
//  2. La forme de sortie est conçue pour correspondre EXACTEMENT à celle attendue par
//     js/views/people.js#renderObjectiveDetailsFieldset (paramètre `initial`) pour les champs
//     objectif, et à celle attendue par `addIndicator()` ci-dessus pour chaque indicateur — afin
//     que l'appelant (UI) n'ait besoin d'aucune couche de correspondance supplémentaire, juste à
//     passer le résultat tel quel.
//
// Note : le modèle Indicateur (LOT 11) n'a PAS de champ "point d'attention" propre — seul
// l'Objectif porte `watchPoints` (texte libre). Les éventuels "⚠️ Point d'attention" saisis par
// indicateur dans le texte source sont donc repliés dans `watchPoints` de l'objectif, préfixés du
// libellé de l'indicateur concerné, plutôt que perdus.

function stripImportMarkdown(s) {
  return (s || "").replace(/\*\*/g, "").replace(/^#+\s*/, "").trim();
}

const IMPORT_SECTION_DEFS = [
  { key: "category", pattern: /^cat[ée]gorie\s*d[' ]?objectif\s*:?\s*(.*)$/i },
  { key: "title", pattern: /^titre\s*:?\s*(.*)$/i },
  { key: "scope", pattern: /^type\s*:?\s*(.*)$/i },
  { key: "description", pattern: /^description\s*:?\s*(.*)$/i },
  { key: "smart", pattern: /^smart\s*:?\s*(.*)$/i },
  { key: "indicators", pattern: /^indicateurs?\s+de\s+r[ée]ussite\s*:?\s*(.*)$/i },
  { key: "actionPlan", pattern: /^plan\s+d[' ]?action(\s*\/\s*modalit[ée]s?\s+de\s+r[ée]alisation)?\s*:?\s*(.*)$/i },
  { key: "responsibilityLevels", pattern: /^niveau\s+de\s+responsabilit[ée]\s*:?\s*(.*)$/i },
  { key: "watchPoints", pattern: /^points?\s+d[' ]?attention\s*:?\s*(.*)$/i },
];

function splitImportSections(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n").map((l) => stripImportMarkdown(l));
  const sections = {};
  let current = null;
  for (const line of lines) {
    let matched = null;
    for (const def of IMPORT_SECTION_DEFS) {
      const m = line.match(def.pattern);
      if (m) {
        matched = { def, m };
        break;
      }
    }
    if (matched) {
      const { def, m } = matched;
      current = def.key;
      const inlineValue = (m[m.length - 1] || "").trim();
      sections[current] = sections[current] || [];
      if (inlineValue) sections[current].push(inlineValue);
      continue;
    }
    if (current) {
      sections[current] = sections[current] || [];
      sections[current].push(line);
    }
  }
  const joined = {};
  for (const key of Object.keys(sections)) joined[key] = sections[key].join("\n").trim();
  return joined;
}

function parseImportSmartBlock(block) {
  const smart = { specific: "", measurable: "", achievable: "", relevant: "", timeBound: "" };
  if (!block) return smart;
  const markers = [
    { key: "specific", re: /^s\s*[—\-:]/i },
    { key: "measurable", re: /^m\s*[—\-:]/i },
    { key: "achievable", re: /^a\s*[—\-:]/i },
    { key: "relevant", re: /^r\s*[—\-:]/i },
    { key: "timeBound", re: /^t\s*[—\-:]/i },
  ];
  let currentKey = null;
  let buf = [];
  function flush() {
    if (currentKey) smart[currentKey] = buf.join("\n").trim();
    buf = [];
  }
  for (const rawLine of block.split("\n")) {
    const trimmed = rawLine.trim();
    const found = markers.find((mk) => mk.re.test(trimmed));
    if (found) {
      flush();
      currentKey = found.key;
      buf.push(trimmed.replace(found.re, "").replace(/^[—\-:]\s*/, "").trim());
    } else if (currentKey) {
      buf.push(trimmed);
    }
  }
  flush();
  return smart;
}

function parseImportIndicatorsBlock(block) {
  if (!block) return { indicators: [], perIndicatorWatchPoints: [] };
  const groups = [];
  let current = null;
  const numberRe = /^(\d+)[.)]\s*(.*)$/;
  for (const rawLine of block.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const m = line.match(numberRe);
    if (m) {
      current = { label: m[2].trim(), lines: [] };
      groups.push(current);
      continue;
    }
    if (current) current.lines.push(line);
  }
  const fieldDefs = [
    { key: "target", re: /(?:🎯\s*)?cible\s*:?\s*(.*)$/i },
    { key: "measurement", re: /(?:📐\s*)?mesure\s*:?\s*(.*)$/i },
    { key: "evidenceSource", re: /(?:📂\s*)?source\s+de\s+preuve\s*:?\s*(.*)$/i },
    { key: "frequency", re: /(?:🔍\s*)?suivi\s*:?\s*(.*)$/i },
    { key: "watchPoint", re: /(?:⚠️\s*)?point\s+d[' ]?attention\s*:?\s*(.*)$/i },
  ];
  const indicators = [];
  const perIndicatorWatchPoints = [];
  for (const g of groups) {
    const ind = { label: g.label, target: "", measurement: "", evidenceSource: "", frequency: "" };
    let watchPoint = "";
    for (const line of g.lines) {
      for (const fd of fieldDefs) {
        const m = line.match(fd.re);
        if (m) {
          if (fd.key === "watchPoint") watchPoint = m[1].trim();
          else ind[fd.key] = m[1].trim();
          break;
        }
      }
    }
    indicators.push(ind);
    if (watchPoint) perIndicatorWatchPoints.push(`${g.label} : ${watchPoint}`);
  }
  return { indicators, perIndicatorWatchPoints };
}

/**
 * Analyse un texte au format imposé par le prompt IA de Charles-Henri et renvoie :
 *  - `title` : à utiliser tel quel comme titre de l'objectif ;
 *  - le reste des champs (`category`, `scope`, `description`, `smart`, `actionPlan`,
 *    `responsibilityLevels`, `watchPoints`) : même forme que le paramètre `initial` de
 *    js/views/people.js#renderObjectiveDetailsFieldset, prêt à être passé tel quel ;
 *  - `indicators[]` : même forme que les arguments attendus par `addIndicator()` ci-dessus
 *    (`label`, `target`, `measurement`, `evidenceSource`, `frequency`), prêt à être bouclé.
 * Ne lit ni n'écrit rien en base — fonction pure, appelée uniquement par l'UI (voir
 * js/views/people.js#openImportObjectiveTextModal).
 */
export function parseObjectiveImportText(text) {
  const sections = splitImportSections(text || "");
  const scopeRaw = (sections.scope || "").toLowerCase();
  const scope = /individ/.test(scopeRaw) ? "individual" : /collectif/.test(scopeRaw) ? "collective" : null;
  const { indicators, perIndicatorWatchPoints } = parseImportIndicatorsBlock(sections.indicators);
  const watchPointsParts = [];
  if (sections.watchPoints) watchPointsParts.push(sections.watchPoints);
  if (perIndicatorWatchPoints.length) watchPointsParts.push(...perIndicatorWatchPoints);

  return {
    title: sections.title || "",
    category: sections.category || null,
    scope,
    description: sections.description || "",
    smart: parseImportSmartBlock(sections.smart),
    indicators,
    actionPlan: sections.actionPlan || "",
    responsibilityLevels: sections.responsibilityLevels || "",
    watchPoints: watchPointsParts.join("\n"),
  };
}
