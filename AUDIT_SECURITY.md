# AUDIT_SECURITY.md — Pilotage (papaTangoCharly)

Audit de sécurité complet, réalisé par inspection directe du code du dépôt (lecture de `js/services/firebase.js`, `js/services/accountAdmin.js`, `js/services/usageTracking.js`, `js/components/adminPanel.js`, `js/services/storage.js`, `js/domain/tasks.js`, plusieurs vues et composants pour les schémas d'échappement HTML, `_headers`, `index.html`, `manifest.json`). Point de départ : `PROJECT_CONTEXT.md`. Aucune modification de code effectuée.

**Limite fondamentale de cet audit** : cet environnement n'a aucun accès réseau au projet Firebase réel (`papatangocharly`). Tout ce qui concerne les règles de sécurité Firestore ci-dessous est basé sur le texte **documenté/recommandé** dans le code (commentaires de `firebase.js`, `usageTracking.js`, et le tutoriel intégré à `adminPanel.js`) — **pas sur une vérification de ce qui est réellement déployé dans la console Firebase**. Voir SEC-003.

_Réalisé le 15/09/2026._

---

## SEC-001

- **Gravité** : CRITIQUE
- **Fichier(s)** : `js/services/firebase.js` (`isEmailAllowed`), règle Firestore documentée dans `js/components/adminPanel.js` (`match /users/{uid}/{document=**}`)
- **Problème** : la règle de sécurité Firestore documentée pour `users/{uid}/**` n'autorise que `request.auth.uid == uid` — elle ne vérifie à aucun moment l'appartenance à la liste blanche `allowedUsers`. La vérification `isEmailAllowed()` n'existe que côté client, dans `js/app.js` (écran "Accès restreint" si l'email n'est pas dans `allowedUsers`).
- **Risque concret** : la liste blanche n'est qu'un confort d'affichage, pas une barrière réelle. Toute personne capable de s'authentifier auprès du projet Firebase (a priori n'importe quel compte Google, la connexion Google apparaissant ouverte sans restriction de domaine visible dans le code) obtient un `uid` Firebase valide et peut alors lire/écrire directement sous `users/{son-propre-uid}/...` via le SDK Firestore ou l'API REST, en contournant entièrement l'interface de l'app — sans jamais passer par l'écran "Accès restreint". Cela va à l'encontre de l'intention explicite du produit ("pas de libre inscription, seulement des personnes choisies") et expose le projet à un usage non autorisé du quota Firestore (coût, quota gratuit consommé par des tiers non invités). Ne permet en revanche pas d'accéder aux données des AUTRES utilisateurs (la partie `auth.uid == uid` de la règle est correcte pour ça).
- **Correction recommandée** : faire porter la vérification de la liste blanche par la règle Firestore elle-même, par exemple en ajoutant une lecture de `allowedUsers` dans la condition (`get(/databases/$(database)/documents/allowedUsers/$(request.auth.token.email.lower())).data.disabled != true`), plutôt que de compter sur `isEmailAllowed()` côté client. Nécessite de repenser la règle avec Charles-Henri (implique un coût de lecture Firestore supplémentaire par requête, à évaluer).
- **Effort** : M
- **Dépendances éventuelles** : à coordonner avec SEC-003 (impossible de confirmer l'état réellement déployé) et SEC-002 (même bloc de règles).

## SEC-002

- **Gravité** : CRITIQUE
- **Fichier(s)** : règle Firestore documentée dans `js/components/adminPanel.js`, utilisée par `js/services/firebase.js#exportAllUserData/deleteAllUserData` et `js/services/accountAdmin.js`
- **Problème** : la règle recommandée pour activer "👥 Comptes" ajoute une seconde clause à `users/{uid}/**` : `allow read, write: if request.auth.token.email.lower() == "ch-houdayer@hotmail.fr"`. Cette règle donne à un seul email un accès de lecture/écriture **permanent et illimité** à l'intégralité des données de **tous** les utilisateurs — le tutoriel intégré à `adminPanel.js` le formule lui-même explicitement ("un accès large, pas limité à une seule action ponctuelle").
- **Risque concret** : toute compromission du compte Google/Firebase de l'administrateur (phishing, réutilisation de mot de passe, session volée) devient une compromission totale de **toutes** les données de **tous** les utilisateurs de l'application, sans aucune limite d'action, de durée ou de traçabilité côté règle (`js/domain/history.js` ne journalise pas les lectures faites via cette règle, seulement les mutations passées par les fonctions applicatives normales).
- **Correction recommandée** : si cette règle est déjà déployée, envisager de la restreindre dans le temps (l'activer manuellement seulement le temps d'une opération d'export/suppression ponctuelle, puis la retirer) plutôt que de la laisser en permanence. Alternative plus robuste à moyen terme : passer par une Cloud Function avec les droits Admin SDK (bypass des règles côté serveur, déclenchée par un appel authentifié et réservé à l'admin) plutôt que d'élargir les règles côté client — supprime le risque de compromission de compte = compromission de tout, mais représente un changement d'architecture (introduction de Cloud Functions, aujourd'hui absentes du projet).
- **Effort** : L (changement d'architecture) / S (retrait de la règle entre deux usages, palliatif)
- **Dépendances éventuelles** : SEC-003 (état réel déployé inconnu) ; impacte directement les fonctionnalités "👥 Comptes" (export, fermeture, suppression de compte) si retirée sans alternative.

## SEC-003

- **Gravité** : HAUTE
- **Fichier(s)** : n/a (état de la console Firebase, hors de ce dépôt)
- **Problème** : les règles de sécurité Firestore **effectivement déployées** sur le projet `papatangocharly` ne sont pas vérifiables depuis cet environnement (aucun accès réseau au projet Firebase réel). Tous les constats SEC-001, SEC-002, SEC-004 et SEC-007 ci-dessous supposent que le texte documenté dans le code (commentaires, tutoriel `adminPanel.js`) correspond exactement à ce qui est réellement en place.
- **Risque concret** : la réalité peut être meilleure (règles pas encore posées, fonctionnalités admin cassées en attendant — comportement documenté comme volontaire, "permission-denied" plutôt que silencieux) ou pire (règle mal recopiée, ancienne règle de test encore active de type `allow read, write: if true`, etc.) que ce que le code documente. Aucun des constats liés aux règles Firestore ne peut être traité comme confirmé sans une vérification directe dans la console Firebase (onglet **Rules**) par quelqu'un ayant accès au projet.
- **Correction recommandée** : Charles-Henri (ou toute personne ayant accès à la console Firebase) doit relire l'onglet **Rules** du projet `papatangocharly` et le comparer littéralement au texte documenté dans `adminPanel.js`/`usageTracking.js`. Idéalement, versionner ce texte dans un fichier `firestore.rules` à la racine du dépôt (même en l'absence de déploiement automatisé) pour que le code et les règles réellement appliquées ne puissent plus diverger silencieusement.
- **Effort** : S (vérification) / M (mise en place d'un fichier `firestore.rules` versionné)
- **Dépendances éventuelles** : conditionne la fiabilité de SEC-001, SEC-002, SEC-004, SEC-007.

## SEC-004

- **Gravité** : MOYENNE
- **Fichier(s)** : règle Firestore documentée dans `js/components/adminPanel.js` (`match /allowedUsers/{email}`)
- **Problème** : la règle documentée autorise `allow get: if request.auth != null` sur `allowedUsers/{email}` — c'est-à-dire que **n'importe quel utilisateur authentifié** (y compris quelqu'un qui n'est pas sur la liste blanche et qui voit l'écran "Accès restreint" dans l'app) peut interroger directement Firestore pour un email précis et savoir s'il figure dans `allowedUsers`, et lire son champ `disabled`. Seul le `list` (énumération complète) est réservé à l'admin.
- **Risque concret** : divulgation d'information ciblée — quelqu'un qui a réussi à s'authentifier (voir SEC-001) peut vérifier, un email à la fois, si une personne précise est invitée dans Pilotage et si son compte est actif ou fermé. Impact limité (pas d'énumération de masse possible, pas de contenu métier exposé) mais réel.
- **Correction recommandée** : restreindre également le `get` à l'admin, ou à l'utilisateur cherchant son propre email (`request.auth.token.email.lower() == email`) plutôt qu'à quiconque authentifié.
- **Effort** : S
- **Dépendances éventuelles** : SEC-003 (état réel déployé inconnu) ; SEC-001 (accès non autorisé au projet Firebase qui rend cette règle atteignable en premier lieu).

## SEC-005

- **Gravité** : HAUTE
- **Fichier(s)** : `js/services/accountAdmin.js` (`isAdmin`), `js/components/adminPanel.js`
- **Problème** : la vérification `isAdmin()` (comparaison de `getCurrentUser().email` à `ADMIN_EMAIL`) est un contrôle **purement côté client** — un garde-fou d'affichage (masquer/désactiver l'UI admin), pas un contrôle d'accès. Le commentaire en tête du fichier le reconnaît lui-même ("le garde-fou côté client... par-dessus l'I/O Firestore brut"). La sécurité réelle repose entièrement sur la règle Firestore de SEC-002.
- **Risque concret** : n'importe quel utilisateur authentifié (même non-admin) peut appeler directement les fonctions exportées par `accountAdmin.js`/`firebase.js` depuis la console du navigateur (elles sont chargées comme n'importe quel module JS public) — `isAdmin()` retournerait `false` pour lui et la fonction refuserait localement, MAIS si un développeur futur ajoute une nouvelle fonction d'administration en s'appuyant uniquement sur `isAdmin()` sans règle Firestore équivalente, cette nouvelle fonctionnalité serait exploitable par n'importe qui. Le risque n'est pas dans le code actuel (chaque fonction admin actuelle est bien doublée d'une règle Firestore, sous réserve de SEC-003) mais dans le **pattern** lui-même, qui peut tromper un futur contributeur.
- **Correction recommandée** : documenter très explicitement (commentaire déjà présent, à renforcer) que `isAdmin()` ne doit JAMAIS être the seul rempart d'une nouvelle fonctionnalité admin — toute nouvelle capacité doit avoir sa propre règle Firestore. Envisager un test de non-régression (même minimal) qui échoue si une fonction touchant `users/{uid}` d'un tiers est ajoutée sans règle documentée en regard.
- **Effort** : S (documentation) / M (garde-fou automatisé)
- **Dépendances éventuelles** : SEC-002.

## SEC-006

- **Gravité** : MOYENNE
- **Fichier(s)** : `js/services/firebase.js` (`USER_DATA_COLLECTIONS`, `exportAllUserData`, `deleteAllUserData`)
- **Problème** : la liste `USER_DATA_COLLECTIONS` (14 collections) qui pilote l'export ET la suppression complète d'un compte est **maintenue à la main**, sans aucun moyen technique de la vérifier automatiquement (le commentaire du code le confirme : "AUCUN moyen, côté client Firestore, de découvrir tout seul les sous-collections existantes sous un uid"). Vérification faite pour cet audit : la liste correspond **actuellement** exactement aux 14 constantes `COLLECTION` définies dans `js/domain/*.js` — à jour à ce jour, aucune divergence trouvée.
- **Risque concret** : purement prospectif — si une future collection de données est ajoutée dans `js/domain/` sans mettre à jour cette liste, elle échapperait silencieusement à la fois à l'export (sauvegarde JSON avant suppression, incomplet sans avertissement) et à la suppression complète d'un compte (donnée orpheline qui survit à une suppression censée être totale et irréversible) — pertinent si l'app doit un jour répondre à une demande d'accès ou d'effacement de données personnelles.
- **Correction recommandée** : ajouter une vérification automatisée (même un script `node` exécuté manuellement avant chaque livraison, dans l'esprit de la vérification déjà faite pour `sw.js#APP_SHELL`) qui compare `USER_DATA_COLLECTIONS` à la liste réelle des `const COLLECTION` de `js/domain/*.js` et alerte en cas d'écart.
- **Effort** : S
- **Dépendances éventuelles** : aucune.

## SEC-007

- **Gravité** : MOYENNE
- **Fichier(s)** : `js/services/firebase.js` (`deleteAllUserData`), collection `usageEvents`, document `allowedUsers/{email}`
- **Problème** : `deleteAllUserData()` supprime les 14 collections applicatives d'un compte mais conserve **indéfiniment** ses événements d'usage (`usageEvents` — email, uid, écrans visités, horodatages) et son document `allowedUsers` (email, état fermé/ouvert, horodatage de suppression) — décision documentée comme volontaire ("conservé comme trace d'administration").
- **Risque concret** : après une suppression de compte présentée comme complète ("supprimer tout son contenu"), des données personnelles identifiantes (email, historique de connexions/écrans visités) restent stockées sans limite de durée définie. Pertinent si une demande de suppression totale (droit à l'effacement) est un jour formulée par un utilisateur ou un ancien collaborateur.
- **Correction recommandée** : définir une politique de rétention explicite pour `usageEvents` (ex. anonymisation ou purge après N mois pour un compte fermé) plutôt qu'une conservation par défaut sans limite ; documenter ce choix comme une décision produit assumée si la conservation est jugée nécessaire (traçabilité administrative).
- **Effort** : M
- **Dépendances éventuelles** : SEC-008 (même collection `usageEvents`).

## SEC-008

- **Gravité** : MOYENNE
- **Fichier(s)** : `js/services/usageTracking.js`
- **Problème** : le mode "superadmin" enregistre pour chaque compte les écrans visités, les connexions, et leur horodatage (`logView`, `logLogin`) — visible uniquement par l'admin, jamais par la personne suivie elle-même. Le fichier documente explicitement qu'un rappel factuel sur le droit du travail français en matière d'information des salariés suivis a déjà été fait à Charles-Henri, qui a choisi consciemment de ne rien afficher aux personnes suivies.
- **Risque concret** : suivi individuel de l'activité de collaborateurs sans mécanisme de transparence à leur égard. Ce point a déjà été soulevé une fois et tranché par le porteur du produit ; il est réintégré ici parce que la consigne de cet audit couvre explicitement les "données sensibles" et l'"exposition de données", et que le risque (conformité au droit du travail / CNIL, pas une vulnérabilité technique) reste réel indépendamment de la décision déjà prise. Point de vigilance, pas un avis juridique — à faire confirmer par un juriste ou l'interlocuteur RH compétent si le périmètre de suivi évolue.
- **Correction recommandée** : aucune action technique nécessaire au vu de la décision déjà actée ; ré-vérifier périodiquement que le périmètre suivi ("écrans + connexions", jamais le contenu des actions) n'a pas dérivé vers plus de détail sans nouvelle décision explicite.
- **Effort** : Non déterminé (question organisationnelle/juridique, pas technique)
- **Dépendances éventuelles** : SEC-007 (rétention des mêmes données).

## SEC-009

- **Gravité** : MOYENNE
- **Fichier(s)** : `_headers`, `index.html` (absence de configuration)
- **Problème** : aucun en-tête de sécurité HTTP n'est configuré — pas de `Content-Security-Policy`, pas de `X-Frame-Options`/`frame-ancestors`, pas de `X-Content-Type-Options: nosniff`, pas de `Referrer-Policy`, pas de `Permissions-Policy`. `_headers` ne configure que `Cache-Control` sur deux fichiers.
- **Risque concret** : absence de défense en profondeur. L'app utilise `innerHTML` dans 42 fichiers en s'appuyant sur une discipline d'échappement manuelle (voir SEC-010) : une CSP stricte (`script-src 'self' https://www.gstatic.com`, pas de `'unsafe-inline'` pour les scripts) neutraliserait l'exécution de JavaScript injecté même en cas d'oubli d'échappement. Sans `X-Frame-Options`/`frame-ancestors`, l'application (qui contient des actions destructrices — suppression de fiche, de compte) peut potentiellement être chargée dans une iframe sur un site tiers (clickjacking) ; Cloudflare Pages peut appliquer certains en-têtes par défaut à l'edge, mais cela n'a pas pu être vérifié depuis cet environnement.
- **Correction recommandée** : ajouter dans `_headers` une section `/*` avec au minimum `X-Frame-Options: DENY` (ou `Content-Security-Policy: frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, et une CSP adaptée à la liste réelle des origines utilisées par l'app (`gstatic.com` pour Firebase, polices Google si utilisées). Nécessite un test attentif après mise en place (une CSP mal calibrée peut casser le chargement des modules Firebase).
- **Effort** : M
- **Dépendances éventuelles** : aucune ; à tester soigneusement avant mise en production (risque de casser le chargement de l'app si mal configuré).

## SEC-010

- **Gravité** : MOYENNE
- **Fichier(s)** : ~90 fichiers utilisant `innerHTML` à travers `js/views/`, `js/components/`, `js/domain/`
- **Problème** : la prévention XSS repose entièrement sur une fonction `escapeHtml()` **redéfinie localement dans chaque fichier** (31 copies identiques trouvées), appliquée manuellement par chaque développeur à chaque interpolation de donnée utilisateur dans un gabarit HTML — aucune fonction centralisée, aucun système de gabarits à échappement automatique, aucune règle de lint qui détecterait une interpolation non échappée dans un `innerHTML`.
- **Risque concret** : vérification faite sur un échantillon représentatif pour cet audit (`search.js`, `tagsEditor.js`, `notesBlock.js`, `checklist.js`, `capture.js`, `historyTimeline.js`, `kanban.js`, `modal.js`) — **aucune XSS confirmée** : chaque champ de saisie libre (titre, description, notes, tags) est correctement passé par `escapeHtml()` avant interpolation dans ces fichiers. Le risque n'est donc pas une vulnérabilité déjà identifiée, mais la fragilité structurelle du mécanisme : un seul oubli, dans un seul des ~90 fichiers concernés, sur un seul champ de saisie libre, suffit à introduire une XSS stockée (par exemple via un titre de tâche, une note, un nom de tag) exécutée pour quiconque ouvre ensuite la fiche concernée. `js/components/modal.js#openModal` accepte directement une chaîne HTML brute comme corps de modale (`bodyEl.innerHTML = body`) : la sécurité de **chaque** modale de l'app dépend de la discipline de son appelant, sans garde-fou au niveau du composant partagé lui-même.
- **Correction recommandée** : (1) extraire `escapeHtml()`/`escapeAttr()` dans un module partagé unique (`js/services/` ou `js/components/`) pour éliminer la duplication et centraliser tout futur correctif ; (2) envisager à terme une fonction utilitaire de gabarit (ex. un tag de template literal `html\`...\`` qui échappe automatiquement les valeurs interpolées, sans réécrire tout le rendu existant) pour rendre l'oubli structurellement impossible plutôt que reposer sur la vigilance ; (3) en complément, la CSP de SEC-009 réduit l'impact d'un oubli futur.
- **Effort** : S (mutualiser `escapeHtml`) / L (gabarit à échappement automatique, changement transverse)
- **Dépendances éventuelles** : complémentaire de SEC-009 (CSP).

## SEC-011

- **Gravité** : MOYENNE
- **Fichier(s)** : `js/domain/tasks.js` (`createTask`, représentatif des autres `domain/*.js`), règles Firestore documentées (aucune contrainte sur `request.resource.data`)
- **Problème** : aucune validation n'est appliquée aux données avant écriture Firestore, ni côté client (`createTask` accepte `data.title`, `data.description`, etc. sans contrôle de type, de longueur ou de format — seuls des `|| valeur par défaut` gèrent l'absence de valeur, pas sa validité) ni côté règles de sécurité (les règles documentées ne contraignent que `request.auth`, jamais `request.resource.data`).
- **Risque concret** : un client compromis, un bug côté app, ou un appel direct à l'API Firestore avec un jeton valide pourrait écrire des documents de forme arbitraire (champs manquants, types inattendus, chaînes de taille excessive) sous son propre `uid`. Sans conséquence pour les autres utilisateurs (portée strictement limitée au même `uid`), mais peut casser silencieusement l'affichage ou la logique de l'app pour son propriétaire (une valeur inattendue lue plus tard par une vue qui suppose une chaîne, par exemple), ou consommer indûment de l'espace de stockage/coût Firestore via des documents anormalement volumineux (jusqu'à la limite de 1 Mio par document).
- **Correction recommandée** : ajouter des contraintes de base dans les règles Firestore (types attendus, tailles maximales raisonnables sur les champs texte) pour les collections les plus exposées (`tasks`, `inboxItems` en particulier, point d'entrée de toute capture). Compléter côté client par une validation minimale (longueur maximale sur les champs texte libres) avant l'appel à `storage.put`/`storage.update`.
- **Effort** : M
- **Dépendances éventuelles** : SEC-003 (état réel des règles).

## SEC-012

- **Gravité** : FAIBLE
- **Fichier(s)** : `js/services/draftStore.js`, `js/services/pilotageViewStore.js`, `js/services/pomodoroStore.js`, `js/services/themeStore.js`
- **Problème** : les clés `localStorage` utilisées par ces quatre modules (`pilotage-draft:*`, `pilotage-view`, `pilotage-pomodoro`, `pilotage-theme`) ne sont **pas préfixées par l'identifiant de l'utilisateur Firebase connecté** — elles sont partagées par tout le navigateur, quel que soit le compte connecté.
- **Risque concret** : sur un appareil partagé entre plusieurs personnes autorisées (poste de bureau commun, par exemple), un brouillon de saisie non enregistré (`draftStore`, pouvant contenir des informations professionnelles sensibles rédigées mais pas encore validées) rédigé par une personne resterait visible pour la personne suivante qui se connecte avec son propre compte sur le même navigateur. Risque cosmétique pour le thème/l'onglet actif, plus sérieux pour le contenu des brouillons.
- **Correction recommandée** : préfixer ces clés par l'`uid` Firebase courant (ex. `pilotage-draft:${uid}:${key}`), et prévoir un nettoyage des clés à la déconnexion (`signOutUser`).
- **Effort** : S
- **Dépendances éventuelles** : aucune.

## SEC-013

- **Gravité** : FAIBLE
- **Fichier(s)** : `js/services/firebase.js` (imports depuis `https://www.gstatic.com/firebasejs/10.12.2/...`)
- **Problème** : le SDK Firebase est chargé par import ES module direct depuis une URL CDN figée à une version précise, sans mécanisme d'intégrité (Subresource Integrity). Les imports ES modules ne supportent pas nativement l'attribut `integrity` (limitation de la plateforme web, pas une négligence du projet — celui-ci ne serait applicable qu'à une balise `<script src>` classique).
- **Risque concret** : résiduel et faible — repose sur la confiance envers l'infrastructure CDN de Google (`gstatic.com`) et sur HTTPS pour l'intégrité du contenu transporté ; le épinglage de version exacte (`10.12.2`) limite déjà le risque d'un changement de contenu inattendu à cette URL précise.
- **Correction recommandée** : aucune action à haute valeur ajoutée disponible avec ES modules natifs sans introduire un bundler (hors du choix d'architecture assumé du projet, voir README). À réévaluer seulement si le projet adopte un jour un build step.
- **Effort** : Non déterminé (dépend d'un changement d'architecture non prévu)
- **Dépendances éventuelles** : aucune.

## SEC-014

- **Gravité** : MOYENNE
- **Fichier(s)** : ensemble du dépôt (absence de configuration)
- **Problème** : aucun test automatisé, aucun linter, aucune intégration continue (confirmé dans `PROJECT_CONTEXT.md` §10) — toute vérification de non-régression, y compris sur des aspects sécurité (une règle Firestore copiée-collée avec une faute, un `escapeHtml()` oublié sur un nouveau champ, une nouvelle collection oubliée dans `USER_DATA_COLLECTIONS`), dépend entièrement de la vigilance manuelle au moment de chaque livraison.
- **Risque concret** : une régression de sécurité peut atteindre la production sans qu'aucun filet automatique ne l'intercepte avant le retour d'usage réel de Charles-Henri.
- **Correction recommandée** : introduire progressivement des vérifications automatisables et peu coûteuses en l'absence de build step : un script de vérification de cohérence `USER_DATA_COLLECTIONS`/`APP_SHELL` (voir SEC-006 et l'historique déjà documenté dans `sw.js`), et à terme un linter simple (ESLint sans configuration lourde) qui peut au moins détecter certains patterns dangereux (`innerHTML` sans passage par une fonction connue, par exemple via une règle personnalisée).
- **Effort** : M (scripts de cohérence) / L (linter avec règles personnalisées)
- **Dépendances éventuelles** : SEC-006, SEC-010.

## SEC-015

- **Gravité** : Non déterminé
- **Fichier(s)** : n/a (configuration du projet Firebase / Google Cloud, hors de ce dépôt)
- **Problème** : plusieurs protections potentielles ne sont ni confirmées ni infirmées depuis cet environnement : restriction de la clé `apiKey` Firebase par référent HTTP dans Google Cloud Console (la clé elle-même, visible dans le JavaScript livré au navigateur, est un fonctionnement normal et documenté pour une web app Firebase — ce n'est pas un secret à protéger comme une clé serveur, mais son absence de restriction élargit la surface si elle était réutilisée ailleurs) ; politique de mot de passe et présence ou non d'une double authentification (MFA) pour les comptes email/mot de passe créés manuellement dans Firebase Authentication ; restriction éventuelle du fournisseur Google Sign-In à un domaine particulier.
- **Risque concret** : Non déterminé — dépend entièrement de la configuration du projet Firebase, non accessible depuis cet environnement.
- **Correction recommandée** : vérifier dans Google Cloud Console (API Firebase → Identifiants) que la clé est restreinte aux origines HTTP attendues (le domaine Cloudflare Pages) ; vérifier dans Firebase Authentication si une politique de mot de passe minimale et/ou une MFA peuvent être activées pour les comptes email/mot de passe.
- **Effort** : S (vérification)
- **Dépendances éventuelles** : aucune.

---

## Synthèse — répartition par gravité

- **CRITIQUE** : SEC-001, SEC-002 — toutes deux liées aux règles Firestore documentées pour `users/{uid}/**` ; à traiter en priorité, sous réserve de confirmer d'abord l'état réellement déployé (SEC-003).
- **HAUTE** : SEC-003, SEC-005
- **MOYENNE** : SEC-004, SEC-006, SEC-007, SEC-008, SEC-009, SEC-010, SEC-011, SEC-014
- **FAIBLE** : SEC-012, SEC-013
- **Non déterminé** : SEC-015

**Premier pas recommandé, avant tout le reste** : SEC-003 (vérifier dans la console Firebase l'état réellement déployé des règles). Tous les constats CRITIQUE et HAUTE de ce rapport en dépendent — un audit de sécurité Firestore qui ne peut pas lire les règles réellement en place reste, par construction, incomplet.
