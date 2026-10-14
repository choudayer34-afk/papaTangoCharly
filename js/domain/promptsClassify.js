// Classement des prompts par une IA, en un aller-retour copier/coller (08/10/2026, retour de Charles-Henri :
// "sur prompt IA, je ne sais pas comment faire mieux pour mieux organiser les éléments [...] ce ne sont que
// les miens, les autres utilisateurs en auront d'autres" — réponse choisie : tags # + filtres, et pour les
// prompts déjà enregistrés : classement par soi-même ET proposition de l'IA avec import en un clic).
//
// Même principe que l'import de la recherche concurrent (js/domain/veilleResearchImport.js) : Pilotage
// PRÉPARE une demande (liste des prompts), l'utilisateur la colle dans l'IA de son choix, puis recolle la
// réponse JSON ; `parseClassifyResponse()` la lit de façon tolérante. Module PUR (aucun accès Firestore ni DOM) :
// c'est js/views/prompts.js qui montre un aperçu puis pose les tags — rien n'est enregistré avant "Appliquer".
//
// Aucune liste de catégories imposée : chaque utilisateur a ses propres prompts, donc ses propres tags. La
// demande ne fixe qu'un cadre (1 à 3 tags courts par prompt, 5 à 10 tags en tout, réutiliser les tags déjà
// présents) pour obtenir un classement exploitable plutôt qu'un tag différent par prompt.

import { extractJsonText, loosenJson } from "./veilleResearchImport.js";

export const MAX_TAGS_PER_PROMPT = 3;
const MAX_TAG_CHARS = 30;
const DESCRIPTION_MAX_CHARS = 160;

/** Clé courte ("P1", "P2"…) donnée à chaque prompt dans la demande : plus fiable à recopier pour une IA qu'un identifiant technique. */
export function keyFor(index) {
  return `P${index + 1}`;
}

/**
 * @param {Array<{title:string, description?:string}>} prompts dans l'ordre d'affichage (la clé de chacun = `keyFor(index)`)
 * @param {string[]} existingTags noms de tags déjà utilisés sur des prompts (à réutiliser en priorité)
 */
export function buildClassifyRequest(prompts, existingTags = []) {
  const lines = prompts.map((p, i) => {
    const description = String(p.description || "").replace(/\s+/g, " ").trim();
    const short = description.length > DESCRIPTION_MAX_CHARS ? `${description.slice(0, DESCRIPTION_MAX_CHARS - 1)}…` : description;
    return `${keyFor(i)} — ${String(p.title || "").replace(/\s+/g, " ").trim()}${short ? ` — ${short}` : ""}`;
  });
  const existing = existingTags.length
    ? `\nTags déjà utilisés (à réutiliser en priorité quand ils conviennent) : ${existingTags.map((t) => `#${t}`).join(", ")}\n`
    : "";
  return `Tu m'aides à ranger ma bibliothèque de prompts IA avec des tags. Voici mes ${prompts.length} prompts (clé — titre — description) :

${lines.join("\n")}
${existing}
Consignes :
- Donne à chaque prompt 1 à ${MAX_TAGS_PER_PROMPT} tags courts (1 à 2 mots, en minuscules, sans "#") qui décrivent le type de travail ou le domaine (par exemple : communication, management, documentation, cadrage, rh, personnel).
- Vise 5 à 10 tags différents au total pour toute la bibliothèque : réutilise les mêmes tags d'un prompt à l'autre plutôt que d'en inventer un par prompt.
- Classe TOUS les prompts, garde les clés ${keyFor(0)}, ${keyFor(1)}… exactement telles quelles, et n'ajoute, ne retire ni ne reformule aucun prompt.
- Réponds UNIQUEMENT avec un bloc de code JSON, sans texte autour, de cette forme :
\`\`\`json
{ "classement": [ { "cle": "${keyFor(0)}", "tags": ["tag1", "tag2"] } ] }
\`\`\``;
}

function cleanTag(raw) {
  const t = String(raw ?? "")
    .replace(/^#+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return t && t.length <= MAX_TAG_CHARS ? t : "";
}

function toTagList(value) {
  const parts = Array.isArray(value) ? value : String(value ?? "").split(/[,;]/);
  const out = [];
  for (const p of parts) {
    const t = cleanTag(p);
    if (t && !out.includes(t)) out.push(t);
  }
  return out.slice(0, MAX_TAGS_PER_PROMPT);
}

function entriesOf(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    for (const k of ["classement", "classification", "prompts", "resultat", "resultats", "items"]) {
      if (Array.isArray(data[k])) return data[k];
    }
    // Forme alternative { "P1": ["a","b"], "P2": [...] }
    const keyed = Object.entries(data).filter(([k]) => /^p\d+$/i.test(k));
    if (keyed.length) return keyed.map(([k, v]) => ({ cle: k, tags: v }));
  }
  return null;
}

/**
 * @param {string} raw texte collé (réponse de l'IA, avec ou sans texte autour)
 * @param {string[]} validKeys clés envoyées dans la demande (`keyFor(i)`)
 * @returns {{ok:true, assignments:Array<{key:string, tags:string[]}>, unknownKeys:string[], missingKeys:string[]} | {ok:false, error:string}}
 *   `assignments` : un élément par prompt reconnu AYANT au moins un tag, dans l'ordre de la réponse ;
 *   `unknownKeys` : clés de la réponse qui ne correspondent à aucun prompt (ignorées) ;
 *   `missingKeys` : prompts que la réponse n'a pas classés.
 */
export function parseClassifyResponse(raw, validKeys) {
  const text = String(raw || "");
  // Réponse qui EST un tableau [ ... ] (éventuellement dans un bloc ```json) : repérée avant `extractJsonText`,
  // qui ne cherche que des objets { } et ne retiendrait que le premier élément du tableau.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : text).trim();
  const isArray = body.startsWith("[");
  const candidate = isArray ? body.slice(0, body.lastIndexOf("]") + 1) : extractJsonText(text);
  if (!candidate) {
    return { ok: false, error: "Je ne trouve aucun bloc JSON dans ce texte. Demande à l'IA de répondre uniquement avec le bloc JSON demandé, puis recolle sa réponse." };
  }
  let data;
  try {
    data = JSON.parse(candidate);
  } catch {
    try {
      data = JSON.parse(loosenJson(candidate));
    } catch {
      return { ok: false, error: "Le bloc JSON est illisible (guillemets ou virgules cassés par le copier-coller). Recopie-le depuis la zone de code de l'IA, ou demande-lui de le redonner en JSON valide." };
    }
  }
  const entries = entriesOf(data);
  if (!entries) {
    return { ok: false, error: "Le JSON collé n'a pas la forme attendue (une liste « classement » avec, pour chaque prompt, sa clé et ses tags)." };
  }
  const valid = new Set((validKeys || []).map((k) => String(k).toUpperCase()));
  const byKey = new Map();
  const unknown = [];
  for (const e of entries) {
    if (!e || typeof e !== "object") continue;
    const key = String(e.cle ?? e.clé ?? e.key ?? e.id ?? "").trim().toUpperCase();
    if (!key) continue;
    if (!valid.has(key)) {
      if (!unknown.includes(key)) unknown.push(key);
      continue;
    }
    const tags = toTagList(e.tags ?? e.tag ?? e.etiquettes ?? e["étiquettes"]);
    if (!tags.length) continue;
    const merged = [...(byKey.get(key) || []), ...tags.filter((t) => !(byKey.get(key) || []).includes(t))].slice(0, MAX_TAGS_PER_PROMPT);
    byKey.set(key, merged);
  }
  const assignments = [...byKey.entries()].map(([key, tags]) => ({ key, tags }));
  if (!assignments.length) {
    return { ok: false, error: "Le JSON est lisible mais ne contient aucun classement exploitable (clés P1, P2… avec au moins un tag)." };
  }
  const missingKeys = [...valid].filter((k) => !byKey.has(k));
  return { ok: true, assignments, unknownKeys: unknown, missingKeys };
}
