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

## 5. Roadmap — actions consolidées (TODO-001 à TODO-021, 22 actions au total depuis la scission de TODO-009 en TODO-009A/TODO-009B le 15/09/2026 ; TODO-022 à TODO-027 ajoutées le 21/09/2026, voir note ci-dessous et section 9 ; TODO-028 ajoutée le 21/09/2026, voir note ci-dessous ; TODO-029 et TODO-030 ajoutées le 21/09/2026, voir note ci-dessous et section 9 ; TODO-031 ajoutée le 21/09/2026, voir note ci-dessous ; TODO-032 ajoutée le 21/09/2026, voir note ci-dessous ; TODO-033 et TODO-034 ajoutées le 21/09/2026, voir note ci-dessous ; TODO-035 ajoutée le 21/09/2026, voir note ci-dessous)

*Ajout du 21/09/2026* : TODO-022 à TODO-027 ne proviennent d'aucun des 9 audits sources (elles ne comptent donc pas dans les 157 problèmes ni les 22 actions mentionnés ci-dessus, dont le calcul reste inchangé) — ce sont des besoins produit exprimés directement par Charles-Henri le 21/09/2026, ajoutés au backlog et priorisés à sa demande explicite, **sans être traités dans l'immédiat** (« nous continuons la suite des lots de la todo après ajout dans ton backlog »). Voir section 9 pour le détail de chaque besoin d'origine (BESOIN-001 à BESOIN-005).

*Ajout du 21/09/2026 (2)* : TODO-028 est d'une nature différente de TODO-022 à TODO-027 — ce n'est ni un besoin produit nouveau, ni un problème d'audit inédit. C'est une scission technique décidée par Charles-Henri le 21/09/2026 (voir échange du même jour) : elle reprend le seul volet non réalisé de TODO-006 (la partie `firestore.rules` de SEC-011), pour ne pas bloquer le reste de TODO-006 derrière une restructuration d'architecture des règles. Elle ne s'ajoute donc pas aux 157 problèmes ni aux 22 actions d'origine (SEC-011 y était déjà comptabilisé sous TODO-006) — elle ne fait que déplacer, vers un TODO dédié, un volet déjà compté. Voir TODO-006 et TODO-028 ci-dessous.

*Ajout du 21/09/2026 (3)* : TODO-029 et TODO-030 sont, comme TODO-022 à TODO-027, des besoins produit hors audits (BESOIN-006, BESOIN-007, voir section 9) — mais exprimés en retour direct de Charles-Henri après la livraison de LOT 2 (TODO-003/TODO-004), plutôt qu'avant le démarrage des lots. Ajoutées au backlog (LOT 14) à sa demande explicite, **sans être traitées dans l'immédiat** ; ne comptent pas dans les 157 problèmes ni les 22 actions d'origine.

*Ajout du 21/09/2026 (4)* : TODO-031 est d'une nature encore différente — ni un besoin produit (une envie de fonctionnalité), ni une scission technique d'un TODO existant, mais un **bug** remonté par Charles-Henri en testant TODO-006 (LOT 1) sur iPhone : la liste de suggestions native (`<datalist>`) ne s'affiche jamais sur Safari iOS, sur les 4 endroits de l'app qui l'utilisent. Diagnostiqué par échange direct le 21/09/2026 (élimination d'une hypothèse de désynchronisation entre appareils : le vrai problème est bien l'absence totale d'affichage sur iPhone, pas un contenu différent). Ne provient d'aucun des 9 audits sources, ne s'ajoute donc pas aux 157 problèmes ni aux 22 actions d'origine.

*Ajout du 21/09/2026 (5)* : TODO-032 est encore différente — ni besoin produit, ni bug utilisateur, mais une découverte de dette technique (fichier mort jamais importé) faite en travaillant sur TODO-005 (LOT 3), signalée sans être corrigée conformément à la règle du lot ("si tu identifies un problème hors périmètre, ne le corrige pas"). Ne provient d'aucun des 9 audits sources, ne s'ajoute donc pas aux 157 problèmes ni aux 22 actions d'origine.

*Ajout du 21/09/2026 (6)* : TODO-033 et TODO-034 sont, comme TODO-032, des découvertes hors périmètre faites en travaillant sur TODO-009A (LOT 4A), signalées sans être corrigées conformément à la même règle du lot. TODO-033 reprend le volet « dernière activité `usageEvents` » de TODO-009A lui-même, dont les deux solutions proposées par la roadmap se sont révélées, à l'examen, disproportionnées par rapport au risque « faible » annoncé (voir TODO-009A ci-dessous) — Charles-Henri a tranché en `AskUserQuestion` de le laisser tel quel et de le journaliser en backlog plutôt que de l'implémenter dans ce lot. TODO-034 documente 4 autres points d'appel du même motif que celui corrigé sur `renderLinkedSection` (`fetchBundle()`+`resolveRef()` rechargeant 9 collections pour résoudre une seule référence), repérés par recherche mais non listés dans le périmètre déclaré de TODO-009A, donc non touchés. Ni l'une ni l'autre ne provient des 9 audits sources ; elles ne s'ajoutent donc pas aux 157 problèmes ni aux 22 actions d'origine.

*Ajout du 21/09/2026 (7)* : TODO-035 est encore différente — ni besoin produit, ni bug utilisateur au sens fonctionnel, ni scission technique, mais une découverte de dette technique (fichier mort) faite en diagnostiquant l'incident de cache de Service Worker (`sw.js`) remonté par Charles-Henri après la livraison de LOT 4A (voir le correctif dédié `sw.js`, hors roadmap car ne se rattachant à aucun TODO). Ne provient d'aucun des 9 audits sources, ne s'ajoute donc pas aux 157 problèmes ni aux 22 actions d'origine.

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

**Mise à jour du 21/09/2026 (exécution GitHub Actions, LOT 0B)** : premier passage réel des tests de règles (TEST-002) sur l'émulateur — 11 des 12 tests passent, confirmant que `firestore.rules` est correctement chargé et appliqué par l'émulateur. Un bug a été trouvé et corrigé avant tout déploiement (donc jamais actif en production) : la vérification `disabled` ajoutée par ce TODO pour corriger FIREBASE-001 (`.data.disabled != true`) lève une erreur d'évaluation dès que le champ `disabled` est absent du document `allowedUsers` — hors c'est le cas normal de tout compte jamais fermé, cela aurait donc bloqué l'accès de la quasi-totalité des comptes normaux. Corrigé en remplaçant par `.data.get('disabled', false) != true`, qui renvoie une valeur par défaut au lieu de lever une erreur quand le champ est absent — même comportement voulu, correctement implémenté cette fois. Seule cette ligne a été modifiée dans `firestore.rules`. Reste à confirmer par une exécution complète et verte du workflow GitHub Actions (voir TODO-002/LOT 0B).

## [x] P0 — TODO-002 — Émulateur Firebase, tests de règles et 2 parcours E2E cœur — **Terminé**

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

Statut (21/09/2026, LOT 0B) : **Terminé.** Implémenté : dossier `tests/` versionné complet (`package.json`, `firebase.json`, tests de règles TEST-027/TEST-002 avec `@firebase/rules-unit-testing`, 2 parcours E2E TEST-020/TEST-021 et tests unitaires navigateur TEST-001/TEST-006 avec Playwright, amorce de TEST-018 limitée au cas connexion/liste blanche — voir `tests/README.md` pour le détail exact du périmètre couvert et non couvert). Dérogation exceptionnelle validée par Charles-Henri le 20/09/2026 : quelques lignes ajoutées dans `js/services/firebase.js`, actives uniquement derrière un indicateur explicite posé par les tests (`globalThis.__PILOTAGE_USE_FIREBASE_EMULATOR__`, jamais vrai en production), pour permettre à TEST-001/006/018/020/021 de faire tourner l'app contre l'émulateur plutôt que contre la production — seule exception de ce lot à « aucun fichier applicatif modifié », aucun autre fichier de `js/` n'a été touché. **Bloquant découvert en cours de lot** : le registre npm (`registry.npmjs.org`) est inaccessible depuis l'environnement de réalisation (politique réseau, HTTP 403 confirmé, non contourné) — aucun test n'a pu y être exécuté. **Ajouté le 21/09/2026** : workflow GitHub Actions `.github/workflows/tests.yml` (déclenchement manuel, `workflow_dispatch`) qui installe Node/Java/les dépendances de `tests/`, les navigateurs Playwright, exécute `npm run test:rules` puis `npm run test:e2e`, et publie le rapport Playwright en artefact . **Premier déclenchement (21/09/2026)** : a échoué dès `test:rules` (`Error: ../firestore.rules is outside of project directory`) — le CLI Firebase interdit un `firestore.rules` référencé en dehors du dossier contenant `firebase.json`, qui vivait dans `tests/`. Corrigé en déplaçant `firebase.json` à la racine du dépôt, à côté de `firestore.rules` (voir ce fichier), et en ajustant les scripts de `tests/package.json` (`--config ../firebase.json`) ; `firestore.rules` n'a pas changé. **Troisième déclenchement (21/09/2026)** : `test:rules` passe intégralement (12/12, un bug de `firestore.rules` trouvé et corrigé à cette occasion — voir TODO-001 ci-dessus). `test:e2e` a échoué sur 6 des 9 tests, tous diagnostiqués et corrigés dans les fichiers de `tests/` uniquement (aucun fichier applicatif touché) — voir `tests/README.md` pour le détail : 3 échecs TEST-001 par authentification manquante avant lecture de `allowedUsers/{email}` (règle self-read LOT 0A), 3 échecs TEST-018/020/021 par absence du drapeau `__PILOTAGE_USE_FIREBASE_EMULATOR__` dans les fichiers de test naviguant directement vers `/index.html` (l'app se connectait donc à la vraie production Firebase). **Quatrième déclenchement (21/09/2026)** : 7 des 9 tests `test:e2e` passent ; les 2 derniers (parcours E2E complets TEST-020/TEST-021) échouaient sur `<div class="modal-overlay">` interceptant un clic — cause : `js/app.js#maybeShowUsageNotice` puis `js/components/onboarding.js#maybeShowFirstRunTour` ouvrent automatiquement deux modales à la toute première connexion d'un compte (le cas de tout compte de test, neuf à chaque exécution), jamais fermées par ces deux tests. Corrigé en ajoutant `tests/support/firstRun.js#dismissFirstRunModals()`, appelée après connexion dans les deux parcours E2E — ferme ces modales si elles apparaissent, sans toucher à l'application. **Cinquième déclenchement (21/09/2026)** : 7/9 toujours acquis, les 2 mêmes parcours échouent maintenant plus loin, sur une assertion précise chacun — `capture-qualification.spec.js` : `getByText(rawText)` ambigu (champ Description ET entrée d'historique contiennent le même texte), corrigé en ciblant `#detail-description` ; `projet-creation-cloture.spec.js` : `#add-task-inline` masqué car sous l'onglet "Contenu" de la fiche projet (3 onglets, "Détails" actif par défaut), jamais cliqué par le test — corrigé en cliquant cet onglet, et en scopant la vérification de la tâche ajoutée à `#detail-tasks` pour la même raison d'ambiguïté que ci-dessus. **Sixième déclenchement (21/09/2026)** : confirmé par Charles-Henri — le workflow GitHub Actions est passé 100 % au vert (`test:rules` 12/12, `test:e2e` 9/9). Ce TODO est **Terminé** : l'amorce d'outillage de test (émulateur Firebase, tests de règles, 2 parcours E2E cœur) est en place, exécutée avec succès en CI, et versionnée. Rappel de périmètre (inchangé) : cette amorce ne couvre que 7 des 27 manques d'`AUDIT_TESTS.md` ; les 20 autres restent en backlog non planifié (section 4.2), et la validation de `firestore.rules` dans la console Firebase réelle ainsi que son déploiement effectif relèvent de TODO-001/LOT 0A, non de ce TODO.

## [x] P1 — TODO-003 — Généraliser les actions rapides à 1 clic (report d'échéance, relance) sur la carte Tâche — **Terminé**

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

Statut (21/09/2026, LOT 2) : **Partiellement terminé — code et tests écrits, validation CI réelle restant à confirmer.** Implémenté et versionné : contrôle rapide "📅" sur la carte Kanban (`js/views/kanban.js#renderCard`), ouvrant un panneau déplié EN LIGNE (jamais une popover positionnée en absolu — `.kanban-column-cards` défile en `overflow-y:auto`, qui aurait pu couper une popover absolue près du bas d'une colonne, même famille de bug déjà rencontrée et documentée sur `#kanban-filters`) avec trois actions : "+1 j", "+7 j" (base de calcul : l'échéance actuelle si elle n'est pas déjà dépassée, sinon aujourd'hui — reporter une tâche déjà en retard "+1 jour" l'amène à demain, pas à un jour de plus de retard) et "Date libre" (`<input type="date">`, comme partout ailleurs dans l'app). Calcul de date via un nouvel helper local `addDaysToIsoDate()`, qui réutilise `dateUtils.parseLocalDate()` et reformate en composants locaux — jamais `toISOString()` — même précaution que documentée dans `js/services/dateUtils.js` pour ne pas réintroduire le bug de décalage minuit UTC/local déjà corrigé. Test TEST-023 écrit (`tests/e2e/lot2-quick-postpone.spec.js`, 2 scénarios : "+1 jour" et "date libre", tous deux vérifiant la cohérence avec `#detail-due`, le chemin déjà existant). **Premier passage réel du workflow GitHub Actions (21/09/2026)** : le scénario "date libre" est passé du premier coup ; le scénario "+1 jour" a échoué sur un bug du TEST lui-même, pas de l'application — `tasksApi.updateTask()` n'est pas attendu par le clic sur "+1 j"/"+7 j" (même geste "tire et oublie" que les boutons `‹ ›` de statut déjà existants), donc le toast de confirmation s'affichait avant la fin de l'écriture Firestore, et le test rouvrait la fiche détail trop tôt. Corrigé en attendant la disparition du toast avant de rouvrir la fiche (voir `tests/README.md`). **Confirmation de Charles-Henri (21/09/2026)** : nouveau passage réel du workflow GitHub Actions, les deux scénarios de TEST-023 ("+1 jour" et "date libre") sont désormais verts. TODO-003 est en conséquence **Terminé**, sans blocage résiduel de son fait.

## [x] P1 — TODO-004 — Étendre les rappels de retard aux Suivis — **Terminé**

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

Statut (21/09/2026, LOT 2) : **Partiellement terminé — code et tests écrits, validation CI réelle restant à confirmer.** Implémenté et versionné : `maybeNotifyStalledOrLate()` (`js/app.js`) inclut désormais le nombre de Suivis en retard de contrôle (`followUpsApi.isControlDue`) dans la notification de démarrage, aux côtés des tâches en retard/en pause déjà couvertes ; bouton "🔁 Relancer / ✅ Réglé" ajouté sur chaque ligne de Suivi dans `js/views/people.js#appendFollowUpRows` (fiche Personne, onglet Suivis) ET `js/views/followupsOverview.js#renderGroup` (liste transverse "👀 Suivis"), sans jamais ouvrir la fiche complète d'édition. Point d'attention découvert en cours d'implémentation (voir "Fonctions concernées" ci-dessus, qui visait `openEditFollowUpModal`) : `appendFollowUpRows` est utilisée dans 3 contextes, dont deux (fiche Personne, préparation de point) affichent un INSTANTANÉ non réactif plutôt qu'une liste tenue à jour par `followUpsApi.subscribe` — le bouton met donc à jour la ligne (badge, disparition des boutons) directement en local plutôt que de compter sur un redessin externe qui n'arriverait jamais tant que la fiche reste ouverte. Tests écrits : `tests/e2e/lot2-followup-quick-actions.spec.js` (les deux boutons, dans les deux vues où ils apparaissent) et `tests/unit/lot2-followup-reminders.spec.js` (TEST-005 décliné : `isControlDue` et `setStatus`, le chemin exact utilisé par les boutons). **Non testé, limite assumée** : la notification navigateur elle-même n'est pas vérifiée de bout en bout (fonction non exportée, API `Notification` peu adaptée à un test unitaire via `harness.html` — voir `tests/README.md`). **Premier passage réel du workflow GitHub Actions (21/09/2026)** : `lot2-followup-quick-actions.spec.js` (2/2) et `lot2-followup-reminders.spec.js` (2/2) verts dès ce premier passage — TODO-004 est donc **Terminé**, sans blocage résiduel de son fait.

## [x] P1 — TODO-005 — Afficher l'information déjà calculée là où la décision se prend — **Terminé**

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

Statut (21/09/2026, LOT 3) : **Terminé.** Volet santé implémenté et versionné : le score de santé (`projectHealthApi.computeHealth`, déjà utilisé par la vue "🩺 Santé", inchangé) est désormais aussi affiché dans l'en-tête de la fiche projet (`js/views/projects.js#openProjectDetail`, badge cliquable vers le signal le plus grave — seulement pour un projet actif, un projet fermé n'ayant plus besoin d'être surveillé, même filtre que `rankByHealth`) et sur chaque carte de la section "📦 Mes projets" du Dashboard (`js/views/dashboard.js#renderProjectsSection`, badge non cliquable séparément, la carte entière ouvrant déjà la fiche). Volet recherche : point bloquant identifié (`js/components/search.js#openSearchModal` documente une décision produit déjà actée et datée du 13/09/2026, exactement l'inverse de la solution proposée ici — "cocher par défaut l'inclusion des archivés") soumis à Charles-Henri, qui a confirmé le 21/09/2026 vouloir **garder la décision du 13/09** (recherche non élargie par défaut). Ce volet de TODO-005 est donc considéré traité par cette confirmation explicite, sans modification de `search.js` — TEST-024 non écrit puisqu'aucun comportement de la recherche n'a changé. **Extension du 21/09/2026 (retour de Charles-Henri après livraison)** : demande d'étendre l'affichage du badge de santé aux cartes de l'onglet Projets lui-même (vues "📋 Liste" et "🗂️ Par catégorie"), au-delà de la fiche détail et du Dashboard prévus par le texte d'origine de ce TODO — implémentée immédiatement à sa demande explicite (`js/views/projects.js#buildProjectCard`, fonction déjà partagée entre ces deux vues, même règle "jamais sur un projet fermé").

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

Statut (21/09/2026, LOT 1) : **Partiellement terminé.** Implémenté et versionné : utilitaire de validation partagé `js/components/formValidation.js` (surbrillance `.field-invalid` + toast, ex. "Le titre obligatoire"), appliqué aux 3 modales de création citées (Tâche, Projet, Ressource) ET à leurs fiches détail en modification (même échec silencieux constaté par UX-002 sur `openTaskDetail`) ; validation de format sur le champ URL de Ressource (COMP-UX-012) ; confirmation avant création silencieuse d'une nouvelle catégorie de projet (UX-008), avec réutilisation insensible à la casse d'une catégorie déjà existante. Test TEST-017 écrit (`tests/e2e/lot1-form-validation.spec.js`) — **confirmé par un passage réel du workflow GitHub Actions le 21/09/2026 : 4/4 verts** (les 4 cas — Tâche/Projet/Ressource sans champ obligatoire, Ressource avec URL mal formée). **Non fait, volontairement** : les contraintes de base dans `firestore.rules` sur `tasks`/`inboxItems` (SEC-011). En inspectant le fichier, `users/{uid}/{document=**}` est une seule règle récursive couvrant tout l'espace de données d'un utilisateur (pas de `match` séparé par collection) — Firestore évalue les règles en OR : ajouter un `match` plus spécifique avec des contraintes de type/taille ne restreindrait donc RIEN tant que cette règle générique reste, elle, permissive. Contraindre réellement `tasks`/`inboxItems` demanderait de restructurer ce fichier en plusieurs `match` par collection — un changement d'architecture des règles, pas un simple ajout, sur un fichier de sécurité tout juste stabilisé (100 % vert en CI) et sans capacité de le valider par l'émulateur dans ce tour (même blocage npm). Point signalé à Charles-Henri en cours de lot (voir échange du 21/09/2026) plutôt que traité unilatéralement. **Décision de Charles-Henri (21/09/2026)** : ce volet n'est pas abandonné — SEC-011 reste un besoin de sécurité valide — mais il est formellement sorti de TODO-006 et repris par un TODO dédié, **TODO-028** (restructuration de `firestore.rules` en règles par collection pour permettre des contraintes spécifiques), afin de ne pas bloquer le reste de ce TODO derrière une restructuration d'architecture des règles. TODO-006 est donc **partiellement terminé, et clos pour tout ce qui relevait effectivement de son périmètre réalisable dans ce lot** : la validation côté client (ci-dessus) est faite, versionnée et confirmée en CI ; seul le volet règles Firestore de SEC-011 reste non réalisé, et n'est désormais plus à la charge de ce TODO — voir TODO-028.

## [x] P1 — TODO-007 — Gabarit commun de création et de suppression — **Terminé**

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

Statut (21/09/2026, LOT 1) : **Partiellement terminé.** Les trois volets sont implémentés et versionnés : bouton "+ Tâche" dans l'écran Pilotage (`js/views/kanban.js`, en-tête, symétrique de "+ Projet" côté Projets) ; case "📣 Communication" retirée du formulaire de création et remplacée par un bouton "📣 Activer le canevas de communication" dans la fiche détail (`tasksApi.enableCommunicationCanevas`, nouvelle fonction, à sens unique comme l'était la case qu'elle remplace) ; confirmation de suppression d'un Projet ou d'une Personne enrichie avec le compte réel des entités rattachées (tâches/suivis/réunions/décisions/ressources pour un Projet, suivis/objectifs pour une Personne), sans requête supplémentaire (comptes déjà chargés par la fiche). `removeProject`/`removePerson` eux-mêmes restent inchangés : la politique de non-cascade n'est pas remise en cause par ce TODO, seul le message affiché avant confirmation change. Tests TEST-010 et TEST-025 écrits (`tests/e2e/lot1-orphan-references.spec.js`, `tests/unit/lot1-closure.spec.js`, ce dernier via un ajout mineur à `tests/support/harness.html` exposant `tasksApi`/`projectsApi`/`followUpsApi`). **Mise à jour du 21/09/2026 (premier passage réel du workflow GitHub Actions)** : TEST-025 passe intégralement (3/3 verts, clôture Tâche/Projet/Suivi). TEST-010 a échoué, mais sur un bug du TEST lui-même, pas de l'application : l'assertion `getByText("tâche")` sur le message de confirmation de suppression était ambiguë (elle matchait aussi l'onglet "📋 Tâches" et un toast "Tâche créée" encore présent dans le DOM), même famille de strict-mode violation déjà rencontrée en LOT 0B (voir tests/README.md). Corrigé en scopant l'assertion à `.modal-body` (seule modale active à cet instant). **Confirmation de Charles-Henri (21/09/2026)** : les tests du LOT 1 ont depuis été exécutés avec succès via GitHub Actions, ce correctif inclus — TEST-010 et TEST-025 sont donc désormais confirmés verts. Ce TODO est **Terminé** : ses trois volets (bouton "+ Tâche", déplacement du canevas Communication, message d'impact avant suppression) sont implémentés, versionnés et validés par un passage CI réel, sans blocage résiduel.

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

Statut (21/09/2026, LOT 4A) : **Partiellement terminé.** Implémenté et versionné : `tags.js#addTag`/`removeTagByName` utilisent désormais `storage.listWhere(COLLECTION, [["entityType", type], ["entityId", id]])` au lieu de `listAll()` + filtre en mémoire (voir le commentaire détaillé dans `tags.js`) ; `deleteTagEverywhere` a été délibérément **laissé sur `listAll()`** — cette fonction cherche un tag par NOM insensible à la casse sur TOUTES les fiches, ce qu'un filtre d'égalité Firestore ne peut pas exprimer sans un champ `tag` normalisé dédié (changement de modèle de données hors périmètre de ce TODO), documenté en commentaire dans `tags.js`. `js/components/linkedItems.js#renderLinkedSection` (le point d'usage réel du problème de `fetchBundle()`/`resolveRef()` décrit par ce TODO) ne charge plus les 9 collections complètes à chaque ouverture d'une fiche liée : une nouvelle fonction `resolveRefDirect(ref)` lit directement le document demandé via de nouveaux accesseurs `getX(id)` ajoutés à `tasks.js`, `followups.js`, `objectives.js` et `inbox.js` (les autres types en avaient déjà un), et diffère même le chargement des données auxiliaires (ex. les tâches d'un projet) au moment où l'utilisateur clique réellement sur le lien (`onOpen` rendu `async`), puisque la grande majorité des liens affichés ne sont jamais cliqués. `fetchBundle()`/`resolveRef()` restent inchangées et continuent de servir `openLinkPickerModal`/`openCreateAndLinkModal`, qui ont un besoin structurellement différent (rechercher/lister l'ensemble des fiches). **Non fait, volontairement** : le volet « dernière activité `usageEvents` » (`js/services/usageTracking.js`/`accountAdmin.js`) — les deux solutions proposées par ce TODO (champ dédié nécessitant une modification de `firestore.rules` sensible ; requête bornée par compte nécessitant un index composite Firestore jamais mis en place) se sont révélées, à l'examen, disproportionnées par rapport au risque « faible » annoncé pour ce sous-point. Signalé à Charles-Henri plutôt que traité unilatéralement ; **décision de Charles-Henri (21/09/2026)** : laisser tel quel pour l'instant, journalisé en backlog sous **TODO-033** (voir section 5, non affectée à un lot). Constaté au passage, hors périmètre déclaré de ce TODO : 4 autres points d'appel du même `fetchBundle()`+`resolveRef()` (`js/components/changeType.js`, `js/services/shortcuts.js`, `js/views/dashboard.js` — "🔄 Reprendre où j'en étais", `js/app.js` — résolution de lien profond) présentent le même motif inefficace ; non touchés (hors du périmètre déclaré de ce TODO), journalisés sous **TODO-034**. TODO-009A est donc **partiellement terminé** : les volets `tags.js` et `linkedItems.js`/`renderLinkedSection` sont faits, versionnés, syntaxiquement vérifiés (`node --check`) et couverts par un test (`tests/unit/lot4a-tags-listwhere.spec.js`, TEST-013 décliné) ; le volet `usageEvents` est différé en backlog (TODO-033), sans blocage pour le reste du TODO. Comme pour tous les tests écrits durant cette phase du projet, aucun n'a pu être exécuté dans l'environnement de réalisation (registre npm bloqué) — à confirmer par un passage réel du workflow GitHub Actions.

## [x] P1 — TODO-009B — Mutualiser les abonnements Firestore temps réel (`tasks`/`projects`/`followUps`) — **Terminé**

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

Statut (21/09/2026, LOT 4A) : **Terminé.** Le mécanisme de mutualisation d'abonnement déjà en production pour `inboxItems` (`js/domain/inbox.js#subscribeFiltered`) a été généralisé à `js/domain/tasks.js`, `js/domain/projects.js` et `js/domain/followups.js` : un `Set` d'abonnés, un seul `onSnapshot` Firestore ouvert à la première inscription et fermé à la dernière désinscription, un abonné qui arrive après coup rejoué immédiatement avec l'état courant (`lastRawItems`) plutôt que d'attendre une nouvelle écriture. Contrairement à `inboxItems` (3 filtres différents selon l'appelant), aucun filtre n'est nécessaire pour ces trois collections : tous les appelants actuels (6 vues pour `tasks`/`projects`, 4 pour `followUps`) veulent la même liste complète, donc chaque abonné reçoit directement le flux partagé. Cas particulier préservé : `tasksApi.subscribe(callback, { sort: false })` (utilisé par un appelant qui retrie lui-même) continue de passer par un abonnement Firestore dédié non mutualisé plutôt que de risquer de réutiliser à tort le flux partagé (trié) — voir le commentaire dans `tasks.js`. `followups.js` applique en plus `normalize()` (migration de statut legacy) une seule fois par instantané reçu, dans le flux partagé, comme avant la mutualisation. Aucun appelant (vues Dashboard/Kanban/Calendrier/Priorisation/Projets/Équipe/Ressources) n'a eu besoin d'être modifié : la mutualisation est entièrement transparente au niveau du domaine — les fichiers listés dans "Fichiers concernés" ci-dessus qui n'ont finalement pas été touchés (les 8 vues) le sont donc restés intentionnellement, la généralisation n'exigeant de changement que dans les 3 modules de domaine. Vérifié syntaxiquement (`node --check`) sur les 3 fichiers modifiés, et couvert par un test comportemental (`tests/unit/lot4a-subscribe-mutualization.spec.js`, TEST-013 décliné — abonnés synchronisés, abonné tardif rejoué, désabonnement partiel sans casse pour les autres abonnés, la classe de régression citée comme risque de ce TODO). Comme pour tous les tests de cette phase, non exécuté dans l'environnement de réalisation (registre npm bloqué) — à confirmer par un passage réel du workflow GitHub Actions.

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

## [x] P1 — TODO-022 — Carte indicateur « Échéances du jour » (tri : à faire d'abord, puis suivi/contrôle) — **Terminé**

*Ajouté le 21/09/2026 — besoin produit (BESOIN-002), voir section 9.*

Type : UX (nouveau besoin produit)

Problème : sur l'Accueil, rien ne montre en un coup d'œil le nombre d'éléments dont l'échéance tombe aujourd'hui, triés par ce qui doit être fait en premier (Tâches/actions personnelles) puis ce qui relève d'un suivi ou d'un contrôle — sans mélanger les dates de contrôle des collaborateurs (Suivis), que Charles-Henri ne veut pas voir dans cette carte précise.

Cause racine : besoin produit (hors audits) — BESOIN-002

Solution : ajouter une nouvelle carte indicateur sur le Dashboard affichant le nombre d'éléments dont l'échéance est le jour même, triés en deux groupes : 1) ce que Charles-Henri doit faire lui-même (Tâches/actions personnelles), 2) ce qui relève d'un suivi/contrôle qui lui revient — en excluant les échéances de contrôle des collaborateurs. À préciser lors du cadrage : critère exact de distinction entre « échéance personnelle » et « échéance collaborateur » dans le modèle Suivi actuel.

Fichiers concernés : `js/views/dashboard.js`

Fonctions concernées : rendu des cartes indicateurs (KPI), calcul des échéances du jour

Dépendances : aucune connue à ce stade

Problèmes résolus : BESOIN-002

Risque : faible — ajout d'affichage, aucune donnée modifiée

Complexité : S

Validation : Non déterminé — pas de test automatisé prévu pour cet écran

Ordre recommandé : LOT 3 (rejoint TODO-005, même thème de visibilité de l'information déjà calculée)

Statut (21/09/2026, LOT 3) : **Terminé.** Cadrage demandé à Charles-Henri (exactement le point que ce TODO indiquait lui-même devoir préciser, voir "Solution" ci-dessus) et confirmé le 21/09/2026 : groupe 2 = uniquement les Suivis `direction: "to_tell"` ("je dois transmettre/dire quelque chose à cette personne", `js/domain/followups.js`) dont la `controlDate` — qui revient alors à Charles-Henri lui-même, jamais à la personne suivie — tombe aujourd'hui ; les Suivis `waiting_on` (échéance qui appartient à la personne suivie) en sont exclus quel que soit le type de la personne, conformément à "en excluant les échéances de contrôle des collaborateurs". Implémenté et versionné : nouvelle tuile "📅 Échéances du jour" dans la grille d'indicateurs du Dashboard (`js/views/dashboard.js#renderStats`), comptant les Tâches à échéance aujourd'hui (`isDueToday`, même détection que le Focus du jour) + les Suivis "to_tell" dus aujourd'hui selon le critère ci-dessus ; clic → nouvelle modale `openTodayDueModal` listant les deux groupes séparément, Tâches d'abord puis Suivis "à transmettre" (tri demandé par ce TODO). Ne remplace pas la tuile "📅 Aujourd'hui" retirée le 01/09/2026 au profit du "🎯 Focus du jour" (périmètre différent, voir commentaire dans `renderStats`). Aucun test automatisé prévu par ce TODO ("Validation : Non déterminé").

## [ ] P1 — TODO-023 — Corriger les régressions d'affichage en mode sombre

*Ajouté le 21/09/2026 — besoin produit (BESOIN-003), voir section 9.*

Type : BUG / UX (nouveau besoin produit)

Problème : constaté par Charles-Henri en parcourant les écrans le 21/09/2026 — en mode sombre : (1) le traitement d'un item de l'Inbox affiche le texte de chaque élément en noir (illisible sur fond sombre) ; (2) tous les calendriers affichés dans les champs de type date s'affichent en noir (illisibles) ; (3) les toasts temporaires ont un fond blanc avec une écriture blanche (illisibles).

Cause racine : besoin produit (hors audits) — BESOIN-003 ; probablement des couleurs codées en dur (non liées aux tokens de thème) sur ces éléments précis, à confirmer lors du cadrage

Solution : identifier et corriger les couleurs codées en dur (ou l'absence de redéfinition en mode sombre) sur : l'écran de traitement/qualification d'un item Inbox, le composant natif de sélection de date (`<input type="date">`, propriété CSS `color-scheme`), et le composant toast.

Fichiers concernés : `js/views/inbox.js`, `js/components/toast.js`, feuilles de styles concernées (fichier exact à confirmer lors du cadrage)

Fonctions concernées : rendu de la modale de qualification Inbox, `showToast`, styles des champs `<input type="date">`

Dépendances : aucune connue à ce stade

Problèmes résolus : BESOIN-003

Risque : faible — correctifs CSS ciblés, aucun changement de comportement fonctionnel

Complexité : S

Validation : Non déterminé — vérification visuelle manuelle en mode sombre sur chaque écran concerné

Ordre recommandé : nouveau LOT 10 — priorité élevée proposée vu la gêne d'usage immédiate et le faible coût de correction, malgré son ajout tardif à la roadmap

## [ ] P1 — TODO-024 — Suivi structuré des objectifs : indicateurs de réussite et éléments de suivi associés

*Ajouté le 21/09/2026 — besoin produit (BESOIN-001, volet objectifs), voir section 9.*

Type : DATA / UX (nouveau besoin produit)

Problème : les objectifs (`js/domain/objectives.js`) ne permettent pas aujourd'hui de décrire chaque indicateur de réussite individuellement (cible, mode de mesure, source de preuve, fréquence de suivi), ni d'associer à un objectif — ou à une information — des éléments de suivi dédiés ; la structure illustrée par les deux exemples SMART fournis par Charles-Henri le 21/09/2026 resterait donc en texte libre non exploitable.

Cause racine : besoin produit (hors audits) — BESOIN-001 (volet objectifs)

Solution : **à concevoir lors du cadrage de ce lot** — Charles-Henri a explicitement demandé une proposition (« que proposes-tu pour faire cela ? »), non tranchée à ce stade et volontairement non traitée maintenant. Piste de départ à instruire : structurer chaque objectif avec une liste d'indicateurs de réussite (cible, mesure, source de preuve, fréquence de suivi chacun) et permettre de rattacher des éléments de suivi (ou une information) à un objectif ou à un indicateur précis.

Fichiers concernés : `js/domain/objectives.js`, vue(s) Objectifs concernée(s) (à identifier lors du cadrage)

Fonctions concernées : à déterminer lors du cadrage

Dépendances : proposition de conception à valider par Charles-Henri avant tout développement (voir Solution) ; thème partagé avec TODO-025 (préparation des points de suivi)

Problèmes résolus : BESOIN-001 (volet objectifs)

Risque : moyen — nouveau modèle de données, à concevoir avec soin pour rester cohérent avec l'existant (`objectives.js`, `followups.js`)

Complexité : L (modèle de données + UI) — à affiner lors du cadrage

Validation : Non déterminé — à définir lors du cadrage

Ordre recommandé : nouveau LOT 11, avec TODO-025

## [ ] P1 — TODO-025 — Qualification immédiate des éléments créés sur une fiche Personne (suivi perso / à transmettre / attendu, préparation du point de suivi)

*Ajouté le 21/09/2026 — besoin produit (BESOIN-001, volet personnes), voir section 9.*

Type : DATA / UX (nouveau besoin produit)

Problème : à la création d'un élément sur la fiche d'une personne, rien ne permet aujourd'hui d'indiquer immédiatement (1) si cet élément doit remonter dans la préparation du prochain point de suivi avec cette personne, ni (2) sa nature — un suivi purement personnel, quelque chose à transmettre à cette personne, ou quelque chose d'attendu de sa part.

Cause racine : besoin produit (hors audits) — BESOIN-001 (volet personnes)

Solution : **à concevoir lors du cadrage de ce lot**, non tranchée à ce stade et volontairement non traitée maintenant. Piste de départ à instruire : ajouter à la création d'un élément rattaché à une personne un indicateur « à remonter en préparation du point de suivi » et un type parmi {suivi perso, à transmettre, attendu}, puis exploiter ces champs dans l'écran de préparation du point de suivi existant.

Fichiers concernés : `js/views/people.js`, `js/domain/followups.js` (à confirmer lors du cadrage selon l'entité réellement concernée)

Fonctions concernées : à déterminer lors du cadrage

Dépendances : thème partagé avec TODO-024 ; écran de préparation du point de suivi existant à identifier précisément lors du cadrage

Problèmes résolus : BESOIN-001 (volet personnes)

Risque : faible à moyen — ajout de champs, à vérifier vis-à-vis des filtres déjà existants sur les Suivis

Complexité : M — à affiner lors du cadrage

Validation : Non déterminé — à définir lors du cadrage

Ordre recommandé : nouveau LOT 11, avec TODO-024

## [ ] P1 — TODO-026 — US-026 : Navigation personnalisable par utilisateur

*Ajouté le 21/09/2026 — besoin produit (BESOIN-004), voir section 9. Priorité P1 indiquée explicitement par Charles-Henri dans sa spécification.*

Type : UX / DATA (nouveau besoin produit — spécification déjà détaillée fournie par Charles-Henri)

Problème : la barre de navigation est aujourd'hui identique pour tous les usages (Accueil, Inbox, Pilotage, Équipe, Plus) ; certains utilisateurs souhaiteraient réorganiser ou remplacer certains onglets principaux selon leurs usages réels, sans impact sur les autres utilisateurs.

Cause racine : besoin produit (hors audits) — BESOIN-004

Solution : reprendre intégralement la spécification fournie (US-026) — feuille de personnalisation mobile (appui long sur la barre), fenêtre de personnalisation web (bouton ⚙ Personnaliser), glisser-déposer entre « barre principale » (4 modules personnalisables + Plus fixe) et « Plus », restauration de la navigation par défaut, nouvelle préférence utilisateur `navigation.main`, synchronisation web/mobile, nouveaux modules ajoutés automatiquement dans Plus. Voir le document fourni par Charles-Henri le 21/09/2026 pour le détail complet (règles métier, critères d'acceptation, modèle de données).

Fichiers concernés : `js/app.js` (table de navigation), `js/domain/preferences.js` (nouvelle préférence `navigation.main`), vue(s) de personnalisation à créer (web et mobile)

Fonctions concernées : à déterminer lors du cadrage

Dépendances : aucune connue à ce stade ; à croiser avec TODO-020 (LOT 9, clarté de nommage de la navigation existante) lors du cadrage pour éviter tout chevauchement

Problèmes résolus : BESOIN-004

Risque : moyen — touche la navigation centrale de l'app sur web et mobile, à tester soigneusement sur les deux

Complexité : L

Validation : Non déterminé — critères d'acceptation déjà fournis par Charles-Henri (voir spécification), à traduire en scénarios de test lors du cadrage

Ordre recommandé : nouveau LOT 12

## [ ] P2 — TODO-027 — Bureau : post-it libres sur l'écran d'accueil

*Ajouté le 21/09/2026 — besoin produit (BESOIN-005), voir section 9. Aucune priorité explicite indiquée par Charles-Henri — P2 proposé (fonctionnalité significative mais non bloquante), à confirmer.*

Type : UX / DATA (nouveau besoin produit — spécification déjà détaillée fournie par Charles-Henri)

Problème : il n'existe aujourd'hui aucun espace de notes libres et visuelles, distinct de l'Inbox, pour capturer rapidement des informations pendant une réunion ou organiser des idées avant de les transformer en objets Pilotage (Tâche, Suivi, Ressource, Décision, Information).

Cause racine : besoin produit (hors audits) — BESOIN-005

Solution : reprendre intégralement la spécification fournie — section « Mon bureau » sur l'écran Accueil, post-it multiples et indépendants (texte ou checklist), déplacement libre et redimensionnement (sauvegarde automatique de position/taille/z-index), couleurs, épingler/archiver/supprimer, conversion du post-it entier ou d'une seule ligne de checklist vers Tâche/Suivi/Ressource/Décision/Information. Voir le document fourni par Charles-Henri le 21/09/2026 pour le détail complet (modèle de données `StickyNote`/`ChecklistItem`, critères d'acceptation).

Fichiers concernés : `js/views/dashboard.js`, nouveau domaine à créer (ex. `js/domain/stickyNotes.js`), nouveau composant de bureau à créer

Fonctions concernées : à déterminer lors du cadrage

Dépendances : réutilise les formulaires de création existants (Tâche/Suivi/Ressource/Décision/Information) pour la conversion, avec préremplissage — à vérifier lors du cadrage que chacun accepte bien un préremplissage type `prefill`

Problèmes résolus : BESOIN-005

Risque : moyen à élevé — nouveau modèle de données, interactions de glisser-déposer/redimensionnement les plus riches de l'app à ce jour, sauvegarde automatique fréquente (position pendant déplacement) à calibrer pour ne pas multiplier les écritures Firestore (cohérence à vérifier avec SYS-001/TODO-010)

Complexité : L

Validation : Non déterminé — critères d'acceptation déjà fournis par Charles-Henri (voir spécification), à traduire en scénarios de test lors du cadrage

Ordre recommandé : nouveau LOT 13

## [ ] P2 — TODO-028 — Restructurer `firestore.rules` en règles par collection pour permettre les contraintes de SEC-011 (`tasks`/`inboxItems`)

*Ajoutée le 21/09/2026 — reprend le volet non réalisé de TODO-006/SEC-011, sorti de ce TODO sur décision explicite de Charles-Henri (voir échange du 21/09/2026) plutôt que traité à l'aveugle dans LOT 1. Priorité P2 déterminée à partir de la gravité propre de SEC-011 dans `AUDIT_SECURITY.md` — **MOYENNE**, risque strictement borné au `uid` du même utilisateur — par opposition au P1 de TODO-006, qui tenait à la combinaison avec USE-UX-002/USE-UX-008 (confiance utilisateur, gravité plus immédiate) et non à SEC-011 pris isolément. Aucune autre priorité ou décision existante n'est modifiée par cet ajout.*

Type : SEC

Problème : les règles Firestore ne posent aucune contrainte sur `request.resource.data` pour les collections `tasks`/`inboxItems` (ni type, ni taille) : un client compromis, un bug applicatif, ou un appel direct à l'API Firestore avec un jeton valide peut écrire des documents de forme arbitraire sous son propre `uid`. Structurellement, `firestore.rules` ne peut pas recevoir aujourd'hui une contrainte par collection : une seule règle récursive `match /users/{uid}/{document=**}` couvre tout l'espace de données d'un utilisateur, et Firestore évalue en OR les règles qui matchent un même chemin — un `match` plus spécifique et plus strict ajouté à côté ne restreindrait donc rien tant que cette règle générique reste, elle, permissive.

Cause racine : SEC-011 (volet règles Firestore) — non traité par TODO-006, dont il faisait initialement partie ; carve-out décidé par Charles-Henri le 21/09/2026 pour ne pas bloquer le reste de TODO-006 derrière une restructuration d'architecture des règles.

Solution : restructurer `firestore.rules` en `match` séparés par collection sous `users/{uid}/...` (au minimum `tasks/{taskId}`, `inboxItems/{itemId}`, en conservant un `match` générique de repli pour les autres collections non encore distinguées, afin de ne rien retirer par inadvertance à un usage existant), puis ajouter sur `tasks`/`inboxItems` des contraintes de type et de taille maximale raisonnable sur les champs texte, comme recommandé par `AUDIT_SECURITY.md` (SEC-011). Valider systématiquement chaque contrainte par un test de règles sur l'émulateur avant tout déploiement réel.

Fichiers concernés : `firestore.rules`, `tests/rules/*` (extension des tests de règles existants avec de nouveaux cas par collection)

Fonctions concernées : n/a — règles de sécurité déclaratives, aucun code applicatif à modifier a priori

Dépendances : TODO-001 (même fichier `firestore.rules`, dont ce TODO restructure le contenu déjà versionné et stabilisé) ; TODO-002 (émulateur Firebase et infrastructure `test:rules`, socle indispensable — aucune modification de `firestore.rules` ne doit être déployée sans un nouveau passage vert de ces tests, étendus aux nouvelles contraintes par collection)

Problèmes résolus : SEC-011 (volet règles Firestore uniquement — le volet validation côté client de SEC-011/UX-002/UX-008/COMP-UX-012 est déjà résolu par TODO-006)

Risque : moyen — une règle mal calibrée peut bloquer un accès légitime ; restructurer une règle unique en plusieurs `match` par collection risque d'oublier une collection existante au passage (régression d'accès) si l'inventaire des collections sous `users/{uid}` n'est pas exhaustif au moment du cadrage

Complexité : M (restructuration des règles + contraintes de type/taille + tests de règles dédiés par collection)

Validation : nouveaux tests de règles sur l'émulateur (extension de `test:rules`/TEST-027), au moins un par collection contrainte, confirmés verts avant tout déploiement réel

Ordre recommandé : après TODO-001 (même fichier) — non affectée à un lot pour l'instant, à planifier

## [ ] P2 — TODO-029 — Note automatique de traçabilité sur relance/règlement rapide d'un Suivi

*Ajoutée le 21/09/2026 — besoin produit (BESOIN-006, voir section 9), retour direct de Charles-Henri après livraison de TODO-004. Aucune priorité explicite indiquée — P2 proposé (amélioration de confort/traçabilité sur une fonctionnalité déjà livrée, non bloquante), à confirmer.*

Type : UX / DATA

Problème : les actions rapides "🔁 Relancer" / "✅ Réglé" (TODO-004) changent le statut d'un Suivi en 1 clic, directement depuis la liste, sans laisser de trace visible sur la fiche elle-même — contrairement à une modification faite depuis la fiche complète, rien n'indique ensuite, dans le journal de notes du Suivi, qu'une relance a été faite ou qu'il a été réglé, ni à quelle date.

Cause racine : besoin produit (hors audits) — BESOIN-006

Solution : à chaque clic sur "🔁 Relancer" ou "✅ Réglé" (`js/views/people.js#appendFollowUpRows` et `js/views/followupsOverview.js#renderGroup`), ajouter automatiquement une entrée horodatée au journal de notes du Suivi (même mécanisme que `followUpsApi.addNote`), du type "🔁 Relancé le JJ/MM/AAAA" ou "✅ Réglé le JJ/MM/AAAA" — visible ensuite dans l'onglet Notes de la fiche complète, sans avoir eu besoin de l'ouvrir pour l'action elle-même.

Fichiers concernés : `js/domain/followups.js`, `js/views/people.js`, `js/views/followupsOverview.js`

Fonctions concernées : `setStatus` (ou nouvelle fonction dédiée combinant changement de statut et note), `addNote`, `appendFollowUpRows`, `renderGroup`

Dépendances : TODO-004 (mêmes boutons rapides, déjà en place — ce TODO les complète, ne les remplace pas)

Problèmes résolus : BESOIN-006

Risque : faible — ajout d'une note, ne modifie pas le comportement existant des boutons rapides

Complexité : S

Validation : Non déterminé — test vérifiant qu'un clic sur "🔁 Relancer"/"✅ Réglé" ajoute bien une entrée au journal de notes avec le texte et la date attendus

Ordre recommandé : après TODO-004 (LOT 14)

## [ ] P2 — TODO-030 — Contrôle rapide de date (+1j/+7j/date libre) sur les champs date des fiches Suivi

*Ajoutée le 21/09/2026 — besoin produit (BESOIN-007, voir section 9), retour direct de Charles-Henri après livraison de TODO-003. Aucune priorité explicite indiquée — P2 proposé, à confirmer.*

Type : UX

Problème : le contrôle rapide "+1j / +7j / date libre" ajouté sur la carte Tâche (TODO-003) n'existe pas sur les champs de date des fiches Suivi (échéance, date de contrôle) — modifier une de ces dates demande toujours de passer directement par le champ date natif, sans le raccourci de report désormais disponible côté Tâche.

Cause racine : besoin produit (hors audits) — BESOIN-007

Solution : reprendre le contrôle "+1j / +7j / date libre" (même logique de calcul que `kanban.js#addDaysToIsoDate`) à côté des champs de date du formulaire Suivi (`#fu-due`/`#fu-control`, création et fiche détail, `js/views/people.js`) — à l'occasion, envisager de mutualiser le calcul de date dans un module partagé plutôt que de dupliquer `addDaysToIsoDate` (décision d'architecture mineure à trancher au cadrage, pas à l'aveugle).

Fichiers concernés : `js/views/people.js`, possiblement un nouveau module partagé pour le calcul de date (à trancher au cadrage plutôt qu'en dupliquant `js/views/kanban.js#addDaysToIsoDate`)

Fonctions concernées : `openCreateFollowUpModal`, fonction d'édition du Suivi dans la fiche Personne

Dépendances : TODO-003 (même logique de calcul de date)

Problèmes résolus : BESOIN-007

Risque : faible

Complexité : S/M

Validation : Non déterminé

Ordre recommandé : après TODO-003 (LOT 14)

## [ ] P2 — TODO-031 — Remplacer le `<datalist>` natif par une liste de suggestions qui s'affiche aussi sur iOS Safari

*Ajoutée le 21/09/2026 — bug remonté par Charles-Henri en testant la confirmation de catégorie (TODO-006, LOT 1) sur iPhone, hors des 9 audits sources. Diagnostic confirmé par échange direct (21/09/2026) : sur PC/navigateur de bureau, la liste de suggestions s'affiche normalement ; sur iPhone (Safari), rien ne s'affiche jamais.*

Type : UX

Problème : Safari sur iOS n'affiche jamais la liste de suggestions native (`<datalist>`) utilisée pour l'autocomplétion à 4 endroits de l'app — catégorie de projet (création et fiche détail), éditeur de tags réutilisé par 9 fiches (`js/components/tagsEditor.js`), filtre "#tag" de la recherche globale (`js/components/search.js`), et les 3 champs de "saisie en masse" ressource/prompt/tag du Kanban (`js/views/kanban.js`). Aucune suggestion n'apparaît jamais à la frappe sur cet appareil, contrairement à un navigateur de bureau où la liste s'affiche normalement — limitation de la plateforme, pas un défaut de configuration d'un champ en particulier (les 4 endroits sont concernés de la même façon).

Cause racine : bug hors audit — remonté par Charles-Henri le 21/09/2026, non issu des 9 audits sources.

Solution : remplacer le mécanisme natif `<input list="...">` + `<datalist>` par une petite liste de suggestions dessinée par l'app elle-même (composant JS partagé, ex. `js/components/autocomplete.js`) : affichée sous le champ, filtrée au fur et à mesure de la frappe, sélectionnable au clic comme au clavier (flèches/Entrée, à reproduire explicitement — voir Risque) — fonctionne alors identiquement sur tous les navigateurs, y compris iOS Safari. À construire comme un composant partagé unique plutôt que reproduit 4 fois, même principe que l'unification de l'éditeur de tags le 13/09/2026 (voir son en-tête de fichier).

Fichiers concernés : nouveau composant partagé (proposition : `js/components/autocomplete.js`), `js/views/projects.js` (catégorie, ×2 : création et fiche détail), `js/components/tagsEditor.js`, `js/components/search.js`, `js/views/kanban.js` (saisie en masse, ×3 champs)

Fonctions concernées : `openCreateProjectModal`, `openProjectDetail` (champs catégorie), `renderTagsEditor`, le filtre "#tag" de `mountGlobalSearch`, la modale de saisie en masse du Kanban

Dépendances : aucune

Problèmes résolus : (nouveau, hors audits)

Risque : faible à moyen — un composant mal calé pourrait régresser la navigation clavier (flèches/Entrée) que `<datalist>` offre nativement ; à reproduire explicitement dans le nouveau composant, pas à perdre au passage

Complexité : M (un composant partagé + 4 points d'intégration à migrer)

Validation : Non déterminé — un test automatisé ne peut pas reproduire ce défaut (spécifique au moteur de rendu Safari iOS, pas simulable via l'émulateur Playwright/Chromium déjà en place) ; validation manuelle sur un navigateur de bureau ET un iPhone réel nécessaire

Ordre recommandé : non affectée à un lot pour l'instant, à planifier

---

## [ ] P3 — TODO-032 — Supprimer le fichier mort `js/views/projectHealth.js` (doublon jamais importé de `js/domain/projectHealth.js`)

*Ajoutée le 21/09/2026 — découverte hors périmètre en travaillant sur TODO-005 (LOT 3), signalée sans être corrigée conformément à la règle du lot ("si tu identifies un problème hors périmètre, ne le corrige pas").*

Type : CODE (dette technique, aucun impact utilisateur)

Problème : `js/views/projectHealth.js` est un doublon quasi identique de `js/domain/projectHealth.js` (même `computeHealth`/`rankByHealth`, même logique), mais n'est importé nulle part dans l'app (`grep` ne trouve aucun `from ".../views/projectHealth.js"`) — jamais exécuté. Il importe même `./tasks.js` en relatif à `js/views/`, fichier qui n'existe pas à cet emplacement (seul `js/domain/tasks.js` existe) : ce fichier planterait s'il était un jour importé par erreur.

Cause racine : fichier mort, probablement un reliquat d'un déplacement de `js/views/` vers `js/domain/` non nettoyé après coup.

Solution : supprimer `js/views/projectHealth.js` après avoir confirmé (nouvelle recherche au moment du traitement) qu'aucun import n'y a été ajouté entretemps.

Fichiers concernés : `js/views/projectHealth.js` (suppression)

Dépendances : aucune

Problèmes résolus : (nouveau, hors audits — dette technique)

Risque : faible — suppression d'un fichier non importé

Complexité : XS

Validation : `grep` de contrôle avant suppression (aucun import) + vérification que la vue "🩺 Santé" (`js/views/projects.js`, qui importe `js/domain/projectHealth.js`) continue de fonctionner après coup

Ordre recommandé : non affectée à un lot pour l'instant, à planifier (bas risque, sans urgence)

---

## [ ] P3 — TODO-033 — Optimiser le calcul de dernière activité (`usageEvents`) pour « 👥 Comptes »

*Ajoutée le 21/09/2026 — volet de TODO-009A (LOT 4A) délibérément non traité dans ce lot, sur décision explicite de Charles-Henri (voir TODO-009A en section 5).*

Type : DATA

Problème : le calcul de dernière activité affiché dans l'écran d'administration « 👥 Comptes » (`js/services/usageTracking.js#fetchUsageEvents`, `js/services/accountAdmin.js#listAccounts`) relit l'intégralité de la collection `usageEvents` (tous comptes confondus) à chaque affichage, au lieu d'une lecture bornée par compte.

Cause racine : SYS-002 (même famille que TODO-009A, volet non traité)

Solution : deux pistes identifiées par la roadmap d'origine, toutes deux jugées disproportionnées par rapport au risque « faible » annoncé pour ce sous-point et donc non tranchées dans l'immédiat : (1) un champ dédié de dernière activité par compte, qui nécessiterait une modification de `firestore.rules` (sujet sensible, voir le précédent SEC-011/TODO-028) ; (2) une requête bornée par compte (`listWhere`), qui nécessiterait un index composite Firestore jamais mis en place dans ce projet (dépendance de déploiement réelle, comme les règles de sécurité) et remplacerait un appel réseau par N. Une piste plus légère (pagination, mise en cache côté client) reste à évaluer le moment venu.

Fichiers concernés : `js/services/usageTracking.js`, `js/services/accountAdmin.js`

Fonctions concernées : `fetchUsageEvents`, `listAccounts`

Dépendances : accès à la console Firebase pour un éventuel index composite ou une évolution de `firestore.rules`

Problèmes résolus : (reprend le volet `usageEvents` de DATA-004/DATA-005/FIREBASE-003, initialement sous TODO-009A)

Risque : à réévaluer — plus élevé que le « faible » annoncé initialement par TODO-009A pour ce sous-point (voir Solution ci-dessus)

Complexité : à réévaluer selon la piste retenue

Validation : non déterminée tant que la piste n'est pas choisie

Ordre recommandé : non affectée à un lot pour l'instant, à planifier

---

## [ ] P3 — TODO-034 — Étendre l'optimisation de résolution de lien aux autres appelants de `fetchBundle()`/`resolveRef()`

*Ajoutée le 21/09/2026 — découverte hors périmètre en travaillant sur TODO-009A (LOT 4A), signalée sans être corrigée conformément à la règle du lot ("si tu identifies un problème hors périmètre, ne le corrige pas").*

Type : CODE / PERFORMANCE

Problème : `js/components/linkedItems.js#renderLinkedSection` a été corrigé en LOT 4A (TODO-009A) pour ne plus recharger 9 collections complètes (`fetchBundle()`) à chaque résolution d'un lien déjà connu. Le même motif inefficace subsiste, non touché, à 4 autres points d'appel de `fetchBundle()`+`resolveRef()` : `js/components/changeType.js`, `js/services/shortcuts.js`, `js/views/dashboard.js` (fonctionnalité "🔄 Reprendre où j'en étais"), `js/app.js` (résolution de lien profond/deep-link).

Cause racine : SYS-002 (même famille que TODO-009A)

Solution : évaluer, pour chacun des 4 appelants, si le même remplacement par `resolveRefDirect()` (ou équivalent) s'applique tel quel, ou si leur besoin réel (ex. deep-link pouvant cibler n'importe quel type sans contexte préalable) justifie de conserver `fetchBundle()` — à trancher au cas par cas plutôt que par un remplacement uniforme.

Fichiers concernés : `js/components/changeType.js`, `js/services/shortcuts.js`, `js/views/dashboard.js`, `js/app.js`, `js/components/linkedItems.js` (`resolveRefDirect`, déjà en place)

Fonctions concernées : usages de `fetchBundle`/`resolveRef` dans ces 4 fichiers

Dépendances : TODO-009A (déjà partiellement terminé — `resolveRefDirect()` existe et peut être réutilisée)

Problèmes résolus : (extension du périmètre de DATA-004/FIREBASE-003, non couverte par TODO-009A)

Risque : faible à moyen selon l'appelant — à évaluer individuellement (le cas du deep-link notamment peut avoir un besoin structurellement différent)

Complexité : S à M selon le nombre d'appelants effectivement convertis

Validation : à définir au moment du traitement

Ordre recommandé : non affectée à un lot pour l'instant, à planifier

---

## [ ] P3 — TODO-035 — Supprimer le fichier mort `js/services/storage-local.js` (mode stockage local abandonné, jamais réellement retiré du dépôt)

*Ajoutée le 21/09/2026 — découverte hors périmètre en diagnostiquant l'incident de cache de Service Worker remonté par Charles-Henri après la livraison de LOT 4A (voir le correctif dédié dans `sw.js`), signalée sans être corrigée conformément à la règle "si tu identifies un problème hors périmètre, ne le corrige pas".*

Type : CODE (dette technique, aucun impact utilisateur)

Problème : `sw.js` affirme depuis le 15/09/2026, en commentaire, que « `storage-local.js` a été retiré : ce fichier n'existe plus dans l'application (le mode "stockage local" a été remplacé par Firestore) » et l'a en conséquence retiré de `APP_SHELL`. Or `js/services/storage-local.js` existe toujours réellement dans le dépôt (5,3 Ko, daté du 15/09/2026) — seul son retrait du précache a été fait, pas la suppression du fichier lui-même. Aucun fichier applicatif ne l'importe (seul `js/services/storage.js` le MENTIONNE en commentaire, sans `import`) : comme `js/views/projectHealth.js` (TODO-032), c'est un fichier mort jamais exécuté, mais qui laisse le dépôt et son historique de commentaires en contradiction avec l'état réel des fichiers.

Cause racine : suppression partielle (retrait du précache) jamais suivie de la suppression réelle du fichier, ni d'une correction du commentaire de `sw.js` qui affirme à tort qu'il « n'existe plus ».

Solution : supprimer `js/services/storage-local.js` après avoir confirmé (nouvelle recherche au moment du traitement) qu'aucun `import` n'y a été ajouté entretemps ; envisager de corriger le commentaire de `sw.js` (15/09/2026) qui affirme à tort que le fichier a déjà été supprimé.

Fichiers concernés : `js/services/storage-local.js` (suppression)

Dépendances : aucune

Problèmes résolus : (nouveau, hors audits — dette technique)

Risque : faible — suppression d'un fichier non importé, déjà exclu du précache

Complexité : XS

Validation : `grep` de contrôle avant suppression (aucun import)

Ordre recommandé : non affectée à un lot pour l'instant, à planifier (bas risque, sans urgence) — peut être regroupée avec TODO-032, même nature

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
**Statut (mis à jour le 21/09/2026)** : **Préparé — validation finale restante.** La préparation (fichier `firestore.rules` versionné, corrections de règles, réalignement du tutoriel `adminPanel.js`) est faite ; ne sont pas encore faits : la comparaison avec les règles réellement déployées dans la console Firebase, le déploiement lui-même, et les tests de règles (TEST-027, LOT 0B). Premier passage réel de TEST-002 le 21/09/2026 (voir TODO-001 en section 5) : 11/12 tests OK, un bug de préparation trouvé et corrigé avant tout déploiement (`.data.disabled` → `.data.get('disabled', false)`, sinon tout compte jamais fermé aurait été bloqué). Voir TODO-001 en section 5 pour le détail complet.

### LOT 0B — Socle de tests — **Terminé**

**Objectif** : donner à la roadmap un filet de non-régression avant de commencer les chantiers de correction.
**Problèmes concernés** : TODO-002
**Prérequis** : aucun pour l'émulateur et les 2 E2E cœur ; le contenu final de `firestore.rules` (LOT 0A) pour la sous-partie tests de règles uniquement. Le choix de l'outillage (`package.json` isolé dans `tests/` vs outillage jetable non versionné) sera fait au démarrage de ce lot, sans le bloquer (décision produit du 15/09/2026 : à proposer, pas à imposer)
**Modifications principales** : émulateur Firebase, tests de règles, 2 parcours E2E cœur — amorce d'outillage ne couvrant que 7 des 27 manques d'`AUDIT_TESTS.md` (les 20 autres restent en backlog non planifié, section 4.2)
**Tests nécessaires** : TEST-020, TEST-021
**Risques** : investissement initial sans bénéfice visible immédiat pour l'utilisateur final ; premier outillage Node introduit dans un dépôt qui n'en a jamais eu
**Statut (21/09/2026)** : **Terminé.** Outillage choisi (dossier `tests/` isolé et versionné) et code des tests écrit dans son intégralité ; aucun test n'a pu être exécuté dans l'environnement de réalisation (registre npm bloqué — voir TODO-002 en section 5 et `tests/README.md`). Une dérogation exceptionnelle, ciblée et validée par Charles-Henri a été introduite dans `js/services/firebase.js` pour que les tests puissent tourner contre l'émulateur plutôt que la production. Le workflow GitHub Actions `.github/workflows/tests.yml` a été ajouté le 21/09/2026 (déclenchement manuel) pour exécuter cette suite dans un environnement disposant d'un accès npm ; le premier déclenchement (21/09/2026) a échoué sur un problème d'emplacement de `firebase.json` par rapport à `firestore.rules`, corrigé le jour même ; le troisième déclenchement (21/09/2026) a fait passer `test:rules` au vert (12/12) et mis en évidence 6 échecs sur `test:e2e`, corrigés dans `tests/` ; le quatrième déclenchement (21/09/2026) a fait passer 7 des 9 tests `test:e2e`, les 2 derniers (les parcours E2E complets TEST-020/TEST-021) échouant sur deux modales automatiques de première connexion (`maybeShowUsageNotice`, visite guidée) non fermées par les tests, corrigé via `tests/support/firstRun.js` ; le cinquième déclenchement (21/09/2026) a vu ces 2 mêmes parcours échouer plus loin, sur une assertion de sélecteur trop ambiguë ou mal ciblée dans chacun des deux fichiers de test, corrigée dans les deux (voir TODO-002 en section 5 et `tests/README.md`) — aucun fichier applicatif n'a été touché à aucune de ces étapes. **Sixième déclenchement (21/09/2026)** : confirmé par Charles-Henri — le workflow GitHub Actions est passé 100 % au vert (`test:rules` 12/12, `test:e2e` 9/9). Ce lot est **Terminé** : l'amorce de socle de tests (TODO-002) est en place, exécutée avec succès en CI, et versionnée. Rappel de périmètre (inchangé) : cette amorce ne couvre que 7 des 27 manques d'`AUDIT_TESTS.md` ; les 20 autres restent en backlog non planifié (section 4.2).

### LOT 1 — Confiance du système : formulaires et suppression
**Objectif** : éliminer les échecs silencieux et les créations/suppressions sans garde-fou.
**Problèmes concernés** : TODO-006, TODO-007
**Prérequis** : LOT 0A (règles Firestore pour la partie validation serveur)
**Modifications principales** : utilitaire de validation partagé, gabarit de création/suppression cohérent
**Tests nécessaires** : TEST-017, TEST-010, TEST-025
**Risques** : faible — essentiellement additif
**Statut (21/09/2026)** : Point de prérequis signalé et tranché par Charles-Henri en cours de lot : LOT 0A restait "Préparé — validation finale restante" (comparaison console/déploiement réel non faits) au moment de démarrer ce lot ; décision prise de considérer ce prérequis suffisant (règles versionnées et validées par l'émulateur en LOT 0B) et de poursuivre.

Les trois tests prévus (TEST-017, TEST-010, TEST-025) sont désormais **tous confirmés verts par un passage réel du workflow GitHub Actions** : TEST-017 (4/4) et TEST-025 (3/3) dès le premier passage ; TEST-010 a d'abord échoué sur un bug du test lui-même (sélecteur ambigu, sans rapport avec l'application), corrigé en scopant l'assertion à `.modal-body`, puis confirmé vert par Charles-Henri à la suite de ce correctif (21/09/2026). TODO-007 est en conséquence **Terminé** (voir section 5). TODO-006 est **partiellement terminé** : sa validation côté client est faite, versionnée et confirmée en CI (TEST-017), mais son volet `firestore.rules`/SEC-011 s'est heurté à une contrainte d'architecture des règles (`match` récursif unique, évaluation OR de Firestore — voir section 5) et a été, sur décision explicite de Charles-Henri (21/09/2026), formellement sorti de ce TODO et repris par un nouveau TODO dédié, **TODO-028**, plutôt que traité à l'aveugle dans ce lot.

Pour son propre périmètre — celui qui reste réellement à la charge de ce lot une fois SEC-011 formellement reporté à TODO-028 — LOT 1 a donc atteint l'état qui vaudrait normalement un statut Terminé : ses deux TODO sont, chacun pour ce qui relève effectivement de LOT 1, implémentés, versionnés et validés par un passage CI réel, sans blocage résiduel de leur fait. **Ce lot n'est cependant volontairement pas basculé à Terminé, sur instruction explicite de Charles-Henri (21/09/2026)** — un futur passage à Terminé de LOT 1, s'il est décidé, n'a donc plus pour condition que la validation CI (déjà acquise) et le report de SEC-011 (déjà fait) ; il reste soumis à la confirmation de Charles-Henri lui-même, et non à un travail restant sur TODO-006 ou TODO-007.

### LOT 2 — Parité Tâche/Suivi et actions rapides — **Terminé**
**Objectif** : généraliser les gestes rapides déjà éprouvés sur la Tâche aux situations où ils manquent (date, Suivi), avec un bénéfice mobile en prime.
**Problèmes concernés** : TODO-003, TODO-004
**Prérequis** : aucun
**Modifications principales** : contrôle rapide de date sur carte, boutons de relance Suivi, extension de la notification de retard
**Tests nécessaires** : TEST-023, TEST-005
**Risques** : faible
**Statut (21/09/2026)** : **Terminé.** TODO-003 et TODO-004 sont chacun implémentés, versionnés et validés par un passage réel du workflow GitHub Actions. TODO-004 était vert dès le premier passage (`lot2-followup-quick-actions.spec.js` 2/2, `lot2-followup-reminders.spec.js` 2/2). TODO-003 avait un scénario de TEST-023 en échec sur un bug du test lui-même (course entre le toast de confirmation et l'écriture Firestore, non de l'application — voir TODO-003 ci-dessus et `tests/README.md`) ; corrigé, puis **confirmé vert par Charles-Henri (21/09/2026)** sur les 2 scénarios lors d'un nouveau passage réel. Les deux TODO du lot sont donc Terminé, sans blocage résiduel.

### LOT 3 — Visibilité de l'information déjà calculée — **Terminé**
**Objectif** : afficher ce que le système sait déjà là où l'utilisateur en a besoin.
**Problèmes concernés** : TODO-005, TODO-022 *(ajouté le 21/09/2026 — besoin produit BESOIN-002, voir section 9)*
**Prérequis** : aucun
**Modifications principales** : score de santé en fiche projet/Dashboard, inclusion par défaut des archivés en recherche, carte indicateur « Échéances du jour »
**Tests nécessaires** : TEST-024
**Risques** : faible
**Statut (21/09/2026)** : **Terminé.** Deux points ont été soumis à Charles-Henri avant d'être tranchés, plutôt que décidés à sa place : (1) le volet "inclusion des archivés en recherche" de TODO-005 contredisait une décision produit déjà actée et documentée le 13/09/2026 dans `js/components/search.js` — Charles-Henri a confirmé garder cette décision du 13/09 (recherche non élargie par défaut), donc aucune modification de `search.js` ; (2) TODO-022 indiquait lui-même explicitement avoir besoin d'un cadrage sur le critère "échéance personnelle" vs. "échéance collaborateur" — Charles-Henri a précisé le critère (Suivis `direction: "to_tell"` uniquement), implémenté en conséquence. Les deux TODO du lot sont Terminé : score de santé visible en fiche projet et sur le Dashboard (TODO-005), carte "📅 Échéances du jour" sur le Dashboard (TODO-022). Aucun test automatisé n'était prévu pour ces deux TODO au-delà de TEST-024 (recherche), devenu sans objet puisque la recherche n'a pas changé de comportement. Étendu le 21/09/2026 (retour de Charles-Henri) au badge de santé sur les cartes de l'onglet Projets (Liste/Par catégorie), voir TODO-005 ci-dessus. **Clôture confirmée par Charles-Henri le 21/09/2026** : lot validé, suite de tests toujours au vert.

### LOT 4A — Requêtes ciblées

*LOT 4 scindé en LOT 4A/LOT 4B le 15/09/2026 suite à la revue critique — trois natures de risque différentes (requêtes ponctuelles à faible risque, mutualisation d'abonnements à risque moyen, décision produit gelant TODO-011) ne devaient pas rester dans un seul lot.*

**Objectif** : généraliser des optimisations de lecture déjà éprouvées, en distinguant les changements à faible risque des changements plus structurants.
**Problèmes concernés** : TODO-009A, TODO-009B
**Prérequis** : aucun pour TODO-009A ; LOT 0B recommandé avant TODO-009B
**Modifications principales** : requêtes ciblées ponctuelles (TODO-009A), mutualisation des abonnements temps réel (TODO-009B)
**Tests nécessaires** : TEST-013, TEST-014
**Risques** : faible (TODO-009A) à moyen (TODO-009B, désynchronisation possible si mal exécuté)
**Statut (21/09/2026)** : **Partiellement terminé.** TODO-009B est Terminé : mutualisation des abonnements Firestore généralisée à `tasks`/`projects`/`followUps`, transparente pour les 8 vues appelantes (aucune n'a eu besoin d'être modifiée). TODO-009A est partiellement terminé : les volets `tags.js` (conversion à `listWhere`) et `linkedItems.js#renderLinkedSection` (lecture directe + chargement différé des données auxiliaires) sont faits ; le volet `usageEvents` a été soumis à Charles-Henri (ses deux solutions proposées se sont révélées plus risquées que ce que la roadmap annonçait) et reporté en backlog sous **TODO-033** à sa demande explicite. Une découverte hors périmètre (4 autres appelants du même motif `fetchBundle()`/`resolveRef()`) a été signalée sans être corrigée, journalisée sous **TODO-034**. Voir TODO-009A/TODO-009B en section 5 pour le détail complet. Tests écrits (`tests/unit/lot4a-subscribe-mutualization.spec.js`, `tests/unit/lot4a-tags-listwhere.spec.js`), non exécutés dans l'environnement de réalisation (registre npm bloqué) — à confirmer par un passage réel du workflow GitHub Actions, comme pour tous les lots précédents. **Ce lot ne passe donc pas à Terminé** et n'enchaîne pas automatiquement sur LOT 4B, en attente de la confirmation CI et de la validation de Charles-Henri.

**Incident signalé après livraison (21/09/2026)** : Charles-Henri a remonté deux erreurs au chargement (`SyntaxError` sur un export de `tasks.js`, `Cache.put() encountered a network error`). Diagnostic : `CACHE_NAME` (`sw.js`) n'avait pas été incrémenté depuis le 15/09/2026 alors que LOT 1, LOT 2, LOT 3 et LOT 4A ont chacun modifié des fichiers précachés — la classe de bug que ce même fichier documente pourtant en détail comme devant être évitée systématiquement. Corrigé hors périmètre de ce lot (`sw.js` n'est concerné par aucun TODO de LOT 4A) : `CACHE_NAME` incrémenté, et `js/components/formValidation.js` (LOT 1) ajouté à `APP_SHELL` où il manquait depuis sa création (même classe d'oubli, détectée à cette occasion par comparaison exhaustive). Un fichier mort supplémentaire trouvé au passage (`js/services/storage-local.js`, jamais réellement supprimé malgré un commentaire de `sw.js` affirmant le contraire) a été journalisé sans être corrigé, voir **TODO-035**. Voir le commentaire détaillé directement dans `sw.js` pour l'analyse complète.

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

*Lots 10 à 13 ajoutés le 21/09/2026 — besoins produit exprimés directement par Charles-Henri (BESOIN-001 à BESOIN-005, voir section 9), ne provenant d'aucun des 9 audits sources. Ajoutés au backlog et priorisés à sa demande explicite, mais **non traités dans l'immédiat** : la suite de la roadmap reprend au LOT 1, ces lots restent en attente d'être atteints dans l'ordre ou avancés selon une décision explicite ultérieure.*

### LOT 10 — Corrections d'affichage mode sombre
**Objectif** : rendre à nouveau lisibles les écrans signalés en mode sombre.
**Problèmes concernés** : TODO-023
**Prérequis** : aucun
**Modifications principales** : couleur du texte au traitement Inbox, couleur des champs de date natifs, contraste des toasts
**Tests nécessaires** : Non déterminé — vérification visuelle manuelle en mode sombre
**Risques** : faible

### LOT 11 — Suivi structuré des objectifs et des points de suivi personnes
**Objectif** : donner aux objectifs une structure exploitable (indicateurs de réussite, éléments de suivi) et qualifier dès la création les éléments créés sur une fiche Personne pour alimenter la préparation des points de suivi.
**Problèmes concernés** : TODO-024, TODO-025
**Prérequis** : proposition de conception à soumettre à Charles-Henri et à faire valider avant tout développement (voir TODO-024/TODO-025 — non tranché à ce stade)
**Modifications principales** : modèle de données objectifs enrichi (indicateurs de réussite, éléments de suivi), nouveaux champs de qualification à la création d'un élément Personne
**Tests nécessaires** : Non déterminé, à définir lors du cadrage
**Risques** : moyen — nouveau modèle de données, conception encore à trancher

### LOT 12 — Navigation personnalisable par utilisateur
**Objectif** : permettre à chaque utilisateur de personnaliser sa barre de navigation, de façon cohérente entre web et mobile.
**Problèmes concernés** : TODO-026
**Prérequis** : aucun
**Modifications principales** : préférence utilisateur `navigation.main`, écrans de personnalisation web et mobile, glisser-déposer, restauration de la navigation par défaut
**Tests nécessaires** : Non déterminé — critères d'acceptation déjà fournis (US-026), à traduire en tests lors du cadrage
**Risques** : moyen — touche la navigation centrale de l'app

### LOT 13 — Bureau : post-it libres
**Objectif** : offrir un espace de notes libres sur l'écran d'accueil, convertibles en objets Pilotage.
**Problèmes concernés** : TODO-027
**Prérequis** : aucun
**Modifications principales** : nouveau domaine de données post-it, composant de bureau avec glisser-déposer/redimensionnement, conversions vers les formulaires existants
**Tests nécessaires** : Non déterminé — critères d'acceptation déjà fournis, à traduire en tests lors du cadrage
**Risques** : moyen à élevé — nouveau modèle de données, interactions riches, fréquence d'écriture à calibrer

### LOT 14 — Suivi : traçabilité des actions rapides et confort de saisie des dates

*Ajouté le 21/09/2026 — besoins produit exprimés par Charles-Henri en retour direct sur les livraisons de TODO-003/TODO-004 (LOT 2), voir BESOIN-006/BESOIN-007 en section 9. Ne provient d'aucun des 9 audits sources.*

**Objectif** : compléter les actions rapides livrées en LOT 2 — garder une trace de ce qui a été fait, et étendre le confort de saisie de date de la Tâche au Suivi.
**Problèmes concernés** : TODO-029, TODO-030
**Prérequis** : TODO-004 (pour TODO-029), TODO-003 (pour TODO-030) — tous deux du LOT 2
**Modifications principales** : note automatique horodatée sur relance/règlement rapide d'un Suivi ; contrôle "+1j/+7j/date libre" sur les champs date des fiches Suivi
**Tests nécessaires** : Non déterminé — à traduire en tests lors du cadrage
**Risques** : faible

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

## 9. Besoins produit exprimés par Charles-Henri (21/09/2026, hors audits)

*Section ajoutée le 21/09/2026. Contrairement aux 157 problèmes des sections précédentes (tous issus des 9 audits sources listés en section 0), les besoins ci-dessous viennent directement de Charles-Henri, en dehors de tout audit — d'où la numérotation `BESOIN-XXX`, distincte de `DATA-XXX`/`SEC-XXX`/etc. Ajoutés au backlog et rattachés chacun à un ou plusieurs TODO (section 5) et à un lot (section 6) à sa demande explicite, **sans être traités dans l'immédiat** : la suite de la roadmap reprend au LOT 1, ces besoins restent en attente. BESOIN-001 à 005 datent du 21/09/2026, avant le démarrage des lots ; BESOIN-006 et BESOIN-007, ajoutés le même jour, sont un retour direct de Charles-Henri après la livraison de LOT 2 (TODO-003/TODO-004).*

- **BESOIN-001 — Suivi structuré des objectifs et qualification des éléments Personne**. Deux volets, actuellement non départagés d'un seul chantier : (a) les objectifs (illustrés par deux exemples SMART complets fournis par Charles-Henri) manquent de structure pour décrire chaque indicateur de réussite (cible, mesure, source de preuve, suivi) et pour rattacher des éléments de suivi à un objectif ou à une information ; (b) à la création d'un élément sur une fiche Personne, aucun moyen d'indiquer immédiatement s'il doit remonter en préparation du point de suivi, ni sa nature (suivi perso / à transmettre / attendu). Charles-Henri a explicitement demandé une proposition de conception plutôt qu'une solution imposée (« que proposes-tu pour faire cela ? ») — non tranchée à ce stade. Voir **TODO-024** (volet a) et **TODO-025** (volet b), **LOT 11**.
- **BESOIN-002 — Carte indicateur « Échéances du jour »**. Ajouter sur l'Accueil une carte comptant les éléments dont l'échéance est aujourd'hui, triés par priorité (à faire d'abord, puis suivi/contrôle), en excluant les échéances de contrôle des collaborateurs. Voir **TODO-022**, **LOT 3** (rejoint TODO-005, déjà existant).
- **BESOIN-003 — Régressions d'affichage en mode sombre**. Texte noir illisible dans le traitement d'un item Inbox ; calendriers des champs de date illisibles (noirs) ; toasts à fond blanc et texte blanc. Constaté par Charles-Henri en parcourant les écrans le 21/09/2026. Voir **TODO-023**, **LOT 10**.
- **BESOIN-004 — US-026 : Navigation personnalisable par utilisateur**. Spécification complète fournie par Charles-Henri (priorité **P1** indiquée explicitement par lui) : personnalisation individuelle de la barre de navigation (4 modules + « Plus » fixe), glisser-déposer, web et mobile, synchronisée entre les deux. Voir **TODO-026**, **LOT 12**.
- **BESOIN-005 — Bureau : post-it libres sur l'écran d'accueil**. Spécification complète fournie par Charles-Henri : section « Mon bureau » sur l'Accueil, post-it multiples (texte ou checklist) déplaçables/redimensionnables avec sauvegarde automatique, convertibles en Tâche/Suivi/Ressource/Décision/Information (post-it entier ou ligne de checklist individuelle). Aucune priorité explicite indiquée — P2 proposé. Voir **TODO-027**, **LOT 13**.
- **BESOIN-006 — Note automatique de traçabilité sur relance/règlement rapide d'un Suivi**. Retour de Charles-Henri sur la livraison de TODO-004 (boutons rapides "🔁 Relancer"/"✅ Réglé") : il faudrait qu'une note s'alimente automatiquement sur la fiche du Suivi pour indiquer qu'une relance ou un règlement a été fait, et à quelle date. Aucune priorité explicite indiquée — P2 proposé (amélioration de confort/traçabilité, non bloquante). Voir **TODO-029**, **LOT 14**.
- **BESOIN-007 — Contrôle rapide de date sur les champs date des fiches Suivi**. Retour de Charles-Henri sur la livraison de TODO-003 (contrôle "+1j/+7j/date libre" sur la carte Tâche) : ce serait utile aussi devant les champs date des fiches de Suivi. Aucune priorité explicite indiquée — P2 proposé. Voir **TODO-030**, **LOT 14**.

---

*Fin du document. Aucun fichier applicatif n'a été modifié pour la consolidation initiale du 15/09/2026 ; les besoins ajoutés le 21/09/2026 (section 9) sont au stade « backlog priorisé », eux non plus non traités à ce jour.*
