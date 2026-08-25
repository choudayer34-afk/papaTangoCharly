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
- ✅ Inbox + qualification (Action / Information / Archiver — les autres types arrivent)
- ✅ Tâches avec critère de clôture, rattachement à un projet, indicateur bloqué
- ✅ Kanban à 5 colonnes, drag & drop
- ✅ Projets (objectif, critère de réussite, avancement calculé depuis les tâches liées)
- ✅ Équipe (liste + fiche par personne : engagements en cours, réalisé, notes)
- ✅ Suivis collaborateurs (engagement, échéance, date de contrôle, statut)
- ✅ Dashboard (retards, à traiter, à suivre, en attente, avancement des projets)
- ✅ Synchro multi-appareils (Firestore, offline-first)
- ⏳ À venir : ressources, calendrier, canevas, rappels programmés, recherche, historique
  visible, revue hebdomadaire, points collaborateur/manager automatiques
