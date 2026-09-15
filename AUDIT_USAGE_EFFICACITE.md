# AUDIT_USAGE_EFFICACITE.md — Audit d'usage et d'efficacité de Pilotage

Date : 15/09/2026
Périmètre : usage réel / efficacité opérationnelle — **pas** un audit esthétique.
Méthode : lecture directe du code (vues, domaine, composants), aucune modification. Chaque affirmation est étiquetée **OBSERVÉ** (vu directement dans le code), **DÉDUIT** (conséquence logique d'un fait observé) ou **HYPOTHÈSE** (plausible, à confirmer par observation réelle de l'utilisateur). Une hypothèse n'est jamais présentée comme un fait.

---

## 1. Résumé exécutif

Pilotage n'est pas un gestionnaire de tâches générique : le code montre, à de nombreux endroits, une intention explicite de coller aux besoins réels de Charles-Henri (commentaires citant ses propres exemples, "Tâche ou Suivi ?", séparation volontaire capture/qualification, écran de préparation de point 1:1). La **capture rapide** (Situation 1) est le point le plus abouti de l'application : un seul champ obligatoire, une seule action, correctifs itératifs documentés en commentaires (ex. retour utilisateur "9 choix d'un coup à la qualification, c'est trop").

Le problème dominant n'est pas l'absence de fonctionnalités mais une **asymétrie systématique entre les entités** : ce qui est rapide et bien traité pour la Tâche (statut à 1 clic, badge de retard, notification) ne l'est presque jamais pour le Suivi (aucune action rapide, aucune notification de retard de contrôle) ; ce qui est visible pour un Projet (bouton de création permanent, score de santé calculé) ne l'est pas toujours là où la décision se prend (le score de santé, par exemple, existe mais est invisible dans la fiche projet elle-même). Un deuxième thème récurrent est le **silence du système** : validation de formulaire qui échoue sans aucun signal visuel, catégorie de projet qui se duplique sans confirmation, clôture qui ne demande jamais le résultat obtenu alors que c'est une exigence explicite du cahier des charges du projet Pilotage lui-même.

Aucune situation auditée n'est fondamentalement cassée. La majorité des frictions relevées sont des **oublis d'extension** d'un bon principe déjà appliqué ailleurs dans le code (ex. les boutons `‹ ›` de changement de statut existent pour la Tâche mais n'ont jamais été répliqués pour le Suivi ou pour la date d'échéance), ce qui est une bonne nouvelle : le corriger ne demande pas de repenser le modèle, seulement de généraliser des patterns déjà écrits et déjà éprouvés.

27 problèmes individuels et 7 problèmes systémiques ont été identifiés (détail sections 22-23). Le Top 3 (section 25) porte sur : le report d'échéance d'une tâche (aucun raccourci "+1 jour" nulle part dans l'app), le silence des Suivis (ni action rapide, ni notification de retard de contrôle) et l'invisibilité du score de santé d'un projet au moment même où l'utilisateur regarde ce projet.

---

## 2. Méthodologie

- Investigation par lecture directe du code source (vues `js/views/*.js`, domaine `js/domain/*.js`, composants `js/components/*.js`), en lecture seule stricte — aucun fichier applicatif n'a été modifié.
- Dix situations d'usage minimales imposées ont été auditées (sections 5-14), chacune avec citation exacte fichier/fonction/ligne.
- Chaque affirmation porte une étiquette OBSERVÉ / DÉDUIT / HYPOTHÈSE. Les comptages de clics/écrans/décisions sont systématiquement qualifiés d'« estimation basée sur le code » : ils ne remplacent pas un chronométrage ou une observation utilisateur réelle.
- Les rubriques actuelles de l'application (Dashboard, Inbox, Kanban, Projets, Équipe, Calendrier, Priorisation, Ressources, Prompts, Plus) n'ont pas été supposées correctes a priori : chacune a été testée avec la question « si cette rubrique disparaissait, quelle intention utilisateur ne serait plus satisfaite ? » (section 16), en relisant le fichier de vue réel plutôt qu'en se fiant à son seul intitulé.
- Recherche systématique des causes systémiques avant le catalogue des problèmes individuels : sept causes racines (section 23) ont été retenues parce qu'elles expliquent chacune plusieurs problèmes de surface distincts, conformément à la consigne de prioriser les problèmes transverses sur l'accumulation de petits problèmes isolés.
- Ce document ne modifie et ne recommande de modifier aucun code ; il documente exclusivement ce qui a été observé et les corrections envisageables pour une session future.

---

## 3. Limites et hypothèses

- **Aucune observation utilisateur réelle** n'a été menée : toutes les estimations de clics/temps/charge cognitive sont déduites de la lecture du code, jamais mesurées en conditions réelles. Toute affirmation étiquetée HYPOTHÈSE doit être vérifiée par l'usage avant d'être traitée comme un fait.
- L'investigation a couvert les dix situations demandées et les fichiers qu'elles impliquent directement, mais pas l'intégralité de l'application ligne à ligne (ex. `js/services/priorisation.js` interne, `js/domain/templates.js` — canevas — n'ont été vus que par leurs points d'appel, pas lus en entier).
- Certains points sont restés non tranchés faute de lecture exhaustive et sont marqués **Non déterminé** : le contenu complet de la modale de modification groupée des tâches (`kanban.js`, au-delà de la présence confirmée d'un champ statut et d'un champ date), l'existence d'une entrée d'historique dédiée à `Project:closed` dans `ACTION_META` (`history.js`), et le comportement exact de création de lien automatique (ou non) lors de la qualification d'un item Inbox (aucun appel à `linksApi.createLink` n'a été vu dans `inbox.js`/`views/inbox.js` mais ce point n'a pas fait l'objet d'une recherche exhaustive dans tout `js/domain/convert.js`).
- Les comptages de clics supposent un utilisateur qui connaît déjà l'application (pas de temps d'apprentissage/hésitation inclus).
- Cet audit ne porte pas sur l'esthétique, la performance technique (déjà couverte par `AUDIT_CODE.md`/`AUDIT_OFFLINE.md`), la sécurité (`AUDIT_SECURITY.md`), le modèle de données en tant que tel (`AUDIT_DATA.md`) ni l'usage de Firebase (`AUDIT_FIREBASE.md`) — seules les conséquences de ces sujets sur l'usage réel sont mentionnées quand elles sont directement pertinentes (ex. correctifs de performance très récents du 15/09/2026 qui changent le ressenti de chargement).

---

## 4. Intentions utilisateur identifiées

À partir des commentaires de code (souvent très explicites et datés) et de la structure des fonctionnalités, les intentions réelles suivantes ont été identifiées (OBSERVÉ, reformulé) :

- « Je veux noter quelque chose immédiatement, sans décider tout de suite ce que c'est » → Capture rapide + Inbox.
- « Je veux voir en un coup d'œil ce qui a besoin de moi maintenant, sans avoir à tout vérifier moi-même » → Dashboard, section "Ça a besoin de toi", Focus du jour.
- « Une tâche, c'est ce que MOI je dois faire ; un suivi, c'est ce que j'attends de quelqu'un d'autre ou ce que je dois lui dire » → séparation Task/FollowUp assumée et documentée dans le code (`kanban.js`, "voir le Guide, Tâche ou Suivi ?").
- « Je veux pouvoir préparer un point avec une personne sans reconstituer moi-même l'historique de nos sujets » → `openPrepModal` (people.js).
- « Je veux savoir si un projet va bien ou mal sans avoir à recompter moi-même les retards et les blocages » → `computeHealth` (projectHealth.js).
- « Je ne veux pas être infantilisé par des rappels culpabilisants sur mes retards » → commentaires explicites dans `inboxBadge.js` ("pas de badge rouge culpabilisant") et `dashboard.js` (ton non culpabilisant sur le retard).
- « Je veux retrouver plus tard pourquoi une décision a été prise » → fiches Décision, recherche plein texte, historique par fiche.
- « Je ne veux pas perdre une pensée si je suis interrompu » → auto-sauvegarde de brouillon à 400ms (`draftStore.js`), commentaire citant explicitement des interruptions réelles (yaourt/aspirateur/café).

Ces intentions servent de référence pour juger, section par section, si le parcours actuel les sert réellement ou seulement en partie.

---

## 5. Parcours de capture

**Intention utilisateur** : noter une pensée immédiatement, sans avoir à la qualifier tout de suite (Règle 1 du code : « capturer doit être extrêmement rapide » ; Règle 2 : « capturer et traiter sont deux choses différentes »).

- OBSERVÉ (`js/components/capture.js`) — Un seul champ obligatoire (`<textarea id="capture-input">`), une seule action ("Enregistrer"), zéro décision imposée. Un bloc optionnel replié par défaut ("+ Préciser maintenant") propose 6 types rapides (`QUICK_TYPES` : tâche/suivi/réunion/décision/ressource/gardé) qui, s'ils sont choisis, ouvrent la qualification **après** l'enregistrement effectif — la capture n'est donc jamais perdue même si l'utilisateur annule la qualification.
- OBSERVÉ — Auto-sauvegarde de brouillon 400 ms après chaque frappe (`draftStore.js`), pensée explicitement pour la résilience aux interruptions.
- OBSERVÉ — Saisie en lot : si le texte collé contient plusieurs lignes non vides, chaque ligne devient un item Inbox séparé en un seul clic sur "Enregistrer" (`capture.js` lignes ~60-144) ; le choix de type rapide est alors ignoré (chaque ligne reste "à qualifier plus tard").
- OBSERVÉ — Accès global : un bouton flottant (FAB) monté une seule fois à la racine de l'app, visible depuis tous les écrans, plus un raccourci clavier global `Alt+N` (`shortcuts.js` ligne 36/140) qui ouvre directement la modale de capture depuis n'importe où.
- OBSERVÉ — Badge de rappel neutre sur l'onglet Inbox (`inboxBadge.js`), volontairement non culpabilisant, alimenté en temps réel par le nombre d'items `pending`.

**Verdict** : c'est la situation la plus aboutie de l'application au regard de l'intention réelle. Aucun problème individuel majeur n'a été relevé sur la capture elle-même — les frictions commencent à l'étape suivante (qualification, section 8).

---

## 6. Parcours tâches

**Intention utilisateur** : disposer rapidement d'une action concrète, la faire avancer statut par statut, la clore d'un geste.

### Création (`openCreateTaskModal`, `js/views/kanban.js`)

| Champ | Obligatoire | Niveau JIT | Remarque |
|---|---|---|---|
| Titre | Oui | 1 | Seul champ bloquant (`if(!title) return`, sans retour visuel) |
| Description | Non | 2 | |
| Échéance | Non | 2 | |
| Projet (select, liste préchargée) | Non | 2 | |
| Case "Communication" | Non | **3** | Décision structurante (fige `task.steps` via un canevas) prise sans explication du canevas concerné |
| `priority` (en base, jamais affiché) | — | **4** | Écrit systématiquement à "normale", jamais piloté par l'utilisateur, absent même de la fiche détail |

- OBSERVÉ — **Aucun bouton "+ Nouvelle tâche" n'existe dans l'écran Kanban/Pilotage** (ni vue Trello, ni vue Tableau). Le formulaire complet n'est atteignable que depuis une fiche Projet déjà ouverte, l'Inbox, ou une autre fiche liée. Seul un "quick-add" minimaliste (titre seul, pas de description/échéance) existe en mode Tableau.
- OBSERVÉ — Chemin le plus court hors Inbox (projet déjà ouvert) : ≈3 clics + 1 saisie obligatoire. Depuis la liste des projets : ≈5 clics. **Aucun chemin ne permet de créer une tâche libre, sans projet, directement depuis l'écran Tâches.**
- OBSERVÉ — Validation silencieuse : titre vide → aucun toast, aucun style d'erreur, le clic sur "Créer" ne produit aucun effet visible.
- OBSERVÉ — La checklist ("Sous-étapes") n'existe que dans la fiche détail, jamais à la création — décomposer une tâche dès sa capture est structurellement impossible en un seul geste.

### Cycle de vie et clôture

- OBSERVÉ — Changement de statut à 1 clic (boutons `‹ ›` sur la carte, glisser-déposer, ou select en vue Tableau/détail) — le geste le plus rapide de toute l'application.
- OBSERVÉ — Passage à "Terminé" sans confirmation, avec une célébration visuelle (`celebrateIfJustDone`) sur transition réelle uniquement.
- OBSERVÉ — `completedAt` posé automatiquement, aucune saisie de résultat demandée. Le champ `successCriteria` ("Comment saurai-je que c'est réellement terminé ?") existe mais n'est jamais redemandé au moment de la clôture — il reste à la discrétion de l'utilisateur.
- OBSERVÉ — Édition en masse existe en vue Tableau (sélection multiple + statut/date communs).
- OBSERVÉ — Report d'échéance : coûte 1 clic en vue Tableau (cellule date inline) mais ≈3 clics + réouverture de toute la fiche dans le Kanban (vue par défaut). Aucun raccourci "+1 jour" nulle part.

---

## 7. Parcours projets

**Intention utilisateur** : suivre un sujet transverse (tâches, suivis, réunions, décisions, ressources qui s'y rattachent) et juger s'il va bien ou mal.

### Création (`openCreateProjectModal`, `js/views/projects.js`)

| Champ | Obligatoire | Niveau JIT | Remarque |
|---|---|---|---|
| Nom | Oui | 1 | Seul champ bloquant, même échec silencieux que la Tâche |
| Catégorie (texte libre + autocomplétion) | Non | 2 | Crée silencieusement une nouvelle catégorie si non reconnue (`registerCategory`, aucune confirmation) |
| Objectif | Non | 2 | |
| "⭐ Projet prioritaire" | Non | 2 | Seul signal manuel consommé par la matrice de priorisation |
| `color` (en base, jamais affiché) | — | 4 | |

- OBSERVÉ — Bouton "+ Projet" **permanent et toujours visible** dans l'écran Projets : 1 seul clic pour ouvrir le formulaire (asymétrie nette avec la Tâche, voir section 20).
- OBSERVÉ — Un lien d'aide contextuelle ("📖 Par où commencer sur un nouveau projet") est intégré au formulaire lui-même — seul des deux formulaires (Tâche/Projet) à le faire.
- OBSERVÉ — Clôture (`closeProject`) : simple changement de statut, aucune donnée liée modifiée (politique assumée de non-cascade), confirmation explicite avec texte pédagogique dédié (contrairement à la clôture de tâche, sans confirmation).

### Pilotage d'un projet existant

- OBSERVÉ — Fiche détail à 3 onglets (Détails / Contenu / Activité), chargement ciblé (corrigé le 15/09/2026, ne charge plus tout l'historique de l'app).
- OBSERVÉ — **Le score de santé du projet (`computeHealth`, calcul 100% automatique, 0 saisie) n'apparaît jamais dans la fiche détail ni sur la carte Dashboard** — il n'existe que dans une vue "🩺 Santé" séparée, à 1 clic de plus. Un utilisateur ouvrant un projet depuis sa carte Dashboard (qui n'affiche que le % de tâches terminées) n'a accès à aucun signal de retard/blocage/suivi en retard pour ce projet précis sans changer de vue.
- OBSERVÉ — La décomposition en "sous-parties" (3 états ⚪🔵🟢, avec notes horodatées) est un second mécanisme de décomposition, distinct de la checklist des Tâches, sans lien conceptuel expliqué à l'utilisateur — décision explicite de conception documentée dans le code (« garder distinct des Tâches ») mais dont la portée pour l'utilisateur n'est pas explicitée dans l'interface.

---

## 8. Parcours idées (transformation Inbox → tâche/projet/suivi/...)

**Intention utilisateur** : décider, à tête reposée, ce que devient une capture brute, sans avoir à tout retaper.

- OBSERVÉ (`js/domain/inbox.js`, `js/views/inbox.js`) — 9 issues de qualification possibles ; réduites dans l'UI à 3 choix visibles par défaut (Action/Suivi/Information) + un tiroir "Autre" replié (retour utilisateur documenté : « 9 choix d'un coup à la qualification, c'est trop »). Raccourcis clavier 1/2/3/A.
- OBSERVÉ — Le texte brut capturé est systématiquement réinjecté comme valeur par défaut du titre (jamais à retaper), mais qualifier vers Suivi/Projet/Réunion/Décision/Ressource ouvre le formulaire complet de ce type (jusqu'à ~15 champs pour un Suivi).
- OBSERVÉ — Fermer la modale sans qualifier ("Plus tard") ne perd rien : l'item reste `pending`.
- OBSERVÉ — Estimation basée sur le code : 2 clics pour Information/Idée, ≈3 clics + 1 écran pour Action ou Suivi, ≈4 clics + 1 écran pour les 4 types repliés sous "Autre".
- OBSERVÉ — **Aucun traitement par lot à la qualification** : chaque item Inbox doit être qualifié individuellement, y compris depuis la Revue hebdomadaire — alors que la capture, elle, permet d'enregistrer plusieurs items d'un coup (asymétrie capture/qualification).
- OBSERVÉ — Badge de compteur neutre sur l'onglet Inbox, volontairement non culpabilisant.

---

## 9. Parcours quotidien (Dashboard)

**Intention utilisateur** : savoir en un coup d'œil ce qui demande une action aujourd'hui, sans vérifier plusieurs listes séparées.

- OBSERVÉ — Hiérarchie réelle, pas un tableau de bord "à plat" : section "⚠️ Ça a besoin de toi" fusionne 3 catégories (suivis en retard de contrôle, tâches à échéance ≤7 jours, tâches en pause) déjà dédupliquées et triées par urgence — fusion documentée comme correctif explicite (« éviter le risque de vérifier une liste et oublier les deux autres »).
- OBSERVÉ — Profil par défaut "Minimal" : 4 sections masquées d'office (Informations/Idées, Projets, Reprendre où j'en étais, Récemment) ; en mode Focus, une seule tâche à la fois est montrée avec son "pourquoi".
- OBSERVÉ — 6 sections personnalisables et réordonnables manuellement ; le bloc chiffré (stat-grid) n'est jamais masquable.
- OBSERVÉ — 8 listeners Firestore distincts montés (tasks, projects, meetings, decisions, people, followUps, tags, inbox mutualisé) — rendu progressif, pas bloquant, mais risque transitoire d'affichage "0 partout" avant la première réponse des listeners (DÉDUIT du flux de contrôle, non mesuré).
- OBSERVÉ — La "prochaine action suggérée" (`suggestNextStep.js`) n'est pas un widget permanent : c'est une suggestion réactive, déclenchée seulement après 4 actions précises (décision créée, 2 cases de canevas réunion, 1 case de canevas projet), jamais une recommandation proactive générale sur l'accueil.

---

## 10. Parcours pilotage projet

Voir détail section 7 (« Pilotage d'un projet existant »). Point central : le calcul de risque existe et est fiable (plafonné, basé sur des faits — retard, blocage, suivis en retard) mais **cloisonné** dans une vue alternative, absent de la fiche détail et du Dashboard. `js/views/workload.js` (répartition de charge par collaborateur) répond à une question différente (charge humaine) et n'aide pas à juger la santé d'un projet donné.

---

## 11. Recherche / retrouvabilité

**Intention utilisateur** : « il y a trois mois, on avait décidé quoi sur ce sujet ? »

- OBSERVÉ (`js/components/search.js`) — Point d'entrée unique et global (FAB "🔎"), recherche plein texte (titre + description + notes + tags) sur 9 types d'objets, instantanée (debounce 150 ms), recherche par tag via préfixe "#".
- OBSERVÉ — **Les éléments terminés/archivés sont exclus des résultats par défaut** (case "Inclure ce qui est terminé/archivé" non cochée par défaut) — piège direct pour la question de référence de cet audit : un sujet clos il y a 3 mois n'apparaît pas tant que la case n'est pas cochée manuellement.
- OBSERVÉ — Les résultats de recherche pour une Décision n'affichent que son titre, sans date ni extrait du contenu qui a fait matcher la requête — il faut ouvrir la fiche pour juger, ce qui complique le choix entre plusieurs décisions au titre proche.
- OBSERVÉ — Les liens entre fiches (`linkedItems.js`/`links.js`) sont **exclusivement créés manuellement** ; aucune automatisation de liaison n'a été observée lors d'actions évidentes (ex. qualifier un Inbox en tâche).
- **Verdict DÉDUIT** : retrouver « pourquoi on a décidé X il y a 3 mois » est réaliste si l'utilisateur se souvient d'un mot-clé ou d'un tag posé à l'époque, nettement moins si le sujet est déjà clos (case à cocher) ou si le souvenir ne porte que sur le projet/la période, pas sur un mot précis.

---

## 12. Réunions / points

- OBSERVÉ — Pour un point **avec une personne**, l'écran `openPrepModal` (people.js) centralise tout (suivis en retard/à transmettre/à aborder groupés par projet/terminés récemment) sans ressaisie, avec une recherche dédiée sur tous les sujets de la personne. C'est un parcours bien centralisé, en 1-2 clics depuis la fiche Personne.
- OBSERVÉ — `js/views/prepMask.js` n'est qu'une étape de confidentialité (masquer certains sujets avant un partage écran), pas l'écran de préparation lui-même.
- OBSERVÉ — Pour une réunion **projet/multi-participants**, aucun écran équivalent centralisé n'existe : il faut croiser manuellement la fiche Projet, sa section "Lié" et éventuellement la recherche globale.
- OBSERVÉ — `meetingLauncher.js` : export `.ics` manuel + formulaire de réunion préempli et lié automatiquement — volontairement pas une vraie intégration calendrier externe (commenté explicitement dans le code).
- OBSERVÉ — La Revue hebdomadaire (`weeklyReview.js`) centralise 8 catégories dispersées, mais son horodatage "faite" est posé **à l'ouverture**, pas à la fin du traitement réel — ouvrir puis refermer sans rien traiter suffit à faire disparaître le rappel du Dashboard pour 7 jours.

---

## 13. Report / replanification

- OBSERVÉ — Trois mécanismes coexistent, de coût très inégal : Kanban (≈3 clics + réouverture de fiche complète), vue Tableau (1 clic, cellule inline), vue Calendrier (glisser-déposer réel, avec "Annuler" en 1 clic). **La vue par défaut de l'application (Kanban) est la plus coûteuse des trois pour ce geste très fréquent.**
- OBSERVÉ — **Aucun raccourci "+1 jour"/snooze n'existe nulle part** dans l'application (recherche exhaustive négative).
- OBSERVÉ — Le regroupement par échéance en vue Tableau désactive volontairement le glisser-déposer entre groupes (choix documenté : « pas de valeur cible évidente »).
- OBSERVÉ — Pour un Suivi, passer de "En attente" à "Relancé" exige systématiquement l'ouverture de la fiche complète (~15 champs) — aucun bouton "🔁 Relancer" à 1 clic, contrairement aux boutons `‹ ›` de statut sur la carte Tâche.
- OBSERVÉ — La notification de retard/stagnation (`app.js`, opt-in, 1×/jour) **ne couvre que les Tâches**, jamais les Suivis en retard de contrôle — trou confirmé par lecture directe du code.
- OBSERVÉ — L'édition en masse pose une date absolue identique pour tout un lot, pas un décalage relatif conservant l'écart entre tâches.

---

## 14. Clôture

- OBSERVÉ — Tâche : 1 geste (glisser-déposer ou sélecteur), aucune confirmation, célébration visuelle, aucune saisie de résultat obligatoire.
- OBSERVÉ — Projet : simple changement de statut, confirmation explicite avec texte pédagogique, aucune cascade sur les entités liées (politique assumée), aucune saisie de bilan.
- OBSERVÉ — Suivi : le plus coûteux des trois — ouverture de la fiche complète, changement du select statut, "Enregistrer" qui renvoie tous les champs du formulaire — aucun raccourci.
- OBSERVÉ — Dans les trois cas, aucune saisie de résultat n'est jamais imposée à la clôture, alors que le cahier des charges du projet Pilotage demande explicitement de « vérifier : est-ce réellement terminé ? le résultat attendu est-il obtenu ? » — le champ `successCriteria`/`expectedResult` existe mais reste à la discrétion de l'utilisateur, jamais redemandé au moment T de la clôture.
- OBSERVÉ — Un historique par fiche existe (`historyTimeline.js`) et retrace la clôture comme un événement horodaté, mais il n'y a pas de vue globale « tout ce qui a été clôturé récemment » consultable en un point unique.

---

## 15. Analyse du modèle mental

Inventaire des objets (fichier → champs principaux → relations), voir aussi section 20 (cohérence) :

- **Tâche** (`tasks`) : ce que MOI je dois faire, jamais assignable à quelqu'un d'autre (choix assumé et documenté).
- **Suivi/FollowUp** (`followUps`) : ce que j'attends d'une personne ou ce que je dois lui dire — porte **deux dates distinctes** (`dueDate` = échéance de la personne, `controlDate` = quand MOI je dois vérifier), source de confusion potentielle.
- **Projet** (`projects`) : sujet transverse, jamais assigné, cible de Tâche/Suivi/Réunion/Décision/Objectif.
- **Personne** (`people`) : collaborateur ou manager, cible de Suivi/Objectif/Décision.
- **Réunion** (`meetings`) et **Décision** (`decisions`) : entités liées entre elles et au Projet.
- **Ressource** (`resources`) : seule entité à porter des tableaux d'IDs *vers* Projet/Tâche plutôt que d'en être la cible ; porte un champ `tags` embarqué **mort en écriture** (plus jamais peuplé par l'UI générique de tags) mais toujours lu pour la recherche — risque d'incohérence silencieuse.
- **Objectif** (`objectives`), **Lien** (`links`, infrastructure transverse), **Tag** (`tags`, générique sur 9 types), **Historique** (`history`, pointeur polymorphe), **Inbox** (`inboxItems`, le point d'entrée universel).
- **Priorisation** et **Charge** (`priorisation.js`, `workload.js`) : pas des objets, des calculs purs sur des données déjà chargées ailleurs.
- **Casquette** : jamais stockée, déduite à la volée de `project.category`/`person.type` — un filtre calculé, pas un objet.
- **Préférences** : document unique fourre-tout mélangeant configuration durable (poids de priorisation, catégories) et état éphémère (dernière notification du jour) sans séparation claire.

**Incohérence de vocabulaire la plus marquée** : un même objet Inbox qualifié en "Information/Idée" porte 4 noms différents selon le sous-système qui le regarde — `InboxItem` (code), statut `"kept"`, `entityType: "Kept"` (tags/historique), libellé UI "Information" **ou** "Idée" (deux libellés pour un seul statut).

---

## 16. Analyse des rubriques

Table de navigation réelle (`js/app.js`) : Accueil, Inbox, Pilotage (regroupe Tâches/Projets/Calendrier/Priorisation), Équipe (regroupe Management), Plus (regroupe Ressources/Prompts/Guide/Nouveautés/Mémoire) — 10 routes pour 5 icônes visibles.

Test « si cette rubrique disparaissait » (résumé, détail par rubrique dans le rapport source) : chaque rubrique principale répond à une intention identifiable et réelle (voir section 4), à trois réserves près :

- **Priorisation** reclasse le *même* flux de tâches que le Kanban avec une formule pondérée différente — redondance assumée et documentée dans le code lui-même ; sans cet onglet, le Focus du jour du Dashboard continuerait de fonctionner (même formule réutilisée), seul l'écran de réglage des poids disparaîtrait.
- **Management** n'a plus de route propre : absorbé comme filtre interne dans Équipe, donc invisible dans la table de navigation malgré son importance affichée dans le cahier des charges du projet Pilotage — un utilisateur cherchant "Management" dans le menu ne le trouve pas.
- **"Plus" (☰)** est un tiroir de rangement sans lien thématique entre ses 5 destinations — son rôle n'est pas lisible depuis son seul nom.

---

## 17. Analyse des formulaires

Constat transverse (détaillé sections 6-8) : les formulaires de création (Tâche, Projet) partagent le même défaut de validation silencieuse (`if(!champ) return`, aucun retour visuel), mais des traitements différents pour un problème similaire (création à la volée d'une valeur liée) : le Projet crée silencieusement une nouvelle catégorie sans confirmation, alors que la Tâche protège la création d'un nouveau projet lié par une vraie modale de confirmation. Aucun des deux formulaires de création (Tâche, Projet) ne redemande le "Critère de réussite/clôture", pourtant central à la mission du produit — le champ existe mais uniquement en fiche détail, après coup.

---

## 18. Charge cognitive

Synthèse chiffrée (estimations basées sur le code, non mesurées) :

| Situation | Écrans | Clics min. | Décisions | Champs obligatoires |
|---|---|---|---|---|
| Créer une tâche (projet déjà ouvert) | 3-4 | 3 | 1-2 | 1 (titre) |
| Créer une tâche (depuis liste Projets) | 4-5 | 5 | 1-2 | 1 |
| Créer un projet | 1 | 2 | 1 | 1 (nom) |
| Qualifier Inbox → Information/Idée | 1 | 2 | 1 | 0 |
| Qualifier Inbox → Action/Suivi | 2 | ≈3 | 1-2 | 1 (selon type) |
| Qualifier Inbox → Projet/Réunion/Décision/Ressource | 2 | ≈4 | 2 | variable |
| Reporter une échéance (Kanban, vue par défaut) | 2 (fiche complète) | ≥3 | 1 | — |
| Reporter une échéance (vue Tableau) | 0 (inline) | 1 | 1 | — |
| Reporter une échéance (Calendrier, glisser-déposer) | 0 | 1 geste | 0 | — |
| Relancer un Suivi | 1 (fiche complète) | ≥2 | 1 | — |
| Clore une tâche | 0 | 1 | 0 | — |
| Clore un Suivi | 1 (fiche complète) | ≥2 | 1 | — |
| Clore un projet | 1 (confirmation) | 2 | 1 | — |

Mémorisation requise notable : se souvenir qu'une vue "Santé" séparée existe pour juger un projet ; se souvenir de cocher "Inclure terminé/archivé" en recherche ; se souvenir qu'un item Inbox qualifié en "Idée" et "Information" sont le même statut sous deux libellés.

---

## 19. Just-in-time (classification des champs)

Synthèse des niveaux relevés sections 6-7 (détail complet dans les tableaux correspondants) :

- **NIVEAU 1** (indispensable immédiatement) : titre de tâche, nom de projet — seuls champs réellement bloquants observés dans toute l'application.
- **NIVEAU 2** (utile, ajoutable plus tard) : description, échéance, projet rattaché, catégorie, objectif, "prioritaire", checklist/sous-étapes (bien que techniquement NIVEAU 2, leur emplacement dans le code les fait fonctionner comme NIVEAU 3, voir ci-dessous).
- **NIVEAU 3** (avancé, ne devrait pas être dans le flux principal mais l'est parfois) : case "Communication" à la création de tâche (décision structurante non expliquée) ; critère de réussite/clôture, jamais proposé à la création alors que central à la mission produit.
- **NIVEAU 4** (technique, l'utilisateur ne devrait jamais le piloter directement) : `task.priority` (jamais exposé nulle part), `project.color` (jamais exposé), `project.steps`/`order` (générés automatiquement, correctement invisibles).

---

## 20. Cohérence

Incohérences transverses relevées (détail sections 6-7, 15) :

1. Point d'entrée de création : permanent et visible pour le Projet, absent pour la Tâche.
2. Garde-fou à la création d'une valeur liée à la volée : modale de confirmation pour "nouveau projet" (depuis la Tâche), aucune pour "nouvelle catégorie" (depuis le Projet) — même situation structurelle, traitement opposé.
3. Signal de priorité : visible et piloté pour le Projet (`critical`), écrit en base mais invisible pour la Tâche (`priority`).
4. Deux mécanismes de décomposition distincts (checklist Tâche / sous-parties Projet à 3 états) sans lien conceptuel exposé à l'utilisateur.
5. Actions rapides à 1 clic : généralisées pour le statut de Tâche, absentes pour le statut de Suivi et pour la date d'échéance en vue Kanban.
6. Notification de retard : couvre les Tâches, pas les Suivis.
7. Vocabulaire Inbox "kept"/"Kept"/"Information"/"Idée" pour un seul et même statut.

---

## 21. Analyse mobile / rapidité

- OBSERVÉ — Le geste le plus rapide de toute l'application (glisser-déposer calendrier, avec annulation) exige un écran spécifique (Calendrier), pas l'écran par défaut (Kanban) — sur mobile, le glisser-déposer entre jours est plus coûteux au doigt qu'au clic souris (HYPOTHÈSE — non vérifié sur un usage tactile réel).
- OBSERVÉ — La capture rapide (FAB + `Alt+N`) est le seul geste réellement pensé "depuis n'importe où, en une action" — mais `Alt+N` n'a pas d'équivalent tactile évident sur mobile (HYPOTHÈSE — le FAB reste cependant accessible au doigt).
- OBSERVÉ — Aucune action rapide (report, relance, clôture) n'est disponible en dehors d'une fiche complète pour les Suivis, ce qui pénalise particulièrement un usage mobile où ouvrir une fiche à ~15 champs est plus coûteux qu'un geste inline.

---

## 22. Problèmes individuels (fiches UX-XXX)

> Les problèmes P0/P1 sont documentés avec le gabarit complet. Les problèmes P2/P3 sont documentés en version condensée (Type, Situation, Fichiers/Fonctions, Cause, Correction, Priorité) pour tenir le document à une taille exploitable — la logique et les citations restent suffisantes pour qu'une session future n'ait pas à refaire l'analyse.

### UX-001 — Aucun point d'entrée de création de tâche depuis l'écran Pilotage

- **Type** : Friction / Incohérence — **Statut** : Non déterminé si déjà remonté par l'utilisateur
- **Situation réelle** : l'utilisateur veut créer une tâche libre pendant qu'il travaille dans le Kanban
- **Intention utilisateur** : « je pense à une action, je veux la poser tout de suite, ici »
- **Parcours actuel** : aucun bouton "+ Nouvelle tâche" dans Kanban/Trello/Tableau ; il faut soit passer par l'Inbox (capture puis qualification), soit ouvrir un projet existant → onglet Contenu → "+ Ajouter"
- **Friction** : navigation croisée obligatoire ou détour par l'Inbox pour un geste qui devrait être direct
- **Fréquence** : HYPOTHÈSE — probablement élevée (la création de tâche est une action cœur de l'app)
- **Importance** : Haute
- **Cause probable** : le formulaire complet (`openCreateTaskModal`) a été conçu pour être invoqué avec un contexte préexistant (projet, Inbox), jamais comme point d'entrée autonome
- **Fichiers concernés** : `js/views/kanban.js`
- **Fonctions concernées** : `renderKanban` (L80-459), `openCreateTaskModal` (L1297-1365)
- **Problèmes techniques associés** : aucun (pas un bug, une absence de point d'entrée)
- **Parcours cible** : bouton "+ Nouvelle tâche" visible dans l'en-tête du Kanban (toutes vues), ouvrant `openCreateTaskModal({})` sans projet préassigné
- **Principe à appliquer** : symétrie avec le bouton "+ Projet" déjà existant et éprouvé
- **Gain attendu** : suppression d'un détour systématique pour l'action la plus fréquente de l'app
- **Complexité** : S (le formulaire existe déjà, il ne manque qu'un point d'entrée)
- **Risque de régression** : faible
- **Validation** : vérifier que la tâche créée sans projet s'affiche correctement partout où `projectId` est optionnel (déjà le cas dans le modèle)
- **Priorité** : P0

### UX-002 — Validation de formulaire silencieuse (Tâche et Projet)

- **Type** : Friction — **Statut** : Non déterminé
- **Situation réelle** : l'utilisateur clique "Créer" sans avoir saisi le champ obligatoire (souvent par réflexe ou frappe trop rapide)
- **Intention utilisateur** : créer l'objet, ou comprendre immédiatement pourquoi ce n'est pas possible
- **Parcours actuel** : `if (!title) return;` / `if (!name) return;` — aucun toast, aucun style d'erreur, la modale reste identique
- **Friction** : l'utilisateur ne sait pas si l'action a réussi ou échoué ; risque de reclics répétés ou d'abandon
- **Fréquence** : HYPOTHÈSE — rare en usage normal mais coût de confusion élevé quand ça arrive
- **Importance** : Moyenne à Haute (rupture de confiance dans l'outil)
- **Cause probable** : pattern de validation dupliqué dans chaque modale de création, sans utilitaire partagé de retour visuel
- **Fichiers concernés** : `js/views/kanban.js`, `js/views/projects.js`
- **Fonctions concernées** : `openCreateTaskModal` (soumission), `openCreateProjectModal` (soumission), également `openTaskDetail` (même échec silencieux en modification)
- **Problèmes techniques associés** : absence d'un utilitaire de validation de formulaire partagé (cf. `AUDIT_CODE.md`, pattern de duplication déjà relevé pour `escapeHtml`)
- **Parcours cible** : surbrillance du champ + message inline ("Le titre est obligatoire") au clic sur "Créer" si le champ est vide
- **Principe à appliquer** : ne jamais échouer silencieusement à une action explicite de l'utilisateur
- **Gain attendu** : suppression d'un point de confusion silencieux, gain de confiance
- **Complexité** : S
- **Risque de régression** : faible
- **Validation** : test manuel des deux formulaires avec champ obligatoire vide
- **Priorité** : P0

### UX-003 — Aucune action rapide de report d'échéance dans le Kanban (vue par défaut)

- **Type** : Friction / Incohérence — **Statut** : Non déterminé
- **Situation réelle** : reporter une tâche à demain ou à la semaine prochaine
- **Intention utilisateur** : geste très fréquent, devrait coûter 1 action
- **Parcours actuel** : ≥3 clics + réouverture de la fiche complète dans le Kanban ; 1 clic seulement en vue Tableau ; glisser-déposer en vue Calendrier — mais le Kanban est la vue par défaut
- **Friction** : le geste le plus fréquent de replanification est le plus coûteux dans la vue la plus utilisée
- **Fréquence** : HYPOTHÈSE — élevée
- **Importance** : Haute
- **Cause probable** : les boutons rapides `‹ ›` ont été construits uniquement pour le statut, jamais étendus à la date
- **Fichiers concernés** : `js/views/kanban.js`
- **Fonctions concernées** : rendu de carte (L1195-1251), `openTaskDetail` (L1374-1854)
- **Parcours cible** : ajouter sur la carte un contrôle rapide de date (ex. menu "+1j / +7j / choisir une date") à côté des boutons de statut existants
- **Principe à appliquer** : généraliser un pattern déjà écrit et éprouvé (actions rapides sur carte) à un second attribut fréquent
- **Gain attendu** : alignement du coût du geste sur sa fréquence réelle
- **Complexité** : S/M
- **Risque de régression** : faible (ajout, pas de modification du comportement existant)
- **Priorité** : P0

### UX-004 — Score de santé de projet invisible dans la fiche détail et le Dashboard

- **Type** : Incohérence / Incomplétude — **Statut** : Non déterminé
- **Situation réelle** : l'utilisateur ouvre un projet depuis sa carte Dashboard ou la liste standard pour juger s'il va bien
- **Intention utilisateur** : « ce projet est-il en bonne voie ou en danger ? » sans calcul mental
- **Parcours actuel** : la réponse existe et est déjà calculée (`computeHealth`, automatique, plafonné) mais uniquement visible dans une vue "🩺 Santé" séparée ; la fiche détail et la carte Dashboard n'affichent que le % de tâches terminées, qui ne reflète ni retard, ni blocage, ni suivi en retard
- **Friction** : information critique déjà produite mais mal placée — l'utilisateur peut rester silencieusement optimiste sur un projet classé "danger"
- **Fréquence** : HYPOTHÈSE — à chaque consultation de projet
- **Importance** : Haute
- **Cause probable** : fonctionnalité ajoutée comme vue alternative sans être rapatriée aux points de consultation habituels
- **Fichiers concernés** : `js/views/projects.js` (`openProjectDetail`), `js/views/dashboard.js` (carte projet), `js/domain/projectHealth.js`, `js/components/projectHealth.js`
- **Parcours cible** : afficher le niveau (success/warning/danger) et le signal principal dans l'en-tête de la fiche détail et sur la carte Dashboard, en réutilisant `computeHealth` déjà écrit
- **Principe à appliquer** : afficher l'information calculée là où la décision se prend, pas seulement dans une vue dédiée
- **Gain attendu** : détection de projets à risque sans navigation supplémentaire
- **Complexité** : S (donnée déjà calculée, il s'agit d'un ajout d'affichage)
- **Risque de régression** : faible
- **Priorité** : P0

### UX-005 — Suivi (FollowUp) sans action rapide ni notification de retard

- **Type** : Incohérence / Incomplétude — **Statut** : Non déterminé
- **Situation réelle** : relancer une personne ou marquer un suivi réglé
- **Intention utilisateur** : geste rapide, symétrique à ce qui existe déjà pour la Tâche
- **Parcours actuel** : aucune action à 1 clic sur une ligne de Suivi ; ouverture systématique de la fiche complète (~15 champs) ; la notification de retard/stagnation (`app.js`) ne couvre que les Tâches, jamais `followUpsApi.isControlDue`
- **Friction** : coût élevé pour l'entité la plus liée aux personnes (relations professionnelles), et absence de tout rappel poussé
- **Fréquence** : HYPOTHÈSE — élevée si l'utilisateur gère plusieurs collaborateurs
- **Importance** : Haute
- **Cause probable** : le système de notification et les actions rapides ont été construits tâche-centriques puis jamais étendus au Suivi
- **Fichiers concernés** : `js/views/people.js` (`openEditFollowUpModal`), `js/views/followupsOverview.js`, `js/app.js` (`maybeNotifyStalledOrLate`)
- **Parcours cible** : bouton "🔁 Relancer"/"✅ Réglé" sur chaque ligne de Suivi ; extension de la notification quotidienne aux suivis en contrôle dépassé
- **Principe à appliquer** : parité de traitement entre entités structurellement proches (Tâche/Suivi partagent la même mécanique de statut et d'échéance)
- **Gain attendu** : réduction du risque d'oubli de relance, geste aligné avec celui déjà connu pour les tâches
- **Complexité** : S (actions rapides) / M (extension notification)
- **Risque de régression** : faible
- **Priorité** : P1

### UX-006 — Recherche exclut par défaut les éléments terminés/archivés

- **Type** : Incohérence — **Priorité** : P1
- **Situation** : retrouver un sujet déjà clos (le cas le plus probable pour « il y a 3 mois »)
- **Fichiers/Fonctions** : `js/components/search.js` (case "Inclure ce qui est terminé/archivé", non cochée par défaut)
- **Cause probable** : filtre pensé pour l'usage courant (retrouver un sujet actif), jamais réévalué pour l'usage rétrospectif
- **Correction envisageable** : cocher la case par défaut, ou afficher un indice visuel explicite ("3 résultats archivés masqués — Afficher") plutôt qu'une case silencieuse

### UX-007 — Qualification Inbox strictement unitaire

- **Type** : Incomplétude — **Priorité** : P1
- **Statut** : **Décision validée par l'utilisateur (15/09/2026)** — le traitement unitaire « à tête reposée » est volontaire et doit rester le comportement par défaut ; le besoin d'aller plus vite sur certains cas est confirmé, mais seulement en option
- **Situation** : traiter une pile d'items Inbox accumulés (ex. après une saisie en lot), avec un besoin occasionnel de qualifier plusieurs items simples sans repasser un par un
- **Fichiers/Fonctions** : `js/views/inbox.js`, `js/components/weeklyReview.js` (boucle un item à la fois)
- **Cause probable** : la capture en lot a été ajoutée après la qualification unitaire, sans réévaluer le traitement en aval
- **Correction retenue** : conserver le flux un par un comme comportement par défaut ; ajouter une option explicite non activée par défaut (ex. bouton "Traiter en lot") permettant de qualifier en une fois plusieurs items vers les issues simples (Information/Idée/Archivé) — jamais pour les issues qui nécessitent un vrai formulaire (Action/Suivi/Projet/Réunion/Décision/Ressource)

### UX-008 — Catégorie de projet dupliquée silencieusement

- **Type** : Incohérence / Risque de donnée — **Priorité** : P2
- **Situation** : faute de frappe dans le champ Catégorie à la création d'un projet
- **Fichiers/Fonctions** : `js/views/projects.js` (`registerCategory` appelé avant la création, sans confirmation)
- **Cause probable** : absence du garde-fou pourtant appliqué au cas structurellement identique "nouveau projet" côté formulaire Tâche
- **Correction envisageable** : proposer une confirmation ("Créer la catégorie 'X' ?") ou une correspondance approximative avant création

### UX-009 — Champ `priority` de la Tâche jamais exposé

- **Type** : Incomplétude — **Priorité** : P3
- **Fichiers/Fonctions** : `js/domain/tasks.js` (`createTask`), absent de `openCreateTaskModal` et `openTaskDetail`
- **Cause probable** : champ préparé pour un usage futur (tri, priorisation) jamais raccordé à l'UI
- **Correction envisageable** : soit l'exposer (si utile), soit le retirer du modèle pour éviter la confusion avec `project.critical`

### UX-010 — Case "Communication" non expliquée et structurante

- **Type** : Friction — **Priorité** : P2
- **Statut** : **Décision validée par l'utilisateur (15/09/2026)** — à déplacer après création
- **Fichiers/Fonctions** : `js/views/kanban.js` (`openCreateTaskModal`), `js/domain/tasks.js` (`buildSteps`)
- **Cause probable** : raccourci de configuration avancée exposé au même niveau que les champs simples, sans expliquer sa conséquence
- **Correction retenue** : retirer la case "Communication" du formulaire de création ; le choix du canevas de communication se fait après création, depuis la fiche détail de la tâche (NIVEAU 3 réel, comme les autres réglages avancés)

### UX-011 — Checklist et sous-parties toujours différées après création

- **Type** : Friction — **Priorité** : P2
- **Fichiers/Fonctions** : `js/views/kanban.js` (checklist), `js/views/projects.js` (sous-parties)
- **Cause probable** : les deux mécanismes de décomposition ont été construits comme fonctionnalités de fiche détail, jamais intégrés au flux de création
- **Correction envisageable** : permettre d'ajouter au moins une première sous-étape/sous-partie directement depuis le formulaire de création (optionnel, repliable)

### UX-012 — Aucune saisie de bilan à la clôture (Tâche/Projet/Suivi)

- **Type** : Incomplétude — **Priorité** : **Clos — pas d'action**
- **Statut** : **Décision validée par l'utilisateur (15/09/2026)** — ne pas imposer de contrôle "Résultat obtenu" à la clôture, même optionnel systématique ; cohérent avec l'absence de friction sur les cas triviaux observée partout ailleurs dans le code
- **Fichiers/Fonctions** : `js/domain/tasks.js` (`updateTask`), `js/domain/projects.js` (`closeProject`), `js/domain/followups.js` (`updateFollowUp`)
- **Cause probable** : la clôture a été conçue comme un simple changement de statut — choix de conception à préserver tel quel
- **Correction retenue** : aucune ; le champ `successCriteria`/`expectedResult` reste disponible à la discrétion de l'utilisateur, en dehors du moment de clôture, comme aujourd'hui

### UX-013 — Résultats de recherche des Décisions sans date ni extrait

- **Type** : Incomplétude — **Priorité** : P2
- **Fichiers/Fonctions** : `js/components/search.js` (rendu des résultats)
- **Correction envisageable** : afficher la date et un court extrait du champ ayant matché

### UX-014 — Aucun écran de préparation centralisé pour une réunion projet/multi-participants

- **Type** : Incomplétude — **Priorité** : P2
- **Fichiers/Fonctions** : absence d'équivalent à `openPrepModal` (people.js) côté Projet
- **Correction envisageable** : décliner `computePrepSections` sur un projet plutôt que sur une seule personne

### UX-015 — Horodatage de la Revue hebdomadaire posé à l'ouverture, pas à la fin

- **Type** : Friction — **Priorité** : P2
- **Fichiers/Fonctions** : `js/components/weeklyReview.js` (`markWeeklyReviewDone`, appelé à l'ouverture)
- **Correction envisageable** : déplacer l'appel à la fermeture de la modale, ou après un traitement minimal constaté

### UX-016 — Deux dates sur un Suivi sans distinction visuelle claire

- **Type** : Incohérence — **Priorité** : P2
- **Fichiers/Fonctions** : `js/domain/followups.js` (`dueDate` vs `controlDate`), `js/views/people.js` (formulaire d'édition)
- **Correction envisageable** : libellés plus explicites dans le formulaire ("Échéance de la personne" / "Ma date de contrôle")

### UX-017 — `resource.tags` champ mort en écriture, toujours lu

- **Type** : Incohérence technique à impact usage — **Priorité** : P2
- **Fichiers/Fonctions** : `js/domain/resources.js`, `js/views/resources.js` (lecture pour la recherche/filtrage)
- **Correction envisageable** : migrer vers le système générique `tags.js` déjà utilisé pour les 8 autres types

### UX-018 — Vocabulaire Inbox instable (Information/Idée/Kept)

- **Type** : Incohérence — **Priorité** : P2
- **Fichiers/Fonctions** : `js/domain/inbox.js`, `js/domain/tags.js` (`entityType: "Kept"`)
- **Correction envisageable** : choisir un seul libellé utilisateur et l'appliquer partout (code, tags, historique)

### UX-019 — Chargement transitoire "0 partout" sur le Dashboard

- **Type** : Friction mineure — **Priorité** : P3
- **Fichiers/Fonctions** : `js/views/dashboard.js` (rendu avant réponse des 8 listeners)
- **Correction envisageable** : état de chargement explicite ("Chargement...") plutôt qu'un état vide ambigu

### UX-020 — "Priorisation" redondant avec le Kanban sans que son rôle soit évident depuis son nom

- **Type** : Incohérence de navigation — **Priorité** : **Clos pour la fusion — P3 pour la seule clarté du nom**
- **Statut** : **Décision validée par l'utilisateur (15/09/2026)** — la redondance de données est assumée : le graphique urgence/impact/blocage et le réglage des poids justifient un onglet séparé du Kanban ; aucune fusion à envisager
- **Fichiers/Fonctions** : `js/views/priorisation.js`, `js/app.js`
- **Correction retenue** : conserver l'onglet séparé tel quel ; seule amélioration résiduelle possible, non prioritaire, une clarification du libellé dans la navigation (ex. sous-titre ou info-bulle rappelant qu'il permet de régler les poids et de voir la matrice complète, au-delà du Focus du jour déjà présent sur le Dashboard)

### UX-021 — "Management" invisible dans la navigation

- **Type** : Incohérence de navigation — **Priorité** : P3
- **Fichiers/Fonctions** : `js/app.js` (filtre interne dans Équipe, pas de route propre)
- **Correction envisageable** : sous-onglet visible "Management" dans Équipe plutôt qu'un filtre caché

### UX-022 — "Plus" (☰) sans lien thématique lisible

- **Type** : Incohérence de navigation — **Priorité** : P3
- **Fichiers/Fonctions** : `js/views/more.js`
- **Correction envisageable** : regrouper par intention ("Aide" : Guide+Nouveautés ; "Bibliothèques" : Ressources+Prompts ; "Pause" : Mémoire) plutôt qu'une liste plate

### UX-023 — Quick-add en mode Tableau ne permet pas la description/échéance

- **Type** : Incomplétude — **Priorité** : **Clos — pas d'action**
- **Statut** : **Confirmé par l'utilisateur (15/09/2026)** — choix assumé de rapidité maximale
- **Fichiers/Fonctions** : `js/views/kanban.js` (`renderQuickAddRow`)
- **Correction retenue** : aucune ; comportement volontaire à conserver tel quel

### UX-024 — Édition en masse : date absolue seulement, pas de décalage relatif

- **Type** : Incomplétude — **Priorité** : P3
- **Fichiers/Fonctions** : `js/views/kanban.js` (modale d'édition groupée, champ `#bulk-due`)
- **Correction envisageable** : option "décaler de N jours" en plus de "fixer à telle date"

### UX-025 — Glisser-déposer désactivé pour le regroupement par échéance en vue Tableau

- **Type** : Incomplétude assumée — **Priorité** : P3 (déjà un choix documenté, pas un oubli)
- **Fichiers/Fonctions** : `js/views/kanban.js` (L596-604)
- **Correction envisageable** : Non déterminé — le choix documenté est raisonnable ; à ne reconsidérer que si un besoin réel est signalé

### UX-026 — Absence de lien automatique lors de la qualification Inbox

- **Type** : Incomplétude — **Priorité** : **P2 (relevée depuis P3 — point confirmé et introduction demandée)**
- **Statut** : **OBSERVÉ, confirmé le 15/09/2026** — recherche exhaustive de `createLink`/`linksApi` dans `js/domain/inbox.js`, `js/views/inbox.js` et `js/domain/convert.js` : aucune occurrence. Aucun lien n'est jamais posé automatiquement entre un item Inbox qualifié et l'entité résultante (tâche, suivi, projet, réunion, décision, ressource).
- **Décision utilisateur (15/09/2026)** : à introduire
- **Fichiers/Fonctions** : `js/domain/inbox.js` (`qualify`), `js/views/inbox.js` (`handleChoice`), `js/domain/links.js` (`createLink`, déjà existant et réutilisable)
- **Correction retenue** : lors de la qualification d'un item Inbox, appeler `linksApi.createLink` pour poser automatiquement un lien entre l'item source et l'entité créée (et, quand un `projectId` de contexte est déjà connu au moment de la qualification, entre l'entité créée et ce projet), en réutilisant le mécanisme déjà écrit pour "+ Créer et lier" (`js/components/linkedItems.js`)

### UX-027 — Guide et Nouveautés aux rôles proches, distinction non explicite dans l'UI

- **Type** : Incohérence de navigation — **Priorité** : P3
- **Fichiers/Fonctions** : `js/views/guide.js`, `js/views/whatsnew.js`
- **Correction envisageable** : sous-titre explicite sur chaque écran ("Comment ça marche" / "Ce qui a changé")

---

## 23. Problèmes systémiques

### UX-SYS-001 — Actions rapides construites pour la Tâche, jamais généralisées

- **Symptômes** : UX-003 (pas de report rapide), UX-005 (pas de relance rapide de Suivi)
- **Problèmes concernés** : UX-003, UX-005
- **Cause racine probable** : le pattern "boutons `‹ ›` / glisser-déposer à 1 clic" a été développé pour un seul attribut (statut de Tâche) et jamais réévalué comme principe général applicable à d'autres attributs (date) ou d'autres entités (Suivi)
- **Solution systémique** : établir explicitement "toute transition d'état fréquente doit avoir un geste à 1 clic, quelle que soit l'entité ou l'attribut", puis auditer chaque entité contre ce principe
- **Impact** : élevé — touche les deux gestes les plus fréquents après la capture (reporter, relancer)
- **Risque si non traité** : l'écart d'usage entre Tâche (rapide) et Suivi (lourd) pourrait pousser à sous-utiliser le Suivi malgré son rôle central (suivre les engagements des autres)

### UX-SYS-002 — Information calculée mais non affichée là où la décision se prend

- **Symptômes** : UX-004 (santé de projet invisible en fiche détail), UX-006 (archivés exclus de la recherche par défaut)
- **Problèmes concernés** : UX-004, UX-006
- **Cause racine probable** : chaque fonctionnalité de calcul/filtrage a été construite et validée dans son propre écran, sans revérifier systématiquement si le même signal devrait aussi apparaître aux autres points de consultation habituels de l'utilisateur
- **Solution systémique** : pour toute donnée calculée à forte valeur de décision (santé, retard, urgence), lister tous les écrans où l'utilisateur pourrait avoir besoin de la voir, pas seulement l'écran où elle a été implémentée en premier
- **Impact** : élevé — directement lié à l'intention centrale du produit ("piloter sans recalculer soi-même")
- **Risque si non traité** : fausse impression de sécurité sur un projet ou un sujet en réalité à risque

### UX-SYS-003 — Silence du système face à un problème (validation, filtre, doublon)

- **Symptômes** : UX-002 (validation silencieuse), UX-008 (catégorie dupliquée sans confirmation), UX-006 (case de filtre silencieuse)
- **Problèmes concernés** : UX-002, UX-008, UX-006
- **Cause racine probable** : absence d'un principe/pattern partagé de retour utilisateur explicite à chaque fois qu'une action ne se déroule pas comme attendu (échec, effet de bord, filtre actif)
- **Solution systémique** : règle "toute action qui échoue, modifie une donnée partagée à la volée, ou masque des résultats doit produire un signal visible", appliquée systématiquement aux formulaires et filtres
- **Impact** : moyen à élevé — érosion de la confiance dans l'outil, risque de duplication de données silencieuse
- **Risque si non traité** : l'utilisateur peut perdre confiance dans la fiabilité de ses données (catégories dupliquées, création qu'il croit avoir faite mais qui a échoué)

### UX-SYS-004 — Vocabulaire technique qui fuit dans l'expérience utilisateur

- **Symptômes** : UX-018 (Information/Idée/Kept), UX-016 (deux dates de Suivi mal nommées)
- **Problèmes concernés** : UX-018, UX-016
- **Cause racine probable** : croissance incrémentale des fonctionnalités sans glossaire central ni relecture de cohérence de nommage entre code et interface (déjà relevé côté données dans `AUDIT_DATA.md`, DATA-007, comme absence de point de référence unique sur l'évolution du schéma)
- **Solution systémique** : tenir un petit glossaire objet ↔ libellé utilisateur ↔ nom technique, vérifié à chaque nouvelle fonctionnalité touchant un objet existant
- **Impact** : moyen — n'empêche pas d'utiliser l'app mais complique la compréhension et la recherche
- **Risque si non traité** : confusion croissante à mesure que de nouveaux types/statuts s'ajoutent

### UX-SYS-005 — Décomposition (sous-étapes) systématiquement différée après la création

- **Symptômes** : UX-011 (checklist/sous-parties absentes du formulaire de création)
- **Problèmes concernés** : UX-011
- **Cause racine probable** : les mécanismes de décomposition ont été ajoutés comme fonctionnalités de fiche détail après coup, jamais réintégrés au flux de capture initial malgré l'intention affichée du projet Pilotage lui-même ("Décomposer si nécessaire" dès la réception d'une information)
- **Solution systémique** : permettre un ajout minimal et optionnel de sous-éléments dès la création, sans forcer cette étape pour les cas simples
- **Impact** : moyen
- **Risque si non traité** : perte du bénéfice de décomposer "à chaud", au moment où l'information est la plus fraîche

### UX-SYS-006 — Rappels et notifications construits tâche-centriques

- **Symptômes** : UX-005 (pas de notification de Suivi en retard), UX-015 (horodatage Revue hebdo peu fiable)
- **Problèmes concernés** : UX-005, UX-015
- **Cause racine probable** : le système de rappel (notification push, bandeau Dashboard) a été pensé et validé sur les Tâches en premier, jamais étendu systématiquement aux autres entités porteuses d'échéance (Suivi) ni fiabilisé pour mesurer un traitement réel plutôt qu'une simple ouverture
- **Solution systémique** : traiter "échéance dépassée" comme un concept transverse à toutes les entités qui en portent une (Tâche, Suivi), pas comme une fonctionnalité propre à la Tâche
- **Impact** : moyen à élevé
- **Risque si non traité** : oublis de relance envers des personnes, contraires à l'intention "ne rien oublier" du cahier des charges

### UX-SYS-007 — Asymétrie du point d'entrée de création entre entités

- **Symptômes** : UX-001 (pas de "+ Tâche" visible), garde-fou de confirmation présent d'un côté (nouveau projet depuis Tâche) absent de l'autre (nouvelle catégorie depuis Projet, UX-008)
- **Problèmes concernés** : UX-001, UX-008
- **Cause racine probable** : chaque écran de création a été conçu indépendamment, sans gabarit commun de "comment créer une entité et comment gérer une valeur liée créée à la volée"
- **Solution systémique** : définir un gabarit commun de formulaire de création (point d'entrée toujours visible, validation avec retour explicite, confirmation systématique pour toute création dérivée), appliqué à toutes les entités
- **Impact** : élevé — explique une bonne partie des incohérences relevées section 20
- **Risque si non traité** : chaque nouvelle entité future risque de reproduire une variante différente du même problème

---

## 24. Matrice de priorisation

| ID | Problème | Fréquence | Importance | Effort | Priorité |
|---|---|---|---|---|---|
| UX-001 | Pas de "+ Tâche" dans Pilotage | Haute | Haute | S | P0 |
| UX-002 | Validation silencieuse | Moyenne | Haute | S | P0 |
| UX-003 | Pas de report rapide (Kanban) | Haute | Haute | S/M | P0 |
| UX-004 | Santé projet invisible en fiche | Haute | Haute | S | P0 |
| UX-005 | Suivi sans action rapide/notification | Haute | Haute | S/M | P1 |
| UX-006 | Recherche exclut archivés par défaut | Moyenne | Haute | S | P1 |
| UX-007 | Qualification Inbox unitaire | Moyenne | Moyenne | M | P1 |
| UX-008 | Catégorie dupliquée silencieusement | Faible | Moyenne | S | P2 |
| UX-010 | Case "Communication" non expliquée | Faible | Moyenne | S | **P2 — décision validée, à déplacer après création** |
| UX-011 | Décomposition différée après création | Moyenne | Moyenne | M | P2 |
| UX-013 | Résultats recherche Décision incomplets | Moyenne | Faible | S | P2 |
| UX-014 | Pas de prép. réunion projet centralisée | Faible | Moyenne | M | P2 |
| UX-015 | Horodatage Revue hebdo peu fiable | Faible | Faible | S | P2 |
| UX-016 | Deux dates Suivi mal distinguées | Moyenne | Faible | S | P2 |
| UX-017 | `resource.tags` mort | Faible | Faible | S | P2 |
| UX-018 | Vocabulaire Inbox instable | Faible | Faible | M | **P2 — question ouverte (section 28)** |
| UX-026 | Pas de lien auto à la qualification Inbox | Moyenne | Moyenne | S | **P2 — confirmé absent, décision validée : à introduire** |
| UX-012 | Pas de bilan à la clôture | — | — | — | **Clos — décision validée : ne pas imposer** |
| UX-020 | Priorisation redondant (fusion envisagée) | — | — | — | **Clos pour la fusion — décision validée : onglet séparé conservé** |
| UX-023 | Quick-add Tableau incomplet | — | — | — | **Clos — décision validée : choix assumé** |
| UX-009, 019, 021, 022, 024, 025, 027 | Divers mineurs | Faible | Faible | S/M | P3 |

Problèmes systémiques (impact transverse, à traiter en priorité conceptuelle même si chaque symptôme individuel est P1/P2) : **UX-SYS-001, UX-SYS-002, UX-SYS-003, UX-SYS-007** en premier (impact élevé, effort modéré car il s'agit de généraliser des patterns déjà écrits), puis UX-SYS-004/005/006.

**Arbitrages reçus le 15/09/2026** : trois problèmes sont clos sans action (UX-012, UX-020 pour sa fusion, UX-023 — choix de conception confirmés), deux corrections sont désormais actées (UX-010 à déplacer après création, UX-026 confirmé absent et à introduire), un comportement reste inchangé mais avec un complément optionnel (UX-007), et une seule question reste ouverte (UX-018, vocabulaire Information/Idée — voir section 28).

---

## 25. Améliorations d'usage retenues (Top 10 initial + ajustements du 15/09/2026)

1. **Ajouter des actions rapides de report d'échéance sur la carte Kanban** (+1 jour / +7 jours / choisir une date), symétriques aux boutons de statut existants — répond à UX-003/UX-SYS-001, effort S/M, impact élevé.
2. **Ajouter un bouton "+ Nouvelle tâche" visible dans l'écran Pilotage** — répond à UX-001/UX-SYS-007, effort S, impact élevé.
3. **Afficher le score de santé du projet dans sa fiche détail et sur sa carte Dashboard** (donnée déjà calculée) — répond à UX-004/UX-SYS-002, effort S, impact élevé.
4. **Ajouter des actions rapides "🔁 Relancer" / "✅ Réglé" sur les lignes de Suivi** — répond à UX-005/UX-SYS-001, effort S, impact élevé.
5. **Ajouter un retour visuel explicite sur validation échouée** dans les formulaires de création — répond à UX-002/UX-SYS-003, effort S, impact moyen à élevé.
6. **Étendre la notification quotidienne de retard aux Suivis en contrôle dépassé** — répond à UX-005/UX-SYS-006, effort S/M, impact élevé.
7. **Cocher par défaut (ou signaler clairement) l'inclusion des éléments archivés dans la recherche** — répond à UX-006/UX-SYS-002, effort S, impact moyen à élevé.
8. **Ajouter une confirmation avant création silencieuse d'une nouvelle catégorie de projet** — répond à UX-008/UX-SYS-003/UX-SYS-007, effort S, impact moyen.
9. **Ajouter une option explicite de qualification Inbox en lot, non activée par défaut**, réservée aux issues simples (Information/Idée/Archivé) — répond à UX-007 (décision confirmée : le flux unitaire reste le comportement par défaut), effort M, impact moyen.
10. **Rendre "Management" visible comme sous-onglet dans Équipe** plutôt qu'un filtre caché — répond à UX-021, effort M, impact moyen. (Priorisation reste un onglet séparé du Kanban à la demande de l'utilisateur : le graphique urgence/impact/blocage et le réglage des poids justifient cette distinction — UX-020 clos sans fusion.)
11. **Introduire un lien automatique entre un item Inbox qualifié et l'entité créée**, en réutilisant `linksApi.createLink` déjà écrit pour "+ Créer et lier" — répond à UX-026 (confirmé absent le 15/09/2026, décision validée : à introduire), effort S, impact moyen.
12. **Retirer la case "Communication" du formulaire de création de tâche** et la déplacer dans la fiche détail (NIVEAU 3 réel) — répond à UX-010 (décision confirmée), effort S, impact faible à moyen.

*UX-012 (bilan de clôture) et UX-023 (quick-add Tableau) sont clos sans action suite aux arbitrages du 15/09/2026 : ce sont des choix de conception confirmés, pas des corrections à apporter.*

---

## 26. Parcours cibles

### Capture rapide (référence, déjà proche de la cible)

Actuel : FAB/`Alt+N` → 1 champ → "Enregistrer" → (option) type rapide → qualification différée sans perte. Aucun changement recommandé sur ce parcours lui-même ; il sert de référence de qualité pour les autres.

### Report / replanification (cible)

Actuel (Kanban) : ouvrir la fiche → onglet Détails → champ date → Enregistrer (≥3 clics, 1 écran complet).
Cible : depuis la carte, un contrôle rapide ("📅 ▾") proposant +1 jour / +7 jours / une date libre, sans quitter le Kanban — ramène le coût au niveau de la vue Tableau (1 clic) tout en restant dans la vue par défaut. Principe appliqué : généraliser le pattern d'action rapide déjà existant pour le statut.

### Clôture (cible)

Actuel (Suivi) : ouvrir la fiche complète → changer le select → Enregistrer (≥2 clics, 1 écran à ~15 champs).
Cible : bouton "✅ Réglé" directement sur la ligne de Suivi, avec un champ optionnel "Résultat" proposé dans un mini-formulaire d'1 ligne (pas la fiche complète), cohérent avec l'intention du cahier des charges de garder trace du résultat sans imposer de friction sur les cas triviaux.

---

## 27. Recommandations

Conformément à la règle finale de cet audit, aucune recommandation ne vise à ajouter de la complexité. Les dix améliorations de la section 25 partagent toutes la même logique : **généraliser des patterns déjà écrits et déjà éprouvés dans le code** (actions rapides de statut, confirmation de création liée, calcul de santé) plutôt que d'introduire de nouveaux concepts. Aucune des corrections envisagées n'ajoute de champ obligatoire ni d'étape supplémentaire au parcours le plus rapide déjà existant (capture, changement de statut de tâche) — la structure actuelle mérite d'être étendue à l'identique aux entités qui en sont aujourd'hui privées (Suivi, date d'échéance), pas remplacée.

Ordre de traitement suggéré : traiter d'abord les quatre problèmes systémiques à fort impact (UX-SYS-001, 002, 003, 007) via les actions 1 à 5 de la section 25, qui sont aussi les moins coûteuses en effort ; les autres systémiques (004/005/006) et les problèmes P2/P3 peuvent suivre sans urgence.

Suite aux arbitrages reçus le 15/09/2026 (section 28 de la version précédente de ce document), trois choix de conception sont désormais confirmés et n'appellent aucune correction (UX-012 : ne pas imposer de bilan à la clôture ; UX-020 : conserver Priorisation comme onglet séparé, le graphique et le réglage des poids le justifient ; UX-023 : le quick-add minimaliste du mode Tableau est un choix assumé de rapidité). Deux corrections sont actées et ajoutées à la liste (UX-010 : déplacer la case "Communication" après création ; UX-026 : introduire un lien automatique à la qualification Inbox, absence désormais confirmée par recherche exhaustive dans le code). Le traitement par lot de la qualification Inbox (UX-007) reste volontairement unitaire par défaut, avec un complément optionnel à ajouter pour les cas simples.

---

## 28. Questions restant à valider par l'utilisateur

Six des sept questions initialement posées ont été arbitrées par l'utilisateur le 15/09/2026 (décisions reportées dans les fiches UX-007, UX-010, UX-012, UX-020, UX-023, UX-026 et dans les sections 24-25 ci-dessus). Une seule reste ouverte :

- **UX-018** — Vocabulaire Inbox "Information" vs "Idée" : l'un des deux libellés doit-il disparaître, ou portent-ils une nuance réelle pour l'utilisateur qui justifierait de les garder distincts (auquel cas c'est le code — `entityType: "Kept"`, statut `"kept"` — qu'il faudrait aligner sur l'UI, pas l'inverse) ?

---

*Fin du document. 27 problèmes individuels et 7 problèmes systémiques identifiés. Suite aux arbitrages du 15/09/2026 : 3 clos sans action (UX-012, UX-020 pour sa fusion, UX-023), 2 corrections actées (UX-010, UX-026 — priorité relevée à P2), 1 comportement confirmé avec complément optionnel (UX-007), 1 question encore ouverte (UX-018). Aucun fichier applicatif n'a été modifié — audit strictement en lecture seule, conforme à la consigne initiale.*
