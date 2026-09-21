# Tests — Socle P0 (LOT 0B, TODO-002)

Dossier isolé et versionné, avec son propre `package.json` — décision produit du 20/09/2026
(voir `TODO_TECHNIQUE.md` → TODO-002/LOT 0B). L'application elle-même (`js/`, `index.html`,
`styles/`) reste intégralement vanilla JS, sans build : rien ici ne s'applique à elle, à
l'exception d'une dérogation ciblée et documentée dans `js/services/firebase.js` (voir plus bas).

**Amorce, pas une suite complète** : ce lot ne couvre que 7 des 27 manques recensés dans
`AUDIT_TESTS.md` — TEST-001, TEST-002, TEST-006, TEST-018 (partiellement), TEST-020, TEST-021,
TEST-027. Les 20 autres restent en backlog non planifié (section 4.2 de `TODO_TECHNIQUE.md`).

## LOT 1 (TODO-006, TODO-007) — ajouté le 21/09/2026

Trois nouveaux fichiers, sur le même principe que le reste de ce dossier (émulateur Firebase,
jamais la production).

- **`e2e/lot1-form-validation.spec.js`** (TEST-017) — retour visuel explicite (toast + surbrillance
  `.field-invalid`) sur un champ obligatoire vide (Tâche, Projet, Ressource) et sur une URL mal
  formée (Ressource), introduit par `js/components/formValidation.js`.
- **`e2e/lot1-orphan-references.spec.js`** (TEST-010) — une tâche liée à un projet supprimé reste
  affichée normalement (sans badge projet, sans erreur JS) — `js/views/kanban.js#renderCard`
  gérait déjà ce cas par un simple `.find()` défensif, ce test fige ce comportement.
- **`unit/lot1-closure.spec.js`** (TEST-025) — clôture Tâche/Projet/Suivi : statut et
  `completedAt` corrects, et absence de cascade sur les entités rattachées (ex. clôturer un
  projet ne modifie pas les tâches qui lui sont liées). Utilise `tests/support/harness.html`,
  auquel `tasksApi`/`projectsApi`/`followUpsApi` ont été ajoutés (mêmes modules applicatifs déjà
  exposés pour LOT 0B, aucun changement à ces trois fichiers).

**Correction du 21/09/2026 (premier passage réel du workflow GitHub Actions)** : `test:e2e` est
passé à 16/17. TEST-017 (4/4) et TEST-025 (3/3) sont verts dès ce premier passage. TEST-010 a
échoué sur un bug du test lui-même, pas de l'application : `await expect(page.getByText("tâche"))`
sur le message de confirmation de suppression était ambigu — il matchait aussi l'onglet "📋
Tâches" et un toast "Tâche créée" encore présent dans le DOM (3 éléments trouvés), exactement la
même famille de strict-mode violation déjà rencontrée en LOT 0B sur `capture-qualification.spec.js`
et `projet-creation-cloture.spec.js`. Corrigé en scopant l'assertion à `.modal-body` (une seule
modale active à cet instant, voir `js/components/modal.js#openModal`) — à reconfirmer au prochain
passage réel.

**Confirmation du 21/09/2026** : Charles-Henri a confirmé que les tests du LOT 1 ont depuis été
exécutés avec succès via GitHub Actions, correctif TEST-010 inclus. Les trois tests de ce lot
(TEST-017, TEST-010, TEST-025) sont donc désormais tous verts en CI réelle.

**Non traité par ce lot** : les contraintes de validation côté `firestore.rules` prévues par
TODO-006 (SEC-011, tailles/types sur `tasks`/`inboxItems`). Ce volet s'est heurté à une contrainte
d'architecture des règles (`match` récursif unique sur `users/{uid}/{document=**}`, évaluation OR
de Firestore — voir TODO_TECHNIQUE.md → TODO-006), et a été, sur décision explicite de
Charles-Henri (21/09/2026), formellement sorti de TODO-006 et repris par un TODO dédié,
**TODO-028**, plutôt que traité sans tests capables de le valider dans cet environnement.

## ⚠️ État au 21/09/2026 : passages GitHub Actions en cours de correction

**5ᵉ correction du 21/09/2026 (test:rules 12/12 ✅, test:e2e 7/9 → corrections apportées)** :
les deux modales de première connexion ne bloquaient plus rien, mais les 2 parcours E2E complets
échouaient chacun sur une assertion précise, une fois arrivés plus loin dans le parcours qu'au
passage précédent :

- **`e2e/capture-qualification.spec.js`** — "strict mode violation" sur `getByText(rawText)` à
  l'étape 7 : le texte capturé apparaît dans DEUX éléments une fois la fiche Tâche ouverte, le
  champ Description (`#detail-description`, préremplit avec ce texte) ET une entrée d'historique
  ("✅ Tâche créée · ..."). Corrigé en ciblant directement `#detail-description`.
- **`e2e/projet-creation-cloture.spec.js`** — `#add-task-inline` restait invisible. La fiche
  projet (`projects.js#openProjectDetail`) a 3 onglets ("Détails" actif par défaut, "Contenu",
  "Activité") ; `#add-task-inline` (et la liste des tâches) vivent sous l'onglet "Contenu",
  masqué tant qu'on ne clique pas dessus — le test ne le faisait jamais. Corrigé en cliquant cet
  onglet à chaque fois que la fiche (re)s'ouvre (elle repart toujours sur "Détails"), et en
  scopant la vérification de la tâche ajoutée à `#detail-tasks` pour éviter la même ambiguïté que
  ci-dessus avec l'historique du projet (onglet "Activité", lui aussi masqué mais présent dans
  le DOM).

**4ᵉ correction du 21/09/2026 (test:rules 12/12 ✅, test:e2e 7/9 → corrections apportées)** :
une fois les 3 échecs TEST-001 et les 3 échecs TEST-018/020/021 corrigés (voir juste en dessous),
les 2 parcours E2E complets (TEST-020, TEST-021) échouaient encore, tous deux avec la même
signature : `<div class="modal-overlay">…</div> intercepts pointer events` sur un clic pourtant
anodin (bouton "Traiter" d'une ligne Inbox, carte d'un projet fraîchement créé). Cause trouvée
dans `js/app.js#maybeShowUsageNotice` puis `js/components/onboarding.js#maybeShowFirstRunTour` :
deux modales automatiques, sans lien avec le parcours testé, s'ouvrent l'une après l'autre à la
toute première connexion d'un compte — exactement le cas des comptes de test, neufs à chaque
exécution (préférences vidées avec le reste de l'émulateur). Non fermées explicitement par les
tests, elles restaient ouvertes par-dessus l'écran et bloquaient le clic suivant. Corrigé en
ajoutant `tests/support/firstRun.js#dismissFirstRunModals(page)`, appelée juste après la
connexion dans les deux parcours E2E — ferme ces deux modales si elles apparaissent (boutons
"J'ai compris" / "Passer", déjà prévus par l'app elle-même), sans rien changer d'applicatif.
Ajouté aussi dans `e2e/capture-qualification.spec.js` : une attente explicite du toast
"Enregistré dans l'Inbox" avant de naviguer vers l'Inbox, pour ne pas naviguer pendant que la
modale de capture finit de se fermer.

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
