# AUDIT_FIREBASE.md — Pilotage (papaTangoCharly)

Audit ciblé de l'usage de Firebase/Firestore : requêtes, listeners, lectures/écritures inutiles, index, règles de sécurité, structure des données côté Firestore, cache, coûts potentiels, erreurs de conception. Réalisé par inspection directe du code (`js/services/storage.js`, `js/services/firebase.js`, `js/services/usageTracking.js`, `js/services/accountAdmin.js`, l'ensemble des vues pour le comptage des abonnements) et des règles de sécurité **réellement déployées**, communiquées par Charles-Henri dans ce message — première fois que ce texte peut être confronté au code plutôt qu'à la version documentée dans `js/components/adminPanel.js` (voir FIREBASE-001/002 pour les écarts constatés). Ne reprend pas les constats déjà couverts par l'audit performance global déjà réalisé (fusion des abonnements Inbox, anti-rebond de recherche, bornage de l'historique affiché) ni par `AUDIT_DATA.md` (repris seulement par référence courte quand l'angle coût/quota Firebase apporte une information nouvelle). Aucune modification de code effectuée.

_Réalisé le 15/09/2026._

---

## FIREBASE-001

- **Gravité** : HAUTE
- **Fichier(s)** : règle réelle `match /users/{uid}/{document=**}`, `js/services/accountAdmin.js` (`setAccountClosed`), `js/services/firebase.js` (`isEmailAllowed`)
- **Problème** : la règle réellement déployée pour `users/{uid}/**` vérifie `exists(...allowedUsers/{email})` — un point rassurant qui **corrige** l'hypothèse la plus pessimiste envisagée dans `AUDIT_SECURITY.md` (SEC-001, basé sur le texte non confirmé du tutoriel `adminPanel.js`) : la liste blanche est bien appliquée au niveau des règles, pas seulement côté client. En revanche, `exists()` vérifie uniquement que le document `allowedUsers/{email}` existe — jamais son contenu. Fermer un compte (`setAccountClosed(email, true)`, fonctionnalité "👥 Comptes") pose `disabled: true` sur ce document sans le supprimer : le document continue donc d'exister, et la règle continue de laisser passer `request.auth.uid == uid` pour cette personne.
- **Risque concret** : "fermer" un compte depuis "👥 Comptes" bloque l'accès à l'**interface** de l'app (`isEmailAllowed()` refuse côté client) mais ne révoque **rien** côté Firestore : une personne dont le compte vient d'être fermé, si elle conserve un jeton d'authentification Firebase encore valide (les jetons durent typiquement jusqu'à une heure, renouvelables tant que la session navigateur reste active), peut continuer à lire/écrire directement sous `users/{son-uid}/...` via le SDK ou l'API REST, en contournant simplement l'écran de connexion. Le risque reste **borné aux propres données de cette personne** (pas d'accès aux données d'autrui) mais contredit l'intention du bouton "Fermer l'accès".
- **Correction recommandée** : soit ajouter `&& get(...allowedUsers/{email}).data.disabled != true` à la règle `users/{uid}/**` (coût : une lecture Firestore supplémentaire par requête, comme documenté dans le code pour la variante déjà envisagée), soit considérer que la fermeture applicative n'est qu'un premier niveau et documenter clairement que la révocation réelle et immédiate nécessite de désactiver le compte au niveau de Firebase Authentication lui-même (Console → Authentication → désactiver l'utilisateur), qui coupe l'accès à la source, indépendamment des règles Firestore.
- **Effort** : S (ajustement de règle) / S (procédure documentée côté Authentication, sans changement de code)
- **Dépendances éventuelles** : aucune modification de code applicatif nécessaire pour la seconde option.

## FIREBASE-002

- **Gravité** : MOYENNE
- **Fichier(s)** : règle réelle `match /allowedUsers/{email} { allow read: if request.auth != null; }`
- **Problème** : la règle réellement déployée accorde `read` (qui recouvre en Firestore à la fois `get` ET `list`) à **n'importe quel utilisateur authentifié**, sans distinction. Le tutoriel intégré à `js/components/adminPanel.js` suggérait une règle plus fine (`get` pour tous, `list` réservé à l'admin) — cette version plus restrictive n'est **pas** celle en place : la règle réelle est plus simple et donc plus permissive que ce que le code de l'app documente lui-même.
- **Risque concret** : n'importe quelle personne parvenant à s'authentifier auprès du projet Firebase `papatangocharly` (un compte Google suffit a priori, voir la même remarque dans `AUDIT_SECURITY.md`) peut faire un `list` complet de la collection `allowedUsers` et obtenir en une seule requête la liste de **toutes** les adresses email autorisées à utiliser Pilotage, avec leur statut `disabled`. Pas d'accès aux données métier elles-mêmes (protégées par `users/{uid}`), mais divulgation complète de la liste des collaborateurs invités — plus large que ce qu'un simple `get` ciblé permettrait.
- **Correction recommandée** : séparer `get` (accès à un document précis, éventuellement laissé ouvert si nécessaire à `isEmailAllowed()`) de `list` (à réserver à `request.auth.token.email.lower() == "ch-houdayer@hotmail.fr"`), conformément à ce que le tutoriel `adminPanel.js` décrit déjà — il suffit d'aligner la règle réellement déployée sur ce texte.
- **Effort** : S
- **Dépendances éventuelles** : à vérifier que `isEmailAllowed()` (qui fait un `getDoc` ciblé, pas un `list`) continue de fonctionner après la séparation — devrait être le cas, `get` resterait ouvert.

## FIREBASE-003

- **Gravité** : HAUTE
- **Fichier(s)** : `js/services/usageTracking.js` (`fetchUsageEvents`), `js/services/accountAdmin.js` (`listAccounts`), `js/components/adminPanel.js`
- **Problème** : la collection `usageEvents` (non bornée, un document par écran visité et par connexion, pour tous les comptes) est lue **intégralement** (`getDocs` sans filtre ni limite) par **deux** chemins de code indépendants : `usageTrackingApi.fetchUsageEvents()` (panneau "📊 Statistiques d'usage") ET `accountAdminApi.listAccounts()` (panneau "👥 Comptes", qui l'utilise en interne uniquement pour calculer la dernière activité connue de chaque compte).
- **Risque concret** : chaque document Firestore lu est facturé (au-delà du quota gratuit quotidien de lectures). Ouvrir "👥 Comptes" facture donc déjà la lecture de l'intégralité de l'historique d'usage de tous les comptes, même si l'objectif de cet écran n'est que la gestion des accès — et si l'admin ouvre ensuite "📊 Statistiques", la MÊME collection est relue intégralement une seconde fois dans la même session. Le coût de consultation de "👥 Comptes" croît avec le volume total d'historique d'usage jamais accumulé, pas avec le nombre de comptes à gérer (typiquement une poignée).
- **Correction recommandée** : calculer la "dernière activité" par compte via une requête bornée par compte (`listWhere("usageEvents", [["uid", uid]])` puis garder le plus récent, ou un champ `lastSeenAt` mis à jour directement sur le document `allowedUsers` à chaque connexion plutôt que recalculé depuis l'historique complet) au lieu de charger tout l'historique pour n'en extraire qu'un agrégat par compte.
- **Effort** : M
- **Dépendances éventuelles** : recoupe `AUDIT_CODE.md` (CODE-008, qui traite du non-bornage de `usageEvents` sous l'angle de la fiabilité des statistiques admin) — ce constat-ci porte sur un usage différent et distinct de la même collection (le calcul de "dernière activité" dans "👥 Comptes"), qui n'a pas besoin de l'historique complet pour son propre objectif.

## FIREBASE-004

- **Gravité** : MOYENNE
- **Fichier(s)** : `js/views/dashboard.js` (7 abonnements), `js/views/calendar.js` (5), `js/views/kanban.js`/`projects.js`/`people.js`/`resources.js` (3 chacun), `js/views/priorisation.js` (2)
- **Problème** : chaque vue ouvre indépendamment ses propres écoutes temps réel (`onSnapshot`, via `Api.subscribe()`) sur les collections dont elle a besoin, sans aucune mutualisation entre vues — contrairement à `inboxItems`, qui bénéficie d'un flux partagé unique depuis l'audit performance déjà réalisé. Naviguer Accueil → Pilotage → Projets → Équipe ferme puis rouvre des écoutes sur les MÊMES collections (`tasks`, `projects`...) à chaque changement d'écran.
- **Risque concret** : chaque nouvel abonnement redemande un instantané initial de la collection concernée. Avec le cache local persistant, une partie de ce coût peut être servie localement sans nouvelle lecture facturée côté serveur — mais ce comportement précis (a fortiori en présence de plusieurs onglets, voir `persistentMultipleTabManager`) n'a pas pu être vérifié depuis cet environnement (Non déterminé). Dans tous les cas, c'est une multiplication du nombre d'écoutes actives ouvertes/fermées au fil d'une session de navigation normale, sur un pattern déjà identifié et corrigé une fois pour `inboxItems` mais jamais généralisé aux autres collections.
- **Correction recommandée** : étendre le principe de flux partagé déjà construit pour `inboxItems` (`js/domain/inbox.js#subscribeFiltered`) aux collections les plus fréquemment ré-abonnées d'une vue à l'autre — `tasks` et `projects` en priorité, communes à Accueil, Pilotage, Projets et Équipe.
- **Effort** : M (généraliser un pattern déjà existant, pas une nouvelle conception)
- **Dépendances éventuelles** : même mécanisme que le correctif déjà livré pour `inboxItems`, directement réutilisable comme modèle.

## FIREBASE-005

- **Gravité** : Non déterminé
- **Fichier(s)** : `js/services/firebase.js` (`initializeFirestore`)
- **Problème** : le cache local persistant Firestore est activé (`persistentLocalCache` + `persistentMultipleTabManager`) sans `cacheSizeBytes` explicite — l'app dépend donc de la taille par défaut du SDK plutôt que d'un choix dimensionné pour ce projet.
- **Risque concret** : Non déterminé depuis cet environnement (pas d'accès à un volume de données réel pour observer le comportement à l'approche de la limite). Devient pertinent à mesure que grandissent les structures déjà signalées comme non bornées dans `AUDIT_DATA.md` (tableaux embarqués, `inboxItems`, `history`) : au-delà de la taille de cache par défaut, le SDK évince les documents les moins récemment utilisés, ce qui peut se traduire par des lectures serveur (facturées) plus fréquentes qu'attendu pour des données anciennes redevenues nécessaires (ex. consultation d'un vieil historique).
- **Correction recommandée** : fixer explicitement `cacheSizeBytes` à une valeur choisie consciemment (ou `CACHE_SIZE_UNLIMITED` si le poste de travail de Charles-Henri le permet, un usage strictement personnel sur un nombre de comptes réduit) plutôt que de laisser la valeur par défaut implicite.
- **Effort** : S
- **Dépendances éventuelles** : pertinence croissante avec DATA-001/006/012 de `AUDIT_DATA.md`.

## FIREBASE-006

- **Gravité** : MOYENNE
- **Fichier(s)** : `js/services/usageTracking.js` (`logView`), `js/app.js` (appelé à chaque changement de route)
- **Problème** : chaque changement d'onglet/écran écrit un document dans `usageEvents` (`addDoc`, fire-and-forget). Fonctionnalité voulue et bornée dans son contenu (voir la portée déjà validée avec Charles-Henri, documentée dans le fichier), mais dont le volume d'écritures est directement proportionnel à l'intensité de navigation de chaque utilisateur, sans regroupement ni débit limité.
- **Risque concret** : accumulation continue d'écritures facturées (au-delà du quota gratuit) proportionnelle non pas à l'activité "utile" (tâches créées, décisions prises) mais à la simple navigation dans l'interface — un utilisateur qui clique beaucoup entre onglets génère plus d'écritures qu'un utilisateur tout aussi productif mais qui reste sur un seul écran. Combiné à FIREBASE-003 (relecture intégrale de cette même collection par deux écrans admin), le coût total de cette fonctionnalité de suivi grandit sur les deux tableaux (écriture ET lecture) sans qu'aucun des deux ne soit aujourd'hui plafonné.
- **Correction recommandée** : regrouper les changements de route rapprochés (ex. un `logView` par écran seulement après un court délai de "présence" plutôt qu'à chaque hash change instantané, similaire à l'anti-rebond déjà appliqué ailleurs) pour réduire le volume sans perdre l'information utile ("quel écran, quand").
- **Effort** : S
- **Dépendances éventuelles** : FIREBASE-003 (même collection, lue en aval).

## FIREBASE-007

- **Gravité** : MOYENNE
- **Fichier(s)** : `js/services/storage.js` (`update`, `put`)
- **Problème** : `storage.update()` (utilisé pour toute modification qui dépend de l'état courant d'un document — ajouter une note, cocher une sous-étape) commence systématiquement par un `getDoc()` (une lecture facturée) avant de réécrire le document entier via `put()`/`setDoc()` (une écriture facturée). Une écriture Firestore ciblée (`updateDoc()` avec notation pointée, ou `arrayUnion()` pour un ajout dans un tableau) n'aurait besoin d'aucune lecture préalable pour le même résultat.
- **Risque concret** : chaque note ajoutée, chaque case cochée facture une lecture ET une écriture, là où une seule écriture ciblée suffirait. Sur un usage intensif (checklist longue, journal de notes actif), ce surcoût de lecture s'additionne à chaque interaction, en plus du coût de bande passante déjà signalé dans `AUDIT_DATA.md` (DATA-001) pour la réécriture complète du document.
- **Correction recommandée** : pour les mutations qui n'ont pas besoin de logique conditionnelle complexe (ajout simple dans un tableau, incrément), envisager `arrayUnion()`/`increment()` via `updateDoc()` directement, réservant `storage.update()` (lecture-modification-écriture complète) aux cas qui en ont réellement besoin (ex. une mutation qui dépend d'une valeur existante pour décider quoi écrire).
- **Effort** : L (implique de revoir au cas par cas quelles mutations peuvent se passer d'une lecture préalable, sans casser la sérialisation par document déjà en place)
- **Dépendances éventuelles** : la sérialisation par clé (`updateQueues`) devrait être conservée même pour des écritures ciblées si plusieurs peuvent viser le même document en parallèle.

## FIREBASE-008

- **Gravité** : FAIBLE (constat de conformité, pas un défaut)
- **Fichier(s)** : ensemble des requêtes Firestore du dépôt
- **Problème/constat** : vérification faite pour cet audit — aucune requête du dépôt ne combine aujourd'hui `where` avec un `orderBy` sur un champ différent, et aucune n'utilise `in`/`array-contains`. La politique "égalités pures, ou `orderBy`+`limit` seul" documentée dans `PROJECT_CONTEXT.md` est donc **respectée à 100 % dans le code actuel**, confirmé par lecture exhaustive plutôt que par confiance déclarative.
- **Risque concret** : résiduel et déjà connu — cette conformité ne peut être vérifiée qu'au niveau du code, jamais contre le projet Firestore réel depuis cet environnement (aucun accès réseau). Une requête future qui s'écarterait de cette règle échouerait au moment de l'exécution en production (message d'erreur Firestore avec lien de création d'index), sans qu'aucun test local ne l'ait anticipé.
- **Correction recommandée** : aucune action nécessaire aujourd'hui — maintenir la discipline documentée à chaque nouvelle requête.
- **Effort** : Non déterminé
- **Dépendances éventuelles** : aucune.

## FIREBASE-009

- **Gravité** : MOYENNE
- **Fichier(s)** : règle réelle `match /usageEvents/{eventId} { allow update, delete: if false; }`
- **Problème** : la règle réelle interdit toute modification ou suppression d'un événement `usageEvents` une fois créé — cohérent avec l'objectif d'un journal d'audit non falsifiable. Combiné à l'absence de toute validation de forme sur `request.resource.data` au-delà de `email`/`uid` (pas de contrainte sur `type`, `route`, `date`), un document mal formé écrit une seule fois (bug côté client, ex. `date` manquant ou `route` à `undefined`) reste **définitivement** dans la collection, sans aucun moyen de le corriger ou de le retirer autrement qu'à la main dans la console Firebase.
- **Risque concret** : `computeUsageStats()` (agrégation des statistiques admin) doit rester défensif indéfiniment face à d'éventuels documents mal formés hérités d'un bug passé, sans jamais pouvoir "nettoyer" les données à la source — un bug de journalisation corrigé dans le code laisse ses traces corrompues dans Firestore pour toujours.
- **Correction recommandée** : aucune action sur la règle elle-même (le caractère non modifiable est une propriété voulue d'un journal d'audit) ; s'assurer que `computeUsageStats()` et tout futur consommateur de cette collection restent défensifs face à des champs manquants ou de forme inattendue, par construction plutôt qu'au coup par coup.
- **Effort** : S
- **Dépendances éventuelles** : aucune.

## FIREBASE-010

- **Gravité** : FAIBLE (constat de conformité)
- **Fichier(s)** : structure `allowedUsers`, `usageEvents` (collections top-niveau) vs `users/{uid}/...` (sous-collections)
- **Problème/constat** : la séparation entre données applicatives (sous `users/{uid}`, scope par propriétaire) et données transversales (`allowedUsers`, `usageEvents`, top-niveau, scope inversé — chacun écrit sur soi, un seul lit tout) est un choix de modélisation Firestore correct et bien reflété par les règles réellement déployées, qui distinguent proprement les trois blocs `match`.
- **Risque concret** : aucun — mentionné pour mémoire, en confirmation que cette partie de la structure de données ne présente pas de défaut de conception du point de vue Firestore.
- **Correction recommandée** : aucune.
- **Effort** : Non déterminé
- **Dépendances éventuelles** : aucune.

---

## Synthèse — répartition par gravité

- **HAUTE** : FIREBASE-001, FIREBASE-003
- **MOYENNE** : FIREBASE-002, FIREBASE-004, FIREBASE-006, FIREBASE-007, FIREBASE-009
- **FAIBLE / conformité** : FIREBASE-005 (Non déterminé), FIREBASE-008, FIREBASE-010

**Point notable pour la suite** : les règles réelles communiquées ici corrigent l'hypothèse la plus grave de `AUDIT_SECURITY.md` (SEC-001 — la liste blanche EST bien appliquée au niveau des règles, pas seulement côté client) mais révèlent un écart inverse sur `allowedUsers` (FIREBASE-002, plus permissif que ce que le code de l'app documente lui-même) et un angle mort sur la fermeture de compte (FIREBASE-001, `disabled` non vérifié par la règle). `AUDIT_SECURITY.md` n'a pas été modifié par cet audit — ces deux fichiers gagneraient à être relus ensemble la prochaine fois que les règles de sécurité évoluent.
