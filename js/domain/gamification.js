// Gamification — LOT G1 (moteur XP), voir TODO_GAMIFICATION.md, roadmap indépendante de
// TODO_TECHNIQUE.md (24/09/2026). Ce fichier est le SEUL point d'entrée du moteur de
// gamification : les 9 fichiers de domaine qui déclenchent un gain d'XP (tasks.js,
// followups.js, projects.js, meetings.js, decisions.js, objectives.js, inbox.js, resources.js,
// prompts.js) appellent une fonction `recordXxx()` ci-dessous, jamais `awardXpOnce()`
// directement — c'est ce niveau d'indirection qui garde le barème XP (§3 de la roadmap)
// entièrement rassemblé ici plutôt qu'éclaté dans neuf fichiers.
//
// Système ACCESSOIRE (§1 de la roadmap) : il observe des écritures déjà faites par ailleurs, ne
// modifie jamais le document métier qui a déclenché le gain, et ne doit JAMAIS faire échouer
// l'action métier qui l'a appelé. Chaque appelant capture donc lui-même les erreurs de ce
// module (voir le commentaire ajouté à chaque point d'écoute) — une panne du moteur XP ne doit
// jamais empêcher de terminer une Tâche, clôturer un Projet, etc.
//
// Portée EXACTE de LOT G1 (voir TODO_GAMIFICATION.md → §11, LOT G1) : détecter les 10
// événements du barème (§3), calculer/stocker l'XP total, garantir "une action = une
// récompense" (§2.3) via un registre "déjà récompensé". Le niveau (§4), les badges (§5), les
// séries (§5.3/§6) et les déblocages ne font PAS partie de ce lot (LOT G2/G3/G5/G7) — ce fichier
// ne fait donc, pour l'instant, que créditer de l'XP brut, rien de plus.
//
// Portée EXACTE de LOT G2 (voir TODO_GAMIFICATION.md → §11, LOT G2) : dériver le NIVEAU courant
// depuis l'XP total (§4) et exposer un indicateur de progression vers le niveau suivant — voir
// la section "Niveaux (LOT G2)" en bas de ce fichier. Fonctions PURES uniquement (aucune lecture
// ni écriture Firestore, testables sans émulateur) : le niveau n'est **jamais stocké** (§10,
// décision actée le 24/09/2026 — "le niveau est toujours calculé à partir de l'XP") pour éviter
// toute incohérence entre un niveau figé et l'XP réel. Les badges (§5), séries (§5.3) et
// déblocages (§6) restent hors de ce lot (LOT G3/G5/G7).
//
// Portée EXACTE de LOT G3 (voir TODO_GAMIFICATION.md → §11, LOT G3) : détecter et attribuer les
// badges permanents du catalogue complet (§5.1) et créditer leur bonus XP de rareté (§2.3) — voir
// la section "Badges permanents (LOT G3)" plus bas. **12 des 14 familles sont actives dans ce
// lot** (60 des 70 badges) ; les 2 restantes (Régularité, Documentation) sont VOLONTAIREMENT
// différées — arbitrage explicite avec Charles-Henri le 25/09/2026 (AskUserQuestion), voir le
// commentaire détaillé sur `BADGES` ci-dessous et le bilan de LOT G3. Les séries (§5.3) et
// déblocages (§6) restent hors de ce lot (LOT G5/G7).

import * as storage from "../services/storage.js";

const COLLECTION = "gamification";
const DOC_ID = "state";

function withDefaults(raw) {
  return {
    id: DOC_ID,
    xpTotal: 0,
    // Registre "déjà récompensé" (§2.3, §10 point 5 de la roadmap) : une entrée par
    // événement déjà crédité, clé = `${type-évènement}:${entité ou entité+jour}`. Jamais
    // recalculé à la volée depuis l'état courant des entités métier (impossible de distinguer
    // une première clôture d'une réouverture/re-clôture autrement) — voir `awardXpOnce()`.
    // Réutilisé tel quel par LOT G3 (badges, ci-dessous) : à la fois pour compter certains
    // événements (clé `${famille}:${id}`, ex. `lien-cree:${linkId}`, sans bonus XP associé — voir
    // `marquerEvenementCompte()`) et pour dédupliquer l'attribution de chaque badge (clé
    // `badge:${badgeId}`, voir `awardBadgeOnce()`).
    rewardedKeys: {},
    // Badges obtenus (§10 point 2 de la roadmap, LOT G3) : `{ [badgeId]: dateObtentionMs }`,
    // jamais recalculée après coup — un badge une fois obtenu reste acquis en permanence (§5.1,
    // "les badges permanents ne se réinitialisent jamais").
    badgesObtained: {},
    ...raw,
  };
}

export async function getGamificationState() {
  const current = await storage.get(COLLECTION, DOC_ID);
  return withDefaults(current);
}

/** Date locale du jour, au format "YYYY-MM-DD" (§2.2 de la roadmap : toujours la date locale de
 *  l'utilisateur, jamais `toISOString()` qui repasse en UTC — même précaution que
 *  js/services/dateUtils.js#addDaysToIsoDate, reprise ici à l'identique plutôt que dupliquée
 *  différemment). Fonction privée : dateUtils.js n'est pas un fichier concerné par LOT G1,
 *  cette clé de journée ne sert qu'au throttle de l'événement "Objectif mis à jour" ci-dessous. */
function localDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Crédite `xp` points pour la clé `key`, UNE SEULE FOIS (§2.3) : si cette clé a déjà été
 * récompensée, ne fait rien (idempotent, aucune écriture). Passe par `storage.update()`
 * (sérialisé par document, voir storage.js) : deux appels concurrents pour la MÊME clé ne
 * peuvent donc jamais créditer l'XP deux fois, y compris si l'événement déclencheur se produit
 * deux fois de suite très rapidement (ex. double clic).
 */
async function awardXpOnce(key, xp) {
  return storage.update(COLLECTION, DOC_ID, (raw) => {
    const current = withDefaults(raw);
    if (current.rewardedKeys[key]) return undefined; // déjà récompensé — aucune écriture
    return {
      xpTotal: (current.xpTotal || 0) + xp,
      rewardedKeys: { ...current.rewardedKeys, [key]: true },
    };
  });
}

// --- Moteur de badges (LOT G3, §5.1) — helpers utilisés par le barème XP ci-dessous ET par les
// trois nouveaux points d'écoute (liens, post-it, objectifs) plus bas dans ce fichier. Le
// catalogue `BADGES` lui-même est défini après le barème XP (voir plus bas) pour ne pas séparer
// les fonctions `recordXxx()` de LOT G1 de leur documentation existante. ------------------------

/**
 * Compte les entrées du registre "déjà récompensé" (§10 point 5) dont la clé commence par
 * `prefixe` — réutilise TEL QUEL le registre déjà maintenu par LOT G1 pour les familles de
 * badges directement adossées à une ligne du barème XP (§3), plutôt que de maintenir un second
 * compteur qui pourrait diverger : la garantie "une action = une récompense" (§2.3) fait que
 * chaque clé correspond exactement à UNE occurrence de l'événement, donc au nombre d'occurrences
 * déjà comptées ci-dessous.
 */
function compterParPrefixe(state, prefixe) {
  return Object.keys(state.rewardedKeys).filter((k) => k.startsWith(prefixe)).length;
}

/**
 * Enregistre qu'un événement compté a eu lieu UNE FOIS pour l'identifiant donné, SANS créditer
 * d'XP de base (§3) — même registre "déjà récompensé" que `awardXpOnce`, réutilisé ici pour les
 * familles de badges dont l'action source n'était pas déjà observée par LOT G1 (Collaboration,
 * Organisation, ci-dessous). Idempotent comme `awardXpOnce` : un second appel pour la même clé
 * ne fait rien.
 */
async function marquerEvenementCompte(key) {
  return storage.update(COLLECTION, DOC_ID, (raw) => {
    const current = withDefaults(raw);
    if (current.rewardedKeys[key]) return undefined;
    return { rewardedKeys: { ...current.rewardedKeys, [key]: true } };
  });
}

/**
 * Crédite le bonus XP d'un badge et l'enregistre comme obtenu, UNE SEULE FOIS (§2.3) — même
 * garantie et même primitive sérialisée que `awardXpOnce`, mais écrit aussi `badgesObtained`
 * (§10 point 2 : date d'obtention, jamais recalculée après coup).
 */
async function awardBadgeOnce(badgeId, xp) {
  const key = `badge:${badgeId}`;
  return storage.update(COLLECTION, DOC_ID, (raw) => {
    const current = withDefaults(raw);
    if (current.rewardedKeys[key]) return undefined;
    return {
      xpTotal: (current.xpTotal || 0) + xp,
      rewardedKeys: { ...current.rewardedKeys, [key]: true },
      badgesObtained: { ...current.badgesObtained, [badgeId]: Date.now() },
    };
  });
}

/**
 * Détecte et attribue tous les badges non encore obtenus d'une famille dont le seuil est déjà
 * atteint par `valeurCourante` — jamais un seul badge à la fois : si plusieurs seuils sont
 * franchis d'un coup (rattrapage), tous sont attribués dans le même appel plutôt que d'attendre
 * un futur événement qui ne se reproduira pas forcément.
 *
 * Re-déclenche ensuite la famille "expert" (XP total, §5.1) si au moins un badge a été crédité :
 * chaque bonus de badge s'ajoute au total et peut lui-même faire franchir un seuil Expert (§5.1,
 * clause explicite sur la dépendance circulaire XP ↔ Expert — "chaque bonus XP de badge s'ajoute
 * normalement au total avant recalcul du prochain seuil Expert"). Jamais de récursion au-delà de
 * ce second niveau (`familleId !== "expert"` ci-dessous) : les 5 seuils Expert (§5.1) sont
 * espacés d'au moins 1 500 XP, alors que le plus gros bonus de badge est de 250 XP (Légendaire) —
 * un badge Expert ne peut donc jamais, à lui seul, faire franchir un second seuil Expert dans le
 * même appel ; la boucle ci-dessous couvre de toute façon plusieurs seuils Expert en un seul
 * passage si `valeurCourante` (relu juste avant l'appel récursif) les a déjà tous franchis.
 *
 * N'évalue QUE les familles pour lesquelles un appelant fournit une `valeurCourante` — Régularité
 * et Documentation ne sont jamais passées ici dans ce lot (voir le commentaire sur `BADGES`).
 */
async function evaluerFamille(familleId, valeurCourante) {
  const badgesFamille = BADGES.filter((b) => b.famille === familleId);
  let creditAccorde = false;
  for (const badge of badgesFamille) {
    const state = await getGamificationState();
    if (state.rewardedKeys[`badge:${badge.id}`]) continue;
    if (valeurCourante >= badge.seuil) {
      await awardBadgeOnce(badge.id, badge.xp);
      creditAccorde = true;
    }
  }
  if (creditAccorde && familleId !== "expert") {
    const state = await getGamificationState();
    await evaluerFamille("expert", state.xpTotal);
  }
}

// --- Barème XP (§3 de la roadmap) — une fonction par ligne du tableau, montants et clés de
// dédoublonnage figés ici, jamais recalculés ni redéfinis par un appelant. ------------------

/** Tâche terminée — 10 XP, une fois par Tâche (première transition vers "done" seulement,
 *  voir js/domain/tasks.js#updateTask). LOT G3 : alimente aussi la famille de badges
 *  Productivité (§5.1), sur la base du même registre (voir `compterParPrefixe`). */
export async function recordTaskCompleted(taskId) {
  await awardXpOnce(`tache-terminee:${taskId}`, 10);
  const state = await getGamificationState();
  await evaluerFamille("productivite", compterParPrefixe(state, "tache-terminee:"));
}

/** Suivi terminé — 8 XP, une fois par Suivi (voir js/domain/followups.js#updateFollowUp). */
export async function recordFollowUpCompleted(followUpId) {
  return awardXpOnce(`suivi-termine:${followUpId}`, 8);
}

/** Projet clôturé — 40 XP, une fois par Projet (voir js/domain/projects.js#closeProject).
 *  LOT G3 : alimente aussi la famille de badges Delivery (§5.1). */
export async function recordProjectClosed(projectId) {
  await awardXpOnce(`projet-cloture:${projectId}`, 40);
  const state = await getGamificationState();
  await evaluerFamille("delivery", compterParPrefixe(state, "projet-cloture:"));
}

/** Réunion créée — 5 XP, une fois par Réunion (voir js/domain/meetings.js#createMeeting).
 *  LOT G3 : alimente aussi la famille de badges Réunions (§5.1). */
export async function recordMeetingCreated(meetingId) {
  await awardXpOnce(`reunion-creee:${meetingId}`, 5);
  const state = await getGamificationState();
  await evaluerFamille("reunions", compterParPrefixe(state, "reunion-creee:"));
}

/** Décision créée — 6 XP, une fois par Décision (voir js/domain/decisions.js#createDecision).
 *  LOT G3 : alimente aussi la famille de badges Décisions (§5.1). */
export async function recordDecisionCreated(decisionId) {
  await awardXpOnce(`decision-creee:${decisionId}`, 6);
  const state = await getGamificationState();
  await evaluerFamille("decisions", compterParPrefixe(state, "decision-creee:"));
}

/**
 * Objectif mis à jour — 8 XP, **au plus une fois par jour calendaire et par Objectif** (§3,
 * clause explicite de cette ligne du barème — seule exception à "une fois pour toujours" parmi
 * les 10 actions). Appelée à l'identique par js/domain/objectives.js#updateObjective,
 * #addIndicator et #updateIndicator (les trois fonctions citées par cette ligne du barème) : la
 * clé de dédoublonnage inclut la date locale du jour (§2.2) plutôt que d'être fixe pour
 * l'Objectif, ce qui permet au gain de se reproduire le lendemain sans jamais dépasser une fois
 * par jour.
 */
export async function recordObjectiveUpdated(objectiveId) {
  return awardXpOnce(`objectif-maj:${objectiveId}:${localDateKey()}`, 8);
}

/** Revue EADP ajoutée — 6 XP, une fois par point de suivi ajouté (`entry.id`, généré à chaque
 *  appel — voir js/domain/objectives.js#addEntry). Distincte de `recordObjectiveUpdated`
 *  ci-dessus : ce sont deux lignes différentes du barème (§3), jamais fusionnées.
 *  LOT G3 : alimente aussi la famille de badges Objectifs (§5.1, revues EADP, à ne pas confondre
 *  avec "Objectif mis à jour" ci-dessus qui ne fait partie d'aucune famille de badges). */
export async function recordObjectiveReviewAdded(entryId) {
  await awardXpOnce(`revue-eadp:${entryId}`, 6);
  const state = await getGamificationState();
  await evaluerFamille("objectifs", compterParPrefixe(state, "revue-eadp:"));
}

/** Inbox qualifiée — 4 XP, une fois par item, quel que soit le type de qualification choisi (y
 *  compris "Archiver", voir §3 et js/domain/inbox.js#qualify). LOT G3 : alimente aussi la
 *  famille de badges Inbox (§5.1). */
export async function recordInboxItemQualified(itemId) {
  await awardXpOnce(`inbox-qualifiee:${itemId}`, 4);
  const state = await getGamificationState();
  await evaluerFamille("inbox", compterParPrefixe(state, "inbox-qualifiee:"));
}

/** Ressource créée — 3 XP, une fois par Ressource (voir js/domain/resources.js#createResource).
 *  LOT G3 : alimente aussi la famille de badges Ressources (§5.1). */
export async function recordResourceCreated(resourceId) {
  await awardXpOnce(`ressource-creee:${resourceId}`, 3);
  const state = await getGamificationState();
  await evaluerFamille("ressources", compterParPrefixe(state, "ressource-creee:"));
}

/** Prompt créé — 3 XP, une fois par Prompt (voir js/domain/prompts.js#createPrompt).
 *  LOT G3 : alimente aussi la famille de badges Prompts (§5.1). */
export async function recordPromptCreated(promptId) {
  await awardXpOnce(`prompt-cree:${promptId}`, 3);
  const state = await getGamificationState();
  await evaluerFamille("prompts", compterParPrefixe(state, "prompt-cree:"));
}

// --- Badges permanents (LOT G3, §5.1) — catalogue COMPLET, transcrit tel quel depuis le tableau
// figé de la roadmap (décision actée le 24/09/2026, "créer le catalogue complet, ne pas se
// limiter aux exemples"). Les 7 champs du §5.1 (id, nom, description, rareté, illustration,
// condition, xp) sont présents pour les 70 badges. Deux champs INTERNES, hors des "7 champs
// exactement" du §5.1 (qui décrivent le modèle d'AFFICHAGE, LOT G6) sont ajoutés pour rendre la
// condition réellement vérifiable par du code plutôt que par une phrase libre : `famille`
// (identifiant technique de la métrique comptée, table du §5.1) et `seuil` (valeur numérique
// extraite de `condition`, toujours écrite juste à côté du texte pour qu'un écart entre les deux
// saute aux yeux à la relecture).
//
// ARBITRAGE (AskUserQuestion, 25/09/2026) : 2 des 14 familles sont VOLONTAIREMENT SANS
// DÉTECTION dans ce lot — leurs 10 badges restent présents ci-dessous (catalogue "complet" au
// sens du §5.1) mais AUCUN appel à `evaluerFamille()` ne leur est jamais fait dans ce fichier ;
// ils ne seront donc jamais attribués tant que le point correspondant n'est pas résolu :
//  - **Régularité** (`regularite`) — dépend du record personnel de la Série Pilotage (§5.3), qui
//    n'existe pas : le moteur de séries (jours ouvrés consécutifs, cassure, record) est LOT G5,
//    pas commencé, alors que LOT G3 ne liste que LOT G1 comme dépendance (incohérence de la
//    roadmap signalée à Charles-Henri avant tout développement — voir le bilan de ce lot).
//  - **Documentation** (`documentation`) — compte des "Modèles créés", une action qui n'existe
//    dans AUCUN écran de l'app actuelle : `js/domain/templates.js` ne contient que 4 canevas
//    FIXES et codés en dur (Réunion/Suivi/Projet/Communication), et documente lui-même qu'aucun
//    éditeur de canevas personnalisé n'existe ("ces modèles sont fixes pour l'instant").
const BADGES = [
  // Productivité — Tâches terminées (cumul), js/domain/tasks.js#updateTask.
  { id: "productivite-1-tache", nom: "Premier pas", description: "Termine ta toute première Tâche.", rarete: "bronze", famille: "productivite", seuil: 1, illustration: "Coche stylisée — traitement Bronze (§8)", condition: "1 Tâche terminée (cumul)", xp: 5 },
  { id: "productivite-25-taches", nom: "Sur sa lancée", description: "Termine 25 Tâches.", rarete: "argent", famille: "productivite", seuil: 25, illustration: "Coche stylisée — traitement Argent (§8)", condition: "25 Tâches terminées (cumul)", xp: 15 },
  { id: "productivite-100-taches", nom: "Centurion", description: "Termine 100 Tâches.", rarete: "or", famille: "productivite", seuil: 100, illustration: "Coche stylisée — traitement Or (§8)", condition: "100 Tâches terminées (cumul)", xp: 40 },
  { id: "productivite-250-taches", nom: "Infatigable", description: "Termine 250 Tâches.", rarete: "platine", famille: "productivite", seuil: 250, illustration: "Coche stylisée — traitement Platine (§8)", condition: "250 Tâches terminées (cumul)", xp: 100 },
  { id: "productivite-500-taches", nom: "Marathonien", description: "Termine 500 Tâches.", rarete: "legendaire", famille: "productivite", seuil: 500, illustration: "Coche stylisée — traitement Légendaire (§8)", condition: "500 Tâches terminées (cumul)", xp: 250 },

  // Delivery — Projets clôturés (cumul), js/domain/projects.js#closeProject.
  { id: "delivery-1-projet", nom: "Premier livré", description: "Clôture ton premier Projet.", rarete: "bronze", famille: "delivery", seuil: 1, illustration: "Colis/fusée livré — traitement Bronze (§8)", condition: "1 Projet clôturé (cumul)", xp: 5 },
  { id: "delivery-5-projets", nom: "Livreur", description: "Clôture 5 Projets.", rarete: "argent", famille: "delivery", seuil: 5, illustration: "Colis/fusée livré — traitement Argent (§8)", condition: "5 Projets clôturés (cumul)", xp: 15 },
  { id: "delivery-15-projets", nom: "Grand livreur", description: "Clôture 15 Projets.", rarete: "or", famille: "delivery", seuil: 15, illustration: "Colis/fusée livré — traitement Or (§8)", condition: "15 Projets clôturés (cumul)", xp: 40 },
  { id: "delivery-30-projets", nom: "Maître d'œuvre", description: "Clôture 30 Projets.", rarete: "platine", famille: "delivery", seuil: 30, illustration: "Colis/fusée livré — traitement Platine (§8)", condition: "30 Projets clôturés (cumul)", xp: 100 },
  { id: "delivery-60-projets", nom: "Bâtisseur", description: "Clôture 60 Projets.", rarete: "legendaire", famille: "delivery", seuil: 60, illustration: "Colis/fusée livré — traitement Légendaire (§8)", condition: "60 Projets clôturés (cumul)", xp: 250 },

  // Collaboration — liens « 🔗 Lié » créés (cumul), js/domain/links.js#createLink.
  { id: "collaboration-1-lien", nom: "Premier lien", description: "Relie deux éléments entre eux pour la première fois.", rarete: "bronze", famille: "collaboration", seuil: 1, illustration: "Deux maillons de chaîne entrelacés — traitement Bronze (§8)", condition: "1 lien créé (cumul)", xp: 5 },
  { id: "collaboration-25-liens", nom: "Fil rouge", description: "Crée 25 liens entre éléments.", rarete: "argent", famille: "collaboration", seuil: 25, illustration: "Deux maillons de chaîne entrelacés — traitement Argent (§8)", condition: "25 liens créés (cumul)", xp: 15 },
  { id: "collaboration-75-liens", nom: "Tisserand", description: "Crée 75 liens entre éléments.", rarete: "or", famille: "collaboration", seuil: 75, illustration: "Deux maillons de chaîne entrelacés — traitement Or (§8)", condition: "75 liens créés (cumul)", xp: 40 },
  { id: "collaboration-150-liens", nom: "Réseau dense", description: "Crée 150 liens entre éléments.", rarete: "platine", famille: "collaboration", seuil: 150, illustration: "Deux maillons de chaîne entrelacés — traitement Platine (§8)", condition: "150 liens créés (cumul)", xp: 100 },
  { id: "collaboration-300-liens", nom: "Architecte du lien", description: "Crée 300 liens entre éléments.", rarete: "legendaire", famille: "collaboration", seuil: 300, illustration: "Deux maillons de chaîne entrelacés — traitement Légendaire (§8)", condition: "300 liens créés (cumul)", xp: 250 },

  // Management — collaborateurs distincts suivis via un Objectif EADP dédié (personId non nul).
  { id: "management-1-collaborateur", nom: "Manager Bronze", description: "Ouvre le premier Objectif EADP d'un collaborateur.", rarete: "bronze", famille: "management", seuil: 1, illustration: "Silhouette encadrée d'un halo de mentorat — traitement Bronze (§8)", condition: "1 collaborateur distinct suivi (personId non nul)", xp: 5 },
  { id: "management-3-collaborateurs", nom: "Manager Argent", description: "Suis 3 collaborateurs distincts.", rarete: "argent", famille: "management", seuil: 3, illustration: "Silhouette encadrée d'un halo de mentorat — traitement Argent (§8)", condition: "3 collaborateurs distincts suivis", xp: 15 },
  { id: "management-6-collaborateurs", nom: "Manager Or", description: "Suis 6 collaborateurs distincts.", rarete: "or", famille: "management", seuil: 6, illustration: "Silhouette encadrée d'un halo de mentorat — traitement Or (§8)", condition: "6 collaborateurs distincts suivis", xp: 40 },
  { id: "management-10-collaborateurs", nom: "Manager Platine", description: "Suis 10 collaborateurs distincts.", rarete: "platine", famille: "management", seuil: 10, illustration: "Silhouette encadrée d'un halo de mentorat — traitement Platine (§8)", condition: "10 collaborateurs distincts suivis", xp: 100 },
  { id: "management-15-collaborateurs", nom: "Manager Légendaire", description: "Suis 15 collaborateurs distincts.", rarete: "legendaire", famille: "management", seuil: 15, illustration: "Silhouette encadrée d'un halo de mentorat — traitement Légendaire (§8)", condition: "15 collaborateurs distincts suivis", xp: 250 },

  // Objectifs — revues EADP ajoutées (cumul, tous objectifs confondus), js/domain/objectives.js#addEntry.
  { id: "objectifs-1-revue", nom: "Premier bilan", description: "Ajoute ta première revue EADP.", rarete: "bronze", famille: "objectifs", seuil: 1, illustration: "Cible avec flèche plantée au centre — traitement Bronze (§8)", condition: "1 revue EADP ajoutée (cumul)", xp: 5 },
  { id: "objectifs-10-revues", nom: "Suivi régulier", description: "Ajoute 10 revues EADP.", rarete: "argent", famille: "objectifs", seuil: 10, illustration: "Cible avec flèche plantée au centre — traitement Argent (§8)", condition: "10 revues EADP ajoutées (cumul)", xp: 15 },
  { id: "objectifs-25-revues", nom: "Suivi assidu", description: "Ajoute 25 revues EADP.", rarete: "or", famille: "objectifs", seuil: 25, illustration: "Cible avec flèche plantée au centre — traitement Or (§8)", condition: "25 revues EADP ajoutées (cumul)", xp: 40 },
  { id: "objectifs-50-revues", nom: "Pilote EADP", description: "Ajoute 50 revues EADP.", rarete: "platine", famille: "objectifs", seuil: 50, illustration: "Cible avec flèche plantée au centre — traitement Platine (§8)", condition: "50 revues EADP ajoutées (cumul)", xp: 100 },
  { id: "objectifs-100-revues", nom: "Stratège", description: "Ajoute 100 revues EADP.", rarete: "legendaire", famille: "objectifs", seuil: 100, illustration: "Cible avec flèche plantée au centre — traitement Légendaire (§8)", condition: "100 revues EADP ajoutées (cumul)", xp: 250 },

  // Documentation — Modèles/Templates créés (cumul). BLOQUÉ dans ce lot (voir le commentaire
  // ci-dessus) : `famille: "documentation"` n'est jamais passé à `evaluerFamille()`.
  { id: "documentation-1-modele", nom: "Premier modèle", description: "Crée ton premier Modèle.", rarete: "bronze", famille: "documentation", seuil: 1, illustration: "Livre ouvert stylisé — traitement Bronze (§8)", condition: "1 Modèle créé (cumul)", xp: 5 },
  { id: "documentation-10-modeles", nom: "Rédacteur", description: "Crée 10 Modèles.", rarete: "argent", famille: "documentation", seuil: 10, illustration: "Livre ouvert stylisé — traitement Argent (§8)", condition: "10 Modèles créés (cumul)", xp: 15 },
  { id: "documentation-25-modeles", nom: "Documentaliste", description: "Crée 25 Modèles.", rarete: "or", famille: "documentation", seuil: 25, illustration: "Livre ouvert stylisé — traitement Or (§8)", condition: "25 Modèles créés (cumul)", xp: 40 },
  { id: "documentation-50-modeles", nom: "Archiviste en chef", description: "Crée 50 Modèles.", rarete: "platine", famille: "documentation", seuil: 50, illustration: "Livre ouvert stylisé — traitement Platine (§8)", condition: "50 Modèles créés (cumul)", xp: 100 },
  { id: "documentation-100-modeles", nom: "Encyclopédiste", description: "Crée 100 Modèles.", rarete: "legendaire", famille: "documentation", seuil: 100, illustration: "Livre ouvert stylisé — traitement Légendaire (§8)", condition: "100 Modèles créés (cumul)", xp: 250 },

  // Organisation — post-it créés sur « Mon bureau » (cumul), js/domain/stickyNotes.js#createStickyNote.
  { id: "organisation-1-postit", nom: "Premier post-it", description: "Crée ton premier post-it sur « Mon bureau ».", rarete: "bronze", famille: "organisation", seuil: 1, illustration: "Post-it stylisé aux coins pliés — traitement Bronze (§8)", condition: "1 post-it créé (cumul)", xp: 5 },
  { id: "organisation-25-postits", nom: "Bureau bien tenu", description: "Crée 25 post-it.", rarete: "argent", famille: "organisation", seuil: 25, illustration: "Post-it stylisé aux coins pliés — traitement Argent (§8)", condition: "25 post-it créés (cumul)", xp: 15 },
  { id: "organisation-75-postits", nom: "Maître du bureau", description: "Crée 75 post-it.", rarete: "or", famille: "organisation", seuil: 75, illustration: "Post-it stylisé aux coins pliés — traitement Or (§8)", condition: "75 post-it créés (cumul)", xp: 40 },
  { id: "organisation-150-postits", nom: "Architecte mental", description: "Crée 150 post-it.", rarete: "platine", famille: "organisation", seuil: 150, illustration: "Post-it stylisé aux coins pliés — traitement Platine (§8)", condition: "150 post-it créés (cumul)", xp: 100 },
  { id: "organisation-300-postits", nom: "Cartographe", description: "Crée 300 post-it.", rarete: "legendaire", famille: "organisation", seuil: 300, illustration: "Post-it stylisé aux coins pliés — traitement Légendaire (§8)", condition: "300 post-it créés (cumul)", xp: 250 },

  // Décisions — Décisions créées (cumul), js/domain/decisions.js#createDecision.
  { id: "decisions-1-decision", nom: "Premier arbitrage", description: "Crée ta première Décision.", rarete: "bronze", famille: "decisions", seuil: 1, illustration: "Balance stylisée — traitement Bronze (§8)", condition: "1 Décision créée (cumul)", xp: 5 },
  { id: "decisions-10-decisions", nom: "Décideur", description: "Crée 10 Décisions.", rarete: "argent", famille: "decisions", seuil: 10, illustration: "Balance stylisée — traitement Argent (§8)", condition: "10 Décisions créées (cumul)", xp: 15 },
  { id: "decisions-25-decisions", nom: "Trancheur", description: "Crée 25 Décisions.", rarete: "or", famille: "decisions", seuil: 25, illustration: "Balance stylisée — traitement Or (§8)", condition: "25 Décisions créées (cumul)", xp: 40 },
  { id: "decisions-50-decisions", nom: "Voix qui compte", description: "Crée 50 Décisions.", rarete: "platine", famille: "decisions", seuil: 50, illustration: "Balance stylisée — traitement Platine (§8)", condition: "50 Décisions créées (cumul)", xp: 100 },
  { id: "decisions-100-decisions", nom: "Décideur légendaire", description: "Crée 100 Décisions.", rarete: "legendaire", famille: "decisions", seuil: 100, illustration: "Balance stylisée — traitement Légendaire (§8)", condition: "100 Décisions créées (cumul)", xp: 250 },

  // Réunions — Réunions créées (cumul), js/domain/meetings.js#createMeeting.
  { id: "reunions-1-reunion", nom: "Premier ordre du jour", description: "Crée ta première Réunion.", rarete: "bronze", famille: "reunions", seuil: 1, illustration: "Table ronde vue de dessus, entourée de points — traitement Bronze (§8)", condition: "1 Réunion créée (cumul)", xp: 5 },
  { id: "reunions-25-reunions", nom: "Animateur", description: "Crée 25 Réunions.", rarete: "argent", famille: "reunions", seuil: 25, illustration: "Table ronde vue de dessus, entourée de points — traitement Argent (§8)", condition: "25 Réunions créées (cumul)", xp: 15 },
  { id: "reunions-60-reunions", nom: "Facilitateur", description: "Crée 60 Réunions.", rarete: "or", famille: "reunions", seuil: 60, illustration: "Table ronde vue de dessus, entourée de points — traitement Or (§8)", condition: "60 Réunions créées (cumul)", xp: 40 },
  { id: "reunions-120-reunions", nom: "Chef d'orchestre", description: "Crée 120 Réunions.", rarete: "platine", famille: "reunions", seuil: 120, illustration: "Table ronde vue de dessus, entourée de points — traitement Platine (§8)", condition: "120 Réunions créées (cumul)", xp: 100 },
  { id: "reunions-250-reunions", nom: "Maître de cérémonie", description: "Crée 250 Réunions.", rarete: "legendaire", famille: "reunions", seuil: 250, illustration: "Table ronde vue de dessus, entourée de points — traitement Légendaire (§8)", condition: "250 Réunions créées (cumul)", xp: 250 },

  // Inbox — items Inbox qualifiés (cumul, tout type de qualification confondu), js/domain/inbox.js#qualify.
  { id: "inbox-1-qualification", nom: "Premier tri", description: "Qualifie ton premier item Inbox.", rarete: "bronze", famille: "inbox", seuil: 1, illustration: "Plateau de tri, flèche descendante — traitement Bronze (§8)", condition: "1 item qualifié (cumul)", xp: 5 },
  { id: "inbox-50-qualifications", nom: "Trieur", description: "Qualifie 50 items Inbox.", rarete: "argent", famille: "inbox", seuil: 50, illustration: "Plateau de tri, flèche descendante — traitement Argent (§8)", condition: "50 items qualifiés (cumul)", xp: 15 },
  { id: "inbox-150-qualifications", nom: "Boîte maîtrisée", description: "Qualifie 150 items Inbox.", rarete: "or", famille: "inbox", seuil: 150, illustration: "Plateau de tri, flèche descendante — traitement Or (§8)", condition: "150 items qualifiés (cumul)", xp: 40 },
  { id: "inbox-300-qualifications", nom: "Filtre à toute épreuve", description: "Qualifie 300 items Inbox.", rarete: "platine", famille: "inbox", seuil: 300, illustration: "Plateau de tri, flèche descendante — traitement Platine (§8)", condition: "300 items qualifiés (cumul)", xp: 100 },
  { id: "inbox-600-qualifications", nom: "Maître du tri", description: "Qualifie 600 items Inbox.", rarete: "legendaire", famille: "inbox", seuil: 600, illustration: "Plateau de tri, flèche descendante — traitement Légendaire (§8)", condition: "600 items qualifiés (cumul)", xp: 250 },

  // Ressources — Ressources créées (cumul), js/domain/resources.js#createResource.
  { id: "ressources-1-ressource", nom: "Premier lien utile", description: "Crée ta première Ressource.", rarete: "bronze", famille: "ressources", seuil: 1, illustration: "Trombone/lien stylisé — traitement Bronze (§8)", condition: "1 Ressource créée (cumul)", xp: 5 },
  { id: "ressources-15-ressources", nom: "Curateur", description: "Crée 15 Ressources.", rarete: "argent", famille: "ressources", seuil: 15, illustration: "Trombone/lien stylisé — traitement Argent (§8)", condition: "15 Ressources créées (cumul)", xp: 15 },
  { id: "ressources-40-ressources", nom: "Bibliothécaire", description: "Crée 40 Ressources.", rarete: "or", famille: "ressources", seuil: 40, illustration: "Trombone/lien stylisé — traitement Or (§8)", condition: "40 Ressources créées (cumul)", xp: 40 },
  { id: "ressources-80-ressources", nom: "Conservateur", description: "Crée 80 Ressources.", rarete: "platine", famille: "ressources", seuil: 80, illustration: "Trombone/lien stylisé — traitement Platine (§8)", condition: "80 Ressources créées (cumul)", xp: 100 },
  { id: "ressources-150-ressources", nom: "Grand bibliothécaire", description: "Crée 150 Ressources.", rarete: "legendaire", famille: "ressources", seuil: 150, illustration: "Trombone/lien stylisé — traitement Légendaire (§8)", condition: "150 Ressources créées (cumul)", xp: 250 },

  // Prompts — Prompts créés (cumul), js/domain/prompts.js#createPrompt.
  { id: "prompts-1-prompt", nom: "Premier prompt", description: "Crée ton premier Prompt.", rarete: "bronze", famille: "prompts", seuil: 1, illustration: "Bulle de dialogue traversée d'un éclair — traitement Bronze (§8)", condition: "1 Prompt créé (cumul)", xp: 5 },
  { id: "prompts-15-prompts", nom: "Apprenti IA", description: "Crée 15 Prompts.", rarete: "argent", famille: "prompts", seuil: 15, illustration: "Bulle de dialogue traversée d'un éclair — traitement Argent (§8)", condition: "15 Prompts créés (cumul)", xp: 15 },
  { id: "prompts-40-prompts", nom: "Bibliothécaire IA", description: "Crée 40 Prompts.", rarete: "or", famille: "prompts", seuil: 40, illustration: "Bulle de dialogue traversée d'un éclair — traitement Or (§8)", condition: "40 Prompts créés (cumul)", xp: 40 },
  { id: "prompts-80-prompts", nom: "Ingénieur de prompt", description: "Crée 80 Prompts.", rarete: "platine", famille: "prompts", seuil: 80, illustration: "Bulle de dialogue traversée d'un éclair — traitement Platine (§8)", condition: "80 Prompts créés (cumul)", xp: 100 },
  { id: "prompts-150-prompts", nom: "Maître du prompt", description: "Crée 150 Prompts.", rarete: "legendaire", famille: "prompts", seuil: 150, illustration: "Bulle de dialogue traversée d'un éclair — traitement Légendaire (§8)", condition: "150 Prompts créés (cumul)", xp: 250 },

  // Régularité — record personnel de la Série Pilotage, en jours ouvrés consécutifs (§5.3).
  // BLOQUÉ dans ce lot (voir le commentaire ci-dessus) : `famille: "regularite"` n'est jamais
  // passé à `evaluerFamille()`. `seuil` conservé (jours ouvrés) pour que LOT G5 n'ait qu'à
  // brancher l'appel, jamais à retoucher ce catalogue.
  { id: "regularite-serie-5j", nom: "Sur sa lancée", description: "Atteins une série Pilotage de 5 jours ouvrés consécutifs.", rarete: "bronze", famille: "regularite", seuil: 5, illustration: "Flamme stylisée — traitement Bronze (§8)", condition: "Record personnel Série Pilotage ≥ 5 jours ouvrés consécutifs", xp: 5 },
  { id: "regularite-serie-10j", nom: "Rythme pris", description: "Atteins une série Pilotage de 10 jours ouvrés consécutifs.", rarete: "argent", famille: "regularite", seuil: 10, illustration: "Flamme stylisée — traitement Argent (§8)", condition: "Record personnel Série Pilotage ≥ 10 jours ouvrés consécutifs", xp: 15 },
  { id: "regularite-serie-20j", nom: "Métronome", description: "Atteins une série Pilotage de 20 jours ouvrés consécutifs.", rarete: "or", famille: "regularite", seuil: 20, illustration: "Flamme stylisée — traitement Or (§8)", condition: "Record personnel Série Pilotage ≥ 20 jours ouvrés consécutifs", xp: 40 },
  { id: "regularite-serie-40j", nom: "Constance de fer", description: "Atteins une série Pilotage de 40 jours ouvrés consécutifs.", rarete: "platine", famille: "regularite", seuil: 40, illustration: "Flamme stylisée — traitement Platine (§8)", condition: "Record personnel Série Pilotage ≥ 40 jours ouvrés consécutifs", xp: 100 },
  { id: "regularite-serie-80j", nom: "Régularité légendaire", description: "Atteins une série Pilotage de 80 jours ouvrés consécutifs.", rarete: "legendaire", famille: "regularite", seuil: 80, illustration: "Flamme stylisée — traitement Légendaire (§8)", condition: "Record personnel Série Pilotage ≥ 80 jours ouvrés consécutifs", xp: 250 },

  // Expert — XP total cumulé, tous types d'actions et bonus de badges confondus (§3, §5.1).
  { id: "expert-500-xp", nom: "Espoir", description: "Cumule 500 XP au total.", rarete: "bronze", famille: "expert", seuil: 500, illustration: "Étoile à cinq branches pleine — traitement Bronze (§8)", condition: "XP total cumulé ≥ 500", xp: 5 },
  { id: "expert-2000-xp", nom: "Confirmé", description: "Cumule 2 000 XP au total.", rarete: "argent", famille: "expert", seuil: 2000, illustration: "Étoile à cinq branches pleine — traitement Argent (§8)", condition: "XP total cumulé ≥ 2 000", xp: 15 },
  { id: "expert-5000-xp", nom: "Expert", description: "Cumule 5 000 XP au total.", rarete: "or", famille: "expert", seuil: 5000, illustration: "Étoile à cinq branches pleine — traitement Or (§8)", condition: "XP total cumulé ≥ 5 000", xp: 40 },
  { id: "expert-9000-xp", nom: "Virtuose", description: "Cumule 9 000 XP au total.", rarete: "platine", famille: "expert", seuil: 9000, illustration: "Étoile à cinq branches pleine — traitement Platine (§8)", condition: "XP total cumulé ≥ 9 000", xp: 100 },
  { id: "expert-15000-xp", nom: "Légende de Pilotage", description: "Cumule 15 000 XP au total.", rarete: "legendaire", famille: "expert", seuil: 15000, illustration: "Étoile à cinq branches pleine — traitement Légendaire (§8)", condition: "XP total cumulé ≥ 15 000 (dépasse le total du niveau 30 — reste atteignable grâce au niveau infini, §4)", xp: 250 },
];

/** Lien créé via « 🔗 Lié » — AUCUN XP de base (Collaboration n'est pas une ligne du barème §3),
 *  uniquement un compteur pour la famille de badges Collaboration (§5.1). Voir
 *  js/domain/links.js#createLink. */
export async function recordLinkCreated(linkId) {
  await marquerEvenementCompte(`lien-cree:${linkId}`);
  const state = await getGamificationState();
  await evaluerFamille("collaboration", compterParPrefixe(state, "lien-cree:"));
}

/** Post-it créé sur « Mon bureau » — AUCUN XP de base (Organisation n'est pas une ligne du
 *  barème §3), uniquement un compteur pour la famille de badges Organisation (§5.1). Voir
 *  js/domain/stickyNotes.js#createStickyNote. Compte aussi le post-it unique créé par la
 *  migration ponctuelle de l'ancien Pense-bête (même fonction `createStickyNote`, voir son
 *  commentaire) — effet mineur, jamais plus d'une occurrence par compte, signalé dans le bilan
 *  de ce lot plutôt que traité comme un cas spécial non demandé par la roadmap. */
export async function recordStickyNoteCreated(noteId) {
  await marquerEvenementCompte(`postit-cree:${noteId}`);
  const state = await getGamificationState();
  await evaluerFamille("organisation", compterParPrefixe(state, "postit-cree:"));
}

/**
 * Objectif créé — AUCUN XP de base (ce n'est pas la ligne "Objectif mis à jour" du barème §3,
 * uniquement un déclencheur de ré-évaluation pour la famille de badges Management, §5.1).
 * Recalcule le nombre de collaborateurs DISTINCTS suivis via un Objectif EADP dédié (`personId`
 * non nul) en interrogeant directement la collection `objectives` plutôt que de dupliquer cette
 * donnée dans un compteur séparé qui risquerait de diverger (elle existe déjà intégralement
 * dans cette collection). `personId` est posé uniquement à la création (voir
 * js/domain/objectives.js#createObjective) et jamais modifié ensuite par aucun écran de l'app à
 * ce jour — pas besoin d'un second point d'écoute sur `updateObjective`.
 */
export async function recordObjectiveCreated() {
  const objectifs = await storage.listAll("objectives");
  const collaborateursDistincts = new Set(objectifs.filter((o) => o.personId).map((o) => o.personId)).size;
  await evaluerFamille("management", collaborateursDistincts);
}

// --- Niveaux (LOT G2 de la roadmap, §4) — fonctions PURES, sans état, sans aucun appel à
// storage.js : le niveau n'est jamais stocké, il est recalculé à la demande depuis l'XP total
// (§10). Aucune de ces fonctions n'est appelée depuis ce fichier lui-même ni depuis aucun autre
// fichier de domaine à ce stade — l'écran qui les affichera arrive avec LOT G8 (Progression),
// LOT G2 ne livre que le moteur de calcul, testable indépendamment. ------------------------------

/**
 * XP requis pour passer du niveau `niveau` au niveau `niveau + 1` — formule figée du barème
 * (§4) : progression arithmétique fixe (`50 + 25 × (n − 1)`), jamais aléatoire ni dépendante
 * d'un multiplicateur variable, SANS AUCUNE BORNE SUPÉRIEURE ni changement de formule au-delà
 * d'un quelconque seuil (§4, "niveau infini", décision actée le 24/09/2026) — appliquée telle
 * quelle à partir du niveau 1, y compris bien au-delà du niveau 30 documenté dans le tableau du
 * §4. Fonction privée : seule la position dans le barème (`positionBareme` ci-dessous) et le
 * niveau qui en découle (`niveauDepuisXP`) sont exposés aux appelants.
 */
function coutNiveauSuivant(niveau) {
  return 50 + 25 * (niveau - 1);
}

/**
 * Calcule en un seul passage la position exacte d'un total d'XP dans le barème de niveaux : le
 * niveau atteint, l'XP déjà cumulé pour l'avoir atteint (`xpDebutNiveau`), et le coût du palier
 * suivant. Mutualisée par `niveauDepuisXP()` et `progressionNiveau()` ci-dessous pour ne jamais
 * risquer un écart entre deux implémentations indépendantes de la même boucle — la roadmap (§4)
 * exige explicitement que "deux implémentations indépendantes qui appliquent cette même
 * récurrence [...] obtiennent, pour n'importe quelle valeur d'XP, exactement le même niveau".
 * Un XP négatif ou non numérique (donnée corrompue) est ramené à 0 plutôt que de produire un
 * niveau incohérent ou une boucle infinie.
 */
function positionBareme(xpTotal) {
  const xp = Number.isFinite(xpTotal) && xpTotal > 0 ? xpTotal : 0;
  let niveau = 1;
  let xpDebutNiveau = 0;
  while (xpDebutNiveau + coutNiveauSuivant(niveau) <= xp) {
    xpDebutNiveau += coutNiveauSuivant(niveau);
    niveau += 1;
  }
  return { niveau, xpDebutNiveau, xpPourNiveauSuivant: coutNiveauSuivant(niveau) };
}

/**
 * Niveau courant à partir de l'XP total (§4) — fonction pure, sans plafond (niveau infini) :
 * pour tout `xpTotal` ≥ 0, renvoie le plus grand niveau dont le seuil cumulé (voir le tableau du
 * §4) est ≤ `xpTotal`. Jamais stocké (§10) : à appeler à chaque affichage plutôt que de mettre en
 * cache une valeur qui pourrait devenir incohérente avec l'XP réel.
 */
export function niveauDepuisXP(xpTotal) {
  return positionBareme(xpTotal).niveau;
}

/**
 * Palier (regroupement visuel de 6 niveaux, calqué sur les raretés de badges — §4/§9) associé à
 * un niveau donné. Le palier affiché pour tout niveau ≥ 25 reste "💎 Légendaire", y compris
 * indéfiniment au-delà du niveau 30 (§4, "niveau infini" : "aucun nouveau déblocage n'est
 * associé à un niveau au-delà de 30", mais le palier affiché ne change pas pour autant).
 */
export function palierDuNiveau(niveau) {
  if (niveau >= 25) return { id: "legendaire", label: "💎 Légendaire" };
  if (niveau >= 19) return { id: "platine", label: "🏆 Platine" };
  if (niveau >= 13) return { id: "or", label: "🥇 Or" };
  if (niveau >= 7) return { id: "argent", label: "🥈 Argent" };
  return { id: "bronze", label: "🥉 Bronze" };
}

/**
 * Indicateur de progression vers le niveau suivant (LOT G2, objectif explicite du lot) — dérivé
 * lui aussi entièrement de l'XP total, jamais stocké (§10) : niveau courant, palier, XP déjà
 * acquis dans le niveau en cours, XP restant avant le niveau suivant, et un ratio [0, 1]
 * directement utilisable pour une barre de progression (l'écran qui l'affichera, "Progression",
 * arrive avec LOT G8 — aucune UI dans ce lot).
 */
export function progressionNiveau(xpTotal) {
  const { niveau, xpDebutNiveau, xpPourNiveauSuivant } = positionBareme(xpTotal);
  const xp = Number.isFinite(xpTotal) && xpTotal > 0 ? xpTotal : 0;
  const xpDansNiveauCourant = xp - xpDebutNiveau;
  return {
    niveau,
    palier: palierDuNiveau(niveau).label,
    xpTotal: xp,
    xpDansNiveauCourant,
    xpPourNiveauSuivant,
    xpRestantAvantNiveauSuivant: xpPourNiveauSuivant - xpDansNiveauCourant,
    progressionRatio: xpDansNiveauCourant / xpPourNiveauSuivant,
  };
}
