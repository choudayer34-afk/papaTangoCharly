# AUDIT_TESTS.md — Audit de la stratégie de tests de Pilotage

Date : 15/09/2026. Lecture seule, aucune modification de code. Ne reprend pas l'analyse déjà faite dans `AUDIT_OFFLINE.md` (matrice de scénarios offline→online) : ce document s'appuie dessus sans la refaire, et se concentre sur l'absence de tests qui la couvriraient.

## 1. Constat de départ — tests existants

- **OBSERVÉ** — Aucun fichier de test dans le dépôt (`*.test.js`, `*.spec.js` : zéro résultat).
- **OBSERVÉ** — Aucun `package.json`, donc aucun framework de test déclaré (Jest/Vitest/Mocha/Playwright), aucun script `npm test`.
- **OBSERVÉ** — Aucun workflow CI (`.github/workflows` absent) : aucune exécution automatique de test à chaque commit.
- **OBSERVÉ** — Aucune règle de lint/format configurée (déjà noté dans `PROJECT_CONTEXT.md`).
- **DÉDUIT** — La qualité actuelle du code repose entièrement sur la relecture manuelle et les correctifs a posteriori documentés en commentaires (de nombreux "BUG corrigé le JJ/MM/2026" trouvés dans `storage.js`, `login.js`, `shortcuts.js`, `followups.js`, etc.) : aucune régression sur ces correctifs n'est protégée par un test automatisé.
- **Conclusion** : la couverture de test est actuellement de **0%**. Chaque section suivante identifie les manques par domaine plutôt que de répéter ce constat.

## 2. Méthodologie

Pour chaque domaine demandé (fonctionnalités non couvertes, scénarios critiques, erreurs, régression, données, authentification, synchronisation, parcours utilisateur), les manques les plus risqués ont été identifiés à partir du code déjà inspecté dans les audits précédents (`AUDIT_CODE.md`, `AUDIT_DATA.md`, `AUDIT_FIREBASE.md`, `AUDIT_SECURITY.md`, `AUDIT_OFFLINE.md`, `AUDIT_USAGE_EFFICACITE.md`) et de vérifications ciblées complémentaires. Chaque manque reçoit un ID `TEST-XXX`, un risque, un test recommandé, un effort (S/M/L) et une priorité (P0-P3).

## 3. Manques par domaine

### Authentification

- **TEST-001** — Risque : un utilisateur non présent dans `allowedUsers` pourrait accéder à l'app si `isEmailAllowed()` (`js/views/login.js`) régresse. Test recommandé : test unitaire simulant un email hors liste → vérifier le blocage côté UI. Effort : S. Priorité : P0.
- **TEST-002** — Risque : un compte marqué `disabled: true` (fermeture de compte, `accountAdmin.js#setAccountClosed`) garde un accès Firestore direct valide tant que le document `allowedUsers` existe (déjà documenté FIREBASE-001) — seul le blocage côté UI protège aujourd'hui. Test recommandé : test de règles Firestore (émulateur) vérifiant qu'un utilisateur `disabled` est bien bloqué côté client, et test de régression si la règle serveur est un jour corrigée. Effort : M. Priorité : P0.
- **TEST-003** — Risque : messages d'erreur Firebase Auth bruts (anglais) affichés à l'utilisateur si `friendlyError()` (`login.js`) ne couvre pas un nouveau code d'erreur. Test recommandé : test paramétré sur les codes d'erreur Firebase Auth connus (`auth/wrong-password`, `auth/popup-closed-by-user`, etc.) vérifiant un message traduit pour chacun. Effort : S. Priorité : P2.
- **TEST-004** — Risque : perte de session ou boucle de redirection après expiration de token / reconnexion réseau. Test recommandé : test d'intégration simulant un token expiré au montage de l'app. Effort : M. Priorité : P1.
- **TEST-005** — Risque : écran d'erreur d'authentification (`renderAuthError`) et son bouton "Réessayer" jamais vérifiés automatiquement. Test recommandé : test que le bouton déclenche bien un rechargement et que l'écran s'affiche sur échec de la vérification whitelist. Effort : S. Priorité : P2.

### Données et régression

- **TEST-006** — Risque : régression sur la file de sérialisation en mémoire de `storage.update()` (protection contre les races de lecture-modification-écriture au sein d'un même onglet) — un refactor futur pourrait la retirer sans qu'aucun test ne le signale. Test recommandé : test unitaire simulant deux `update()` concurrents sur la même entité, vérifiant l'absence de perte d'écriture. Effort : M. Priorité : P0.
- **TEST-007** — Risque : écriture concurrente multi-onglets/multi-appareils, non protégée par la file en mémoire (limite déjà documentée dans `AUDIT_DATA.md`, DATA non numéroté ici en détail) — pourrait s'aggraver silencieusement. Test recommandé : test avec deux clients simulés modifiant la même entité, documentant le comportement actuel (dernier écrivain gagne) comme référence de non-régression. Effort : M. Priorité : P1.
- **TEST-008** — Risque : une migration one-shot (`dashboardHiddenMigratedV19`, `postitMigratedV1`, `tagsMigratedV1`, `personalObjectivesMigratedV1`) qui échoue silencieusement retente indéfiniment à chaque chargement sans limite ni signal (DATA-010). Test recommandé : test vérifiant qu'un échec de migration est journalisé/limité, pas seulement retenté à l'infini. Effort : M. Priorité : P2.
- **TEST-009** — Risque : `exportAllUserData()` lit les documents Firestore bruts sans passer par la normalisation de `domain/*.js`, produisant un export incohérent avec ce que l'app affiche réellement (DATA-009). Test recommandé : test comparant le contenu exporté à l'état normalisé affiché pour une entité ayant un champ legacy (ex. un `FollowUp` avec un ancien statut). Effort : M. Priorité : P1.
- **TEST-010** — Risque : suppression d'un Projet/d'une Personne (politique assumée de non-cascade) laisse des références orphelines (`task.projectId`, `followUp.personId`) sans qu'aucun test ne vérifie que l'affichage les gère proprement partout (DATA-003). Test recommandé : test créant une tâche liée à un projet puis supprimant le projet, vérifiant l'absence d'erreur d'affichage sur la tâche restante. Effort : S. Priorité : P1.
- **TEST-011** — Risque : génération d'ID via `crypto.randomUUID()` avec repli `Date.now().toString(36) + Math.random()...` sur navigateur ancien (DATA-014) — collision possible jamais testée. Test recommandé : test unitaire du chemin de repli. Effort : S. Priorité : P3.
- **TEST-012** — Risque : les 9 collections utilisateur (`USER_DATA_COLLECTIONS` dans `firebase.js`) doivent rester synchronisées avec les `COLLECTION` de chaque `domain/*.js` — un ajout de collection oublié dans la liste casserait silencieusement l'export/la suppression de compte (déjà vérifié manuellement dans `AUDIT_DATA.md`, jamais automatiquement). Test recommandé : test qui compare programmatiquement les deux listes à chaque exécution de suite. Effort : S. Priorité : P1.

### Synchronisation

- **TEST-013** — Risque : régression sur le correctif de mutualisation du listener Inbox (`subscribePending`/`subscribeKept` partageant désormais un seul flux `onSnapshot`, correctif du 15/09/2026) — un futur changement pourrait rouvrir un listener dupliqué sans qu'aucun test ne l'empêche. Test recommandé : test vérifiant qu'un seul `onSnapshot` Firestore est ouvert quel que soit le nombre d'abonnés `subscribePending`/`subscribeKept` simultanés. Effort : M. Priorité : P1.
- **TEST-014** — Risque : callback d'erreur `onSnapshot` (ajouté suite à un bug où il manquait, commentaire `storage.js` L147) jamais testé pour une vraie coupure réseau/permission refusée. Test recommandé : test simulant une erreur `onSnapshot` et vérifiant qu'elle ne fait pas planter la vue. Effort : M. Priorité : P1.
- **TEST-015** — Risque : ordre d'arrivée des 8 listeners du Dashboard (tasks/projects/meetings/decisions/people/followUps/tags/inbox) — aucun test ne garantit un rendu cohérent si certains répondent avant d'autres (déjà noté comme risque "0 partout" transitoire dans `AUDIT_USAGE_EFFICACITE.md`, UX-011). Test recommandé : test de rendu avec réponses des listeners dans un ordre aléatoire. Effort : M. Priorité : P2.
- **TEST-016** — Risque : requêtes Firestore actuelles sont toutes conformes à la contrainte "pas d'index composite nécessaire" (vérifié manuellement, `AUDIT_FIREBASE.md` FIREBASE-008) — un futur ajout de filtre pourrait casser cette contrainte sans avertissement avant déploiement. Test recommandé : test statique/lint personnalisé qui échoue si une requête combine `where` sur un champ différent de l'`orderBy`. Effort : M. Priorité : P2.

### Erreurs et régression générale

- **TEST-017** — Risque : validation silencieuse des formulaires de création (Tâche/Projet/Ressource — `if (!title) return;` sans retour visuel, UX-002/UX-012) : une fois corrigée, aucun test n'empêchera une régression vers le silence. Test recommandé : test vérifiant qu'un message d'erreur visible apparaît pour chaque formulaire de création à champ obligatoire vide. Effort : S. Priorité : P1 (à activer dès la correction UX-002).
- **TEST-018** — Risque : les nombreux correctifs déjà livrés et documentés en commentaires ("BUG corrigé...") n'ont aucun test de non-régression associé — rien n'empêche leur réapparition à la prochaine modification du fichier concerné. Test recommandé : constituer une suite de tests de régression ciblée, un test par bug documenté trouvé en commentaire (au moins : file d'écriture `storage.js`, mapping legacy `followups.js`, callback d'erreur `onSnapshot`, whitelist sans try/catch `login.js`). Effort : L (ensemble), S par cas unitaire. Priorité : P0.
- **TEST-019** — Risque : le service worker (`sw.js`) a une logique de cache à deux stratégies (cache-first/network-first) jamais testée automatiquement — une régression pourrait casser le mode offline sans être détectée avant un déploiement. Test recommandé : test d'intégration simulant une requête réseau en échec et vérifiant le repli sur le cache. Effort : M. Priorité : P1.

### Parcours utilisateur principaux (bout en bout)

- **TEST-020** — Risque : aucun test end-to-end sur le parcours cœur "Capture → Qualification → Tâche créée" — une régression sur `inboxApi.qualify()` ou `openQualifyModal` casserait silencieusement le flux le plus utilisé de l'app. Test recommandé : test E2E (ex. Playwright, déjà préinstallé dans l'environnement de build) couvrant ce parcours. Effort : M. Priorité : P0.
- **TEST-021** — Risque : aucun test E2E sur "Création de projet → Ajout de tâche → Clôture du projet" (parcours de pilotage complet). Test recommandé : scénario E2E dédié. Effort : M. Priorité : P0.
- **TEST-022** — Risque : aucun test sur les 9 issues de qualification Inbox (task/followup/project/meeting/decision/resource/kept/idea/archived) — une régression sur une seule branche de `qualify()` pourrait passer inaperçue. Test recommandé : test paramétré couvrant chaque valeur de `outcome`. Effort : M. Priorité : P1.
- **TEST-023** — Risque : aucun test sur le report d'échéance dans les 3 vues (Kanban détail, Tableau inline, Calendrier glisser-déposer) qui doivent aboutir au même résultat en base. Test recommandé : test vérifiant la cohérence du résultat final (`task.dueDate`) quel que soit le chemin emprunté. Effort : M. Priorité : P2.
- **TEST-024** — Risque : aucun test sur la recherche globale, en particulier le filtre "Inclure ce qui est terminé/archivé" (déjà identifié comme piège UX, UX-006) — une régression pourrait le faire disparaître ou l'inverser silencieusement. Test recommandé : test vérifiant qu'un élément archivé n'apparaît qu'avec la case cochée. Effort : S. Priorité : P1.
- **TEST-025** — Risque : aucun test sur la clôture (Tâche/Projet/Suivi) vérifiant l'absence de cascade et la mise à jour correcte du statut/`completedAt`. Test recommandé : test unitaire par entité. Effort : S. Priorité : P1.

### Offline (référence, non ré-audité)

- **TEST-026** — Risque : la matrice de 9 scénarios offline→online déjà identifiée dans `AUDIT_OFFLINE.md` (lecture cache, écriture hors ligne, `confirmDelete`, perte de connexion en session, première connexion hors ligne, échec partiel d'installation SW, erreur de listener Firestore, échec de vérification whitelist hors ligne, raccourci clavier hors ligne) n'est couverte par **aucun test automatisé** — chaque scénario ne repose que sur une vérification manuelle ponctuelle au moment du correctif. Test recommandé : convertir la matrice existante en suite de tests d'intégration (avec simulation de coupure réseau), sans en refaire l'analyse. Effort : L. Priorité : P0.

### Sécurité / règles Firestore

- **TEST-027** — Risque : les règles de sécurité Firestore réelles (fournies par l'utilisateur, `AUDIT_FIREBASE.md`/`AUDIT_SECURITY.md`) ne sont testées par aucun outil (ex. Firebase Rules Unit Testing avec émulateur) — une modification future des règles pourrait rouvrir une faille (ex. lecture croisée entre utilisateurs) sans qu'aucun test ne la détecte avant déploiement. Test recommandé : suite de tests de règles couvrant au minimum : lecture/écriture `users/{uid}` par son propriétaire (doit réussir), par un autre utilisateur authentifié (doit échouer), lecture `allowedUsers` par un utilisateur non listé (doit réussir en `get`, ce qui est déjà le comportement documenté comme risque FIREBASE-002), écriture sur `usageEvents` avec un `email`/`uid` usurpé (doit échouer). Effort : M. Priorité : P0.

## 4. Synthèse — priorisation

| Priorité | IDs |
|---|---|
| P0 | TEST-001, TEST-002, TEST-006, TEST-018, TEST-020, TEST-021, TEST-026, TEST-027 |
| P1 | TEST-004, TEST-007, TEST-009, TEST-010, TEST-012, TEST-013, TEST-014, TEST-017, TEST-019, TEST-022, TEST-024, TEST-025 |
| P2 | TEST-003, TEST-005, TEST-008, TEST-015, TEST-016, TEST-023 |
| P3 | TEST-011 |

Premier pas recommandé : aucune infrastructure de test n'existant, la priorité P0 la plus structurante est **TEST-027** (émulateur Firebase + tests de règles) et **TEST-020/021** (2 parcours E2E cœur), qui posent l'outillage (Playwright déjà présent dans l'environnement de build, émulateur Firebase à ajouter) réutilisable ensuite pour tous les autres cas de cette liste.

---

*Fin du document. 27 manques identifiés (TEST-001 à TEST-027). Aucun fichier applicatif modifié.*
