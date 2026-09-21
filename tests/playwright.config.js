// Configuration Playwright — LOT 0B (TODO-002). Couvre les 2 parcours E2E cœur (e2e/,
// TEST-020/TEST-021) et les tests unitaires navigateur (unit/, TEST-001/TEST-006/TEST-018)
// qui doivent tourner dans un vrai navigateur pour résoudre les imports ES du CDN Firebase
// exactement comme en production (voir tests/README.md pour le détail des contraintes).
//
// Lancé via `firebase emulators:exec` (voir package.json#scripts.test:e2e) : les émulateurs
// Auth/Firestore tournent déjà quand ce fichier s'exécute.

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["e2e/**/*.spec.js", "unit/**/*.spec.js"],
  timeout: 30_000,
  fullyParallel: false, // un seul jeu de comptes de test partagé — éviter les interférences (amorce, pas une suite à paralléliser)
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.js",
  use: {
    baseURL: "http://127.0.0.1:5050",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node support/static-server.js 5050",
    url: "http://127.0.0.1:5050/index.html",
    reuseExistingServer: false,
    timeout: 15_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
