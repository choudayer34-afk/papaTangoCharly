# papaTangoCharly — Pilotage

Assistant personnel de pilotage professionnel : capturer, qualifier, planifier, suivre,
clôturer et retrouver — sans rien perdre en route.

Cahier des charges complet et proposition d'architecture cible : voir le projet Claude
« Pilotage » (docs `TangoTcharly.docx` et `architecture-cible-pilotage.md`).

## Stack

PWA en JavaScript vanilla (ES modules), sans framework ni bundler — dans la continuité
d'EnVie et d'eProtec. Stockage local via IndexedDB pour l'instant (`js/services/storage.js`),
pensé pour être remplacé par un adaptateur Firestore sans toucher au reste du code.

## Lancer en local

Aucun build nécessaire. Servir le dossier avec n'importe quel serveur statique, par exemple :

```
npx serve .
```

puis ouvrir l'URL indiquée.

## État actuel (socle P0)

- ✅ Capture express (bouton flottant, partout dans l'app)
- ✅ Inbox + qualification (Action / Information / Archiver — les autres types arrivent)
- ✅ Tâches avec critère de clôture
- ✅ Kanban à 5 colonnes, drag & drop
- ✅ Dashboard (retards, à traiter, à suivre, en attente, projets)
- ⏳ À venir : projets détaillés, personnes/suivis collaborateurs, ressources, calendrier,
  canevas, rappels, recherche, historique visible, synchro Firestore multi-appareils
