// Relais de lecture pour l'écran Veille (06/10/2026, retour de Charles-Henri : les deux proxys publics
// gratuits — allorigins et codetabs — échouaient en même temps sur toutes les sources ; réponse choisie
// parmi trois pistes : "les 3 du moment que ça reste gratuit"). Fonction Cloudflare Pages : le dossier
// `functions/` du dépôt est détecté et déployé AUTOMATIQUEMENT par Cloudflare Pages au même push que le
// reste de l'app, sans réglage ni clé API, dans le quota gratuit (Workers : 100 000 requêtes/jour).
//
// Rôle : récupérer le HTML d'une page à la place du navigateur (qui ne peut pas le faire lui-même : la
// quasi-totalité des sites n'envoient pas d'en-tête CORS). js/domain/veille.js l'appelle EN PREMIER
// (`/api/veille-proxy?url=...`) et ne se rabat sur allorigins/codetabs que si elle échoue.
//
// Ce n'est PAS un proxy ouvert : une fonction publique qui récupère n'importe quelle URL pour n'importe
// qui serait détournée (quota, anonymisation d'attaques). Garde-fous :
//  - réservée à l'app elle-même (`Sec-Fetch-Site: same-origin`, ou à défaut un Referer de ce site) ;
//  - GET uniquement ; http(s) seulement, sans identifiants dans l'URL, ports 80/443 uniquement ;
//  - adresses IP littérales, "localhost" et noms sans point refusés (pas de rebond vers un réseau interne) ;
//  - aucun cookie ni en-tête de l'appelant n'est transmis au site ;
//  - délai maximum de 12 s, taille maximum de 2 Mo, contenus texte/HTML/XML seulement ;
//  - la réponse est renvoyée en `text/plain` + `nosniff` + `sandbox` : jamais interprétée comme une page de
//    ce site, même si quelqu'un ouvre l'adresse directement dans un navigateur.
// Limite assumée : un script qui falsifie ces en-têtes (curl) peut encore l'appeler — le coût se limite
// alors au quota gratuit de lecture de pages publiques ; pas de donnée de Charles-Henri en jeu (aucune
// donnée Firestore ni identifiant ne passe par ici).

const TIMEOUT_MS = 12000;
const MAX_BYTES = 2_000_000;
const ALLOWED_TYPES = /^(text\/|application\/(xhtml\+xml|xml|rss\+xml|atom\+xml))/i;

function reply(status, body) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
    },
  });
}

/** Renvoie l'URL cible si elle est acceptable, sinon `null`. Exportée pour les tests. */
export function validateTarget(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  if (u.port && u.port !== "80" && u.port !== "443") return null;
  const host = u.hostname.toLowerCase();
  if (!host.includes(".") && !host.includes(":")) return null; // "localhost", noms internes
  if (host.startsWith("[") || host.includes(":")) return null; // IPv6 littérale
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null; // IPv4 littérale
  if (host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return null;
  return u;
}

/** `true` si la requête vient de l'app elle-même. Exportée pour les tests. */
export function isSameSiteRequest(request) {
  const site = request.headers.get("Sec-Fetch-Site");
  if (site) return site === "same-origin";
  const referer = request.headers.get("Referer");
  if (!referer) return false;
  try {
    return new URL(referer).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function readCapped(response, maxBytes) {
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

function decode(bytes, contentType) {
  const charset = /charset=([^\s;]+)/i.exec(contentType || "")?.[1]?.replace(/["']/g, "") || "utf-8";
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

export async function onRequestGet({ request }) {
  if (!isSameSiteRequest(request)) return reply(403, "Réservé à l'application Pilotage.");
  const target = validateTarget(new URL(request.url).searchParams.get("url") || "");
  if (!target) return reply(400, "URL refusée (http/https public uniquement).");

  let upstream;
  try {
    upstream = await fetch(target.toString(), {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.5",
        "User-Agent": "Mozilla/5.0 (compatible; PilotageVeille/1.0)",
      },
    });
  } catch (e) {
    const timedOut = e?.name === "TimeoutError" || e?.name === "AbortError";
    return reply(timedOut ? 504 : 502, timedOut ? "Le site n'a pas répondu à temps." : "Le site est injoignable depuis le relais.");
  }
  if (!upstream.ok) return reply(502, `Le site a répondu HTTP ${upstream.status}.`);
  const type = upstream.headers.get("Content-Type") || "";
  if (type && !ALLOWED_TYPES.test(type)) return reply(415, `Type de contenu non pris en charge (${type.split(";")[0]}).`);

  const declared = Number(upstream.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > MAX_BYTES) return reply(413, "Page trop volumineuse.");
  let bytes;
  try {
    bytes = await readCapped(upstream, MAX_BYTES);
  } catch {
    return reply(502, "Lecture de la page interrompue.");
  }
  if (!bytes) return reply(413, "Page trop volumineuse.");
  return reply(200, decode(bytes, type));
}
