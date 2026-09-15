# AUDIT_OFFLINE.md — Pilotage (papaTangoCharly)

Compilation des problèmes liés au mode déconnecté identifiés au fil des revues menées dans cette conversation (audit "usage en mode déconnecté" du 15/09/2026, audit "anomalies d'usage ou d'enregistrement en silence" pour les trois échecs techniques liés à la connectivité). Document rétrospectif : tous les problèmes listés ont déjà été corrigés et livrés (patches indiqués dans "Correction recommandée").

_Compilé le 15/09/2026, sans nouvelle analyse ni nouveau scan du projet — uniquement à partir des résultats déjà obtenus dans cette conversation._

---

## OFFLINE-001

- **Gravité** : MOYENNE
- **Fichier(s)** : aucun avant correctif (absence totale de gestion) ; désormais `js/services/onlineStatus.js`, `js/app.js`, `styles/components.css`
- **Scénario concerné** : l'appareil perd sa connexion réseau pendant une session active dans l'app.
- **Problème** : aucune utilisation de `navigator.onLine` ni des événements `online`/`offline` nulle part dans le code — aucun indicateur visible ne signalait la perte de connexion.
- **Cause** : fonctionnalité jamais implémentée.
- **Risque** : l'utilisateur ignore qu'il est hors-ligne ; un ralentissement ou un blocage ultérieur (voir OFFLINE-002) est interprété comme un bug plutôt que comme une conséquence attendue de la coupure.
- **Comportement attendu** : bandeau visible en haut de l'écran dès la perte de connexion, disparaissant automatiquement au retour en ligne.
- **Correction recommandée** : déjà corrigée (patch 0051) — nouveau module `onlineStatus.js` (wrapper `navigator.onLine` + écouteurs `online`/`offline`) et bandeau monté/démonté dans `app.js`.
- **Effort** : M
- **Dépendances éventuelles** : sert de socle à OFFLINE-002.

## OFFLINE-002

- **Gravité** : HAUTE
- **Fichier(s)** : `js/components/modal.js`
- **Scénario concerné** : déclenchement d'une action d'écriture (Enregistrer, Convertir, Supprimer) pendant que l'appareil est hors-ligne.
- **Problème** : le bouton associé restait désactivé indéfiniment, sans aucun message expliquant l'attente.
- **Cause** : les promesses `setDoc`/`addDoc`/`updateDoc`/`deleteDoc` de Firestore ne se résolvent qu'une fois l'écriture confirmée par le serveur ; hors-ligne, cette confirmation n'arrive jamais tant que la connexion n'est pas rétablie (comportement documenté du SDK Firestore, non vérifiable en direct depuis cet environnement de développement — pas d'accès réseau au projet Firestore réel).
- **Risque** : l'utilisateur peut croire l'application plantée et forcer un rechargement de la page pendant l'attente. Conséquence exacte d'un tel rechargement (perte de la modification en cours vs. reprise via le cache Firestore persistant) : Non déterminé — non testé contre le projet Firestore réel.
- **Comportement attendu** : message explicite indiquant que l'action sera enregistrée au retour de la connexion, sans faire croire à un blocage.
- **Correction recommandée** : déjà corrigée (patch 0051) — message affiché après 2,5 s d'attente hors-ligne, sur toute action utilisant `closesModal: false` ou `guardClick`.
- **Effort** : S
- **Dépendances éventuelles** : dépend d'OFFLINE-001 (`onlineStatus.js`).

## OFFLINE-003

- **Gravité** : HAUTE
- **Fichier(s)** : `js/components/modal.js`
- **Scénario concerné** : confirmation d'une suppression (`confirmDelete`) — scénario aggravé hors-ligne, où l'attente réelle de confirmation peut être longue ou indéfinie (voir OFFLINE-002).
- **Problème** : la modale de confirmation se refermait au moment même du clic sur "Supprimer", avant que la suppression ne soit réellement terminée.
- **Cause** : branche par défaut de `openModal()` — `onClick` déclenché sans être attendu, fermeture immédiate enchaînée derrière.
- **Risque** : aucune visibilité sur l'issue réelle de la suppression au moment où elle compte le plus (une action irréversible) ; particulièrement trompeur hors-ligne, où la fermeture apparente de la fenêtre ne reflète pas l'état réel de l'écriture.
- **Comportement attendu** : la modale ne se ferme qu'après résolution effective de la suppression (et affiche l'attente hors-ligne comme en OFFLINE-002 le cas échéant).
- **Correction recommandée** : déjà corrigée (patch 0051) — réécrite avec `closesModal: false`, fermeture après `await onConfirm()`.
- **Effort** : S
- **Dépendances éventuelles** : même fichier/passage qu'OFFLINE-004 (corrigés ensemble).

## OFFLINE-004

- **Gravité** : HAUTE
- **Fichier(s)** : `js/components/modal.js`, `js/components/adminPanel.js`
- **Scénario concerné** : une suppression confirmée (`confirmDelete`) dont le traitement rouvre lui-même une autre modale avant de se terminer (cas observé : suppression d'un tag depuis l'administration) — risque accru si l'attente est prolongée par une coupure réseau.
- **Problème** : la fermeture via la fonction globale `closeModal()` refermait la **nouvelle** modale (celle rouverte par `onConfirm`) au lieu de celle sur laquelle portait le clic initial.
- **Cause** : `closeModal()` global opère toujours sur la modale "active" au moment de l'appel, laquelle est réassignée dès qu'une nouvelle modale s'ouvre.
- **Risque** : fermeture erronée d'une fenêtre que l'utilisateur vient d'ouvrir, sans rapport avec son clic d'origine — perte de contexte et confusion.
- **Comportement attendu** : seule la modale d'origine (celle du clic "Supprimer") se ferme, quelle que soit l'activité déclenchée par la confirmation.
- **Correction recommandée** : déjà corrigée (patch 0051) — utilisation de la fonction `close` spécifique à l'instance de modale (retournée par `openModal()`, protégée par un flag privé `closed`) au lieu de `closeModal()` global. Vérifié par un test Playwright dédié à ce scénario précis.
- **Effort** : S
- **Dépendances éventuelles** : découvert en corrigeant OFFLINE-003 ; corrigés dans le même patch.

## OFFLINE-005

- **Gravité** : HAUTE
- **Fichier(s)** : `sw.js`
- **Scénario concerné** : installation ou mise à jour du Service Worker alors qu'un seul fichier de `APP_SHELL` est temporairement indisponible (404, coupure réseau ponctuelle pendant un déploiement en cours).
- **Problème** : `cache.addAll(APP_SHELL)` est atomique — un seul fichier en échec faisait échouer l'installation entière du Service Worker.
- **Cause** : usage de l'API `Cache.addAll()`, atomique par conception.
- **Risque** : aucun précache créé pour la version concernée, pour **tous** les utilisateurs installant ou mettant à jour l'app à ce moment précis — silencieux, donc difficile à détecter côté exploitation ; impact potentiellement large malgré une cause ponctuelle.
- **Comportement attendu** : un échec isolé sur un fichier ne doit pas empêcher le précache des ~90 autres fichiers de `APP_SHELL`.
- **Correction recommandée** : déjà corrigée (patch 0052) — chaque fichier mis en cache individuellement via `Promise.allSettled`, échecs isolés journalisés (`console.error`) sans bloquer l'installation.
- **Effort** : S
- **Dépendances éventuelles** : aucune ; a permis de fiabiliser OFFLINE-006 et OFFLINE-007 ci-dessous.

## OFFLINE-006

- **Gravité** : FAIBLE
- **Fichier(s)** : `sw.js`, `manifest.json`, `index.html`
- **Scénario concerné** : usage hors-ligne avant que le navigateur n'ait chargé une première fois les icônes de l'app (première visite, ou après un vidage du cache navigateur).
- **Problème** : les icônes (`icon-192.png`, `icon-192-maskable.png`, `icon-512.png`), référencées par `manifest.json`, `index.html` et les notifications de `js/app.js`, n'étaient jamais précachées.
- **Cause** : absentes de la liste `APP_SHELL`.
- **Risque** : icône cassée pour l'utilisateur concerné — purement cosmétique, sans impact fonctionnel.
- **Comportement attendu** : icônes disponibles hors-ligne dès l'installation du Service Worker.
- **Correction recommandée** : déjà corrigée (patch 0052) — icônes ajoutées à `APP_SHELL`.
- **Effort** : S
- **Dépendances éventuelles** : aucune

## OFFLINE-007

- **Gravité** : FAIBLE
- **Fichier(s)** : `sw.js`, `js/services/storage-local.js`
- **Scénario concerné** : précache du Service Worker à l'installation.
- **Problème** : `js/services/storage-local.js` (implémentation IndexedDB de référence, non chargée par l'app en production) restait précaché inutilement.
- **Cause** : présence historique dans `APP_SHELL`, non nettoyée après le passage de l'app à Firestore comme unique backend actif.
- **Risque** : poids de précache inutile ; avant le correctif OFFLINE-005, ce fichier faisait partie des points de défaillance possibles pouvant faire échouer l'installation entière (`cache.addAll` atomique).
- **Comportement attendu** : seuls les fichiers réellement chargés par l'application doivent figurer dans `APP_SHELL`.
- **Correction recommandée** : déjà corrigée (patch 0052) — retiré de `APP_SHELL` ; le fichier reste dans le dépôt à titre de référence (voir `README.md`), simplement plus précaché.
- **Effort** : S
- **Dépendances éventuelles** : aggravant potentiel d'OFFLINE-005 avant correctif conjoint.

## OFFLINE-008

- **Gravité** : FAIBLE
- **Fichier(s)** : `js/views/login.js`
- **Scénario concerné** : toute première connexion sur un appareil (aucune session Firebase mise en cache localement) tentée hors-ligne.
- **Problème** : le message affiché était le texte brut anglais renvoyé par Firebase (`Firebase: Error (auth/network-request-failed).`).
- **Cause** : `friendlyError()` ne traitait pas le code d'erreur `network-request-failed`.
- **Risque** : confusion — rien n'indique à l'utilisateur que le problème vient simplement de l'absence de réseau lors d'une première authentification (situation par ailleurs non contournable : la première connexion nécessite le réseau, quoi qu'il arrive).
- **Comportement attendu** : message clair en français expliquant que la première connexion sur un appareil nécessite d'être en ligne.
- **Correction recommandée** : déjà corrigée (patch 0053).
- **Effort** : S
- **Dépendances éventuelles** : aucune

## OFFLINE-009

- **Gravité** : HAUTE
- **Fichier(s)** : `js/services/storage.js` (`subscribe`)
- **Scénario concerné** : le flux temps réel Firestore (`onSnapshot`) tombe en erreur, par exemple à la suite d'une coupure réseau prolongée ou d'un problème de permissions.
- **Problème** : aucune remontée visible à l'utilisateur ni trace technique exploitable lors d'une telle erreur.
- **Cause** : absence de callback d'erreur géré sur l'abonnement `onSnapshot`.
- **Risque** : l'utilisateur continue de travailler sur les dernières données connues sans savoir que le flux ne se met plus à jour — désynchronisation silencieuse.
- **Comportement attendu** : signal visible (toast) et trace technique (`console.error`) dès qu'un flux temps réel tombe en erreur.
- **Correction recommandée** : déjà corrigée (patch 0032, audit "anomalies silencieuses").
- **Effort** : M
- **Dépendances éventuelles** : aucune. Comportement de reprise automatique du SDK Firestore après rétablissement du réseau (ré-abonnement transparent ou non) : Non déterminé — non vérifié dans cet environnement, pas d'accès réseau au projet Firestore réel.

## OFFLINE-010

- **Gravité** : HAUTE
- **Fichier(s)** : `js/app.js` (`onAuthChange`), `js/views/login.js` (`renderAuthError`)
- **Scénario concerné** : coupure réseau ou erreur Firestore survenant précisément pendant la vérification de la liste blanche (`isEmailAllowed`) au démarrage de l'app, après authentification Firebase réussie.
- **Problème** : écran intégralement blanc, sans le moindre message.
- **Cause** : absence de `try/catch` autour de l'appel à `isEmailAllowed()` dans `onAuthChange()`.
- **Risque** : utilisateur authentifié mais bloqué sans aucune indication ; ne sait pas s'il doit patienter, recharger, ou si un vrai problème d'accès existe.
- **Comportement attendu** : écran dédié expliquant l'échec technique, distinct de l'écran "accès non autorisé", avec une action pour réessayer.
- **Correction recommandée** : déjà corrigée (patch 0032) — `renderAuthError()`, écran avec bouton "🔄 Réessayer" (`location.reload()`).
- **Effort** : M
- **Dépendances éventuelles** : aucune

## OFFLINE-011

- **Gravité** : HAUTE
- **Fichier(s)** : `js/services/shortcuts.js`
- **Scénario concerné** : un raccourci clavier déclenchant une action réseau (ex. combinaison "Maintiens Ctrl+Alt...") échoue à cause d'une coupure réseau.
- **Problème** : le bouton/indicateur associé au raccourci restait figé indéfiniment après l'échec, sans retour à un état normal.
- **Cause** : absence de gestion du cas d'échec de la promesse réseau associée au raccourci.
- **Risque** : la fonctionnalité de raccourci paraît cassée jusqu'au rechargement complet de la page, alors que le problème n'est qu'une coupure réseau passagère.
- **Comportement attendu** : retour à un état de bouton normal après un échec, y compris un échec d'origine réseau.
- **Correction recommandée** : déjà corrigée (patch 0032).
- **Effort** : S
- **Dépendances éventuelles** : aucune

---

## Matrice des scénarios offline → online

| Scénario | Comportement hors-ligne (après correctifs) | Comportement au retour en ligne | Couvert par | Point résiduel connu |
|---|---|---|---|---|
| Navigation / lecture de données déjà en cache | Données visibles normalement via le cache local persistant Firestore (`persistentLocalCache`) | Synchronisation automatique transparente (comportement natif du SDK) | Architecture existante (pas un correctif de cette conversation) | Non déterminé — pas de vérification directe contre un projet Firestore réel |
| Création/modification/suppression d'une fiche (écriture) | Donnée visible immédiatement en local ; bouton d'action affiche un message après 2,5 s d'attente | L'écriture se synchronise, le bouton se débloque normalement | OFFLINE-001, OFFLINE-002 | Conséquence exacte d'un rechargement forcé pendant l'attente : Non déterminé |
| Confirmation de suppression (`confirmDelete`) | La modale reste ouverte jusqu'à confirmation réelle (ou affiche l'attente, cf. ligne précédente) | La modale se ferme une fois la suppression confirmée | OFFLINE-003, OFFLINE-004 | Aucun connu |
| Perte de connexion pendant une session déjà active | Bandeau visible en haut de l'écran | Bandeau disparaît automatiquement | OFFLINE-001 | Aucun connu |
| Première connexion (aucune session Firebase en cache) tentée hors-ligne | Message clair expliquant que le réseau est nécessaire | L'utilisateur doit retenter manuellement la connexion une fois en ligne | OFFLINE-008 | Existence ou non d'une nouvelle tentative automatique après retour en ligne : Non déterminé |
| Installation/mise à jour du Service Worker avec un fichier `APP_SHELL` temporairement indisponible | Échec isolé toléré, précache des autres fichiers non affecté, échec journalisé (`console.error`) | Le fichier manquant peut être précaché au cycle d'installation suivant | OFFLINE-005, OFFLINE-006, OFFLINE-007 | Aucun mécanisme de nouvelle tentative automatique ciblée sur le seul fichier en échec : Non déterminé |
| Flux temps réel Firestore (`onSnapshot`) en erreur | Toast + trace technique ; l'utilisateur continue avec les dernières données connues | Reprise du flux au rétablissement du réseau | OFFLINE-009 | Comportement de ré-abonnement automatique du SDK non vérifié : Non déterminé |
| Vérification de la liste blanche (`allowedUsers`) échoue au démarrage | Écran dédié "Connexion interrompue" avec bouton "🔄 Réessayer" | Clic sur "Réessayer" recharge la page et relance la vérification | OFFLINE-010 | Aucun connu |
| Raccourci clavier déclenchant une action réseau qui échoue | Retour à un état de bouton normal après l'échec | Le raccourci refonctionne normalement dès que le réseau est rétabli | OFFLINE-011 | Aucun connu |
