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
//
// Portée EXACTE de LOT G4 (voir TODO_GAMIFICATION.md → §11, LOT G4) : les 5 badges MENSUELS du
// §5.2 (Organisé, Focus, Régulier, Décideur, Livreur) — jours OUVRÉS DISTINCTS d'activité par
// type dans le mois courant (jamais un total d'actions), bascule au 1ᵉʳ du mois avec archivage de
// l'obtenu/non-obtenu du mois précédent dans l'historique (jamais la progression partielle, §5.2),
// aucun rattrapage. Contrairement aux badges permanents (LOT G3), les badges mensuels **ne
// créditent aucun XP** (aucune colonne XP au tableau du §5.2) — voir `enregistrerJoursMensuels`
// plus bas. Les séries (§5.3, LOT G5) restent hors de ce lot, mais la notion de "jour ouvré"
// qu'elles partagent (§2.1) est déjà centralisée ici (`estJourOuvre`) pour être réutilisée telle
// quelle par LOT G5 plutôt que réimplémentée une seconde fois — risque explicitement identifié
// par la roadmap pour ce futur lot (§11, LOT G5, "la logique jour ouvré doit être centralisée en
// un seul endroit").
//
// Portée EXACTE de LOT G5 (voir TODO_GAMIFICATION.md → §11, LOT G5) : les 4 SÉRIES du §5.3
// (Pilotage, Inbox, Tâches — journalières, jours ouvrés consécutifs, §2.1 ; Revue hebdo —
// hebdomadaire, semaine ISO 8601) : longueur courante, record personnel, jamais un simple total
// d'actions. `estJourOuvre` (LOT G4) est réutilisée telle quelle, comme anticipé ci-dessus.
// Contrairement aux badges (mensuels comme permanents), une série n'est PAS seulement mise à jour
// en écriture au fil des actions : sa longueur "affichable" doit rester correcte même en LECTURE
// SEULE après une absence (`longueurSerieJournaliereCourante`/`longueurSerieHebdoCourante` plus
// bas), exactement comme le niveau (LOT G2) n'est jamais stocké figé — risque explicitement
// anticipé par la roadmap pour ce lot (§11, "la série doit se recalculer correctement
// rétroactivement, pas seulement en direct"). Aucune UI dans ce lot (écran Progression = LOT G8).

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
    // Badges MENSUELS (§5.2, §10 point 2, LOT G4) — état du mois courant : `mois` au format
    // "YYYY-MM" (local, §2.2 ; `null` tant qu'aucune action n'a encore jamais été enregistrée),
    // `jours` = un tableau de dates "YYYY-MM-DD" DISTINCTES par badge mensuel (jamais un simple
    // total d'actions, §5.2), `obtenus` = un booléen par badge mensuel, définitivement vrai dès
    // que le seuil du mois est atteint (jamais réévalué à la baisse dans le même mois, cumulatif
    // par nature). Voir `enregistrerJoursMensuels()` plus bas pour la bascule de mois.
    badgesMensuelsCourant: {
      mois: null,
      jours: { organise: [], focus: [], regulier: [], decideur: [], livreur: [] },
      obtenus: { organise: false, focus: false, regulier: false, decideur: false, livreur: false },
    },
    // Historique des badges mensuels des mois précédents (§5.2, §10 point 2) : `{ [mois]:
    // { [badgeMensuelId]: obtenu (booléen) } }` — uniquement l'obtenu/non-obtenu final de chaque
    // mois écoulé, JAMAIS la progression partielle (`jours`) de ce mois-là, qui est perdue à la
    // bascule (comportement voulu, §5.2 : "un badge mensuel non obtenu à la fin du mois disparaît
    // simplement de la course, pas de rattrapage").
    badgesMensuelsHistorique: {},
    // Séries (§5.3, §10 point 1, LOT G5) — état BRUT persisté par série, jamais la longueur
    // "affichable" (voir `longueurSerieJournaliereCourante`/`longueurSerieHebdoCourante` plus
    // bas, qui la recalculent à la demande). Les 3 séries journalières (Pilotage/Inbox/Tâches)
    // portent `dernierJour` ("YYYY-MM-DD" local, `null` tant qu'aucune action n'a jamais eu
    // lieu) ; la série hebdomadaire (Revue hebdo) porte `derniereSemaine` ("YYYY-Www" ISO 8601,
    // §5.3 : "à l'échelle de la semaine ISO plutôt que du jour"). `record` ne redescend jamais.
    series: {
      pilotage: { longueur: 0, record: 0, dernierJour: null },
      inbox: { longueur: 0, record: 0, dernierJour: null },
      taches: { longueur: 0, record: 0, dernierJour: null },
      revueHebdo: { longueur: 0, record: 0, derniereSemaine: null },
    },
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
 *  différemment). Fonction privée : dateUtils.js n'est pas un fichier concerné par ce moteur.
 *  Sert au throttle de l'événement "Objectif mis à jour" (LOT G1), de clé de jour distinct pour
 *  les badges mensuels (LOT G4, `enregistrerJoursMensuels`, ses 7 premiers caractères donnant
 *  directement le mois au format "YYYY-MM") et, depuis LOT G5, aux séries journalières
 *  (`enregistrerSerieJournaliere`). Accepte un paramètre `date` optionnel (par défaut `new
 *  Date()`) uniquement pour permettre à `longueurSerieJournaliereCourante()` de raisonner sur un
 *  "aujourd'hui" donné sans dépendre de l'horloge réelle (fonction pure, testable). */
function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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

// --- Badges mensuels (LOT G4, §5.2) — helpers utilisés uniquement par le barème XP ci-dessous
// (les 10 événements du §3, jamais par les 3 points d'écoute LOT G3 sans XP — Collaboration/
// Organisation/Management ne sont pas des "actions valorisées (§3)" au sens du badge "Régulier",
// voir le mapping détaillé sur chaque `recordXxx()` ci-dessous). ------------------------------

/** Seuil (jours ouvrés distincts dans le mois) de chaque badge mensuel — table exacte du §5.2. */
const SEUILS_BADGES_MENSUELS = { organise: 15, focus: 12, regulier: 18, decideur: 4, livreur: 10 };

/** Jour ouvré (lundi-vendredi), calendrier LOCAL (§2.1 : "le calcul des séries et des badges
 *  mensuels basés sur des jours ne considère que les jours ouvrés"). Aucun jour férié pris en
 *  compte (décision actée par la roadmap, à reconsidérer si l'usage réel le justifie — pas une
 *  action de ce lot). Fonction privée, volontairement centralisée ici en un seul endroit plutôt
 *  que réimplémentée par famille : réutilisable telle quelle par un futur LOT G5 (séries, §5.3),
 *  qui partage exactement la même définition de "jour ouvré" — risque explicitement identifié par
 *  la roadmap pour ce lot à venir (§11, LOT G5).
 */
function estJourOuvre(date) {
  const jour = date.getDay(); // 0 = dimanche, 6 = samedi (calendrier local, jamais UTC)
  return jour !== 0 && jour !== 6;
}

/**
 * Enregistre, pour CHAQUE badge mensuel listé dans `badgeMensuelIds`, que la journée locale du
 * jour compte comme un jour ouvré distinct d'activité pour ce badge (§5.2) — jamais un total
 * d'actions : une deuxième action du même type le même jour n'ajoute rien de plus. Ignore
 * silencieusement les week-ends (§2.1, "samedi et dimanche sont ignorés") : aucune écriture n'a
 * lieu si l'action se produit un jour non ouvré, exactement comme si elle n'avait pas eu lieu au
 * sens de ce badge (l'XP de base, lui, reste crédité normalement — cette fonction ne touche
 * jamais `xpTotal`, voir la note sur l'absence de colonne XP au §5.2).
 *
 * Gère aussi la BASCULE DE MOIS (§5.2, "se réinitialisent au 1ᵉʳ de chaque mois") : si le mois
 * local courant diffère du mois enregistré dans `badgesMensuelsCourant`, l'état `obtenus` du mois
 * qui se termine est d'abord figé dans `badgesMensuelsHistorique` (uniquement obtenu/non-obtenu,
 * JAMAIS la progression `jours` de ce mois, perdue par conception — §5.2, "pas de rattrapage"),
 * puis un nouveau compteur à 0 démarre pour le mois courant AVANT d'enregistrer le jour en cours.
 * Cette bascule est vérifiée à CHAQUE appel (pas de tâche planifiée séparée) : le premier appel
 * qui se produit après le changement de mois déclenche la bascule, ce qui suffit puisque
 * `badgesMensuelsCourant` n'est de toute façon jamais lu/affiché en dehors d'un appel à
 * `getGamificationState()` déclenché par une action réelle (aucun écran ne dépend de ce lot,
 * l'affichage arrive avec LOT G8).
 */
async function enregistrerJoursMensuels(badgeMensuelIds) {
  const maintenant = new Date();
  if (!estJourOuvre(maintenant)) return undefined; // week-end (§2.1) — ignoré, aucune écriture
  const jour = localDateKey();
  const mois = jour.slice(0, 7); // "YYYY-MM", même date locale que `jour`

  return storage.update(COLLECTION, DOC_ID, (raw) => {
    const current = withDefaults(raw);
    let courant = current.badgesMensuelsCourant;
    let historique = current.badgesMensuelsHistorique;
    let modifie = false;

    if (courant.mois !== mois) {
      if (courant.mois) {
        // Bascule réelle (pas le tout premier appel jamais fait) : fige l'obtenu/non-obtenu du
        // mois qui se termine, jamais sa progression partielle.
        historique = { ...historique, [courant.mois]: { ...courant.obtenus } };
      }
      courant = {
        mois,
        jours: { organise: [], focus: [], regulier: [], decideur: [], livreur: [] },
        obtenus: { organise: false, focus: false, regulier: false, decideur: false, livreur: false },
      };
      modifie = true;
    }

    const jours = { ...courant.jours };
    const obtenus = { ...courant.obtenus };
    for (const badgeMensuelId of badgeMensuelIds) {
      const liste = jours[badgeMensuelId] || [];
      if (!liste.includes(jour)) {
        jours[badgeMensuelId] = [...liste, jour];
        modifie = true;
        if (jours[badgeMensuelId].length >= SEUILS_BADGES_MENSUELS[badgeMensuelId]) {
          obtenus[badgeMensuelId] = true;
        }
      }
    }

    if (!modifie) return undefined; // jour déjà compté pour toutes ces familles — rien à écrire
    return {
      badgesMensuelsCourant: { mois, jours, obtenus },
      badgesMensuelsHistorique: historique,
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

// --- Séries (LOT G5, §5.3) — helpers utilisés uniquement par le barème XP ci-dessous (les 10
// événements du §3, jamais par les 3 points d'écoute LOT G3 sans XP, exactement comme "Régulier"
// au LOT G4 — voir le mapping détaillé sur chaque `recordXxx()` plus bas). --------------------

/** Variante de `estJourOuvre()` pour une date "calendrier" tagguée UTC (construite via
 *  `Date.UTC(...)`, voir `veilleOuvree()`/les helpers de semaine ISO ci-dessous) : utilise
 *  `getUTCDay()` et non `getDay()`, pour ne JAMAIS mélanger les deux familles de getters
 *  (piège classique : appeler `getDay()` — local — sur une date construite en UTC peut décaler
 *  le jour de la semaine selon le fuseau horaire d'exécution). `estJourOuvre()` reste réservée
 *  aux dates réelles ("maintenant"), celle-ci uniquement aux dates de calendrier internes. */
function estJourOuvreUTC(date) {
  const jour = date.getUTCDay();
  return jour !== 0 && jour !== 6;
}

/** Jour OUVRÉ précédant `date` (§2.1 : lundi renvoie le vendredi précédent, tout autre jour
 *  ouvré renvoie simplement la veille), au format "YYYY-MM-DD". Travaille sur une date
 *  "calendrier" taguée UTC construite à partir des seuls composants LOCAUX année/mois/jour de
 *  `date` (extraits une seule fois à l'entrée) — même précaution que les helpers de semaine ISO
 *  ci-dessous, pour ne jamais laisser un changement d'heure (DST) décaler le résultat : on ne
 *  raisonne ici que sur un calendrier de dates, jamais sur un instant réel. */
function veilleOuvree(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  do {
    d.setUTCDate(d.getUTCDate() - 1);
  } while (!estJourOuvreUTC(d));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Semaine ISO 8601 (lundi-dimanche, §5.3) d'une date "calendrier" donnée par ses composants
 *  année/mois (0-11)/jour, au format "YYYY-Www" — l'année ISO (celle du JEUDI de la semaine,
 *  règle standard) peut différer de l'année civile pour les tout premiers/derniers jours de
 *  l'année. Toujours en UTC "calendrier" (voir `veilleOuvree()` ci-dessus pour la même
 *  précaution) : ne jamais appeler avec des composants qui ne soient pas déjà LOCAUX. */
function semaineIsoDepuisYMD(annee, mois, jour) {
  const d = new Date(Date.UTC(annee, mois, jour));
  const jourIso = d.getUTCDay() || 7; // lundi=1 ... dimanche=7
  d.setUTCDate(d.getUTCDate() + 4 - jourIso); // jeudi de cette semaine ISO — détermine l'année ISO
  const anneeIso = d.getUTCFullYear();
  const debutAnnee = new Date(Date.UTC(anneeIso, 0, 1));
  const numeroSemaine = Math.ceil(((d - debutAnnee) / 86400000 + 1) / 7);
  return `${anneeIso}-W${String(numeroSemaine).padStart(2, "0")}`;
}

/** Semaine ISO de la date LOCALE donnée (§2.2) — point d'entrée public de `semaineIsoDepuisYMD`
 *  à partir d'un objet `Date` réel ("maintenant"), composants extraits une seule fois ici. */
function semaineIsoLocale(date) {
  return semaineIsoDepuisYMD(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Clé de la semaine ISO précédant immédiatement `semaineKey` (ex. "2026-W01" → "2025-W52" ou
 *  "2025-W53" selon l'année) — recalculée en reculant de 7 jours à partir du JEUDI de la semaine
 *  donnée (le 4 janvier appartient toujours à la semaine 1, règle ISO) puis en réappliquant
 *  `semaineIsoDepuisYMD`, plutôt que par arithmétique directe sur le numéro de semaine (qui
 *  casserait au changement d'année ISO, semaine 1 ↔ semaine 52/53). */
function semaineIsoPrecedente(semaineKey) {
  const [anneeStr, semaineStr] = semaineKey.split("-W");
  const annee = Number(anneeStr);
  const semaine = Number(semaineStr);
  const jeudiSemaine1 = new Date(Date.UTC(annee, 0, 4));
  const jourIsoJ1 = jeudiSemaine1.getUTCDay() || 7;
  jeudiSemaine1.setUTCDate(jeudiSemaine1.getUTCDate() + 4 - jourIsoJ1); // jeudi réel de la semaine 1
  const jeudiCourant = new Date(jeudiSemaine1.getTime());
  jeudiCourant.setUTCDate(jeudiCourant.getUTCDate() + (semaine - 1) * 7);
  const jeudiPrecedent = new Date(jeudiCourant.getTime());
  jeudiPrecedent.setUTCDate(jeudiPrecedent.getUTCDate() - 7);
  return semaineIsoDepuisYMD(jeudiPrecedent.getUTCFullYear(), jeudiPrecedent.getUTCMonth(), jeudiPrecedent.getUTCDate());
}

/**
 * Enregistre qu'une action valorisant la série JOURNALIÈRE `serieId` (Pilotage/Inbox/Tâches,
 * §5.3) a eu lieu aujourd'hui (date locale, §2.2). Ignore silencieusement les week-ends (§2.1,
 * "une action réalisée un week-end ne compte ni pour ni contre une série") : aucune écriture.
 * Sinon :
 *  - Si cette série a déjà été enregistrée AUJOURD'HUI, ne fait rien (idempotent — "une action
 *    valide suffit", §5.3, jamais un seuil de quantité).
 *  - Sinon, compare `dernierJour` au jour OUVRÉ précédant aujourd'hui (`veilleOuvree`) : s'ils
 *    coïncident (ou si `dernierJour` est `null`, tout premier enregistrement), la série CONTINUE
 *    (longueur + 1). Sinon (au moins un jour ouvré sans action s'est déjà écoulé depuis
 *    `dernierJour`), la série CASSE et repart à 1 dès aujourd'hui (§5.3 : "un jour ouvré sans
 *    l'action concernée casse la série, elle retombe à 0, un nouveau départ commence dès la
 *    prochaine action valide" — un jour ouvré AVEC action ne peut donc jamais laisser la série
 *    à 0).
 *  - Le record personnel ne redescend jamais (`record = max(record, longueur)`).
 * Moteur PARESSEUX, comme le reste de ce fichier (aucune tâche planifiée séparée) : la cassure
 * éventuelle n'est détectée en ÉCRITURE qu'au moment de la PROCHAINE action, quelle que soit la
 * durée de l'absence — risque explicitement anticipé par la roadmap pour ce lot (§11, LOT G5,
 * "la série doit se recalculer correctement rétroactivement, pas seulement en direct"). Pour la
 * LECTURE (affichage), voir `longueurSerieJournaliereCourante()` plus bas, qui détecte la même
 * cassure SANS attendre une prochaine action ni écrire quoi que ce soit — même principe que le
 * niveau (LOT G2), jamais figé plus longtemps que nécessaire.
 */
async function enregistrerSerieJournaliere(serieId) {
  const maintenant = new Date();
  if (!estJourOuvre(maintenant)) return undefined; // week-end (§2.1) — ignoré, aucune écriture
  const aujourdhui = localDateKey(maintenant);

  return storage.update(COLLECTION, DOC_ID, (raw) => {
    const current = withDefaults(raw);
    const serie = current.series[serieId];
    if (serie.dernierJour === aujourdhui) return undefined; // déjà compté aujourd'hui

    const veille = veilleOuvree(maintenant);
    const continuite = serie.dernierJour === null || serie.dernierJour === veille;
    const longueur = continuite ? serie.longueur + 1 : 1;
    const record = Math.max(serie.record, longueur);

    return { series: { ...current.series, [serieId]: { longueur, record, dernierJour: aujourdhui } } };
  });
}

/**
 * Même principe que `enregistrerSerieJournaliere()` ci-dessus, à l'échelle de la semaine ISO
 * (lundi-dimanche) plutôt que du jour ouvré (§5.3 : "la série Revue hebdo suit la même logique à
 * l'échelle de la semaine ISO plutôt que du jour") — aucune notion de week-end ici, chaque
 * semaine ISO compte. Seule série concernée dans ce lot : `revueHebdo`.
 */
async function enregistrerSerieHebdomadaire(serieId) {
  const maintenant = new Date();
  const semaineCourante = semaineIsoLocale(maintenant);

  return storage.update(COLLECTION, DOC_ID, (raw) => {
    const current = withDefaults(raw);
    const serie = current.series[serieId];
    if (serie.derniereSemaine === semaineCourante) return undefined; // déjà compté cette semaine

    const semainePrecedente = semaineIsoPrecedente(semaineCourante);
    const continuite = serie.derniereSemaine === null || serie.derniereSemaine === semainePrecedente;
    const longueur = continuite ? serie.longueur + 1 : 1;
    const record = Math.max(serie.record, longueur);

    return { series: { ...current.series, [serieId]: { longueur, record, derniereSemaine: semaineCourante } } };
  });
}

/**
 * Longueur ACTUELLE affichable d'une série JOURNALIÈRE (Pilotage/Inbox/Tâches, §5.3), à partir de
 * son état persisté brut `{ longueur, dernierJour }` — jamais un simple retour de `longueur`
 * telle quelle : si au moins un jour ouvré s'est déjà écoulé sans action depuis `dernierJour`
 * (donc AVANT même qu'une prochaine action ne déclenche la cassure en écriture, voir
 * `enregistrerSerieJournaliere` ci-dessus), la série est déjà cassée AUX YEUX DU CALENDRIER,
 * qu'une action ait eu lieu depuis ou non — se recalcule donc à la demande, jamais stocké plus
 * longtemps que nécessaire (même principe que `niveauDepuisXP`, LOT G2). Fonction PURE (aucun
 * accès storage), `maintenant` optionnel (par défaut `new Date()`) uniquement pour la rendre
 * testable sans dépendre de l'horloge réelle. Aucune UI ne l'utilise dans ce lot (l'écran
 * Progression, qui l'affichera, est LOT G8).
 */
export function longueurSerieJournaliereCourante(serieRaw, maintenant = new Date()) {
  if (!serieRaw || !serieRaw.dernierJour) return 0;
  const aujourdhui = localDateKey(maintenant);
  if (serieRaw.dernierJour === aujourdhui) return serieRaw.longueur;
  if (serieRaw.dernierJour === veilleOuvree(maintenant)) return serieRaw.longueur;
  return 0; // au moins un jour ouvré sans action déjà passé — cassée, quoi qu'il arrive ensuite
}

/** Même principe que `longueurSerieJournaliereCourante()` ci-dessus, à l'échelle de la semaine
 *  ISO (§5.3) — pour `revueHebdo` uniquement dans ce lot. Fonction PURE, `maintenant` optionnel
 *  pour la même raison de testabilité. */
export function longueurSerieHebdoCourante(serieRaw, maintenant = new Date()) {
  if (!serieRaw || !serieRaw.derniereSemaine) return 0;
  const semaineCourante = semaineIsoLocale(maintenant);
  if (serieRaw.derniereSemaine === semaineCourante) return serieRaw.longueur;
  if (serieRaw.derniereSemaine === semaineIsoPrecedente(semaineCourante)) return serieRaw.longueur;
  return 0; // au moins une semaine ISO entière déjà écoulée sans revue — cassée
}

// --- Barème XP (§3 de la roadmap) — une fonction par ligne du tableau, montants et clés de
// dédoublonnage figés ici, jamais recalculés ni redéfinis par un appelant. ------------------

/** Tâche terminée — 10 XP, une fois par Tâche (première transition vers "done" seulement,
 *  voir js/domain/tasks.js#updateTask). LOT G3 : alimente aussi la famille de badges
 *  Productivité (§5.1), sur la base du même registre (voir `compterParPrefixe`). LOT G4 :
 *  alimente les badges mensuels "Focus" (§5.2) et "Régulier" (action valorisée du barème §3).
 *  LOT G5 : alimente les séries "Pilotage" et "Tâches" (§5.3). */
export async function recordTaskCompleted(taskId) {
  await awardXpOnce(`tache-terminee:${taskId}`, 10);
  const state = await getGamificationState();
  await evaluerFamille("productivite", compterParPrefixe(state, "tache-terminee:"));
  await enregistrerJoursMensuels(["focus", "regulier"]);
  await enregistrerSerieJournaliere("pilotage");
  await enregistrerSerieJournaliere("taches");
}

/** Suivi terminé — 8 XP, une fois par Suivi (voir js/domain/followups.js#updateFollowUp).
 *  LOT G4 : alimente les badges mensuels "Livreur" (Suivi terminé OU Projet clôturé, §5.2) et
 *  "Régulier". Aucune famille de badges permanents (LOT G3) ne correspond à cette action.
 *  LOT G5 : alimente uniquement la série "Pilotage" (§5.3) — aucune série dédiée aux Suivis. */
export async function recordFollowUpCompleted(followUpId) {
  await awardXpOnce(`suivi-termine:${followUpId}`, 8);
  await enregistrerJoursMensuels(["livreur", "regulier"]);
  await enregistrerSerieJournaliere("pilotage");
}

/** Projet clôturé — 40 XP, une fois par Projet (voir js/domain/projects.js#closeProject).
 *  LOT G3 : alimente aussi la famille de badges Delivery (§5.1). LOT G4 : alimente les badges
 *  mensuels "Livreur" (Suivi terminé OU Projet clôturé, §5.2) et "Régulier". LOT G5 : alimente
 *  uniquement la série "Pilotage" (§5.3). */
export async function recordProjectClosed(projectId) {
  await awardXpOnce(`projet-cloture:${projectId}`, 40);
  const state = await getGamificationState();
  await evaluerFamille("delivery", compterParPrefixe(state, "projet-cloture:"));
  await enregistrerJoursMensuels(["livreur", "regulier"]);
  await enregistrerSerieJournaliere("pilotage");
}

/** Réunion créée — 5 XP, une fois par Réunion (voir js/domain/meetings.js#createMeeting).
 *  LOT G3 : alimente aussi la famille de badges Réunions (§5.1). LOT G4 : aucun badge mensuel
 *  dédié aux Réunions (§5.2) — alimente uniquement "Régulier" (action valorisée du barème §3).
 *  LOT G5 : alimente uniquement la série "Pilotage" (§5.3). */
export async function recordMeetingCreated(meetingId) {
  await awardXpOnce(`reunion-creee:${meetingId}`, 5);
  const state = await getGamificationState();
  await evaluerFamille("reunions", compterParPrefixe(state, "reunion-creee:"));
  await enregistrerJoursMensuels(["regulier"]);
  await enregistrerSerieJournaliere("pilotage");
}

/** Décision créée — 6 XP, une fois par Décision (voir js/domain/decisions.js#createDecision).
 *  LOT G3 : alimente aussi la famille de badges Décisions (§5.1). LOT G4 : alimente les badges
 *  mensuels "Décideur" et "Régulier" (§5.2). LOT G5 : alimente uniquement la série "Pilotage"
 *  (§5.3) — aucune série dédiée aux Décisions. */
export async function recordDecisionCreated(decisionId) {
  await awardXpOnce(`decision-creee:${decisionId}`, 6);
  const state = await getGamificationState();
  await evaluerFamille("decisions", compterParPrefixe(state, "decision-creee:"));
  await enregistrerJoursMensuels(["decideur", "regulier"]);
  await enregistrerSerieJournaliere("pilotage");
}

/**
 * Objectif mis à jour — 8 XP, **au plus une fois par jour calendaire et par Objectif** (§3,
 * clause explicite de cette ligne du barème — seule exception à "une fois pour toujours" parmi
 * les 10 actions). Appelée à l'identique par js/domain/objectives.js#updateObjective,
 * #addIndicator et #updateIndicator (les trois fonctions citées par cette ligne du barème) : la
 * clé de dédoublonnage inclut la date locale du jour (§2.2) plutôt que d'être fixe pour
 * l'Objectif, ce qui permet au gain de se reproduire le lendemain sans jamais dépasser une fois
 * par jour.
 *
 * LOT G4 : alimente uniquement le badge mensuel "Régulier" (§5.2, action valorisée du barème §3)
 * — aucun badge mensuel dédié à "Objectif mis à jour" lui-même. Contrairement à l'XP (throttlée à
 * une fois par jour ET par Objectif), le jour ouvré compte pour "Régulier" dès le premier appel
 * du jour, cohérent avec la définition du badge ("au moins une action valorisée ce jour-là").
 * LOT G5 : même principe pour la série "Pilotage" (§5.3) — aucune série dédiée à "Objectif mis à
 * jour" (la série "Revue hebdo" ne concerne QUE `recordObjectiveReviewAdded` ci-dessous).
 */
export async function recordObjectiveUpdated(objectiveId) {
  await awardXpOnce(`objectif-maj:${objectiveId}:${localDateKey()}`, 8);
  await enregistrerJoursMensuels(["regulier"]);
  await enregistrerSerieJournaliere("pilotage");
}

/** Revue EADP ajoutée — 6 XP, une fois par point de suivi ajouté (`entry.id`, généré à chaque
 *  appel — voir js/domain/objectives.js#addEntry). Distincte de `recordObjectiveUpdated`
 *  ci-dessus : ce sont deux lignes différentes du barème (§3), jamais fusionnées.
 *  LOT G3 : alimente aussi la famille de badges Objectifs (§5.1, revues EADP, à ne pas confondre
 *  avec "Objectif mis à jour" ci-dessus qui ne fait partie d'aucune famille de badges). LOT G4 :
 *  aucun badge mensuel dédié aux revues EADP (§5.2) — alimente uniquement "Régulier". LOT G5 :
 *  alimente la série "Pilotage" ET la série hebdomadaire "Revue hebdo" (§5.3, seule action
 *  déclenchant cette dernière). */
export async function recordObjectiveReviewAdded(entryId) {
  await awardXpOnce(`revue-eadp:${entryId}`, 6);
  const state = await getGamificationState();
  await evaluerFamille("objectifs", compterParPrefixe(state, "revue-eadp:"));
  await enregistrerJoursMensuels(["regulier"]);
  await enregistrerSerieJournaliere("pilotage");
  await enregistrerSerieHebdomadaire("revueHebdo");
}

/** Inbox qualifiée — 4 XP, une fois par item, quel que soit le type de qualification choisi (y
 *  compris "Archiver", voir §3 et js/domain/inbox.js#qualify). LOT G3 : alimente aussi la
 *  famille de badges Inbox (§5.1). LOT G4 : alimente les badges mensuels "Organisé" et
 *  "Régulier" (§5.2). LOT G5 : alimente les séries "Pilotage" et "Inbox" (§5.3). */
export async function recordInboxItemQualified(itemId) {
  await awardXpOnce(`inbox-qualifiee:${itemId}`, 4);
  const state = await getGamificationState();
  await evaluerFamille("inbox", compterParPrefixe(state, "inbox-qualifiee:"));
  await enregistrerJoursMensuels(["organise", "regulier"]);
  await enregistrerSerieJournaliere("pilotage");
  await enregistrerSerieJournaliere("inbox");
}

/** Ressource créée — 3 XP, une fois par Ressource (voir js/domain/resources.js#createResource).
 *  LOT G3 : alimente aussi la famille de badges Ressources (§5.1). LOT G4 : aucun badge mensuel
 *  dédié aux Ressources (§5.2) — alimente uniquement "Régulier". LOT G5 : alimente uniquement la
 *  série "Pilotage" (§5.3). */
export async function recordResourceCreated(resourceId) {
  await awardXpOnce(`ressource-creee:${resourceId}`, 3);
  const state = await getGamificationState();
  await evaluerFamille("ressources", compterParPrefixe(state, "ressource-creee:"));
  await enregistrerJoursMensuels(["regulier"]);
  await enregistrerSerieJournaliere("pilotage");
}

/** Prompt créé — 3 XP, une fois par Prompt (voir js/domain/prompts.js#createPrompt).
 *  LOT G3 : alimente aussi la famille de badges Prompts (§5.1). LOT G4 : aucun badge mensuel
 *  dédié aux Prompts (§5.2) — alimente uniquement "Régulier". LOT G5 : alimente uniquement la
 *  série "Pilotage" (§5.3). */
export async function recordPromptCreated(promptId) {
  await awardXpOnce(`prompt-cree:${promptId}`, 3);
  const state = await getGamificationState();
  await evaluerFamille("prompts", compterParPrefixe(state, "prompt-cree:"));
  await enregistrerJoursMensuels(["regulier"]);
  await enregistrerSerieJournaliere("pilotage");
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
