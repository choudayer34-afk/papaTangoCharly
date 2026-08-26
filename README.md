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
- ✅ Synchro multi-appareils (Firestore, offline-first)
- ⏳ À venir : calendrier, canevas pilotés par données, rappels programmés, revue
  hebdomadaire, statut de projet (clôturer/rouvrir/archiver), point manager automatique
