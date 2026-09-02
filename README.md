# papaTangoCharly — Pilotage

Assistant personnel de pilotage professionnel : capturer, qualifier, planifier, suivre,
clôturer et retrouver — sans rien perdre en route.

Cahier des charges complet et proposition d'architecture cible : voir le projet Claude
« Pilotage » (docs `TangoTcharly.docx` et `architecture-cible-pilotage.md`).

## Stack

PWA en JavaScript vanilla (ES modules), sans framework ni bundler — dans la continuité
d'EnVie et d'eProtec. Stockage via Firestore (`js/services/storage.js`), offline-first
(cache local persistant) avec synchronisation automatique entre appareils. Authentification
Firebase (Google ou email/mot de passe) requise — les données vivent sous `users/{uid}/...`.
Une implémentation alternative 100 % locale (IndexedDB, sans compte) est conservée dans
`js/services/storage-local.js` à titre de référence — elle respecte exactement la même
interface, c'est ce qui permettrait de revenir en arrière ou de proposer un mode hors-ligne
pur plus tard.

## Lancer en local

Aucun build nécessaire. Servir le dossier avec n'importe quel serveur statique, par exemple :

```
npx serve .
```

puis ouvrir l'URL indiquée. Une connexion (Google ou email/mot de passe, à activer dans
Firebase Authentication) est nécessaire au premier chargement.

### Règle de sécurité Firestore recommandée

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

## État actuel (socle P0)

- ✅ Capture express (bouton flottant, partout dans l'app)
- ✅ Inbox + qualification complète (Action, Suivi, Projet, Réunion, Décision, Ressource,
  Information, Idée, Archiver — les 9 issues du §12 créent toutes une vraie entité, plus
  aucune ne retombe silencieusement en "Information" générique)
- ✅ Tâches avec critère de clôture, rattachement à un projet, indicateur bloqué
- ✅ Kanban à 5 colonnes, drag & drop
- ✅ Projets (objectif, critère de réussite, avancement calculé depuis les tâches liées,
  Suivis/Réunions/Décisions/Ressources liés visibles depuis la fiche projet)
- ✅ Équipe (liste + fiche par personne : engagements en cours, réalisé, notes)
- ✅ Suivis collaborateurs (engagement, échéance, date de contrôle, statut)
- ✅ Ressources (bibliothèque de liens/emplacements, détection auto du type, rattachement
  multiple à des projets et des tâches sans jamais dupliquer la ressource, filtres
  Récentes / Par type / Non classées, recherche titre/description/tag)
- ✅ Réunions et Décisions (capture rapide, rattachement optionnel à un projet, retrouvables
  depuis la fiche projet ou depuis "🧠 Récemment" au Dashboard)
- ✅ Historique visible (§46) : chaque fiche importante (Projet, Tâche, Personne, Ressource)
  affiche sa propre frise chronologique — celle d'un Projet ou d'une Personne agrège aussi
  l'historique de tout ce qui lui est rattaché (tâches, suivis, réunions, décisions,
  ressources) ; un fil global "🕒 Tout l'historique" est accessible depuis le Dashboard
- ✅ Modifier / Supprimer partout : les 7 types d'entité (Tâche, Projet, Personne, Suivi,
  Ressource, Réunion, Décision) ont désormais une fiche entièrement modifiable (tous les
  champs, pas seulement quelques-uns) et un bouton Supprimer avec confirmation — plus aucune
  fiche en lecture seule, plus aucune erreur de saisie irréversible. Aucune suppression n'est
  en cascade : les entités liées gardent leur lien dans le vide plutôt qu'un effet de bord
  risqué (voir les commentaires de chaque removeX() dans js/domain/)
- ✅ Dashboard (retards, à traiter, à suivre, en attente, relances collaborateurs dues,
  avancement des projets, réunions et décisions récentes, accès à l'historique complet) —
  les suivis collaborateurs en retard de contrôle remontent maintenant ici (nouvelle section
  "📣 Suivis à relancer" + pastille dans les stats), sans avoir à ouvrir l'onglet Équipe
- ✅ Onboarding intégré : visite guidée au tout premier lancement (6 écrans, une fois,
  mémorisée), et bouton ❓ Aide toujours accessible (cycle capture → qualification, Tâche vs
  Suivi, rejouer la visite à tout moment)
- ✅ Recherche globale cross-entités (§45/§52) : bouton 🔎 toujours accessible, un mot-clé
  interroge tâches/projets/personnes/suivis/ressources/réunions/décisions d'un coup,
  résultats groupés par type, cliquables vers la vraie fiche (jamais une vue dupliquée)
- ✅ Préparer un point collaborateur (§33, "suivi managérial") : depuis la fiche d'une
  personne, un bouton recompose en un coup d'œil ses suivis en retard, ceux à aborder et les
  derniers terminés — prêt pour un 1:1 sans relire chaque engagement un par un
- ✅ Fil conducteur (liens entre fiches) : n'importe quelle fiche (Tâche, Projet, Personne,
  Suivi, Ressource, Réunion, Décision) peut être liée à n'importe quelle autre, dans les deux
  sens — une section "🔗 Lié" sur chaque fiche, avec "🔗 Lier une fiche" (choisir parmi
  l'existant) et "+ Créer et lier" (créer une nouvelle fiche d'un autre type sans quitter le
  sujet en cours, ex. créer la tâche "Parler à N. du retard de D" directement depuis la fiche
  Projet ou Réunion). Modélisé comme une collection dédiée (`js/domain/links.js`), pas des
  tableaux embarqués — même principe que l'historique — et chaque lien/déliaison s'inscrit
  aussi dans l'historique de fiche (§46)
- ✅ Ergonomie du Kanban : chaque carte a désormais des boutons ◀ › pour changer son statut
  sans dépendre du glisser-déposer ni du défilement horizontal (utile sur mobile), en plus du
  drag & drop existant et du changement de statut depuis la fiche tâche
- ✅ Fiche Projet enrichie : un bouton "+ Ajouter" sur chacun des blocs Tâches/Suivis/
  Réunions/Décisions permet de créer directement depuis la fiche, préremplie avec ce projet
- ✅ Tâche avec description longue, jamais tronquée — y compris lors d'une qualification
  Inbox → Action, où le champ est prérempli avec la capture brute complète
- ✅ Push d'info (§33) : un Suivi peut désormais être orienté "à transmettre" (à une personne
  ou à l'équipe) plutôt que "j'attends quelque chose d'elle" — ressort dans la préparation du
  point et au Dashboard avec un pictogramme 📣 dédié
- ✅ Canevas pilotés par données (§14-19, §78.9) : 4 modèles fixes (Réunion, Point
  collaborateur, Projet, Communication) stockés comme donnée, pas comme code
  (`js/domain/templates.js`) — chaque Projet a son propre canevas, une Réunion peut activer
  celui du point collaborateur, une Tâche marquée "communication" active le sien ; l'éditeur
  de canevas personnalisé (§19) n'est pas encore construit
- ✅ Filtre "👔 Mon manager" (§34/§35, dans l'onglet Équipe depuis le 02/09/2026) : pour faire
  remonter des sujets à son propre manager (décisions attendues, sujets à discuter,
  difficultés) et préparer son propre "Point manager" (🟢 Réalisé / 🔵 En cours / ⚠️
  Difficultés / 🗳️ Décisions attendues / 📌 Sujets à discuter / 🎯 Prochaines étapes) — le
  "depuis le dernier point" est pour l'instant approximé par une fenêtre glissante de 7 jours,
  faute d'horodatage dédié. Anciennement un onglet "👔 Management" séparé, fusionné dans
  Équipe (voir "onglets comme filtres" plus bas)
- ✅ Calendrier (§26) : vues mois/semaine agrégeant échéances de tâches, réunions, décisions
  et suivis, glisser-déposer pour reporter une échéance ; le clic sur un jour ouvre son agenda
  (pas de troisième vue "Jour" séparée)
- ✅ Revue hebdomadaire guidée (§51) : une modale qui rassemble Inbox, Retards, Suivis à
  contrôler, Projets sans prochaine action, Équipe (dont le point avec son propre manager) et
  Ressources non classées, chaque ligne ouvrant la vraie fiche pour la traiter
- ✅ Synchro multi-appareils (Firestore, offline-first)
- ✅ Catégories de projet (ex. CSE, Modernisation) avec icône assignée automatiquement au
  premier usage (`js/domain/preferences.js`) et filtre dédié dans l'onglet Projets
- ✅ Sous-parties de projet (§ retour de Charles-Henri) : suivi d'avancement d'un bloc tenu par
  l'équipe (⚪ non commencé / 🔵 en cours / 🟢 terminé), volontairement distinct d'une Tâche —
  pas de date ni d'action individuelle, juste une visibilité de where-en-est-on
- ✅ Fiche Projet : chaque bloc (Tâches, Suivis, Réunions, Décisions, Ressources) est
  entièrement cliquable — un clic ouvre la fiche détaillée du sous-élément et la referme
  ramène à la fiche projet plutôt que de révéler l'écran du dessous
- ✅ Historique toujours replié par défaut (`<details>/<summary>`, sur Projet/Tâche/Personne/
  Ressource) pour ne pas allonger les fiches — replié même en dessous de 6 entrées depuis le
  02/09/2026 (auparavant ouvert tant qu'il y avait 6 entrées ou moins)
- ✅ Boutons Fermer/Supprimer/Enregistrer toujours visibles en bas de modale, sans avoir à
  scroller jusqu'en bas du contenu
- ✅ Onglet Projets : tri par avancement ou ordre manuel (glisser-déposer), repris à
  l'identique par l'ordre des projets sur le Dashboard
- ✅ Dashboard : 5 cartes chiffrées cliquables (retard, à traiter, à suivre, en attente,
  relances dues) ouvrant la liste sous-jacente ; rubrique pliable "à échéance dans
  les 7 jours" ; section "Informations & idées" pour les captures qualifiées comme telles
  (elles ne disparaissaient plus nulle part auparavant) ; clic direct sur un projet listé
- ✅ Capture express : bouton "+ Préciser maintenant" optionnel pour choisir le type et sauter
  directement sur la qualification, sans ralentir la capture par défaut
- ✅ Tâche : checklist (canevas Communication) horodatée à la coche ; ressources liées
  affichées par titre cliquable + bouton copier plutôt que l'URL brute ; recherche/filtre par
  type dans le sélecteur de ressource existante ; association manuelle à une ou plusieurs
  réunions Outlook (référence simple, pas d'intégration Microsoft Graph)
- ✅ Sous-étapes courtes (`js/components/checklist.js`, 01/09/2026, piste TDAH) : sur toute
  Tâche, une checklist libre distincte du canevas Communication — Charles-Henri tape lui-même
  chaque petit pas, coche au fur et à mesure, un compteur "N/M" apparaît sur la fiche et sur la
  carte Kanban correspondante
- ✅ Focus du jour (`js/views/dashboard.js`, 01/09/2026, piste TDAH) : remplace la tuile
  "Aujourd'hui" du Dashboard par une sélection plafonnée à 3 tâches (en retard d'abord, puis
  échéance la plus proche), modifiable d'un clic (🔀) si Charles-Henri préfère travailler sur
  autre chose — l'échange ne vaut que pour la journée en cours, la sélection automatique
  reprend la main le lendemain sans rien à réinitialiser ; la liste complète des échéances du
  jour reste accessible juste en dessous, rien n'est masqué
- ✅ Petit retour positif à la clôture d'une tâche (`js/views/kanban.js`, 01/09/2026, piste
  TDAH) : toast "🎉 Terminé !" + courte animation, déclenchés une seule fois par vraie
  transition vers "Terminé", quel que soit le chemin (glisser-déposer, boutons ‹ ›, fiche
  détail) — jamais sur les autres changements de statut
- ✅ Kanban : tri par défaut par échéance croissante (sans date en dernier), filtres projet /
  ≤7 jours / ≤15 jours / en retard, pleine largeur en mode web desktop (comportement mobile
  inchangé), colonnes à défilement indépendant pour garder les en-têtes visibles au scroll
- ✅ Équipe : suivis triés par date d'ajout décroissante avec l'horodatage affiché ; flag
  "notable" (👍/👎) sur un suivi et objectifs d'une personne avec points de suivi datés,
  alimentant un écran "Préparer l'EADP" (filtré par période, résumé copiable) — version
  volontairement simple (pas d'export/impression, pas de comparaison multi-campagnes)
- ✅ Bibliothèque de prompts IA (`#/prompts`) : titre/description/texte, recherche, copier en
  un clic — version simple sans catégorisation ni rattachement au fil conducteur
- ✅ Guide utilisateur intégré à l'app (`#/guide`, accessible depuis le bouton ❓ Aide) :
  casquette par casquette (Toi, Équipe — qui inclut le point avec son propre manager —,
  Projets, CSE), cas d'usage détaillés avec le gain et la fonction à utiliser — vit dans le
  code, mis en cache par le service worker, consultable sans connexion (pas une page hébergée
  à part)
- ✅ Casquettes (`js/domain/casquettes.js`) : filtre Toutes/Toi/Équipe/Projets/Manager/CSE
  partagé entre l'Accueil et Pilotage, déduit automatiquement du projet lié ou du type de
  personne — aucun nouveau champ à saisir sur les Tâches/Suivis/Réunions/Décisions
- ✅ Rappel de rythme : bandeau sur l'Accueil si la Revue hebdomadaire n'a pas été relancée
  depuis plus de 7 jours (ou jamais)
- ✅ Accueil personnalisable : bouton ⚙️ pour replier/masquer les sections dont on ne se sert
  pas (le bloc chiffré reste toujours visible), mémorisé durablement
- ✅ Aide contextuelle au premier usage (`js/components/hint.js`) : un bandeau discret
  explique Accueil, Pilotage, Inbox et la création d'un Suivi la première fois qu'on les
  ouvre, puis ne revient jamais
- ✅ Information/Idée devenue une vraie fiche (correction) : clic depuis l'Accueil, section
  "🔗 Lié", résolution correcte dans le fil conducteur — comme les 7 autres types liables
- ✅ Recettes de démarrage (`js/components/recipes.js`, bouton 🧩 sur l'Accueil) : enchaîne
  automatiquement les formulaires de création déjà existants pour deux cas récurrents
  ("Nouveau projet transverse" → projet puis suivi ; "Plusieurs suivis pour la même
  personne" → suivis en série sans repasser par la fiche à chaque fois)
- ✅ Suggestions de prochaine étape (`js/components/suggestNextStep.js`) : après avoir coché
  "Créer les actions"/"Planifier les suivis" sur un canevas, ou après avoir enregistré une
  Décision, une invite (jamais automatique) propose de créer tout de suite la fiche liée
- ✅ Rubriques de l'Accueil repliables/dépliables (Suivis en retard, Informations & idées,
  Mes projets, Récemment), comme "À échéance" l'était déjà
- ✅ Auto-archivage des Informations/Idées après 15 jours ; "Récemment" applique la même
  coupure à 15 jours (les éléments restent retrouvables via leur fiche, la recherche globale
  ou "🕒 Tout l'historique")
- ✅ Sens du Suivi visible dès la qualification Inbox → Suivi (correction, 01/09/2026) :
  l'Inbox réutilise directement la modale complète de création de Suivi (chip "Sens",
  catégorie, notable) au lieu d'une seconde version simplifiée qui avait fini par diverger
- ✅ Journal de notes horodaté (`js/components/notesBlock.js`, 01/09/2026) : un bloc "🗒️
  Notes" additif (jamais d'édition ni de suppression) sur Tâches, Suivis, Projets, Réunions,
  Décisions, Ressources, Personnes et Informations/Idées — la date et l'heure s'alimentent
  automatiquement à l'ajout ; chaque note ajoutée apparaît aussi dans l'Historique de la fiche.
  Distinct du champ "Notes" existant sur Personne/Réunion (un contexte libre non daté, qui
  reste inchangé) — les deux coexistent
- ✅ Notes par sous-partie de projet (01/09/2026) : chaque sous-partie a son propre journal de
  notes ; la fiche projet n'affiche que la dernière (texte + date) directement sur la ligne,
  l'historique complet s'ouvre à la demande via le bouton "🗒️ Notes"
- ✅ Aide à la demande (`js/components/infoTip.js`, 01/09/2026) : un petit ⓘ, toujours
  disponible (contrairement au bandeau d'aide au premier usage, qui disparaît pour toujours),
  posé sur le canevas piloté par données et sur la Revue hebdomadaire — explique ce que fait
  la fonction sans imposer de le lire, et sans jamais fermer la fiche en cours
- ✅ Recherche dans le Guide (`js/views/guide.js`, 01/09/2026) : un champ 🔎 dédié au Guide
  (`#/guide`), distinct de la loupe globale de l'Accueil, avec une nouvelle section "Fonctions
  transverses" qui explique en clair Canevas, Revue hebdomadaire, Journal de notes, Aide à la
  demande, Recettes de démarrage, Suggestions de prochaine étape et Filtre par casquette. La
  recherche filtre ligne par ligne la boussole/les onglets/ces fonctions, et bloc entier
  (ouvert automatiquement) pour chaque casquette et pour "Il y a du retard partout"
- ✅ Créer une réunion depuis une Tâche/un Suivi (`js/components/meetingLauncher.js`,
  01/09/2026) : un titre composé "Catégorie - Projet - Intitulé - Personne" (chaque partie
  omise si absente), copiable en un clic pour coller dans Outlook. Le bouton "🗓️ Créer une
  réunion (.ics)" va plus loin : télécharge un fichier .ics à la date/l'heure du moment (30
  minutes par défaut) avec ce titre et un petit lien de retour vers la fiche exacte dans la
  description, PUIS ouvre directement le formulaire de création de Réunion de l'app, déjà
  prérempli avec ce titre et lié à la fiche d'origine. Nécessite un nouveau mécanisme de lien
  profond (`js/services/deeplink.js`, format `#/route?open=Type:id`) : cliquer ce lien depuis
  n'importe où rouvre directement la bonne fiche, pas seulement le bon onglet — reste une
  référence manuelle comme le reste de l'intégration Outlook, pas une vraie API Microsoft Graph
- ✅ "🔄 Reprendre où j'en étais" (01/09/2026, piste TDAH — permanence/repérage) : l'Accueil
  affiche désormais les dernières fiches consultées, tous types confondus (Tâche, Suivi,
  Projet, Personne, Ressource, Réunion, Décision, Information/Idée), la plus récente en tête —
  un clic rouvre directement la bonne fiche, via le même mécanisme que le lien profond du .ics
- ✅ "⏸️ En pause depuis un moment" (01/09/2026, piste TDAH) : nouvelle rubrique repliable sur
  l'Accueil listant les tâches commencées (pas "à faire") mais non retouchées depuis 5 jours —
  distinct du retard (qui dépend d'une échéance) et du Focus (une question de priorité, pas
  d'abandon), sans ton culpabilisant
- ✅ Alerte de démarrage optionnelle (01/09/2026, piste TDAH) : un bandeau propose une
  notification navigateur résumant le retard et les tâches "en pause" à l'ouverture de l'app —
  jamais un vrai push (rien si l'app est fermée), une seule fois par jour, jamais reproposée
  une fois la réponse donnée
- ✅ "🆕 Nouveautés" (`js/views/whatsnew.js`, route cachée `#/whatsnew`, accessible depuis
  ❓ Aide → "🆕 Voir les nouveautés") : un historique rédigé à la main de ce qui a été ajouté à
  l'app, du plus récent au plus ancien, regroupé par vague — répond à "où est-ce que je
  retrouve tout ce qu'on a ajouté ?" (piste TDAH — repérage). Distinct du Guide (qui explique
  comment utiliser une fonction) : ici on retrace quand et pourquoi. Fonctionne hors ligne
  comme le Guide ; seule la vague la plus récente est dépliée par défaut
- ✅ "🧠 Mémoire & TDAH" (`js/views/memory.js`, route cachée `#/memory`, bouton "🧠 Pause
  mémoire" sur l'Accueil, 01/09/2026) : demande explicite de Charles-Henri, cadrée avant
  construction (mélange varié plutôt qu'un seul type d'exercice) — trois exercices courts et
  ludiques, sans suivi de score ni de progression d'une visite à l'autre : 🧩 jeu des paires
  (memory), 🌬️ respiration guidée (4-4-4-4), 🔢 rappel de séquence de longueur croissante.
  Volontairement accessible depuis l'Accueil plutôt que depuis ❓ Aide (réservé aux pages de
  référence Guide/Nouveautés) — ça vit là où Charles-Henri regarde déjà tous les jours
- ✅ "✏️ Saisie laissée en cours" (`js/services/draftStore.js`, `js/components/capture.js`,
  02/09/2026, piste TDAH — persister l'état d'un geste interrompu) : la modale Capturer
  sauvegarde automatiquement ce qui est en train d'être tapé (débattu à 400ms), sans geste
  explicite. Si Charles-Henri est interrompu avant d'enregistrer, un bandeau apparaît en tout
  premier sur l'Accueil au retour — l'équivalent du camion de recyclage qui passe — avec un
  aperçu du texte laissé en plan et deux boutons, Reprendre (rouvre Capturer, prérempli) ou
  Abandonner. Le brouillon n'est jamais perdu par un clic en dehors de la modale ou par Échap ;
  seuls Annuler ou Enregistrer le résolvent pour de bon
- ✅ "🍅 Pomodoro" (`js/services/pomodoroStore.js`, `js/components/pomodoroWidget.js`,
  02/09/2026, demande explicite) : un vrai minuteur de concentration dans "🧠 Mémoire & TDAH"
  (25/5 ou 15/5, pause longue après 4 cycles), qui continue de tourner même après avoir quitté
  cette vue pour aller travailler ailleurs — un mini-minuteur toujours visible (⏸️/▶️) suit sa
  progression depuis n'importe quel écran, avec toast + changement du titre de l'onglet (si en
  arrière-plan) + notification navigateur (si déjà autorisée) à chaque changement de phase
- ✅ Onglets comme filtres — fusion Équipe/Management (02/09/2026, piste TDAH — permanence/
  repérage) : dernière des 5 pistes de cette discussion, laissée de côté un temps sans
  confirmation explicite, reprise à la demande de Charles-Henri. L'onglet "👔 Management"
  n'était déjà qu'une recomposition des mêmes Personnes/Suivis qu'Équipe — fusionné comme
  filtre "👔 Mon manager" dans l'onglet Équipe plutôt que gardé séparé. La barre de navigation
  du bas passe de 9 à 8 onglets
- ✅ Vue "📊 Tableau" dans Pilotage (`js/views/kanban.js`, `js/services/pilotageViewStore.js`,
  02/09/2026) : à côté du Trello existant, une vue façon Monday du même flux de Tâches déjà
  filtré (casquette/projet/échéance) — jamais une seconde donnée. Regroupement par Statut,
  Projet ou aucun (le regroupement masque la colonne correspondante) ; tri par clic sur un
  en-tête ; colonnes réordonnables par glisser-déposer ; édition en ligne du Titre, Statut,
  Projet et Échéance sans ouvrir la fiche complète (bouton "↗" pour l'ouvrir quand même) ; une
  ligne "+ Ajouter une tâche" par groupe, préremplie avec le Statut ou le Projet du groupe ;
  colonne Type en lecture seule (champ jamais édité ailleurs dans l'app). La vue calendrier
  également évoquée par Charles-Henri n'a pas été construite, faute de détail fourni
- ✅ Sous-étapes repliables et cochables sur la carte Trello (`js/views/kanban.js`, 02/09/2026,
  retour de Charles-Henri) : un bouton "▸ ☑️ x/y" affiche/masque la checklist directement sous
  la carte (état de dépli non persisté, propre à la session) ; cocher une case appelle la même
  fonction que la fiche détail (`tasksApi.toggleChecklistItem`), donc toujours la même donnée
- ✅ "⏳ En attente de..." (`js/domain/tasks.js`, `js/views/kanban.js`, 02/09/2026, retour de
  Charles-Henri) : un champ libre sur la carte Trello, visible et modifiable uniquement tant
  que la Tâche est "En attente" ou "À suivre" — ce qu'on attend, et de qui. Effacé
  automatiquement dès que le statut change vers autre chose (même mécanique que
  `completedAt`), pour ne jamais laisser un texte périmé sur une tâche qui a avancé depuis
- ✅ "🙈 Masquer terminées" (`js/views/kanban.js`, 02/09/2026) : un filtre de plus, commun au
  Trello et au Tableau, jamais persisté d'une visite à l'autre
- ✅ Colonnes "Notes" et "Description" dans la vue Tableau (`js/views/kanban.js`, 02/09/2026,
  retour de Charles-Henri) : Notes affiche la dernière note du journal horodaté et permet d'en
  ajouter une directement en ligne (additif, jamais d'édition ni de suppression) ; Description
  est en lecture seule (clic pour ouvrir la fiche complète, un texte long se prêtant mal à
  l'édition en cellule)
- ✅ Glisser une ligne du Tableau vers un autre groupe (`js/views/kanban.js`, 02/09/2026, retour
  de Charles-Henri — façon Monday) : une poignée dédiée par ligne (n'affecte jamais la
  sélection/l'édition des champs de la ligne elle-même), active seulement quand un
  regroupement (Statut ou Projet) structure les lignes — glisser une tâche dans un autre
  groupe change directement le champ correspondant
- ✅ Casquettes affichées dans Pilotage restreintes à Toi/Projets/CSE (`js/domain/casquettes.js`,
  02/09/2026, correction — retour de Charles-Henri : "je comprend pas trop le filtre") :
  Pilotage ne montre que des Tâches, qui ne peuvent jamais être "Équipe" ni "Manager" (pas
  d'assignee) — ces deux chips y produisaient un board vide et confus au clic. L'Accueil, qui
  agrège aussi des Suivis, continue d'afficher les 6 chips
- ✅ Clôturer/rouvrir un projet (`js/domain/projects.js`, `js/views/projects.js`, 02/09/2026,
  retour de Charles-Henri) : un projet fermé, et tout ce qui lui est rattaché (Tâches, Suivis,
  Réunions, Décisions), disparaît des outils de pilotage (Accueil — y compris "🔄 Reprendre où
  j'en étais" —, Pilotage, Calendrier, Revue hebdomadaire) sans que rien ne soit supprimé
  (réutilise le champ `Project.status` existant). Reste retrouvable via un filtre "🗄️ Fermés"
  dans l'onglet Projets existant (pas un nouvel écran d'archive séparé), avec réouverture en un
  clic depuis la fiche ou directement la carte. La recherche globale n'est volontairement pas
  filtrée : elle reste un moyen de retrouver un sujet fermé
- ✅ Statut affiché sur "🗓️ À échéance dans les 7 jours" et "🎯 Focus du jour" (`js/views/
  dashboard.js`, 02/09/2026, retour de Charles-Henri) : icône + libellé (mêmes que
  `tasksApi.STATUS_ICONS`/`STATUS_LABELS`) pour repérer où en est chaque tâche sans l'ouvrir
- ✅ Vue calendrier dans Pilotage (clarification, 02/09/2026) : ce que Charles-Henri visait en
  en parlant était l'onglet Calendrier déjà existant (`#/calendar`) — aucune bascule
  supplémentaire à construire dans Pilotage
- ✅ Audit de simplification "TDAH, écran par écran" (02/09/2026, demande explicite de
  Charles-Henri — checkup complet pour épurer l'app, sa saisie et son pilotage) : toutes les
  suggestions de l'audit ont été mises en œuvre, à l'exception explicite du système "Sous-
  parties" du Projet, gardé volontairement différencié de la checklist des Tâches (deux
  besoins réels : avancement d'un bloc de l'équipe vs sous-étapes personnelles d'une tâche).
  Détail des changements ci-dessous
- ✅ Statut d'un Suivi réduit à 3 états (`js/domain/followups.js`, 02/09/2026) : `waiting`/
  `relaunched`/`done` remplacent le pipeline à 5 statuts des Tâches, réutilisé tel quel jusqu'ici
  sans jamais avoir de "à faire"/"en cours" qui fasse vraiment sens pour un suivi. Les anciennes
  valeurs (`todo`/`in_progress`/`follow_up`) sont ramenées aux nouvelles à la lecture
  (`normalizeStatus()`, appliqué par `listAll`/`subscribe`) — aucune migration risquée à lancer,
  chaque suivi se normalise tout seul dès qu'il est relu
- ✅ Fusion des deux "Notes" d'une Personne (`js/domain/people.js`, `js/views/people.js`,
  02/09/2026) : le champ de contexte libre `notes` disparaît, absorbé dans le Journal de notes
  horodaté comme première entrée (`migrateLegacyNotes()`, appliqué à l'ouverture de la fiche) —
  un seul endroit pour tout ce qui se note sur une personne plutôt que deux qui se ressemblaient
- ✅ Icônes des "Sous-parties" différenciées de celles des Tâches (`js/domain/projects.js`,
  02/09/2026) : ◻️🔶✅ au lieu de ⚪🔵🟢 — seul changement visuel, le système (statut à 3 états,
  notes, modale dédiée) reste intentionnellement distinct de la checklist des Tâches (décision
  explicite de Charles-Henri, malgré la suggestion initiale de l'audit de le fusionner)
- ✅ Profil "épuré" de l'Accueil par défaut (`js/domain/preferences.js`, `js/views/dashboard.js`,
  02/09/2026) : Focus du jour, la nouvelle section fusionnée "⚠️ Ça a besoin de toi" et les
  chiffres-clés restent visibles d'emblée ; "Mes projets", "Récemment", "Reprendre où j'en
  étais" et "Informations & idées" passent masqués par défaut (toujours réactivables via ⚙️).
  Une bascule one-shot (`dashboardHiddenMigratedV19`) applique ce nouveau profil immédiatement
  sans attendre que Charles-Henri rouvre lui-même les réglages, sans jamais écraser une
  personnalisation faite depuis
- ✅ Fusion des 3 sections "a besoin d'attention" de l'Accueil (`js/views/dashboard.js`,
  02/09/2026) : "En pause", "À échéance 7 jours" et "Suivis en retard" deviennent une seule
  section "⚠️ Ça a besoin de toi", triée par urgence (retard d'abord)
- ✅ Formulaires de création unifiés entre l'Inbox et le reste de l'app (`js/views/kanban.js`,
  `js/views/dashboard.js`, `js/views/inbox.js`, 02/09/2026) : Tâche, Réunion et Décision
  n'existent plus qu'en un seul formulaire chacun (celui, déjà le plus complet, utilisé par
  Pilotage/l'Accueil), au lieu d'une version Inbox légèrement différente qui avait fini par
  diverger (champ Projet manquant, notamment). La qualification Inbox reste garantie (Règle 3,
  `sourceInboxItemId`) via un point d'injection (`prefill.createFn` pour la Tâche, `onCreated`
  pour Réunion/Décision) plutôt qu'une copie du formulaire
- ✅ Qualification Inbox simplifiée à 3 choix + "Autre" (`js/views/inbox.js`, 02/09/2026) :
  Action/Suivi/Information, qui couvrent l'essentiel des captures, restent seuls visibles
  d'emblée ; les 6 autres issues (Projet, Réunion, Décision, Ressource, Idée, Archiver) passent
  sous un repli "Autre" — rien n'est supprimé, juste à un clic de plus
- ✅ Filtres casquette + projet regroupés dans un menu "🔧 Filtrer" à Pilotage (`js/views/
  kanban.js`, 02/09/2026) : ces deux filtres secondaires n'ont plus besoin d'occuper deux
  rangées de chips en permanence — un badge sur le bouton indique en un coup d'œil qu'un filtre
  est actif sans avoir à ouvrir le menu. Les chips d'échéance, "🙈 Masquer terminées" et la
  bascule Trello/Tableau restent directement accessibles, inchangés
- ✅ Blocs secondaires repliés par défaut sur les fiches Tâche et Projet (`js/views/kanban.js`,
  `js/views/projects.js`, 02/09/2026) : Ressources, Réunions Outlook associées et Notes (Tâche) ;
  Ressources et Notes (Projet) passent en `<details>` repliés — même mécanique déjà utilisée pour
  l'Historique. Titre/Description/Critère/Échéance/Statut/Projet/Bloqué/Sous-étapes (Tâche) et
  Nom/Catégorie/Objectif/Critère/Sous-parties/Tâches/Suivis/Réunions/Décisions (Projet) restent
  visibles sans avoir à déplier
- ✅ Légendes ⓘ permanentes (`js/components/infoTip.js`, `js/domain/casquettes.js`,
  `js/domain/tasks.js`, `js/domain/followups.js`, `js/views/projects.js`, 02/09/2026) : un petit
  ⓘ à côté du filtre casquette (Accueil, Pilotage) explique la règle de déduction ; à côté du
  vocabulaire de statut sur Pilotage (Tâches), Équipe (Suivis) et la fiche Projet (les trois
  vocabulaires y coexistent) — Tâche et Suivi partagent tous deux une valeur "en attente" avec
  la même icône ⏳ mais un sens différent, source de confusion identifiée par l'audit
- ✅ Bouton d'action dans les toasts + annulation d'un déplacement au Calendrier
  (`js/components/toast.js`, `js/views/calendar.js`, 02/09/2026) : `showToast()` accepte
  désormais un `actionLabel`/`onAction` optionnel (durée d'affichage allongée automatiquement) ;
  glisser une échéance vers un autre jour au Calendrier propose "Annuler" directement dans le
  toast de confirmation, pour rattraper un glisser-déposer accidentel sans rouvrir la fiche
- ✅ Raccourcis clavier (`js/services/shortcuts.js`, 03/09/2026, retour de Charles-Henri :
  "je marche aussi beaucoup au raccourci clavier") : Ctrl+K (rechercher), Alt+N (Capturer),
  Alt+1…8 (changer d'onglet), Ctrl+Entrée (valider la fiche ouverte), Ctrl+Z (annuler le
  dernier toast), 1/2/3/A dans la qualification Inbox — Ctrl+N et Ctrl+1…9 étant réservés par
  tous les navigateurs, remplacés par Alt+N et Alt+1…8 ; tous documentés dans le Guide
  (`#/guide`). Chaque fiche Personne/Projet propose aussi un raccourci personnalisé
  Ctrl+Alt+<touche> assignable soi-même (`js/domain/preferences.js#customShortcuts`)
- ✅ Réordonner les personnes de l'onglet Équipe (`js/domain/people.js`, `js/views/people.js`,
  03/09/2026, retour de Charles-Henri) : glisser-déposer, même mécanisme que le tri manuel de
  l'onglet Projets
- ✅ Recherche globale étendue (`js/components/search.js`, 03/09/2026, retour de Charles-Henri :
  "la recherche doit rechercher dans tous les éléments même les notes ou autre") : le journal de
  notes horodaté de chaque type et les Informations/Idées de l'Inbox (jusqu'ici absentes) sont
  désormais indexés ; chaque résultat Tâche/Suivi/Projet affiche son statut ; un bandeau de
  chips par type (Alt+1…8) permet de cibler la recherche sans la souris
- ⏳ À venir : éditeur de canevas personnalisé (§19), rappels programmés en vrai push (app
  fermée — nécessiterait Firebase Cloud Functions, non fait pour l'instant, voir l'alerte de
  démarrage ci-dessus comme version app-ouverte-uniquement), horodatage réel du "dernier point
  manager", vraie intégration Outlook (OAuth/Microsoft Graph) si le besoin dépasse la référence
  manuelle actuelle ; le filtre par casquette ne couvre pour l'instant que l'Accueil et
  Pilotage ; les recettes de démarrage se limitent à 2 scénarios pour l'instant ; "Créer une
  réunion" ne couvre pour l'instant que Tâches et Suivis, pas les autres fiches liables ; la
  fermeture de projet ne masque pas les Ressources liées (`projectIds` peut viser plusieurs
  projets à la fois, pas de règle simple et non ambiguë à leur appliquer pour l'instant)
