# PROJECT_CONTEXT.md — Pilotage (papaTangoCharly)

Document d'orientation technique, à lire avant toute intervention sur ce dépôt. Objectif : donner à une future session (Claude ou humaine) une vue d'ensemble fiable sans avoir à rescanner toute l'application. Ne remplace pas la lecture du code pour un changement précis — c'est une carte, pas le territoire.

Ce fichier documente l'état du dépôt tel que connu à la date ci-dessous ; il ne se met pas à jour tout seul. Sur un changement structurant (nouvelle techno, changement d'authentification, nouveau module `domain/`, changement de stratégie offline), penser à le corriger.

_Dernière mise à jour : 21/09/2026 (ajout des §16/§17, LOT 5/TODO-012 — voir ces sections)._

## 1. Ce que c'est

Assistant personnel de pilotage professionnel pour Charles-Henri (Smag) : capturer une information, la qualifier (tâche / suivi / information à garder / décision...), la planifier, la suivre jusqu'à clôture, et en garder la trace pour pouvoir la retrouver des mois plus tard. Voir le projet Claude « Pilotage » pour le cahier des charges complet (le besoin central : « le système doit aider à être rigoureux, pas exiger de l'être naturellement »).

## 2. Technologies

- **PWA JavaScript vanilla, ES modules natifs — aucun framework, aucun bundler, aucun `package.json`.** Cohérent avec deux projets sœurs (EnVie, eProtec) qui suivent le même parti pris.
- **Firebase** comme unique backend : Firebase Auth (Google + email/mot de passe) et Firestore (`initializeFirestore` avec `persistentLocalCache` + `persistentMultipleTabManager`, donc offline-first et multi-onglets par construction). SDK chargé directement depuis `https://www.gstatic.com/firebasejs/10.12.2/...` (pas de node_modules).
- **Service Worker** (`sw.js`) pour l'installation PWA et le fonctionnement hors-ligne.
- **Hébergement : Cloudflare Pages** (fichier `_headers` à la racine, reconnu nativement par Cloudflare, pas de config dans un dashboard).
- Pas de TypeScript, pas de CSS framework (deux feuilles maison : `styles/tokens.css` pour les variables de design, `styles/components.css` pour tout le reste).

## 3. Points d'entrée

- `index.html` — unique page HTML de l'app. Charge `styles/tokens.css` et `styles/components.css`, un petit script synchrone inline qui applique le thème sombre/clair AVANT le premier rendu (pour éviter un flash), puis `js/app.js` en `type="module"`.
- `js/app.js` — point d'entrée JS. Routeur minimal par hash (pas de framework), attend l'état d'authentification Firebase avant d'afficher quoi que ce soit. Table `ROUTES` = dispatch complet hash → fonction `render*` de `js/views/`. Table `NAV_ITEMS` distincte (barre de navigation du bas) : une route peut exister sans apparaître dans la nav.
- `sw.js` — Service Worker, enregistré depuis `app.js`. Précache la liste `APP_SHELL` (~90 fichiers) et sert en cache-first pour le contenu applicatif.
- `manifest.json` — manifeste PWA standard (icônes, couleurs, `display: standalone`).

## 4. Architecture des dossiers

```
/
├── index.html, manifest.json, sw.js, _headers, README.md
├── icons/                  # icônes PWA (192, 512, maskable)
├── styles/
│   ├── tokens.css          # variables de design (couleurs, espacement, typographie)
│   └── components.css      # tous les styles de composants/écrans
└── js/
    ├── app.js              # point d'entrée + routeur
    ├── services/           # infra transverse (Firebase, stockage générique, utilitaires)
    ├── domain/             # logique métier par entité (une API par type de donnée)
    ├── components/         # UI réutilisable inter-écrans (modale, toast, recherche...)
    └── views/              # un fichier par écran/onglet principal, orchestre domain+components
```

Convention de dépendance implicite (non imposée par un linter, juste respectée dans le code) : `views` dépend de `domain` et `components` ; `domain` dépend de `services` ; `components` dépend de `services` et parfois d'autres `components` (voir §11, imports circulaires). `services` ne dépend de rien d'autre dans `js/`.

### `js/services/` (infrastructure)

`firebase.js` (init Auth/Firestore + config, **seul fichier à connaître la config Firebase**), `storage.js` (couche générique Firestore — CRUD, `subscribe`, `listWhere`, `listRecent`, file d'attente `update()`, voir §6), `storage-local.js` (implémentation alternative 100 % IndexedDB, même interface que `storage.js`, **gardée en référence, non chargée par l'app** — retirée du précache SW), `onlineStatus.js` (wrapper `navigator.onLine` + événements `online`/`offline`), `dateUtils.js` (source unique de calcul « combien de jours avant/après une date », fuseau-horaire-safe), `accountAdmin.js`, `deeplink.js`, `draftStore.js`, `id.js`, `pilotageViewStore.js`, `pomodoroStore.js`, `preferences.js` *(sous `domain/`, pas ici — attention au doublon de nom)*, `shortcuts.js` (raccourcis clavier globaux), `themeStore.js` (thème sombre/clair, clé localStorage `pilotage-theme`), `usageTracking.js` (stats d'usage admin).

### `js/domain/` (une API par entité métier)

`tasks.js`, `projects.js`, `people.js`, `followups.js` (suivis de collaborateurs), `resources.js`, `meetings.js`, `decisions.js`, `objectives.js`, `prompts.js`, `templates.js`, `casquettes.js`, `inbox.js` (capture brute + qualification), `history.js` (journal d'audit, voir §12), `links.js`, `tags.js`, `preferences.js`, `convert.js` (changement de type d'une entité vers une autre), `priorisation.js`, `workload.js`, `projectHealth.js`. Chaque fichier expose typiquement `subscribe()`, `create()`, `update()`/mutateurs spécifiques, parfois `listWhere`/`listForEntity`.

### `js/components/` (UI transverse)

27 fichiers. Les plus structurants : `modal.js` (système de modales générique, pattern `closesModal: false` pour une action asynchrone qui ne doit fermer qu'à la fin, voir §14), `linkedItems.js` (`fetchBundle()`/`resolveRef()` — mécanisme canonique pour résoudre `{type, id}` en fiche ouvrable, réutilisé partout où on navigue vers une entité liée), `changeType.js`, `search.js` (recherche globale), `adminPanel.js`, `toast.js`, `checklist.js`, `notesBlock.js`, `historyTimeline.js`.

### `js/views/` (un écran = un fichier)

`dashboard.js` (accueil), `inbox.js`, `kanban.js` (Pilotage — Tâches/Projets/Calendrier/Priorisation en sous-onglets, voir `pilotageSubNav.js`), `projects.js`, `people.js` (fusionné avec l'ancien `management.js` le 02/09/2026 — le fichier `management.js` existe encore mais n'est qu'un sous-composant), `calendar.js`, `priorisation.js`, `resources.js`, `prompts.js`, `more.js`, `guide.js`, `whatsnew.js`, `memory.js`, `login.js`, `prepMask.js`, `followupsOverview.js`, `workload.js`, `projectHealth.js`.

## 5. Gestion de l'état

Pas de store centralisé (pas de Redux/Zustand/etc.). Plusieurs mécanismes coexistent, chacun scoped à son besoin :

- **Firestore + `onSnapshot`** est la source de vérité principale pour toute donnée métier : les vues s'abonnent via `domain/*.js#subscribe()`, qui délègue à `storage.js`. Certaines vues chaudes (Inbox) mutualisent leurs abonnements pour éviter les doublons (voir §7).
- **Petits stores dédiés en `localStorage`**, un par préoccupation : `themeStore.js` (thème), `pilotageViewStore.js` (sous-onglet actif de Pilotage), `pomodoroStore.js` (minuteur), `draftStore.js` (brouillons de saisie non encore enregistrés).
- **État de composant en mémoire** (variables de module ou closures) pour tout ce qui est éphémère à un écran ouvert (filtres de recherche, timers de debounce, etc.) — pas persisté.

## 6. Stockage et données

- Toutes les données utilisateur vivent sous **`users/{uid}/...`** dans Firestore — scoping strict par utilisateur authentifié.
- `js/services/storage.js` est la **seule** porte d'entrée vers Firestore pour le reste de l'app (le README le formule explicitement : « tout le reste de l'app ne parle qu'à storage.js »). Expose entre autres : `subscribe(collection, callback, opts)`, `listWhere(collection, equalityFilters)` (uniquement des égalités — voir contrainte index ci-dessous), `listRecent(collection, field, limit)` (`orderBy`+`limit` seuls), et une fonction `update(collection, id, mutate)` qui **sérialise les écritures lecture-modification-écriture** par document (file d'attente en mémoire) pour éviter qu'une paire de mutations rapprochées sur la même fiche ne s'écrasent silencieusement.
- **Contrainte connue et volontairement respectée** : toute nouvelle requête Firestore doit être soit une conjonction d'égalités pures (`==`), soit un `orderBy`+`limit` seul, sans autre filtre — ce sont les deux seules formes garanties de ne jamais nécessiter d'index composite. Cet environnement de développement n'a pas d'accès réseau au projet Firestore réel, donc impossible de tester si un index manque ; la règle est appliquée par construction plutôt que vérifiée a posteriori.
- `js/services/storage-local.js` : implémentation IndexedDB alternative, même interface que `storage.js`, conservée comme filet de secours (mode 100 % local sans compte) mais **non utilisée en production actuellement** et retirée du précache du Service Worker (elle n'existe que comme référence de code).
- `js/domain/history.js` tient un journal d'audit append-only par entité (voir §12).

## 7. Authentification

- Firebase Auth : connexion Google (`signInWithPopup`) ou email/mot de passe (`signInWithEmailAndPassword`), gérées dans `js/views/login.js` + `js/services/firebase.js`.
- **Liste blanche** : après authentification Firebase réussie, `isEmailAllowed()` (`firebase.js`) vérifie l'email contre la collection Firestore `allowedUsers` — distincte de la liste des comptes autorisés à s'authentifier dans Firebase Authentication lui-même. Un compte peut donc apparaître dans Firebase Authentication sans être autorisé à utiliser l'app (piège déjà vécu par l'admin lui-même, voir commentaire dans `login.js`).
- Écrans dédiés selon l'état : `renderLogin` (non connecté), `renderRestricted` (connecté mais pas dans `allowedUsers`, avec un message spécifique si c'est le compte admin lui-même), `renderAuthError` (échec technique pendant la vérification — écran distinct ajouté pour ne jamais laisser un écran blanc silencieux).
- `ADMIN_EMAIL` est une constante codée en dur dans `firebase.js`.

## 8. Intégrations externes

- **Firebase** (Auth + Firestore) — seule intégration backend. Config (apiKey, projectId `papatangocharly`, etc.) codée en dur dans `js/services/firebase.js`, chargée depuis les URL CDN `gstatic.com` (pas de variables d'environnement, pas de build-time injection).
- **Réunions Outlook** : rattachement de réunions Outlook à des tâches/suivis (`addOutlookMeeting`/`removeOutlookMeeting` dans `tasks.js`) — a priori un lien/identifiant stocké côté app plutôt qu'une vraie API Microsoft Graph ; à confirmer si un changement touche cette zone (non revérifié pour ce document).
- **Cloudflare Pages** pour l'hébergement statique (pas une intégration applicative, mais conditionne `_headers`).
- Aucune analytics tierce, aucun SDK de paiement, aucune autre API externe identifiée à ce jour.

## 9. Fonctionnement offline

- Firestore en **`persistentLocalCache`** (multi-onglets) : les lectures/écritures fonctionnent hors-ligne sur les données déjà vues, synchronisation automatique au retour du réseau.
- **Service Worker** (`sw.js`) : précache `APP_SHELL` (code applicatif, styles, icônes) en cache-first. Installation **résiliente** depuis le 15/09/2026 : chaque fichier est mis en cache individuellement via `Promise.allSettled` — un fichier en échec n'empêche plus le précache des ~90 autres (avant cette date, `cache.addAll()` atomique faisait tout échouer sur un seul 404).
- `CACHE_NAME` (actuellement `pilotage-cache-v61`) est **incrémenté à chaque commit qui modifie un fichier précaché** — convention stricte du projet, pas automatique. Un commentaire au-dessus de la constante explique le pourquoi de chaque incrément (historique lisible directement dans le fichier).
- Détection de mise à jour : `app.js` compare périodiquement le contenu de `sw.js` (via `registration.update()`) pour proposer un rafraîchissement. Ce mécanisme dépend de `_headers` qui force `Cache-Control: no-cache` sur `/sw.js` et `/index.html` (sans ça, un cache intermédiaire pouvait servir une copie périmée et bloquer la détection).
- **Indicateur utilisateur** (ajouté 15/09/2026) : `js/services/onlineStatus.js` (wrapper `navigator.onLine` + événements `online`/`offline`) alimente un bandeau visible dans `app.js` quand la connexion tombe, et `js/components/modal.js` affiche un message dédié si un bouton d'action reste en attente d'écriture Firestore plus de 2,5 s hors-ligne (les promesses `setDoc`/`addDoc`/`updateDoc`/`deleteDoc` ne se résolvent qu'une fois l'écriture confirmée par le serveur — elles restent en attente indéfiniment hors-ligne, même si la donnée est déjà visible localement via le cache).

## 10. Scripts disponibles / build / test / lint

**Aucun.** Pas de `package.json`, pas de `npm run *`, pas de linter configuré, pas de suite de tests dans le dépôt. Le README documente un unique moyen de lancer l'app en local : servir le dossier avec un serveur statique quelconque (`npx serve .` en exemple). La vérification de non-régression avant chaque livraison se fait **hors dépôt**, à la main, à chaque session : `node --input-type=module --check < fichier.js` pour la syntaxe, harnais Node/Playwright jetables construits sur mesure dans `/tmp` pour valider un comportement précis (ils ne sont jamais commités).

## 11. Modules principaux (résumé fonctionnel)

- **Inbox** (`domain/inbox.js` + `views/inbox.js`) : capture brute, qualification en tâche/suivi/information à garder ("Kept"), archivage automatique.
- **Kanban / Pilotage** (`views/kanban.js`) : Tâches, Projets, Calendrier, Priorisation en sous-onglets d'un même flux (`pilotageSubNav.js`, `pilotageViewStore.js`).
- **Changement de type** (`components/changeType.js` + `domain/convert.js`) : convertit une fiche d'un type vers un autre (Tâche ↔ Suivi ↔ Information/Idée) en conservant sous-étapes et notes ; rouvre automatiquement la fiche convertie (comportement depuis le 15/09/2026) via `fetchBundle`/`resolveRef`.
- **Recherche globale** (`components/search.js`) : charge un « bundle » de ~10 collections une seule fois à l'ouverture de la modale, filtre ensuite en mémoire à chaque frappe (anti-rebond 150 ms).
- **Historique / audit** (`domain/history.js`) : journal append-only par entité, `ACTION_META` traduit chaque type d'événement en libellé lisible ; requêtes bornées (`listForEntity`/`listForEntities`/`listRecent`) plutôt que `listAll()` pour les écrans qui n'ont besoin que d'un sous-ensemble.
- **Notes de mise à jour** (`views/whatsnew.js`) : changelog utilisateur rédigé à la main à chaque livraison, regroupé par « vague » (plusieurs vagues peuvent partager la même date).
- **Guide** (`views/guide.js`) : aide contextuelle, recherche dédiée avec anti-rebond.
- **Admin** (`components/adminPanel.js`, `services/accountAdmin.js`, `services/usageTracking.js`) : gestion des comptes autorisés, statistiques d'usage globales (non bornées intentionnellement — les stats admin ont besoin du total réel).

## 12. Fichiers critiques (à ne jamais modifier sans mesurer l'impact)

- **`sw.js`** — `CACHE_NAME` et `APP_SHELL` : oublier d'ajouter un nouveau fichier à `APP_SHELL` le rend indisponible hors-ligne ; oublier d'incrémenter `CACHE_NAME` après avoir modifié un fichier précaché fait servir l'ancienne version aux utilisateurs déjà installés.
- **`js/services/firebase.js`** — seul fichier à connaître la config Firebase et la logique de liste blanche (`isEmailAllowed`).
- **`js/services/storage.js`** — seule porte d'entrée Firestore ; toute nouvelle requête doit respecter la contrainte d'index du §6.
- **`_headers`** — la désactivation du cache sur `sw.js`/`index.html` conditionne tout le mécanisme de détection de mise à jour ; à ne pas étendre à d'autres fichiers (les gros fichiers applicatifs doivent rester cache-first, voir commentaire dans `_headers`).
- **`index.html`** — script inline de thème : doit rester synchrone et rejouer exactement la même clé localStorage que `themeStore.js`.

## 13. Conventions importantes

- **Commentaires de traçabilité en français** : chaque correctif porte un commentaire `// BUG corrigé (date, contexte)` ou équivalent expliquant le symptôme et la cause, directement dans le code — sert de mémoire longue à même le dépôt, en plus des docs du projet Claude.
- **Une entrée `CACHE_NAME` = un commit** qui touche un fichier précaché ; le commentaire au-dessus de la constante explique le dernier incrément.
- **Livraison sans accès `push` GitHub** : le dépôt est travaillé en local (clone), chaque lot de correctifs est livré sous forme de patches numérotés (`git format-patch`, numérotation continue depuis `0001`, dernier en date : voir Claude Project) **et** d'un zip complet (`git archive`) en alternative. Chaque livraison est vérifiée par application des patches sur un clone propre du dernier commit connu du dépôt réel, puis diff octet-à-octet avec la version de travail.
- **Documentation durable dans le projet Claude « Pilotage »**, pas dans le dépôt : audits, comptes-rendus de vague, décisions d'architecture. Ce fichier `PROJECT_CONTEXT.md` est l'exception volontaire — il vit dans le dépôt car il doit être visible par quiconque (ou quelle que session) ouvre le code sans passer par le projet Claude.
- **`whatsnew.js` rédigé à la main**, jamais généré automatiquement, une entrée par correctif/fonctionnalité visible par l'utilisateur, regroupée par vague de livraison.

## 14. Contraintes techniques connues

- **Pas d'accès réseau, dans cet environnement de développement, au projet Firestore réel** : impossible de tester une requête contre les vraies données/règles/index. D'où la règle stricte du §6 sur les formes de requêtes autorisées.
- **`cache.addAll()` est atomique** (leçon apprise le 15/09/2026) : ne jamais revenir à cette API pour l'installation du Service Worker sans réintroduire le risque d'échec total sur un seul fichier manquant.
- **Écritures Firestore non résolues hors-ligne** : `setDoc`/`addDoc`/`updateDoc`/`deleteDoc` ne se résolvent qu'à l'accusé de réception serveur — toute UI qui attend cette promesse doit prévoir un état « en attente » explicite hors-ligne (voir `modal.js`, pattern déjà en place).
- **Imports circulaires ES modules tolérés mais fragiles** : `components/linkedItems.js` importe depuis plusieurs `views/*.js` qui importent en retour depuis `linkedItems.js`. Ceci ne casse que si une liaison importée est utilisée de façon synchrone au moment de l'évaluation du module — jamais le cas ici (toujours dans un handler async). Ne pas « nettoyer » ces imports circulaires sans comprendre pourquoi ils sont sans danger tels quels.
- **`js/views/management.js`** existe encore comme fichier mais a été fonctionnellement fusionné dans `people.js` le 02/09/2026 — ne pas supposer qu'il porte encore un onglet de navigation propre.
- **Aucun test automatisé dans le dépôt** : toute non-régression repose sur la vérification manuelle au moment de chaque livraison (voir §10) — un changement qui casse quelque chose de non testé à cette occasion peut passer inaperçu jusqu'au retour de Charles-Henri en usage réel.

## 15. Informations non vérifiées pour ce document (à confirmer si besoin)

- Mécanisme exact d'intégration Outlook (`addOutlookMeeting`) — supposé être un simple lien/identifiant stocké côté app, non revérifié dans le code au moment de la rédaction.
- Règles de sécurité Firestore **effectivement déployées** sur le projet réel (seule la règle *recommandée* dans le README est connue ici — pas de moyen de vérifier ce qui est réellement en place côté Firebase Console depuis cet environnement).
- Présence ou non d'un dépôt Git réellement à jour avec le dernier lot de patches appliqué côté GitHub (l'historique local peut être en avance sur ce que Charles-Henri a effectivement appliqué — toujours vérifier auprès de lui ou dans la doc de livraison la plus récente du projet Claude avant de supposer un état donné).

## 16. Évolution du schéma des données

*Section ajoutée le 21/09/2026 (LOT 5, TODO-012) — répond à un manque identifié par l'audit données (`AUDIT_DATA.md`, DATA-002 et DATA-007) : trois stratégies de migration de schéma et deux stratégies de journal coexistaient dans le code sans qu'aucun document ne dise laquelle utiliser pour un futur ajout. Documentation pure — aucun fichier applicatif n'a été modifié pour produire cette section ; elle décrit des choix déjà faits, elle n'en introduit aucun nouveau.*

### 16.1 Tableau embarqué vs collection dédiée

Un besoin récurrent du produit est de tenir un « journal » qui s'accumule sur la durée de vie d'une fiche (notes, sous-étapes, historique...). Deux stratégies coexistent dans le code, sans qu'aucune règle explicite n'ait jamais tranché laquelle utiliser — ce que documente cette section, à partir des choix déjà faits plutôt que d'une doctrine nouvelle :

- **Tableau embarqué directement sur le document parent** — ex. `tasks.notesLog`/`checklist`/`steps`/`outlookMeetings`, `projects.notesLog`/`parts`/`steps`, `followUps.notesLog`/`checklist`, `resources.notesLog`, `meetings.notesLog`, `decisions.notesLog`, `objectives.entries`, `people.notesLog`. Choisi quand : (1) l'ensemble appartient exclusivement à UNE fiche, jamais partagé ni recherché indépendamment d'elle ; (2) aucun besoin de le requêter transversalement (« tous les éléments de ce type, tous propriétaires confondus ») ; (3) le volume attendu reste borné à l'échelle d'une fiche (quelques dizaines d'éléments, pas des milliers). Coût connu, documenté par DATA-001/TODO-010 : `storage.put()`/`storage.update()` réécrivent le document parent en entier à chaque ajout — LOT 4B (TODO-010) a ajouté `storage.appendToArray()` (écriture Firestore ciblée, `updateDoc()`+`arrayUnion()`) pour les tableaux purement additifs de cette liste, sans changer le choix de schéma lui-même (toujours un tableau embarqué, seule la façon de l'écrire a changé). L'extraction complète de `notesLog` en sous-collection Firestore dédiée (`users/{uid}/tasks/{id}/notes/{noteId}`) reste une piste « à plus long terme » (voir TODO-010, non entreprise à ce jour) plutôt qu'une doctrine déjà appliquée.
- **Collection Firestore dédiée** — ex. `history` (journal d'audit de TOUTES les entités), `links` (relations entre deux fiches, de types potentiellement différents), `tags` (associations `{entityType, entityId, tag}` sur les 9 types de fiches liables). Choisi quand : (1) le même type d'objet doit être requêté transversalement, indépendamment de la fiche qui l'a produit (ex. « tous les tags de cette fiche », `tags.js#addTag` via `storage.listWhere`) ; (2) l'objet relie structurellement DEUX fiches de types potentiellement différents plutôt que d'appartenir à une seule (ex. `links.a`/`links.b`) — un tableau à dupliquer des deux côtés diverge dès qu'une des deux écritures échoue, `storage.js` ne garantissant aucune transaction multi-documents ; (3) le volume peut légitimement croître sans plafond réaliste à l'échelle d'UNE fiche (ex. `history`, alimenté par toutes les entités de l'app).
- **Incohérence connue, non résolue par cette section** (DATA-002) : `notesLog` (journal de notes libres) suit la logique inverse de `history`/`links` pour un besoin conceptuellement proche (« un journal qui s'accumule »), sans qu'aucun commentaire du code n'ait jamais expliqué pourquoi le même raisonnement ne s'applique pas aussi à lui. Cette section documente le critère de choix pour toute **future** structure de ce type ; elle ne tranche pas rétroactivement si `notesLog` aurait dû suivre l'autre stratégie — ce choix rétroactif dépasse le périmètre documentaire de TODO-012 (voir TODO-010 pour la piste de migration envisagée, non actionnée).

### 16.2 Trois stratégies d'évolution de schéma

Trois façons différentes de faire évoluer la forme d'une donnée déjà en base coexistent dans le code (`AUDIT_DATA.md`, DATA-007), sans qu'aucune n'ait été nommée avant cette section. Aucune n'est « meilleure » dans l'absolu — chacune répond à un cas différent :

1. **Valeur par défaut à la lecture** (`data.champ || valeur`) — la plus répandue. À utiliser pour un champ optionnel simple, dont l'absence ne casse rien et n'a pas besoin d'être normalisée en profondeur. Exemple : la quasi-totalité des champs optionnels de `createTask`/`createProject`/etc. (voir §17). Aucune écriture déclenchée, aucun document réécrit — le plus économique des trois, à préférer par défaut.
2. **Migration ponctuelle protégée par un drapeau booléen**, posé une fois sur le document `preferences` singleton. À utiliser pour une transformation coûteuse ou déclenchée une seule fois au démarrage de l'app, qu'il ne faut jamais rejouer. Exemples déjà en place : `dashboardHiddenMigratedV19`, `postitMigratedV1`, `tagsMigratedV1` (`tags.js#migrateInboxTags`), `personalObjectivesMigratedV1` (voir §17.13 pour le détail de chaque drapeau). Point de vigilance déjà connu (DATA-010, backlog, non planifié à ce jour) : une migration qui échoue ne pose jamais son drapeau, donc elle est retentée à chaque chargement de l'app sans limite de tentatives ni signal d'échec remonté — à garder à l'esprit avant d'ajouter une 5ᵉ migration sur ce même modèle.
3. **Normalisation appliquée à CHAQUE lecture, sans jamais réécrire le document d'origine**. À utiliser pour une traduction de vocabulaire bon marché à recalculer (donc jamais un calcul coûteux — voir stratégie 2 dans ce cas). Exemple en place : `followups.js#normalize`/`normalizeStatus` (`LEGACY_STATUS_MAP`), qui traduit au vol les anciens statuts Suivi (`todo`/`in_progress`/`follow_up`) vers le vocabulaire actuel (`waiting`/`relaunched`/`done`), appelée depuis `followUpsApi.subscribe()`. **Angle mort connu de cette stratégie, non corrigé par cette section documentaire** (DATA-008/DATA-009, backlog, sans TODO dédié à ce jour, voir `TODO_TECHNIQUE.md` §4.2) : elle ne s'applique qu'aux lectures qui passent réellement par `subscribe()` ; tout code qui lit `followUps` directement (ex. `exportAllUserData()` dans `firebase.js`, un accès Firestore brut hors de `js/domain/*.js`) voit la valeur BRUTE non normalisée — la sauvegarde JSON d'export de compte peut donc différer de ce que l'app affiche réellement pour ce champ.

## 17. Schéma des collections (référence)

*Section ajoutée le 21/09/2026 (LOT 5, TODO-012) — répond à DATA-015 : aucune vue d'ensemble du schéma de chaque collection n'existait, chacune devant être reconstituée en lisant les fonctions `createXxx()`/`normalize()` de chaque fichier `js/domain/*.js`. Reflète l'état du code à cette date ; à corriger à la marge à chaque nouveau champ plutôt qu'à reconstruire entièrement (cohérent avec le choix du projet de n'avoir ni TypeScript ni schéma de validation à l'exécution, voir §2) — un tableau qui prend du retard sur le code reste trompeur, donc à tenir à jour au fil de l'eau.*

**Champs communs à TOUS les documents**, ajoutés automatiquement par `storage.put()` (§6) et absents des tableaux ci-dessous pour ne pas les répéter 14 fois : `id` (string, généré par `generateId()` si absent), `createdAt` (number, timestamp ms, posé une seule fois à la création), `updatedAt` (number, timestamp ms, réécrit à chaque `put()`/`update()`/écriture ciblée).

### 17.1 `tasks` (`js/domain/tasks.js`)

| Champ | Type | Optionnel | Note |
|---|---|---|---|
| `title` | string | non | |
| `description` | string | oui (déf. `""`) | |
| `type` | string | non (déf. `"action"`) | `"communication"` active le canevas dédié (`steps`) |
| `status` | string | non (déf. `"todo"`) | `STATUSES` : todo/in_progress/waiting/follow_up/done |
| `priority` | string | non (déf. `"normale"`) | |
| `dueDate` | string (`YYYY-MM-DD`) \| `null` | oui | |
| `projectId` | string \| `null` | oui | |
| `parentTaskId` | string \| `null` | oui | |
| `successCriteria` | string | oui (déf. `""`) | |
| `isBlocked` | boolean | non (déf. `false`) | saisi à la main (fiche détail), pas déduit |
| `sourceInboxItemId` | string \| `null` | oui | posé par `inbox.js#qualify` |
| `steps` | array `{key, label, done, doneAt}` | non (déf. `[]`, ou canevas si `type: "communication"`) | `doneAt` posé par `toggleStep`, absent tant que non coché ; canevas §78.9, voir `templates.js#buildSteps` |
| `completedAt` | number \| `null` | oui | posé/effacé par `setStatus` |
| `outlookMeetings` | array `{id, title, date}` | non (déf. `[]`) | écrit via `storage.appendToArray` (LOT 4B) |
| `notesLog` | array `{id, text, createdAt}` | non (déf. `[]`) | idem |
| `checklist` | array `{id, text, done, doneAt}` | non (déf. `[]`) | `doneAt` posé par `toggleChecklistItem`, absent à la création ; ajout via `storage.appendToArray`, `toggle`/`remove` restent sur `storage.update` |
| `waitingOn` | string | non (déf. `""`) | "⏳ En attente de..." — écrit via `storage.setFields` (LOT 4B) |

### 17.2 `projects` (`js/domain/projects.js`)

| Champ | Type | Optionnel | Note |
|---|---|---|---|
| `name` | string | non | |
| `objective` | string | oui (déf. `""`) | |
| `successCriteria` | string | oui (déf. `""`) | |
| `color` | string (hex) | non (déf. `"#4C56C4"`) | |
| `category` | string \| `null` | oui | libre, icône assignée via `preferences.categories` |
| `status` | string | non (déf. `"active"`) | active \| done \| archived |
| `critical` | boolean | non (déf. `false`) | "⭐ Projet prioritaire", consommé par `priorisation.js` |
| `steps` | array `{key, label, done, doneAt}` | non (déf. canevas `"project"`) | `doneAt` posé par `toggleStep`, absent tant que non coché |
| `parts` | array `{id, label, status, notesLog}` | non (déf. `[]`) | `status` : `PART_STATUSES` (not_started/in_progress/done) ; `notesLog` de chaque part reste sur `storage.update` (tableau imbriqué DANS un tableau, DATA-001) |
| `order` | number | non (déf. `Date.now()`) | position manuelle (glisser-déposer) |
| `notesLog` | array `{id, text, createdAt}` | non (déf. `[]`) | écrit via `storage.appendToArray` (LOT 4B) |

### 17.3 `people` (`js/domain/people.js`)

| Champ | Type | Optionnel | Note |
|---|---|---|---|
| `name` | string | non | |
| `role` | string | oui (déf. `""`) | |
| `team` | string | oui (déf. `""`) | |
| `type` | string | non (déf. `"collaborateur"`) | collaborateur \| manager |
| `notes` | string | oui (déf. `""`) | contexte libre non daté, distinct de `notesLog` |
| `notesLog` | array `{id, text, createdAt}` | non (déf. `[]`) | reste sur `storage.update` (hors périmètre TODO-010, voir TODO-037) |
| `order` | number | non (déf. `createdAt`) | position manuelle (onglet Équipe) |

### 17.4 `followUps` (`js/domain/followups.js`)

| Champ | Type | Optionnel | Note |
|---|---|---|---|
| `title` | string | non | l'engagement pris, ou ce qu'il faut transmettre |
| `personId` | string | non | |
| `direction` | string | non (déf. `"waiting_on"`) | `DIRECTIONS` : waiting_on \| to_tell |
| `category` | string \| `null` | oui | qualifie un `to_tell` destiné au Management |
| `notable` | string \| `null` | oui | `NOTABLE_VALUES` : positive \| negative |
| `expectedResult` | string | oui (déf. `""`) | |
| `description` | string | oui (déf. `""`) | contexte libre non daté |
| `dueDate` | string (`YYYY-MM-DD`) \| `null` | oui | échéance côté personne (`waiting_on`) |
| `controlDate` | string (`YYYY-MM-DD`) \| `null` | non (calculé, voir `resolveControlDate`) | quand JE dois vérifier/relancer |
| `status` | string | non (déf. `"waiting"`) | `STATUSES` : waiting/relaunched/done |
| `successCriteria` | string | oui (déf. `""`) | |
| `projectId` | string \| `null` | oui | |
| `notesLog` | array `{id, text, createdAt}` | non (déf. `[]`) | écrit via `storage.appendToArray` (LOT 4B) |
| `checklist` | array `{id, text, done, doneAt}` | non (déf. `[]`) | idem pour l'ajout |

### 17.5 `resources` (`js/domain/resources.js`)

| Champ | Type | Optionnel | Note |
|---|---|---|---|
| `title` | string | non | |
| `type` | string | non (déf. `detectType(url)`) | clé de `TYPES` |
| `url` | string | oui (déf. `""`) | |
| `location` | string | oui (déf. `""`) | |
| `description` | string | oui (déf. `""`) | |
| `tags` | array\<string\> | non (déf. `[]`) | tags libres PROPRES à Resource, distincts de la collection générique `tags` (§17.12) |
| `projectIds` | array\<string\> | non (déf. `[]`) | many-to-many, §65/Règle 8 (jamais dupliquer une Resource) |
| `taskIds` | array\<string\> | non (déf. `[]`) | idem |
| `lastUsedAt` | number \| `null` | oui | |
| `notesLog` | array `{id, text, createdAt}` | non (déf. `[]`) | reste sur `storage.update` (hors périmètre TODO-010, voir TODO-037) |

### 17.6 `meetings` (`js/domain/meetings.js`)

| Champ | Type | Optionnel | Note |
|---|---|---|---|
| `title` | string | non | |
| `date` | string (`YYYY-MM-DD`) \| `null` | oui | |
| `objective` | string | oui (déf. `""`) | |
| `notes` | string | oui (déf. `""`) | contexte libre non daté, distinct de `notesLog` |
| `participants` | array | non (déf. `[]`) | |
| `projectId` | string \| `null` | oui | |
| `canevasKey` | string \| `null` | oui | clé de `CANEVAS_OPTIONS` (meeting/one_on_one), `null` = aucun canevas |
| `steps` | array `{key, label, done, doneAt}` | non (déf. `[]`, ou canevas si `canevasKey` posé) | `doneAt` posé par `toggleStep`, absent tant que non coché |
| `notesLog` | array `{id, text, createdAt}` | non (déf. `[]`) | reste sur `storage.update` (hors périmètre TODO-010, voir TODO-037) |

### 17.7 `decisions` (`js/domain/decisions.js`)

| Champ | Type | Optionnel | Note |
|---|---|---|---|
| `title` | string | non | le sujet de la décision |
| `decision` | string | non | ce qui a été décidé |
| `context` | string | oui (déf. `""`) | |
| `date` | string (`YYYY-MM-DD`) \| `null` | oui | |
| `projectId` | string \| `null` | oui | |
| `meetingId` | string \| `null` | oui | |
| `peopleIds` | array\<string\> | non (déf. `[]`) | |
| `notesLog` | array `{id, text, createdAt}` | non (déf. `[]`) | reste sur `storage.update` (hors périmètre TODO-010, voir TODO-037) |

### 17.8 `objectives` (`js/domain/objectives.js`)

| Champ | Type | Optionnel | Note |
|---|---|---|---|
| `personId` | string \| `null` | oui | `null` = objectif personnel (voir "🎯 Mes objectifs", §17.13) |
| `title` | string | non | |
| `status` | string | non (déf. `"active"`) | active \| done |
| `entries` | array `{id, date, note, createdAt}` | non (déf. `[]`) | points de suivi datés, tableau embarqué (§16.1) |
| `projectId` | string \| `null` | oui | |

### 17.9 `prompts` (`js/domain/prompts.js`)

| Champ | Type | Optionnel | Note |
|---|---|---|---|
| `title` | string | non | |
| `description` | string | oui (déf. `""`) | |
| `text` | string | non | |
| `taskIds` | array\<string\> | non (déf. `[]`) | many-to-many, symétrique de `resources.taskIds` |

### 17.10 `inboxItems` (`js/domain/inbox.js`)

| Champ | Type | Optionnel | Note |
|---|---|---|---|
| `rawContent` | string | non | jamais modifié après capture (Règle 3) |
| `source` | string | non (déf. `"manuel"`) | |
| `status` | string | non (déf. `"pending"`) | pending \| processed \| archived \| kept |
| `notesLog` | array `{id, text, createdAt}` | oui (absent tant qu'aucune note n'a été ajoutée) | journal actif via `inbox.js#addKeptNote`, câblé à la section "🗒️ Notes" de la fiche Kept (`openKeptItemDetail`) — même principe que les autres `addNote()`, pas seulement un report lors d'un changement de type ; peut aussi être initialisé avec une valeur reprise via `convert.js` (Tâche/Suivi → Information) |
| `resultTaskId`/`resultFollowUpId`/`resultProjectId`/`resultMeetingId`/`resultDecisionId`/`resultResourceId` | string | oui | posé par `qualify()` selon l'issue choisie, un seul des six présent à la fois |
| `keptAsType` | string | oui | posé quand `status: "kept"` — le type réel choisi (ex. "kept", "idea") |
| `keptAt` | number | oui | horodatage de la qualification en "kept", distinct de `createdAt` (capture initiale) |
| `projectId` | string \| `null` | oui | posé par `setKeptProject`, pour un élément "kept" rattaché à un projet |
| `tags` | array\<string\> | oui, hérité | ancien mécanisme de tags propre à l'Inbox, plus jamais écrit depuis la migration vers la collection générique `tags` (§17.12) — conservé en lecture seule pour compatibilité |

### 17.11 `links` (`js/domain/links.js`)

| Champ | Type | Optionnel | Note |
|---|---|---|---|
| `a` | objet `{type, id, label}` | non | première extrémité du lien ; `label` figé au moment de la création |
| `b` | objet `{type, id, label}` | non | seconde extrémité, même forme que `a` |

### 17.12 `tags` (`js/domain/tags.js`)

| Champ | Type | Optionnel | Note |
|---|---|---|---|
| `entityType` | string | non | type de la fiche taguée (ex. "Task", "Kept") — jamais nommé `type` (voir commentaire en tête du fichier, collision avec le champ `id` de `storage.put`) |
| `entityId` | string | non | id de la fiche taguée |
| `tag` | string | non | toujours stocké SANS le `#` (`stripHash`), casse d'origine conservée (comparaison insensible à la casse faite en mémoire) |

### 17.13 `preferences` (`js/domain/preferences.js`) — document unique, `id` fixe `"app"`

Pas une vraie collection multi-documents : un seul document partagé par tout le compte (voir `DOC_ID`). Valeurs par défaut posées par `withDefaults()`, jamais persistées tant qu'inchangées (stratégie 1, §16.2) :

| Champ | Type | Optionnel | Note |
|---|---|---|---|
| `seenTour` | boolean | non (déf. `false`) | visite guidée déjà vue |
| `seenUsageNotice` | boolean | non (déf. `false`) | information "suivi d'usage" déjà vue |
| `categories` | objet `{nom: icône}` | non (déf. `{}`) | registre des catégories de Projet |
| `projectSort` | string | non (déf. `"manual"`) | mode d'affichage onglet Projets |
| `casquette` | string | non (déf. `"all"`) | casquette active, voir `casquettes.js` |
| `dashboardHidden` | array\<string\> | non (déf. `[]`) | sections Accueil masquées |
| `dashboardHiddenMigratedV19` | boolean | non (déf. `false`) | drapeau one-shot (stratégie 2, §16.2) |
| `seenHints` | objet `{clé: true}` | non (déf. `{}`) | bandeaux d'aide déjà vus |
| `lastWeeklyReviewAt` | number \| `null` | non (déf. `null`) | horodatage dernière Revue hebdo |
| `focusOverride` | objet `{date, addedTaskIds}` | non (déf. `{date: null, addedTaskIds: []}`) | tâches ajoutées manuellement au Focus du jour |
| `recentlyViewed` | array `{type, id, viewedAt}` | non (déf. `[]`) | plafonné à 3, le plus récent en tête |
| `notifOptIn` | boolean \| `null` | non (déf. `null`) | `null` = pas encore répondu |
| `lastNotifShownDate` | string (`YYYY-MM-DD`) \| `null` | non (déf. `null`) | |
| `customShortcuts` | objet `{combo: {type, id, label}}` | non (déf. `{}`) | raccourcis Ctrl+Alt personnalisés |
| `myObjectives` | string | non (déf. `""`) | **CHAMP HÉRITÉ**, plus lu/écrit par l'interface depuis le 13/09/2026 (voir `objectives.js`), conservé en base sans être nettoyé |
| `homeMode` | string | non (déf. `"classic"`) | classic \| focus |
| `seenWhatsNewCount` | number | non (déf. `0`) | ne revient jamais en arrière |
| `postitMode` | string | non (déf. `"text"`) | text \| checklist |
| `postitText` | string | non (déf. `""`) | contenu du Pense-bête en mode texte |
| `postitChecklist` | array | non (déf. `[]`) | contenu du Pense-bête en mode checklist |
| `postitMigratedV1` | boolean | non (déf. `false`) | drapeau one-shot (stratégie 2, §16.2) |
| `dashboardOrder` | array\<string\> | non (déf. `[]`) | ordre explicite des rubriques Accueil |
| `tagsMigratedV1` | boolean | non (déf. `false`) | drapeau one-shot, `tags.js#migrateInboxTags` |
| `disabledTags` | array\<string\> | non (déf. `[]`) | |
| `personalObjectivesMigratedV1` | boolean | non (déf. `false`) | drapeau one-shot (stratégie 2, §16.2) |
| `priorityWeights` | objet | oui, sans défaut dans ce fichier | pondération de la matrice de priorisation, voir `priorisation.js` |

### 17.14 `history` (`js/domain/history.js`, écrit via `storage.logHistory()`)

| Champ | Type | Optionnel | Note |
|---|---|---|---|
| `entityType` | string | non | type de la fiche concernée (ex. "Task", "InboxItem") |
| `entityId` | string | non | id de la fiche concernée |
| `action` | string | non | clé traduite en libellé lisible par `ACTION_META` |
| `metadata` | objet | non (déf. `{}`) | forme libre selon `action`, voir chaque appelant de `storage.logHistory` |
| `date` | number | non | timestamp ms de l'événement (distinct de `createdAt`, identique en pratique) |

**Cas particulier — "kept" (Information/Idée)** : pas une collection séparée. Un élément "kept" est un `inboxItems` dont `status` vaut `"kept"` (ou `"archived"` avec `keptAsType` posé, pour un ancien élément archivé depuis) — voir `inbox.js#listKept`/`subscribeKept`. Les vues qui listent "les Informations/Idées" filtrent `inboxItems` en mémoire, elles ne lisent jamais une collection `keptItems` à part (le nom apparaît dans `linkedItems.js#fetchBundle` comme nom de variable locale, pas comme nom de collection Firestore).
