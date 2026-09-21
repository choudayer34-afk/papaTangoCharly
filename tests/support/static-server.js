// Serveur statique minimal, sans dépendance, utilisé uniquement par les tests (Playwright
// `webServer`, voir tests/playwright.config.js) pour servir l'application telle quelle
// (index.html, js/, styles/...) ainsi que tests/support/harness.html, exactement comme le ferait
// Cloudflare Pages en production — sans introduire de dépendance supplémentaire (`serve`,
// `http-server`...) juste pour les tests. N'écrit ni ne modifie aucun fichier de l'application.
//
// Usage : node static-server.js [port]  (racine servie : la racine du dépôt, deux niveaux
// au-dessus de tests/support/).

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const PORT = Number(process.argv[2] || process.env.PORT || 5050);

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (reqPath === "/") reqPath = "/index.html";
  const filePath = path.normalize(path.join(ROOT, reqPath));

  // Ne jamais servir en dehors de la racine du dépôt (garde-fou basique contre `..`).
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(`Introuvable : ${reqPath}`);
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": CONTENT_TYPES[ext] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[static-server] Sert ${ROOT} sur http://127.0.0.1:${PORT}`);
});
