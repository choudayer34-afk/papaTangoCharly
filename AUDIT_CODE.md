# AUDIT_CODE.md — Pilotage (papaTangoCharly)

Compilation des problèmes identifiés au fil des revues de code menées dans cette conversation (audit "anomalies d'usage ou d'enregistrement en silence", audit "performance hors-ligne", audit "usage hors-ligne", retour direct de Charles-Henri sur le changement de type, nettoyage de dépôt). Document rétrospectif : la quasi-totalité de ces problèmes ont déjà été corrigés et livrés (patches indiqués dans "Correction recommandée") ; les exceptions sont signalées explicitement.

_Compilé le 15/09/2026, sans nouvelle analyse de code — uniquement à partir des résultats déjà obtenus dans cette conversation._

---

## CODE-001

- **Gravité** : MOYENNE
- **Fichier(s)** : `js/domain/inbox.js`
- **Fonction/composant** : `subscribePending`, `subscribeKept`, `subscribeKeptIncludingArchived`
- **Problème** : trois abonnements Firestore `onSnapshot` indépendants ouverts en parallèle sur la même collection `inboxItems` dès que plusieurs vues Inbox étaient affichées.
- **Conséquence** : trafic réseau et charge Firestore inutilement multipliés par 3 sur l'un des écrans les plus consultés de l'app.
- **Correction recommandée** : déjà corrigée (patch 0050) — un flux partagé unique (`subscribeFiltered`), filtré en mémoire par consommateur, avec compteur de référence.
- **Effort** : M
- **Dépendances éventuelles** : aucune

## CODE-002

- **Gravité** : MOYENNE
- **Fichier(s)** : `js/views/kanban.js`, `js/views/resources.js`, `js/views/people.js`, `js/views/prompts.js` (×2 champs), `js/views/guide.js`, `js/components/linkedItems.js`
- **Fonction/composant** : handlers `input` des 7 champs de recherche
- **Problème** : aucun anti-rebond (debounce) — chaque frappe clavier relançait immédiatement un filtrage complet.
- **Conséquence** : ralentissements perceptibles à la frappe, surtout sur de grosses listes ou un appareil peu puissant.
- **Correction recommandée** : déjà corrigée (patch 0050) — anti-rebond de 150 ms ajouté sur les 7 champs.
- **Effort** : S
- **Dépendances éventuelles** : aucune

## CODE-003

- **Gravité** : MOYENNE
- **Fichier(s)** : `js/views/kanban.js` (`openTaskDetail`), `js/views/resources.js` (`openResourceDetail`), `js/views/people.js` (`openPersonDetail`), `js/views/projects.js` (`openProjectDetail`), `js/domain/history.js`, `js/services/storage.js`
- **Fonction/composant** : chargement de l'historique affiché sur une fiche
- **Problème** : chaque ouverture de fiche rechargeait l'intégralité de l'historique de l'application (`historyApi.listAll()`) pour n'en garder que les quelques lignes concernant l'entité affichée.
- **Conséquence** : temps d'ouverture de fiche dégradé à mesure que l'historique global grossit, indépendamment de la taille réelle de l'historique de l'entité concernée.
- **Correction recommandée** : déjà corrigée (patch 0050) — requêtes ciblées `listForEntity`/`listForEntities` (`history.js`) et `storage.js#listWhere` (égalités pures, sans risque d'index composite).
- **Effort** : M
- **Dépendances éventuelles** : aucune

## CODE-004

- **Gravité** : FAIBLE
- **Fichier(s)** : `js/views/dashboard.js`
- **Fonction/composant** : `openGlobalHistory`
- **Problème** : chargeait tout l'historique puis triait/tronquait en mémoire côté client.
- **Conséquence** : transfert de données inutile, proportionnel à la taille totale de l'historique plutôt qu'aux 100 lignes réellement affichées.
- **Correction recommandée** : déjà corrigée (patch 0050) — `historyApi.listRecent(100)`, tri et limite appliqués côté Firestore (`orderBy`+`limit`, sans risque d'index composite).
- **Effort** : S
- **Dépendances éventuelles** : aucune

## CODE-005

- **Gravité** : MOYENNE
- **Fichier(s)** : `js/components/search.js`
- **Fonction/composant** : `runSearch` (devenu `loadSearchBundle`/`filterBundle`)
- **Problème** : la recherche globale relançait ses ~10 requêtes Firestore à chaque frappe clavier au lieu de filtrer des données déjà chargées.
- **Conséquence** : latence de frappe et charge Firestore inutile sur une fonctionnalité transverse utilisée fréquemment.
- **Correction recommandée** : déjà corrigée (patch 0050) — chargement unique à l'ouverture de la modale, filtrage en mémoire ensuite (anti-rebond 150 ms).
- **Effort** : M
- **Dépendances éventuelles** : aucune

## CODE-006

- **Gravité** : FAIBLE
- **Fichier(s)** : `js/views/kanban.js`
- **Fonction/composant** : `openCreateTaskModal`
- **Problème** : appelle systématiquement `projectsApi.listAll()` au lieu de réutiliser la variable `latestProjects` déjà chargée par la vue Kanban.
- **Conséquence** : requête Firestore redondante à chaque ouverture du formulaire de création de tâche — impact réel faible, la collection Projets étant petite.
- **Correction recommandée** : non appliquée intentionnellement — `openCreateTaskModal` est un export de haut niveau appelé aussi hors contexte Kanban (fiche Projet, `linkedItems.js`), sans accès à `latestProjects` (scopé à la closure de `renderKanban()`). Un cache correct nécessiterait une invalidation propre (architecture de cache module-level), jugée disproportionnée pour un gain marginal. À reconsidérer seulement si la collection Projets grossit significativement.
- **Effort** : M (si appliqué)
- **Dépendances éventuelles** : nécessiterait un mécanisme de cache/invalidation partagé, actuellement inexistant dans l'app.

## CODE-007

- **Gravité** : FAIBLE
- **Fichier(s)** : `js/domain/tasks.js`, `js/services/storage.js`, `js/views/kanban.js`
- **Fonction/composant** : `tasksApi.subscribe`, `renderTableView#sortRows`
- **Problème** : piste d'optimisation envisagée (désactiver le tri systématique appliqué par `storage.js#subscribe`) pour éviter un tri redondant côté Kanban, qui re-trie déjà par échéance dans sa vue Tableau.
- **Conséquence** : aucune actuellement — piste **non appliquée** après vérification : `renderTableView#sortRows` retourne les lignes dans leur ordre reçu quand aucune colonne de tri n'est active, donc supprimer le tri par défaut aurait changé silencieusement l'ordre d'affichage par défaut de la vue Tableau (régression réelle évitée).
- **Correction recommandée** : aucune action — l'option `{ sort: false }` a été ajoutée à `storage.js`/`tasks.js` comme infrastructure disponible mais **non utilisée**, avec un commentaire expliquant pourquoi elle n'est pas branchée sur Kanban. Ne pas l'activer sans revoir `sortRows`.
- **Effort** : Non déterminé (dépend de la refonte éventuelle de `sortRows`)
- **Dépendances éventuelles** : `renderTableView#sortRows`

## CODE-008

- **Gravité** : FAIBLE
- **Fichier(s)** : `js/services/firebase.js` (ou équivalent — lecture de `usageEvents`), `js/services/usageTracking.js`
- **Fonction/composant** : `listUsageEvents`, `computeUsageStats`
- **Problème** : la collection `usageEvents` (panneau de statistiques admin) n'est pas bornée, contrairement à `history.js`.
- **Conséquence** : la requête grossit indéfiniment avec le temps ; risque de dégradation de performance à long terme sur cet écran admin.
- **Correction recommandée** : intentionnellement non bornée — `computeUsageStats` rapporte `totalEvents`/`since` comme statistiques agrégées sur toute la durée de vie du compte ; borner la requête sous-jacente produirait des statistiques inexactes, jugé pire que le compromis actuel. Si le volume devient un problème, envisager une agrégation pré-calculée (compteur incrémental) plutôt qu'un simple `limit()`.
- **Effort** : L (si une agrégation pré-calculée est mise en place)
- **Dépendances éventuelles** : changement de modèle de données (compteurs agrégés), pas seulement de requête.

## CODE-009

- **Gravité** : MOYENNE
- **Fichier(s)** : ensemble de l'application (aucun fichier ne gérait `navigator.onLine`/`online`/`offline`)
- **Fonction/composant** : absence de module dédié
- **Problème** : aucun indicateur visible pour l'utilisateur lorsque l'appareil perd sa connexion réseau.
- **Conséquence** : usage hors-ligne "silencieux" — impossible de savoir si l'app fonctionne normalement ou si des actions restent en attente.
- **Correction recommandée** : déjà corrigée (patch 0051) — nouveau module `js/services/onlineStatus.js` + bandeau visible dans `js/app.js`.
- **Effort** : M
- **Dépendances éventuelles** : base pour CODE-010.

## CODE-010

- **Gravité** : HAUTE
- **Fichier(s)** : `js/components/modal.js`
- **Fonction/composant** : action de bouton avec `closesModal: false`, `guardClick`
- **Problème** : les écritures Firestore (`setDoc`/`addDoc`/`updateDoc`/`deleteDoc`) ne se résolvent qu'une fois confirmées par le serveur ; hors-ligne, elles restent en attente indéfiniment sans qu'aucun message n'explique pourquoi le bouton reste désactivé.
- **Conséquence** : un utilisateur hors-ligne peut croire l'application plantée ou bloquée sur une action pourtant déjà enregistrée localement.
- **Correction recommandée** : déjà corrigée (patch 0051) — message explicite ("sera enregistré au retour de la connexion") affiché après 2,5 s d'attente hors-ligne.
- **Effort** : S
- **Dépendances éventuelles** : dépend de CODE-009 (`onlineStatus.js`).

## CODE-011

- **Gravité** : HAUTE
- **Fichier(s)** : `js/components/modal.js`
- **Fonction/composant** : `confirmDelete`
- **Problème** : le bouton "Supprimer" refermait la modale au moment même du clic (branche par défaut : `onClick` déclenché sans attente puis fermeture immédiate), sans attendre la fin réelle de la suppression.
- **Conséquence** : l'utilisateur perd toute visibilité sur l'issue réelle de la suppression (succès/échec) dès l'instant du clic.
- **Correction recommandée** : déjà corrigée (patch 0051) — réécrit avec `closesModal: false`, la fermeture n'intervient qu'après résolution de `onConfirm()`.
- **Effort** : S
- **Dépendances éventuelles** : a révélé CODE-012.

## CODE-012

- **Gravité** : HAUTE
- **Fichier(s)** : `js/components/modal.js`, `js/components/adminPanel.js`
- **Fonction/composant** : `confirmDelete` (cas de suppression d'un tag depuis l'administration)
- **Problème** : découvert en corrigeant CODE-011 — utiliser la fonction globale `closeModal()` après un `onConfirm` qui rouvre lui-même une nouvelle modale (ex. `openTagsAdminModal()`) aurait fermé par erreur cette **nouvelle** modale au lieu de celle sur laquelle le clic avait eu lieu (`closeModal()` opère toujours sur la modale actuellement active, réassignée dès qu'une nouvelle modale s'ouvre).
- **Conséquence** : fermeture erronée d'une fenêtre que l'utilisateur vient tout juste d'ouvrir, sans lien avec son clic initial — perte de contexte confuse.
- **Correction recommandée** : déjà corrigée (même patch 0051) — utilisation de la fonction `close` spécifique à l'instance de modale (retournée par `openModal()`, protégée par un flag privé `closed`) plutôt que la fonction globale `closeModal()`. Vérifié par un test Playwright dédié à ce scénario précis.
- **Effort** : S
- **Dépendances éventuelles** : dépend du correctif CODE-011 (même fichier, même passage).

## CODE-013

- **Gravité** : HAUTE
- **Fichier(s)** : `sw.js`
- **Fonction/composant** : listener `install`
- **Problème** : `cache.addAll(APP_SHELL)` est atomique — un seul fichier en échec (404, coupure réseau ponctuelle pendant un déploiement) faisait échouer l'installation entière du Service Worker, sans aucun message.
- **Conséquence** : aucun précache créé pour la version concernée, pour **tous** les utilisateurs installant ou mettant à jour l'app à ce moment — silencieux, donc difficile à détecter côté exploitation.
- **Correction recommandée** : déjà corrigée (patch 0052) — chaque fichier mis en cache individuellement via `Promise.allSettled`, échec isolé journalisé (`console.error`) sans bloquer les ~90 autres fichiers.
- **Effort** : S
- **Dépendances éventuelles** : aucune

## CODE-014

- **Gravité** : FAIBLE
- **Fichier(s)** : `sw.js`, `manifest.json`, `index.html`
- **Fonction/composant** : liste `APP_SHELL`
- **Problème** : les icônes de l'app (`icon-192.png`, `icon-192-maskable.png`, `icon-512.png`), référencées par `manifest.json`/`index.html`/notifications, n'étaient jamais précachées.
- **Conséquence** : icône cassée pour un utilisateur passé hors-ligne avant le premier chargement de ces fichiers par le navigateur — purement cosmétique.
- **Correction recommandée** : déjà corrigée (patch 0052) — icônes ajoutées à `APP_SHELL`.
- **Effort** : S
- **Dépendances éventuelles** : aucune

## CODE-015

- **Gravité** : FAIBLE
- **Fichier(s)** : `sw.js`, `js/services/storage-local.js`
- **Fonction/composant** : liste `APP_SHELL`
- **Problème** : `js/services/storage-local.js` (implémentation IndexedDB de référence, non utilisée en production) restait précaché par le Service Worker.
- **Conséquence** : poids de précache inutile ; contribuait au risque décrit en CODE-013 si ce fichier venait à disparaître du dépôt.
- **Correction recommandée** : déjà corrigée (patch 0052) — retiré de `APP_SHELL`. Le fichier reste dans le dépôt à titre de référence (voir README.md), simplement plus chargé par le Service Worker.
- **Effort** : S
- **Dépendances éventuelles** : aucune

## CODE-016

- **Gravité** : FAIBLE
- **Fichier(s)** : `js/views/login.js`
- **Fonction/composant** : `friendlyError`
- **Problème** : une première connexion hors-ligne (aucune session Firebase mise en cache sur l'appareil) affichait le texte brut anglais de Firebase (`Firebase: Error (auth/network-request-failed).`).
- **Conséquence** : message incompréhensible pour l'utilisateur, qui ne peut pas savoir que le problème vient simplement de l'absence de réseau lors d'une première connexion.
- **Correction recommandée** : déjà corrigée (patch 0053) — message explicite en français.
- **Effort** : S
- **Dépendances éventuelles** : aucune

## CODE-017

- **Gravité** : HAUTE
- **Fichier(s)** : `js/components/changeType.js`
- **Fonction/composant** : action "Convertir" de "🔁 Changer de type"
- **Problème** : retour direct de Charles-Henri — après une conversion réussie (Tâche ↔ Suivi ↔ Information/Idée), la modale se refermait simplement au lieu d'ouvrir la fiche convertie.
- **Conséquence** : l'utilisateur doit retrouver lui-même la fiche qu'il vient de convertir dans la bonne vue — charge mentale et perte de temps à chaque conversion.
- **Correction recommandée** : déjà corrigée (patch 0049) — réutilise `fetchBundle()`/`resolveRef()` (`js/components/linkedItems.js`), déjà utilisés ailleurs pour ce même besoin (historique global, deep links), pour rouvrir directement la fiche cible. Repli silencieux sur le comportement précédent en cas d'échec de résolution.
- **Effort** : S
- **Dépendances éventuelles** : réutilise l'infrastructure `linkedItems.js` (aucune modification de celle-ci nécessaire).

## CODE-018

- **Gravité** : CRITIQUE
- **Fichier(s)** : `js/domain/convert.js`
- **Fonction/composant** : fonctions `convertXToY` (Tâche ↔ Suivi ↔ Information/Idée)
- **Problème** : convertir une fiche vers un autre type effaçait silencieusement les sous-étapes cochables (checklist) et le journal de notes déjà pris — seuls le titre, la description, le projet et l'échéance survivaient.
- **Conséquence** : perte de travail déjà effectué (notes, sous-étapes) sans aucun avertissement au moment de la conversion — perte de données silencieuse, l'un des scénarios les plus graves pour un outil dont la promesse centrale est "ne rien perdre".
- **Correction recommandée** : déjà corrigée (patch 0027) — sous-étapes et notes suivent désormais la conversion (une Information/Idée n'ayant pas de sous-étapes, seules les notes la suivent dans ce cas). Tags et éléments liés (🔗) restent volontairement orphelins après conversion (limitation documentée, pas un bug).
- **Effort** : M
- **Dépendances éventuelles** : aucune

## CODE-019

- **Gravité** : HAUTE
- **Fichier(s)** : composants de sous-étapes de checklist, journal de notes, mini-formulaires "+ Nouveau projet" (fiche Personne), ajout de sous-partie de projet, ajout de point de suivi d'objectif, association de réunion Outlook, sélecteur "🔗 Lier une fiche" (8 points au total, hors création de fiche déjà couverte)
- **Fonction/composant** : boutons "+" divers à l'intérieur d'une fiche déjà ouverte
- **Problème** : absence de garde anti-double-clic — un double-clic ou un Entrée suivi d'un clic rapproché créait deux fois le même élément.
- **Conséquence** : sous-étapes, notes, sous-parties de projet ou liens dupliqués silencieusement.
- **Correction recommandée** : déjà corrigée (patch 0028) — chaque bouton concerné se désactive désormais le temps de l'enregistrement, généralisant le pattern déjà en place pour la création de fiches.
- **Effort** : M
- **Dépendances éventuelles** : généralise un pattern déjà existant (pas de nouvelle infrastructure).

## CODE-020

- **Gravité** : MOYENNE
- **Fichier(s)** : `js/views/dashboard.js` (compteurs "⚠️ Ça a besoin de toi" / file Focus)
- **Fonction/composant** : logique d'agrégation des tâches/suivis urgents
- **Problème** : une tâche à la fois "échéance proche" et "en pause depuis 5 jours" était comptée deux fois.
- **Conséquence** : compteur "Ça a besoin de toi" faussé (surestimé), nuisant à la confiance dans l'indicateur central de priorisation quotidienne de l'app.
- **Correction recommandée** : déjà corrigée (patch 0029) — une seule entrée par tâche/suivi, urgence la plus forte conservée.
- **Effort** : S
- **Dépendances éventuelles** : aucune

## CODE-021

- **Gravité** : CRITIQUE
- **Fichier(s)** : `js/services/storage.js`, et ~53 fonctions dans `preferences.js`, `tasks.js`, `followups.js`, `projects.js`, `decisions.js`, `people.js`, `resources.js`, `meetings.js`, `objectives.js`, `inbox.js`, `prompts.js`
- **Fonction/composant** : ensemble des fonctions de mutation lecture-modification-écriture sur un document Firestore
- **Problème** : aucune sérialisation des écritures — deux modifications rapprochées sur la même fiche (deux réglages, deux ajouts) pouvaient s'écraser silencieusement l'une l'autre (race condition classique read-modify-write).
- **Conséquence** : perte silencieuse d'une modification utilisateur, potentiellement invisible pendant longtemps (aucune erreur, aucun message) — l'un des risques les plus structurants identifiés dans l'audit "anomalies silencieuses".
- **Correction recommandée** : déjà corrigée (patch 0030) — nouvelle fonction `storage.update(collection, id, mutate)` qui met en file d'attente les écritures sur un même document ; les ~53 fonctions concernées converties pour l'utiliser.
- **Effort** : L
- **Dépendances éventuelles** : correctif transverse dont dépendent implicitement toutes les fonctions de mutation listées.

## CODE-022

- **Gravité** : HAUTE
- **Fichier(s)** : `js/domain/tasks.js`, `js/domain/followups.js`, `js/domain/projectHealth.js`, `js/domain/priorisation.js`, `js/views/dashboard.js`, `js/views/kanban.js`, `js/components/weeklyReview.js`
- **Fonction/composant** : calculs de "jours avant/après échéance" dispersés dans chaque fichier
- **Problème** : chaque endroit calculait indépendamment "combien de jours avant/après aujourd'hui", avec des différences de traitement du fuseau horaire.
- **Conséquence** : bug vérifié en le reproduisant (`TZ=America/New_York`) — une tâche due "aujourd'hui" pouvait être affichée "🔴 En retard" par le Dashboard tout en étant correcte au même instant dans la Matrice de priorisation ; incohérence direct entre écrans consultés côte à côte.
- **Correction recommandée** : déjà corrigée (patch 0031) — nouveau fichier `js/services/dateUtils.js`, source unique de vérité, réutilisé par tous les fichiers listés.
- **Effort** : M
- **Dépendances éventuelles** : aucune (nouveau module autonome)

## CODE-023

- **Gravité** : HAUTE
- **Fichier(s)** : `js/services/storage.js` (`subscribe`), `js/app.js` (vérification liste blanche au démarrage), `js/services/shortcuts.js`
- **Fonction/composant** : gestion des échecs techniques
- **Problème** : trois échecs techniques distincts ne produisaient aucun signal utilisateur : erreur silencieuse si le flux temps réel Firestore tombe en erreur ; écran intégralement blanc si la vérification de la liste blanche (`isEmailAllowed`) échoue au démarrage (coupure réseau ou erreur Firestore) ; bouton de raccourci clavier (`Ctrl+Alt`) pouvant rester bloqué indéfiniment après un échec réseau.
- **Conséquence** : dans les trois cas, l'utilisateur authentifié ne sait pas s'il doit patienter, recharger, ou si l'application est simplement cassée — contraire au principe central du projet ("le système doit aider, pas ajouter de charge mentale").
- **Correction recommandée** : déjà corrigée (patch 0032) — toast + `console.error` sur échec du flux Firestore ; écran dédié `renderAuthError` (distinct de `renderRestricted`) avec bouton "🔄 Réessayer" ; retour à un état de bouton normal pour les raccourcis clavier après échec.
- **Effort** : M
- **Dépendances éventuelles** : aucune

## CODE-024

- **Gravité** : MOYENNE
- **Fichier(s)** : `js/domain/inbox.js`
- **Fonction/composant** : `autoArchiveStaleKept`, `qualify()`
- **Problème** : l'archivage automatique après 15 jours d'une Information/Idée ("Kept") se basait sur `item.createdAt` (date de capture brute d'origine) plutôt que sur le moment où l'élément a été qualifié comme tel.
- **Conséquence** : une capture qualifiée en "Kept" longtemps après sa création initiale dans l'Inbox pouvait être auto-archivée dès le balayage suivant, sans avoir eu le temps d'être réellement conservée.
- **Correction recommandée** : déjà corrigée (patch 0033) — nouveau champ `keptAt` posé par `qualify()`, utilisé par `autoArchiveStaleKept`.
- **Effort** : S
- **Dépendances éventuelles** : aucune

## CODE-025

- **Gravité** : FAIBLE
- **Fichier(s)** : `js/domain/history.js`
- **Fonction/composant** : `ACTION_META`
- **Problème** : libellés manquants pour des actions pourtant déjà journalisées par `convert.js` (conversions), `inbox.js` (texte corrigé, projet rattaché) et `tags.js` (tag ajouté/retiré, y compris pour "Kept" et "Objective").
- **Conséquence** : ces événements existaient déjà dans l'historique mais s'affichaient avec un libellé générique, réduisant la valeur de la fonctionnalité "retrouver ce qui a été décidé".
- **Correction recommandée** : déjà corrigée (patch 0033) — libellés ajoutés à `ACTION_META`.
- **Effort** : S
- **Dépendances éventuelles** : aucune

## CODE-026

- **Gravité** : MOYENNE
- **Fichier(s)** : `js/domain/projects.js` (`addPart`, `updatePartStatus`, `removePart`), `js/domain/tasks.js` (`addOutlookMeeting`, `removeOutlookMeeting`)
- **Fonction/composant** : mutateurs de sous-parties de projet et de rattachement de réunions Outlook
- **Problème** : aucune journalisation dans l'historique, contrairement à `addNote()` sur ces mêmes entités.
- **Conséquence** : trou dans la mémoire/traçabilité du projet — ces actions ne sont pas retrouvables via l'historique alors que d'autres actions comparables le sont.
- **Correction recommandée** : déjà corrigée (patch 0033) — journalisation ajoutée pour les deux familles d'actions.
- **Effort** : S
- **Dépendances éventuelles** : aucune

## CODE-027

- **Gravité** : FAIBLE
- **Fichier(s)** : `js/domain/decisions.js`
- **Fonction/composant** : `removeGrid()`
- **Problème** : journalisait un événement "grid_removed" dans l'historique même quand aucune grille de décision n'avait jamais existé sur la décision concernée.
- **Conséquence** : bruit dans l'historique — événement trompeur suggérant une suppression réelle là où il n'y avait rien à supprimer.
- **Correction recommandée** : déjà corrigée (patch 0033) — gardé par une vérification préalable de l'existence de la grille.
- **Effort** : S
- **Dépendances éventuelles** : aucune

## CODE-028

- **Gravité** : FAIBLE
- **Fichier(s)** : `icons/a.txt`, `js/a.txt`, `js/domain/a.txt`, `js/services/a.txt`, `js/views/a.txt`, `styles/a.txt`
- **Fonction/composant** : aucun (fichiers placeholder)
- **Problème** : six fichiers d'1 octet nommés `a.txt`, artefacts classiques de l'interface web GitHub pour committer un dossier autrement vide — chaque dossier concerné contient désormais de vrais fichiers, rendant ces placeholders obsolètes.
- **Conséquence** : aucune fonctionnelle (fichiers non référencés dans le code) — clutter du dépôt uniquement.
- **Correction recommandée** : déjà corrigée (patch 0055) — fichiers supprimés après vérification qu'ils n'étaient référencés nulle part.
- **Effort** : S
- **Dépendances éventuelles** : aucune

---

## Synthèse — meilleur ratio impact / effort

Classement des corrections par rapport bénéfice/coût, du meilleur au moins bon, tous statuts confondus (l'écrasante majorité est déjà livrée ; les trois exceptions non appliquées sont signalées) :

1. **CODE-018** (perte silencieuse de notes/checklist à la conversion) — effort M, impact CRITIQUE. Le meilleur ratio du lot : un risque de perte de données réelle corrigé pour un effort modéré. *(fait, patch 0027)*
2. **CODE-021** (sérialisation des écritures) — effort L, impact CRITIQUE. Effort plus élevé mais correctif transverse éliminant une classe entière de bugs silencieux plutôt qu'un cas isolé. *(fait, patch 0030)*
3. **CODE-011 / CODE-012** (confirmDelete + fenêtre imbriquée) — effort S chacun, impact HAUTE. Deux corrections quasi gratuites pour un gain de fiabilité perçue important sur une action irréversible (suppression). *(fait, patch 0051)*
4. **CODE-013** (installation résiliente du Service Worker) — effort S, impact HAUTE. Un seul `Promise.allSettled` élimine un risque d'échec total silencieux pour tous les utilisateurs. *(fait, patch 0052)*
5. **CODE-017** (rouvrir la fiche convertie) — effort S, impact HAUTE (charge mentale directement citée par Charles-Henri). *(fait, patch 0049)*
6. **CODE-020** (dédoublonnage des compteurs urgents) — effort S, impact MOYENNE sur un indicateur central de l'app (fiabilité perçue du tableau de bord). *(fait, patch 0029)*
7. **CODE-022** (unification du calcul de dates) — effort M, impact HAUTE : élimine une incohérence visible entre écrans, pour un module autonome sans dépendance. *(fait, patch 0031)*
8. **CODE-006 / CODE-007** (optimisations Kanban non appliquées) — effort M chacune si appliquées, impact FAIBLE isolément. Ratio défavorable : laissées de côté à raison, à ne reconsidérer que si le volume de données change significativement. *(non fait, volontairement)*
