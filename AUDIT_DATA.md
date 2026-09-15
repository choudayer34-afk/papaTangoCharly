# AUDIT_DATA.md — Pilotage (papaTangoCharly)

Audit du modèle de données, réalisé par inspection directe du code (`js/services/storage.js`, `js/services/id.js`, l'ensemble de `js/domain/*.js`, `js/components/linkedItems.js`, `js/components/notesBlock.js`). Périmètre strict : structure des données, relations, identifiants, historique, archivage, évolutivité, cohérence, migrations, synchronisation avec les fonctionnalités existantes. Ne reprend aucun constat déjà couvert par les audits performance ou usage hors-ligne déjà réalisés — les points ci-dessous portent sur la forme et le cycle de vie des données elles-mêmes, pas sur la vitesse d'affichage ou le comportement réseau. Aucune modification de code effectuée.

_Réalisé le 15/09/2026._

---

## DATA-001

- **Gravité** : HAUTE
- **Fichier(s)** : `js/services/storage.js` (`put`), `js/domain/tasks.js` (`notesLog`, `steps`, `outlookMeetings`), `js/domain/projects.js` (`notesLog`, `parts[].notesLog`), `js/domain/followups.js` (`notesLog`), `js/components/notesBlock.js`
- **Problème** : le journal de notes (`notesLog`), la checklist (`steps`), les réunions Outlook rattachées (`outlookMeetings`) et — plus profondément encore — le journal de notes d'une sous-partie de projet (`parts[].notesLog`, un tableau imbriqué DANS un tableau) sont tous des tableaux embarqués directement sur le document parent, qui ne font que grandir au fil du temps. `storage.put()` n'effectue jamais d'écriture partielle : chaque ajout (une note, une case cochée) réécrit l'objet JavaScript complet puis appelle `setDoc()` sur le document entier — jamais un `updateDoc()` ciblé ni un `arrayUnion()` Firestore.
- **Risque concret** : pour une Tâche ou un Projet suivi sur une longue durée (le cas d'usage central de l'app — "garder une trace"), ces tableaux peuvent croître sans limite prévue. Firestore plafonne un document à 1 Mio : un projet très actif, avec de nombreuses sous-parties elles-mêmes richement commentées, pourrait un jour approcher cette limite et voir ses écritures échouer. Indépendamment de cette limite dure, chaque note ajoutée à une fiche déjà riche en historique retransmet l'intégralité de ce qu'elle contenait déjà avant elle sur le réseau, un coût qui augmente avec l'ancienneté de la fiche plutôt qu'avec la taille de la modification réelle.
- **Correction recommandée** : pour les fiches les plus anciennes/actives (constat à faire dans quelques mois d'usage réel plutôt qu'en préventif), envisager de sortir `notesLog` dans une sous-collection Firestore dédiée (`users/{uid}/tasks/{id}/notes/{noteId}`), comme cela a déjà été fait pour `history` et `links` au niveau applicatif — écritures plus légères, plus de limite de taille de document liée au volume de notes.
- **Effort** : L (changement de schéma + migration des données existantes)
- **Dépendances éventuelles** : DATA-002 (incohérence de stratégie avec `history`/`links`).

## DATA-002

- **Gravité** : MOYENNE
- **Fichier(s)** : `js/domain/history.js`, `js/domain/links.js` (collections séparées) vs. `js/domain/tasks.js`, `js/domain/projects.js`, `js/domain/followups.js` (`notesLog` embarqué)
- **Problème** : deux stratégies différentes coexistent pour ce qui est, conceptuellement, le même besoin — un journal qui s'accumule au fil de la vie d'une entité. `history.js` et `links.js` sont des collections dédiées, avec une justification explicite dans le code ("le StorageAdapter ne garantit aucune transaction multi-documents, donc un tableau à dupliquer serait plus fragile"). `notesLog` (notes libres) suit la logique strictement inverse — tableau embarqué — sans qu'aucun commentaire du code n'explique pourquoi ce même raisonnement ne s'applique pas aussi aux notes.
- **Risque concret** : absence de règle claire pour qu'un futur ajout ("journal de X sur une fiche") suive l'une ou l'autre stratégie — le choix dépendra de qui écrit le code et de quel exemple existant il copie, plutôt que d'une doctrine explicite.
- **Correction recommandée** : documenter (dans `PROJECT_CONTEXT.md` ou en tête de `storage.js`) le critère de choix entre "collection dédiée" et "tableau embarqué" pour toute nouvelle structure de type journal — par exemple : volume attendu, besoin de requêter across-entités (comme `history.js` le permet), ou non.
- **Effort** : S (documentation) — L si le choix aboutit à migrer `notesLog` (voir DATA-001)
- **Dépendances éventuelles** : DATA-001.

## DATA-003

- **Gravité** : MOYENNE
- **Fichier(s)** : `js/domain/projects.js` (`removeProject`), `js/domain/people.js` (`removePerson`)
- **Problème** : supprimer un Projet ou une Personne ne touche à aucune entité qui la référence (`task.projectId`, `followUp.personId`, etc.) — c'est un choix **délibéré et documenté** dans le code lui-même ("les entités liées gardent leur `personId` dans le vide plutôt qu'un effet de bord risqué"), pas un oubli. Deux garde-fous habituels autour d'un tel choix manquent cependant : (1) aucun avertissement n'est montré à l'utilisateur au moment de la suppression pour l'informer du nombre d'entités qui vont se retrouver orphelines ; (2) l'affichage ne semble pas distinguer "ce champ pointait vers quelque chose qui a été supprimé depuis" de "ce champ n'a jamais été renseigné" — les deux cas se résolvent au même `|| null` défensif dans les vues (vérifié dans `js/views/kanban.js`), donc au même affichage "Aucun projet".
- **Risque concret** : un utilisateur qui supprime un Projet contenant encore des tâches actives ne mesure pas l'impact avant de confirmer, et ne peut plus ensuite distinguer une tâche "jamais rattachée à un projet" d'une tâche "dont le projet a disparu" — une perte de contexte silencieuse, contraire à la promesse centrale de l'app ("ne rien perdre").
- **Correction recommandée** : avant suppression, compter et afficher le nombre d'entités qui référencent la fiche visée ("3 tâches sont liées à ce projet, elles resteront mais perdront ce lien") ; envisager de conserver le dernier nom connu de l'entité supprimée sur les fiches orphelines (même principe que le `label` déjà figé dans `links.js`, voir DATA-013) plutôt qu'un simple `null`.
- **Effort** : M
- **Dépendances éventuelles** : DATA-013 (mécanisme de "nom figé" déjà existant ailleurs, réutilisable ici).

## DATA-004

- **Gravité** : HAUTE
- **Fichier(s)** : `js/components/linkedItems.js` (`fetchBundle`), `js/domain/links.js` (`listAll`)
- **Problème** : `fetchBundle()` charge en une fois l'intégralité de **9 collections** (`tasks`, `projects`, `people`, `followUps`, `resources`, `meetings`, `decisions`, `keptItems`, `objectives`) via `listAll()` sur chacune, et `linksApi.listAll()` charge l'intégralité de la collection `links` en plus — à chaque fois qu'une fiche affiche sa section "🔗 Lié" **et** à chaque fois que "🔁 Changer de type" rouvre la fiche convertie (le correctif livré dans cette même conversation, patch 0049, s'appuie directement sur `fetchBundle()`/`resolveRef()`).
- **Risque concret** : le coût de ces deux fonctions grandit avec le volume TOTAL de données de l'utilisateur, pas avec la taille de ce qu'il faut réellement résoudre (une seule référence `{type, id}`). Comme le volume de données grandit précisément parce que l'app encourage un usage au long cours (c'est tout son objet), une fonctionnalité aussi fréquemment déclenchée qu'ouvrir la section "liée" d'une fiche verra son coût augmenter silencieusement avec l'ancienneté du compte, sans qu'aucun signal n'alerte qu'un palier a été franchi.
- **Correction recommandée** : `resolveRef({type, id})` n'a besoin que d'UN document précis — remplacer la résolution "charger tout, puis chercher dedans" par une lecture directe (`storage.get(collection, id)`) selon le type demandé, sans passer par `fetchBundle()` pour ce cas d'usage précis (la section "🔗 Lié" qui affiche PLUSIEURS liens simultanément a un besoin différent, où charger un bundle reste défendable).
- **Effort** : M
- **Dépendances éventuelles** : impacte directement le correctif "🔁 Changer de type" livré dans cette conversation (patch 0049) et la section "🔗 Lié" de `linkedItems.js`.

## DATA-005

- **Gravité** : MOYENNE
- **Fichier(s)** : `js/domain/tags.js` (`addTag`, `removeTagByName`, et une troisième fonction), `js/services/storage.js` (`listWhere`)
- **Problème** : le schéma de `tags` (`{entityType, entityId, tag}`) est un candidat idéal pour `storage.listWhere()` — la fonction d'égalité pure déjà construite précisément pour ce genre de filtrage (utilisée ailleurs pour `history.js`). Pourtant, `tags.js` ne l'utilise jamais : trois fonctions différentes chargent l'intégralité de la collection `tags` via `listAll()` puis filtrent en mémoire sur `entityType`/`entityId`.
- **Risque concret** : chaque ajout ou retrait de tag, sur n'importe laquelle des 9 fiches liables, transfère l'intégralité des tags de l'utilisateur au lieu des seuls tags de la fiche concernée — un outil déjà construit et déjà éprouvé (`listWhere`) n'est pas réutilisé là où son propre cas d'usage de conception s'applique directement.
- **Correction recommandée** : remplacer `storage.listAll(COLLECTION)` par `storage.listWhere(COLLECTION, [["entityType", type], ["entityId", id]])` dans `addTag`/`removeTagByName` (et toute autre fonction de `tags.js` qui cherche les tags d'UNE fiche précise) ; conserver `listAll()` uniquement là où le besoin est réellement transversal (ex. `visibleTagNames`, qui a besoin de connaître tous les tags existants pour l'autocomplétion).
- **Effort** : S
- **Dépendances éventuelles** : aucune — `listWhere` existe déjà et est déjà éprouvé ailleurs.

## DATA-006

- **Gravité** : HAUTE
- **Fichier(s)** : `js/domain/inbox.js` (`autoArchiveStaleKept`, `qualify`), collection `inboxItems`
- **Problème** : "archiver" un élément de l'Inbox ne fait que changer son champ `status` à `"archived"` — il reste dans la même collection `inboxItems`, incluse dans le même abonnement temps réel partagé que tout le reste de l'Inbox. Il n'existe aucune notion de palier "froid" (collection séparée, export puis suppression, pagination) dans le schéma : chaque élément jamais capturé, qu'il soit encore actif ou archivé depuis des mois, fait partie du même flux de données synchronisé en continu.
- **Risque concret** : la collection `inboxItems` ne peut que croître, indéfiniment, sans jamais se stabiliser — contrairement à `tasks`/`followUps`/etc. où un statut "terminé" au moins referme un cycle métier identifiable. Après plusieurs années d'usage réel (le scénario que ce projet vise explicitement — "il y a trois mois, on avait décidé quoi sur ce sujet ?"), le volume total synchronisé en temps réel dès l'ouverture de l'app peut devenir significatif, sans qu'aucun mécanisme du schéma actuel n'y réponde.
- **Correction recommandée** : envisager, à plus long terme, un déplacement effectif des éléments archivés depuis longtemps (ex. > 1 an) vers une collection froide non abonnée en temps réel, consultable seulement à la demande (recherche globale, historique) — à ne traiter qu'une fois qu'un volume réel commence à se faire sentir, pas en préventif immédiat.
- **Effort** : L
- **Dépendances éventuelles** : aucune.

## DATA-007

- **Gravité** : MOYENNE
- **Fichier(s)** : `js/domain/preferences.js` (`dashboardHiddenMigratedV19`, `postitMigratedV1`, `tagsMigratedV1`, `personalObjectivesMigratedV1`), `js/domain/tags.js` (`migrateInboxTags`), `js/domain/followups.js` (`normalizeStatus`, `LEGACY_STATUS_MAP`)
- **Problème** : trois stratégies d'évolution de schéma différentes coexistent dans le code, sans qu'aucune ne soit nommée ni documentée comme convention du projet (absente de `PROJECT_CONTEXT.md`) : (1) valeur par défaut à la lecture pour un champ optionnel absent (`data.champ || valeur`, la plus répandue) ; (2) migration ponctuelle exécutée une fois, protégée par un drapeau booléen sur le document `preferences` (4 exemples trouvés à ce jour) ; (3) normalisation appliquée à CHAQUE lecture, sans jamais réécrire le document d'origine (`followups.js#normalize`, qui traduit les anciens statuts `todo`/`in_progress`/`follow_up` vers le vocabulaire actuel `waiting`/`relaunched`/`done`).
- **Risque concret** : un futur contributeur doit déduire laquelle des trois stratégies utiliser par analogie avec un exemple existant, sans repère explicite sur quand préférer l'une à l'autre (typiquement : (1) pour un champ optionnel simple, (2) pour une transformation coûteuse ou ponctuelle, (3) pour une traduction de vocabulaire bon marché à recalculer). Voir aussi DATA-008 pour une conséquence concrète de la stratégie (3).
- **Correction recommandée** : documenter les trois stratégies et leur cas d'usage respectif dans `PROJECT_CONTEXT.md` (nouvelle section "Évolution du schéma des données").
- **Effort** : S
- **Dépendances éventuelles** : DATA-008, DATA-009.

## DATA-008

- **Gravité** : MOYENNE
- **Fichier(s)** : `js/domain/followups.js` (`normalize`, appelé depuis `subscribe`)
- **Problème** : la normalisation des anciens statuts de Suivi (`LEGACY_STATUS_MAP`) n'est appliquée qu'à la lecture, en mémoire, et **jamais réécrite** dans Firestore. Les documents concernés conservent donc indéfiniment leur ancienne valeur brute (`"todo"`, `"in_progress"`, `"follow_up"`) — seule la fonction `subscribe()` de `followups.js` corrige l'affichage au vol.
- **Risque concret** : tout code qui lirait ces documents SANS passer par `followupsApi.subscribe()` verrait la valeur brute non normalisée. C'est précisément ce qui se produit dans `exportAllUserData()` (`js/services/firebase.js`, voir DATA-009) — la sauvegarde JSON générée avant suppression d'un compte contient donc potentiellement des valeurs de statut obsolètes, différentes de ce que l'app elle-même affiche.
- **Correction recommandée** : soit réécrire silencieusement le document normalisé la première fois qu'il est lu (migration progressive "au fil de l'eau"), soit s'assurer qu'AUCUNE lecture de `followUps` dans l'app (export compris) ne contourne `normalizeStatus()`.
- **Effort** : S (appliquer `normalizeStatus` à l'export) / M (migration au fil de l'eau, plus robuste)
- **Dépendances éventuelles** : DATA-009 (même angle mort, symptôme plus large).

## DATA-009

- **Gravité** : HAUTE
- **Fichier(s)** : `js/services/firebase.js` (`exportAllUserData`)
- **Problème** : la fonction d'export complet d'un compte (utilisée pour la sauvegarde JSON proposée avant toute suppression, voir `accountAdmin.js`) lit directement chaque collection via `getDocs(...).map(d => d.data())` — un accès Firestore **brut**, qui ne passe par AUCUNE fonction de `js/domain/*.js`. Or c'est précisément dans ces fichiers `domain/` que vivent les normalisations, valeurs par défaut et corrections de compatibilité (voir DATA-007, DATA-008).
- **Risque concret** : la sauvegarde JSON générée avant une suppression de compte — présentée comme une garantie ("jamais de perte silencieuse" avant une action irréversible) — peut donc différer de ce que l'app affiche réellement pour les mêmes données : statuts de Suivi non normalisés (DATA-008), et plus généralement tout champ dont la valeur affichée dépend d'une logique vivant dans `domain/` plutôt que dans le document brut lui-même. La sauvegarde reste complète en termes de VOLUME de données (aucune perte), mais potentiellement incohérente en termes de FORME par rapport à l'expérience applicative.
- **Correction recommandée** : faire passer `exportAllUserData()` par les fonctions `listAll()`/normalisation de chaque module `domain/*.js` plutôt que par un accès Firestore direct — au prix de dépendre de 14 imports supplémentaires plutôt qu'une boucle générique sur `USER_DATA_COLLECTIONS`, mais avec une fidélité garantie entre export et affichage.
- **Effort** : M
- **Dépendances éventuelles** : DATA-008 ; recoupe aussi SEC-006/SEC-009 de l'audit sécurité (même fonction, angle différent : ici la fidélité des données exportées, pas leur protection d'accès).

## DATA-010

- **Gravité** : FAIBLE
- **Fichier(s)** : `js/domain/tags.js` (`migrateInboxTags`), `js/app.js`
- **Problème** : une migration ponctuelle qui échoue systématiquement (erreur réseau persistante, règle Firestore refusée) ne pose jamais son drapeau (`markTagsMigratedV1()` n'est appelé qu'en cas de succès, `.catch(() => {})` avale l'erreur) — elle est donc retentée à **chaque** chargement de l'app, indéfiniment, sans qu'aucun signal ne remonte à l'utilisateur ni à l'administrateur qu'une migration reste bloquée.
- **Risque concret** : consommation de lectures/écritures Firestore répétée sans fin dans un scénario d'échec persistant ; aucune visibilité pour diagnostiquer un tel blocage si jamais il se produisait (à ce jour, rien n'indique que ce soit le cas en pratique).
- **Correction recommandée** : limiter le nombre de tentatives (ex. un compteur d'échecs sur le document `preferences`) et journaliser un signal (toast discret ou entrée d'historique) au-delà d'un certain nombre d'échecs consécutifs, plutôt qu'une réexécution silencieuse illimitée.
- **Effort** : S
- **Dépendances éventuelles** : aucune ; le même schéma s'appliquerait à toute future migration one-shot.

## DATA-011

- **Gravité** : FAIBLE
- **Fichier(s)** : `js/domain/tasks.js` (`STATUS_INFO_HTML`), `js/domain/followups.js` (statuts)
- **Problème** : le statut "en attente" existe à la fois sur une Tâche et sur un Suivi, partage la même icône (⏳), mais désigne deux choses différentes (bloqué par un tiers pour une Tâche ; en attente d'une action côté Suivi). La désambiguïsation repose uniquement sur un texte d'aide contextuel (`STATUS_INFO_HTML`) affiché dans l'interface — rien dans le modèle de données lui-même (nom de champ, espace de valeurs) ne distingue les deux usages.
- **Risque concret** : faible et déjà atténué par l'aide contextuelle existante ; mentionné ici parce que c'est un exemple concret de vocabulaire partagé entre deux entités distinctes sans namespace ni préfixe dans le modèle de données, à surveiller si un troisième statut du même genre venait à être introduit sans la même vigilance.
- **Correction recommandée** : aucune action urgente — le risque est déjà correctement mitigé côté UI. À garder en tête pour tout futur statut partagé entre plusieurs types d'entités.
- **Effort** : Non déterminé
- **Dépendances éventuelles** : aucune.

## DATA-012

- **Gravité** : MOYENNE
- **Fichier(s)** : `js/domain/history.js`, collection `history`
- **Problème** : le journal d'audit (`history`) n'a aucune politique de rétention ou d'expiration — chaque action jamais journalisée, pour chaque entité, depuis la création du compte, reste indéfiniment dans une seule collection plate, sans résumé ni agrégation pour les entrées anciennes. Distinct des correctifs déjà livrés dans l'audit performance (qui ont borné ce qui est CHARGÉ à l'affichage via `listRecent`/`listForEntity`) : le sujet ici est la collection elle-même, dont le volume total ne diminue ni ne se stabilise jamais.
- **Risque concret** : croissance illimitée à très long terme (des années d'usage) — sans conséquence fonctionnelle immédiate grâce aux correctifs déjà en place pour borner les LECTURES, mais un coût de stockage Firestore qui continue d'augmenter indéfiniment sans jamais être questionné par le modèle de données lui-même.
- **Correction recommandée** : aucune action nécessaire à court terme ; envisager, à très long terme, une politique d'archivage ou de résumé des entrées d'historique de plus de N années si le volume devient un jour un sujet réel (coût Firestore, pas performance d'affichage — déjà traité).
- **Effort** : L (si un jour nécessaire)
- **Dépendances éventuelles** : aucune à court terme.

## DATA-013

- **Gravité** : FAIBLE
- **Fichier(s)** : `js/domain/links.js` (`createLink`)
- **Problème** : chaque lien stocke un `label` (titre de l'entité liée) figé au moment de la création du lien, explicitement pour rester lisible même si l'entité liée est ensuite renommée ou supprimée. Ce `label` n'est en revanche jamais rafraîchi si l'entité liée est renommée MAIS continue d'exister — non vérifié dans cet audit si l'affichage réel des liens dans `linkedItems.js` utilise ce `label` figé ou va rechercher le titre actuel de l'entité vivante (les deux comportements coexistent dans le code selon le chemin emprunté).
- **Risque concret** : si l'affichage utilise le `label` figé même pour une entité toujours existante, un lien affiché peut montrer un titre périmé après un renommage — incohérence mineure entre ce qui est affiché comme lien et le titre réel actuel de la fiche visée.
- **Correction recommandée** : Non déterminé sans vérification supplémentaire du chemin d'affichage exact dans `linkedItems.js` — à confirmer avant toute action ; si confirmé, préférer toujours le titre live quand l'entité existe encore, et ne retomber sur le `label` figé que si l'entité a été supprimée (cas pour lequel il a été conçu).
- **Effort** : S (une fois le comportement réel confirmé)
- **Dépendances éventuelles** : aucune.

## DATA-014

- **Gravité** : FAIBLE
- **Fichier(s)** : `js/services/id.js`
- **Problème** : `generateId()` utilise `crypto.randomUUID()` quand disponible, avec un repli `Date.now().toString(36) + Math.random().toString(36)` pour les navigateurs plus anciens — une résistance aux collisions nettement plus faible qu'un UUID v4 réel.
- **Risque concret** : très faible en pratique (`crypto.randomUUID` est disponible dans tous les navigateurs modernes actuellement utilisés) ; le schéma d'identifiants n'est cependant pas uniformément robuste si ce repli venait un jour à être réellement emprunté.
- **Correction recommandée** : aucune action urgente ; à surveiller uniquement si l'app doit un jour supporter un navigateur ancien dépourvu de `crypto.randomUUID`.
- **Effort** : Non déterminé
- **Dépendances éventuelles** : aucune.

## DATA-015

- **Gravité** : FAIBLE
- **Fichier(s)** : ensemble de `js/domain/*.js` (absence de documentation centralisée)
- **Problème** : aucune documentation centralisée ne décrit la forme complète de chaque collection (champs, types, optionalité) — le schéma de chaque entité doit être reconstitué en lisant les fonctions `createXxx()`/`normalize()` de chaque fichier `domain/`, cohérent avec le choix assumé du projet de n'avoir ni TypeScript ni schéma de validation (voir `PROJECT_CONTEXT.md` §10).
- **Risque concret** : coût croissant avec le nombre de collections (20 fichiers `domain/` à ce jour) — un changement touchant plusieurs entités (comme l'unification récente du vocabulaire de dates, ou l'ajout de `keptAt`) nécessite de relire chaque fichier concerné faute d'un point de référence unique.
- **Correction recommandée** : envisager, à titre de documentation seule (pas de validation à l'exécution, cohérent avec le choix "aucun build"), un tableau récapitulatif par collection dans `PROJECT_CONTEXT.md` (nom du champ, type attendu, optionnel ou non, depuis quelle vague) — mis à jour à la marge à chaque nouveau champ plutôt que reconstruit à chaque fois par lecture du code.
- **Effort** : M (rédaction initiale) puis S (maintenance incrémentale)
- **Dépendances éventuelles** : aucune.

---

## Synthèse — répartition par gravité

- **HAUTE** : DATA-001, DATA-004, DATA-006, DATA-009
- **MOYENNE** : DATA-002, DATA-003, DATA-005, DATA-007, DATA-008, DATA-012
- **FAIBLE** : DATA-010, DATA-011, DATA-013, DATA-014, DATA-015

Trois fils conducteurs traversent plusieurs constats de cet audit : (1) la croissance non bornée de plusieurs structures (tableaux embarqués — DATA-001 ; collection `inboxItems` — DATA-006 ; collection `history` — DATA-012) sans qu'aucune n'ait de palier "froid" prévu dans le schéma actuel ; (2) le sous-emploi des outils de requête déjà construits et éprouvés par l'audit performance (`listWhere`, `storage.get`) dans des endroits qui en bénéficieraient directement (DATA-004, DATA-005) ; (3) l'absence d'un point de référence unique pour l'évolution du schéma (DATA-007) et pour sa forme actuelle (DATA-015), qui rend chaque nouvelle vague plus coûteuse à raisonner correctement que la précédente.
