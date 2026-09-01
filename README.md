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
- ✅ Espace Management dédié (§34/§35) : écran "👔 Management" pour faire remonter des sujets
  à son propre manager (décisions attendues, sujets à discuter, difficultés) et préparer son
  propre "Point manager" (🟢 Réalisé / 🔵 En cours / ⚠️ Difficultés / 🗳️ Décisions attendues /
  📌 Sujets à discuter / 🎯 Prochaines étapes) — le "depuis le dernier point" est pour
  l'instant approximé par une fenêtre glissante de 7 jours, faute d'horodatage dédié
- ✅ Calendrier (§26) : vues mois/semaine agrégeant échéances de tâches, réunions, décisions
  et suivis, glisser-déposer pour reporter une échéance ; le clic sur un jour ouvre son agenda
  (pas de troisième vue "Jour" séparée)
- ✅ Revue hebdomadaire guidée (§51) : une modale qui rassemble Inbox, Retards, Suivis à
  contrôler, Projets sans prochaine action, Équipe, Management et Ressources non classées,
  chaque ligne ouvrant la vraie fiche pour la traiter
- ✅ Synchro multi-appareils (Firestore, offline-first)
- ✅ Catégories de projet (ex. CSE, Modernisation) avec icône assignée automatiquement au
  premier usage (`js/domain/preferences.js`) et filtre dédié dans l'onglet Projets
- ✅ Sous-parties de projet (§ retour de Charles-Henri) : suivi d'avancement d'un bloc tenu par
  l'équipe (⚪ non commencé / 🔵 en cours / 🟢 terminé), volontairement distinct d'une Tâche —
  pas de date ni d'action individuelle, juste une visibilité de where-en-est-on
- ✅ Fiche Projet : chaque bloc (Tâches, Suivis, Réunions, Décisions, Ressources) est
  entièrement cliquable — un clic ouvre la fiche détaillée du sous-élément et la referme
  ramène à la fiche projet plutôt que de révéler l'écran du dessous
- ✅ Historique replié par défaut dès qu'il dépasse 6 entrées (`<details>/<summary>`, sur
  Projet/Tâche/Personne/Ressource) pour ne pas allonger indéfiniment les fiches
- ✅ Boutons Fermer/Supprimer/Enregistrer toujours visibles en bas de modale, sans avoir à
  scroller jusqu'en bas du contenu
- ✅ Onglet Projets : tri par avancement ou ordre manuel (glisser-déposer), repris à
  l'identique par l'ordre des projets sur le Dashboard
- ✅ Dashboard : 6 cartes chiffrées cliquables (retard, à traiter, aujourd'hui, à suivre, en
  attente, relances dues) ouvrant la liste sous-jacente ; rubrique pliable "à échéance dans
  les 7 jours" ; section "Informations & idées" pour les captures qualifiées comme telles
  (elles ne disparaissaient plus nulle part auparavant) ; clic direct sur un projet listé
- ✅ Capture express : bouton "+ Préciser maintenant" optionnel pour choisir le type et sauter
  directement sur la qualification, sans ralentir la capture par défaut
- ✅ Tâche : checklist (canevas Communication) horodatée à la coche ; ressources liées
  affichées par titre cliquable + bouton copier plutôt que l'URL brute ; recherche/filtre par
  type dans le sélecteur de ressource existante ; association manuelle à une ou plusieurs
  réunions Outlook (référence simple, pas d'intégration Microsoft Graph)
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
  casquette par casquette (Toi, Équipe, Projets, Manager, CSE), cas d'usage détaillés avec le
  gain et la fonction à utiliser — vit dans le code, mis en cache par le service worker,
  consultable sans connexion (pas une page hébergée à part)
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
- ⏳ À venir : éditeur de canevas personnalisé (§19), rappels programmés, statut de projet
  (clôturer/rouvrir/archiver), horodatage réel du "dernier point manager", vraie intégration
  Outlook (OAuth/Microsoft Graph) si le besoin dépasse la référence manuelle actuelle ; le
  filtre par casquette ne couvre pour l'instant que l'Accueil et Pilotage ; les recettes de
  démarrage se limitent à 2 scénarios pour l'instant
