# AUDIT_UX.md — Audit UX complémentaire (point de vue d'un manager, usage quotidien)

Date : 15/09/2026
Périmètre : complément à `AUDIT_USAGE_EFFICACITE.md` (déjà présent dans ce dépôt). Lecture seule stricte, aucune modification de code.
Méthode : chaque axe demandé a d'abord été confronté au contenu de `AUDIT_USAGE_EFFICACITE.md` ; ce qui y est déjà documenté n'est pas répété ici, seulement référencé. Seuls les faits non couverts par cet audit précédent font l'objet d'une fiche UX-XXX dans ce document. Étiquetage systématique OBSERVÉ / DÉDUIT / HYPOTHÈSE.

> **Numérotation** : les identifiants `UX-XXX` de ce document sont une séquence propre à `AUDIT_UX.md`, indépendante de celle d'`AUDIT_USAGE_EFFICACITE.md` (qui utilise aussi `UX-001…UX-027` en interne). Ne pas confondre les deux fichiers lors d'une correction future — toujours préciser le document source.

---

## Ce qui est déjà couvert et n'est pas répété ici

- **Capture rapide** : entièrement auditée (AUDIT_USAGE_EFFICACITE.md section 5) — un seul champ obligatoire, auto-sauvegarde, saisie en lot, FAB + `Alt+N`. Aucun problème nouveau trouvé dans ce complément.
- **Création de tâche** : formulaire, validation silencieuse, absence de bouton dédié, niveaux JIT (section 6, UX-001/002/003/004/005/009/010/011). Non répété, sauf le point clavier nouveau (absence d'autofocus, section "Usage clavier" ci-dessous).
- **Recherche** : couverte en profondeur section 11 (UX-006, UX-013). Le seul point nouveau ici porte sur le raccourci clavier `Alt+9` non documenté (section "Usage clavier").
- **Navigation générale** (rubriques, redondances Priorisation/Kanban, Management invisible) : section 16, UX-020/021/022. Non répété.
- **Suivi global** (Suivis/FollowUp sans action rapide, sans notification de retard de contrôle) : section 13-14, UX-005/UX-SYS-001/UX-SYS-006. Non répété, sauf l'angle "fiabilité pratique de la notification" détaillé plus loin qui va au-delà de ce qui avait été établi.
- **Charge cognitive / nombre de clics** : déjà quantifiés situation par situation (sections 6-14, 18). Ce document ajoute des mesures sur des écrans non chiffrés précédemment (Ressources, Priorisation, Calendrier) sans reprendre les tableaux déjà publiés.

---

## 1. Modification (édition d'un objet existant)

Déjà couvert en grande partie (validation silencieuse à l'édition, UX-002 étendu à `openTaskDetail`). Point nouveau, transverse à toute modification via une modale :

### UX-001 — Aucun retour de focus ni piège de focus dans les modales d'édition
- **Gravité** : Moyenne
- **Écran/fonction** : `js/components/modal.js`, `openModal()`/`close()` — utilisé par toutes les fiches de modification (tâche, projet, suivi, ressource, etc.)
- **Problème** : `Tab`/`Shift+Tab` ne sont pas piégés dans la modale ouverte ; en sortant du dernier champ, le focus part vers des éléments de fond (barre de navigation, FAB) visuellement masqués mais toujours présents dans le DOM. À la fermeture, le focus n'est jamais restitué à l'élément qui avait ouvert la modale.
- **Impact utilisateur** : un utilisateur naviguant au clavier peut perdre son repère après chaque modification (tâche, projet, suivi, ressource...) et, dans de rares cas, activer un contrôle de fond sans le voir pendant qu'une fiche est ouverte.
- **Amélioration proposée** : ajouter un piège de focus standard (`Tab` cyclique à l'intérieur de la modale) et restituer le focus à l'élément déclencheur à la fermeture.
- **Effort** : S/M (un seul composant partagé, `modal.js`, bénéficie à toutes les modales de l'app)
- **Dépendances** : aucune

### UX-002 — Perte de saisie sans avertissement via la touche Échap
- **Gravité** : Moyenne
- **Écran/fonction** : `js/components/modal.js` (gestion de `Escape`, comparé à la protection existante sur clic en dehors)
- **Problème** : depuis un correctif du 09/09/2026, cliquer en dehors d'une modale contenant une saisie non vide est bloqué (animation "nudge"). La touche `Échap`, elle, ferme systématiquement la modale, y compris avec une saisie en cours, sans aucun avertissement — choix documenté comme volontaire dans le code mais non signalé à l'écran.
- **Impact utilisateur** : un réflexe `Échap` (courant, souvent pressé par automatisme) peut faire perdre un titre de tâche ou un objectif de projet en cours de saisie, alors que le même contenu est protégé au clic souris — incohérence invisible pour l'utilisateur.
- **Amélioration proposée** : appliquer la même protection à `Échap` qu'au clic en dehors (ou, a minima, documenter ce choix par un indice visuel discret).
- **Effort** : S
- **Dépendances** : aucune

---

## 2. Priorisation

### UX-003 — Réglage des poids sans retour visuel immédiat
- **Gravité** : Faible/Moyenne
- **Écran/fonction** : `js/views/priorisation.js`, `openWeightsModal()` (curseurs urgence/impact/blocage)
- **Problème** : déplacer un curseur de poids n'affiche que la valeur numérique brute ; le classement (matrice + liste) ne se recalcule qu'après clic sur "Enregistrer" et fermeture de la modale.
- **Impact utilisateur** : impossible de "tester" un réglage avant de valider — l'utilisateur règle à l'aveugle, sauvegarde, constate le résultat, et doit rouvrir la modale pour ajuster de nouveau si besoin. Va à l'encontre de l'objectif affiché de l'écran (comprendre pourquoi une tâche remonte).
- **Amélioration proposée** : recalculer et afficher un aperçu du classement pendant le glissement du curseur, avant validation.
- **Effort** : M
- **Dépendances** : aucune

### UX-004 — Liste complète de priorisation sans pagination
- **Gravité** : Faible
- **Écran/fonction** : `js/views/priorisation.js`, `renderList()` — seule la matrice graphique est plafonnée à 8 tâches, la liste textuelle en dessous ne l'est pas
- **Problème** : au-delà d'un certain volume de tâches actives, la liste s'allonge sans limite ni pagination.
- **Impact utilisateur** : écran de plus en plus long à faire défiler à mesure que le nombre de tâches actives croît.
- **Amélioration proposée** : appliquer une pagination ou un "afficher plus" au-delà d'un seuil (ex. 20-30 lignes).
- **Effort** : S
- **Dépendances** : aucune

*Rappel (déjà dans AUDIT_USAGE_EFFICACITE.md, non répété en fiche) : le Dashboard réutilise déjà la même formule de tri (`priorisationApi.rankTasks`) pour le "Focus du jour" — un manager n'a pas besoin d'ouvrir cet écran pour ses tâches prioritaires du jour, seulement pour régler les poids ou voir le classement intégral.*

---

## 3. Calendrier

### UX-005 — Aucun filtre disponible sur le Calendrier
- **Gravité** : Moyenne
- **Écran/fonction** : `js/views/calendar.js`
- **Problème** : les 4 types d'éléments affichés (Tâche, Réunion, Décision, Suivi) apparaissent tous mélangés, sans filtre par projet, par personne ou par type. Seule exclusion existante : les projets clôturés (filtrage technique invisible, non pilotable).
- **Impact utilisateur** : un manager qui veut voir uniquement les suivis d'une personne ou les échéances d'un projet donné sur le calendrier ne le peut pas — il doit visuellement trier lui-même parmi tout ce qui s'affiche.
- **Amélioration proposée** : ajouter des filtres simples (type, projet, personne) au-dessus de la grille, cohérents avec ceux déjà présents ailleurs dans l'app (Kanban, Ressources).
- **Effort** : M
- **Dépendances** : aucune

### UX-006 — Impossible de créer un événement depuis le Calendrier
- **Gravité** : Moyenne
- **Écran/fonction** : `js/views/calendar.js`, `openDayAgenda()`
- **Problème** : cliquer sur un jour (vide ou rempli) n'ouvre qu'une liste de consultation ; aucun bouton de création n'existe nulle part dans cet écran. Créer un objet pour une date précise oblige à passer par un autre écran (Kanban, Inbox, fiche Projet/Personne), sans que la date cliquée soit reportée dans le formulaire cible.
- **Impact utilisateur** : le Calendrier fonctionne comme un écran de consultation/replanification pur, pas comme point d'entrée de création — contre-intuitif pour un manager habitué à cliquer un jour vide pour y poser un rendez-vous.
- **Amélioration proposée** : ajouter un point de création rapide sur un jour (au moins pour Tâche/Réunion), avec la date pré-remplie.
- **Effort** : M
- **Dépendances** : formulaires de création existants (`openCreateTaskModal`, création de réunion) peuvent être réutilisés tels quels avec un `prefill` de date

### UX-007 — Troncature incohérente entre vue Mois et vue Semaine
- **Gravité** : Faible
- **Écran/fonction** : `js/views/calendar.js`, `renderMonth()` (limite à 3 éléments + pastille "+N") vs `renderWeek()` (aucune limite)
- **Problème** : un même jour chargé s'affiche différemment selon la vue active (tronqué en mois, complet en semaine), sans que l'utilisateur choisisse cette différence consciemment.
- **Impact utilisateur** : incohérence de densité perçue entre les deux vues du même écran.
- **Amélioration proposée** : harmoniser (ex. appliquer la même logique de troncature + "voir tout" dans les deux vues).
- **Effort** : S
- **Dépendances** : aucune

### UX-008 — Calendrier à 2 clics minimum depuis n'importe quel écran
- **Gravité** : Faible
- **Écran/fonction** : navigation (`js/app.js`, `js/components/pilotageSubNav.js`)
- **Problème** : la barre de navigation du bas mène toujours à "Pilotage" (Kanban/Tâches) en premier ; le Calendrier n'est accessible qu'en second niveau (sous-nav à 4 chips).
- **Impact utilisateur** : un manager qui consulte fréquemment son calendrier (usage quotidien plausible) fait systématiquement un détour par l'écran Tâches.
- **Amélioration proposée** : Non déterminé si un accès direct est souhaitable — dépend de la fréquence réelle d'usage du Calendrier par rapport au Kanban (à valider avec l'utilisateur, voir section finale).
- **Effort** : S (si retenu)
- **Dépendances** : aucune

---

## 4. Rappels

### UX-009 — Notification de retard non fiable en pratique (app fermée)
- **Gravité** : Haute
- **Écran/fonction** : `js/app.js`, `maybeNotifyStalledOrLate()` ; `sw.js` (aucun listener `push`)
- **Problème** : la notification n'est vérifiée qu'une fois, au montage de l'app (`mountApp()`), plafonnée à 1×/jour, sans aucun minuteur de re-vérification si l'onglet reste ouvert en continu, et sans heure programmable. Le service worker ne comporte aucune infrastructure Web Push (confirmé par lecture intégrale de `sw.js`) : app fermée, aucune alerte ne peut techniquement atteindre l'utilisateur, ce que le code reconnaît lui-même en commentaire ("pas un vrai push... faute d'infrastructure serveur").
- **Impact utilisateur** : contrairement à un rappel de calendrier/mail classique, ce système ne peut jamais "aller chercher" le manager — il ne fonctionne que s'il rouvre activement l'app le jour même. Un retard accumulé plusieurs jours sans ouverture de l'app ne génère aucune alerte a posteriori.
- **Amélioration proposée** : Non déterminé si une infrastructure Web Push complète est justifiée au regard de l'effort (nécessite un serveur) — à arbitrer avec l'utilisateur ; a minima, documenter clairement cette limite dans l'app elle-même (le bandeau d'opt-in ne mentionne pas cette réserve).
- **Effort** : L (vraie solution Web Push) / S (mention explicite de la limite)
- **Dépendances** : infrastructure serveur si Web Push complet est retenu

### UX-010 — Opt-in de notification irréversible depuis l'interface
- **Gravité** : Moyenne
- **Écran/fonction** : `js/views/dashboard.js` (bandeau opt-in), `js/domain/preferences.js` (`setNotifOptIn`)
- **Problème** : une fois la question "Activer les notifications ?" tranchée (Oui ou Non), le bandeau ne réapparaît jamais et aucun écran de réglages ne permet de revenir sur ce choix (recherche exhaustive des appelants de `setNotifOptIn` : seuls les deux boutons du bandeau initial).
- **Impact utilisateur** : un manager ayant cliqué "Non merci" par réflexe au premier lancement n'a plus aucun moyen, dans l'interface, de réactiver l'alerte plus tard.
- **Amélioration proposée** : ajouter un contrôle dans un écran de préférences pour activer/désactiver ce choix à tout moment.
- **Effort** : S
- **Dépendances** : aucune

### UX-011 — Aucune notion de rappel indépendant/personnalisable
- **Gravité** : Faible (choix de conception possiblement assumé, à confirmer)
- **Écran/fonction** : absence confirmée dans `js/domain/` et `js/services/` (recherche exhaustive "reminder"/"rappel"/"alarm")
- **Problème** : tous les rappels de l'app sont des dérivés calculés d'une échéance déjà existante (`task.dueDate`, `followUp.controlDate`) ; aucune alarme autonome ("me rappeler ceci mardi à 14h", indépendamment de toute tâche) n'existe. Un champ `defaultReminder` est prévu dans le modèle de canevas (`js/domain/templates.js`) mais jamais implémenté côté interface.
- **Impact utilisateur** : un manager ne peut pas poser un rappel ponctuel sur un sujet qui n'est pas encore une tâche/un suivi formalisé.
- **Amélioration proposée** : Non déterminé si ce besoin est réel dans l'usage de Charles-Henri (la capture rapide couvre peut-être déjà ce cas d'usage autrement) — question à valider (section finale) avant toute action.
- **Effort** : Non déterminé
- **Dépendances** : Non déterminé

---

## 5. Liens vers ressources

### UX-012 — Validation du champ URL purement décorative
- **Gravité** : Moyenne
- **Écran/fonction** : `js/views/resources.js` (`openCreateResourceModal`, `openResourceDetail`), champ `type="url"`
- **Problème** : le champ porte l'attribut natif `type="url"`, mais le formulaire n'est jamais un vrai `<form>` HTML et aucun appel à `checkValidity()`/`reportValidity()` n'existe — la contrainte de format native ne se déclenche donc jamais. Une URL mal formée est enregistrée telle quelle, sans aucun signal.
- **Impact utilisateur** : un lien mal collé/mal tapé n'est jamais détecté à la saisie ; l'erreur n'apparaît qu'au moment de cliquer "Ouvrir le lien", plus tard, sans lien évident avec le moment de la saisie fautive.
- **Amélioration proposée** : valider le format à la sauvegarde (regex simple ou `new URL()` avec try/catch) et signaler l'erreur.
- **Effort** : S
- **Dépendances** : aucune

### UX-013 — Aucune récupération automatique de titre/favicon pour une ressource
- **Gravité** : Faible
- **Écran/fonction** : `js/domain/resources.js` (`detectType`)
- **Problème** : seule la détection du *type* de ressource est automatique (motifs dans l'URL) ; le titre et la description restent entièrement manuels, y compris pour un lien dont la page cible porte déjà un titre exploitable.
- **Impact utilisateur** : ajouter rapidement un lien pendant une réunion demande quand même de taper un titre soi-même.
- **Amélioration proposée** : Non déterminé — une récupération de métadonnées nécessiterait un appel réseau/proxy (coût d'infrastructure à évaluer) ; à arbitrer selon la fréquence réelle de ce geste.
- **Effort** : M/L selon approche
- **Dépendances** : éventuel service de récupération de métadonnées (hors périmètre client actuel)

### UX-014 — Deux mécanismes de liaison Ressource↔Tâche/Projet aux résultats différents
- **Gravité** : Haute
- **Écran/fonction** : `js/views/kanban.js` (section "📎 Ressources", bouton "+ Nouvelle ressource") vs `js/components/linkedItems.js` (section "🔗 Lié", bouton "+ Créer et lier")
- **Problème** : depuis la même fiche Tâche, "+ Nouvelle ressource" peuple correctement `taskIds` (la ressource apparaît dans "📎 Ressources") ; "+ Créer et lier" crée la même ressource mais ne transmet jamais l'identifiant de la fiche courante — la ressource résultante n'apparaît alors que dans "🔗 Lié", jamais dans "📎 Ressources", bien que le geste utilisateur soit perçu comme identique dans les deux cas.
- **Impact utilisateur** : incohérence de données silencieuse — un manager ne peut pas prédire, depuis l'UI, quel bouton produira quel résultat, et pourrait chercher en vain une ressource dans la mauvaise section plus tard.
- **Amélioration proposée** : transmettre systématiquement l'identifiant de la fiche d'origine (`taskId`/`projectId`) dans le chemin "+ Créer et lier", pour un comportement identique aux deux points d'entrée.
- **Effort** : S/M
- **Dépendances** : `js/components/linkedItems.js`, `js/domain/resources.js`

### UX-015 — Liste de Ressources sans pagination
- **Gravité** : Faible
- **Écran/fonction** : `js/views/resources.js`, `buildList()`
- **Problème** : identique à UX-004 (Priorisation) — aucune limite de volume, tout s'affiche en un bloc.
- **Impact utilisateur** : écran de plus en plus long avec la croissance de la bibliothèque de ressources.
- **Amélioration proposée** : pagination ou "afficher plus" au-delà d'un seuil.
- **Effort** : S
- **Dépendances** : aucune

---

## 6. Usage clavier

### UX-016 — `Alt+9` (filtre Objectif dans la recherche) fonctionnel mais non documenté
- **Gravité** : Faible
- **Écran/fonction** : `js/components/search.js` (chips de filtre) vs `js/services/shortcuts.js`/`js/views/guide.js` (liste des raccourcis)
- **Problème** : le fichier `shortcuts.js` revendique être "la seule source de vérité" pour ne jamais laisser le Guide diverger du code réel ; or le 9ᵉ type de recherche (Objectif, ajouté vague 25) répond bien à `Alt+9`, mais ni `BUILTIN_SHORTCUTS` ni le Guide ne le mentionnent (les deux s'arrêtent à 8 types).
- **Impact utilisateur** : raccourci utilisable mais indécouvrable par la documentation censée être exhaustive.
- **Amélioration proposée** : ajouter `Alt+9` à `BUILTIN_SHORTCUTS` et au texte du Guide.
- **Effort** : S
- **Dépendances** : aucune

### UX-017 — Pas d'autofocus sur les formulaires de création les plus utilisés
- **Gravité** : Faible/Moyenne
- **Écran/fonction** : `openCreateTaskModal` (kanban.js), `openCreateProjectModal` (projects.js)
- **Problème** : contrairement à la Capture rapide, la Recherche et l'édition de texte brut Inbox (qui posent toutes un `autofocus`/`.focus()` explicite), les deux formulaires de création les plus fréquents de l'app n'ont ce traitement nulle part.
- **Impact utilisateur** : un utilisateur au clavier doit faire un premier `Tab` (ou cliquer) avant de pouvoir taper, contrairement à l'expérience homogène ailleurs dans l'app.
- **Amélioration proposée** : ajouter `autofocus` (ou `.focus()` explicite) sur le champ titre/nom à l'ouverture de ces deux modales.
- **Effort** : S
- **Dépendances** : aucune

### UX-018 — Indicateur de focus clavier supprimé sur tous les champs de formulaire
- **Gravité** : Moyenne
- **Écran/fonction** : `styles/components.css`, règle `.field input:focus, .field textarea:focus, .field select:focus { outline: none; ... }`
- **Problème** : cette règle s'applique à la quasi-totalité des champs de saisie de l'app (titre de tâche, nom de projet, dates, description...) et remplace l'anneau de focus natif par un simple changement de couleur de bordure, plus faible visuellement. Un pattern plus accessible (`:focus-visible` + `outline` conservé) existe déjà dans le même fichier pour un seul composant (le sélecteur de thème) mais n'a jamais été généralisé.
- **Impact utilisateur** : navigation au clavier moins lisible sur les champs de formulaire pour un utilisateur qui s'appuie sur l'indicateur de focus pour se repérer.
- **Amélioration proposée** : généraliser le pattern `:focus-visible` déjà écrit pour le sélecteur de thème à l'ensemble des champs `.field`.
- **Effort** : S
- **Dépendances** : aucune

---

## 7. Usage mobile / responsive / lisibilité

### UX-019 — Glisser-déposer non fonctionnel au toucher (Kanban et Calendrier)
- **Gravité** : Haute
- **Écran/fonction** : `js/views/kanban.js` (cartes → colonnes), `js/views/calendar.js` (pastilles → jours) — API HTML5 Drag and Drop native, aucun repli tactile trouvé nulle part dans `js/` (recherche exhaustive de `touchstart`/`pointerdown`/bibliothèques tierces, négative)
- **Problème** : l'API HTML5 Drag and Drop (`draggable`, `dragstart`/`dragover`/`drop`) ne se déclenche pas au toucher sur Safari iOS (y compris en PWA installée), et son support est partiel/peu fiable sur Chrome Android.
- **Impact utilisateur** : sur iPhone/iPad, glisser une carte Kanban ou une pastille de calendrier au doigt ne produit très probablement aucun effet, sans aucun message d'erreur — l'utilisateur doit deviner qu'il faut se rabattre sur les boutons `‹ ›` (Kanban) ou l'ouverture de fiche (Calendrier, où aucun raccourci de report rapide n'existe par ailleurs, cf. AUDIT_USAGE_EFFICACITE.md UX-003).
- **Amélioration proposée** : ajouter un repli tactile (gestion `pointerdown`/`pointermove`/`pointerup`, ou une bibliothèque légère compatible tactile) au moins pour le Kanban.
- **Effort** : M/L
- **Dépendances** : composant à réutiliser potentiellement pour Calendrier

### UX-020 — Cibles tactiles nettement sous la taille recommandée sur des contrôles à fort usage
- **Gravité** : Haute
- **Écran/fonction** : `.kanban-move-btn` (boutons `‹ ›` de changement de statut, 28×28px — identifié par l'audit précédent comme "le geste le plus rapide de toute l'application"), `.pilotage-table-open-btn` (26×26px), `.pilotage-table-notes-add-btn` (22×22px), `.pomodoro-widget-toggle` (28×28px)
- **Problème** : ces contrôles sont nettement en dessous des ~44×44px généralement recommandés pour une cible tactile.
- **Impact utilisateur** : sur mobile, l'action la plus fréquente de l'app (changer le statut d'une tâche) est aussi l'une des cibles les plus difficiles à toucher précisément, avec un risque réel de déclencher le bouton voisin.
- **Amélioration proposée** : agrandir la zone cliquable (padding invisible autour de l'icône) sans nécessairement agrandir l'icône visible elle-même, au moins sur les tailles d'écran étroites.
- **Effort** : S/M
- **Dépendances** : aucune

### UX-021 — Aucune compensation des zones sûres (encoche/barre d'accueil) malgré `viewport-fit=cover`
- **Gravité** : Moyenne
- **Écran/fonction** : `index.html` (meta viewport), `styles/components.css` (`.topbar`, `.bottom-nav`, `.fab`) — aucune occurrence de `env(safe-area-inset-*)` dans tout le CSS
- **Problème** : `viewport-fit=cover` est déclaré (autorisant l'app à dessiner sous l'encoche/la barre d'accueil) mais aucun padding de compensation n'est appliqué à la barre du haut ni à la navigation du bas.
- **Impact utilisateur** : sur un iPhone à encoche/barre d'accueil, en mode PWA installée (`manifest.json` : `display: standalone`), risque que le titre d'écran soit trop proche de l'encoche et que la navigation du bas colle contre la barre d'accueil sans marge — non vérifié sur appareil réel (DÉDUIT).
- **Amélioration proposée** : ajouter `padding-top`/`padding-bottom: env(safe-area-inset-top/bottom)` aux éléments fixes concernés.
- **Effort** : S
- **Dépendances** : à vérifier sur un appareil physique avant/après correction

### UX-022 — Textes fonctionnels sous le seuil de lisibilité courant
- **Gravité** : Moyenne
- **Écran/fonction** : `.cal-pill`/`.cal-more` (contenu des événements du calendrier, 11px), `.nav-badge` (badge de compteur, 10px)
- **Problème** : ces textes portent une information utile (titre d'un rendez-vous, nombre d'items en attente), pas seulement décorative, mais sont affichés en dessous des 12px généralement recommandés pour du texte lisible sans zoom.
- **Impact utilisateur** : lecture plus difficile, en particulier sur petit écran ou pour un utilisateur avec une acuité visuelle réduite.
- **Amélioration proposée** : remonter ces tailles au token `--font-size-xs` (12px) a minima.
- **Effort** : S
- **Dépendances** : aucune

### UX-023 — Contraste réduit sur certains éléments (gris atténué + opacité)
- **Gravité** : Faible/Moyenne
- **Écran/fonction** : `.cal-cell-outside .cal-cell-num` (jours hors mois du calendrier, `opacity: 0.4` appliqué en plus d'une couleur déjà atténuée) et usages généraux de `--color-text-muted` sur fond clair
- **Problème** : un gris-bleu moyen déjà atténué, encore éclairci à 40% d'opacité, est un candidat concret à un contraste insuffisant (non mesuré précisément, estimation visuelle).
- **Impact utilisateur** : lisibilité réduite de ces éléments secondaires, en particulier pour un utilisateur avec une vision moins bonne ou en usage extérieur (luminosité forte).
- **Amélioration proposée** : vérifier le ratio de contraste réel et ajuster si sous le seuil recommandé (4.5:1 pour texte courant).
- **Effort** : S
- **Dépendances** : aucune

### UX-024 — Grille du Calendrier très resserrée sur petit écran
- **Gravité** : Faible
- **Écran/fonction** : `.cal-grid` (`grid-template-columns: repeat(7, 1fr)`, sans media query dédiée)
- **Problème** : sur un écran étroit (~360px), chaque colonne de jour fait environ 45-50px de large, sans bascule vers une vue plus adaptée (liste, semaine automatique).
- **Impact utilisateur** : lecture difficile de la grille mois sur petit téléphone.
- **Amélioration proposée** : Non déterminé — pourrait justifier de forcer la vue "Semaine" par défaut sous un certain seuil de largeur, à valider selon l'usage réel sur mobile.
- **Effort** : M
- **Dépendances** : aucune

---

## Synthèse — priorité et effort

| ID | Problème | Gravité | Effort | Priorité de traitement |
|---|---|---|---|---|
| UX-014 | Deux mécanismes de liaison ressource incohérents | Haute | S/M | 1 |
| UX-019 | Drag&drop non fonctionnel au toucher | Haute | M/L | 2 |
| UX-020 | Cibles tactiles trop petites (action la plus fréquente) | Haute | S/M | 2 |
| UX-009 | Notification de retard peu fiable app fermée | Haute | S (mention) / L (vraie solution) | 3 |
| UX-012 | Validation URL décorative | Moyenne | S | 4 |
| UX-018 | Focus clavier supprimé sur les champs | Moyenne | S | 4 |
| UX-005 | Aucun filtre sur le Calendrier | Moyenne | M | 5 |
| UX-006 | Pas de création depuis le Calendrier | Moyenne | M | 5 |
| UX-010 | Opt-in notification irréversible | Moyenne | S | 5 |
| UX-021 | Pas de compensation zones sûres (encoche) | Moyenne | S | 5 |
| UX-022 | Textes fonctionnels trop petits | Moyenne | S | 5 |
| UX-001, UX-002 | Focus modal / perte de saisie Échap | Moyenne | S/M | 5 |
| Autres (UX-003, 004, 007, 008, 011, 013, 015, 016, 017, 023, 024) | Divers | Faible | S/M | 6 |

---

## Questions à valider avant correction

- UX-008 (accès direct au Calendrier depuis la barre du bas) et UX-024 (vue Semaine forcée sur petit écran) dépendent de la fréquence réelle d'usage du Calendrier par Charles-Henri — à confirmer avant d'y consacrer de l'effort.
- UX-011 (rappel ponctuel indépendant) : ce besoin est-il réel, ou la Capture rapide couvre-t-elle déjà ce cas d'usage autrement ?
- UX-009 : l'effort d'une vraie infrastructure Web Push (nécessite un serveur) est-il justifié, ou une simple clarification de la limite actuelle dans l'interface suffit-elle pour l'usage réel ?
- UX-013 (récupération automatique de titre/favicon pour une ressource) : geste assez fréquent pour justifier l'effort (appel réseau/proxy) ?

---

*Fin du document. Complément à AUDIT_USAGE_EFFICACITE.md — 24 problèmes nouveaux identifiés (numérotation propre à ce fichier), aucun fichier applicatif modifié.*
