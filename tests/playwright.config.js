// Configuration Playwright — LOT 0B (TODO-002). Couvre les 2 parcours E2E cœur (e2e/,
// TEST-020/TEST-021) et les tests unitaires navigateur (unit/, TEST-001/TEST-006/TEST-018)
// qui doivent tourner dans un vrai navigateur pour résoudre les imports ES du CDN Firebase
// exactement comme en production (voir tests/README.md pour le détail des contraintes).
//
// Lancé via `firebase emulators:exec` (voir package.json#scripts.test:e2e) : les émulateurs
// Auth/Firestore tournent déjà quand ce fichier s'exécute.
//
// Rapport HTML (en plus de la sortie console `list`) ajouté pour GitHub Actions
// (.github/workflows/tests.yml, étape "Publier le rapport Playwright") — `open: "never"` pour
// ne jamais tenter d'ouvrir un navigateur local pendant un lancement en CI ou en ligne de
// commande ; le dossier `playwright-report/` est celui publié comme artefact.
//
// CORRECTIF DU 28/09/2026 (premier passage RÉEL de toute cette suite en CI, retour de
// Charles-Henri — rapport Playwright joint) : `fullyParallel: false` empêche seulement les
// tests d'un MÊME fichier de tourner en parallèle entre eux — sans `workers` explicite,
// Playwright continue de lancer PLUSIEURS FICHIERS en parallèle (par défaut la moitié des
// cœurs CPU de la machine), ce qui contredit directement le commentaire "un seul jeu de
// comptes de test partagé — éviter les interférences" ci-dessous : la totalité de la suite
// utilise le MÊME compte de test, donc le MÊME document Firestore `gamification/state` (une
// seule ligne d'XP total pour tout le compte) et les MÊMES collections `stickyNotes`/
// `projects`/etc. Deux fichiers de test tournant en parallèle sur ces mêmes documents/
// collections se contaminent mutuellement — confirmé par ce premier passage réel : plusieurs
// échecs "XP delta attendu" recevaient exactement la valeur XP d'un TOUT AUTRE événement du
// barème (ex. "Prompt créé" attendait +3, a reçu +8 — la valeur exacte de "Objectif mis à
// jour"/"Suivi terminé"), signature typique d'une écriture concurrente d'un autre fichier de
// test tombée dans la fenêtre before/after de celui-ci. `workers: 1` force une exécution
// strictement séquentielle de toute la suite (un seul fichier à la fois), le seul réglage qui
// tient réellement la promesse du commentaire ci-dessous — au prix d'un temps total plus long,
// accepté ici puisque cette suite n'a pas vocation à rester rapide au détriment de la fiabilité
// (comptes de test partagés, pas d'isolation par fichier).
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["e2e/**/*.spec.js", "unit/**/*.spec.js"],
  timeout: 30_000,
  fullyParallel: false, // un seul jeu de comptes de test partagé — éviter les interférences (amorce, pas une suite à paralléliser)
  workers: 1, // voir le correctif du 28/09/2026 ci-dessus : seul réglage qui empêche VRAIMENT deux fichiers de tourner en même temps sur le même compte
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  outputDir: "test-results",
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
