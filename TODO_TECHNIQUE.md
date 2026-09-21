# TODO_TECHNIQUE.md — Roadmap consolidée, Pilotage (papaTangoCharly)

Date : 15/09/2026. Lecture seule, aucune modification de code, aucune correction appliquée. Ce document consolide l'ensemble des audits déjà réalisés en une vision unique, cherche les causes racines communes, et propose une feuille de route par lots. Il ne remplace aucun audit source — il s'appuie dessus et y renvoie systématiquement.

---

## 0. Documents consultés

| Document | État | Contenu |
|---|---|---|
| `PROJECT_CONTEXT.md` | Existe | Carte technique du projet, pas un audit de problèmes — utilisé comme référence transverse |
| `INVENTAIRE_PROJET.md` | **Absent du dépôt** | Non inventé, non traité |
| `AUDIT_GLOBAL_STRUCTURE.md` | **Absent du dépôt** | Non inventé, non traité — aucun identifiant `ARCH-XXX` n'existe donc dans ce projet ; les observations d'architecture citées ici proviennent de `PROJECT_CONTEXT.md` et de `AUDIT_CODE.md` |
| `AUDIT_DATA.md` | Existe | 15 problèmes (DATA-001 à DATA-015) |
| `AUDIT_FIREBASE.md` | Existe | 10 problèmes (FIREBASE-001 à FIREBASE-010) |
| `AUDIT_USAGE_EFFICACITE.md` | Existe | 27 problèmes (UX-001 à UX-027) + 7 causes systémiques internes (UX-SYS-001 à 007) |
| `AUDIT_UX.md` | Existe | 24 problèmes, numérotés UX-001 à UX-024 **dans ce fichier** (numérotation propre, distincte de celle d'`AUDIT_USAGE_EFFICACITE.md`) |
| `AUDIT_OFFLINE.md` | Existe | 11 problèmes (OFFLINE-001 à OFFLINE-011) — **document rétrospectif : tous déjà corrigés et livrés** |
| `AUDIT_PERFORMANCE.md` | **Absent du dépôt** | Non inventé, non traité — les constats de performance déjà faits vivent en réalité dans `AUDIT_CODE.md` (CODE-001 à CODE-008) et sont repris ici sous ce nom |
| `AUDIT_SECURITY.md` | Existe | 15 problèmes (SEC-001 à SEC-015) |
| `AUDIT_CODE.md` | Existe | 28 problèmes (CODE-001 à CODE-028) — **document rétrospectif : 25 déjà corrigés et livrés, 3 non appliqués intentionnellement (CODE-006, 007, 008)** |
| `AUDIT_TESTS.md` | Existe | 27 manques (TEST-001 à TEST-027) — 0 test existant dans le dépôt |

**Convention de numérotation pour ce document** (nécessaire car deux fichiers sources utilisent tous les deux le préfixe `UX-XXX` pour des listes différentes) :
- `USE-UX-XXX` = identifiant `UX-XXX` tel qu'il apparaît dans `AUDIT_USAGE_EFFICACITE.md`
- `COMP-UX-XXX` = identifiant `UX-XXX` tel qu'il apparaît dans `AUDIT_UX.md`
- `DATA-XXX`, `FIREBASE-XXX`, `SEC-XXX`, `CODE-XXX`, `OFFLINE-XXX`, `TEST-XXX` : identiques à leur fichier source.

---

## 1. Inventaire brut et périmètre de la roadmap active

**157 problèmes** recensés au total à travers les 9 documents existants (15 DATA + 10 FIREBASE + 15 SEC + 28 CODE + 11 OFFLINE + 27 USE-UX + 24 COMP-UX + 27 TEST).

*Comptage recalculé le 15/09/2026 (correction de la validation finale) pour distinguer clairement quatre catégories, chacune vérifiée contre les listes réelles du document :*

- **36 problèmes déjà corrigés techniquement** (code livré) : `AUDIT_OFFLINE.md` OFFLINE-001 à OFFLINE-011 (11/11, patches 0032/0051/0052/0053) et `AUDIT_CODE.md` CODE-001 à CODE-005, CODE-009 à CODE-020, CODE-021, CODE-022 à CODE-028 (25/28). Détail en section 8.
- **8 problèmes clos par décision produit** (aucune action de code retenue, choix assumé) : CODE-006, CODE-007, CODE-008 (ratio impact/effort jugé défavorable, `AUDIT_CODE.md`) ; USE-UX-012, USE-UX-020 (volet fusion Priorisation/Kanban), USE-UX-023 (arbitrages de l'utilisateur du 15/09/2026) ; COMP-UX-011 (rappel indépendant, décision produit du 15/09/2026) ; SEC-008 (risque RH/droit du travail assumé). Détail en section 8.
- **37 problèmes volontairement non planifiés** (identifiés, actifs, mais sans TODO dédié à ce jour) : liste complète en section 4.2.
- **76 problèmes encore ouverts et activement planifiés**, consolidés ci-dessous en **9 causes systémiques actives** (SYS-001 à SYS-009 ; SYS-010 a été retiré comme cause autonome suite à la revue critique du 15/09/2026, voir section 3) puis en **22 actions de roadmap** (TODO-001 à TODO-021, TODO-009 scindé en TODO-009A/TODO-009B) réparties en **12 lots**.

Vérification : 36 + 8 + 37 + 76 = 157.

*Mise à jour du 15/09/2026 (application des recommandations validées de `REVIEW_TODO_TECHNIQUE.md`)* : TODO-009 a été scindé en TODO-009A/TODO-009B, LOT 0 en LOT 0A/LOT 0B, LOT 4 en LOT 4A/LOT 4B ; TODO-012 ne porte plus que sur la documentation technique (le volet vocabulaire reste sous TODO-021 seul) ; les rattachements DATA-002 (SYS-001), FIREBASE-004 (SYS-006) et FIREBASE-005 (SYS-005) ont été corrigés ; SYS-010 a été retiré ; plusieurs identifiants restés sans trace ont été réintégrés en section 4/8 pour traçabilité (DATA-008, DATA-009, SEC-006, SEC-008, SEC-009, SEC-010, FIREBASE-005, COMP-UX-008, USE-UX-009/011/013/014/015/016/017/019/024/025, CODE-021, et 10 manques de `AUDIT_TESTS.md` restés jusqu'ici non cités individuellement). Aucun fichier applicatif n'a été modifié à cette occasion.

*Mise à jour du 15/09/2026 (décisions produit tranchées par Charles-Henri)* : vocabulaire Inbox « Information »/« Idée » → **fusionné** (TODO-021 débloqué) ; rappel indépendant d'une échéance → **non retenu**, sous-chantier retiré de TODO-019 ; politique de rétention (TODO-011) → **conservation 24 à 36 mois, purge manuelle/assistée avec confirmation utilisateur explicite** ; accès administrateur Firestore large (SEC-002/TODO-001) → **accès permanent assumé et documenté comme choix d'architecture**, la Cloud Function restant une alternative théorique non retenue ; outillage Node/`package.json` pour les tests (TODO-002) → **choix non bloquant, à faire au démarrage du LOT 0B**. La section 7 et les dépendances concernées ont été mises à jour en conséquence. Aucun fichier applicatif n'a été modifié à cette occasion.

---

## 2. Croisement des audits — ce qui a été cherché

Pour chaque problème actif, la recherche a porté sur : doublons entre audits, problèmes liés, causes communes, dépendances, contradictions entre audits, problèmes techniques provoquant des problèmes UX, problèmes de modèle de données provoquant plusieurs problèmes d'usage, et problèmes d'architecture provoquant plusieurs problèmes techniques.

Constats de croisement notables (au-delà des causes systémiques détaillées en section 3) :

- **Contradiction déjà résolue entre deux audits** : `AUDIT_SECURITY.md` (SEC-001, hypothèse pessimiste basée sur un texte non confirmé) et `AUDIT_FIREBASE.md` (FIREBASE-001/002, confrontation aux règles réellement déployées) se contredisent partiellement — `AUDIT_FIREBASE.md` est la source la plus fiable sur ce point précis (règles réelles vs règles documentées), mais `AUDIT_SECURITY.md` n'a jamais été mis à jour en conséquence. Ce point est repris dans SYS-003 (section 3) plutôt que traité comme deux problèmes séparés.
- **Un même mécanisme technique corrigé une fois (Inbox) mais jamais généralisé** apparaît indépendamment dans trois audits distincts sans qu'aucun ne le formule comme un principe transverse : `AUDIT_CODE.md` (CODE-001, mutualisation des abonnements Inbox, déjà livrée), `AUDIT_FIREBASE.md` (FIREBASE-004, même besoin non couvert pour `tasks`/`projects`), `AUDIT_USAGE_EFFICACITE.md` (UX-SYS-001, boutons d'action rapide construits pour la Tâche puis jamais étendus). Voir SYS-006 pour le volet actions rapides ; le volet FIREBASE-004 (mutualisation d'abonnements) est traité sous SYS-002/TODO-009B (correction du 15/09/2026 — FIREBASE-004 retiré de SYS-006, voir section 3).
- **Un problème de données provoque un problème de confiance dans une fonctionnalité de sécurité** : `DATA-009` (export de compte non normalisé, gravité **HAUTE**), `SEC-006` (liste `USER_DATA_COLLECTIONS` maintenue à la main) et `SEC-009` partagent une origine commune (même fonction `exportAllUserData`, angles différents — fidélité des données vs protection d'accès). *Correction du 15/09/2026 : ce document affirmait à tort qu'ils étaient « traités comme un seul chantier (TODO-009) » — TODO-009 (devenu TODO-009A/TODO-009B) ne les couvre en réalité pas. Réintégrés en section 4.2 pour ne pas disparaître de la traçabilité ; aucun TODO dédié ne leur est encore attribué.*
- **Un problème UX est en réalité un problème d'architecture de test** : la quasi-totalité des correctifs déjà livrés (`AUDIT_CODE.md`, `AUDIT_OFFLINE.md`) reposent sur une vérification manuelle unique au moment de la livraison (voir `PROJECT_CONTEXT.md` §10/§14) — c'est la même cause racine que `SEC-014` (aucun filet de sécurité automatisé) et que l'intégralité d'`AUDIT_TESTS.md`. Voir SYS-008.
- **Aucune contradiction non résolue** n'a été trouvée entre `AUDIT_USAGE_EFFICACITE.md` et `AUDIT_UX.md` : le second a été explicitement écrit en excluant ce que le premier couvrait déjà (vérifié à la lecture des deux fichiers).

---

## 3. Causes systémiques consolidées (SYS-001 à SYS-010)

> Ces 9 causes actives remplacent, en les englobant, les 7 causes systémiques internes déjà identifiées dans `AUDIT_USAGE_EFFICACITE.md` (UX-SYS-001 à 007) — reprises ici avec leurs liens vers les autres audits, plutôt que dupliquées. *(Une dixième cause, SYS-010, avait été proposée puis retirée le 15/09/2026 suite à la revue critique — voir note en fin de section 3.)*

### SYS-001 — Aucune écriture Firestore ciblée : tout est lecture-modification-réécriture complète

**Problèmes concernés** : DATA-001, FIREBASE-007, CODE-021 (déjà mitigé côté concurrence, racine intacte côté coût) *(DATA-002 retiré d'ici le 15/09/2026 — lien jugé trop faible, traité exclusivement sous SYS-009)*
**Cause racine** : `js/services/storage.js` n'expose que des mutations en lecture-modification-écriture complète (`update()`/`put()` → `getDoc()` puis `setDoc()` du document entier) ; aucune primitive d'écriture partielle (`updateDoc` ciblé, `arrayUnion()`, `increment()`) n'existe dans la couche de stockage.
**Correction systémique** : ajouter à `storage.js` des primitives d'écriture ciblée pour les cas les plus fréquents (ajout dans un tableau, changement d'un champ isolé), sans casser la sérialisation par document déjà en place (CODE-021), et migrer en priorité les tableaux embarqués les plus à risque de grossir (`notesLog`).
**Bénéfices** : réduit le coût réseau/Firestore de chaque note ajoutée ou case cochée, réduit le risque d'atteindre la limite de 1 Mio par document (DATA-001), élimine une lecture facturée inutile à chaque mutation (FIREBASE-007).

### SYS-002 — Primitives de requête ciblées déjà construites mais sous-utilisées, et absence structurelle d'abonnement filtré

**Problèmes concernés** : DATA-004, DATA-005, FIREBASE-003, FIREBASE-004
**Cause racine** *(reformulée le 15/09/2026 suite à la revue critique, après vérification directe du code)* : deux sous-causes distinctes — (1) `storage.js` expose déjà `listWhere()`/`listRecent()`/`get()`, éprouvés avec succès pour l'historique et la recherche (CODE-001/003/004/005, déjà livrés), mais chaque nouveau besoin de filtrage en lecture ponctuelle retombe par défaut sur `listAll()` plutôt que de réutiliser ces primitives (`tags.js`, `fetchBundle()`) ; (2) `storage.js#subscribe()` — le mode de lecture **dominant** de l'app, utilisé par 11+ collections `domain/*` — n'a **structurellement aucune variante filtrée** : ce n'est pas une sous-utilisation évitable mais une limite d'architecture, qui explique pourquoi `tasksApi`/`projectsApi`/`followUpsApi` sont resouscrits indépendamment par 4 à 6 vues chacun sans mutualisation possible aujourd'hui.
**Correction systémique** : (1) généraliser le pattern déjà validé pour les lectures ponctuelles — `resolveRef()`, `tags.js`, le calcul de dernière activité (`usageEvents`) (**TODO-009A**) ; (2) généraliser à `tasks`/`projects`/`followUps` la mutualisation d'abonnement déjà construite pour `inboxItems` (**TODO-009B**, chantier plus structurant, traité séparément vu son risque plus élevé).
**Bénéfices** : réduit le coût Firestore proportionnellement au volume total de données plutôt qu'au besoin réel, et supprime les abonnements dupliqués à chaque navigation.

### SYS-003 — Sécurité réelle déléguée à des règles Firestore non totalement vérifiées, doublées de gardes client cosmétiques

**Problèmes concernés** : SEC-001, SEC-002, SEC-003, SEC-004, SEC-005, FIREBASE-001, FIREBASE-002
**Cause racine** : aucun accès réseau au projet Firebase réel depuis l'environnement de développement ; `isEmailAllowed()`/`isAdmin()` ne sont que des gardes côté client, la barrière réelle vit dans des règles Firestore dont le texte n'a été confronté au code qu'une fois (`AUDIT_FIREBASE.md`, à partir des règles fournies par l'utilisateur) — confirmant certains points (liste blanche bien appliquée) et en révélant d'autres plus permissifs que documenté (`allowedUsers` en lecture ouverte, `disabled` jamais vérifié par la règle).
**Correction systémique** : versionner `firestore.rules` à la racine du dépôt comme source de vérité unique ; corriger la règle `users/{uid}/**` pour vérifier `disabled` ; séparer `get`/`list` sur `allowedUsers` ; documenter explicitement l'accès admin large de SEC-002 comme choix d'architecture assumé (accès permanent conservé, décision produit du 15/09/2026).
**Bénéfices** : résout d'un seul chantier les deux problèmes CRITIQUE de l'audit sécurité et les deux problèmes HAUTE de l'audit Firebase, et élimine l'incertitude structurelle qui rendait le reste de l'audit sécurité conditionnel (SEC-003).

### SYS-004 — Aucune validation de données, ni côté formulaire ni côté règles

**Problèmes concernés** : SEC-011, USE-UX-002, USE-UX-008 (conséquence : catégorie dupliquée faute de garde-fou)
**Cause racine** : chaque formulaire de création valide « à la main » (`if (!champ) return;`) sans retour visuel ni règle serveur miroir ; aucune discipline de validation partagée entre les deux couches.
**Correction systémique** : utilitaire de validation de formulaire partagé (retour visuel systématique sur champ obligatoire vide) + contraintes de base dans les règles Firestore pour les collections les plus exposées (`tasks`, `inboxItems`).
**Bénéfices** : résout en un seul chantier un problème de confiance utilisateur (UX-002) et un problème de robustesse des données côté serveur (SEC-011).

### SYS-005 — Croissance non bornée sans palier « froid », données comme données d'usage

**Problèmes concernés** : DATA-006, DATA-012, FIREBASE-006 *(FIREBASE-005 retiré d'ici le 15/09/2026 — réglage `cacheSizeBytes` du SDK client, indépendant d'une politique de rétention côté serveur ; traité comme problème isolé, voir section 4.2)*
**Cause racine** : aucune structure du projet ne prévoit de vieillissement des données (archivage réel, agrégation, purge) — chaque collection grossit indéfiniment tant qu'elle reste utilisée, y compris les collections d'usage/administration.
**Correction systémique** : définir une politique explicite par collection (rétention, agrégation ou statu quo assumé), en commençant par `usageEvents` (déjà identifiée comme la plus coûteuse, doublement lue par ailleurs — voir SYS-002).
**Bénéfices** : maîtrise des coûts Firestore à long terme sur l'usage central du produit (« garder une trace », qui grossit par construction).

### SYS-006 — Corrections déjà appliquées au cas par cas, jamais formalisées en principe généralisable

**Problèmes concernés** : USE-UX-003, USE-UX-005, USE-UX-SYS-001, USE-UX-SYS-006, COMP-UX-019 *(FIREBASE-004 retiré d'ici le 15/09/2026 — traité exclusivement sous SYS-002/TODO-009B)*
**Cause racine** : chaque correctif réussi (mutualisation des abonnements Inbox — CODE-001 ; boutons rapides `‹ ›` sur la carte Tâche) a résolu un cas précis sans qu'un principe explicite (« toute transition d'état fréquente a un geste à 1 clic, quelle que soit l'entité » ; « tout listener réutilisé entre plusieurs vues doit être mutualisé ») ne soit formalisé et systématiquement réappliqué.
**Correction systémique** : formaliser ces deux principes et auditer chaque entité/vue restante contre eux — en particulier le Suivi (aucune action rapide, aucune notification de retard) et les collections `tasks`/`projects` (abonnements non mutualisés entre Accueil/Pilotage/Projets/Équipe).
**Bénéfices** : le simple ajout d'un contrôle rapide de date sur la carte Tâche (déjà recommandé pour USE-UX-003) résout **aussi** COMP-UX-019 (glisser-déposer non fonctionnel au toucher sur iOS) — un utilisateur mobile disposerait d'un bouton là où le geste tactile échoue silencieusement aujourd'hui, sans qu'aucun repli tactile coûteux (drag & drop réécrit) ne soit nécessaire.

### SYS-007 — Formulaires de création/suppression incohérents entre entités

**Problèmes concernés** : USE-UX-001, USE-UX-SYS-007, USE-UX-010 (décision actée), DATA-003
**Cause racine** : chaque écran de création ou de suppression a été conçu indépendamment, sans gabarit commun de « comment créer une entité » ni de « comment informer avant une suppression qui affecte d'autres entités ».
**Correction systémique** : gabarit commun de formulaire de création (point d'entrée toujours visible, champs avancés déplacés après création) et de suppression (calcul et affichage du nombre d'entités affectées avant confirmation, réutilisable pour Projet et Personne).
**Bénéfices** : résout l'absence de bouton « + Nouvelle tâche », le déplacement de la case « Communication » déjà décidé, et l'absence d'avertissement à la suppression d'un Projet/d'une Personne — trois symptômes, un seul chantier de conception.

### SYS-008 — Aucun filet de test automatisé, la vigilance manuelle est l'unique rempart

**Problèmes concernés** : l'intégralité d'`AUDIT_TESTS.md` (27 manques — **précision du 15/09/2026 : 7 seulement sont à ce jour rattachés à un TODO nommé** — TEST-001, 002, 006, 018, 020, 021, 027 via TODO-002 ; **les 20 autres, dont 10 sans aucune autre mention dans ce document, restent en backlog non planifié, voir section 4.2**), SEC-014, et — de façon transversale — le fait même que `AUDIT_CODE.md`/`AUDIT_OFFLINE.md` ne documentent que des correctifs déjà appliqués manuellement sans garantie de non-régression
**Cause racine** : absence historique et assumée de toute infrastructure de test (`PROJECT_CONTEXT.md` §10/§14 : pas de `package.json`, pas de CI, pas de linter).
**Correction systémique** : introduire l'outillage minimal en une fois plutôt que réparer chaque trou de couverture isolément — émulateur Firebase + tests de règles (valide directement SYS-003), et 2 parcours E2E cœur (capture→qualification, création projet→clôture). **Amorce d'outillage uniquement** : les 20 manques de tests restants nécessiteront des chantiers dédiés ultérieurs, non planifiés dans cette roadmap.
**Bénéfices** : rend vérifiable, sans dépendre uniquement de la relecture manuelle, toutes les corrections des autres chantiers de cette roadmap.

### SYS-009 — Vocabulaire et schéma de données sans référence unique documentée

**Problèmes concernés** : DATA-002, DATA-007, DATA-015, USE-UX-SYS-004, USE-UX-018 (tranché le 15/09/2026 — fusion des deux libellés, voir TODO-021)
**Cause racine** : croissance incrémentale du produit sans glossaire ni doctrine de choix formalisée à un seul endroit (tableau embarqué vs collection dédiée pour un journal ; trois stratégies de migration de schéma coexistantes ; quatre noms différents pour un même statut Inbox selon le sous-système qui le regarde).
**Correction systémique** : étendre `PROJECT_CONTEXT.md` avec une section « Évolution du schéma » (déjà recommandée indépendamment par DATA-007 et DATA-015) et un glossaire objet ↔ libellé utilisateur ↔ nom technique (déjà recommandé par USE-UX-SYS-004) — un seul chantier de documentation pour deux audits distincts.
**Bénéfices** : réduit le coût cognitif de toute future modification touchant plusieurs entités à la fois.

### SYS-010 — retiré

*Cause systémique retirée le 15/09/2026 suite à la revue critique (`REVIEW_TODO_TECHNIQUE.md`) : le regroupement de DATA-003 et SEC-002 sous un même intitulé (« pas de garde-fou informatif ») reposait sur une formulation abstraite commune plutôt que sur une cause technique ou un chemin de correction partagés — les deux problèmes ne se corrigent ni par le même code, ni par le même mécanisme. DATA-003 reste rattaché à **SYS-007** (résolu par TODO-007, calcul d'impact avant suppression) ; SEC-002 reste rattaché à **SYS-003** (résolu par TODO-001, règle Firestore/documentation de l'accès admin). Aucune action de roadmap n'était de toute façon rattachée à « SYS-010 » seul — sa suppression ne retire donc aucune couverture existante.*

---

## 4. Problèmes non rattachés à une cause systémique

*Section corrigée le 15/09/2026 suite à la revue critique (`REVIEW_TODO_TECHNIQUE.md`) : l'affirmation initiale selon laquelle tous les problèmes ci-dessous « sont traités individuellement dans la roadmap » n'était exacte que pour une partie d'entre eux. Distinction faite ci-dessous entre ceux qui ont effectivement un TODO dédié (4.1) et ceux qui n'en ont aucun à ce jour (4.2).*

### 4.1 Problèmes isolés couverts par un TODO dédié

USE-UX-007 (TODO-013), USE-UX-026 (TODO-008), COMP-UX-001/002 (TODO-016), COMP-UX-005/006/007 (TODO-015), COMP-UX-009/010 (TODO-019) *(COMP-UX-011 retiré de cette liste le 15/09/2026 — clos sans action par décision produit, voir section 8)*, COMP-UX-012/013/014/015 (TODO-014 et TODO-018), COMP-UX-016/017/018 (TODO-016), COMP-UX-020/021/022/023/024 (TODO-017), USE-UX-021/022/027 (TODO-020).

### 4.2 Problèmes isolés sans TODO dédié à ce jour — backlog non planifié, conservés pour traçabilité uniquement

Ces identifiants restent des problèmes actifs des audits sources, mais ne bénéficient d'aucun chantier de roadmap dans ce document. Ils ne doivent pas être considérés comme résolus ni comme abandonnés — seulement comme non planifiés à ce stade :

- **COMP-UX-008** (Calendrier accessible en 2 clics minimum depuis la nav — gravité Faible, question ouverte dans `AUDIT_UX.md` lui-même)
- **DATA-010, DATA-011, DATA-013, DATA-014**
- **FIREBASE-005** (réglage `cacheSizeBytes`, retiré de SYS-005 — voir section 3), **FIREBASE-008, FIREBASE-009, FIREBASE-010**
- **SEC-012, SEC-013, SEC-015** (dont deux correctifs simples déjà documentés dans `AUDIT_SECURITY.md` : SEC-012 préfixage des clés `localStorage` par `uid`, effort S ; SEC-015 vérification de la restriction de la clé API, effort S)
- **USE-UX-016** (deux dates de contrôle sur un Suivi)
- **DATA-008** (normalisation des statuts Suivi non répercutée en base, gravité MOYENNE)
- **DATA-009** (export de compte non normalisé, gravité **HAUTE**), **SEC-006** (liste `USER_DATA_COLLECTIONS` maintenue à la main, MOYENNE), **SEC-009** (absence d'en-têtes de sécurité HTTP, MOYENNE) — réintégrés ici le 15/09/2026, voir section 2
- **SEC-010** (duplication de `escapeHtml()` dans ~90 fichiers, MOYENNE)
- **USE-UX-009, USE-UX-011, USE-UX-013, USE-UX-014, USE-UX-015, USE-UX-017, USE-UX-019, USE-UX-024, USE-UX-025** (priorité P2 pour 011/013/014/015/017 ; P3 pour 009/019/024/025 dans `AUDIT_USAGE_EFFICACITE.md` — réintégrés ici le 15/09/2026, absents du document initial sans raison de tri documentée)
- **TEST-003, TEST-004, TEST-008, TEST-009, TEST-011, TEST-012, TEST-015, TEST-016, TEST-019, TEST-026** (manques de `AUDIT_TESTS.md` non couverts individuellement par TODO-002, qui n'en amorce que 7 sur 27 — voir SYS-008)

---

## 5. Roadmap — actions consolidées (TODO-001 à TODO-021, 22 actions au total depuis la scission de TODO-009 en TODO-009A/TODO-009B le 15/09/2026)

## [ ] P0 — TODO-001 — Vérifier, verrouiller et versionner les règles de sécurité Firestore réelles

Type : SEC / ARCHITECTURE

Problème : la liste blanche et l'accès admin reposent sur des règles Firestore jamais confirmées avec certitude depuis cet environnement, avec deux écarts déjà identifiés (accès non révoqué à la fermeture d'un compte, lecture `allowedUsers` plus ouverte que documenté).

Cause racine : SYS-003

Solution : créer `firestore.rules` versionné à la racine du dépôt ; corriger `users/{uid}/**` pour vérifier `disabled` ; séparer `get`/`list` sur `allowedUsers/{email}` ; documenter explicitement l'accès admin large (SEC-002) comme choix d'architecture assumé — **décision produit du 15/09/2026 : l'accès permanent est conservé, il n'est pas limité dans le temps**. La Cloud Function reste une alternative théorique, non retenue.

Fichiers concernés : `firestore.rules` (nouveau), `js/services/firebase.js`, `js/services/accountAdmin.js`, `js/components/adminPanel.js` (texte du tutoriel à réaligner sur la règle réelle)

Fonctions concernées : `isEmailAllowed`, `setAccountClosed`

Dépendances : accès à la console Firebase (Charles-Henri) pour confirmer et déployer la règle réelle

Problèmes résolus : SEC-001, SEC-002, SEC-003, SEC-004, SEC-005, FIREBASE-001, FIREBASE-002

Risque : une règle mal calibrée peut bloquer un accès légitime — à valider avec l'émulateur (TODO-002) avant tout déploiement réel

Complexité : M

Validation : TEST-027 (tests de règles avec émulateur Firebase)

Ordre recommandé : en premier, avant tout autre chantier — conditionne la confiance dans le reste du système (LOT 0A)

Statut (mis à jour le 20/09/2026, LOT 0A) : **Préparé — validation finale restante**. Implémenté : `firestore.rules` créé et versionné à la racine du dépôt (règle `users/{uid}/**` corrigée pour vérifier `disabled` — FIREBASE-001 ; `get`/`list` séparés sur `allowedUsers/{email}` — FIREBASE-002/SEC-004 ; accès admin permanent sur `users/{uid}` documenté comme choix d'architecture assumé — SEC-002) ; texte du tutoriel dans `js/components/adminPanel.js` réaligné sur ce fichier ; commentaires de `js/services/firebase.js` et `js/services/accountAdmin.js` mis à jour pour renvoyer vers `firestore.rules` comme source unique. Vérifié : cohérence syntaxique du fichier de règles (accolades/parenthèses) et des trois fichiers JS modifiés (`node --check`) — aucune vérification fonctionnelle des règles n'a été faite, faute d'outillage d'émulateur disponible à ce stade (TODO-002/LOT 0B, non anticipé ici). Reste à valider : (1) comparaison ligne à ligne de `firestore.rules` avec le contenu réel de l'onglet **Rules** de la console Firebase du projet `papatangocharly`, en particulier un point découvert en préparant ce fichier — l'écriture sur `allowedUsers` (nécessaire à `setAccountClosed`/`markAccountContentWiped`, fonctionnalité « 👥 Comptes » déjà livrée) était documentée jusqu'ici comme `allow write: if false`, ce qui aurait bloqué cette fonctionnalité si c'était réellement le texte déployé — corrigé dans `firestore.rules` par cohérence avec le comportement existant, mais à confirmer en priorité dans la console ; (2) déploiement réel de la règle corrigée, à ne faire qu'après cette vérification (voir Risque ci-dessus) ; (3) exécution de TEST-027 (tests de règles) une fois l'émulateur Firebase disponible (LOT 0B).

## [ ] P0 — TODO-002 — Émulateur Firebase, tests de règles et 2 parcours E2E cœur

Type : ARCHITECTURE (outillage de test)

Problème : 0% de couverture de test dans le dépôt ; aucune non-régression automatisée sur les correctifs déjà livrés ni sur les règles de sécurité.

Cause racine : SYS-008

Solution : mettre en place l'émulateur Firebase (tests de règles), puis 2 scénarios End-to-End couvrant les parcours cœur de l'app. **Amorce d'outillage uniquement** — ne couvre que 7 des 27 manques recensés dans `AUDIT_TESTS.md` (TEST-001, 002, 006, 018, 020, 021, 027) ; les 20 autres restent en backlog non planifié (voir section 4.2). Deux options seront étudiées lors de l'implémentation : un dossier `tests/` isolé avec son propre `package.json`, ou un outillage jetable non versionné. Le choix sera fait au démarrage du LOT 0B — **décision produit du 15/09/2026 : ce choix n'est pas bloquant, il n'a pas besoin d'être tranché avant de commencer**. **Décision produit du 20/09/2026 (démarrage effectif du LOT 0B)** : dossier `tests/` isolé avec son propre `package.json`, versionné dans le dépôt (plutôt qu'un outillage jetable non versionné).

Fichiers concernés : dossier de tests versionné `tests/` (créé) ; **dérogation exceptionnelle validée le 20/09/2026** : `js/services/firebase.js` (voir « Statut » ci-dessous) — seul fichier applicatif touché par ce lot, tout le reste de l'app reste inchangé

Fonctions concernées : n/a (infrastructure)

Dépendances : aucune pour l'émulateur Firebase et les 2 parcours E2E cœur, qui peuvent être mis en place indépendamment de TODO-001 ; seule la sous-partie « tests des règles Firestore » dépend du contenu final de `firestore.rules` livré par TODO-001 ; Playwright déjà présent dans l'environnement de build

Problèmes résolus : TEST-027, TEST-020, TEST-021, TEST-001, TEST-002, TEST-006, TEST-018 (amorce)

Risque : investissement initial sans bénéfice visible immédiat pour l'utilisateur final — à cadrer clairement comme fondation, pas comme fonctionnalité

Complexité : L (mise en place initiale) puis S par test ajouté

Validation : les tests eux-mêmes sont le livrable

Ordre recommandé : en parallèle de TODO-001 (LOT 0A) pour l'émulateur et les 2 parcours E2E cœur ; la sous-partie tests de règles attend le contenu final de TODO-001 — l'ensemble constitue le LOT 0B, avant tout le reste

Statut (20/09/2026, LOT 0B) : **Partiellement terminé — code écrit, non exécuté.** Implémenté : dossier `tests/` versionné complet (`package.json`, `firebase.json`, tests de règles TEST-027/TEST-002 avec `@firebase/rules-unit-testing`, 2 parcours E2E TEST-020/TEST-021 et tests unitaires navigateur TEST-001/TEST-006 avec Playwright, amorce de TEST-018 limitée au cas connexion/liste blanche — voir `tests/README.md` pour le détail exact du périmètre couvert et non couvert). Dérogation exceptionnelle validée par Charles-Henri le 20/09/2026 : quelques lignes ajoutées dans `js/services/firebase.js`, actives uniquement derrière un indicateur explicite posé par les tests (`globalThis.__PILOTAGE_USE_FIREBASE_EMULATOR__`, jamais vrai en production), pour permettre à TEST-001/006/018/020/021 de faire tourner l'app contre l'émulateur plutôt que contre la production — seule exception de ce lot à « aucun fichier applicatif modifié », aucun autre fichier de `js/` n'a été touché. **Bloquant découvert en cours de lot** : le registre npm (`registry.npmjs.org`) est inaccessible depuis l'environnement où ce lot a été réalisé (politique réseau, HTTP 403 confirmé, non contourné) — `firebase-tools`, `@firebase/rules-unit-testing` et `@playwright/test` n'ont donc pas pu être installés, et **aucun test n'a pu être exécuté ni validé**. Voir « Éléments restant à valider » du bilan de ce lot.

## [ ] P1 — TODO-003 — Généraliser les actions rapides à 1 clic (report d'échéance, relance) sur la carte Tâche

Type : UX

Problème : le report d'échéance coûte ≥3 clics + réouverture de fiche complète dans le Kanban (vue par défaut) alors que le changement de statut coûte 1 clic ; le glisser-déposer (seule alternative rapide) ne fonctionne pas au toucher sur iOS.

Cause racine : SYS-006

Solution : ajouter un contrôle rapide de date sur la carte Tâche (menu « +1j / +7j / date libre »), symétrique aux boutons `‹ ›` de statut déjà existants.

Fichiers concernés : `js/views/kanban.js`

Fonctions concernées : rendu de carte (zone des boutons `‹ ›`), `openTaskDetail`

Dépendances : aucune

Problèmes résolus : USE-UX-003, USE-UX-005 (volet action rapide), COMP-UX-019 (résolu comme effet de bord — un bouton remplace le geste tactile défaillant)

Risque : faible — ajout, ne modifie pas le comportement existant

Complexité : S/M

Validation : TEST-023 (cohérence du résultat quel que soit le chemin de report)

Ordre recommandé : après TODO-001/002, en tête des chantiers UX (LOT 2)

## [ ] P1 — TODO-004 — Étendre les rappels de retard aux Suivis

Type : UX / DATA

Problème : la notification de retard/stagnation ne couvre que les Tâches ; un Suivi en retard de contrôle ne déclenche jamais d'alerte, contraire à l'intention « ne rien oublier ».

Cause racine : SYS-006 (volet rappels)

Solution : étendre `maybeNotifyStalledOrLate()` aux suivis en contrôle dépassé (`followUpsApi.isControlDue`) ; ajouter un bouton « 🔁 Relancer / ✅ Réglé » à 1 clic sur chaque ligne de Suivi.

Fichiers concernés : `js/app.js`, `js/views/people.js`, `js/views/followupsOverview.js`

Fonctions concernées : `maybeNotifyStalledOrLate`, `openEditFollowUpModal`

Dépendances : aucune

Problèmes résolus : USE-UX-005 (volet notification), USE-UX-SYS-006

Risque : faible

Complexité : S (action rapide) / M (extension notification)

Validation : TEST-005 (couverture des cas d'erreur/retard, à décliner pour ce cas précis)

Ordre recommandé : avec TODO-003 (LOT 2)

## [ ] P1 — TODO-005 — Afficher l'information déjà calculée là où la décision se prend

Type : UX

Problème : le score de santé d'un projet (calculé, fiable) n'apparaît que dans une vue séparée, jamais dans la fiche détail ni sur le Dashboard ; la recherche exclut par défaut les éléments archivés, piège direct pour l'usage rétrospectif visé par le produit.

Cause racine : USE-UX-SYS-002

Solution : afficher le niveau de santé (`computeHealth`) dans l'en-tête de la fiche projet et sur la carte Dashboard ; cocher par défaut (ou signaler clairement) l'inclusion des archivés dans la recherche.

Fichiers concernés : `js/views/projects.js`, `js/views/dashboard.js`, `js/domain/projectHealth.js`, `js/components/search.js`

Fonctions concernées : `openProjectDetail`, `computeHealth`, rendu de carte Dashboard, filtre de recherche

Dépendances : aucune, donnée déjà calculée

Problèmes résolus : USE-UX-004, USE-UX-006

Risque : faible

Complexité : S

Validation : TEST-024 (comportement du filtre de recherche)

Ordre recommandé : avec TODO-003/004 (LOT 3)

## [ ] P1 — TODO-006 — Retour visuel explicite et validation partagée sur les formulaires

Type : UX / SEC

Problème : les formulaires de création échouent silencieusement sur un champ obligatoire vide (aucun toast, aucun style d'erreur) ; une catégorie de projet peut être dupliquée sans confirmation ; aucune validation de données n'existe côté règles Firestore.

Cause racine : SYS-004

Solution : utilitaire de validation de formulaire partagé (surbrillance + message inline) appliqué aux modales de création (Tâche, Projet, Ressource) ; confirmation avant création silencieuse d'une nouvelle catégorie ; contraintes de base dans les règles Firestore sur `tasks`/`inboxItems`.

Fichiers concernés : `js/views/kanban.js`, `js/views/projects.js`, `js/views/resources.js`, `firestore.rules`

Fonctions concernées : soumission de `openCreateTaskModal`, `openCreateProjectModal`, `openCreateResourceModal`, `registerCategory`

Dépendances : TODO-001 (même fichier `firestore.rules`)

Problèmes résolus : USE-UX-002, USE-UX-008, SEC-011, COMP-UX-012 (validation URL, même chantier de validation partagée)

Risque : faible

Complexité : S

Validation : TEST-017

Ordre recommandé : après TODO-001, avec TODO-007 (LOT 1)

## [ ] P1 — TODO-007 — Gabarit commun de création et de suppression

Type : UX / DATA

Problème : la Tâche n'a aucun point d'entrée de création direct (contrairement au Projet) ; la case « Communication » structurante est exposée sans explication à la création ; supprimer un Projet/une Personne ne prévient jamais du nombre d'entités qui en dépendent.

Cause racine : SYS-007 *(le volet suppression était aussi rattaché à SYS-010, retiré le 15/09/2026 — voir section 3 ; DATA-003 reste couvert ici sous SYS-007 seul)*

Solution : ajouter un bouton « + Nouvelle tâche » dans l'écran Pilotage ; déplacer la case « Communication » après création (décision déjà actée) ; enrichir le flux de suppression pour afficher l'impact avant confirmation.

Fichiers concernés : `js/views/kanban.js`, `js/domain/projects.js` (`removeProject`), `js/domain/people.js` (`removePerson`), `js/components/modal.js` (`confirmDelete`)

Fonctions concernées : `openCreateTaskModal`, `removeProject`, `removePerson`, `confirmDelete`

Dépendances : aucune

Problèmes résolus : USE-UX-001, USE-UX-010, DATA-003, USE-UX-SYS-007

Risque : faible à moyen — le calcul d'impact avant suppression doit rester rapide (pas de requête coûteuse ajoutée)

Complexité : S (bouton, déplacement de champ) / M (calcul d'impact à la suppression)

Validation : TEST-010, TEST-025

Ordre recommandé : avec TODO-006 (LOT 1)

## [ ] P1 — TODO-008 — Introduire un lien automatique lors de la qualification Inbox

Type : UX / DATA

Problème : qualifier un item Inbox ne pose jamais de lien automatique vers l'entité créée ni vers un projet de contexte déjà connu — confirmé par recherche exhaustive de `createLink` dans le code (absence totale).

Cause racine : problème isolé (section 4), décision déjà actée par l'utilisateur

Solution : appeler `linksApi.createLink` lors de la qualification, en réutilisant le mécanisme déjà écrit pour « + Créer et lier ».

Fichiers concernés : `js/domain/inbox.js` (`qualify`), `js/views/inbox.js` (`handleChoice`)

Fonctions concernées : `qualify`, `createLink`

Dépendances : `js/domain/links.js` (déjà existant, aucune modification nécessaire)

Problèmes résolus : USE-UX-026

Risque : faible

Complexité : S

Validation : TEST-022 (qualification, à étendre à la vérification du lien créé)

Ordre recommandé : lot Inbox (section 6, LOT 6)

## [ ] P1 — TODO-009A — Généraliser les requêtes ponctuelles ciblées (`listWhere`/`get`)

*TODO-009 scindé en TODO-009A/TODO-009B le 15/09/2026 suite à la revue critique — les deux volets ont des risques et une invasivité très différents (voir `REVIEW_TODO_TECHNIQUE.md`, section 3).*

Type : DATA

Problème : `tags.js` charge la collection entière (`listAll()`) pour n'en extraire qu'un sous-ensemble par filtrage en mémoire ; `fetchBundle()` (liens) recharge systématiquement 9 collections complètes à chaque ouverture d'une fiche liée ; le calcul de dernière activité (« 👥 Comptes ») relit tout `usageEvents` — alors que `listWhere()`/`get()` existent déjà et sont éprouvés ailleurs (historique, recherche).

Cause racine : SYS-002 (volet 1 — sous-utilisation de primitives de lecture ponctuelle déjà existantes)

Solution : `tags.js` doit utiliser `listWhere` plutôt que `listAll` + filtre en mémoire ; `resolveRef()` (liens) doit lire directement le document demandé plutôt que charger 9 collections ; le calcul de dernière activité doit utiliser un champ dédié ou une requête bornée par compte plutôt que relire tout `usageEvents`.

Fichiers concernés : `js/domain/tags.js`, `js/components/linkedItems.js` (`fetchBundle`), `js/services/usageTracking.js`, `js/services/accountAdmin.js`

Fonctions concernées : `addTag`/`removeTagByName`/`deleteTagEverywhere`, `resolveRef`, `fetchUsageEvents`/`listAccounts`

Dépendances : aucune, primitives déjà existantes dans `storage.js`

Problèmes résolus : DATA-004, DATA-005, FIREBASE-003

Risque : faible — généralisation d'un pattern déjà en production pour `inboxItems`/l'historique

Complexité : S/M

Validation : TEST-013, TEST-014

Ordre recommandé : LOT 4A, peut démarrer immédiatement

## [ ] P1 — TODO-009B — Mutualiser les abonnements Firestore temps réel (`tasks`/`projects`/`followUps`)

*Scindé de TODO-009 le 15/09/2026 — chantier plus structurant que TODO-009A, réévalué en risque moyen (et non plus « faible ») suite à la revue critique.*

Type : ARCHITECTURE

Problème : `storage.js#subscribe()` — le mode de lecture dominant de l'app — n'a structurellement aucune variante filtrée ; `tasksApi.subscribe()` et `projectsApi.subscribe()` sont rouverts indépendamment par 6 vues chacun (Accueil, Pilotage, Calendrier, Priorisation, Projets, Équipe/Ressources), `followUpsApi.subscribe()` par 4 vues — sans aucune mutualisation, contrairement au mécanisme déjà construit pour `inboxItems`.

Cause racine : SYS-002 (volet 2 — absence structurelle de primitive de lecture filtrée en abonnement temps réel)

Solution : généraliser à `tasks`/`projects`/`followUps` le mécanisme de mutualisation d'abonnement déjà éprouvé pour `inboxItems`, pour que chaque collection ne soit écoutée qu'une seule fois quel que soit le nombre de vues qui en ont besoin simultanément.

Fichiers concernés : `js/services/storage.js`, `js/views/dashboard.js`, `js/views/kanban.js`, `js/views/calendar.js`, `js/views/priorisation.js`, `js/views/projects.js`, `js/views/people.js`, `js/views/resources.js`

Fonctions concernées : `subscribe` de `tasks.js`/`projects.js`/`followups.js`, mécanisme de mutualisation déjà existant pour `inboxItems`

Dépendances : LOT 0B (socle de tests) recommandé au préalable pour vérifier l'absence de régression sur la synchronisation temps réel

Problèmes résolus : FIREBASE-004

Risque : moyen — changement de gestion d'état touchant simultanément plusieurs vues, risque de désynchronisation ou de callback dupliqué si mal exécuté

Complexité : L

Validation : TEST-013, TEST-014 (à étendre à une vérification multi-vues)

Ordre recommandé : LOT 4A, après TODO-009A, idéalement après le socle de tests (LOT 0B)

## [ ] P2 — TODO-010 — Écritures Firestore ciblées pour les mutations fréquentes

Type : DATA / ARCHITECTURE

Problème : chaque note ajoutée, chaque case cochée réécrit l'intégralité du document parent (lecture + écriture complète) au lieu d'une écriture ciblée.

Cause racine : SYS-001

Solution : ajouter des primitives d'écriture partielle à `storage.js` (`arrayUnion`/`updateDoc` ciblé) pour les mutations qui n'ont pas besoin de logique conditionnelle complexe, en conservant la sérialisation par document déjà en place ; envisager, à plus long terme, l'extraction de `notesLog` en sous-collection dédiée pour les fiches les plus anciennes.

Fichiers concernés : `js/services/storage.js`, `js/domain/tasks.js`, `js/domain/projects.js`, `js/domain/followups.js`

Fonctions concernées : `storage.update`, `addNote` et équivalents

Dépendances : ne doit pas casser la file de sérialisation par document (CODE-021)

Problèmes résolus : DATA-001, FIREBASE-007

Risque : moyen — nécessite de revoir au cas par cas quelles mutations peuvent se passer d'une lecture préalable

Complexité : L

Validation : TEST-006, TEST-007

Ordre recommandé : LOT 4B, peut suivre TODO-009A/TODO-009B

## [ ] P2 — TODO-011 — Politique de rétention pour les collections non bornées

Type : DATA

Problème : `usageEvents`, `history` et `inboxItems` archivés grossissent indéfiniment sans palier « froid » prévu dans le schéma.

Cause racine : SYS-005

**Décision produit du 15/09/2026** : conservation cible de **24 à 36 mois** pour `usageEvents`/`history`/Inbox archivé. Au-delà de cette fenêtre, toute purge ou anonymisation ne peut intervenir qu'après une **confirmation explicite de l'utilisateur** — pas de suppression silencieuse. La purge doit être **manuelle ou assistée** (déclenchée et validée par l'utilisateur), pas automatique — cohérent avec la promesse produit « ne rien perdre silencieusement ».

Solution : documenter cette politique par collection (24-36 mois, confirmation utilisateur, purge manuelle/assistée) en commençant par `usageEvents` (déjà identifiée comme la plus coûteuse) ; concevoir l'écran/flux de confirmation avant toute implémentation de purge.

Fichiers concernés : `js/services/usageTracking.js`, `js/domain/history.js`, `js/domain/inbox.js`

Fonctions concernées : `logView`, mécanisme de purge assistée à créer (avec écran de confirmation utilisateur)

Dépendances : SEC-007 (rétention de `usageEvents` après suppression de compte, même collection)

Problèmes résolus : DATA-006, DATA-012, FIREBASE-006, SEC-007 *(FIREBASE-005 retiré le 15/09/2026 — voir section 3, SYS-005)*

Risque : faible pour la documentation de la politique ; moyen pour l'implémentation de la purge assistée (ne doit jamais supprimer sans confirmation explicite)

Complexité : S (documentation de la politique retenue) puis M (implémentation de la purge manuelle/assistée avec confirmation utilisateur)

Validation : TEST-006/TEST-007 pour la non-régression des données ; scénario manuel de confirmation avant purge à ajouter

Ordre recommandé : LOT 4B, par étapes — documentation de la politique retenue d'abord, implémentation de la purge assistée ensuite

## [ ] P1 — TODO-012 — Documentation de référence : schéma de données et stratégies de migration

*Modifié le 15/09/2026 suite à la revue critique : le volet vocabulaire (« Information »/« Idée ») a été retiré de ce TODO et reste porté exclusivement par TODO-021, pour ne pas laisser croire que ce chantier de documentation est bloqué par une décision utilisateur — il ne l'est plus.*

Type : ARCHITECTURE / DATA

Problème : trois stratégies de migration de schéma coexistent sans doctrine explicite ; deux stratégies de journal (collection dédiée vs tableau embarqué) coexistent sans critère de choix documenté ; aucune vue d'ensemble du schéma de chaque collection n'existe.

Cause racine : SYS-009

Solution : ajouter à `PROJECT_CONTEXT.md` une section « Évolution du schéma » (critère de choix entre tableau embarqué et collection dédiée ; les trois stratégies de migration et quand utiliser laquelle) et un tableau récapitulatif par collection (champ, type, optionnalité).

Fichiers concernés : `PROJECT_CONTEXT.md`

Fonctions concernées : aucune (documentation pure)

Dépendances : aucune — chantier non bloqué

Problèmes résolus : DATA-002, DATA-007, DATA-015, USE-UX-SYS-004

Risque : faible

Complexité : M (rédaction initiale) puis S (maintenance incrémentale)

Validation : relecture croisée, pas de test automatisé applicable à de la documentation

Ordre recommandé : LOT 5, peut être mené en parallèle des chantiers de code, immédiatement (non bloqué)

## [ ] P2 — TODO-013 — Option de qualification Inbox en lot pour les cas simples

Type : UX

Problème : la qualification reste strictement unitaire ; l'utilisateur confirme vouloir préserver ce flux par défaut mais souhaite parfois aller plus vite sur les cas simples.

Cause racine : problème isolé, décision déjà actée par l'utilisateur (préserver le défaut, ajouter une option)

Solution : ajouter une option explicite non activée par défaut (« Traiter en lot ») pour les issues simples (Information/Idée/Archivé) uniquement — jamais pour les issues nécessitant un vrai formulaire.

Fichiers concernés : `js/views/inbox.js`, `js/components/weeklyReview.js`

Fonctions concernées : `openQualifyModal`, boucle de traitement de la Revue hebdomadaire

Dépendances : TODO-008 (même écran, cohérence d'ensemble sur la qualification)

Problèmes résolus : USE-UX-007

Risque : faible — option non activée par défaut, aucun changement du comportement actuel

Complexité : M

Validation : TEST-022

Ordre recommandé : LOT 6, avec TODO-008

## [ ] P2 — TODO-014 — Cohérence de la liaison Ressources et validation d'URL

Type : UX / DATA

Problème : deux mécanismes de liaison Ressource↔Tâche/Projet coexistent avec des résultats différents (l'un peuple `taskIds`/`projectIds`, l'autre non) ; le champ URL n'est jamais réellement validé malgré son apparence (`type="url"` sans `<form>`).

Cause racine : problème isolé (section 4), lié en surface à SYS-004 pour la partie validation

Solution : transmettre systématiquement l'identifiant de la fiche d'origine dans le chemin « + Créer et lier » ; valider le format d'URL à la sauvegarde.

Fichiers concernés : `js/components/linkedItems.js`, `js/domain/resources.js`, `js/views/resources.js`

Fonctions concernées : `openCreateAndLinkModal`, `openCreateResourceModal`

Dépendances : TODO-006 (même chantier de validation de formulaire)

Problèmes résolus : COMP-UX-012, COMP-UX-014

Risque : faible

Complexité : S/M

Validation : Non déterminé — test manuel des deux chemins de liaison

Ordre recommandé : LOT 7

## [ ] P2 — TODO-015 — Calendrier : filtre, création directe, cohérence d'affichage

Type : UX

Problème : le Calendrier n'offre aucun filtre (type/projet/personne), ne permet pas de créer un événement directement depuis un jour, et tronque différemment le même contenu selon la vue Mois/Semaine.

Cause racine : problème isolé (section 4)

Solution : ajouter des filtres simples au-dessus de la grille ; ajouter un point de création rapide sur un jour (date pré-remplie dans le formulaire cible) ; harmoniser la troncature entre les deux vues.

Fichiers concernés : `js/views/calendar.js`

Fonctions concernées : `renderMonth`, `renderWeek`, `openDayAgenda`

Dépendances : réutilise les formulaires de création existants (`openCreateTaskModal` et équivalent réunion) avec un `prefill` de date

Problèmes résolus : COMP-UX-005, COMP-UX-006, COMP-UX-007

Risque : faible

Complexité : M

Validation : Non déterminé — pas de test automatisé prévu dans `AUDIT_TESTS.md` pour cet écran précis

Ordre recommandé : LOT 7

## [ ] P2 — TODO-016 — Accessibilité clavier des modales et formulaires

Type : UX

Problème : `Tab` peut faire sortir le focus d'une modale ouverte vers des éléments de fond ; `Échap` ferme une modale sans avertir d'une saisie non sauvegardée (contrairement au clic en dehors, déjà protégé) ; l'indicateur de focus est supprimé sur tous les champs de formulaire sans repli `:focus-visible` ; les formulaires de création Tâche/Projet n'ont pas d'autofocus contrairement au reste de l'app.

Cause racine : problème isolé (section 4), touche un composant partagé (`modal.js`)

Solution : ajouter un piège de focus standard et restituer le focus à la fermeture ; aligner `Échap` sur la protection déjà existante pour le clic en dehors ; généraliser le pattern `:focus-visible` déjà écrit pour le sélecteur de thème ; ajouter l'autofocus manquant.

Fichiers concernés : `js/components/modal.js`, `js/views/kanban.js`, `js/views/projects.js`, `styles/components.css`

Fonctions concernées : `openModal`, `close`

Dépendances : composant partagé — un seul chantier bénéficie à toutes les modales de l'app

Problèmes résolus : COMP-UX-001, COMP-UX-002, COMP-UX-016, COMP-UX-017, COMP-UX-018

Risque : faible

Complexité : S/M

Validation : Non déterminé — vérification manuelle au clavier recommandée

Ordre recommandé : LOT 8

## [ ] P3 — TODO-017 — Cibles tactiles et zones sûres (mobile)

Type : UX

Problème : plusieurs contrôles fréquents (dont les boutons `‹ ›` de statut) sont nettement sous la taille tactile recommandée ; `viewport-fit=cover` est déclaré sans compensation `env(safe-area-inset-*)` ; plusieurs textes fonctionnels sont sous le seuil de lisibilité courant ; la grille du Calendrier devient très resserrée sur petit écran.

Cause racine : problème isolé (section 4), polish mobile

Solution : agrandir la zone cliquable des contrôles concernés sans changer l'icône visible ; ajouter le padding de zone sûre sur les éléments fixes ; remonter les tailles de police concernées au token existant ; envisager une bascule automatique vers la vue Semaine sous un certain seuil de largeur.

Fichiers concernés : `styles/components.css`, `index.html`

Fonctions concernées : n/a (CSS)

Dépendances : aucune

Problèmes résolus : COMP-UX-020, COMP-UX-021, COMP-UX-022, COMP-UX-023, COMP-UX-024

Risque : faible

Complexité : S

Validation : Non déterminé — vérification sur appareil réel recommandée

Ordre recommandé : LOT 9, backlog *(déplacé de LOT 8 le 15/09/2026 — regroupement avec l'accessibilité clavier jugé sans lien de cause commune par la revue critique)*

## [ ] P3 — TODO-018 — Retour visuel immédiat sur les poids de Priorisation et pagination des longues listes

Type : UX

Problème : régler un poids de priorisation ne recalcule le classement qu'après validation et fermeture de la modale ; les listes complètes de Priorisation et de Ressources n'ont aucune pagination.

Cause racine : problème isolé (section 4), confort

Solution : recalculer et afficher un aperçu du classement pendant le glissement du curseur ; ajouter une pagination/« afficher plus » au-delà d'un seuil.

Fichiers concernés : `js/views/priorisation.js`, `js/views/resources.js`

Fonctions concernées : `openWeightsModal`, `renderList`, `buildList`

Dépendances : aucune

Problèmes résolus : COMP-UX-003, COMP-UX-004, COMP-UX-013, COMP-UX-015

Risque : faible

Complexité : M

Validation : Non déterminé

Ordre recommandé : LOT 9, backlog

## [ ] P3 — TODO-019 — Rappels : fiabilité documentée, réversibilité de l'opt-in

*Modifié le 15/09/2026 — décision produit : pas de besoin confirmé pour un rappel indépendant d'une échéance. Ce sous-chantier est retiré ; TODO-019 ne conserve que la documentation de la limite des notifications et la réactivation de l'opt-in.*

Type : UX

Problème : la notification de retard ne peut techniquement pas atteindre l'utilisateur app fermée (pas d'infrastructure Web Push) sans que cette limite soit expliquée ; une fois l'opt-in de notification refusé, aucun écran ne permet de revenir dessus.

Cause racine : problème isolé (section 4)

Solution : documenter la limite dans l'interface (bandeau d'opt-in) ; ajouter un contrôle de préférences pour réactiver l'opt-in.

Fichiers concernés : `js/views/dashboard.js`, `js/domain/preferences.js`

Fonctions concernées : bandeau opt-in, `setNotifOptIn`

Dépendances : aucune

Problèmes résolus : COMP-UX-009, COMP-UX-010 ; **COMP-UX-011 clos sans action (décision produit du 15/09/2026 — pas de besoin confirmé pour un rappel indépendant, voir section 8)**

Risque : faible

Complexité : S

Validation : Non déterminé

Ordre recommandé : LOT 9, backlog

## [ ] P3 — TODO-020 — Navigation : Management visible, clarté de nommage

Type : UX

Problème : « Management » n'a plus de route propre et est invisible dans le menu ; « Priorisation » reste séparé du Kanban (confirmé volontaire) mais son rôle exact n'est pas évident depuis son seul nom ; « Plus » regroupe 5 destinations sans lien thématique ; « Guide » et « Nouveautés » ont des rôles proches non explicités dans l'UI.

Cause racine : problème isolé (section 4), confort de navigation

Solution : rendre « Management » visible comme sous-onglet dans Équipe ; ajouter une clarification de libellé pour Priorisation (sans fusion, décision déjà actée) ; regrouper « Plus » par intention plutôt qu'en liste plate ; ajouter un sous-titre distinctif à Guide et Nouveautés.

Fichiers concernés : `js/app.js`, `js/views/more.js`, `js/views/priorisation.js`, `js/views/guide.js`, `js/views/whatsnew.js`

Fonctions concernées : table de navigation, rendu de chaque vue concernée

Dépendances : aucune

Problèmes résolus : USE-UX-021, USE-UX-020 (clarté du nom uniquement, la séparation elle-même est déjà tranchée), USE-UX-022, USE-UX-027

Risque : faible

Complexité : M

Validation : Non déterminé

Ordre recommandé : LOT 9, backlog

## [ ] P3 — TODO-021 — Harmoniser le vocabulaire Inbox « Information »/« Idée » en un seul libellé

*Modifié le 15/09/2026 — décision produit : FUSION. Ce chantier n'est plus bloqué par une question ouverte ; c'est désormais un chantier d'harmonisation à part entière.*

Type : UX / DATA

Problème : deux libellés distincts existent aujourd'hui pour un seul et même statut (« kept »), sans nuance réelle retenue par l'utilisateur — source de confusion évitable.

Cause racine : SYS-009 (partagé avec TODO-012, volet documentation du glossaire)

Solution : fusionner « Information » et « Idée » en un seul libellé utilisateur ; aligner l'UI sur ce choix (le statut technique `entityType: "Kept"` reste inchangé, seul le libellé affiché change) ; mettre à jour le glossaire ajouté par TODO-012 en conséquence.

Fichiers concernés : `js/domain/inbox.js`, `js/domain/tags.js`

Fonctions concernées : libellés UI associés à `entityType: "Kept"`

Dépendances : TODO-012 (même chantier de documentation du vocabulaire, glossaire à mettre à jour avec le libellé retenu)

Problèmes résolus : USE-UX-018 (tranché — fusion)

Risque : faible

Complexité : S

Validation : relecture manuelle de tous les libellés affichés après fusion

Ordre recommandé : LOT 9, backlog

---

## 6. Lots de correction (ordre de correction recommandé)

### LOT 0A — Sécurité Firestore

*LOT 0 scindé en LOT 0A/LOT 0B le 15/09/2026 suite à la revue critique : les deux chantiers n'ont ni le même profil de risque, ni la même dépendance externe, et ne doivent pas être présentés comme un bloc indivisible.*

**Objectif** : corriger la faille de sécurité la plus grave avant toute autre chose.
**Problèmes concernés** : TODO-001
**Prérequis** : accès à la console Firebase (Charles-Henri) pour la vérification/le déploiement réel — la préparation (fichier versionné, correction du texte de règle) ne l'exige pas
**Modifications principales** : `firestore.rules` versionné, correction de la règle `users/{uid}/**`, séparation `get`/`list` sur `allowedUsers`
**Tests nécessaires** : TEST-027 (à exécuter une fois le socle du LOT 0B disponible)
**Risques** : une règle mal calibrée peut bloquer un accès légitime — toujours valider sur l'émulateur avant tout déploiement réel
**Statut (20/09/2026)** : **Préparé — validation finale restante.** La préparation (fichier `firestore.rules` versionné, corrections de règles, réalignement du tutoriel `adminPanel.js`) est faite ; ne sont pas encore faits : la comparaison avec les règles réellement déployées dans la console Firebase, le déploiement lui-même, et les tests de règles (TEST-027, LOT 0B). Voir TODO-001 en section 5 pour le détail.

### LOT 0B — Socle de tests

**Objectif** : donner à la roadmap un filet de non-régression avant de commencer les chantiers de correction.
**Problèmes concernés** : TODO-002
**Prérequis** : aucun pour l'émulateur et les 2 E2E cœur ; le contenu final de `firestore.rules` (LOT 0A) pour la sous-partie tests de règles uniquement. Le choix de l'outillage (`package.json` isolé dans `tests/` vs outillage jetable non versionné) sera fait au démarrage de ce lot, sans le bloquer (décision produit du 15/09/2026 : à proposer, pas à imposer)
**Modifications principales** : émulateur Firebase, tests de règles, 2 parcours E2E cœur — amorce d'outillage ne couvrant que 7 des 27 manques d'`AUDIT_TESTS.md` (les 20 autres restent en backlog non planifié, section 4.2)
**Tests nécessaires** : TEST-020, TEST-021
**Risques** : investissement initial sans bénéfice visible immédiat pour l'utilisateur final ; premier outillage Node introduit dans un dépôt qui n'en a jamais eu
**Statut (20/09/2026)** : **Partiellement terminé.** Outillage choisi (dossier `tests/` isolé et versionné) et code des tests écrit dans son intégralité, mais aucun test n'a pu être exécuté (registre npm bloqué dans l'environnement de réalisation — voir TODO-002 en section 5 et `tests/README.md`). Une dérogation exceptionnelle, ciblée et validée par Charles-Henri a été introduite dans `js/services/firebase.js` pour que les tests puissent tourner contre l'émulateur plutôt que la production. Ce lot ne peut être considéré comme terminé tant que la suite n'a pas tourné avec succès dans un environnement disposant d'un accès npm.

### LOT 1 — Confiance du système : formulaires et suppression
**Objectif** : éliminer les échecs silencieux et les créations/suppressions sans garde-fou.
**Problèmes concernés** : TODO-006, TODO-007
**Prérequis** : LOT 0A (règles Firestore pour la partie validation serveur)
**Modifications principales** : utilitaire de validation partagé, gabarit de création/suppression cohérent
**Tests nécessaires** : TEST-017, TEST-010, TEST-025
**Risques** : faible — essentiellement additif

### LOT 2 — Parité Tâche/Suivi et actions rapides
**Objectif** : généraliser les gestes rapides déjà éprouvés sur la Tâche aux situations où ils manquent (date, Suivi), avec un bénéfice mobile en prime.
**Problèmes concernés** : TODO-003, TODO-004
**Prérequis** : aucun
**Modifications principales** : contrôle rapide de date sur carte, boutons de relance Suivi, extension de la notification de retard
**Tests nécessaires** : TEST-023, TEST-005
**Risques** : faible

### LOT 3 — Visibilité de l'information déjà calculée
**Objectif** : afficher ce que le système sait déjà là où l'utilisateur en a besoin.
**Problèmes concernés** : TODO-005
**Prérequis** : aucun
**Modifications principales** : score de santé en fiche projet/Dashboard, inclusion par défaut des archivés en recherche
**Tests nécessaires** : TEST-024
**Risques** : faible

### LOT 4A — Requêtes ciblées

*LOT 4 scindé en LOT 4A/LOT 4B le 15/09/2026 suite à la revue critique — trois natures de risque différentes (requêtes ponctuelles à faible risque, mutualisation d'abonnements à risque moyen, décision produit gelant TODO-011) ne devaient pas rester dans un seul lot.*

**Objectif** : généraliser des optimisations de lecture déjà éprouvées, en distinguant les changements à faible risque des changements plus structurants.
**Problèmes concernés** : TODO-009A, TODO-009B
**Prérequis** : aucun pour TODO-009A ; LOT 0B recommandé avant TODO-009B
**Modifications principales** : requêtes ciblées ponctuelles (TODO-009A), mutualisation des abonnements temps réel (TODO-009B)
**Tests nécessaires** : TEST-013, TEST-014
**Risques** : faible (TODO-009A) à moyen (TODO-009B, désynchronisation possible si mal exécuté)

### LOT 4B — Écritures ciblées et rétention

**Objectif** : réduire le coût des écritures répétées sur des documents volumineux et définir une politique de conservation pour les collections non bornées.
**Problèmes concernés** : TODO-010, TODO-011
**Prérequis** : LOT 0B (tests permettant de vérifier l'absence de régression sur les données). La politique de rétention de TODO-011 a été tranchée le 15/09/2026 (24 à 36 mois, purge manuelle/assistée avec confirmation utilisateur) — plus de décision en attente
**Modifications principales** : écritures partielles ciblées, politique de rétention documentée
**Tests nécessaires** : TEST-006, TEST-007
**Risques** : moyen sur TODO-010 (écritures ciblées) — à traiter avec précaution vis-à-vis de la sérialisation existante (CODE-021)

### LOT 5 — Documentation de référence
**Objectif** : donner un point de référence unique pour le schéma de données et le vocabulaire, réduisant le coût de chaque future évolution.
**Problèmes concernés** : TODO-012
**Prérequis** : aucun — chantier non bloqué (le volet vocabulaire a été retiré de TODO-012 lors de la revue du 15/09/2026 et reste porté par TODO-021 seul, tranché le même jour)
**Modifications principales** : sections ajoutées à `PROJECT_CONTEXT.md`
**Tests nécessaires** : aucun (documentation)
**Risques** : aucun

### LOT 6 — Compléments Inbox actés
**Objectif** : mettre en œuvre les deux décisions déjà validées par l'utilisateur sur le parcours de qualification.
**Problèmes concernés** : TODO-008, TODO-013
**Prérequis** : aucun
**Modifications principales** : lien automatique à la qualification, option de traitement en lot
**Tests nécessaires** : TEST-022
**Risques** : faible

### LOT 7 — Ressources et Calendrier
**Objectif** : corriger les incohérences et compléter les fonctionnalités manquantes sur ces deux écrans.
**Problèmes concernés** : TODO-014, TODO-015
**Prérequis** : TODO-006 (validation partagée) pour la partie URL de TODO-014
**Modifications principales** : cohérence de liaison Ressources, validation d'URL, filtres et création directe sur le Calendrier
**Tests nécessaires** : Non déterminé (aucun test dédié dans `AUDIT_TESTS.md`)
**Risques** : faible

### LOT 8 — Accessibilité clavier

*Recentré le 15/09/2026 suite à la revue critique : TODO-017 (cibles tactiles mobiles) déplacé vers LOT 9 — aucune cause commune avec l'accessibilité clavier (fichiers, méthode de validation et priorité différents).*

**Objectif** : rendre l'application pleinement utilisable au clavier.
**Problèmes concernés** : TODO-016
**Prérequis** : aucun
**Modifications principales** : piège de focus, `:focus-visible`, alignement du comportement d'Échap
**Tests nécessaires** : vérification manuelle recommandée (aucun test automatisé prévu)
**Risques** : faible

### LOT 9 — Backlog : mobile, navigation, priorisation, rappels avancés, vocabulaire
**Objectif** : traiter les améliorations de confort restantes, sans urgence.
**Problèmes concernés** : TODO-017, TODO-018, TODO-019, TODO-020, TODO-021
**Prérequis** : aucun — les décisions produit sur le rappel indépendant (TODO-019, tranchée le 15/09/2026 : non retenu) et sur le vocabulaire Inbox (TODO-021, tranchée le 15/09/2026 : fusion) ont été prises
**Modifications principales** : cibles tactiles mobiles, retour visuel Priorisation, pagination, navigation, vocabulaire
**Tests nécessaires** : Non déterminé
**Risques** : faible — peut rester en backlog indéfiniment sans dégrader l'existant

---

## 7. Questions ouvertes avant certains chantiers

*Section mise à jour le 15/09/2026 : les trois questions listées ci-dessous ont toutes été tranchées par des décisions produit de Charles-Henri. Section conservée pour traçabilité historique — elle ne porte plus de question réellement ouverte à ce jour.*

- ~~USE-UX-018 (vocabulaire « Information » vs « Idée »)~~ — **tranché : fusion des deux libellés.** Voir TODO-021.
- ~~Besoin réel d'un rappel indépendant d'une échéance (COMP-UX-011)~~ — **tranché : non retenu, pas de besoin produit confirmé.** Sous-chantier retiré de TODO-019 ; voir section 8.
- ~~Politique de rétention de `usageEvents`/`history`~~ — **tranché : conservation 24 à 36 mois, purge manuelle/assistée avec confirmation utilisateur explicite.** Voir TODO-011.

*Décision distincte, non bloquante mais pas encore définitivement choisie* : l'outillage Node/`package.json` pour les tests (TODO-002) sera arbitré entre deux options (dossier `tests/` isolé avec `package.json`, ou outillage jetable non versionné) au démarrage du LOT 0B — ce choix n'empêche pas de démarrer le chantier.

---

## 8. Pour mémoire — problèmes déjà résolus, hors roadmap

- **`AUDIT_OFFLINE.md`** : OFFLINE-001 à OFFLINE-011, les 11 déjà corrigés et livrés (patches 0032, 0051, 0052, 0053). Aucune action.
- **`AUDIT_CODE.md`** : CODE-001 à CODE-005, CODE-009 à CODE-020, CODE-021, CODE-022 à CODE-028 (25 problèmes) déjà corrigés et livrés. **Précision du 15/09/2026 sur CODE-021** : le risque de concurrence est clos (patch 0030, file de sérialisation) ; son volet coût (réécriture complète du document à chaque mutation) reste actif et est suivi sous FIREBASE-007/DATA-001 (TODO-010) — ce n'est pas un problème résiduel propre à CODE-021. CODE-006, CODE-007, CODE-008 (optimisations Kanban et bornage `usageEvents`) non appliqués **intentionnellement**, ratio impact/effort jugé défavorable au volume de données actuel — à reconsidérer seulement si ce volume change significativement, pas une action de cette roadmap.
- **USE-UX-012, USE-UX-020 (volet fusion), USE-UX-023** : clos sans action suite aux arbitrages de l'utilisateur du 15/09/2026 (choix de conception confirmés).
- **SEC-008** (suivi d'activité des collaborateurs sans transparence dédiée) : sujet RH/droit du travail déjà évoqué et accepté par Charles-Henri selon le contexte du projet — traité comme un risque assumé, pas une action de cette roadmap ; réintégré ici le 15/09/2026 pour ne pas disparaître de la traçabilité (absent de toute section jusqu'ici).
- **COMP-UX-011** (rappel indépendant d'une échéance) : clos sans action suite à la décision produit de Charles-Henri du 15/09/2026 — pas de besoin réel confirmé pour cette fonctionnalité. Retiré de TODO-019 (qui conserve la documentation de la limite des notifications et la réactivation de l'opt-in).

---

*Fin du document. Aucun fichier applicatif n'a été modifié — consolidation strictement en lecture seule.*
