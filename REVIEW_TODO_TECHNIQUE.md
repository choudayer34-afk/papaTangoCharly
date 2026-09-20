# REVIEW_TODO_TECHNIQUE.md — Revue critique de la roadmap consolidée

Date : 15/09/2026. Lecture seule — aucun code, aucun audit source, aucun contenu de `TODO_TECHNIQUE.md` n'a été modifié. Ce document évalue la roadmap produite (157 problèmes recensés, 10 causes systémiques SYS-001 à SYS-010, 21 actions TODO-001 à TODO-021, 10 lots) avant toute exécution.

Méthode : relecture intégrale de `TODO_TECHNIQUE.md`, des 9 audits sources existants et de `PROJECT_CONTEXT.md` ; vérification de couverture croisée (chaque identifiant source retrouvé ou non dans la roadmap) ; vérification factuelle dans le code pour les deux chantiers les plus structurants (TODO-009, TODO-010).

---

## 1. Vérification des causes systémiques (SYS-001 à SYS-010)

| SYS | Problèmes réellement liés ? | Cause racine démontrée ? | La correction agit-elle sur la cause ? | Faiblesse relevée |
|---|---|---|---|---|
| **SYS-001** — Écritures non ciblées | Oui pour DATA-001/FIREBASE-007/CODE-021. **DATA-002 (« partiellement »)** est un lien faible : DATA-002 porte sur le *choix* tableau embarqué vs collection dédiée, pas sur le *mécanisme* de réécriture — il est déjà rattaché à SYS-009 (vocabulaire/schéma), ce qui en fait un double-comptage plutôt qu'une preuve de lien. | Oui, confirmé par lecture du code : `storage.js#update()` (lignes 126-144) ne connaît que lecture-modification-réécriture complète, aucune primitive `updateDoc`/`arrayUnion`. | Oui. | Retirer DATA-002 de SYS-001 (garder seulement dans SYS-009) pour ne pas laisser croire à deux causes racines différentes pour le même symptôme. |
| **SYS-002** — Primitives de requête sous-utilisées | Oui pour DATA-004/DATA-005/FIREBASE-003. **FIREBASE-004** est correct ici mais est *aussi* listé dans SYS-006 (voir plus bas) — double affectation. | **Partiellement inexacte.** L'énoncé (« chaque nouveau besoin retombe sur `listAll()` plutôt que réutiliser les primitives existantes ») suppose un choix de développeur évitable. Vérification directe du code (`storage.js:170-186`) : `subscribe()` — le mode de lecture *dominant* de l'app (11+ collections domain) — n'a **structurellement aucune variante filtrée** ; `listWhere`/`listRecent` existent mais ne s'appliquent qu'aux lectures ponctuelles, jamais à l'abonnement temps réel. Ce n'est donc pas seulement de la « sous-utilisation », c'est une **limite d'architecture non contournable sans ajouter la primitive**. | Partiellement — corriger `tags.js`/`fetchBundle` (listAll → listWhere) est un simple changement d'appel ; mutualiser les abonnements `tasks`/`projects` sur 6 vues est un changement d'architecture plus profond, non couvert par l'énoncé actuel de la cause. | Reformuler la cause racine de SYS-002 pour distinguer explicitement les deux sous-causes (sous-utilisation vs absence de primitive filtrée en abonnement) — impacte directement TODO-009, voir section 3. |
| **SYS-003** — Sécurité déléguée à des règles non vérifiées | Oui, bien démontré. | Oui, mais **une nuance manque** : `PROJECT_CONTEXT.md` §15 affirme *toujours* que « seule la règle recommandée dans le README est connue ici — pas de moyen de vérifier ce qui est réellement en place ». Or `TODO_TECHNIQUE.md` §2 traite `AUDIT_FIREBASE.md` comme la source « la plus fiable » sur les règles réelles. Les deux documents ne s'accordent pas totalement sur le degré de certitude atteint. | Oui, la correction (versionner `firestore.rules`, corriger la règle) est adaptée quelle que soit l'état réel. | Nuancer SYS-003 : le texte de `AUDIT_FIREBASE.md` reste lui-même une version *fournie par l'utilisateur à un moment donné*, pas une lecture live de la console — ne pas la présenter comme confirmée à 100 %, gardant SEC-003 pleinement valide tant que Charles-Henri n'a pas relu l'onglet Rules. |
| **SYS-004** — Aucune validation de données | USE-UX-002 (champ vide silencieux) et SEC-011 sont bien liés. **USE-UX-008** (catégorie dupliquée) est un lien plus faible : c'est un problème de détection de doublon à la création, pas un problème de « champ obligatoire non validé » au sens strict. | Oui pour le cœur (formulaires/règles). | Oui pour USE-UX-002/SEC-011 ; pour USE-UX-008 la correction proposée (« confirmation avant création silencieuse d'une nouvelle catégorie ») est une fonctionnalité différente (garde-fou de doublon) greffée sur le même chantier plus par commodité que par cause commune. | Faible, à noter mais sans impact pratique (le TODO-006 qui en découle reste correct, juste la justification causale d'USE-UX-008 est tirée par les cheveux). |
| **SYS-005** — Croissance non bornée | DATA-006, DATA-012, FIREBASE-006 : liens solides. **FIREBASE-005** (absence de `cacheSizeBytes` explicite) est un réglage du SDK client, indépendant d'une politique de rétention côté serveur — lien ténu avec « pas de palier froid ». | Oui pour le cœur. | Oui pour DATA-006/012/FIREBASE-006 ; la correction proposée (politique de rétention) n'a aucun effet sur FIREBASE-005 (qui se règle indépendamment, côté configuration `initializeFirestore`). | Retirer FIREBASE-005 de SYS-005 et le traiter comme problème isolé (il l'est déjà listé en section 4 de fait, mais mentionné ici en double). |
| **SYS-006** — Correctifs jamais généralisés | USE-UX-003/005/COMP-UX-019 liés (déjà démontré par le raisonnement bouton rapide ↔ palliatif tactile). **FIREBASE-004 apparaît ici ET dans SYS-002** — mais aucun TODO rattaché à SYS-006 (TODO-003/004) ne le « résout » : seul TODO-009 (rattaché à SYS-002) le fait. | Le principe (« un correctif réussi jamais formalisé ») est réel pour le volet actions rapides. | Oui pour les items UX ; **non pour FIREBASE-004**, qui n'est en réalité traité que par SYS-002/TODO-009. | Retirer FIREBASE-004 de la liste « Problèmes concernés » de SYS-006 — il n'y est mentionné que par contamination thématique (mutualisation d'abonnements), sans qu'aucune correction de SYS-006 n'y touche. |
| **SYS-007** — Formulaires création/suppression incohérents | Lien correct mais **USE-UX-010** (case « Communication ») est un cas très spécifique et déjà tranché isolément par l'utilisateur — sa présence ici comme « preuve » d'une cause architecturale générale est un peu artificielle (le vrai lien est avec le gabarit de création, mais USE-UX-010 seul n'aurait jamais fait émerger cette cause). | Oui, raisonnablement démontré par USE-UX-001/DATA-003. | Oui, TODO-007 couvre bien l'ensemble. | Mineure, sans conséquence pratique. |
| **SYS-008** — Aucun filet de test | Lien évident et bien démontré (`PROJECT_CONTEXT.md` §10/§14). | Oui. | **Non, pas à la hauteur de ce qui est annoncé.** SYS-008 revendique couvrir « l'intégralité des 27 manques » d'`AUDIT_TESTS.md`. Vérification faite : seuls **7** TEST-XXX (001, 002, 006, 018, 020, 021, 027) sont explicitement nommés « résolus » par TODO-002 ; **10** autres (TEST-003, 004, 008, 009, 011, 012, 015, 016, 019, 026) n'apparaissent **nulle part ailleurs** dans tout le document. | C'est la faiblesse la plus importante de toute la section 3 — voir section 3 (revue de TODO-002) et section 4 (problèmes manquants) ci-dessous. Reformuler SYS-008 pour ne revendiquer qu'une **amorce**, pas une couverture totale. |
| **SYS-009** — Vocabulaire/schéma sans référence unique | Lien correct. | Oui. | Oui pour le volet documentation ; **le volet vocabulaire (USE-UX-018) reste bloqué par une décision utilisateur** — la correction systémique ne peut donc pas être totalement appliquée tant que cette décision n'est pas prise (déjà noté en section 7 du document source, cohérent). | Aucune, le document source gère déjà correctement cette réserve. |
| **SYS-010** — Actions destructrices sans garde-fou | **Lien artificiel entre DATA-003 et SEC-002.** Les deux partagent une formulation abstraite commune (« pas d'info, pas de limite ») mais n'ont ni la même cause technique, ni le même chemin de correction : DATA-003 se résout par un calcul d'impact UI avant confirmation (implémenté dans TODO-007, rattaché en réalité à SYS-007) ; SEC-002 se résout par une règle Firestore/documentation (implémenté dans TODO-001, rattaché à SYS-003). **Aucun TODO n'est directement rattaché à « SYS-010 » seul** — le regroupement ne produit donc aucune action propre, il duplique deux corrections déjà pilotées ailleurs. | Faible — le point commun est plus rhétorique que causal. | Non — la « correction systémique » de SYS-010 n'est mise en œuvre par aucun chantier qui n'existerait pas déjà par ailleurs. | Recommandation : supprimer SYS-010 en tant que cause systémique autonome, ou le requalifier comme un simple constat transversal (« deux familles de risques différentes partagent un vocabulaire de gravité similaire ») sans lui attribuer de correction propre — DATA-003 reste sous SYS-007, SEC-002 reste sous SYS-003. |

**Constat global sur les 7 causes systémiques internes déjà identifiées dans `AUDIT_USAGE_EFFICACITE.md` (UX-SYS-001 à 007)** : la section 3 de `TODO_TECHNIQUE.md` affirme qu'elles sont « remplacées, en les englobant » par les 10 nouvelles causes. Ce n'est pas exact pour **UX-SYS-005** (« Décomposition différée après création », dont le seul symptôme cité, USE-UX-011, n'apparaît nulle part ailleurs dans `TODO_TECHNIQUE.md`) — voir section 4.

---

## 2. Vérification des 21 TODO

| TODO | Priorité | Verdict | Raison principale |
|---|---|---|---|
| TODO-001 | P0 | **À AJUSTER** | À séparer de TODO-002 (voir section 3) ; le volet « déploiement réel » dépend d'un accès externe (console Firebase, Charles-Henri) que ni cette session ni aucun développeur seul ne peut lever — seule la préparation (fichier versionné, correction du texte de règle) est réalisable sans lui. |
| TODO-002 | P0 | **À REVOIR** | Le lien avec SYS-008 sur-promet : ne couvre réellement que 7 des 27 manques de tests. Complexité annoncée « L » sous-estime la portée si on y inclut vraiment 2 parcours E2E complets + émulateur. À scinder (voir section 3) et à re-libeller pour ne pas laisser croire que la dette de test est traitée dans son ensemble. |
| TODO-003 | P1 | VALIDÉ | Périmètre clair, un seul fichier, risque faible, dépendances nulles. |
| TODO-004 | P1 | VALIDÉ | Extension logique et bornée d'un mécanisme existant. |
| TODO-005 | P1 | VALIDÉ | Donnée déjà calculée, affichage seul, risque faible. |
| TODO-006 | P1 | VALIDÉ | Dépendance vers TODO-001 (même fichier `firestore.rules`) correctement documentée. |
| TODO-007 | P1 | VALIDÉ | Bien scopé ; le calcul d'impact à la suppression doit rester local (pas de nouvelle requête coûteuse) — déjà noté comme risque dans le document source. |
| TODO-008 | P1 | VALIDÉ | Décision déjà actée par l'utilisateur, vérifiée par grep exhaustif, périmètre minimal. |
| TODO-009 | P1 | **À AJUSTER** | Priorité P1 confirmée par les faits (voir section 3 — portée plus large que ce que le texte laisse penser), mais l'énoncé sous-estime la portée réelle et mélange deux chantiers de risque différent — à scinder. |
| TODO-010 | P2 | VALIDÉ | Priorité P2 confirmée : bénéfice qualitatif réel (DATA-001, gravité HAUTE côté audit source) mais aucune preuve chiffrée de coût actuel — ni sur-priorisation ni sous-priorisation injustifiée. |
| TODO-011 | P2 | **BLOQUÉ PAR DÉCISION PRODUIT** | Nécessite un arbitrage (durée de rétention acceptable) avant toute implémentation au-delà de la documentation — le document source le reconnaît déjà partiellement (« Validation : non déterminé tant que la politique n'est pas choisie »). |
| TODO-012 | P1 | **À AJUSTER** | Mélange une documentation technique non bloquée (schéma/migrations) avec un volet vocabulaire bloqué par la même décision utilisateur que TODO-021 — à séparer (voir section 3). |
| TODO-013 | P2 | **À AJUSTER** | Valeur confirmée par l'utilisateur mais modeste (3 issues concernées sur 8, option non par défaut) pour une complexité M — candidat à une réévaluation en P3 plutôt qu'un blocage. |
| TODO-014 | P2 | VALIDÉ | Périmètre clair, risque faible. |
| TODO-015 | P2 | VALIDÉ | Trois sous-améliorations cohérentes sur un seul écran, complexité raisonnable. |
| TODO-016 | P2 | VALIDÉ | Chantier transverse cohérent (composant `modal.js` partagé), bénéficie à toute l'app. |
| TODO-017 | P3 | VALIDÉ | Contenu correct ; seul son rattachement au même lot que TODO-016 pose problème (voir section 3 et section 6). |
| TODO-018 | P3 | VALIDÉ | Backlog cohérent, faible risque. |
| TODO-019 | P3 | **À AJUSTER** | Contient un sous-item bloqué (rappel indépendant, décision produit nécessaire) mélangé à deux sous-items non bloqués (documentation, réversibilité de l'opt-in) — à distinguer explicitement pour ne pas geler l'ensemble. |
| TODO-020 | P3 | VALIDÉ | Cosmétique, risque nul, périmètre clair. |
| TODO-021 | P3 | **BLOQUÉ PAR DÉCISION PRODUIT** | Explicitement reconnu comme tel dans le document source lui-même. |

**Total : 12 VALIDÉ, 6 À AJUSTER, 1 À REVOIR, 2 BLOQUÉ PAR DÉCISION PRODUIT.**

Aucune fusion de TODO n'est recommandée (chaque item reste à une granularité correcte) ; deux scissions sont recommandées (TODO-002, TODO-009) et deux clarifications de périmètre sans scission formelle (TODO-012, TODO-019) — détaillées ci-dessous.

---

## 3. Revue particulière des chantiers signalés

### TODO-001 / TODO-002 — LOT 0 doit être séparé en deux volets indépendants

Les deux chantiers n'ont pas la même nature de risque ni la même dépendance externe :

- **Sécurité Firestore (TODO-001)** dépend d'un accès que seul Charles-Henri possède (console Firebase). Sans lui, seule la préparation (fichier `firestore.rules` versionné avec la règle corrigée, alignement du texte de `adminPanel.js`) est réalisable — le déploiement réel ne l'est pas depuis cet environnement (`PROJECT_CONTEXT.md` §14 : aucun accès réseau au projet réel).
- **Socle de tests (TODO-002)** ne dépend de TODO-001 que pour la sous-partie « tests de règles » (qui ont besoin du contenu final de `firestore.rules`). L'installation de l'émulateur et les 2 scénarios E2E cœur (capture→qualification, création projet→clôture) sont indépendants et peuvent démarrer sans attendre TODO-001.

**Recommandation** : scinder LOT 0 en **LOT 0a — Sécurité Firestore** (TODO-001 seul, bloqué en partie sur l'accès externe) et **LOT 0b — Socle de tests** (TODO-002, démarrable immédiatement pour l'émulateur/E2E, la sous-partie « tests de règles » suivant TODO-001). Les deux **ne doivent pas être présentés comme un bloc indivisible** : figer tout le reste de la roadmap en attendant que Charles-Henri retrouve un accès console serait une dépendance artificielle si le socle de tests peut avancer seul.

De plus, TODO-002 tel que rédigé revendique (via SYS-008) de couvrir la totalité d'`AUDIT_TESTS.md`, alors qu'il ne nomme que 7 des 27 manques. **Recommandation additionnelle** : reformuler TODO-002 comme une **amorce d'outillage** (émulateur + 2 E2E), et créer une mention explicite dans le backlog pour les 20 manques de tests restants (dont 10 ne sont cités nulle part dans le document actuel), plutôt que de laisser croire que SYS-008 « résout » la dette de test dans son ensemble.

### TODO-009 — la portée réelle est plus large que l'énoncé, et mélange deux risques différents

Vérification directe dans le code (`js/services/storage.js`, `js/domain/*.js`) : le fait le plus significatif, absent du libellé actuel du TODO, est que `storage.js#subscribe()` — le mode de lecture *dominant* de l'application (utilisé par au moins 11 collections `domain/*`) — **n'accepte aucun filtre**, contrairement à `listWhere`/`listRecent` qui restent cantonnés aux lectures ponctuelles. Concrètement :
- `tasksApi.subscribe()` est rouvert indépendamment par 6 vues (`dashboard.js`, `kanban.js`, `calendar.js`, `priorisation.js`, `projects.js`, `resources.js`) ; `projectsApi.subscribe()` par 6 vues également ; `followUpsApi.subscribe()` par 4 vues — sans aucune mutualisation, contrairement au mécanisme déjà construit pour `inboxItems`.
- `fetchBundle()` (`linkedItems.js`) recharge 9 collections complètes à **chaque ouverture de n'importe quelle fiche de détail** (au moins 9 points d'appel confirmés), pas seulement dans un cas ponctuel de recherche.
- `tags.js` (`addTag`/`removeTagByName`/`deleteTagEverywhere`) utilise `listAll()` + filtre en mémoire à chaque clic de tag.

Cela confirme que la fréquence d'appel est très élevée (chaque navigation, chaque ouverture de fiche) et que le périmètre est large (11+ collections) — ce qui **justifie le maintien en P1** selon le critère « problèmes très fréquents » de la grille de priorisation, indépendamment de toute mesure de volumétrie (qu'aucune donnée de production ne permet de chiffrer ici, conformément à la consigne de ne rien inventer).

En revanche, le chantier mélange deux niveaux de risque très différents :
1. **Faible risque** : remplacer `listAll()`+filtre par `listWhere()` dans `tags.js`, et cibler `fetchBundle()` sur le document réellement demandé plutôt que 9 collections — changements locaux, pattern déjà éprouvé ailleurs.
2. **Risque plus élevé** : mutualiser les abonnements temps réel `tasks`/`projects`/`followUps` entre 6 vues indépendantes — un changement de gestion d'état plus profond, touchant simultanément Accueil/Pilotage/Calendrier/Priorisation/Projets/Équipe/Ressources, avec un vrai risque de régression sur la synchronisation temps réel si mal exécuté.

**Recommandation** : scinder TODO-009 en **TODO-009a** (requêtes ponctuelles ciblées — S/M, faible risque) et **TODO-009b** (mutualisation des abonnements temps réel — L, risque moyen, à traiter avec le socle de tests de LOT 0b déjà disponible pour vérifier l'absence de régression). Reformuler le « Problème » du TODO pour citer explicitement l'absence structurelle de `subscribe()` filtré plutôt que de le présenter comme une simple sous-utilisation locale.

### TODO-010 — bénéfice qualitatif réel, pas une optimisation prématurée, mais pas mesuré non plus

Vérification dans le code : les mutations concernées (`addNote`, `addChecklistItem`/`toggleChecklistItem`, `addOutlookMeeting`, notes de sous-partie de projet) passent toutes par `storage.js#update()` (lecture-modification-réécriture complète), sur des documents dont les tableaux embarqués (`notesLog`, `checklist`, `parts[].notesLog`) sont confirmés « non bornés » par `AUDIT_DATA.md#DATA-001` (gravité HAUTE). La fréquence est réelle et documentée dans le code lui-même : le commentaire de `tasks.js` reconnaît qu'« une checklist personnelle se coche plusieurs fois par jour », et chaque coche déclenche une écriture complète du document parent — ce n'est donc pas un cas rare.

Cependant, **aucune mesure réelle de taille de document** n'est disponible dans cet environnement (pas d'accès aux données de production) — impossible de confirmer si un document a effectivement approché la limite de 1 Mio ou si le coût réseau est aujourd'hui perceptible ou seulement théorique, conformément à la consigne de ne pas inventer de volumétrie.

**Conclusion** : P2 est le bon niveau — ni une sur-priorisation (le bénéfice n'est pas démontré comme urgent aujourd'hui), ni une sous-priorisation (le risque de croissance est réel, documenté indépendamment par deux sources — le code et l'audit data — et la fréquence de déclenchement est confirmée élevée). Pas de changement recommandé.

### TODO-011 — décision produit confirmée nécessaire

Le TODO lui-même reconnaît déjà (« Validation : non déterminé tant que la politique n'est pas choisie ») qu'aucune implémentation ne peut commencer sans un arbitrage sur la durée de rétention acceptable pour `usageEvents`/`history`/Inbox archivé. Cette revue confirme qu'il s'agit bien d'une décision produit, pas d'un choix technique — voir section 5.

### TODO-012 / TODO-021 — à séparer plus nettement

TODO-012 mélange deux volets de nature différente :
- Une **documentation technique pure** (schéma des collections, doctrine tableau embarqué vs collection dédiée, les trois stratégies de migration) : ne nécessite **aucune** décision utilisateur, peut être menée immédiatement, P1 pleinement justifié.
- Un **volet vocabulaire** (« Information » vs « Idée ») qui dépend entièrement de la réponse à USE-UX-018, toujours en attente. Ce volet duplique en réalité TODO-021, qui existe déjà comme item séparé et porte exactement le même sujet.

**Recommandation** : retirer entièrement le volet vocabulaire de TODO-012 (y compris la mention « USE-UX-018 (une fois tranché) » dans ses « Problèmes résolus »), pour que TODO-012 devienne un chantier de documentation pure, non bloqué. TODO-021 reste seul propriétaire de la décision vocabulaire et de son implémentation.

### TODO-013 — valeur confirmée par l'utilisateur mais modeste

La réponse de l'utilisateur (« volontaire et à préserver mais parfois on veut aller plus loin directement ») valide un besoin réel, mais le périmètre proposé (option non activée par défaut, réservée à 3 issues simples sur 8) reste un gain d'ergonomie limité pour une complexité M. **Recommandation** : envisager une réévaluation en P3 plutôt que P2 — sans obligation, décision de priorisation ordinaire plutôt qu'un problème de fond.

### TODO-016 / TODO-017 — regroupement de lot à corriger (pas les TODO eux-mêmes)

Le contenu de chaque TODO pris isolément est correct. Le problème est leur regroupement dans le même **LOT 8** : l'accessibilité clavier (`modal.js`, piège de focus, `:focus-visible`) et les cibles tactiles mobiles (CSS de dimensionnement) ne partagent ni cause racine, ni fichiers, ni méthode de validation, ni même la même priorité (P2 vs P3) — contraire au principe « éviter les lots mélangeant des sujets sans rapport » énoncé dans la demande de consolidation initiale. Voir section 6.

---

## 4. Problèmes manquants ou mal rattachés

### 4.1 Six identifiants complètement absents de `TODO_TECHNIQUE.md`

| ID | Gravité source | Statut dans `TODO_TECHNIQUE.md` |
|---|---|---|
| **DATA-009** | **HAUTE** | Absent de toute section structurée (§3/§4/§5/§8). Mentionné seulement en §2 (prose), qui affirme à tort qu'il est « traité comme un seul chantier (TODO-009) » — **faux** : le « Problèmes résolus » réel de TODO-009 est DATA-004/DATA-005/FIREBASE-003/FIREBASE-004, un sujet totalement différent (requêtes ciblées, pas export de compte). |
| SEC-006 | MOYENNE | Même remarque — cité en §2 comme rattaché à TODO-009, ce qui est inexact. |
| SEC-008 | MOYENNE | Absent partout. Porte sur le suivi d'activité des collaborateurs sans transparence — sujet déjà évoqué et accepté par Charles-Henri selon le contexte du projet, mais jamais formellement clôturé dans `TODO_TECHNIQUE.md` (ni en §4, ni en §8). |
| SEC-009 | MOYENNE | Même remarque que DATA-009/SEC-006 — absence totale d'en-têtes de sécurité HTTP, jamais repris nulle part. |
| SEC-010 | MOYENNE | Absent partout — duplication de `escapeHtml()` dans ~90 fichiers, jamais mentionné. |
| DATA-008 | MOYENNE | Absent partout — normalisation des statuts Suivi non répercutée en base. |

**Action recommandée** : soit créer un nouveau TODO dédié à DATA-009/SEC-006/SEC-009 (même fonction `exportAllUserData`, sujet cohérent — fidélité de l'export + sécurité associée), soit les acter explicitement en section 4 comme « non rattachés, restent ouverts » plutôt que de laisser une affirmation de couverture erronée en section 2. DATA-008/SEC-008/SEC-010 doivent au minimum apparaître quelque part (section 4 ou 8) pour ne pas disparaître silencieusement de la traçabilité.

### 4.2 Dix identifiants promis « traités individuellement » en section 4 mais sans TODO réel

Section 4 de `TODO_TECHNIQUE.md` annonce que les problèmes isolés « sont traités individuellement dans la roadmap (section 5) ». C'est vrai pour les items USE-UX/COMP-UX de cette même liste, mais **aucun** des IDs suivants n'apparaît dans un « Problèmes résolus » de section 5 : DATA-010, DATA-011, DATA-013, DATA-014, FIREBASE-008, FIREBASE-009, FIREBASE-010, SEC-012, SEC-013, SEC-015. Parmi eux, **DATA-010, DATA-013, FIREBASE-009, SEC-012, SEC-015** ont pourtant une correction concrète et peu coûteuse recommandée dans leur audit source (ex. SEC-012 : préfixer les clés `localStorage` par l'uid, effort S ; SEC-015 : vérifier la restriction de la clé API, effort S) — des correctifs simples qui pourraient facilement rejoindre le backlog (LOT 9) plutôt que de rester non tracés.

### 4.3 Neuf fiches `USE-UX-XXX` (usage/efficacité) sans trace

USE-UX-011, 013, 014, 015, 017 (priorité P2 dans l'audit source) et USE-UX-009, 019, 024, 025 (P3, groupées « divers mineurs ») n'apparaissent nulle part dans `TODO_TECHNIQUE.md`. Aucune règle de tri explicite ne justifie pourquoi certains P2 (USE-UX-008, 016, 018) ont été repris et d'autres (011, 013, 014, 015, 017) non — à corriger a minima en les ajoutant en section 4 comme « non rattachés, restent en backlog » pour que le compte soit exact, plutôt que de laisser un écart silencieux entre les 27 fiches sources et les 15 réellement tracées.

### 4.4 Couverture d'`AUDIT_TESTS.md` très inférieure à ce qu'annonce SYS-008

Sur les 27 manques de tests, seuls 7 sont nommés dans un TODO. Les 20 autres ne sont couverts que par la mention globale de SYS-008 (« l'intégralité des 27 manques »), dont **10** (TEST-003, 004, 008, 009, 011, 012, 015, 016, 019, 026) ne sont cités **nulle part ailleurs**, pas même en « Validation » d'un autre TODO. Déjà traité comme faiblesse de TODO-002/SYS-008 en sections 1 et 3.

### 4.5 Incohérence de statut sur CODE-021

`TODO_TECHNIQUE.md` §0/§1 annoncent 25 problèmes CODE déjà résolus. L'énumération explicite de §8 ne couvre que 24 IDs nommés + les 3 exclusions actées (CODE-006/007/008) = 27 sur 28 — **CODE-021 est absent de cette énumération**. Il réapparaît indirectement dans SYS-001 (« déjà mitigé côté concurrence, racine intacte côté coût ») et comme dépendance de TODO-010, ce qui lui prête un volet « coût » non mentionné dans sa fiche source (`AUDIT_CODE.md` le donne comme entièrement corrigé, patch 0030, sans réserve de coût — le volet coût appartient en réalité à FIREBASE-007/DATA-001). **Recommandation** : ajouter CODE-021 explicitement en section 8 avec une note clarifiant que seul le risque de concurrence est clos, le volet coût restant porté par FIREBASE-007/DATA-001 (déjà dans TODO-010).

### 4.6 Dépendance implicite non documentée

L'introduction de l'émulateur Firebase et d'un outillage E2E (TODO-002) suppose l'apparition d'un `package.json`/d'une chaîne Node dans le dépôt. Ceci n'est signalé nulle part comme un changement d'architecture alors que `PROJECT_CONTEXT.md` §2 documente explicitement l'absence de `package.json`/bundler comme un **principe assumé et cohérent avec deux projets sœurs** (EnVie, eProtec). Voir section 5 — décision produit.

### 4.7 Risque de régression sous-évalué

Le risque de TODO-009 (mutualisation des abonnements temps réel sur 6 vues) est actuellement noté « faible — généralisation d'un pattern déjà en production pour `inboxItems` » ; l'investigation de cette revue montre que la portée réelle (6 vues indépendantes pour `tasks`, 6 pour `projects`, 4 pour `followUps`) est nettement plus large que le seul cas `inboxItems`, avec un vrai risque de désynchronisation ou de callback dupliqué si la mutualisation est mal exécutée. **Recommandation** : relever ce risque à « moyen » pour le volet mutualisation (TODO-009b, voir section 3), et le placer après LOT 0b (socle de tests) pour bénéficier d'un filet de non-régression.

---

## 5. DÉCISIONS PRODUIT À PRENDRE

### Décision 1 — Vocabulaire Inbox « Information » vs « Idée »
- **Question** : les deux libellés portent-ils une nuance réelle pour l'utilisateur, ou désignent-ils le même statut et devraient-ils fusionner ?
- **Pourquoi nécessaire** : bloque toute implémentation de TODO-021 et le volet vocabulaire de TODO-012 ; déjà posée dans `AUDIT_USAGE_EFFICACITE.md` §28 sans réponse tranchée.
- **TODO concernés** : TODO-021, TODO-012 (volet vocabulaire).
- **Options possibles** : (a) fusionner les deux libellés en un seul ; (b) les garder distincts et aligner le code (qui n'utilise aujourd'hui qu'un seul statut technique `"Kept"`) sur cette nuance ; (c) statu quo documenté (nuance assumée mais non modélisée).
- **Recommandation** : aucune — question posée à l'utilisateur, non tranchée par cette revue.
- **Conséquence de chaque option** : (a) simplification du code et de l'UI, perte d'une distinction si elle a un sens pour l'utilisateur ; (b) évolution du modèle de données (nouveau champ ou nouvelle valeur d'énumération) ; (c) aucun changement, mais la question reste ouverte indéfiniment.

### Décision 2 — Rappel indépendant d'une échéance
- **Question** : existe-t-il un besoin réel d'un rappel qui ne soit pas rattaché à une échéance de Tâche/Suivi ?
- **Pourquoi nécessaire** : TODO-019 ne peut concevoir cette fonctionnalité sans confirmation préalable du besoin (déjà noté comme non confirmé dans `AUDIT_UX.md`, COMP-UX-011).
- **TODO concernés** : TODO-019.
- **Options possibles** : (a) construire un rappel autonome (nouvelle notion de données) ; (b) considérer que les mécanismes existants (Tâche sans projet, note personnelle) suffisent déjà ; (c) reporter la décision sans trancher.
- **Recommandation** : aucune.
- **Conséquence de chaque option** : (a) nouvelle entité/notion à maintenir ; (b) aucun développement, TODO-019 se limite à la documentation/réversibilité de l'opt-in ; (c) TODO-019 reste bloqué sur ce point tant qu'aucune réponse n'arrive.

### Décision 3 — Politique de rétention des données d'usage et d'historique
- **Question** : combien de temps conserver `usageEvents`, `history`, et les items Inbox archivés — purge, anonymisation, agrégation, ou statu quo assumé ?
- **Pourquoi nécessaire** : TODO-011 ne peut pas dépasser le stade documentaire sans cet arbitrage ; impacte directement le coût Firestore à long terme.
- **TODO concernés** : TODO-011.
- **Options possibles** : (a) purge automatique après une durée définie ; (b) agrégation périodique avec suppression du détail ; (c) statu quo assumé et documenté (aucune purge, croissance acceptée).
- **Recommandation** : aucune.
- **Conséquence de chaque option** : (a)/(b) développement supplémentaire, perte de détail historique après la purge/agrégation (à mettre en balance avec l'objectif produit « garder une trace ») ; (c) aucun développement, coût croissant non maîtrisé à très long terme.

### Décision 4 — Accès administrateur Firestore large et permanent (SEC-002)
- **Question** : l'accès en lecture/écriture illimité d'un seul email à toutes les données de tous les utilisateurs doit-il rester permanent, être limité dans le temps (activé seulement pendant une opération ponctuelle), ou remplacé par une Cloud Function avec droits Admin SDK ?
- **Pourquoi nécessaire** : c'est un arbitrage sécurité/coût/effort, pas un simple choix technique — l'audit source (`AUDIT_SECURITY.md#SEC-002`) présente déjà ces options sans trancher.
- **TODO concernés** : TODO-001 (dont le texte actuel dit « documenter ou limiter dans le temps l'accès admin large » sans que ce choix soit encore fait).
- **Options possibles** : (a) statu quo documenté (accès permanent, risque accepté) ; (b) palliatif (retirer la règle entre deux usages, effort S) ; (c) changement d'architecture (Cloud Function, effort L, élimine le risque structurellement).
- **Recommandation** : aucune.
- **Conséquence de chaque option** : (a) risque de compromission totale en cas de piratage du compte admin reste entier ; (b) réduit le risque mais demande une discipline manuelle à chaque usage ; (c) élimine le risque mais introduit une brique d'infrastructure absente aujourd'hui du projet (Cloud Functions).

### Décision 5 — Introduction d'un outillage Node/`package.json` pour les tests (TODO-002)
- **Question** : le projet documente explicitement l'absence de `package.json`/bundler comme un principe assumé, cohérent avec deux projets sœurs (EnVie, eProtec) — faut-il faire une exception pour un outillage de test isolé (ex. dossier `tests/` avec son propre `package.json`), et si oui, comment documenter cette exception pour qu'elle ne soit pas perçue comme une dérive de l'architecture ?
- **Pourquoi nécessaire** : ce n'est pas mentionné dans `TODO_TECHNIQUE.md` alors que c'est un changement de principe architectural documenté, pas un simple détail d'implémentation.
- **TODO concernés** : TODO-002.
- **Options possibles** : (a) accepter l'exception, isolée dans un sous-dossier `tests/` non chargé par l'app en production ; (b) refuser tout `package.json`, et se limiter aux harnais Node jetables déjà pratiqués (`/tmp`, non commités) ; (c) étendre le principe « vanilla » aux tests eux-mêmes (tests écrits sans dépendance externe, seulement possible pour une partie du périmètre).
- **Recommandation** : aucune.
- **Conséquence de chaque option** : (a) gain de fiabilité (tests répétables, CI possible), coût d'entretien d'un `node_modules`/dépendances même limité aux tests ; (b) aucune non-régression automatisée réelle possible (contradiction avec l'objectif même de TODO-002) ; (c) portée de test très réduite (pas d'émulateur Firebase ni de Playwright sans outillage Node).

---

## 6. Vérification de la taille des lots

| Lot | Fichiers potentiellement modifiés | Complexité | Risque | Cohérence fonctionnelle | Verdict |
|---|---|---|---|---|---|
| LOT 0 | `firestore.rules` (nouveau) + 3 fichiers JS (TODO-001) ; nouveau dossier `tests/` (TODO-002) | M + L | Externe/bloquant (001) + investissement sans bénéfice immédiat (002) | **Faible** — sécurité et outillage de test n'ont de lien que par leur statut « fondation », pas par leur nature technique | **À découper** — voir section 3 (LOT 0a / LOT 0b) |
| LOT 1 | ~5 fichiers (`kanban.js`, `projects.js`, `resources.js`, `modal.js`, `firestore.rules`) | S/M | Faible | Bonne (formulaires + suppression = confiance système) | Taille correcte |
| LOT 2 | 3 fichiers (`kanban.js`, `app.js`, `people.js`, `followupsOverview.js`) | S/M | Faible | Bonne (parité Tâche/Suivi) | Taille correcte |
| LOT 3 | 4 fichiers | S | Faible | Bonne, mais très petit — fusion possible avec LOT 2 sans casser la cohérence | Taille correcte (fusion optionnelle, non nécessaire) |
| LOT 4 | ~9 fichiers (`tags.js`, `linkedItems.js`, `usageTracking.js`, `accountAdmin.js`, 4 vues, `storage.js`, `tasks.js`, `projects.js`, `followups.js`) | M/L/L hétérogène | **Hétérogène** — de faible (requêtes ponctuelles) à moyen (écritures ciblées, mutualisation d'abonnements) | Thématiquement liée (« coût Firestore ») mais mélange trois natures de risque très différentes, dont une (TODO-011) bloquée par décision produit | **À découper** — séparer en LOT 4a (requêtes ciblées, TODO-009a/b) et LOT 4b (écritures ciblées + rétention, TODO-010/011, ce dernier gelé tant que la Décision 3 n'est pas prise) |
| LOT 5 | 1 fichier (`PROJECT_CONTEXT.md`) | M | Nul | Bonne, une fois le volet vocabulaire retiré (section 3) | Taille correcte |
| LOT 6 | 2 fichiers | S/M | Faible | Bonne (Inbox) | Taille correcte |
| LOT 7 | ~3 fichiers (`linkedItems.js`, `resources.js`, `calendar.js`) | S/M | Faible | **Moyenne** — Ressources et Calendrier n'ont pas de cause commune, seulement une taille P2 comparable | Cohérence faible mais taille modeste — split optionnel, non prioritaire |
| LOT 8 | `modal.js`, `kanban.js`, `projects.js`, `components.css` (TODO-016) + `components.css`, `index.html` (TODO-017) | S/M (016) + S (017) | Faible | **Faible** — accessibilité clavier et cibles tactiles mobiles n'ont ni cause commune, ni méthode de validation commune, ni même priorité identique (P2 vs P3) | **À découper** — TODO-017 mieux placé en LOT 9 (backlog mobile/confort, aux côtés de TODO-018) ; LOT 8 devient un lot resserré « Accessibilité clavier » (TODO-016 seul) |
| LOT 9 | ~8 fichiers réparties sur 4 sujets | Hétérogène mais explicitement backlog | Faible | Acceptable pour un lot backlog explicitement sans urgence (cohérent avec la demande initiale d'« éviter les lots mélangeant des sujets sans rapport », qui s'applique moins strictement à un backlog assumé) | Taille correcte |

**Lots à découper : 3 (LOT 0, LOT 4, LOT 8).** LOT 7 est signalé comme fragile mais n'est pas compté comme « à découper » de façon impérative (taille trop modeste pour que la scission apporte un vrai bénéfice).

---

## 7. Ordre global recommandé

L'ordre ci-dessous priorise l'impact utilisateur et les fondations de confiance avant l'optimisation technique, conformément à la consigne de ne pas privilégier automatiquement la facilité technique.

**Fondations obligatoires**
1. TODO-001 — Règles de sécurité Firestore (démarrage immédiat pour la préparation ; déploiement réel dépendant de Charles-Henri)
2. TODO-002 (socle émulateur + tests de règles + 2 E2E cœur) — démarrable en parallèle de TODO-001 pour la partie non liée aux règles

**Corrections à fort impact utilisateur**
3. TODO-006 — Validation de formulaires
4. TODO-007 — Gabarit création/suppression
5. TODO-003 — Actions rapides carte Tâche
6. TODO-004 — Rappels Suivi
7. TODO-005 — Information déjà calculée visible
8. TODO-008 — Lien automatique Inbox
9. TODO-013 — Qualification Inbox en lot (ou reclassé P3, voir section 3)
10. TODO-014 — Cohérence liaison Ressources
11. TODO-015 — Calendrier
12. TODO-016 — Accessibilité clavier

**Optimisations techniques**
13. TODO-009a — Requêtes ciblées ponctuelles (faible risque)
14. TODO-009b — Mutualisation des abonnements temps réel (risque moyen, après le socle de tests)
15. TODO-010 — Écritures ciblées

**Documentation**
16. TODO-012 — Schéma de données et migrations (sans le volet vocabulaire)

**Backlog (dont éléments bloqués par décision produit)**
17. TODO-011 — Politique de rétention (documentation possible dès maintenant ; implémentation bloquée — Décision 3)
18. TODO-017 — Cibles tactiles mobiles
19. TODO-018 — Aperçu Priorisation / pagination
20. TODO-019 — Rappels avancés (partiellement bloqué — Décision 2)
21. TODO-020 — Navigation
22. TODO-021 — Vocabulaire Inbox (bloqué — Décision 1)

---

*Fin du document. Aucun fichier applicatif, aucun audit source et aucun contenu de `TODO_TECHNIQUE.md` n'a été modifié — revue strictement en lecture seule.*
