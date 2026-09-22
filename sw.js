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
const CACHE_NAME = "pilotage-cache-v66";
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
  "./js/services/dateUtils.js",
  "./js/services/onlineStatus.js",
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
  "./js/domain/prompts.js",
  "./js/domain/casquettes.js",
  "./js/domain/convert.js",
  "./js/domain/priorisation.js",
  "./js/domain/workload.js",
  "./js/domain/projectHealth.js",
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
  "./js/views/dashboard.js",
  "./js/views/inbox.js",
  "./js/views/kanban.js",
  "./js/views/projects.js",
  "./js/views/people.js",
  "./js/views/management.js",
  "./js/views/calendar.js",
  "./js/views/resources.js",
  "./js/views/prompts.js",
  "./js/views/more.js",
  "./js/views/guide.js",
  "./js/views/whatsnew.js",
  "./js/views/memory.js",
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
