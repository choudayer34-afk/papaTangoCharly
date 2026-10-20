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

// ---------------------------------------------------------------------------------------------------------
// Présentation lisible des lignes nouvelles (20/10/2026, retour de Charles-Henri : la modale « Nouveautés »
// affichait une liste de lignes brutes, titre et date collés, sans lien). Tout ce qui suit est PUR et ne
// touche ni l'empreinte ni la comparaison : `diffLines` garde ses lignes exactes, on ne fait ici qu'habiller
// le résultat pour l'affichage (titre / date / lien cliquable) et mettre à part les lignes parasites.
// ---------------------------------------------------------------------------------------------------------

/** Texte de lien trop court pour être associé de façon fiable à une ligne ("Lire", "Voir"...). */
export const LINK_MIN_TEXT = 12;
/** Titre plus court que ça, sans lien : traité comme une ligne parasite (rubrique, bouton...). */
const TITLE_MIN_CHARS = 15;

const MONTHS =
  "janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre|janv|f[ée]vr|avr|juil|sept|oct|nov|d[ée]c";
const DATE_RE = new RegExp(
  `\\b\\d{1,2}(?:er)?\\s+(?:${MONTHS})\\.?(?:\\s+\\d{4})?(?![\\p{L}\\d])` + // 12 octobre 2026, 1er oct.
    `|\\b\\d{1,2}[/.\\-]\\d{1,2}[/.\\-](?:\\d{4}|\\d{2})\\b` + // 12/10/2026, 12.10.26
    `|\\b\\d{4}-\\d{2}-\\d{2}\\b`, // 2026-10-12
  "iu"
);
const GENERIC_RE =
  /^(lire la suite|lire plus|lire l.article|en savoir plus|voir plus|voir tout|plus d.infos?|d[ée]couvrir|t[ée]l[ée]charger|partager|suivant|pr[ée]c[ée]dent|retour|accueil|cliquez ici)\b/i;
const EDGE_SEPARATORS = /^[\s\-–—|·:,/>»]+|[\s\-–—|·:,/>»]+$/g;

/** Sépare une ligne en titre + date (première date reconnue, retirée du titre). */
export function parseLine(line) {
  const text = String(line || "").replace(/\s+/g, " ").trim();
  const m = text.match(DATE_RE);
  if (!m) return { title: text.replace(EDGE_SEPARATORS, ""), date: "" };
  const title = (text.slice(0, m.index) + " " + text.slice(m.index + m[0].length)).replace(/\s+/g, " ").trim().replace(EDGE_SEPARATORS, "");
  return { title, date: m[0].trim() };
}

/**
 * Associe chaque ligne à l'adresse du lien qu'elle contient. `linkPairs` : [[texte du lien, adresse absolue], ...]
 * lus sur la page. Une ligne reçoit le lien dont le texte y figure (le plus long d'abord) ; un lien qui enveloppe
 * un bloc entier (carte d'article) est aussi reconnu quand la ligne est un morceau de ce bloc assez long.
 * @returns {Record<string,string>} ligne → adresse (seulement les lignes pour lesquelles un lien est trouvé)
 */
export function matchLinks(lines, linkPairs) {
  const pairs = [];
  for (const [text, url] of linkPairs || []) {
    const t = cleanLines([text])[0];
    if (t && t.length >= LINK_MIN_TEXT && /^https?:\/\//i.test(url || "")) pairs.push([t, url]);
  }
  pairs.sort((a, b) => b[0].length - a[0].length);
  const out = {};
  for (const line of lines || []) {
    const hit = pairs.find(([t]) => line.includes(t)) || (line.length >= LINK_MIN_TEXT ? pairs.find(([t]) => t.includes(line)) : null);
    if (hit) out[line] = hit[1];
  }
  return out;
}

/**
 * Prépare l'affichage : `items` = vraies nouveautés (titre, date éventuelle, lien éventuel), `others` = lignes
 * parasites ou impossibles à interpréter, mises à part. Une ligne qui ne contient qu'une date est rattachée
 * à l'élément voisin sans date (le précédent d'abord, sinon le suivant), puisque l'ordre de la page est conservé.
 * @param {string[]} added lignes nouvelles (ordre de la page)
 * @param {Record<string,string>} links ligne → adresse
 * @returns {{ items: {title:string, date:string, url:string}[], others: string[] }}
 */
export function buildChangeItems(added, links = {}) {
  const parsed = (added || []).map((line) => ({ line, url: links[line] || "", ...parseLine(line) }));
  const items = [];
  const others = [];
  let pendingDate = ""; // date vue AVANT un titre, à lui donner
  for (const p of parsed) {
    if (!p.title) {
      if (!p.date) continue;
      const prev = items[items.length - 1];
      if (prev && !prev.date) prev.date = p.date;
      else pendingDate = p.date;
      continue;
    }
    const generic = GENERIC_RE.test(p.title) || (p.title.length < TITLE_MIN_CHARS && !p.url);
    if (generic) {
      others.push(p.line);
      continue;
    }
    items.push({ title: p.title, date: p.date || pendingDate, url: p.url });
    pendingDate = "";
  }
  if (pendingDate) others.push(pendingDate);
  // Doublons de titre (même article listé deux fois, ex. "À la une" + liste) : on garde le premier.
  const seen = new Set();
  return { items: items.filter((i) => (seen.has(i.title) ? false : seen.add(i.title))), others };
}
