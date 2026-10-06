// Import "en un clic" de la réponse d'une IA sur un concurrent (06/10/2026, retour de Charles-Henri :
// "la recherche sur les concurrents devrait pouvoir se faire beaucoup plus facilement et de manière
// automatisée via les IA" — option "A. Import en 1 clic" choisie parmi 3 voies proposées, la voie
// "vraiment automatique" via un relais serveur + clé API ayant été écartée pour l'instant).
//
// Principe : le prompt généré par js/domain/veille.js#competitorResearchPrompt demande à l'IA (ici
// Perplexity, mais n'importe quelle IA avec recherche web convient) de répondre par UN SEUL bloc JSON
// au format ci-dessous ; `parseCompetitorResearchResponse()` lit ce bloc de façon tolérante et le
// traduit en champs de la fiche Pilotage. Aucune écriture ici : ce module est PUR (aucun import, ni
// Firestore ni DOM) — c'est js/views/veille.js qui remplit le formulaire, que Charles-Henri relit puis
// enregistre lui-même (rien n'est sauvegardé tant qu'il ne clique pas "Enregistrer").
//
// Module séparé de js/domain/veille.js (qui importe storage.js, donc Firebase) justement pour pouvoir
// être testé tel quel sous Node, sans mock.

/** Modèle de réponse affiché dans le prompt — les clés ici sont celles que le parseur reconnaît. */
export const RESEARCH_JSON_TEMPLATE = `{
  "ca": "chiffre d'affaires le plus récent, très court, avec l'année — ex. ~15 M€ (2024)",
  "note": "note courte et pratique : mot-clé d'alerte, point de vigilance, prochaine chose à vérifier",
  "actualites": "actualités et évolutions récentes (produits, levées de fonds, recrutements, partenariats...)",
  "resume": "qui ils sont et leur positionnement marché, 2-3 phrases",
  "forces": "leurs forces",
  "faiblesses": "leurs faiblesses",
  "opportunites": "leurs opportunités",
  "menaces": "leurs menaces (hors de leur contrôle)",
  "force_agreo": "la force d'Agreo face à CE concurrent, d'après l'info publique uniquement",
  "specialisation": 0,
  "visibilite_roadmap": 0,
  "site": "URL du site officiel, ou chaîne vide",
  "linkedin": "URL de la page LinkedIn entreprise, ou chaîne vide",
  "pappers": "URL de la fiche Pappers, ou chaîne vide",
  "sources": [{ "info": "ce que cette source prouve", "url": "https://..." }]
}`;

const TEXT_KEYS = ["ca", "note", "actualites", "resume", "forces", "faiblesses", "opportunites", "menaces", "force_agreo"];
const URL_KEYS = ["site", "linkedin", "pappers"];
const SCORE_KEYS = ["specialisation", "visibilite_roadmap"];
const ALL_KEYS = [...TEXT_KEYS, ...SCORE_KEYS, ...URL_KEYS, "sources"];

/** Marqueurs de citation façon Perplexity ("[1]", "[2][3]") — glissés dans le texte, jamais voulus ici. */
const CITATION_MARKERS = /\s*(?:\[\d{1,2}\])+/g;

// Variantes de clés rencontrées en pratique (l'IA reformule parfois le nom d'un champ) — normalisées
// vers la clé du modèle. Volontairement courte : on ne devine pas au-delà du raisonnable.
const KEY_ALIASES = { force_d_agreo: "force_agreo", forces_agreo: "force_agreo", visibilite_de_la_roadmap: "visibilite_roadmap" };

function normalizeKey(key) {
  const base = String(key)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return KEY_ALIASES[base] || base;
}

/** Texte → chaîne propre ; un tableau devient une liste "- ..." (certaines IA renvoient une liste). */
function toText(value) {
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value
      .map((v) => toText(v))
      .filter(Boolean)
      .map((v) => `- ${v}`)
      .join("\n");
  }
  if (typeof value === "object") return "";
  return String(value).replace(CITATION_MARKERS, "").trim();
}

function toHttpUrl(value) {
  const s = toText(value);
  return /^https?:\/\/\S+$/i.test(s) ? s : "";
}

function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(10, Math.max(0, Math.round(n)));
}

/** Isole le JSON dans le texte collé : bloc ```json ... ``` s'il y en a un, sinon du premier "{" au dernier "}". */
function extractJsonText(raw) {
  const text = String(raw || "").replace(/^﻿/, "");
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced && fenced[1].includes("{") ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return candidate.slice(start, end + 1);
}

/**
 * Nettoyages tolérés avant un second essai de JSON.parse : retours à la ligne/tabulations BRUTS à
 * l'intérieur d'une chaîne (interdits en JSON strict, fréquents quand une IA ou un copier-coller
 * "déplie" un texte multi-lignes) et virgules finales avant } ou ].
 */
function loosenJson(jsonText) {
  let out = "";
  let inString = false;
  let escaped = false;
  for (const ch of jsonText) {
    if (inString) {
      if (escaped) {
        escaped = false;
        out += ch;
      } else if (ch === "\\") {
        escaped = true;
        out += ch;
      } else if (ch === '"') {
        inString = false;
        out += ch;
      } else if (ch === "\n" || ch === "\r") {
        out += ch === "\n" ? "\\n" : "";
      } else if (ch === "\t") {
        out += "\\t";
      } else {
        out += ch;
      }
    } else {
      if (ch === '"') inString = true;
      out += ch;
    }
  }
  return out.replace(/,\s*([}\]])/g, "$1");
}

/**
 * @param {string} raw texte collé par l'utilisateur (réponse de l'IA, avec ou sans texte autour)
 * @returns {{ ok: true, fields: object, filled: string[], missing: string[] } | { ok: false, error: string }}
 *   `fields` utilise les noms de champs de Pilotage ; seuls les champs réellement fournis (non vides)
 *   y figurent — `filled` en liste les noms lisibles, `missing` ceux du modèle absents/vides.
 */
export function parseCompetitorResearchResponse(raw, { now = new Date() } = {}) {
  const jsonText = extractJsonText(raw);
  if (!jsonText) {
    return { ok: false, error: "Je ne trouve aucun bloc JSON dans ce texte. Demande à l'IA de répondre uniquement avec le bloc JSON du modèle, puis recolle sa réponse." };
  }
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch {
    try {
      data = JSON.parse(loosenJson(jsonText));
    } catch {
      return { ok: false, error: "Le bloc JSON est illisible (guillemets ou virgules cassés par le copier-coller). Recopie-le depuis la zone de code de l'IA, ou demande-lui de le redonner uniquement en JSON valide." };
    }
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: "Le JSON collé n'a pas la forme attendue (un objet avec les champs du modèle)." };
  }

  const byKey = {};
  for (const [k, v] of Object.entries(data)) byKey[normalizeKey(k)] = v;
  if (!ALL_KEYS.some((k) => k in byKey)) {
    return { ok: false, error: "Le JSON ne contient aucun des champs du modèle (ca, note, resume, forces...). Vérifie que l'IA a bien suivi le modèle de la demande." };
  }

  const fields = {};
  const filled = [];
  const take = (key, field, label, value) => {
    if (value === "" || value == null) return;
    fields[field] = value;
    filled.push(label);
  };

  take("ca", "ca", "CA", toText(byKey.ca));
  take("resume", "profileSummary", "Résumé", toText(byKey.resume));
  take("forces", "competitorStrengths", "Forces", toText(byKey.forces));
  take("faiblesses", "competitorWeaknesses", "Faiblesses", toText(byKey.faiblesses));
  take("opportunites", "opportunities", "Opportunités", toText(byKey.opportunites));
  take("menaces", "threats", "Menaces", toText(byKey.menaces));
  take("force_agreo", "agreoStrengths", "Force d'Agreo", toText(byKey.force_agreo));
  take("specialisation", "specializationScore", "Spécialisation", clampScore(byKey.specialisation));
  take("visibilite_roadmap", "roadmapVisibilityScore", "Visibilité roadmap", clampScore(byKey.visibilite_roadmap));
  take("site", "url", "Site", toHttpUrl(byKey.site));
  take("linkedin", "linkedinUrl", "LinkedIn", toHttpUrl(byKey.linkedin));
  take("pappers", "pappersUrl", "Pappers", toHttpUrl(byKey.pappers));

  // Le champ "Note" de Pilotage est le seul endroit libre de la fiche pour les actualités et les
  // sources (le tableau du Benchmark visuel en affiche la fin dans "Dernière note / évolution") :
  // note courte d'abord, puis actualités, puis sources DATÉES du jour de la recherche — pour pouvoir
  // vérifier et dater l'info plus tard (demande du 02/10/2026).
  const noteParts = [];
  const note = toText(byKey.note);
  if (note) noteParts.push(note);
  const news = toText(byKey.actualites);
  if (news) noteParts.push(`Actualités récentes : ${news}`);
  const sourceLines = (Array.isArray(byKey.sources) ? byKey.sources : [])
    .map((s) => {
      if (typeof s === "string") return toText(s);
      const info = toText(s?.info);
      const url = toHttpUrl(s?.url);
      return [info, url].filter(Boolean).join(" — ");
    })
    .filter(Boolean)
    .map((l) => `- ${l}`);
  if (sourceLines.length) {
    noteParts.push(`Sources (recherche du ${now.toLocaleDateString("fr-FR")}) :\n${sourceLines.join("\n")}`);
  }
  if (noteParts.length) {
    fields.notes = noteParts.join("\n\n");
    filled.push("Note");
  }

  const missing = [];
  if (!fields.ca) missing.push("CA");
  if (!fields.notes) missing.push("Note");
  if (!fields.profileSummary) missing.push("Résumé");
  if (!fields.competitorStrengths) missing.push("Forces");
  if (!fields.competitorWeaknesses) missing.push("Faiblesses");
  if (!fields.opportunities) missing.push("Opportunités");
  if (!fields.threats) missing.push("Menaces");
  if (!fields.agreoStrengths) missing.push("Force d'Agreo");

  if (!filled.length) {
    return { ok: false, error: "Le JSON est lisible mais tous ses champs sont vides — l'IA n'a rien trouvé. Relance la recherche (ou complète la fiche à la main)." };
  }
  return { ok: true, fields, filled, missing };
}
