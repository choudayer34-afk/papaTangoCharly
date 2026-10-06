// 06/10/2026 — relais de lecture de la veille (functions/api/veille-proxy.js). La fonction ne dépend que
// des API web standard (Request/Response/fetch) : on l'appelle directement sous Node avec un `fetch`
// simulé, sans Cloudflare ni réseau. Vérifié une première fois hors du dépôt avant la livraison ; à
// reconfirmer au premier passage réel de la CI. Le comportement réel sur Cloudflare Pages (déploiement
// du dossier functions/, sites qui bloquent les adresses du relais) ne peut PAS être couvert ici.

import { test, expect } from "@playwright/test";
import { onRequestGet, validateTarget, isSameSiteRequest } from "../../functions/api/veille-proxy.js";

const ORIGIN = "https://pilotage.example";
const call = (target, headers = { "Sec-Fetch-Site": "same-origin" }) =>
  onRequestGet({ request: new Request(`${ORIGIN}/api/veille-proxy?url=${encodeURIComponent(target)}`, { headers }) });

function mockFetch(handler) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => handler(url, init);
  return () => (globalThis.fetch = original);
}

test.describe("veille-proxy — validateTarget", () => {
  test("accepte les sites publics http(s)", () => {
    expect(validateTarget("https://www.semae.fr/reglementation-semences/")?.hostname).toBe("www.semae.fr");
    expect(validateTarget("http://exemple.fr:80/x")).not.toBeNull();
  });
  test("refuse schémas, identifiants, ports, IP, noms internes", () => {
    for (const bad of [
      "ftp://exemple.fr/", "file:///etc/passwd", "javascript:alert(1)", "https://user:pw@exemple.fr/", "https://exemple.fr:8080/",
      "http://127.0.0.1/", "http://10.0.0.5/", "http://[::1]/", "http://localhost/", "http://intranet/", "http://service.internal/",
      "http://a.localhost/", "", "pas une url",
    ]) {
      expect(validateTarget(bad), bad).toBeNull();
    }
  });
});

test.describe("veille-proxy — origine de l'appel", () => {
  test("même origine OK ; cross-site, absent ou Referer étranger refusés", () => {
    const mk = (h) => new Request(`${ORIGIN}/api/veille-proxy?url=x`, { headers: h });
    expect(isSameSiteRequest(mk({ "Sec-Fetch-Site": "same-origin" }))).toBe(true);
    expect(isSameSiteRequest(mk({ "Sec-Fetch-Site": "cross-site" }))).toBe(false);
    expect(isSameSiteRequest(mk({}))).toBe(false);
    expect(isSameSiteRequest(mk({ Referer: `${ORIGIN}/index.html` }))).toBe(true);
    expect(isSameSiteRequest(mk({ Referer: "https://autre.example/" }))).toBe(false);
  });
});

test.describe("veille-proxy — onRequestGet", () => {
  test("403 hors de l'app, 400 sur URL refusée, sans appel réseau", async () => {
    let calls = 0;
    const restore = mockFetch(() => { calls++; return new Response("x"); });
    try {
      expect((await call("https://exemple.fr/", { "Sec-Fetch-Site": "cross-site" })).status).toBe(403);
      expect((await call("http://127.0.0.1/")).status).toBe(400);
      expect(calls).toBe(0);
    } finally { restore(); }
  });

  test("200 : renvoie le HTML en text/plain nosniff, sans transmettre de cookie", async () => {
    let seen;
    const restore = mockFetch((url, init) => { seen = { url, init }; return new Response("<html>ok é</html>", { headers: { "Content-Type": "text/html; charset=utf-8" } }); });
    try {
      const res = await call("https://exemple.fr/actus", { "Sec-Fetch-Site": "same-origin", Cookie: "secret=1", Authorization: "Bearer x" });
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("<html>ok é</html>");
      expect(res.headers.get("Content-Type")).toContain("text/plain");
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      expect(seen.url).toBe("https://exemple.fr/actus");
      expect(JSON.stringify(seen.init.headers)).not.toMatch(/secret|Bearer/);
    } finally { restore(); }
  });

  test("décode un charset non UTF-8", async () => {
    const bytes = new Uint8Array([0x63, 0x61, 0x66, 0xe9]); // "café" en latin1
    const restore = mockFetch(() => new Response(bytes, { headers: { "Content-Type": "text/html; charset=iso-8859-1" } }));
    try { expect(await (await call("https://exemple.fr/")).text()).toBe("café"); } finally { restore(); }
  });

  test("erreurs : site HTTP 404 → 502 explicite, injoignable → 502, délai → 504, binaire → 415, trop gros → 413", async () => {
    const cases = [
      [() => new Response("nope", { status: 404 }), 502, /HTTP 404/],
      [() => { throw new TypeError("fetch failed"); }, 502, /injoignable/],
      [() => { const e = new Error("t"); e.name = "TimeoutError"; throw e; }, 504, /à temps/],
      [() => new Response("%PDF", { headers: { "Content-Type": "application/pdf" } }), 415, /pdf/],
      [() => new Response("x", { headers: { "Content-Type": "text/html", "Content-Length": "5000000" } }), 413, /volumineuse/],
      [() => new Response("a".repeat(2_100_000), { headers: { "Content-Type": "text/html" } }), 413, /volumineuse/],
    ];
    for (const [handler, status, msg] of cases) {
      const restore = mockFetch(handler);
      try {
        const res = await call("https://exemple.fr/");
        expect(res.status).toBe(status);
        expect(await res.text()).toMatch(msg);
      } finally { restore(); }
    }
  });
});
