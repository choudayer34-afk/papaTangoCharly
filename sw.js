// Service worker — app-shell versionné. Navigation (index.html) : network-first avec repli
// cache, pour toujours détecter une nouvelle version au plus tôt. Tous les autres fichiers
// (scripts, styles) : cache-first avec rafraîchissement réseau en tâche de fond, puisqu'ils sont
// déjà précachés à l'installation et versionnés via `CACHE_NAME` — voir le commentaire détaillé
// sur "fetch" plus bas (vague 22 novies) pour le raisonnement complet.
// Pattern repris d'EnVie (§56/§57 : réutiliser l'existant avant de recréer).

// Correctif (13/09/2026, audit de reprise après l'incident MIME "text/html" du 09/09) :
// `APP_SHELL` avait pris du retard sur l'arborescence réelle — 10 fichiers existants
// (storage-local.js, usageTracking.js, priorisation.js, workload.js, projectHealth.js dans
// leurs 2-3 dossiers) n'y figuraient pas, exactement la classe de bug déjà documentée plus bas
// (vague 22 septies). Sans effet visible tant que le réseau répond, mais un fichier absent du
// précache et jamais encore récupéré avec succès reste vulnérable à un aller-réseau raté au
// chargement — reconstitué ici par comparaison exhaustive de `find js -name "*.js"` contre
// cette liste. `CACHE_NAME` incrémenté en conséquence pour forcer la reconstruction du cache
// chez tout le monde.
// Correctif (13/09/2026, suite) : nouveau fichier js/views/followupsOverview.js (vue "👀
// Suivis") ajouté à APP_SHELL dès sa création, cette fois-ci — pour ne pas reproduire l'oubli
// documenté juste au-dessus.
// Correctif (13/09/2026, suite — mode sombre) : nouveau fichier js/services/themeStore.js
// ajouté à APP_SHELL dès sa création, même principe que ci-dessus.
// Correctif (13/09/2026, suite — tags universels) : deux nouveaux fichiers,
// js/domain/tags.js et js/components/tagsEditor.js, ajoutés à APP_SHELL dès leur création,
// même principe que ci-dessus.
// Correctif (14/09/2026, suite — détection de mise à jour) : `js/app.js` recharge désormais tout
// seul la page dès qu'une nouvelle version prend le contrôle (voir le commentaire détaillé dans ce
// fichier) — `CACHE_NAME` incrémenté puisque le contenu de ce fichier précaché a changé.
//
// Correctif (14/09/2026, suite — "la mise à jour automatique ne marche pas du tout") : la
// détection ci-dessus repose entièrement sur le fait que CE FICHIER (`sw.js`) change d'un octet —
// c'est la seule chose que le navigateur compare lors d'un `registration.update()` (voir
// `js/app.js`). Or les deux vagues précédentes (recherche Trello/Tableau, autocomplétion en
// modification en masse) n'avaient touché QUE des fichiers applicatifs (`js/views/kanban.js`
// notamment) sans toucher `sw.js` ni `CACHE_NAME` — jugé inutile à l'époque puisqu'aucun nouveau
// fichier n'était créé. Résultat : le navigateur ne voyait STRICTEMENT AUCUNE différence sur ce
// fichier, donc aucune nouvelle version de service worker n'était jamais installée, donc
// `controllerchange` ne se déclenchait jamais, donc ni toast ni rechargement — le mécanisme entier
// restait silencieux, exactement le symptôme "rien du tout ne se passe" remonté par Charles-Henri.
// Le rafraîchissement cache-first en tâche de fond (voir "fetch" plus bas) finissait certes par
// mettre à jour le contenu réel en coulisses, mais sans jamais le signaler ni le charger tant que
// l'app n'était pas fermée et rouverte plusieurs fois de suite.
// `CACHE_NAME` incrémenté ici pour donner enfin au mécanisme une vraie différence à détecter — et,
// point important pour la suite : cette ligne sera désormais incrémentée à CHAQUE vague qui modifie
// ne serait-ce qu'un seul fichier précaché (`APP_SHELL` plus bas), fichier nouveau ou non, pour que
// la détection de mise à jour fonctionne vraiment à chaque livraison plutôt que par exception.
//
// Correctif (14/09/2026, suite — administration des comptes) : nouveau fichier
// js/services/accountAdmin.js ajouté à APP_SHELL dès sa création, comme la règle ci-dessus
// l'impose désormais systématiquement.
//
// Correctif (15/09/2026, suite — date de contrôle non supprimable + suivi dupliqué) :
// js/domain/followups.js et js/components/modal.js modifiés (tous deux déjà précachés), comme
// la règle ci-dessus l'impose systématiquement dès qu'un fichier précaché change de contenu.
//
// Correctif (15/09/2026, suite — checklist/notes perdues lors d'un changement de type) :
// js/domain/convert.js, tasks.js, followups.js, inbox.js et js/components/changeType.js modifiés
// (tous déjà précachés).
//
// Correctif (15/09/2026, suite — audit "anomalies silencieuses" : généralisation de la garde
// anti-double-clic) : le correctif du 15/09 sur `openModal()` (ci-dessus) ne protégeait que les
// boutons ouverts via une modale. Or plusieurs boutons d'ajout vivent DANS une fiche déjà ouverte
// et ne passent jamais par `openModal()` : "+" sous-étape (checklist), "+ Ajouter la note"
// (notesBlock), "+" sous-partie de projet, rattachement d'une réunion Outlook, création rapide
// de projet depuis un Suivi (×2 : création et modification), sélection d'un élément à lier. Un
// double-clic ou un clic suivi d'un Entrée rapproché pouvait donc y créer deux fois le même
// élément avant que le premier appel asynchrone ne soit terminé — silencieusement, sans erreur
// visible. Nouvelle fonction partagée `guardClick()` ajoutée à `js/components/modal.js`
// (même principe que la garde de `openModal()`, généralisée à n'importe quel bouton) et appliquée
// aux 8 boutons ci-dessus dans `js/components/checklist.js`, `notesBlock.js`, `linkedItems.js`,
// `js/views/people.js` (×3), `js/views/projects.js` et `js/views/kanban.js`. `CACHE_NAME`
// incrémenté puisque tous ces fichiers sont précachés.
//
// Correctif (15/09/2026, suite — audit "anomalies silencieuses" : doublons dans "Ça a besoin de
// toi" / Focus) : `js/views/dashboard.js#renderNeedsAttentionSection()` et `#computeFocusQueue()`
// fusionnaient plusieurs catégories (Suivi en retard, échéance proche, tâche à l'arrêt, tâche en
// retard, tâche due aujourd'hui) sans dédoublonner — une même Tâche pouvant matcher deux
// catégories à la fois (ex. échéance proche ET à l'arrêt, ces deux critères étant indépendants),
// elle apparaissait deux fois dans la liste et faussait le compteur affiché en titre, sans le
// moindre signe visible du problème. Nouvelle fonction `dedupeByEntity()` qui ne garde qu'une
// entrée par (type d'entité, id), la plus urgente des deux si duplication il y a. `CACHE_NAME`
// incrémenté puisque `js/views/dashboard.js` est précaché.
//
// Correctif (15/09/2026, suite — audit "anomalies silencieuses" : course lecture-modification-
// écriture) : chaque `js/domain/*.js` modifie un document existant en le relisant (`get()`) puis
// en le réécrivant en entier (`put()`) avec le patch calculé dessus — schéma non atomique. Deux
// telles séquences sur le MÊME document (le plus exposé : `js/domain/preferences.js`, un
// document UNIQUE partagé par toute l'app — casquette, sections masquées, raccourcis...) pouvaient
// s'écraser silencieusement l'une l'autre si elles se chevauchaient à quelques millisecondes
// d'intervalle : la seconde lisait l'état d'avant la première et réécrivait par-dessus, perdant
// le premier changement sans la moindre erreur visible. Nouvelle fonction `storage.update()`
// (js/services/storage.js et son miroir storage-local.js) qui sérialise ces séquences par
// document — un appel ne commence sa lecture qu'une fois l'écriture du précédent appel sur ce
// même document terminée. Utilisée désormais par toutes les fonctions de lecture-modification-
// écriture de `js/domain/preferences.js` (~25 réglages), `tasks.js`, `followups.js`,
// `projects.js`, `decisions.js`, `people.js`, `resources.js`, `meetings.js`, `objectives.js`,
// `inbox.js` et `prompts.js`. `CACHE_NAME` incrémenté puisque tous ces fichiers (et
// `storage-local.js`) sont précachés.
//
// Correctif (15/09/2026, suite — audit "anomalies silencieuses" : unification du calcul de
// dates) : au moins trois implémentations indépendantes de "combien de jours avant/après
// aujourd'hui" cohabitaient (js/domain/tasks.js#isLate, followups.js#isControlDue,
// projectHealth.js#daysLate/daysUntil, js/views/dashboard.js#daysFromToday, kanban.js#
// daysFromToday — copie exacte de celle de dashboard.js), la plupart parsant l'échéance en
// UTC (`new Date(dateStr)`) puis la comparant à un minuit LOCAL — ne se voit que dans un fuseau
// à décalage négatif (Amériques), où une tâche due aujourd'hui pouvait apparaître en retard.
// Nouveau fichier `js/services/dateUtils.js` (ajouté à APP_SHELL), qui reprend le parsing local
// déjà correct de `js/domain/priorisation.js#daysUntil` comme seule référence désormais utilisée
// par tous ces appelants (`js/components/weeklyReview.js` aussi, dont la fenêtre "7 prochains
// jours" mélangeait de son côté une échéance parsée en UTC avec `Date.now()`, un instant en
// temps réel plutôt qu'un début de journée). `js/domain/workload.js` importe désormais
// `STALLED_THRESHOLD_MS` depuis `tasks.js` au lieu d'en garder sa propre copie en dur. `CACHE_NAME`
// incrémenté puisque tous ces fichiers sont précachés (et un nouveau fichier vient d'y être
// ajouté).
//
// Correctif (15/09/2026, suite — audit "anomalies silencieuses" : échecs qui disparaissent) :
// trois points où une erreur technique passait totalement inaperçue. (1) `js/services/
// storage.js#subscribe()` — chemin de lecture central de toute l'app (Kanban, Projets,
// Personnes...) — n'avait pas de callback d'erreur sur `onSnapshot()` : une écoute qui échoue
// (règle Firestore refusée, jeton expiré...) figeait les données affichées sans le moindre
// signe ; elle journalise et affiche désormais un toast. (2) `js/app.js#onAuthChange` n'avait
// aucun try/catch autour de la vérification de la liste blanche : une erreur à cet instant
// laissait l'écran intégralement blanc ; nouvel écran `js/views/login.js#renderAuthError` avec
// un bouton "Réessayer". (3) `js/services/shortcuts.js` n'avait aucun `catch` dans tout le
// fichier — un échec pouvait notamment laisser le bouton "⌨️ Assigner un raccourci" bloqué pour
// de bon sur "Maintiens Ctrl+Alt et appuie sur une touche…" ; try/catch ajoutés sur les 3 points
// asynchrones (raccourci personnalisé, retrait, assignation), chacun avec un toast et, pour
// l'assignation, un retour à un état de bouton normal. `CACHE_NAME` incrémenté puisque
// storage.js, app.js, login.js et shortcuts.js sont tous précachés.
//
// Correctif (15/09/2026, suite — audit "anomalies silencieuses" : corrections ponctuelles à
// faible risque, dernier volet) : (1) `js/domain/inbox.js#autoArchiveStaleKept()` se basait sur
// `item.createdAt` (date de la capture BRUTE d'origine) plutôt que sur le moment où l'élément
// est devenu une Information/Idée — une capture qualifiée en "kept" longtemps après sa création
// se retrouvait auto-archivée dès le balayage suivant ; nouveau champ `keptAt` posé par
// `qualify()`. (2) `js/domain/history.js#ACTION_META` : ajout des libellés manquants pour les
// actions déjà journalisées par `convert.js` (conversions), `inbox.js` (texte corrigé, projet
// rattaché) et `tags.js` (tag ajouté/retiré, y compris pour "Kept" et "Objective", absents des
// boucles existantes) — ces événements existaient déjà dans l'historique, seul leur affichage
// retombait sur un libellé générique. (3) `js/domain/projects.js#addPart/updatePartStatus/
// removePart` et `js/domain/tasks.js#addOutlookMeeting/removeOutlookMeeting` ne journalisaient
// rien du tout jusqu'ici, contrairement à `addNote()` sur ces mêmes entités — journalisation
// ajoutée. (4) `js/domain/decisions.js#removeGrid()` journalisait "grid_removed" même quand
// aucune grille n'avait jamais existé — désormais gardé par une vérification préalable.
// Corrections de performance (15/09/2026, audit "performance hors-ligne") : (1) fusion des 3
// abonnements Firestore parallèles sur `inboxItems` en un seul (js/domain/inbox.js) ; (2)
// anti-rebond (150ms) sur les 7 champs de recherche qui relançaient un filtrage à chaque
// frappe (kanban.js, resources.js, people.js — prep-search —, prompts.js — x2 —, guide.js,
// linkedItems.js) ; (3) les fiches Tâche/Ressource/Personne/Projet ne rechargent plus tout
// l'historique de l'application (`listAll()`) pour n'en garder que quelques lignes — nouvelles
// requêtes ciblées `listForEntity`/`listForEntities` (js/domain/history.js, js/services/
// storage.js#listWhere) ; (4) la recherche globale (js/components/search.js) charge maintenant
// ses données une seule fois à l'ouverture de la modale au lieu de tout recharger à chaque
// frappe. `CACHE_NAME` incrémenté puisque tous ces fichiers sont précachés.
//
// Ajouts "usage hors-ligne" (15/09/2026, audit "performance hors-ligne") : (1) bandeau visible
// quand l'appareil perd la connexion (js/services/onlineStatus.js — nouveau fichier, précaché
// ci-dessous —, js/app.js, styles/components.css) ; (2) un bouton d'action qui n'attend jamais
// de confirmation (`closesModal: false`, ex. Enregistrer/Convertir) affiche désormais un message
// explicite après 2,5s hors-ligne au lieu de rester silencieusement bloqué en attente de
// l'écriture Firestore (js/components/modal.js). `CACHE_NAME` incrémenté puisque onlineStatus.js
// est précaché et que modal.js est modifié.
//
// Résilience du Service Worker (15/09/2026, audit "usage hors-ligne") : (1) les icônes
// (icons/icon-192.png, icon-192-maskable.png, icon-512.png), référencées par manifest.json,
// index.html et js/app.js, n'étaient jamais précachées — icône cassée hors-ligne avant leur
// premier chargement par le navigateur ; ajoutées ci-dessous. (2) `storage-local.js` a été
// retiré : ce fichier n'existe plus dans l'application (le mode "stockage local" a été
// remplacé par Firestore), et le précacher forçait `cache.addAll()` à échouer entièrement dès
// qu'il était introuvable (voir point 3). (3) `cache.addAll()` est atomique : un seul fichier
// de APP_SHELL en échec (404, coupure réseau ponctuelle) faisait échouer l'installation ENTIÈRE
// du Service Worker, sans le moindre message — aucun précache créé pour cette version, pour
// personne. Chaque fichier est désormais mis en cache individuellement (`Promise.allSettled`) :
// un échec isolé n'empêche plus les ~90 autres d'être précachés, et le détail de ce qui a échoué
// est au moins journalisé. `CACHE_NAME` incrémenté puisque la liste APP_SHELL change.
//
// BUG corrigé (15/09/2026, audit "usage en mode déconnecté") : une toute première connexion
// (session jamais mise en cache sur cet appareil) tentée hors-ligne échoue forcément — ça ne
// peut pas être résolu autrement, une première authentification nécessite le réseau — mais le
// message affiché jusqu'ici était le texte brut anglais de Firebase ("Firebase: Error
// (auth/network-request-failed).") au lieu d'expliquer pourquoi (js/views/login.js).
// `CACHE_NAME` incrémenté puisque ce fichier est précaché.
//
// Notes de mise à jour (15/09/2026) : nouvelle vague dans js/views/whatsnew.js décrivant les
// cinq correctifs ci-dessus (changeType, confirmDelete, bandeau hors-ligne, message de connexion,
// performances). `CACHE_NAME` incrémenté puisque ce fichier est précaché.
//
// BUG corrigé (21/09/2026, remonté par Charles-Henri : "SyntaxError: The requested module
// './tasks.js' does not provide an export named 'createTask'" + "Cache.put() encountered a
// network error" au chargement) — exactement la classe de bug documentée en détail plus haut
// (vague 22 septies/novies) : `CACHE_NAME` n'a PAS été incrémenté depuis ce commentaire du
// 15/09/2026, alors que LOT 1 (kanban.js, people.js, followupsOverview.js, app.js...), LOT 2
// (kanban.js, app.js...), LOT 3 (dashboard.js, projects.js, whatsnew.js) et LOT 4A (tasks.js,
// projects.js, followups.js, objectives.js, inbox.js, tags.js, linkedItems.js) ont chacun modifié
// des fichiers précachés sans jamais toucher ce fichier ni sa constante. Le navigateur ne
// détectait donc jamais de nouvelle version (`sw.js` inchangé), et la stratégie cache-first à
// rafraîchissement de fond (voir "fetch" plus bas) mettait à jour CHAQUE fichier précaché
// indépendamment et de façon non coordonnée au fil des rechargements — un onglet ouvert pendant
// cette période pouvait ainsi se retrouver avec un mélange d'anciennes et de nouvelles versions
// de fichiers censés être cohérents entre eux (ex. `inbox.js` déjà rafraîchi important une
// fonction de `tasks.js` encore sur son ancienne version, ou l'inverse), d'où l'erreur d'export
// manquant — un fichier réellement corrompu par une écriture réseau interrompue en cours de
// rafraîchissement de fond peut aussi expliquer le "Cache.put() encountered a network error" vu
// au même moment. `CACHE_NAME` incrémenté ici pour forcer une reconstruction propre et atomique
// du cache chez tout le monde, comme le veut la règle rappelée plus haut. Cette régression n'est
// rattachée à aucun TODO de la roadmap : c'est un oubli de procédure de livraison (bump de
// `CACHE_NAME`), pas un problème fonctionnel d'un des lots eux-mêmes — voir le rapport de LOT 4A
// pour le détail. **Vérification à faire côté navigateur après ce correctif** : un simple
// rechargement peut ne pas suffire si le Service Worker actuellement actif reste bloqué en
// attente de contrôle — désinscrire le Service Worker existant (ou vider les données du site)
// puis recharger complètement une fois ce fichier redéployé.
//
// BUG corrigé (22/09/2026, remonté par Charles-Henri : "sur Équipe j'ai la vue Pilotage") —
// exactement la même classe de bug que ci-dessus, et pour exactement la même raison : la règle
// rappelée plus haut ("`CACHE_NAME` incrémenté à CHAQUE vague qui modifie ne serait-ce qu'un
// seul fichier précaché") n'a pas été suivie depuis ce correctif du 21/09/2026 (v63), alors que
// LOT 4B (storage.js, tasks.js, projects.js, followups.js), LOT 6 (inbox.js ×2, linkedItems.js,
// weeklyReview.js), LOT 7 (resources.js ×2, linkedItems.js, calendar.js), LOT 8 (modal.js,
// kanban.js, projects.js, components.css) et LOT 9 (tokens.css, components.css, priorisation.js,
// resources.js, dashboard.js, preferences.js, people.js, more.js, guide.js, whatsnew.js,
// inbox.js ×2, weeklyReview.js, changeType.js, linkedItems.js, search.js, onboarding.js,
// shortcuts.js) ont chacun modifié des fichiers précachés sans qu'aucun d'eux ne touche ce
// fichier ni sa constante — LOT 5 seul en est exempté (documentation pure, `PROJECT_CONTEXT.md`
// n'est pas précaché). Même mécanisme de fond que le 21/09 : un onglet resté ouvert (ou jamais
// fermé/rouvert assez de fois) accumule un mélange incohérent d'anciens et de nouveaux fichiers
// rafraîchis indépendamment au fil du cache-first de fond — ici, très probablement un ancien
// `js/app.js` et/ou `js/views/people.js` encore en mémoire/cache alors que le reste de l'app a
// avancé, d'où l'écran Kanban affiché sous l'onglet Équipe. `CACHE_NAME` incrémenté ici pour
// forcer une reconstruction propre du cache chez tout le monde, comme le veut la règle. **Même
// vérification que le 21/09 à refaire côté navigateur** : désinscrire le Service Worker existant
// (ou vider les données du site) puis recharger complètement une fois ce fichier redéployé — un
// simple rechargement peut ne pas suffire si le Service Worker actif reste bloqué en attente de
// contrôle.
//
// (22/09/2026, v65) : `js/views/people.js` a dû être corrigé À NOUVEAU juste après ce bump v64,
// pour un bug distinct (sans rapport avec le cache) — des backticks utilisés par erreur à
// l'intérieur d'un commentaire HTML, lui-même à l'intérieur du template literal JS de
// `renderPeople()`, refermaient prématurément ce template literal et faisaient interpréter
// `.fiche-tabs` comme du code JS (`ReferenceError: tabs is not defined`, LOT 9/TODO-020). Ce
// fichier étant précaché, cette nouvelle modification déclenche elle-même la règle et
// `CACHE_NAME` est donc incrémenté une seconde fois, que le v64 ait déjà été déployé ou non par
// Charles-Henri — un v64 encore non déployé est simplement remplacé par ce v65 qui inclut déjà
// le correctif ; un v64 déjà déployé (donc avec le bug people.js) est corrigé par ce nouveau
// cache. Aucun autre fichier précaché n'a changé depuis le commentaire ci-dessus.
//
// (22/09/2026, v66, LOT 10/TODO-023) : `styles/tokens.css` et `styles/components.css`, tous
// deux précachés, modifiés pour corriger les 3 régressions d'affichage en mode sombre
// (BESOIN-003) — voir TODO_TECHNIQUE.md. `js/views/whatsnew.js`, également précaché, modifié
// pour la nouvelle entrée correspondante. `CACHE_NAME` incrémenté en conséquence.
// (22/09/2026, v67) : nouveau signalement de Charles-Henri, "des éléments dans le guide sont
// illisibles" en mode sombre (`js/views/guide.js`) — même famille de bug que TODO-023/LOT 10,
// voir le commentaire détaillé dans styles/tokens.css (nouveaux jetons --color-warning-light/
// --color-danger-light). `styles/tokens.css` et `js/views/guide.js`, tous deux précachés,
// modifiés. `CACHE_NAME` incrémenté en conséquence.
//
// (22/09/2026, v68, LOT 11/TODO-024/TODO-025) : modèle Objectif unifié (personnel/EADP),
// indicateurs structurés, points de suivi enrichis (contexte, référence optionnelle vers une
// fiche existante) et case "Remonter au prochain point" indépendante du Sens d'un Suivi — voir
// le commentaire en tête de js/domain/objectives.js pour l'arbitrage complet de Charles-Henri.
// Fichiers précachés modifiés : js/domain/objectives.js, js/domain/followups.js,
// js/components/linkedItems.js, js/views/people.js, js/views/dashboard.js, js/views/whatsnew.js
// (nouvelle entrée, qui inclut au passage le rattrapage de l'entrée manquante pour le hotfix
// Guide du v67). `CACHE_NAME` incrémenté en conséquence.
//
// (22/09/2026, v69, TODO-038/TODO-039) : besoins produits traités en parenthèse pendant la
// vérification du LOT 11 (voir TODO_TECHNIQUE.md) — tâches d'un projet triées par statut/
// échéance avec les terminées à part (js/views/projects.js), étapes cochées d'une checklist
// Tâche/Suivi reléguées en bas et triées par date de coche (js/components/checklist.js,
// js/views/kanban.js, js/views/people.js), et report rapide "+1j/+7j" sur l'échéance/le
// prochain contrôle d'un Suivi (js/views/people.js, calcul mutualisé dans
// js/services/dateUtils.js). Fichiers précachés modifiés : js/views/projects.js,
// js/components/checklist.js, js/views/kanban.js, js/views/people.js, js/services/dateUtils.js,
// styles/components.css, js/views/whatsnew.js (nouvelles entrées). `CACHE_NAME` incrémenté en
// conséquence.
//
// (22/09/2026, v70) : deux besoins encore traités en parenthèse pendant la vérification du LOT 11
// (voir TODO_TECHNIQUE.md, TODO-040) —
//  1. Correction d'un bug du LOT 11 lui-même (retour direct de Charles-Henri : un indicateur
//     ajouté à un Objectif ne s'affichait pas tant que la fiche n'était pas entièrement refermée
//     puis rouverte) — `js/views/people.js#openObjectiveDetail` rouvrait sa propre fiche avec
//     l'objet JS reçu en paramètre, jamais remis à jour après les écritures imbriquées
//     (indicateur/suivi/lien) ; introduction de `reopenSelf` (relit l'Objectif en base avant de
//     rouvrir), même principe que `reopenProject` dans js/views/projects.js.
//  2. Mode import d'un objectif depuis un texte généré par IA (retour direct de Charles-Henri :
//     "c'est pénible de saisir tout [...] il faudrait un mode import") — nouvelle fonction pure
//     `js/domain/objectives.js#parseObjectiveImportText`, collée au format de sortie imposé par
//     le prompt IA de Charles-Henri, et nouvelle modale partagée
//     `js/views/people.js#openImportObjectiveTextModal` (préremplissage à la création dans
//     `openCreateObjectiveModal` et `js/views/dashboard.js#openCreatePersonalObjectiveModal`,
//     import d'indicateurs sur un objectif déjà existant dans `openObjectiveDetail`).
// Fichiers précachés modifiés : js/domain/objectives.js, js/views/people.js,
// js/views/dashboard.js, js/views/whatsnew.js (nouvelles entrées). `CACHE_NAME` incrémenté en
// conséquence.
// (22/09/2026, v71, TODO-041) : besoin produit traité en parenthèse, message suivant
// immédiatement TODO-040 — retour direct de Charles-Henri : "si je me suis trompé dans le nom
// d'une sous étape, je suis aujourd'hui obligé de supprimer et de le réécrire. je ne peux pas le
// modifier ni ordonner les sous étapes non terminées." `js/components/checklist.js` gagne deux
// options optionnelles `onEdit`/`onReorder` (édition en place via un bouton "✏️", montée/descente
// des éléments non cochés via deux boutons ▲/▼ réutilisant `.kanban-move-btn`), câblées sur les
// trois usages existants (checklist Tâche, checklist Suivi, Pense-bête). Fichiers précachés
// modifiés : js/components/checklist.js, js/domain/tasks.js, js/domain/followups.js,
// js/views/kanban.js, js/views/people.js, js/views/dashboard.js, js/views/whatsnew.js (nouvelles
// entrées). `CACHE_NAME` incrémenté en conséquence.
// (22/09/2026, v72) : correctif LOT 11, révélé par le premier passage réel des tests LOT 11 sur
// GitHub Actions (voir TODO_TECHNIQUE.md, LOT 11) — `js/views/people.js#openPersonDetail`
// rouvrait TOUJOURS la fiche d'une personne sur l'onglet "Suivis", quel que soit l'onglet
// réellement actif au moment de l'action (ex. ajouter un objectif depuis l'onglet "Objectifs"
// renvoyait ensuite sur "Suivis", cachant l'objectif qu'on venait de créer). Nouveau paramètre
// optionnel `initialTab`, capturé dans `activeTab` et repassé par `reopen()`. Fichier précaché
// modifié : js/views/people.js, js/views/whatsnew.js (nouvelle entrée). `CACHE_NAME` incrémenté
// en conséquence. Deux tests LOT 11 (tests/e2e/lot11-objective-unified-model.spec.js,
// tests/e2e/lot11-objective-indicators-entries.spec.js) corrigés au passage — voir le détail
// sous LOT 11 dans TODO_TECHNIQUE.md ; ces fichiers de test ne sont pas précachés, aucun impact
// sur le numéro de version.
// (22/09/2026, v73) : LOT 12, TODO-026 (US-026 du 21/09/2026, retour de Charles-Henri) — barre de
// navigation personnalisable par utilisateur ("🧭 Personnaliser la navigation", accessible depuis
// ⚙️ Personnaliser l'accueil, voir js/views/dashboard.js). Nouveau fichier précaché
// js/services/navConfig.js (catalogue des modules + construction de la barre du bas, partagé par
// js/app.js et js/views/dashboard.js sans dépendance circulaire entre les deux). Fichiers
// précachés modifiés : js/app.js (barre du bas calculée dynamiquement au lieu d'une liste codée
// en dur), js/domain/preferences.js (nouvelle préférence `navigationMain`), js/views/dashboard.js
// (nouvel écran de personnalisation), js/views/whatsnew.js (nouvelle entrée). `CACHE_NAME`
// incrémenté en conséquence.
//
// LOT 13 (TODO-027, 22/09/2026) — "🧠 Mon bureau" (post-it libres), remplace le "📌 Pense-bête"
// (arbitrage de Charles-Henri : "Mon bureau remplace le Pense-bête"). Nouveaux fichiers précachés
// js/domain/stickyNotes.js (collection Firestore dédiée) et js/components/bureau.js (canevas
// glisser/redimensionner + menus de conversion). Fichiers précachés modifiés :
// js/domain/preferences.js (nouveau drapeau `bureauMigratedV1`), js/components/checklist.js
// (nouveau paramètre optionnel `onLineMenu`), js/views/resources.js et js/views/people.js
// (préremplissage de description jusqu'ici manquant sur leurs formulaires de création),
// js/views/dashboard.js (section "Mon bureau" remplace le Pense-bête), js/views/whatsnew.js
// (nouvelle entrée), styles/components.css (styles des post-it). `CACHE_NAME` incrémenté en
// conséquence.
//
// Correctif du 23/09/2026 (retour direct de Charles-Henri sur LOT 13, même jour) : `js/
// components/bureau.js` (le rebuild du plan de travail restait suspendu tant que le focus
// touchait N'IMPORTE quel élément du Bureau, y compris un simple bouton — épingler/couleur/
// bascule texte-checklist n'apparaissaient qu'après un clic en dehors du post-it ; corrigé pour
// ne suspendre que sur un VRAI champ de saisie texte ; nouveau post-it créé épinglé par défaut ;
// section repliable comme les autres rubriques de l'Accueil, `<details>`) et `js/domain/
// stickyNotes.js` (nouveau paramètre optionnel `pinned` sur `createStickyNote`) précachés
// modifiés — `CACHE_NAME` incrémenté en conséquence.
//
// Complément du 23/09/2026 (même jour, second retour direct de Charles-Henri : "je dois pouvoir
// [mettre un post-it épinglé] n'importe où dans l'écran même en dehors du bureau [...] il [ne
// doit pas passer] au dessous de toutes les autres modales") — un post-it épinglé n'est plus une
// carte dans la section "Mon bureau" de l'Accueil mais un widget flottant (`position: fixed`)
// visible sur TOUT écran de l'app, comme le mini-minuteur Pomodoro. Nouveaux fichiers précachés :
// `js/components/stickyNoteShared.js` (menu "⋯"/édition rapide/conversion, extraits de
// `js/components/bureau.js` pour être partagés avec le nouveau widget) et `js/components/
// pinnedNotesOverlay.js` (widget flottant lui-même, monté/démonté dans `js/app.js` comme
// `pomodoroWidget.js`). Fichiers précachés modifiés : `js/domain/stickyNotes.js` (nouveaux champs
// `floatX`/`floatY`, nouvelle fonction `setFloatPosition`), `js/components/bureau.js` (section
// "Mon bureau" simplifiée : la liste des épinglés qui y vivait quelques minutes plus tôt ce même
// jour est retirée, devenue redondante avec le nouveau widget), `js/app.js` (montage/démontage du
// widget), `styles/components.css` (styles du widget flottant). `CACHE_NAME` incrémenté en
// conséquence.
//
// Complément du 24/09/2026 (retour direct de Charles-Henri) : (1) "🧠 Mon bureau" apparaît
// désormais dans "Ordre des rubriques" (⚙️ Personnaliser l'accueil) même pour un compte ayant
// déjà un ordre personnalisé enregistré avant l'ajout de cette rubrique (LOT 13, 22/09/2026) —
// voir `js/views/dashboard.js#openDashboardSettingsModal`. (2) "🔍 Tout voir" prend désormais
// toute la largeur disponible de la fenêtre (nouvelle option `wide` sur `openModal()`, voir
// `js/components/modal.js` et la classe `.modal--wide`/`.bureau-full-canvas-wrap` dans
// `styles/components.css`), avec défilement horizontal si un post-it se retrouve hors de la
// zone visible (`js/components/bureau.js#recalcCanvasSize`, ex `recalcCanvasHeight`). Fichiers
// précachés modifiés : `js/views/dashboard.js`, `js/components/bureau.js`,
// `js/components/modal.js`, `styles/components.css`, `js/views/whatsnew.js` (nouvelle entrée).
// `CACHE_NAME` incrémenté en conséquence.
//
// Correction du 25/09/2026 (CI, avant LOT G2 de TODO_GAMIFICATION.md — voir tests/README.md et
// TODO_TECHNIQUE.md → LOT 13, "Correction du 25/09/2026") : `js/components/bureau.js` modifié
// (bascule de mode texte/checklist du plan de travail complet rendue optimiste, même principe
// déjà appliqué à `note.checklist`) — fichier précaché, `CACHE_NAME` incrémenté en conséquence.
// Aucun autre fichier précaché touché par ce correctif (le fichier de test corrigé au passage,
// tests/e2e/lot13-bureau-conversion.spec.js, ne fait pas partie de l'app livrée).
//
// LOT G6 de TODO_GAMIFICATION.md (25/09/2026) : premier écran UI de la roadmap gamification,
// nouveau fichier `js/views/gamification.js` ("🏅 Galerie des badges") — ajouté ci-dessous.
// `js/domain/gamification.js` (modifié dans ce lot : `BADGES` exporté, `FAMILLES_BADGES`,
// `valeurCouranteFamille`, `subscribe`) N'EST PAS ajouté ici : il ne l'a jamais été depuis sa
// création en LOT G1 (24/09/2026), un oubli déjà signalé dans les bilans de LOT G1/G3/G4/G5 —
// hors du périmètre de CE lot de le corriger silencieusement au passage (voir le bilan de LOT
// G6 pour le rappel explicite de ce point toujours ouvert). `styles/components.css` (nouvelles
// classes `.badge-tuile*`/`.badges-grid`) et `js/views/more.js` (nouvelle entrée) sont déjà
// précachés par ailleurs, aucun ajout de ligne nécessaire pour eux ici. `CACHE_NAME` incrémenté
// en conséquence.
//
// LOT G7 (Déblocages, TODO_GAMIFICATION.md §6, 28/09/2026) — mêmes remarques : AUCUN nouveau
// fichier, uniquement du contenu modifié dans des fichiers déjà précachés (`js/domain/
// gamification.js` — toujours l'oubli historique ci-dessus, non corrigé ici non plus —,
// `js/domain/preferences.js`, `js/domain/stickyNotes.js`, `js/components/stickyNoteShared.js`,
// `styles/components.css`, `js/views/dashboard.js`, `js/views/gamification.js`,
// `js/views/whatsnew.js` — nouvelle entrée). `CACHE_NAME` incrémenté en conséquence pour que ce
// contenu modifié soit effectivement resservi.
//
// Ajout ad hoc du 28/09/2026 (retour direct de Charles-Henri, hors numérotation LOT) : fiche
// détaillée au clic sur un badge de la Galerie (`js/views/gamification.js`, déjà précaché,
// import ajouté de `js/components/modal.js`, déjà précaché lui aussi — aucun ajout de ligne
// nécessaire) + `styles/components.css` (curseur cliquable) + `js/views/whatsnew.js` (nouvelle
// entrée). `CACHE_NAME` incrémenté à nouveau pour ce contenu modifié.
// LOT G8 (28/09/2026, TODO_GAMIFICATION.md §9) — écran "📊 Progression" : `js/views/gamification.js`
// (nouvel export `renderGamificationProgression`, déjà précaché) + `js/domain/gamification.js`
// (déjà précaché) + `js/app.js`/`js/views/more.js` (route + entrée de nav, déjà précachés) +
// `styles/components.css` (déjà précaché) — aucun nouveau fichier, uniquement du contenu modifié
// dans des fichiers déjà listés ci-dessous : `CACHE_NAME` incrémenté pour qu'il soit resservi.
//
// Ajout ad hoc du 28/09/2026 (suite directe de LOT G7/LOT G8, retour de Charles-Henri "on fait") :
// application visuelle de Thème/Fond/Ruban (18 déblocages restés sans rendu depuis LOT G7) — voir
// le commentaire détaillé sur `DEBLOCAGES` dans js/domain/gamification.js. Nouveau fichier
// `js/services/gamificationThemeStore.js` (ajouté à APP_SHELL ci-dessous) + `styles/tokens.css`
// (accent recoloré par Thème) + `js/domain/preferences.js`/`js/domain/gamification.js`/
// `js/views/gamification.js`/`js/app.js`/`styles/components.css` (tous déjà précachés) +
// `js/views/whatsnew.js` (nouvelle entrée). `CACHE_NAME` incrémenté à nouveau.
//
// "Petite parenthèse" Objectifs/EADP (28/09/2026, retour de Charles-Henri, hors numérotation
// LOT) : suivi consolidé par indicateur (édition/suppression d'un suivi, "Prévu au point
// précédent"), édition/suppression des notes du journal "Notes & repères" partout où il existe
// (8 domaines : tasks/followups/projects (dont parts)/resources/meetings/decisions/inbox/people),
// tag EADP positif/négatif/neutre sur les notes de Personne, `notableReason` sur un FollowUp
// notable, et exports PDF/Excel des Objectifs. Trois fichiers NOUVEAUX (ajoutés à APP_SHELL
// ci-dessous, même règle que tous les nouveaux fichiers précédents) : `js/domain/objectivesExport.js`,
// `js/services/pdfWriter.js`, `js/services/xlsxWriter.js` — ces deux derniers sont des générateurs
// PDF/XLSX vanilla écrits sans dépendance (ni npm ni CDN accessibles dans l'environnement où ce
// patch a été développé, voir leur commentaire en tête de fichier). Fichiers modifiés (déjà
// précachés, `CACHE_NAME` incrémenté pour qu'ils soient resservis) : `js/domain/objectives.js`,
// `js/domain/people.js`, `js/domain/followups.js`, `js/domain/tasks.js`, `js/domain/projects.js`,
// `js/domain/resources.js`, `js/domain/meetings.js`, `js/domain/decisions.js`, `js/domain/inbox.js`,
// `js/components/notesBlock.js`, `js/views/dashboard.js`, `js/views/inbox.js`, `js/views/kanban.js`,
// `js/views/people.js`, `js/views/projects.js`, `js/views/resources.js`, `js/views/whatsnew.js`,
// `styles/components.css`.
//
// Post-it épinglés flottants — redimensionnement + champ de description agrandissable (28/09/2026,
// retour direct de Charles-Henri : "pouvoir agrandir ou réduire un post-it en dimension qui serait
// épinglé [...] quand je rentre dans le post-it, pouvoir agrandir le champ de description [...]").
// Aucun nouveau fichier — uniquement du contenu modifié dans des fichiers déjà précachés (`CACHE_NAME`
// incrémenté pour qu'ils soient resservis) : `js/domain/stickyNotes.js` (nouveaux champs
// floatWidth/floatHeight + setFloatSize), `js/components/pinnedNotesOverlay.js` (poignée de
// redimensionnement, aperçu non tronqué), `js/components/stickyNoteShared.js` (édition rapide en
// modale large), `styles/components.css`, `js/views/whatsnew.js`.
//
// LOT G10 (28/09/2026, TODO_GAMIFICATION.md §13/§14, retour de Charles-Henri "TODO-001 est validé
// et on fait la gamification §13/§14") — couche de récompense/mise en scène : carte "Progression"
// sur l'Accueil (§13.1), écrans de badge/niveau/déblocage débloqué (§13.2 à §13.5) et Centre de
// récompenses (§13.6). Trois nouveaux fichiers : `js/components/rewardOrchestrator.js` (file
// d'écrans de récompense, montée une seule fois par js/app.js comme les autres widgets flottants),
// `js/components/progressionCard.js` (carte de l'Accueil) et `js/views/recompenses.js` (Centre de
// récompenses, route `#/recompenses`). Fichiers modifiés (déjà précachés, `CACHE_NAME` incrémenté
// pour qu'ils soient resservis) : `js/domain/gamification.js` (événements de récompense, fonctions
// de lecture `xpDebutNiveau`/`prochainsBadgesPermanents`/`xpGagneAujourdhui`/
// `chronologieRecompenses`), `js/components/modal.js` (`isModalOpen`), `js/views/dashboard.js`
// (montage de la carte), `js/views/gamification.js` (bouton "🎁 Récompenses" sur les 2 topbars),
// `js/views/more.js` (nouvelle ligne), `js/app.js` (route + montage de l'orchestrateur),
// `styles/components.css` (styles des écrans de récompense), `js/views/whatsnew.js`.
//
// Complément du 28/09/2026 (retour sur le complément de redimensionnement des post-it épinglés,
// même jour — "je voulais bien l'édition rapide donc que tu repasses dessus") — édition en place
// (titre, texte, checklist) directement sur la carte flottante, sans plus jamais ouvrir de modale.
// Aucun nouveau fichier (`CACHE_NAME` incrémenté uniquement pour que les fichiers déjà précachés
// ci-dessous soient resservis) : `js/components/pinnedNotesOverlay.js` (structure de carte
// reprenant celle du plan de travail complet, nouveau mécanisme `beginOwnModalChain`/
// `endOwnModalChain`), `js/components/stickyNoteShared.js` (retrait de `openStickyNoteEditor`,
// devenue sans appelant), `js/components/modal.js` (nouvelle primitive `subscribeModalState`),
// `js/components/checklist.js` (classe `checklist-line-menu-btn`), `styles/components.css`
// (en-tête flottant devenu la seule zone de glisser), `js/views/whatsnew.js`.
//
// Complément du 28/09/2026 (retour direct de Charles-Henri : "les 🧩 Sous-parties dans un projet
// doivent s'ordonner avec les mêmes règles que les checklist") — tri (non "Terminé" en tête dans
// leur ordre manuel, "Terminé" en bas trié par date de passage la plus récente), réordonnancement
// ▲/▼ et édition en place du libellé via "✏️", même principe que `js/components/checklist.js`.
// Aucun nouveau fichier (`CACHE_NAME` incrémenté uniquement pour que les fichiers déjà précachés
// ci-dessous soient resservis) : `js/domain/projects.js` (`sortPartsForDisplay`/`editPart`/
// `reorderParts`, `doneAt` désormais horodaté par `updatePartStatus`), `js/views/projects.js`
// (rendu trié + boutons ▲/▼/✏️ sur la fiche Projet), `js/views/whatsnew.js`.
//
// LOT 14 (TODO-029, TODO-030, 28/09/2026, TODO_TECHNIQUE.md) — traçabilité des actions rapides et
// confort de saisie des dates sur le Suivi. Aucun nouveau fichier (`CACHE_NAME` incrémenté
// uniquement pour que les fichiers déjà précachés ci-dessous soient resservis) :
// `js/domain/followups.js` (`setStatus` ajoute désormais une note automatique horodatée sur
// relance/règlement rapide), `js/views/people.js` (boutons "+1 j"/"+7 j" sur les 4 champs date du
// formulaire Suivi, création et édition), `js/views/whatsnew.js`.
//
// Correctif/refonte export PDF EADP (29/09/2026, retour de Charles-Henri : "j'ai des ? et des
// phrases tronqués [...]" + maquette détaillée + complément "par objectif [...] tableau de
// ressource"). Aucun nouveau fichier (`CACHE_NAME` incrémenté uniquement pour que les fichiers
// déjà précachés ci-dessous soient resservis) : `js/services/pdfWriter.js` (table WinAnsi
// complète pour les caractères typographiques — l'ancienne confusion Latin-1/WinAnsi
// transformait un tiret cadratin en "?" ; `heading()` découpe désormais le texte au lieu de le
// laisser filer hors marge ; ajout des polices italique/gras-italique et des options
// couleur/alignement), `js/domain/objectivesExport.js` (PDF EADP entièrement restylé : titre
// centré en orange, sous-titres gris foncé, objectifs numérotés en gras bleu avec bloc
// campagne/statut/type/description, indicateurs numérotés en italique bleu toujours affichés même
// sans suivi, notables triés chronologiquement avec symboles +/-/= à la place des émojis, tableau
// de ressources par objectif), `js/views/whatsnew.js`.
//
// Carte "Progression" de l'Accueil réduite par défaut (29/09/2026, retour de Charles-Henri : "je
// dois voir la rubrique niveau d'avancement Xp en mode réduit par défaut [...] ça doit rester
// discret [...] je peux déplier pour voir l'état actuel [...] espace entre ce bloc et les
// indicateurs"). Aucun nouveau fichier (`CACHE_NAME` incrémenté uniquement pour que les fichiers
// déjà précachés ci-dessous soient resservis) : `js/components/progressionCard.js` (résumé d'une
// ligne dans un `<summary>`, replié par défaut — seul le résumé niveau/XP/XP restant reste visible
// tant que non déplié), `styles/components.css` (apparence discrète en mode réduit + marge fixe
// avant `#stat-grid`), `js/views/whatsnew.js`.
//
// BUG corrigé (29/09/2026, retour de Charles-Henri : couleur "Océan" mal affichée dans le menu
// "⋯" d'un post-it + infobulle chevauchant "Transformer en"). Aucun nouveau fichier (`CACHE_NAME`
// incrémenté uniquement pour que les fichiers déjà précachés ci-dessous soient resservis) :
// `styles/components.css` (`.chip.active` n'écrase plus le fond pastel d'une pastille de couleur
// active — bug présent depuis la création du sélecteur, révélé par le déblocage d'Océan/Aurore
// mais touchant déjà les 6 couleurs fixes), `js/components/stickyNoteShared.js` (espace élargi
// avant "Transformer en" pour laisser de la place à l'infobulle native du navigateur).
//
// LOT G9 — détection automatique des illustrations réelles (29/09/2026, retour de Charles-Henri
// « on fait la détection automatique », suite de claude/lotg9-prompts-chatgpt-illustrations-
// 28-09-2026.md). Nouveau fichier `js/services/illustrations.js` (ajouté à APP_SHELL ci-dessous,
// même règle que tous les fichiers précédents). Fichiers modifiés : `js/views/gamification.js`
// (tuiles Galerie badges + déblocages Icône, fond de l'écran Progression), `js/views/dashboard.js`
// (icône équipée à côté de "Mon pilotage"), `js/components/rewardOrchestrator.js` (écrans de
// récompense badge/déblocage), `styles/components.css` (taille de l'image dans chacun de ces
// contextes). Volontairement PAS d'ajout des 86 chemins `illustrations/**/*.png` eux-mêmes à
// APP_SHELL : ils n'existent pas tous encore (livraison progressive en cours), et le mécanisme ne
// dépend d'aucune précache — chaque image est chargée à la demande, avec repli automatique sur
// l'emoji/CSS existant si le fichier n'est pas encore là (voir le module ci-dessus pour le détail).
// CACHE_NAME v93 → v94 (29/09/2026, TODO-031/TODO-036/TODO-037) : contenu modifié de 11 fichiers
// déjà précachés (js/domain/history.js, js/domain/inbox.js, js/services/usageTracking.js,
// js/components/adminPanel.js — purge assistée, TODO-036 ; js/domain/people.js/resources.js/
// meetings.js/decisions.js, js/views/people.js/resources.js/dashboard.js — écritures ciblées
// addNote(), TODO-037 ; js/components/tagsEditor.js/search.js, js/views/projects.js/kanban.js —
// <datalist> natif remplacé par le composant d'autocomplétion partagé, TODO-031 ; styles/
// components.css — style de la liste de suggestions ; js/views/whatsnew.js — nouvelles entrées)
// et UN fichier nouveau ajouté ci-dessous (js/components/autocomplete.js).
//
// 📷 Scan de post-it par appareil photo (01/10/2026, besoin direct de Charles-Henri hors roadmap
// TODO_TECHNIQUE.md — voir js/components/ocrScan.js pour le détail produit complet). DEUX nouveaux
// fichiers ajoutés à APP_SHELL ci-dessous : `js/services/ocr.js` (wrapper Tesseract.js) et
// `js/components/ocrScan.js` (capture photo + relecture obligatoire avant enregistrement).
// Fichiers modifiés : `js/components/stickyNoteShared.js` (bouton "📷" sur un post-it existant),
// `js/components/bureau.js` (bouton "📷 Scanner" à côté de "+ Nouveau post-it"), `styles/
// components.css` (bouton de scan superposé sur la zone de texte).
// Volontairement PAS d'ajout de `vendor/tesseract/**` à APP_SHELL — même principe que
// `illustrations/**/*.png` (LOT G9 ci-dessus) : plusieurs dizaines de Mo au total (moteur wasm en
// 4 variantes + données de langue française), jamais précachés d'office pour un utilisateur qui ne
// scannera peut-être jamais de post-it ; mis en cache par la stratégie générique cache-first de ce
// fichier (voir "fetch" plus bas) dès le premier scan réussi. Ces fichiers ne sont d'ailleurs pas
// encore présents dans ce dépôt au moment de cette livraison — à ajouter manuellement par
// Charles-Henri (voir claude/vendor-tesseract-instructions-01-10-2026.md), le bac à sable utilisé
// pour écrire ce code n'ayant pas d'accès réseau vers npm/les CDN publics pour les récupérer lui-
// même. Tant qu'ils ne sont pas en place, le bouton de scan échoue proprement avec un message
// d'erreur explicite plutôt qu'un plantage silencieux (voir js/services/ocr.js).
//
// 📡 Veille — écran "accès centralisé" (01-02/10/2026, besoin direct de Charles-Henri, hors
// roadmap TODO_TECHNIQUE.md — voir claude/sources-veille-02-10-2026.md pour toute la réflexion
// qui a précédé ce code). DEUX nouveaux fichiers ajoutés à APP_SHELL ci-dessous :
// `js/domain/veille.js` (collection `veilleSources` + liste de départ proposée) et
// `js/views/veille.js` (écran accessible depuis ☰ Plus → 📡 Veille). Fichiers modifiés :
// `js/app.js` (route `#/veille`), `js/services/navConfig.js` (module pinnable dans la barre
// principale, comme Ressources/Prompts), `js/views/more.js` (ligne dans le groupe
// "Bibliothèques"), `js/views/guide.js` (nouvelle rubrique "📡 Comment faire sa veille" —
// explique la méthode une seule fois, pendant que l'écran Veille ne porte que la liste de
// sources elle-même, pour ne pas dupliquer le texte à deux endroits qui finiraient par diverger).
//
// 🔍 Détection de nouveautés par site (02/10/2026, suite directe du point ci-dessus — retour de
// Charles-Henri : "comment rendre cette analyse paramétrable par site"). Aucun flux RSS
// exploitable pour la plupart des sources (vérifié site par site, abandonné explicitement :
// "Laisse tomber pour les flux") — remplacé par une détection de CHANGEMENT DE PAGE, paramétrable
// par source (URL à surveiller, sélecteur CSS de la zone à comparer), testable avant
// enregistrement, et toujours déclenchée manuellement. Aucun nouveau fichier : modifications dans
// `js/domain/veille.js` (fonctions de vérification + proxy CORS gratuit), `js/views/veille.js`
// (bouton "🔍 Vérifier", badge "🆕", section de configuration/test dans la fiche d'édition),
// `styles/components.css` (`.badge-new`) et `js/views/guide.js` (explication ajoutée à la
// rubrique "📡 Comment faire sa veille" existante). `CACHE_NAME` incrémenté car le contenu de ces
// fichiers déjà précachés a changé, même si APP_SHELL lui-même ne gagne aucune nouvelle entrée.
//
// Correctif (02/10/2026, retour de Charles-Henri après premier test réel sur SEMAE : "⚠️ Échec de
// récupération") : un seul proxy CORS public n'offrait aucune garantie de disponibilité — certains
// sites bloquent même carrément les proxys les plus connus. `js/domain/veille.js` essaie
// désormais plusieurs proxys dans l'ordre (le premier qui répond est utilisé) et garde la trace
// de ce qui a été tenté (`lastCheckDetail`) pour que l'échec reste diagnosticable, affiché par
// `js/views/veille.js` à côté du message d'erreur existant. `CACHE_NAME` incrémenté en
// conséquence.
//
// 3e proxy ajouté (02/10/2026, même jour) : confirmé par le retour détaillé de Charles-Henri
// (erreur Cloudflare 522 sur allorigins — vraie panne du service, pas un blocage réseau) que les 2
// proxys précédents peuvent tomber en même temps. `corsproxy.io` ajouté en secours dans
// `js/domain/veille.js`. `CACHE_NAME` incrémenté en conséquence.
//
// Aide "à la demande" sur le sélecteur CSS (02/10/2026, même jour) : Charles-Henri a trouvé son
// premier sélecteur via F12 et a demandé la démarche à suivre, intégrée directement dans
// `js/views/veille.js` (ⓘ à côté du champ "Sélecteur CSS", même composant que le reste de l'app —
// js/components/infoTip.js, déjà précaché) plutôt que seulement répondue en conversation. Aucun
// nouveau fichier. `CACHE_NAME` incrémenté car le contenu de `js/views/veille.js` a changé.
//
// Nouvelle rubrique Guide "🛠️ Mettre en place sa veille externe" (02/10/2026, même jour, demande
// explicite de Charles-Henri) : la mise en place pas à pas de Feedly, Google Alertes et le dossier
// mail dédié, jusque-là seulement évoquée en une phrase dans "📡 Comment faire sa veille" — cette
// phrase renvoie désormais vers la nouvelle rubrique plutôt que de dupliquer l'explication.
// `js/views/guide.js` et `js/views/whatsnew.js` (nouvelle entrée) modifiés, aucun nouveau
// fichier. `CACHE_NAME` incrémenté en conséquence.
//
// Simplification de la bulle d'aide "Sélecteur CSS" de l'écran Veille (02/10/2026, retour direct
// de Charles-Henri après un cas réel de debug sur la source SEMAE) : remplace la méthode manuelle
// pas à pas (remonter balise par balise en tapant $0.className à chaque étape) par un script
// console unique à coller, qui remonte automatiquement toute l'arborescence depuis l'élément
// cliqué et affiche classe/id + taille + aperçu à chaque niveau — l'utilisateur n'a plus qu'à lire
// le résultat pour repérer où s'arrêter. Exemple réel ajouté (cas SEMAE : classe générique écartée
// car réutilisée ailleurs, sélecteur final retenu `#contents`). Contenu purement textuel/HTML dans
// `js/views/veille.js`, aucun nouveau fichier. Pas d'entrée "quoi de neuf" pour ce changement : la
// fonctionnalité (bulle d'aide elle-même) a déjà été annoncée en v100, ceci n'en est qu'une
// clarification du contenu. `CACHE_NAME` incrémenté car `js/views/veille.js` a changé.
//
// Retrait de corsproxy.io de la liste des proxys de détection de nouveautés (02/10/2026, même
// jour) : test réel de Charles-Henri en ouvrant l'URL du proxy directement dans son navigateur →
// réponse `{"error":"A valid API key is required. ..."}`. Le service exige maintenant une
// inscription/clé, ce n'était pas une panne passagère. Retour à la paire allorigins + codetabs
// (celle qui existait avant son ajout), qui vient de fonctionner sur un test réel (source
// Terre-net). Correction d'un changement de ce même jour, pas une nouvelle fonctionnalité : pas
// d'entrée "quoi de neuf". `js/domain/veille.js` modifié, aucun nouveau fichier.
//
// Bulle d'aide "Sélecteur CSS" complétée (02/10/2026, même jour) : nouvelle étape pour le cas
// d'un sélecteur ambigu (plusieurs occurrences) — chercher un repère unique tout près de
// l'élément (ancre de menu/sommaire, `$0.previousElementSibling`, recherche dans le code source)
// plutôt que de s'arrêter à `:nth-of-type`. Exemple réel SEMAE mis à jour avec le sélecteur final
// effectivement trouvé et confirmé (`a[name="actualites-reglementaires"] + section .texte`),
// remplaçant l'exemple précédent qui s'arrêtait au compromis `#contents`. Contenu textuel/HTML
// dans `js/views/veille.js`, aucun nouveau fichier. Pas d'entrée "quoi de neuf" : clarification
// de contenu déjà annoncé, pas une nouvelle fonctionnalité. `CACHE_NAME` incrémenté pour les deux
// changements ci-dessus (le premier n'avait pas encore été accompagné d'un incrément).
//
// Veille concurrentielle enrichie (02/10/2026, même jour, demande directe de Charles-Henri : "je
// dois pouvoir [...] retrouver [les concurrents] avec leur CA, évolutions, nouveautés [...] en se
// basant sur différents site linkedin, pappers, le site officiel" + "je veux pouvoir en
// rechercher d'autres si besoin par rapport à des mots clé" + benchmark). Quatre questions posées
// explicitement avant de coder (emplacement, mode de collecte, découverte, forme du benchmark) —
// voir js/domain/veille.js#competitorResearchPrompt pour le détail des réponses retenues. Pilotage
// restant une app 100% navigateur sans serveur (ne peut interroger ni LinkedIn ni Pappers tout
// seul), le choix retenu est : Pilotage stocke les champs structurés (`ca`, `linkedinUrl`,
// `pappersUrl` sur chaque source) et sert de mémoire ; la recherche elle-même passe par une
// demande préparée en un clic ("📋 Générer la demande de recherche" sur une fiche concurrent,
// "🔎 Chercher de nouveaux concurrents" par mot-clé en haut de la section) à coller dans une
// conversation avec Claude, qui fait la vraie recherche. Un bouton "📊 Benchmark" compile les
// fiches concurrence déjà renseignées en un tableau comparatif (réutilise `.pilotage-table` de
// styles/components.css, déjà utilisé par la vue Tableau du Kanban). `js/domain/veille.js`
// (nouveaux champs + 2 fonctions de génération de texte), `js/views/veille.js` (champs, 2
// nouvelles modales, boutons de section) et `js/views/whatsnew.js` (nouvelle entrée) modifiés,
// aucun nouveau fichier. `CACHE_NAME` incrémenté en conséquence.
//
// Fiche concurrent "face à Agreo" (02/10/2026, même jour, suite directe de la veille
// concurrentielle enrichie ci-dessus — demande directe de Charles-Henri : "une étude de leur
// marché, un SWOT [...] pour chacun pouvoir éditer une fiche qui résume ce qu'ils sont et par
// rapport a Agreo, la force d'Agreo et leur force a eux, faiblesses"). Quatre nouveaux champs
// texte libre sur chaque source concurrence (`profileSummary`, `competitorStrengths`,
// `competitorWeaknesses`, `agreoStrengths`), dans une section dépliable "🎯 Fiche comparative
// face à Agreo" de la fiche d'édition existante — même emplacement que CA/LinkedIn/Pappers
// ci-dessus, pas un nouvel écran. Benchmark complété d'une colonne "Positionnement" (résumé
// court). L'analyse textuelle complète (étude de marché + SWOT + comparaison par concurrent)
// livrée à part en tant que doc de référence, ces 4 champs servant à en garder une version
// éditable et consultable directement dans Pilotage, comme demandé. `js/domain/veille.js`
// (nouveaux champs), `js/views/veille.js` (section de fiche + colonne benchmark) et
// `js/views/whatsnew.js` (nouvelle entrée) modifiés, aucun nouveau fichier. `CACHE_NAME`
// incrémenté en conséquence.
const CACHE_NAME = "pilotage-cache-v105";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  // BUG corrigé (15/09/2026, audit "usage en mode déconnecté") : référencées par manifest.json
  // et index.html (icône d'onglet/écran d'accueil) et par js/app.js (icône de notification),
  // mais jamais précachées jusqu'ici — un utilisateur parti hors-ligne avant que le navigateur
  // les ait chargées une première fois voyait une icône cassée. Purement cosmétique, pas
  // bloquant pour le fonctionnement de l'app, mais autant le corriger tant qu'on y est.
  "./icons/icon-192.png",
  "./icons/icon-192-maskable.png",
  "./icons/icon-512.png",
  "./styles/tokens.css",
  "./styles/components.css",
  "./js/app.js",
  "./js/services/id.js",
  "./js/services/storage.js",
  "./js/services/firebase.js",
  "./js/services/deeplink.js",
  "./js/services/draftStore.js",
  "./js/services/pomodoroStore.js",
  "./js/services/pilotageViewStore.js",
  "./js/services/shortcuts.js",
  "./js/services/usageTracking.js",
  "./js/services/accountAdmin.js",
  "./js/services/themeStore.js",
  // Nouveau fichier (28/09/2026, ad hoc — Thème cosmétique équipé, voir le commentaire daté
  // juste au-dessus de CACHE_NAME) : ajouté à APP_SHELL dès sa création, même règle que tous les
  // nouveaux fichiers précédents de ce document.
  "./js/services/gamificationThemeStore.js",
  "./js/services/dateUtils.js",
  "./js/services/onlineStatus.js",
  "./js/services/navConfig.js",
  // Nouveaux fichiers (28/09/2026, "petite parenthèse" Objectifs/EADP, voir le commentaire daté
  // juste au-dessus de CACHE_NAME) : générateurs PDF/XLSX vanilla sans dépendance.
  "./js/services/pdfWriter.js",
  "./js/services/xlsxWriter.js",
  // Nouveau fichier (29/09/2026, LOT G9 — détection automatique des illustrations réelles, voir
  // le commentaire daté juste au-dessus de CACHE_NAME) : ajouté à APP_SHELL dès sa création, même
  // règle que tous les nouveaux fichiers précédents de ce document.
  "./js/services/illustrations.js",
  // Nouveau fichier (01/10/2026, scan de post-it par appareil photo, voir le commentaire daté
  // juste au-dessus de CACHE_NAME) : ajouté à APP_SHELL dès sa création, même règle que tous les
  // nouveaux fichiers précédents de ce document.
  "./js/services/ocr.js",
  "./js/domain/inbox.js",
  "./js/domain/tasks.js",
  "./js/domain/projects.js",
  "./js/domain/people.js",
  "./js/domain/followups.js",
  "./js/domain/resources.js",
  "./js/domain/meetings.js",
  "./js/domain/decisions.js",
  "./js/domain/history.js",
  "./js/domain/preferences.js",
  "./js/domain/links.js",
  "./js/domain/tags.js",
  "./js/domain/templates.js",
  "./js/domain/objectives.js",
  // Nouveau fichier (28/09/2026, "petite parenthèse" Objectifs/EADP, voir le commentaire daté
  // juste au-dessus de CACHE_NAME) : orchestration des exports PDF/Excel des Objectifs.
  "./js/domain/objectivesExport.js",
  "./js/domain/prompts.js",
  "./js/domain/casquettes.js",
  "./js/domain/convert.js",
  "./js/domain/priorisation.js",
  "./js/domain/workload.js",
  "./js/domain/projectHealth.js",
  "./js/domain/stickyNotes.js",
  // Nouveau fichier (01-02/10/2026, écran Veille, voir le commentaire daté juste au-dessus de
  // CACHE_NAME) : ajouté à APP_SHELL dès sa création, même règle que tous les nouveaux fichiers
  // précédents de ce document.
  "./js/domain/veille.js",
  "./js/components/modal.js",
  // BUG corrigé (21/09/2026, même correctif que le bump de CACHE_NAME ci-dessus) : ce fichier
  // (LOT 1, TODO-006, "validation partagée") n'avait jamais été ajouté ici depuis sa création —
  // importé par kanban.js/projects.js/resources.js mais absent du précache, donc vulnérable à un
  // aller-réseau raté avant son premier chargement réussi, exactement la classe de bug déjà
  // documentée plus haut pour d'autres fichiers oubliés.
  "./js/components/formValidation.js",
  "./js/components/changeType.js",
  "./js/components/toast.js",
  "./js/components/hint.js",
  "./js/components/infoTip.js",
  "./js/components/notesBlock.js",
  "./js/components/checklist.js",
  "./js/components/meetingLauncher.js",
  "./js/components/suggestNextStep.js",
  "./js/components/recipes.js",
  "./js/components/capture.js",
  "./js/components/historyTimeline.js",
  "./js/components/onboarding.js",
  "./js/components/search.js",
  "./js/components/linkedItems.js",
  "./js/components/tagsEditor.js",
  // Ajouté le 29/09/2026 (TODO-031) : composant d'autocomplétion partagé qui remplace le
  // <datalist> natif aux 4 endroits qui l'utilisaient — voir son en-tête pour le détail.
  "./js/components/autocomplete.js",
  // Nouveau fichier (01/10/2026, scan de post-it par appareil photo, voir le commentaire daté
  // juste au-dessus de CACHE_NAME) : ajouté à APP_SHELL dès sa création, même règle que tous les
  // nouveaux fichiers précédents de ce document.
  "./js/components/ocrScan.js",
  "./js/components/canevas.js",
  "./js/components/weeklyReview.js",
  "./js/components/pomodoroWidget.js",
  "./js/components/adminPanel.js",
  "./js/components/copyLink.js",
  "./js/components/inboxBadge.js",
  "./js/components/whatsNewBadge.js",
  "./js/components/pilotageSubNav.js",
  "./js/components/duplicateTask.js",
  "./js/components/decisionGrid.js",
  "./js/components/projectHealth.js",
  "./js/components/bureau.js",
  "./js/components/stickyNoteShared.js",
  "./js/components/pinnedNotesOverlay.js",
  // Nouveaux fichiers (28/09/2026, LOT G10, voir le commentaire daté juste au-dessus de CACHE_NAME).
  "./js/components/rewardOrchestrator.js",
  "./js/components/progressionCard.js",
  "./js/views/dashboard.js",
  "./js/views/inbox.js",
  "./js/views/kanban.js",
  "./js/views/projects.js",
  "./js/views/people.js",
  "./js/views/management.js",
  "./js/views/calendar.js",
  "./js/views/resources.js",
  "./js/views/prompts.js",
  // Nouveau fichier (01-02/10/2026, écran Veille, voir le commentaire daté juste au-dessus de
  // CACHE_NAME) : ajouté à APP_SHELL dès sa création, même règle que tous les nouveaux fichiers
  // précédents de ce document.
  "./js/views/veille.js",
  "./js/views/more.js",
  "./js/views/guide.js",
  "./js/views/whatsnew.js",
  "./js/views/memory.js",
  "./js/views/gamification.js",
  // Nouveau fichier (28/09/2026, LOT G10, voir le commentaire daté juste au-dessus de CACHE_NAME).
  "./js/views/recompenses.js",
  "./js/views/login.js",
  "./js/views/prepMask.js",
  "./js/views/followupsOverview.js",
  "./js/views/priorisation.js",
  "./js/views/workload.js",
  "./js/views/projectHealth.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const results = await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));
      const failed = results.map((r, i) => (r.status === "rejected" ? APP_SHELL[i] : null)).filter(Boolean);
      if (failed.length) {
        console.error("[sw] Fichiers non précachés à l'installation :", failed);
      }
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

// BUG corrigé (retour de Charles-Henri, vague 22 septies : "Cannot read properties of
// undefined (reading 'startTime')" côté navigateur ET la fenêtre de masquage restée bloquée
// sur "Chargement…") — deux problèmes cumulés :
//
// 1. `APP_SHELL` ci-dessus n'avait jamais été mis à jour avec les fichiers ajoutés pendant
//    cette vague (`overviewExport.js`, `adminPanel.js`, `prepMask.js`) — à l'inverse de toutes
//    les vagues précédentes, où `CACHE_NAME` ET la liste étaient systématiquement mis à jour
//    ensemble (voir l'historique de ce fichier). Corrigé en les ajoutant et en incrémentant
//    `CACHE_NAME`, ce qui force une réinstallation propre du cache chez tout le monde.
// 2. Plus fondamentalement, le repli en cas d'échec réseau ci-dessous retombait TOUJOURS sur
//    `index.html` en dernier recours — y compris pour un fichier `.js` qui ne serait pas
//    trouvé (nouveau fichier jamais mis en cache, ou raté réseau ponctuel). Le navigateur reçoit
//    alors du HTML là où il attendait un module JavaScript, ce qui fait échouer le CHARGEMENT
//    ENTIER du module (`js/app.js` et toute la chaîne d'imports) sans qu'aucun code applicatif
//    n'ait la moindre chance de s'exécuter — d'où l'écran bloqué indéfiniment sur le
//    "⏳ Chargement…" statique d'index.html, puisque rien n'est jamais venu le remplacer.
//    Corrigé en ne repliant vers `index.html` QUE pour une navigation (`mode === "navigate"`,
//    ex. ouvrir l'app ou cette fenêtre de masquage) — jamais pour un script, une feuille de
//    style ou tout autre required asset, où un échec doit rester un échec réseau normal et
//    visible plutôt que d'être masqué par une réponse qui n'a rien à voir.
//
// (L'erreur "reportAllChanges"/"startTime" rapportée en même temps ne provient d'aucun fichier
// de ce dépôt — probablement un script de mesure de performance injecté par l'hébergeur
// [Cloudflare] ou une extension du navigateur, sans lien avec ce correctif.)
//
// BUG corrigé (retour de Charles-Henri, vague 22 novies : la fenêtre "Avant de partager" charge
// bien ses éléments, mais "au bout d'une minute facile") — la stratégie ci-dessus était
// "network-first" pour TOUT, y compris les ~65 fichiers de `APP_SHELL` déjà précachés à
// l'installation (voir "install" plus haut) : chaque fichier JS/CSS attendait donc une réponse
// réseau complète avant d'être utilisé, le cache n'intervenant qu'en dernier recours (réseau en
// échec), alors qu'il contient pourtant déjà tout. `js/app.js` important statiquement TOUTES les
// vues de l'appli (dont cette fenêtre de masquage hérite forcément, puisqu'elle recharge l'appli
// entière sur sa propre route — voir js/views/people.js#openPrepMaskThenPrep), un chargement,
// quel qu'il soit, déclenche donc des dizaines d'allers-retours réseau séquentiels avant de
// pouvoir exécuter la moindre ligne de code — lent par nature dès que le réseau n'est pas
// excellent, et complètement inutile puisque le cache est déjà à jour la plupart du temps.
//
// Corrigé en séparant deux stratégies distinctes selon le type de requête :
// - Navigation (`mode === "navigate"`, ouvrir l'app ou cette fenêtre) : network-first inchangé,
//   pour toujours obtenir le `index.html` le plus frais possible (fichier minuscule, le coût
//   réseau est négligeable) et détecter une future mise à jour au plus tôt.
// - Tout le reste (scripts, styles, etc.) : cache-first — la réponse en cache est retournée
//   IMMÉDIATEMENT si elle existe (cas normal une fois l'app installée), pendant qu'une requête
//   réseau se poursuit en tâche de fond pour rafraîchir discrètement le cache pour la PROCHAINE
//   fois (jamais pour la réponse déjà envoyée). Sans danger de rester bloqué sur une vieille
//   version : `CACHE_NAME` est incrémenté à chaque vague qui change du code, ce qui vide et
//   reconstruit tout le cache au prochain démarrage (voir "activate" plus haut).
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          // BUG corrigé (retour de Charles-Henri, vague 42, 09/09/2026 : nouveaux fichiers
          // affichés avec un encodage cassé / rejetés comme module script "text/html") — cette
          // mise en cache ne vérifiait jamais `response.ok` avant d'enregistrer la réponse.
          // Un fichier requêté juste avant la fin de la propagation d'un déploiement (ou
          // n'existant pas encore) reçoit alors la page de repli SPA (200 OK, mais le mauvais
          // contenu) — mise en cache SOUS L'URL DU VRAI FICHIER, donc servie en boucle pour de
          // bon ensuite, même une fois le vrai fichier disponible sur le serveur. Seule une
          // réponse effectivement réussie (2xx) est désormais mise en cache ; une erreur (404,
          // 5xx) repart au réseau à la prochaine tentative au lieu de s'y figer.
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => undefined);
      // Réponse en cache immédiate si disponible (cas normal) ; sinon on attend le réseau —
      // seul un fichier jamais mis en cache ET injoignable échoue, proprement (Response.error()).
      return cached || networkFetch.then((response) => response || Response.error());
    })
  );
});
