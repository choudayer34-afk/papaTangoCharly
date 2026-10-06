// "Voir ce qui a changé" pour la détection de nouveautés de la Veille (06/10/2026, retour de
// Charles-Henri : "est-ce qu'on peut voir les nouveautés détectées ?" — réponse choisie : "Le texte
// nouveau"). Jusqu'ici Pilotage ne gardait qu'une EMPREINTE de la page : il savait QU'elle avait changé, pas
// CE QUI avait changé. On garde maintenant, en plus, la dernière version lue sous forme de lignes de texte
// (un titre, un lien, un paragraphe = une ligne) et on compare ligne à ligne : les lignes apparues depuis la
// vérification précédente sont "le texte nouveau".
//
// Module PUR (aucun import, ni Firestore ni DOM) : js/domain/veille.js l'utilise, et il se teste tel quel
// sous Node (même principe que veilleResearchImport.js).
//
// Limites assumées : on compare des LIGNES EXACTES — un titre retouché apparaît comme une ligne nouvelle (et
// l'ancienne comme disparue) ; une date qui change dans un bandeau produit une fausse nouveauté ; et la
// qualité dépend de la page (une liste d'articles lisible dans le code source donne de bonnes lignes, une page
// fabriquée en JavaScript n'en donne aucune — voir SHORT_ZONE_CHARS dans js/domain/veille.js).

/** Taille maximale du texte conservé par source (Firestore : document limité à 1 Mo, 16 sources → large marge). */
export const SNAPSHOT_MAX_CHARS = 15000;
/** Nombre maximal de lignes nouvelles affichées pour un changement. */
export const ADDED_MAX_LINES = 60;
/** Longueur maximale d'une ligne conservée (un paragraphe entier reste lisible, un bloc géant est coupé). */
export const LINE_MAX_CHARS = 300;
/** Lignes plus courtes ignorées (puces, "›", "OK"...). */
const LINE_MIN_CHARS = 3;

/** Nettoie une liste de lignes : espaces normalisés, trop courtes retirées, trop longues coupées. */
export function cleanLines(lines) {
  const out = [];
  for (const raw of lines || []) {
    const line = String(raw).replace(/\s+/g, " ").trim();
    if (line.length < LINE_MIN_CHARS) continue;
    out.push(line.length > LINE_MAX_CHARS ? `${line.slice(0, LINE_MAX_CHARS - 1)}…` : line);
  }
  return out;
}

/** Texte à stocker : lignes séparées par "\n", coupé à une LIGNE ENTIÈRE près sous `SNAPSHOT_MAX_CHARS`. */
export function packSnapshot(lines) {
  const kept = [];
  let total = 0;
  for (const line of cleanLines(lines)) {
    if (total + line.length + 1 > SNAPSHOT_MAX_CHARS) break;
    kept.push(line);
    total += line.length + 1;
  }
  return kept.join("\n");
}

export function unpackSnapshot(text) {
  return text ? String(text).split("\n").filter(Boolean) : [];
}

/**
 * Compare deux versions. Les lignes NOUVELLES sont d'abord rognées exactement comme elles le seront au
 * stockage (`packSnapshot`) : sinon une page plus longue que la limite ferait "apparaître" à chaque
 * vérification les lignes de sa fin, jamais conservées.
 * @returns {{ added: string[], removedCount: number, truncatedAdded: number }}
 *   `added` : lignes apparues (sans doublon, ordre de la page), plafonnées à `ADDED_MAX_LINES` ;
 *   `truncatedAdded` : combien de lignes nouvelles ne sont pas listées à cause du plafond.
 */
export function diffLines(previousLines, currentLines) {
  const current = unpackSnapshot(packSnapshot(currentLines));
  const remaining = new Map();
  for (const line of previousLines || []) remaining.set(line, (remaining.get(line) || 0) + 1);
  const added = [];
  const seen = new Set();
  for (const line of current) {
    const count = remaining.get(line) || 0;
    if (count > 0) {
      remaining.set(line, count - 1);
    } else if (!seen.has(line)) {
      seen.add(line);
      added.push(line);
    }
  }
  let removedCount = 0;
  for (const n of remaining.values()) removedCount += n;
  return {
    added: added.slice(0, ADDED_MAX_LINES),
    removedCount,
    truncatedAdded: Math.max(0, added.length - ADDED_MAX_LINES),
  };
}

/**
 * Cumule les lignes nouvelles de plusieurs vérifications successives tant que la nouveauté n'a pas été vue
 * (A → B puis B → C : on garde ce qui est apparu dans les deux, pas seulement la dernière différence).
 */
export function mergeAdded(previousAdded, newAdded) {
  const out = [];
  const seen = new Set();
  for (const line of [...(previousAdded || []), ...(newAdded || [])]) {
    if (seen.has(line)) continue;
    seen.add(line);
    out.push(line);
  }
  return out.slice(0, ADDED_MAX_LINES);
}
