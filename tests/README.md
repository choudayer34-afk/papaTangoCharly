# Tests — Socle P0 (LOT 0B, TODO-002)

Dossier isolé et versionné, avec son propre `package.json` — décision produit du 20/09/2026
(voir `TODO_TECHNIQUE.md` → TODO-002/LOT 0B). L'application elle-même (`js/`, `index.html`,
`styles/`) reste intégralement vanilla JS, sans build : rien ici ne s'applique à elle, à
l'exception d'une dérogation ciblée et documentée dans `js/services/firebase.js` (voir plus bas).

**Amorce, pas une suite complète** : ce lot ne couvre que 7 des 27 manques recensés dans
`AUDIT_TESTS.md` — TEST-001, TEST-002, TEST-006, TEST-018 (partiellement), TEST-020, TEST-021,
TEST-027. Les 20 autres restent en backlog non planifié (section 4.2 de `TODO_TECHNIQUE.md`).

## ⚠️ État au 21/09/2026 : passages GitHub Actions en cours de correction

**3ᵉ correction du 21/09/2026 (test:rules 12/12 ✅, test:e2e 3/9 → corrections apportées)** :
une fois les deux problèmes d'infrastructure précédents résolus, `npm run test:rules` est passé
au vert (12/12). `npm run test:e2e` a lui révélé 6 échecs, tous diagnostiqués :

- **3 échecs `unit/isEmailAllowed.spec.js` (TEST-001)** — `FirebaseError: false for 'get'`. La
  règle corrigée en LOT 0A (FIREBASE-002/SEC-004) n'autorise la lecture de
  `allowedUsers/{email}` que par son propre titulaire authentifié ; le test appelait
  `isEmailAllowed()` pour trois emails différents (inconnu, alice, bob) sans jamais se
  connecter. Corrigé en ajoutant un compte Auth émulateur par email testé
  (`e2e/global-setup.js#UNIT_TEST_USERS`) et une connexion (`signInEmail`) avant chaque
  vérification.
- **3 échecs `e2e/capture-qualification.spec.js`, `e2e/projet-creation-cloture.spec.js` et
  `unit/regressions.spec.js` (TEST-020, TEST-021, TEST-018)** — `.fab`/boutons jamais visibles
  après connexion. Ces trois fichiers naviguent directement vers `/index.html` (la vraie page de
  l'app) sans jamais poser `globalThis.__PILOTAGE_USE_FIREBASE_EMULATOR__ = true` : contrairement
  à `support/harness.html` (qui le pose via un `<script>` classique avant l'import du module),
  rien ne posait ce drapeau pour ces trois tests — l'app se connectait donc à la vraie production
  Firebase, où le compte de test `alice@example.com` n'existe pas, faisant échouer la connexion
  silencieusement. Corrigé en ajoutant `page.addInitScript(() => { window.__PILOTAGE_USE_FIREBASE_EMULATOR__ = true; })`
  avant le premier `page.goto()` de chacun de ces trois fichiers.

Aucun fichier applicatif n'a été touché par ces corrections — uniquement des fichiers de ce
dossier `tests/`. Un bug distinct, trouvé par `test:rules` lors de ce même passage et corrigé
dans `firestore.rules` lui-même (pas un problème de test), est documenté dans `TODO_TECHNIQUE.md`
→ TODO-001.

**2ᵉ correction du 21/09/2026** : le premier lancement réel du workflow GitHub Actions
(`.github/workflows/tests.yml`) a échoué dès `npm run test:rules` avec
`Error: ../firestore.rules is outside of project directory`. Le CLI Firebase interdit qu'un
fichier référencé dans `firebase.json` (ici, `firestore.rules`) se trouve en dehors du dossier
qui contient ce `firebase.json` — or ce fichier vivait jusqu'ici dans `tests/` et pointait vers
`../firestore.rules` (à la racine). Corrigé en déplaçant `firebase.json` à la racine du dépôt,
à côté de `firestore.rules` (voir ce fichier pour le détail) ; les scripts de ce `package.json`
référencent maintenant ce fichier via `--config ../firebase.json`. `firestore.rules` lui-même
n'a pas bougé et n'a pas changé.

## État précédent (20/09/2026) : écrit, non exécuté

Tout le code de ce dossier a été écrit et relu manuellement, mais **n'a pas pu être exécuté** dans
l'environnement où il a été rédigé : le registre npm (`registry.npmjs.org`) y est bloqué par la
politique réseau de cet environnement (confirmé par une requête directe, réponse HTTP 403 *"Host
not in allowlist"* — pas une panne temporaire, donc pas contourné ni recontacté). Sans accès au
registre, `firebase-tools`, `@firebase/rules-unit-testing` et `@playwright/test` n'ont pas pu être
installés, et donc aucun test n'a pu être lancé ni validé.

**Pour valider réellement ce lot**, exécute ce qui suit depuis un environnement où `npm install`
fonctionne (ta machine, une CI classique...) :

```bash
cd tests
npm install
npm run test:rules   # tests de règles Firestore (TEST-027, TEST-002)
npm run test:e2e     # 2 parcours E2E + tests unitaires navigateur (TEST-001, TEST-006, TEST-018, TEST-020, TEST-021)
```

Étant donné que ce code n'a jamais tourné, il faut s'attendre à devoir corriger de petits détails
au premier lancement (nom exact d'une option d'API, sélecteur qui a changé, etc.) — voir les
avertissements en tête de chaque fichier de test pour les points les plus incertains.

## Pourquoi le projet Firebase réel (`papatangocharly`) apparaît dans les commandes

Les scripts utilisent `--project papatangocharly` (voir `package.json` et
`tests/support/seed.js`) — c'est le **même** projectId que celui codé en dur dans
`js/services/firebase.js` (`firebaseConfig.projectId`). C'est nécessaire et sans risque : les
émulateurs Auth/Firestore tournent **entièrement en local**, aucune donnée n'est jamais envoyée
au vrai projet Cloud. Utiliser un projectId différent pour les tests ferait que l'app (qui garde
toujours son vrai `projectId` même connectée à l'émulateur, `connectFirestoreEmulator`/
`connectAuthEmulator` ne changent que l'adresse réseau, pas l'identité du projet) ne verrait
jamais les données semées par les tests.

## Dérogation exceptionnelle à « aucun fichier applicatif modifié » (LOT 0B)

TODO-002 précise que ce lot ne doit modifier aucun fichier applicatif. Une exception ciblée a été
validée par Charles-Henri le 20/09/2026 : quelques lignes dans `js/services/firebase.js` qui
redirigent l'app vers l'émulateur Firebase local **uniquement** si
`globalThis.__PILOTAGE_USE_FIREBASE_EMULATOR__ === true` — un indicateur que seul le harnais de
test (`tests/support/harness.html`) ou une page de test pose, jamais l'application elle-même.
Inactif par défaut, donc **aucun changement de comportement en production**. Voir le commentaire
correspondant dans `firebase.js` et l'entrée TODO-002 de `TODO_TECHNIQUE.md` pour le détail
complet de cette dérogation et sa justification.

## Structure

- `package.json`, `.gitignore` — outillage du dossier de tests. `firebase.json` vit désormais à
  la racine du dépôt, à côté de `firestore.rules` (voir la correction du 21/09/2026 ci-dessus).
- `rules/firestore.rules.test.js` — TEST-027 + TEST-002, tests de règles purs (n'importent aucun
  fichier applicatif, ne parlent qu'à l'émulateur Firestore directement via
  `@firebase/rules-unit-testing`).
- `support/seed.js` — comptes/documents de test partagés (alice = autorisé, bob = fermé
  `disabled: true`, admin = `ch-houdayer@hotmail.fr`).
- `support/harness.html` — page de test minimale qui importe les vrais modules de l'app
  (`js/services/firebase.js`, `js/services/storage.js`, `js/domain/inbox.js`) pour les tests
  unitaires navigateur ; ne fait pas partie de l'application livrée.
- `support/static-server.js` — petit serveur statique sans dépendance (sert la racine du dépôt
  pendant les tests, comme le ferait Cloudflare Pages en production).
- `unit/` — TEST-001 (`isEmailAllowed`), TEST-006 (file de sérialisation `storage.js#update`),
  TEST-018 amorce (régression connexion/liste blanche uniquement — voir l'avertissement en tête
  de `unit/regressions.spec.js` pour les cas non couverts par cette amorce).
- `e2e/global-setup.js` — crée le compte de test dans l'émulateur Auth avant les suites `e2e/`
  et `unit/`.
- `e2e/capture-qualification.spec.js` — TEST-020.
- `e2e/projet-creation-cloture.spec.js` — TEST-021.

## Ce qui reste hors périmètre de cette amorce (backlog, non traité ici)

- Les 20 autres manques de `AUDIT_TESTS.md` (voir section 4.2 de `TODO_TECHNIQUE.md`).
- Dans TEST-018 : le mapping legacy de `js/domain/followups.js` et le callback d'erreur
  `onSnapshot` de `js/services/storage.js` (bug déjà corrigé dans le code, pas encore couvert par
  un test dédié).
- Toute validation de règles Firestore dans la vraie console Firebase (relève de TODO-001/LOT 0A
  — voir son statut dans `TODO_TECHNIQUE.md`).
