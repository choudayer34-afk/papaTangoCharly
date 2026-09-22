// "Nouveautés" — retour de Charles-Henri (01/09/2026) : "où est-ce que je retrouve tout les
// trucs qu'on a ajouté ?" — un problème de repérage/mémoire externe (voir doc de suivi,
// discussion TDAH permanence/repérage), distinct du Guide : le Guide explique COMMENT utiliser
// une fonction, ici on retrace QUAND et POURQUOI chaque fonction est arrivée, du plus récent
// au plus ancien, pour ne jamais avoir à s'en souvenir soi-même.
//
// Accessible depuis l'onglet ☰ Plus (js/views/more.js) depuis la vague 24 — avant ça, depuis le
// bouton ❓ Aide. Contenu rédigé à la main à chaque livraison — comme le Guide, rien ne le
// régénère automatiquement.
//
// Regroupé par vague de livraison plutôt que par jour brut (plusieurs vagues le même jour) —
// seule la vague la plus récente est dépliée par défaut, pour ne pas rallonger l'écran (même
// logique que l'historique des fiches et les casquettes du Guide).

import * as preferencesApi from "../domain/preferences.js";

// Structure enrichie (audit TDAH ciblé du 07/09/2026, retour de Charles-Henri : "ça manque de
// notes de mises à jour qui informe les utilisateurs [...] ce que ça permet de faire, comment
// l'utiliser, le gain que ça permet d'avoir") : chaque entrée peut porter, en plus de
// `title`/`text` (déjà existants) — `type` ("add" | "change" | "fix", affiche un badge visuel,
// ✨ Ajouté par défaut si absent), `howTo` (un pas-à-pas très court, "comment l'utiliser") et
// `gain` (pourquoi c'est utile). Les trois sont optionnels et absents des entrées antérieures au
// 07/09/2026 (rédigées avant cette structure) — `renderWhatsNew()` les affiche seulement quand
// ils sont présents, jamais de section vide. Les entrées des vagues 20 à 29 ci-dessous ont été
// rédigées après coup pour rattraper le retard pris depuis le 1er septembre (voir
// claude/vague-29-focus-nouveautes-badge.md) ; celles du 31 août/1er septembre restent dans leur
// forme d'origine plutôt que d'être réécrites rétroactivement.
export const WHATS_NEW_TYPE_LABELS = { add: "✨ Ajouté", change: "🔧 Modifié", fix: "🐛 Corrigé", remove: "🗑️ Retiré" };

const WHATS_NEW = [
  {
    date: "22 septembre 2026",
    items: [
      {
        type: "fix",
        title: "🛠️ Écran Équipe : erreur corrigée qui empêchait l'écran de s'afficher",
        text: "Une erreur technique introduite par la précédente mise à jour (réutilisation du même style visuel pour les sous-onglets de l'écran Équipe) pouvait empêcher cet écran de s'afficher correctement. Corrigée.",
        howTo: "Rien à faire, c'est automatique. Si l'écran restait bloqué malgré cette mise à jour, un rechargement complet de l'app suffit.",
        gain: "L'écran Équipe s'affiche de nouveau normalement, dans tous les cas.",
      },
      {
        type: "fix",
        title: "🌙 Trois affichages illisibles corrigés en mode sombre",
        text: "En mode sombre : le texte des choix proposés pour traiter un élément de l'Inbox (\"Action\", \"Suivi\", \"Information\"...) s'affichait en noir sur fond sombre ; les petites notifications temporaires en bas d'écran (ex. \"Enregistré dans l'Inbox\") s'affichaient en blanc sur fond blanc ; le calendrier natif des champs de date (échéance, date de contrôle...) s'affichait en noir sur fond noir. Les trois s'affichent désormais normalement.",
        howTo: "Rien à faire, c'est automatique.",
        gain: "Traiter l'Inbox, lire les confirmations et choisir une date restent parfaitement lisibles en mode sombre.",
      },
    ],
  },
  {
    date: "21 septembre 2026",
    items: [
      {
        type: "fix",
        title: "📱 Boutons plus faciles à toucher sur mobile",
        text: "Certains petits boutons ronds (déplacer une tâche dans le Kanban, ouvrir une ligne du tableau Pilotage, ajouter une note à une ressource, réduire le minuteur Pomodoro) avaient une zone cliquable/tactile plus petite que leur icône ne le laissait penser. La zone qui réagit au clic/tactile est désormais agrandie tout autour, sans changer la taille visible du bouton.",
        howTo: "Rien à faire, c'est automatique.",
        gain: "Toucher ces boutons du premier coup sur téléphone, sans viser aussi précisément qu'avant.",
      },
      {
        type: "fix",
        title: "📱 L'app respecte désormais l'encoche et la barre de gestes du téléphone",
        text: "Sur un téléphone avec encoche ou barre de gestes en bas (ex. iPhone), la barre du haut et la barre de navigation du bas pouvaient empiéter sur ces zones réservées par le système. L'app laisse désormais l'espace nécessaire, sans réduire la hauteur utile des icônes et boutons.",
        howTo: "Rien à faire, c'est automatique.",
        gain: "Rien n'est plus caché ni difficile à atteindre derrière l'encoche ou la barre de gestes du téléphone.",
      },
      {
        type: "fix",
        title: "🔤 Textes du badge de navigation et du Calendrier légèrement agrandis",
        text: "Le numéro sur le badge de la barre du bas et les pastilles d'évènements du Calendrier (vue Mois) s'affichaient dans une taille de police en dessous du minimum recommandé pour rester confortablement lisible. Ils reprennent désormais la même taille que le reste des petits textes de l'app.",
        howTo: "Rien à faire, c'est automatique.",
        gain: "Lire ces textes sans effort, notamment sur petit écran.",
      },
      {
        type: "fix",
        title: "🎨 Contraste corrigé sur les jours hors mois du Calendrier",
        text: "Les jours du mois précédent/suivant, affichés en grisé dans la vue Mois du Calendrier, étaient si peu contrastés qu'ils devenaient presque illisibles. Le contraste respecte désormais les recommandations d'accessibilité.",
        howTo: "Rien à faire, c'est automatique.",
        gain: "Distinguer clairement le numéro d'un jour hors mois, même sur un écran peu lumineux.",
      },
      {
        type: "add",
        title: "🎯 Aperçu en direct en réglant les poids de Priorisation",
        text: "Dans la fenêtre \"⚖️ Régler les poids\", déplacer un curseur (Urgence/Impact/Blocage) met désormais à jour la liste classée en temps réel, avant même de cliquer sur \"Enregistrer\" — jusqu'ici, il fallait valider pour voir l'effet. Fermer la fenêtre sans enregistrer (Annuler, clic en dehors, Échap) restaure le classement précédent.",
        howTo: "Onglet Pilotage → Priorisation → \"⚖️ Régler les poids\" → bouge un curseur.",
        gain: "Voir immédiatement l'effet d'un réglage avant de le confirmer, sans aller-retour.",
      },
      {
        type: "add",
        title: "➕ \"Afficher plus\" sur les longues listes de Priorisation et Ressources",
        text: "La liste classée de Priorisation et la liste de Ressources s'affichaient jusqu'ici en entier, quelle que soit leur longueur. Elles s'arrêtent désormais à 20 éléments avec un bouton \"+ Afficher N de plus\" pour dérouler le reste.",
        howTo: "Rien à faire pour les 20 premiers éléments ; bouton en bas de liste pour voir la suite.",
        gain: "Un écran moins long à faire défiler quand la liste est courte à consulter, sans jamais perdre l'accès aux éléments suivants.",
      },
      {
        type: "add",
        title: "🔔 Redemander l'activation des alertes de retard",
        text: "L'app ne reproposait plus jamais la bannière \"Activer les alertes de retard\" une fois qu'on y avait répondu (oui ou non) — aucun moyen de revenir sur ce choix en cas de clic \"Non\" par erreur ou de changement d'avis depuis. Un nouveau bouton dans les réglages de l'Accueil permet de redemander ce choix. Pour rappel, cette alerte ne fonctionne que pendant que l'app est déjà ouverte dans le navigateur — elle n'envoie rien si l'app est fermée, faute d'infrastructure de notification côté serveur.",
        howTo: "Accueil → ⚙️ (réglages) → \"🔔 Alerte de retard au démarrage\" → \"↺ Redemander mon choix\".",
        gain: "Revenir sur un choix passé sans avoir à réinitialiser tout son navigateur.",
      },
      {
        type: "change",
        title: "🧭 Navigation plus lisible : Équipe, Priorisation, Plus, Guide/Nouveautés",
        text: "Dans l'onglet Équipe, les 4 modes (Tous / Mon manager / Charge / Suivis) ressemblaient à de simples filtres alors qu'ils changent complètement l'écran affiché — ils se présentent désormais comme de vrais sous-onglets, dans le même style que Pilotage. L'onglet Priorisation précise maintenant, dans son sous-titre, ce qu'il apporte en plus du \"Focus du jour\" de l'Accueil. L'écran \"☰ Plus\" regroupe désormais ses 5 destinations par intention (Aide, Bibliothèques, Pause) plutôt qu'en liste plate. Guide et Nouveautés, aux rôles proches, précisent chacun le leur en sous-titre (\"Comment ça marche\" / \"Ce qui a changé\").",
        howTo: "Rien à faire, c'est automatique — à voir directement sur ces écrans.",
        gain: "Comprendre en un coup d'œil ce que fait chaque écran, sans avoir à l'ouvrir pour le découvrir.",
      },
      {
        type: "change",
        title: "🧠 \"Information\" et \"Idée\" fusionnés en un seul libellé",
        text: "Une capture qualifiée en \"🧠 Information\" ou en \"💡 Idée\" depuis l'Inbox donnait déjà, dans les faits, exactement le même résultat — la distinction n'apportait plus de nuance réelle. Elle est désormais présentée partout sous un seul libellé, \"🧠 Information\" : dans l'Inbox, la Revue hebdomadaire, la recherche, les fiches liées et le changement de type. Rien n'est perdu ni renommé dans les données déjà existantes.",
        howTo: "Rien à faire, c'est automatique.",
        gain: "Un seul mot à retenir pour ce type de capture, plus de question \"information ou idée ?\" sans réponse claire.",
      },
    ],
  },
  {
    date: "21 septembre 2026",
    items: [
      {
        type: "fix",
        title: "⌨️ Le clavier ne fait plus sortir d'une fiche ouverte",
        text: "Dans une fiche ou un formulaire ouvert (Tâche, Projet, Suivi...), la touche Tab pouvait faire sortir le focus clavier vers l'écran en dessous, invisible sous la fiche mais toujours atteignable au clavier — il fallait alors deviner où on se trouvait. Tab/Maj+Tab restent désormais dans la fiche ouverte, et le focus revient automatiquement à l'endroit d'où on l'a ouverte une fois qu'on la referme.",
        howTo: "Rien à faire, c'est automatique.",
        gain: "Naviguer une fiche entièrement au clavier sans jamais perdre le fil de où se trouve le focus.",
      },
      {
        type: "change",
        title: "⌨️ Échap protège désormais une saisie en cours, comme le clic en dehors",
        text: "Cliquer par erreur en dehors d'une fiche en cours de remplissage ne la ferme déjà plus (pour ne pas perdre la saisie) — la touche Échap suit maintenant exactement la même règle : elle ne ferme plus une fiche contenant un champ modifiable non enregistré. Pour les fiches sans aucun champ (confirmations, listes de choix), Échap continue de fermer normalement.",
        howTo: "Rien à faire, c'est automatique — sur une fiche avec un champ à remplir, utilise le bouton \"Fermer\"/\"Annuler\" pour la refermer.",
        gain: "Ne plus perdre une saisie en cours par un Échap réflexe, exactement comme c'était déjà le cas pour un clic accidentel en dehors.",
      },
      {
        type: "fix",
        title: "⌨️ Indicateur de focus visible sur les champs de formulaire au clavier",
        text: "En naviguant au clavier (Tab), un champ de formulaire ne montrait plus aucun contour de focus net — seul un léger changement de couleur de bordure, peu visible. Un contour net apparaît désormais spécifiquement lors d'une navigation au clavier (comme déjà sur le bouton de thème clair/sombre), sans rien changer à l'apparence au clic à la souris.",
        howTo: "Rien à faire, c'est automatique.",
        gain: "Repérer immédiatement quel champ a le focus quand on navigue au clavier.",
      },
      {
        type: "add",
        title: "⌨️ Focus automatique sur le premier champ à l'ouverture d'une fiche",
        text: "Ouvrir une fiche ou un formulaire (Tâche, Projet, Suivi...) place désormais automatiquement le focus sur son premier champ ou bouton, prêt à taper ou naviguer immédiatement au clavier — jusqu'ici, seuls certains écrans (Capturer, recherche, Prompts...) le faisaient déjà ; c'est maintenant le cas partout, y compris sur les formulaires de création Tâche et Projet qui ne l'avaient pas.",
        howTo: "Rien à faire, c'est automatique.",
        gain: "Commencer à saisir sans avoir à cliquer ou tabuler jusqu'au premier champ.",
      },
    ],
  },
  {
    date: "21 septembre 2026",
    items: [
      {
        type: "add",
        title: "🔧 Filtres Type / Projet sur le Calendrier",
        text: "Le Calendrier propose désormais un menu \"🔧 Filtrer\" (comme sur Pilotage/Projets) pour ne garder que certains types d'éléments (✅ Tâches, 🗓️ Réunions, 🗳️ Décisions, 👀 Suivis) ou un projet précis. Tout reste affiché par défaut, exactement comme avant, tant que le filtre n'est pas touché.",
        howTo: "Onglet Calendrier → bouton \"🔧 Filtrer\" (à côté de Mois/Semaine).",
        gain: "Isoler d'un coup d'œil, par exemple, les échéances d'un seul projet, sans avoir à les repérer visuellement au milieu de tout le reste.",
      },
      {
        type: "add",
        title: "➕ Créer une Tâche ou une Réunion directement depuis un jour du Calendrier",
        text: "L'agenda d'un jour (ouvert en cliquant dessus) propose désormais deux boutons \"+ Tâche\"/\"+ Réunion\", qui ouvrent le formulaire de création habituel avec ce jour déjà rempli comme échéance/date — jusqu'ici, il fallait créer l'élément ailleurs puis lui donner cette date manuellement.",
        howTo: "Onglet Calendrier → clic sur un jour → \"+ Tâche\" ou \"+ Réunion\".",
        gain: "Poser une tâche ou une réunion pour un jour précis sans changer d'écran ni ressaisir la date à la main.",
      },
      {
        type: "fix",
        title: "📅 Semaine : les titres longs sont désormais tronqués comme en vue Mois",
        text: "En vue Semaine, un titre de tâche/réunion/décision/suivi trop long passait à la ligne, alors que la vue Mois le tronque déjà avec \"...\" — les deux vues se comportent désormais de la même façon sur ce point.",
        howTo: "Rien à faire, c'est automatique.",
        gain: "Un même contenu s'affiche de façon cohérente, qu'on soit en vue Mois ou Semaine.",
      },
    ],
  },
  {
    date: "21 septembre 2026",
    items: [
      {
        type: "add",
        title: "☑️ Traiter plusieurs éléments Inbox en une fois (Information / Idée / Archiver)",
        text: "L'Inbox et la Revue hebdomadaire proposent maintenant un mode « Traiter en lot », à activer explicitement — le traitement reste un par un par défaut, exactement comme avant. Une fois activé, une case à cocher apparaît sur chaque élément en attente : sélectionne-en plusieurs puis choisis Information, Idée ou Archiver pour les qualifier d'un coup. Volontairement limité à ces 3 issues, qui ne demandent aucun formulaire — Action, Suivi, Projet, Réunion, Décision et Ressource continuent de se traiter un par un, avec leur formulaire habituel.",
        howTo: "Onglet Inbox (ou Revue hebdomadaire → section \"📥 Inbox\") → bouton \"☑️ Traiter en lot\" → coche les éléments concernés → choisis Information / Idée / Archiver dans la barre qui apparaît.",
        gain: "Vider d'un coup les captures qui n'ont clairement besoin d'aucun traitement particulier, sans perdre le réflexe \"un par un\" pour tout ce qui mérite réellement un formulaire (Action, Suivi...).",
      },
      {
        type: "add",
        title: "🔗 Lien automatique entre une Tâche/Suivi/Réunion/Décision qualifiée et son projet",
        text: "Quand une capture Inbox est qualifiée en Tâche, Suivi, Réunion ou Décision ET qu'un projet est déjà choisi à ce moment-là, un lien est désormais posé automatiquement entre l'élément créé et ce projet — visible dans la section \"🔗 Lié\" des deux fiches, sans rien à faire de plus. Sans projet choisi à la qualification, rien ne change : le lien peut toujours être ajouté à la main ensuite.",
        howTo: "Qualifie une capture en Tâche/Suivi/Réunion/Décision en choisissant un projet dans le formulaire — le lien apparaît directement dans la fiche créée et dans celle du projet.",
        gain: "Retrouver depuis le projet tout ce qui en est directement issu, sans avoir à poser le lien soi-même après coup.",
      },
      {
        type: "add",
        title: "🔗 Retrouver la capture Inbox d'origine depuis la fiche qu'elle a produite",
        text: "Qualifier une capture en Tâche, Suivi, Projet, Réunion, Décision ou Ressource pose désormais aussi un lien vers la capture Inbox d'origine, visible dans la section \"🔗 Lié\" de la fiche créée — clique dessus pour retrouver le texte brut exact et sa date de capture, tel quel, sans qu'aucune action de gestion (archiver, changer de type...) ne soit proposée sur cette fiche de rappel.",
        howTo: "Ouvre n'importe quelle Tâche/Suivi/Projet/Réunion/Décision/Ressource issue d'une qualification Inbox → section \"🔗 Lié\" → l'entrée \"📥 ...\" ouvre la capture d'origine.",
        gain: "Retrouver le contexte exact d'origine d'un élément (le mot pour mot de la capture), même longtemps après sa qualification, sans avoir à s'en souvenir soi-même.",
      },
    ],
  },
  {
    date: "21 septembre 2026",
    items: [
      {
        type: "add",
        title: "🩺 Score de santé visible sur la fiche projet, l'Accueil et l'onglet Projets",
        text: "Le score de santé d'un projet (calculé depuis les tâches en retard/bloquées/en pause et les suivis en retard) n'était visible que dans l'onglet Projets, vue \"🩺 Santé\" — il apparaît désormais aussi en en-tête de la fiche projet, sur chaque carte de la section \"📦 Mes projets\" de l'Accueil, et sur les cartes de l'onglet Projets lui-même (vues \"📋 Liste\" et \"🗂️ Par catégorie\"), là où la décision se prend.",
        howTo: "Ouvre n'importe quel projet actif, regarde l'Accueil → \"📦 Mes projets\", ou l'onglet Projets (Liste ou Par catégorie) : le badge \"🩺\" est visible sans action supplémentaire.",
        gain: "Repérer une dérive sur un projet sans avoir à ouvrir une vue séparée à chaque fois, quel que soit l'écran où on le croise.",
      },
      {
        type: "add",
        title: "📅 Nouvelle carte \"Échéances du jour\" sur l'Accueil",
        text: "Une nouvelle carte dans les indicateurs de l'Accueil compte les éléments dont l'échéance tombe aujourd'hui, en deux groupes : les Tâches à faire, puis les Suivis pour lesquels tu dois transmettre quelque chose à quelqu'un aujourd'hui — sans les échéances de contrôle où tu attends une réponse d'un collaborateur, qui restent seulement dans \"📣 Relances dues\".",
        howTo: "Accueil → carte \"📅 Échéances du jour\" (à côté de \"🔴 En retard\") → clic pour voir le détail des deux groupes.",
        gain: "Voir en un coup d'œil ce qui tombe aujourd'hui, sans mélanger ce que tu dois faire toi-même et ce que tu attends des autres.",
      },
    ],
  },
  {
    date: "21 septembre 2026",
    items: [
      {
        type: "add",
        title: "📅 Reporter une échéance de tâche en 1 clic depuis le Kanban",
        text: "Chaque carte Tâche du Kanban a désormais un bouton \"📅\" à côté des boutons de statut ‹ › : il ouvre un petit menu \"+1 j / +7 j / Date libre\" pour reporter l'échéance sans ouvrir la fiche complète — jusqu'ici, changer une échéance demandait de rouvrir la fiche, même pour un simple report d'un jour.",
        howTo: "Onglet Pilotage → Trello → bouton \"📅\" sur la carte.",
        gain: "Reporter une échéance devient aussi rapide que changer de statut, sans quitter le tableau.",
      },
      {
        type: "add",
        title: "🔁 Relancer / ✅ Régler un Suivi en 1 clic, sans ouvrir sa fiche",
        text: "Chaque ligne de Suivi (fiche Personne, onglet Suivis, et liste transverse \"👀 Suivis\") a désormais deux boutons rapides \"🔁\"/\"✅\" pour marquer un suivi comme relancé ou réglé directement depuis la liste — jusqu'ici, il fallait systématiquement rouvrir la fiche complète du suivi pour changer son statut.",
        howTo: "Fiche Personne → onglet Suivis (ou \"👀 Suivis\") → boutons \"🔁\"/\"✅\" sur la ligne concernée.",
        gain: "Pointer une relance faite ou un sujet réglé sans le détour par la fiche complète.",
      },
      {
        type: "change",
        title: "🔔 L'alerte de retard couvre désormais aussi les Suivis",
        text: "L'alerte de retard/pause au démarrage de l'app (quand elle est activée) ne portait jusqu'ici que sur les Tâches — un Suivi dont la date de contrôle est dépassée ne déclenchait jamais rien. Elle inclut désormais le nombre de suivis en retard de contrôle, au même titre que les tâches en retard ou en pause.",
        howTo: "Rien à faire, c'est automatique si l'alerte de démarrage est déjà activée.",
        gain: "Un Suivi oublié ne passe plus sous le radar de la même alerte qui couvre déjà les Tâches.",
      },
    ],
  },
  {
    date: "21 septembre 2026",
    items: [
      {
        type: "add",
        title: "➕ Nouvelle tâche directement depuis Pilotage",
        text: "Un bouton \"+ Tâche\" apparaît désormais en haut de Pilotage (Trello comme Tableau), à côté de \"🗂️ Trello\"/\"📊 Tableau\" — jusqu'ici, créer une tâche libre sans passer par l'Inbox ou par un projet existant n'avait aucun point d'entrée direct.",
        howTo: "Onglet Pilotage → Tâches → bouton \"+ Tâche\".",
        gain: "Poser une tâche qui vient d'y penser sans détour, exactement comme \"+ Projet\" le permet déjà côté Projets.",
      },
      {
        type: "fix",
        title: "🐛 Cliquer Créer/Enregistrer sans champ obligatoire ne dit plus rien",
        text: "Sur les formulaires de création (Tâche, Projet, Ressource) et sur la fiche Tâche/Projet/Ressource en modification, cliquer Créer/Enregistrer avec le champ obligatoire vide (Titre, Nom) ne faisait rien de visible — pas de message, pas de fermeture, juste un clic apparemment sans effet. Un message (\"Le titre obligatoire\"/\"Le nom obligatoire\") apparaît désormais, avec le champ en cause entouré en rouge le temps de le compléter.",
        howTo: "Rien à faire, c'est automatique.",
        gain: "Un clic sur Créer/Enregistrer donne toujours un résultat visible, jamais un silence qui laisse deviner si ça a marché.",
      },
      {
        type: "add",
        title: "🔗 Ressource : le lien mal collé est signalé avant l'enregistrement",
        text: "Le champ Lien d'une Ressource (création ou fiche détail) vérifie désormais qu'il s'agit bien d'une URL correcte avant d'enregistrer — un lien mal tapé ou mal collé était accepté tel quel jusqu'ici, l'erreur n'apparaissant qu'au moment de cliquer \"Ouvrir le lien\" bien plus tard.",
        howTo: "Rien à faire, c'est automatique — un message apparaît si le lien saisi n'est pas valide.",
        gain: "Repérer un lien mal collé tout de suite, pas plusieurs jours après en essayant de l'ouvrir.",
      },
      {
        type: "add",
        title: "🗂️ Confirmation avant de créer une nouvelle catégorie de projet",
        text: "Taper une catégorie qui n'existe pas encore dans le champ Catégorie d'un projet (création ou fiche détail) demande désormais confirmation avant de la créer — une simple faute de frappe (\"Cse\" au lieu de \"CSE\") ne crée plus silencieusement une catégorie en double. Une catégorie déjà connue, même dans une casse différente, est reconnue et réutilisée telle quelle, sans confirmation superflue.",
        howTo: "Rien à faire, c'est automatique.",
        gain: "Fini les catégories quasi-identiques qui s'accumulent par erreur de frappe.",
      },
      {
        type: "change",
        title: "📣 \"C'est une communication\" se choisit désormais après création",
        text: "La case \"📣 C'est une communication\" du formulaire de création de tâche exposait un réglage avancé (son canevas de production) sans expliquer sa conséquence, au moment même où on ne pense encore qu'au titre. Elle est retirée de la création — le choix se fait désormais après coup, depuis la fiche détail de la tâche, comme les autres réglages avancés (ex. \"🔴 Bloqué\").",
        howTo: "Fiche Tâche → onglet Détails → bouton \"📣 Activer le canevas de communication\" (n'apparaît que si ce n'est pas déjà fait).",
        gain: "Un formulaire de création plus simple, et un réglage avancé qui n'agit plus qu'une fois qu'on en a vraiment besoin.",
      },
      {
        type: "add",
        title: "🗑️ Supprimer un Projet ou une Personne dit ce qui est concerné",
        text: "La confirmation avant de supprimer définitivement un Projet ou une Personne indique désormais précisément ce qui lui est rattaché (nombre de tâches, suivis, réunions, décisions, ressources ou objectifs) — rien de tout cela n'est supprimé avec (politique déjà en place, ces éléments perdent simplement leur lien), mais jusqu'ici la confirmation ne le disait qu'en termes vagues, sans dire combien ni quoi précisément.",
        howTo: "Rien à faire, c'est automatique — le message de confirmation liste maintenant ce qui est réellement concerné.",
        gain: "Savoir précisément l'ampleur d'une suppression avant de la confirmer, pas seulement qu'\"il y a des liens\".",
      },
    ],
  },
  {
    date: "15 septembre 2026",
    items: [
      {
        type: "fix",
        title: "🐛 \"Changer de type\" refermait la fiche au lieu de rouvrir la fiche convertie",
        text: "Après \"🔁 Changer de type\" (Tâche ↔ Suivi ↔ Information/Idée), la modale se refermait simplement une fois la conversion faite — il fallait ensuite retrouver soi-même la fiche convertie dans la bonne vue. Elle s'ouvre désormais directement, comme n'importe quelle navigation vers une fiche liée.",
        howTo: "Fiche → \"🔁 Changer de type\" → choisis le nouveau type.",
        gain: "Plus besoin de rechercher la fiche qu'on vient tout juste de convertir.",
      },
      {
        type: "fix",
        title: "🐛 Cliquer \"Supprimer\" pouvait fermer la mauvaise fenêtre",
        text: "Sur certaines suppressions (ex. suppression d'un tag depuis l'administration), confirmer \"Supprimer\" refermait la fenêtre au moment même du clic, avant que la suppression ne soit vraiment terminée — et si cette suppression rouvrait elle-même une autre fenêtre juste après, c'est CETTE fenêtre-là qui pouvait se refermer par erreur au lieu de celle sur laquelle le clic avait eu lieu. Le clic \"Supprimer\" attend désormais que la suppression soit effectivement terminée avant de fermer sa propre fenêtre, et seulement la sienne.",
        howTo: "Rien à faire, c'est automatique.",
        gain: "Une confirmation de suppression ne referme plus jamais une fenêtre qu'elle n'a pas ouverte.",
      },
      {
        type: "add",
        title: "📡 Bandeau visible quand la connexion est coupée",
        text: "Un bandeau apparaît désormais en haut de l'écran dès que l'appareil perd sa connexion internet (\"les modifications seront synchronisées au retour de la connexion\"), et disparaît automatiquement dès qu'elle revient. Les boutons \"Enregistrer\"/\"Convertir\"/\"Supprimer\" qui restent en attente plus de 2,5 secondes affichent en plus un message dédié, plutôt que de sembler bloqués sans aucune explication.",
        howTo: "Rien à faire, c'est automatique.",
        gain: "Fini de se demander si l'app est plantée ou si elle attend juste le retour du réseau.",
      },
      {
        type: "fix",
        title: "🐛 Message de connexion hors-ligne incompréhensible",
        text: "Tenter une toute première connexion sur un appareil (jamais utilisé avec ce compte) sans connexion internet affichait le message brut anglais de Firebase (\"Firebase: Error (auth/network-request-failed).\"). Remplacé par une explication claire : la toute première connexion sur un appareil a besoin d'internet, impossible autrement.",
        howTo: "Rien à faire, c'est automatique.",
        gain: "Un message qui dit enfin quoi faire au lieu d'un code d'erreur technique.",
      },
      {
        type: "change",
        title: "🚀 Plusieurs écrans plus réactifs, notamment hors-ligne / connexion lente",
        text: "Lot de corrections de performance ciblant les écrans les plus consultés : la recherche (Kanban, Ressources, Personnes, Prompts, Guide, \"🔗 Lier une fiche\", recherche globale) ne relance plus un filtrage complet à chaque frappe ; l'historique affiché sur une fiche (Tâche, Ressource, Personne, Projet) ne recharge plus tout l'historique de l'application ; l'onglet Inbox n'ouvre plus qu'un seul flux de données au lieu de trois en double. Egalement : les icônes de l'app sont maintenant disponibles hors-ligne dès la première visite, et l'installation de l'app ne peut plus échouer intégralement à cause d'un seul fichier indisponible au mauvais moment.",
        howTo: "Rien à faire, c'est automatique.",
        gain: "Moins d'attente, surtout sur une connexion lente ou instable — sans rien changer à l'utilisation de l'app.",
      },
    ],
  },
  {
    date: "15 septembre 2026",
    items: [
      {
        type: "fix",
        title: "🐛 Impossible de supprimer la date de contrôle d'un Suivi qui a une échéance",
        text: "Dans la fiche d'un Suivi, vider le champ \"Prochain contrôle\" (ou cliquer sur sa croix native) puis Enregistrer semblait ne rien faire tant qu'une échéance restait renseignée : la date de contrôle revenait silencieusement se caler sur l'échéance. C'est corrigé — vider la date de contrôle la vide désormais réellement, du moment que l'échéance elle-même n'a pas changé. Si tu changes l'échéance et laisses le contrôle vide, il continue de se caler dessus par défaut comme avant ; la date de contrôle ne peut toujours pas être postérieure à l'échéance.",
        howTo: "Fiche du Suivi → vide \"Prochain contrôle\" → Enregistrer.",
        gain: "Un Suivi peut à nouveau garder une échéance sans être forcé d'avoir une date de contrôle qui lui colle dessus.",
      },
      {
        type: "fix",
        title: "🐛 Un Suivi (ou une fiche) pouvait se créer en double sur un double-clic",
        text: "Le bouton \"Créer\"/\"Enregistrer\" d'une fiche (Suivi, Tâche, Projet...) ne se désactivait pas pendant l'enregistrement — un double-clic ou un appui un peu long créait deux fiches strictement identiques, sans le moindre signe à l'écran. C'est ce qui pouvait faire apparaître deux fois la même ligne dans \"⚠️ Ça a besoin de toi\" et fausser son compteur. Le bouton se désactive désormais dès le premier clic le temps de l'enregistrement.",
        howTo: "Rien à faire, c'est automatique.",
        gain: "Plus de fiches fantômes créées en double, et un compteur \"Ça a besoin de toi\" fiable.",
      },
      {
        type: "fix",
        title: "🐛 \"Changer de type\" perdait les sous-étapes et les notes",
        text: "Convertir une Tâche en Suivi (ou l'inverse), ou une Tâche/un Suivi en Information/Idée, effaçait silencieusement les sous-étapes cochables et le journal de notes déjà pris — seuls le titre, la description, le projet et l'échéance survivaient, sans que la fiche \"🔁 Changer de type\" ne le dise. C'est corrigé : sous-étapes et notes suivent désormais la conversion (une Information/Idée n'ayant pas de sous-étapes, seules les notes la suivent dans ce cas précis). Les tags et les éléments liés (🔗) restent en revanche orphelins après une conversion — non repris, comme déjà indiqué.",
        howTo: "Fiche → \"🔁 Changer de type\".",
        gain: "Changer le type d'un élément mal qualifié ne fait plus perdre le travail déjà fait dessus.",
      },
      {
        type: "fix",
        title: "🐛 D'autres boutons \"+\" pouvaient eux aussi dupliquer sur un double-clic",
        text: "Le correctif ci-dessus sur les créations de fiches ne couvrait que les fiches elles-mêmes : d'autres boutons \"+\" à l'intérieur d'une fiche déjà ouverte pouvaient créer deux fois le même élément sur un double-clic ou un Entrée suivi d'un clic rapproché, tout aussi silencieusement — ajout d'une sous-étape, ajout d'une note, ajout d'une sous-partie de projet, rattachement d'une réunion Outlook, création rapide d'un projet depuis un Suivi, sélection d'un élément à lier. C'est corrigé partout où ce cas se présentait : chaque bouton concerné se désactive désormais le temps de l'enregistrement, comme c'était déjà le cas pour la création d'une fiche.",
        howTo: "Rien à faire, c'est automatique.",
        gain: "Plus de sous-étape, note, sous-partie ou lien dupliqué par un clic un peu trop rapide.",
      },
      {
        type: "fix",
        title: "🐛 Une tâche pouvait apparaître deux fois dans \"⚠️ Ça a besoin de toi\" ou en Focus",
        text: "Une même tâche pouvait remplir deux critères à la fois — par exemple avoir une échéance proche ET être à l'arrêt depuis un moment, deux critères indépendants l'un de l'autre — et se retrouvait alors listée deux fois dans \"⚠️ Ça a besoin de toi\" (et de même en mode Focus), avec un compteur affiché en titre faussé en conséquence. C'est corrigé : chaque tâche ou Suivi n'apparaît plus qu'une fois, sous la raison la plus urgente des deux.",
        howTo: "Rien à faire, c'est automatique.",
        gain: "Le compteur de \"Ça a besoin de toi\" (et la file Focus) reflète enfin le nombre réel de sujets à traiter, sans doublon.",
      },
      {
        type: "fix",
        title: "🐛 Deux modifications rapprochées pouvaient s'écraser silencieusement l'une l'autre",
        text: "Modifier deux réglages coup sur coup (ex. changer de casquette puis masquer une rubrique de l'Accueil juste après), ou ajouter une note et une sous-étape presque en même temps sur la même fiche, pouvait faire disparaître la première des deux modifications sans le moindre message d'erreur — la seconde écrivait par-dessus avant que la première n'ait fini d'enregistrer. C'est corrigé pour les réglages personnels (casquette, rubriques masquées, raccourcis, Post-it...) et pour les ajouts sur une fiche (notes, sous-étapes, sous-parties de projet, points de suivi d'objectif...) : chaque modification attend désormais que la précédente sur le même élément soit bien enregistrée avant de démarrer la sienne.",
        howTo: "Rien à faire, c'est automatique.",
        gain: "Deux modifications rapprochées sur le même réglage ou la même fiche ne se perdent plus l'une l'autre.",
      },
      {
        type: "fix",
        title: "🐛 Une tâche due aujourd'hui pouvait apparaître en retard (fuseaux Amérique)",
        text: "Selon le fuseau horaire du compte, une tâche ou un Suivi dû tout juste \"aujourd'hui\" pouvait s'afficher comme déjà en retard avant même la fin de la journée — plusieurs endroits de l'app (retard, échéance proche, score de santé projet, matrice de priorisation, revue hebdomadaire) calculaient chacun \"combien de jours avant/après aujourd'hui\" un peu différemment. Unifié sur un seul mode de calcul, cohérent quel que soit le fuseau horaire.",
        howTo: "Rien à faire, c'est automatique.",
        gain: "Le statut \"en retard\"/\"à échéance\" est désormais fiable toute la journée, quel que soit le fuseau horaire du compte.",
      },
      {
        type: "fix",
        title: "🐛 Certains échecs techniques passaient totalement inaperçus",
        text: "Trois cas où un problème réseau ou technique passager ne se voyait absolument pas : les données de l'app pouvaient se figer sur leur dernier état connu sans que rien ne le signale, une vérification de connexion en échec pouvait laisser l'écran entièrement blanc, et le bouton \"⌨️ Assigner un raccourci\" pouvait rester bloqué sur \"Maintiens Ctrl+Alt...\" indéfiniment si l'enregistrement échouait. Les trois cas affichent désormais un message clair (et, pour l'écran blanc, un bouton \"Réessayer\") au lieu de rester muets.",
        howTo: "Rien à faire, c'est automatique.",
        gain: "Un problème technique passager se voit maintenant, au lieu de laisser croire que tout va bien ou de bloquer l'écran sans explication.",
      },
      {
        type: "fix",
        title: "🐛 Petites incohérences (auto-archivage, historique) corrigées",
        text: "Dernier volet de l'audit du 15/09 : une Information/Idée qualifiée longtemps après sa capture pouvait être auto-archivée dès le balayage suivant, comme si elle traînait déjà depuis 15 jours — c'est désormais la date à laquelle elle est devenue une information qui compte, pas celle de sa capture brute d'origine. Plusieurs événements de l'Historique (conversions Tâche/Suivi, tags, sous-parties de projet, réunions Outlook rattachées/détachées) s'affichaient avec un libellé générique au lieu d'un texte clair — corrigé. Et retirer une grille de décision qui n'en avait jamais eu une ne laisse plus une entrée fantôme dans l'historique.",
        howTo: "Rien à faire, c'est automatique.",
        gain: "L'auto-archivage des informations et le fil de l'Historique sont désormais fidèles à ce qui s'est réellement passé.",
      },
    ],
  },
  {
    date: "14 septembre 2026",
    items: [
      {
        type: "add",
        title: "👥 Administration : fermer/ouvrir un compte, supprimer tout son contenu",
        text: "Depuis 🔧 Administration → \"👥 Comptes\" (visible uniquement pour ch-houdayer@hotmail.fr) : chaque compte autorisé peut être fermé (bloque une prochaine connexion, sans effet sur une session déjà ouverte ailleurs jusqu'à sa reconnexion suivante) ou rouvert. Une fois fermé, son contenu applicatif (tâches, projets, personnes, suivis...) peut être supprimé définitivement pour libérer de l'espace Firebase — une sauvegarde JSON téléchargeable est proposée avant, et il faut retaper l'email du compte pour confirmer. L'historique de connexions/écrans consultés n'est jamais supprimé par cette action.",
        howTo: "🔧 Administration → \"👥 Comptes\" → 🔒 Fermer sur le compte concerné, puis \"🗑️ Supprimer tout son contenu\" si besoin.",
        gain: "Retirer proprement l'accès et les données d'un compte qui n'en a plus besoin, sans passer par la console Firebase.",
      },
      {
        type: "fix",
        title: "🐛 La mise à jour automatique de l'application ne se déclenchait pas",
        text: "La détection de nouvelle version (voir plus bas \"🔄 Mise à jour automatique de l'application\") ne fonctionnait en réalité que lorsque le fichier technique interne de l'application changeait — ce qui n'était pas le cas des deux dernières vagues (recherche, autocomplétion), qui ne touchaient que des écrans. Résultat : aucun message, aucun rechargement automatique, l'application restait silencieusement sur l'ancienne version. Corrigé — ce fichier change désormais à chaque vague qui modifie quoi que ce soit dans l'application, garantissant que la détection se déclenche à chaque fois. Un réglage de cache a aussi été resserré côté hébergement pour que la vérification porte toujours sur la toute dernière version, jamais une copie en attente.",
        howTo: "Rien à faire, c'est automatique.",
        gain: "La mise à jour automatique fonctionne enfin comme prévu, à chaque nouvelle vague.",
      },
      {
        type: "change",
        title: "Modifier en masse : Ressource/Prompt en autocomplétion, tout trié par ordre alphabétique",
        text: "Dans la modale \"Modifier en masse\" (Pilotage, vue Tableau), les champs Ressource et Prompt étaient des listes déroulantes qui s'allongeaient avec la bibliothèque, sans ordre particulier. Ils fonctionnent désormais comme le champ Tag : un champ texte avec autocomplétion, où les titres proposés sont triés par ordre alphabétique. Le champ Projet reste une liste déroulante classique (pour tout voir d'un coup dès le clic, sans avoir à taper), mais ses projets sont maintenant triés par ordre alphabétique eux aussi ; les projets fermés n'y apparaissent toujours pas.",
        howTo: "Pilotage → Tableau → coche des tâches → \"✏️ Modifier en masse\" → Ressource/Prompt : tape le début du titre, choisis parmi les suggestions.",
        gain: "Retrouver une ressource ou un prompt en tapant son nom plutôt qu'en faisant défiler une liste sans fin, et un ordre alphabétique partout où plusieurs éléments sont proposés.",
      },
      {
        type: "add",
        title: "🔎 Pilotage : recherche par titre ou description (Trello et Tableau)",
        text: "Un nouveau champ de recherche apparaît en haut de Pilotage, au-dessus des filtres — tape un mot pour ne garder que les tâches dont le titre ou la description le contiennent. Fonctionne aussi bien en vue Trello qu'en vue Tableau, et se combine avec les autres filtres déjà en place (casquette, projet, échéance...).",
        howTo: "Pilotage → champ \"🔎 Rechercher (titre, description)...\" en haut de l'écran.",
        gain: "Retrouver une tâche précise dans une longue liste sans avoir à faire défiler ni à ouvrir chaque filtre.",
      },
      {
        type: "add",
        title: "🔄 Mise à jour automatique de l'application",
        text: "Jusqu'ici, une nouvelle version de l'application ne prenait effet qu'en fermant complètement l'app puis en la rouvrant. Désormais, dès qu'une nouvelle version est disponible et détectée, l'application affiche un bref message (\"🔄 Mise à jour disponible — l'application se recharge…\") puis se recharge automatiquement pour l'appliquer — sans avoir à fermer/rouvrir soi-même. La vérification se fait à l'ouverture de l'app et à chaque retour au premier plan (si l'app était restée ouverte en fond).",
        howTo: "Rien à faire, c'est automatique. Si le message apparaît, l'application se recharge d'elle-même dans la seconde qui suit.",
        gain: "Plus besoin de fermer/rouvrir l'app pour être sûr de travailler sur la dernière version.",
      },
      {
        type: "fix",
        title: "🐛 Pilotage (Tableau) : la barre de modification en masse s'efface bien à zéro sélection",
        text: "La barre \"✏️ Modifier en masse\" restait affichée même quand plus aucune tâche n'était cochée dans la vue Tableau de Pilotage. Corrigé — elle apparaît uniquement dès qu'au moins une ligne est sélectionnée et disparaît dès que la sélection redevient vide, décoche par décoche ou via \"Tout désélectionner\".",
        howTo: "Rien à faire, c'est automatique.",
        gain: "Une barre d'action qui ne reste plus affichée pour rien.",
      },
      {
        type: "fix",
        title: "🐛 Modifier en masse : la scrollbar horizontale et le sélecteur écrasé sur Ressource/Prompt/Tag",
        text: "Dans la modale \"Modifier en masse\" (Pilotage, vue Tableau), les champs Ressource, Prompt et Tag affichaient une scrollbar horizontale inutile : le sélecteur \"+ Ajouter / − Retirer\" prenait presque toute la largeur de la ligne, écrasant le choix de la ressource/du prompt/du tag dans quelques pixels à droite. Corrigé — le sélecteur Ajouter/Retirer reprend une largeur compacte, le choix de la valeur prend le reste de la place, plus de scrollbar.",
        howTo: "Rien à faire, c'est automatique.",
        gain: "Une modale de modification en masse qui s'affiche correctement, sans élément écrasé ni défilement superflu.",
      },
      {
        type: "add",
        title: "☑️ Pense-bête (Checklist) : les cochés descendent en bas + tout supprimer d'un coup",
        text: "Dans le Pense-bête en mode Checklist, cocher un élément le fait maintenant descendre en bas de la liste — les éléments restants à faire sont donc toujours visibles en premier. Un bouton \"🗑️ Supprimer les cochés\" apparaît dès qu'au moins un élément est coché, pour tout vider d'un coup plutôt qu'un par un ; il disparaît de lui-même quand plus rien n'est coché.",
        howTo: "📌 Pense-bête → ☑️ Checklist. Coche un ou plusieurs éléments, puis \"🗑️ Supprimer les cochés\" apparaît au-dessus de la liste.",
        gain: "Un pense-bête qui reste lisible même chargé, sans avoir à retirer chaque élément coché à la main.",
      },
      {
        type: "change",
        title: "Checklists : bouton \"+\" compact, et \"élément\" plutôt que \"sous-étape\"",
        text: "Sur toute checklist de l'app (Tâche, Suivi, Pense-bête), le bouton \"+ Ajouter\" devient un simple \"+\" rond à côté du champ de saisie — il débordait de la fiche dans certaines modales. Le champ s'appelle désormais \"Ajouter un élément\" plutôt que \"Ajouter une sous-étape\", un terme plus neutre pour les trois usages.",
        howTo: "Rien à faire, c'est automatique.",
        gain: "Une checklist qui tient toujours dans sa fiche, quelle que soit sa largeur.",
      },
      {
        type: "fix",
        title: "📌 Pense-bête plus discret, à côté des indicateurs sur ordinateur",
        text: "Le Pense-bête ne s'affiche plus en pleine largeur au-dessus ou en dessous des indicateurs chiffrés : sur ordinateur, il se place désormais à gauche — dans la marge inoccupée sur grand écran, pour laisser les indicateurs sur toute leur largeur habituelle, ou juste à leur gauche sur écran plus étroit — dans une colonne resserrée. Son habillage (fond, ombre) a aussi été allégé pour rester discret. Sur mobile, l'ordre ne change pas (indicateurs d'abord, Pense-bête juste après).",
        howTo: "Rien à faire, c'est automatique. ⚙️ Personnaliser l'accueil permet toujours de le masquer ou de déplacer le bloc \"Indicateurs (avec le Pense-bête)\" par rapport aux autres rubriques.",
        gain: "Un repère qui reste à portée d'œil sans dominer visuellement l'écran d'accueil, ni grignoter la place des indicateurs.",
      },
      {
        type: "fix",
        title: "Filtre par casquette retiré de l'écran d'accueil",
        text: "Le filtre Toutes / Toi / Équipe / Projets / Manager / CSE, jugé inutile sur l'Accueil, a été retiré de cet écran — les rubriques (Ça a besoin de toi, Mes projets, etc.) affichent maintenant tout, sans filtre caché à réinitialiser. Il reste disponible tel quel sur Pilotage et sur Priorisation.",
        howTo: "Rien à faire, c'est automatique.",
        gain: "Un écran d'accueil plus simple, sans un filtre qui ne servait pas.",
      },
    ],
  },
  {
    date: "13 septembre 2026 (suite 7)",
    items: [
      {
        type: "add",
        title: "📖 Guide : sommaire, rituels par période, et liens depuis l'app",
        text: "Le Guide s'organise maintenant autour de deux nouveaux index cliquables tout en haut : un « 📚 Sommaire » pour sauter directement à une rubrique (chaque casquette, les onglets, les fonctions transverses...), et « 🗓️ Selon le moment » qui range les bonnes pratiques par occasion plutôt que par écran — préparer un point ou une EADP, suivre tes propres objectifs, lancer un nouveau projet, ta routine quotidienne/hebdomadaire. Quelques écrans (Mes objectifs, fiche Personne, Management, création de Projet) affichent désormais un petit lien « 📖 » qui renvoie directement à la bonne rubrique du Guide, sans en semer partout.",
        howTo: "☰ Plus → 📖 Guide, ou clique un des liens « 📖 » sur les quelques écrans concernés.",
        gain: "Retrouver la bonne pratique selon la situation ou la période, sans dérouler tout le Guide à chaque fois.",
      },
    ],
  },
  {
    date: "13 septembre 2026 (suite 6)",
    items: [
      {
        type: "add",
        title: "🎯 Mes objectifs : suivi d'avancement (statut, points de suivi, éléments liés)",
        text: "\"🎯 Mes objectifs\" n'est plus un simple bloc de texte libre : chaque objectif personnel a désormais un statut (⚪ Actif / ✅ Atteint), des points de suivi datés, des tags et des éléments liés — exactement le même suivi que celui déjà en place pour les objectifs de tes collaborateurs. L'ancien texte, s'il existait, a été repris automatiquement comme premier point de suivi d'un objectif \"Ligne directrice\", rien n'est perdu.",
        howTo: "🎯 Mes objectifs (Accueil) → + Nouvel objectif, ou clique un objectif existant pour cocher \"Atteint\", ajouter un point de suivi, un tag, ou lier une fiche.",
        gain: "Savoir où tu en es sur tes propres objectifs, pas seulement ceux que tu suis pour les autres — avec un historique daté à relire plutôt qu'une ligne de texte statique.",
      },
    ],
  },
  {
    date: "13 septembre 2026 (suite 5)",
    items: [
      {
        type: "add",
        title: "🏷️ Les tags remontent sur l'Accueil, quel que soit le type de fiche",
        text: "Une ligne, projet, information/idée, suivi ou réunion affichée sur l'Accueil (⚠️ Ça a besoin de toi, 🧠 Informations & idées, 📦 Mes projets, 🧠 Récemment, 🔄 Reprendre où j'en étais, 🎯 Focus du jour) montre désormais ses tags directement sous son titre, sans avoir à l'ouvrir. Rien n'est affiché quand une fiche ne porte aucun tag.",
        gain: "Repérer d'un coup d'œil, depuis l'Accueil, tout ce qui touche à un même sujet (ex. #CSE) sans avoir à ouvrir chaque fiche une par une.",
      },
    ],
  },
  {
    date: "13 septembre 2026 (suite 4)",
    items: [
      {
        type: "fix",
        title: "🏷️ L'autocomplétion des tags propose maintenant les tags existants partout",
        text: "Sur une fiche (Tâche, Projet, Personne...), taper un tag ne proposait jamais les tags déjà utilisés ailleurs — la liste de suggestions comparait des valeurs préfixées \"#\" à une saisie qui n'a jamais le \"#\", donc aucune correspondance ne pouvait matcher. Corrigé sur les 9 types de fiches d'un coup (un seul composant partagé).",
        gain: "Réutiliser un tag déjà posé ailleurs sans avoir à s'en souvenir mot pour mot ni risquer une variante (ex. \"urgent\" vs \"Urgent\").",
      },
      {
        type: "add",
        title: "🏷️ Administration des tags : désactiver ou supprimer",
        text: "Depuis 🔧 Administration → \"🏷️ Gérer les tags\" : la liste de tous les tags utilisés, avec pour chacun le nombre de fiches concernées. \"Désactivé\" retire un tag de l'autocomplétion (utile pour une faute de frappe qu'on ne veut plus voir reproposée) sans toucher aux fiches qui le portent déjà, ni à la recherche. \"Supprimer\" le retire, lui, réellement de toutes les fiches qui le portent — irréversible, une confirmation est demandée.",
        howTo: "🔧 (bouton flottant, réservé à l'administration) → 🏷️ Gérer les tags → case \"Désactivé\" pour le retirer des suggestions, ou 🗑️ Supprimer pour l'effacer partout.",
        gain: "Garder la liste de tags propre à l'usage, sans devoir aller corriger fiche par fiche.",
      },
      {
        type: "add",
        title: "🏷️ Tag ajouté/retiré en une fois sur plusieurs tâches (vue Tableau)",
        text: "Dans la vue Tableau du Pilotage, l'édition en masse (plusieurs tâches cochées → \"Modifier la sélection\") propose désormais un champ Tag, comme pour les Ressources/Prompts : + Ajouter pose ce tag sur toutes les tâches cochées, − Retirer l'enlève. Dans les deux cas, les autres tags déjà présents sur chaque tâche restent intacts — jamais un remplacement.",
        howTo: "Vue 📊 Tableau → cocher les tâches → \"Modifier la sélection\" → cocher \"Tag\" → + Ajouter ou − Retirer → nom du tag (autocomplétion incluse) → Appliquer.",
        gain: "Étiqueter tout un lot de tâches d'un coup (ex. #CSE sur 10 tâches liées à une même réunion) sans les ouvrir une par une.",
      },
    ],
  },
  {
    date: "13 septembre 2026 (suite 3)",
    items: [
      {
        type: "add",
        title: "🏷️ Tags sur n'importe quelle fiche + recherche par #tag",
        text: "Les tags — jusqu'ici réservés aux Informations/Idées — se posent désormais sur les 9 types de fiches (Tâche, Projet, Personne, Suivi, Ressource, Réunion, Décision, Objectif, Information/Idée), toujours affichés préfixés \"#\". Dans la recherche globale (🔎), taper \"#\" propose en autocomplétion tous les tags déjà utilisés ; \"#motclé\" ne cherche plus que par tag, tous types confondus, pour retrouver d'un coup tout ce qui porte cette étiquette. Les anciens tags déjà posés sur des Informations/Idées ont été repris automatiquement, rien n'est perdu.",
        howTo: "Sur n'importe quelle fiche → section \"🏷️ Tags\" → taper un mot (le # est ajouté automatiquement à l'affichage) → + Tag. Pour retrouver : 🔎 Rechercher → \"#\" puis le nom du tag (proposé en autocomplétion).",
        gain: "Une seule catégorisation libre, cohérente sur toute l'app, pour recouper des sujets qui traversent plusieurs types de fiches (ex. #CSE sur un Projet, une Réunion et un Suivi à la fois).",
      },
      {
        type: "fix",
        title: "🗓️ Fiche Réunion/Décision : le champ Projet ne plantait plus la fiche",
        text: "Ouvrir une fiche Réunion ou Décision depuis l'Accueil provoquait une erreur silencieuse (\"attachProjectQuickCreate is not defined\") dès que la fiche essayait d'afficher le champ Projet avec sa création rapide — la fiche restait bloquée avant même d'afficher ses tags ou son fil \"🔗 Lié\". Trouvé en testant la nouveauté ci-dessus. Corrigé par un simple import manquant.",
      },
    ],
  },
  {
    date: "13 septembre 2026 (suite 2)",
    items: [
      {
        type: "fix",
        title: "🔎 La recherche globale trouve maintenant un tag",
        text: "Les tags libres d'une Information/Idée n'étaient comparés que dans la modale dédiée \"Voir tout\" (filtre par chip) — taper un tag dans la recherche globale (🔎, en haut de l'Accueil) ne remontait rien. Elle regarde désormais les tags comme le reste du contenu.",
        howTo: "🔎 Rechercher → taper le tag directement, comme un mot-clé normal.",
      },
    ],
  },
  {
    date: "13 septembre 2026 (suite)",
    items: [
      {
        type: "add",
        title: "📌 Pense-bête sur l'Accueil (post-it libre ou checklist)",
        text: "Une zone libre en haut de l'Accueil pour ce que tu as en tête pour la journée sans que ce soit une tâche à piloter — un billet d'avion à acheter, voir Michel aujourd'hui... Deux modes au choix (texte libre ou petite checklist cochable), chacun avec son propre contenu gardé séparément si tu bascules de l'un à l'autre. Un avertissement reste affiché en permanence : ça peut vite devenir un fourre-tout, à vider régulièrement.",
        howTo: "⚙️ Personnaliser l'accueil (en haut de l'Accueil) → coche \"📌 Pense-bête\". Se remplit ensuite directement sur l'Accueil, sans fenêtre à part.",
        gain: "Un endroit unique et toujours visible pour ce qui traîne en tête, sans polluer le pilotage des vraies tâches.",
      },
      {
        type: "add",
        title: "🗂️ Réorganiser l'Accueil à ta main",
        text: "Chaque rubrique de l'Accueil (Pense-bête et bloc chiffré compris) peut désormais être déplacée. Par défaut, le Pense-bête se place avant les indicateurs chiffrés sur grand écran et juste après sur mobile — dès que tu en déplaces une toi-même, cet ordre devient fixe et identique partout, avec un bouton pour revenir à l'ordre automatique à tout moment.",
        howTo: "⚙️ Personnaliser l'accueil → \"Ordre des rubriques\", boutons ▲▼.",
        gain: "L'Accueil à l'image de ta façon de travailler, plutôt qu'un ordre imposé.",
      },
      {
        type: "add",
        title: "🌙 Mode sombre, avec interrupteur sur l'Accueil",
        text: "Un interrupteur ☀️/🌙 en haut à gauche de l'Accueil bascule explicitement entre clair et sombre — avant ce choix, l'app suit déjà le réglage de ton appareil. Le choix posé l'emporte ensuite toujours sur l'appareil, dans les deux sens, sans flash du mauvais thème au chargement.",
        howTo: "Interrupteur ☀️/🌙 en haut à gauche de l'Accueil, à côté du titre \"Mon pilotage\".",
        gain: "Un thème sombre disponible quand tu le veux, sans dépendre uniquement du réglage du téléphone ou du PC.",
      },
    ],
  },
  {
    date: "13 septembre 2026",
    items: [
      {
        type: "add",
        title: "☑️ Sélection multiple + édition en masse (tableau Pilotage)",
        text: "Dans la vue Tableau (format Monday), une case à cocher par ligne (et une par groupe pour tout sélectionner d'un coup) fait apparaître une barre d'action \"✏️ Modifier en masse\" : statut, échéance, projet, critère de clôture, blocage, ressource liée, prompt lié ou note peuvent être appliqués à toutes les tâches sélectionnées en une fois — chaque champ reste inactif tant que tu ne coches pas explicitement \"modifier ce champ\", pour ne jamais écraser silencieusement ce que tu n'as pas touché.",
        howTo: "Onglet Pilotage → Tâches → vue 📊 Tableau → coche des lignes → \"✏️ Modifier en masse\".",
        gain: "Traiter d'un coup un lot de tâches similaires (reporter une échéance sur 5 tâches, ajouter la même ressource...) plutôt qu'une par une.",
      },
    ],
  },
  {
    date: "13 septembre 2026",
    items: [
      {
        type: "add",
        title: "🏷️ Tags libres sur les Informations/Idées",
        text: "Chaque Information/Idée conservée depuis l'Inbox peut désormais porter ses propres tags libres, avec autocomplétion sur ceux déjà utilisés. La modale \"Voir tout\" propose maintenant un filtre par tag (plusieurs à la fois) en plus du filtre texte déjà existant.",
        howTo: "Ouvre une Information/Idée → champ tags en bas de la fiche. Filtrer : \"🧠 Informations & idées\" → \"Voir tout\" → clique un ou plusieurs tags.",
        gain: "Retrouver facilement tout ce qui touche à un même sujet, sans avoir à tout relire.",
      },
      {
        type: "add",
        title: "📦 Rattacher un Objectif ou une Information/Idée à un projet",
        text: "Ces deux seuls types qui n'avaient encore aucun moyen de se rattacher à un projet (tous les autres l'avaient déjà) gagnent un sélecteur \"Projet\", avec possibilité d'en créer un directement depuis là. Le badge du projet apparaît ensuite dans la liste des objectifs d'un collaborateur.",
        howTo: "Création ou fiche détail d'un Objectif, ou fiche détail d'une Information/Idée → champ \"Projet\".",
        gain: "Vraiment tout élément peut désormais se rattacher à un projet, sans exception restante.",
      },
    ],
  },
  {
    date: "13 septembre 2026",
    items: [
      {
        type: "add",
        title: "👀 Suivis (vue globale, onglet Équipe)",
        text: "Un 4e mode dans l'onglet Équipe qui regroupe, tous projets et personnes confondus, ce que tu attends de quelqu'un et ce que tu dois lui transmettre — trié par urgence (retard de contrôle d'abord), avec ce qui est déjà réglé masqué par défaut.",
        howTo: "Onglet Équipe → \"👀 Suivis\".",
        gain: "Voir en un seul écran tous les suivis actifs, sans devoir ouvrir chaque fiche Personne une par une.",
      },
    ],
  },
  {
    date: "13 septembre 2026",
    items: [
      {
        type: "add",
        title: "📦 Remonter au projet depuis une fiche Tâche",
        text: "Le libellé \"Projet\" devient un lien cliquable dès qu'un projet est sélectionné dans le champ juste en dessous, pour ouvrir directement sa fiche.",
        howTo: "Fiche Tâche → clique le libellé \"Projet\" au-dessus de la liste déroulante.",
      },
      {
        type: "change",
        title: "🔎 La recherche exclut par défaut ce qui est terminé/archivé",
        text: "Une case à cocher \"Inclure terminé/archivé\", décochée par défaut, filtre les résultats de la recherche globale — rien n'est perdu, juste masqué tant que tu ne demandes pas à tout voir.",
        howTo: "Recherche globale → case \"Inclure terminé/archivé\" si besoin.",
        gain: "Des résultats de recherche qui vont directement à l'essentiel, sans les vieux éléments clos qui les noient.",
      },
      {
        type: "change",
        title: "📂 Qualifier un item Inbox ouvre sa fiche complète",
        text: "Qualifier une capture de l'Inbox (Tâche, Suivi, Projet, Ressource, Réunion, Décision, Information/Idée) ouvre maintenant directement la fiche complète créée, au lieu de refermer sur un simple message.",
        gain: "Continuer à compléter l'élément tout de suite (échéance, description...) sans devoir le rechercher ensuite.",
      },
    ],
  },
  {
    date: "13 septembre 2026",
    items: [
      {
        type: "fix",
        title: "Modale 🔧 Administration parfois impossible à fermer",
        text: "Corrigé — la fenêtre se ferme désormais normalement dans tous les cas.",
      },
    ],
  },
  {
    date: "9 septembre 2026 (suite)",
    items: [
      {
        type: "fix",
        title: "Un clic en dehors d'une modale ne fait plus perdre la saisie",
        text: "Cliquer accidentellement en dehors d'une fenêtre de saisie (changement de fenêtre, clic à côté sur un grand écran) fermait la modale et perdait tout ce qui y était tapé. Toute modale contenant un champ modifiable (texte, date, liste déroulante) ignore désormais le clic en dehors — avec un petit \"shake\" pour signaler que ça n'a pas fonctionné — et ne se ferme plus que via un bouton explicite (Fermer/Annuler) ou Échap. Les modales sans aucune saisie (listes, confirmations) gardent le clic en dehors comme raccourci rapide, sans risque.",
        gain: "Ne plus jamais perdre 5 minutes de saisie à cause d'un clic malheureux.",
      },
      {
        type: "add",
        title: "🗒️ Point avec... : chercher dans tous les sujets d'une personne",
        text: "Un champ de recherche en haut de la modale \"Point avec...\" permet de retrouver n'importe quel sujet déjà traité avec cette personne, y compris les sujets terminés depuis longtemps (au-delà des 5 plus récents affichés normalement) et les sujets masqués du partage à l'écran.",
        howTo: "Ouvrir \"🗒️ Point avec...\" → champ \"🔎 Chercher dans tous les sujets de...\" en haut.",
        gain: "Retrouver \"on avait dit quoi déjà sur ce sujet\" sans avoir à rouvrir tout l'historique à la main.",
      },
    ],
  },
  {
    date: "9 septembre 2026",
    items: [
      {
        type: "add",
        title: "🔁 Changer le type d'un élément mal qualifié",
        text: "Une Tâche, un Suivi ou une Information/Idée peut désormais être converti vers un autre de ces trois types directement depuis sa fiche — fini le \"supprimer et recréer\" qui faisait perdre le fil. Titre, description, projet et échéance (quand compatibles) sont repris automatiquement ; l'historique de chaque côté garde une trace du lien entre l'ancien et le nouvel élément. La conversion vers/depuis un Projet n'est volontairement pas proposée (trop de pertes de sens pour une entité aussi structurante).",
        howTo: "Fiche Tâche, fiche Suivi, ou détail d'une Information/Idée → bouton \"🔁 Changer de type\".",
        gain: "Corriger une erreur de qualification en 2 clics, sans perdre l'historique ni ressaisir le contenu.",
      },
      {
        type: "add",
        title: "🧠 Informations & idées : enfin toutes retrouvables",
        text: "Deux trous corrigés : les informations/idées auto-archivées après 15 jours étaient devenues purement introuvables (absentes de la recherche globale ET de tout affichage) — elles sont maintenant indexées dans la recherche. Et une nouvelle modale \"Voir tout\" (avec filtre texte) donne accès à l'ensemble des informations/idées, y compris les anciennes — accessible aussi bien depuis l'Accueil classique que depuis le mode \"Focus\", qui n'y avait jusqu'ici jamais accès du tout.",
        howTo: "Accueil (classic ou Focus) → bouton \"🧠 Informations & idées\" / \"Voir tout\".",
        gain: "Ne plus jamais perdre le fil d'une information capturée, même des semaines après.",
      },
      {
        type: "add",
        title: "Créer un projet à la volée depuis n'importe quel rattachement",
        text: "Sur les formulaires de Tâche, Réunion et Décision, la liste déroulante \"Projet\" propose désormais \"+ Nouveau projet…\" en fin de liste : le projet créé est immédiatement sélectionné, sans fermer ni recharger le formulaire en cours. Les formulaires de Suivi disposaient déjà d'un mécanisme équivalent.",
        howTo: "N'importe quel champ \"Projet (optionnel)\" → dernière option de la liste déroulante.",
        gain: "Ne plus interrompre une saisie en cours juste parce que le projet n'existe pas encore.",
      },
    ],
  },
  {
    date: "8 septembre 2026",
    items: [
      {
        type: "change",
        title: "🎯 Focus du jour (Accueil) : fini le plafond à 3",
        text: "Le Focus du jour affiche désormais TOUTES les tâches en retard et à échéance aujourd'hui, sans limite de nombre — auparavant, seules les 3 tâches les mieux classées apparaissaient, les autres restant invisibles sauf à ouvrir la liste complète. Si rien n'est en retard ni dû aujourd'hui, le Focus retombe sur les 3 tâches les plus urgentes proposées automatiquement, comme avant. Le bouton 🔀 devient \"➕ Ajouter une tâche au Focus\" : il sert maintenant à ajouter une tâche en plus de la sélection automatique (visible avec un ✕ pour la retirer), plutôt qu'à remplacer une ligne parmi 3.",
        howTo: "Accueil → 🎯 Focus du jour. \"➕ Ajouter une tâche au Focus\" pour y placer une tâche qui n'est ni en retard ni due aujourd'hui.",
        gain: "Ne plus jamais rater une échéance du jour restée invisible sous prétexte qu'elle n'était pas dans le \"top 3\".",
      },
      {
        type: "fix",
        title: "Mode Accueil \"🎯 Focus\" (file une tâche à la fois) : les échéances du jour même manquaient",
        text: "Dans le mode d'Accueil \"Focus\" (celui qui montre un sujet à la fois plutôt que la liste classique), une tâche à échéance exactement aujourd'hui tombait dans un trou entre les catégories \"en retard\" et \"à venir\" et n'apparaissait jamais dans la file. Elle y figure maintenant avec le motif \"📅 Échéance aujourd'hui\", juste après les tâches en retard.",
      },
      {
        type: "add",
        title: "🗒️ Point avec... : ajouter un sujet apparu en direct",
        text: "Pendant la préparation ou le déroulé d'un point collaborateur, un bouton \"➕ Sujet apparu\" ouvre directement le formulaire de création de Suivi (personne déjà présélectionnée). Une fois créé, le sujet est intégré à la bonne section (🎯 À aborder, groupé par projet comme le reste) et marqué automatiquement \"vu\" — plus besoin de sortir du point pour créer le Suivi ailleurs puis revenir le cocher.",
        howTo: "Ouvrir \"🗒️ Point avec...\" → bouton \"➕ Sujet apparu\" en bas de la fenêtre.",
        gain: "Ne rien perdre d'un sujet qui surgit pendant l'échange, sans rupture du fil de la discussion.",
      },
      {
        type: "fix",
        title: "🙈 Avant de partager (fenêtre de masquage privée) : correctif définitif de la lenteur/blocage",
        text: "Diagnostic affiné avec des mesures précises (iPhone instantané, PC web ~20 s, PC installé bloqué indéfiniment) : la fenêtre séparée rechargeait l'app entière sur sa propre route, créant un SECOND client Firestore en concurrence avec celui déjà actif dans la fenêtre principale — les deux devaient négocier lequel détient la persistance locale avant de pouvoir lire quoi que ce soit, d'où la lenteur (et le blocage total sur certaines configurations d'app installée). La fenêtre séparée est désormais vierge (pas de rechargement d'app) et affiche la checklist directement depuis le client Firestore déjà actif de la fenêtre principale : plus de second client, plus de négociation, ouverture instantanée dans tous les contextes.",
      },
      {
        type: "fix",
        title: "🙈 Avant de partager : erreur silencieuse rendue visible",
        text: "Sur certains postes, la fenêtre séparée \"🙈 Avant de partager\" affichait son texte d'intro mais jamais la liste à cocher, sans aucun message — un échec de chargement des données passait inaperçu. Un message d'erreur explicite avec un bouton \"🔄 Réessayer\" apparaît désormais à la place d'un vide silencieux (utile si un souci réseau ponctuel survient malgré le correctif ci-dessus).",
      },
    ],
  },
  {
    date: "7 septembre 2026",
    items: [
      {
        type: "add",
        title: "🩺 Santé des projets (onglet Projets)",
        text: "Un 3e mode d'affichage \"🩺 Santé\" dans l'onglet Projets (à côté de \"📋 Liste\"/\"🗂️ Par catégorie\") : chaque projet actif reçoit un score de santé sur 100, calculé depuis ce qui existe déjà dans l'app — tâches en retard (au retard cumulé, pas juste au nombre), tâches bloquées, tâches en pause, et suivis en retard rattachés au projet. Les projets sont triés du moins bon au meilleur, avec une jauge visuelle et les signaux précis qui expliquent le score (\"📈 Retard cumulé +8 j sur 2 tâches\", \"⏸️ 1 tâche en pause\"...) — un projet sans signal affiche \"🟢 Aucun signal notable\" et sa prochaine échéance à titre indicatif.",
        howTo: "Onglet Pilotage → Projets → \"🩺 Santé\". Cliquer une ligne ouvre directement la fiche du projet concerné.",
        gain: "Repérer une dérive sur un projet avant qu'elle ne devienne un franc retard, plutôt qu'à la Revue hebdomadaire seulement.",
      },
      {
        type: "fix",
        title: "🩺 Santé des projets : chaque signal ouvre directement l'élément concerné",
        text: "Un signal comme \"1 tâche en pause\" ou \"Prochaine échéance dans 17 j\" ouvrait la fiche du projet entier au clic, sans dire laquelle de ses tâches ou de ses suivis était concernée. Cliquer directement sur un signal (hors \"🟢 Aucun signal notable\") ouvre désormais la tâche ou le suivi précis qu'il désigne ; cliquer ailleurs sur la ligne continue d'ouvrir la fiche du projet comme avant.",
      },
    ],
  },
  {
    date: "7 septembre 2026",
    items: [
      {
        type: "add",
        title: "⚖️ Grille de décision structurée (fiche Décision)",
        text: "Sur une fiche Décision, un cadre optionnel \"+ Ajouter une grille de décision\" pour trancher un sujet un peu lourd (garder un prestataire, lancer un chantier) plutôt qu'une simple case \"décision + date\" : plusieurs options comparées sur des critères pondérés — 💰 Coût, ⚠️ Risque, ↩️ Réversibilité, ⏰ Urgence par défaut, modifiables et complétables. Chaque option notée de 1 à 5 sur chaque critère fait apparaître une recommandation (🏆 l'option au total pondéré le plus haut) qui se met à jour au fil de la saisie, avant même d'enregistrer. Une fois enregistrée, la grille (et sa recommandation) reste tracée dans l'historique de la décision — retrouvable telle quelle des mois plus tard, plutôt qu'un simple \"Décision modifiée\" muet sur le raisonnement suivi.",
        howTo: "Ouvrir une fiche Décision → \"+ Ajouter une grille de décision\". \"🗳️ Enregistrer la grille\" trace le choix dans l'historique ; \"🗑️ Retirer la grille\" revient à une décision simple sans perdre le reste de la fiche.",
        gain: "Comparer plusieurs options sur les mêmes critères plutôt qu'à l'instinct, et retrouver trois mois plus tard pourquoi une option a été préférée à une autre.",
      },
    ],
  },
  {
    date: "7 septembre 2026",
    items: [
      {
        type: "add",
        title: "⚖️ Répartition de la charge (Équipe)",
        text: "Un nouveau mode \"⚖️ Charge\" dans l'onglet Équipe, à côté de \"👥 Tous\"/\"👔 Mon manager\" : pour chaque collaborateur, le nombre de Suivis actifs qu'il te doit, ceux en retard et ceux stagnants (5 j sans mouvement) — celui qui a la charge la plus légère est mis en avant. Au moment de créer un nouveau Suivi sans avoir déjà choisi la personne, une suggestion apparaît directement dans le formulaire (\"💡 Suggestion : Camille a la charge la plus légère\") plutôt que de devoir aller consulter l'onglet Équipe à part. Les Tâches n'ayant jamais d'attributaire dans cette app, seuls les Suivis \"j'attends quelque chose de lui\" comptent dans la charge — pas ceux où c'est toi qui dois transmettre une information.",
        howTo: "Onglet Équipe → \"⚖️ Charge\". Ou directement dans \"Nouveau suivi\" (sans personne déjà choisie) : bouton \"Choisir\" à côté de la suggestion.",
        gain: "Confier un nouveau sujet à qui a le plus de disponibilité plutôt qu'à la même personne par réflexe ou par défaut.",
      },
    ],
  },
  {
    date: "7 septembre 2026",
    items: [
      {
        type: "add",
        title: "🎯 Priorisation — une matrice qui dit pourquoi, pas juste dans quel ordre",
        text: "Au lieu de ne trier que par échéance, un nouvel onglet \"🎯 Priorisation\" (à côté de Tâches/Projets/Calendrier dans Pilotage) croise trois signaux déjà dans l'app — l'échéance (urgence), le projet marqué \"⭐ prioritaire\" ou non (impact) et la case \"🔴 Bloqué\" de la tâche (blocage) — pour classer toutes les tâches en cours avec, pour chacune, la phrase \"🧭 Pourquoi maintenant\" qui explique le classement. Les poids des trois signaux sont réglables (\"⚙️ Régler les poids\"), avec des valeurs par défaut sinon. Le \"🎯 Focus du jour\" de l'Accueil utilise désormais la même formule pour ses 3 tâches condensées, plutôt que le simple tri par échéance d'avant.",
        howTo: "Onglet Pilotage → 🎯 Priorisation. Pour marquer un projet prioritaire : ouvrir sa fiche → cocher \"⭐ Projet prioritaire\".",
        gain: "Savoir non seulement quoi faire en premier, mais pourquoi — et pouvoir confier à un projet plus de poids dans le classement d'un simple réglage, sans y repenser à chaque tâche.",
      },
      {
        type: "fix",
        title: "🎯 Priorisation : matrice plus compacte, points cliquables, légende des couleurs",
        text: "Trois ajustements sur la matrice urgence × impact : elle prenait plus de hauteur qu'un écran normal (filtre Casquette replié dans un popover \"🔧 Filtrer\", matrice moins haute) ; ses points n'étaient pas cliquables (chacun ouvre désormais la tâche correspondante, comme une ligne du classement complet) ; et les couleurs de la barre à 3 segments du classement n'étaient pas expliquées (légende ajoutée juste au-dessus, avec le poids courant de chaque signal en %).",
      },
      {
        type: "fix",
        title: "🎯 Priorisation : la matrice reste plafonnée à sa taille même sur un grand écran",
        text: "Le correctif précédent réduisait le format du graphique, mais pas sa taille réelle : sur un écran large (grand téléphone en paysage, fenêtre large), la matrice reprend toute la largeur disponible et grandissait d'autant en hauteur, redevenant plus haute que l'écran. Elle a désormais une taille maximale fixe, quelle que soit la largeur de l'écran.",
      },
    ],
  },
  {
    date: "7 septembre 2026",
    items: [
      {
        type: "fix",
        title: "👤 Nom du collaborateur affiché sur un Suivi, partout où il apparaît",
        text: "Un Suivi qui appartient à quelqu'un d'autre que toi n'affichait que son titre, sans dire à qui il était attribué, dès qu'il apparaissait en dehors de la fiche de cette personne — bloc \"👀 Suivis\" d'une fiche Projet, section \"🔗 Lié\" (les 7 fiches), sélecteur \"🔗 Lier une fiche\" et \"🔄 Reprendre où j'en étais\" de l'Accueil. Le nom du collaborateur est désormais préfixé au titre à tous ces endroits (\"Alice Martin — Relancer le fournisseur\"), même format déjà utilisé ailleurs dans l'app (Accueil, Revue hebdomadaire, recherche globale).",
      },
    ],
  },
  {
    date: "7 septembre 2026",
    items: [
      {
        type: "add",
        title: "🗓️ Regrouper les tâches par échéance (vue Tableau)",
        text: "Un nouveau regroupement \"Échéance\" dans le Tableau : 🔴 En retard, Aujourd'hui, Dans la semaine, Dans le mois, Plus tard, Sans date — toujours les 6 groupes, même vides. Le glisser-déposer entre groupes reste réservé à Statut/Projet : il n'y a pas de date cible évidente quand on dépose une tâche dans \"Plus tard\".",
        howTo: "Onglet Pilotage → Tâches → vue 📊 Tableau → \"🔧 Filtrer & trier\" → Regrouper par → Échéance.",
        gain: "Voir d'un coup d'œil ce qui presse sans avoir à trier une longue liste par date.",
      },
      {
        type: "add",
        title: "⏸️ Filtre \"Stagnantes\" et \"🗓️ Sans échéance\" (Tâches)",
        text: "Deux nouveaux filtres cumulables dans \"🔧 Filtrer & trier\" : \"🗓️ Sans échéance\" (ajouté au filtre Échéance existant) isole ce qui n'a pas de date, \"⏸️ Stagnantes\" isole ce qui n'a pas bougé depuis 5 jours (même règle que le bloc \"⏸️ En pause\" de l'Accueil) — deux filtres séparés, une tâche peut être stagnante ET sans échéance, ou l'un sans l'autre.",
        howTo: "Onglet Pilotage → Tâches → \"🔧 Filtrer & trier\".",
        gain: "Repérer en un clic ce qui risque de se perdre : ni date pour le rattraper, ni mouvement depuis un moment.",
      },
      {
        type: "fix",
        title: "🖥️ Pilotage prend toute la largeur en mode web (Projets et Calendrier)",
        text: "Sur grand écran, Tâches prenait déjà toute la largeur disponible ; Projets et Calendrier restaient resserrés au centre, avec un décalage visible en changeant d'onglet. Les trois se comportent maintenant à l'identique.",
      },
      {
        type: "add",
        title: "🗂️ Vue \"Par catégorie\" (Projets)",
        text: "Une nouvelle vue dans l'onglet Projets, à côté de \"📋 Liste\" : un bloc par catégorie (\"Sans catégorie\" en dernier), réparti en 3 colonnes en mode web et empilé en mobile. Glisser un projet d'un bloc à l'autre change sa catégorie immédiatement, sans confirmation. Une catégorie qui n'a plus aucun projet après le filtre Statut disparaît, plutôt que de s'afficher vide.",
        howTo: "Onglet Projets → \"🗂️ Par catégorie\".",
        gain: "Voir la répartition des projets par catégorie d'un coup d'œil, et réorganiser en glissant plutôt qu'en rouvrant chaque fiche.",
      },
    ],
  },
  {
    date: "7 septembre 2026",
    items: [
      {
        type: "fix",
        title: "👀 Cliquer sur un Suivi ouvre le Suivi, pas la personne",
        text: "Depuis \"⚠️ Ça a besoin de toi\", le mode Focus, \"📣 Relances dues\" et la Revue hebdomadaire, cliquer sur un Suivi (\"à transmettre\" ou \"en attente\") ouvrait la fiche du collaborateur au lieu du Suivi lui-même — il fallait ensuite le retrouver dans sa liste. Corrigé : ces quatre endroits ouvrent maintenant directement le Suivi concerné, comme le fait déjà la recherche globale.",
      },
    ],
  },
  {
    date: "7 septembre 2026",
    items: [
      {
        type: "remove",
        title: "📄 Retrait du bouton \"Exporter\" (Tâche et Suivi)",
        text: "L'export en image PNG d'une Tâche ou d'un Suivi (ajouté fin août) ne rendait pas service : sur une fiche sans description ni sous-étapes, l'image produite était quasiment vide et n'apportait rien par rapport à la fiche elle-même. Retiré des deux fiches, sans remplacement pour l'instant.",
      },
    ],
  },
  {
    date: "7 septembre 2026",
    items: [
      {
        type: "add",
        title: "🤖 Lier un prompt à une tâche",
        text: "Une section \"🤖 Prompts\" dans l'onglet Activité d'une fiche Tâche, symétrique de \"📎 Ressources\" — garde le bon prompt sous la main pendant qu'on travaille le sujet.",
        howTo: "Ouvre une tâche → onglet Activité → \"🤖 Prompts\" → lie un prompt existant ou crée-en un directement depuis là.",
        gain: "Plus besoin d'aller chercher le prompt dans sa bibliothèque à chaque fois : il est copiable en un clic directement depuis la tâche.",
      },
      {
        type: "add",
        title: "🗐 Dupliquer une tâche",
        text: "Reprend le titre (avec la date du jour, ajustable), la description, le critère de clôture, le projet — avec le choix de garder aussi les sous-étapes (non cochées), les ressources et les prompts liés. Toujours en ⚪ À faire, sans échéance, avec un lien automatique vers la tâche d'origine.",
        howTo: "Depuis la fiche Tâche (bouton 🗐 Dupliquer) ou directement depuis un résultat de recherche.",
        gain: "Un sujet qui revient régulièrement se relance en quelques secondes, sans tout retaper.",
      },
      {
        type: "change",
        title: "🧭 Navigation Pilotage unifiée",
        text: "Tâches/Projets/Calendrier partagent maintenant le même repère visuel (rail segmenté) et la même forme d'écran : le type de vue d'un côté, un seul menu \"🔧 Filtrer & trier\" de l'autre — Tâches passe de 3 lignes de contrôle à 1, Projets de 4 à 1.",
        gain: "Fini le bandeau qui \"bouge\" en changeant d'onglet, et la confusion entre type de vue (Trello/Tableau, Mois/Semaine) et filtres.",
      },
    ],
  },
  {
    date: "7 septembre 2026",
    items: [
      {
        type: "add",
        title: "🎯 Mode d'Accueil \"Focus\"",
        text: "Une seule chose à la fois sur l'Accueil, triée par urgence (retard, échéance proche, en pause) — au lieu de plusieurs sections empilées à balayer.",
        howTo: "⚙️ Personnaliser l'accueil (en haut de l'Accueil) → Mode d'accueil → Focus.",
        gain: "Moins de charge visuelle au quotidien, sans rien perdre de vue : \"Tout voir\" ramène la liste complète et le reste de l'Accueil en un clic. Réglage propre à ton compte, réversible à tout moment.",
      },
      {
        type: "add",
        title: "🆕 Cette page t'avertit désormais toute seule",
        text: "Une pastille apparaît sur l'onglet ☰ Plus dès qu'il y a du nouveau ici, avec un repère \"Nouveau\" sur la ligne Nouveautés une fois dans l'écran Plus.",
        howTo: "Rien à faire — regarde l'onglet ☰ Plus. La pastille disparaît une fois cette page ouverte.",
        gain: "Plus besoin de penser à revenir vérifier : le signal vient à toi.",
      },
    ],
  },
  {
    date: "7 septembre 2026",
    items: [
      {
        type: "change",
        title: "🗂️ Fiche Projet ramenée à 3 onglets",
        text: "\"Sous-parties\" rejoint l'onglet Contenu (avec Tâches/Suivis/Réunions/Décisions) plutôt que de garder son propre onglet — le système à trois états et ses notes par sous-partie n'ont pas changé, seul l'emplacement change.",
        gain: "Une fiche Projet aussi simple à balayer que la fiche Tâche.",
      },
    ],
  },
  {
    date: "6-7 septembre 2026",
    items: [
      {
        type: "add",
        title: "📊 Mode superadmin : activité des comptes",
        text: "Réservé au compte administrateur : quels écrans sont consultés, quand, par quel compte, plus les connexions — depuis 🔧 Administration.",
        howTo: "🔧 Administration → \"📊 Voir l'activité des comptes\".",
      },
      {
        type: "add",
        title: "ℹ️ Information sur le suivi d'usage",
        text: "Chaque compte voit, une seule fois à sa prochaine connexion, un bandeau expliquant que ses écrans consultés et ses connexions sont enregistrés (jamais le détail de ce qu'il saisit), et que seul l'administrateur peut les consulter.",
      },
    ],
  },
  {
    date: "6 septembre 2026",
    items: [
      {
        type: "add",
        title: "✏️ Modifier le texte d'une capture Inbox sans la qualifier",
        text: "Corriger une coquille de frappe ou de dictée n'oblige plus à choisir ce que la capture devient.",
        howTo: "Dans l'Inbox, bouton \"✏️\" sur une capture en attente.",
        gain: "Une capture reste rapide et sans engagement même quand il faut la corriger.",
      },
    ],
  },
  {
    date: "6 septembre 2026",
    items: [
      {
        type: "change",
        title: "🗂️ Fiche Projet et fiche Collaborateur réorganisées en onglets",
        text: "Même principe que la fiche Tâche (onglets Détails/Contenu/Activité pour un Projet, Suivis/Objectifs/Notes & repères/Activité pour un Collaborateur), avec le compte affiché directement dans le libellé de l'onglet.",
      },
      {
        type: "add",
        title: "🧭 Revue hebdomadaire enrichie",
        text: "Nouvelle catégorie \"📅 Cette semaine, hors équipe\" ; chaque rubrique datée est désormais triée par date la plus proche, avec le statut affiché sur la ligne.",
      },
      {
        type: "add",
        title: "🎯 Rattacher des Projets/Suivis à un Objectif",
        text: "Un Objectif peut désormais avoir sa propre section \"🔗 Lié\" pour y attacher des Projets/Suivis existants ou en créer un nouveau déjà lié.",
      },
      {
        type: "fix",
        title: "🐛 Bouton Enregistrer invisible sur iPhone",
        text: "Sur les fiches Tâche/Projet/Personne/Suivi, le bouton pouvait sortir de l'écran sur iPhone — corrigé, les actions de bas de fiche sont maintenant des boutons icône compacts.",
      },
    ],
  },
  {
    date: "3 septembre 2026",
    items: [
      {
        type: "change",
        title: "📱 Barre de navigation resserrée à 5 icônes",
        text: "Accueil, Inbox, Pilotage, Équipe, ☰ Plus — Ressources, Prompts, Guide, Nouveautés et Mémoire & TDAH rejoignent ☰ Plus.",
        gain: "Moins d'icônes à balayer pour trouver son chemin, standard des barres de navigation mobiles.",
      },
      {
        type: "change",
        title: "🗂️ Fiche Tâche réorganisée en onglets",
        text: "En-tête fixe (Titre/Statut/Échéance) puis onglets Détails/Sous-étapes/Activité, plutôt qu'un empilement plat de onze zones.",
      },
      {
        type: "fix",
        title: "🐛 Panneau \"🔧 Filtrer\" du Pilotage affiché coupé",
        text: "Le panneau qui s'ouvre depuis \"🔧 Filtrer\" pouvait apparaître tronqué en bas — corrigé.",
      },
    ],
  },
  {
    date: "3 septembre 2026",
    items: [
      {
        type: "add",
        title: "🔗 Lien de partage sur chaque fiche",
        text: "Tâche, Projet, Personne, Suivi, Ressource, Réunion, Décision, Information/Idée ont chacune leur bouton \"🔗 Copier le lien\".",
        howTo: "Bouton \"🔗 Copier le lien\" en bas de la fiche, puis colle-le où tu veux (Teams, un e-mail...).",
        gain: "Un clic sur ce lien rouvre directement la bonne fiche, sans avoir à la rechercher.",
      },
      {
        type: "add",
        title: "🔴 Pastille de comptage sur l'onglet Inbox",
        text: "Le nombre de captures pas encore qualifiées apparaît directement sur l'icône Inbox de la barre du bas.",
      },
    ],
  },
  {
    date: "2-3 septembre 2026",
    items: [
      {
        type: "fix",
        title: "🐛 Un chiffre tapé dans un champ pouvait requalifier une ancienne capture",
        text: "Taper certains chiffres n'importe où dans l'app pouvait, en arrière-plan, requalifier silencieusement un ancien élément déjà traité de l'Inbox — corrigé.",
      },
      {
        type: "add",
        title: "🔁 \"Encore un suivi ?\" généralisé",
        text: "Proposé après toute création de Suivi, quel que soit le point d'entrée — le projet, le sens et les dates du Suivi précédent sont repris automatiquement.",
      },
      {
        type: "add",
        title: "📄 Export \"vue d'ensemble\" en image",
        text: "Une Tâche ou un Suivi peuvent être exportés en une image PNG prête à coller ailleurs (compte-rendu, ticket).",
        howTo: "Sur la fiche Tâche ou Suivi, bouton \"📄 Exporter\".",
      },
      {
        type: "add",
        title: "✍️ Capture multi-lignes et Suivi dupliqué vers plusieurs personnes",
        text: "Coller plusieurs lignes dans Capturer crée autant de captures Inbox séparées ; un Suivi peut être créé identique pour plusieurs personnes à la fois.",
        howTo: "Capturer : colle plusieurs lignes, une par idée. Création d'un Suivi (hors fiche Personne) : bouton \"👥 Assigner le même suivi à plusieurs personnes\".",
      },
      {
        type: "add",
        title: "👥 Accès pour des comptes choisis + 🔧 Console d'administration",
        text: "D'autres personnes précises peuvent désormais utiliser Pilotage avec leur propre espace, indépendant du tien. Le bouton 🔧 Administration (visible pour toi seul) centralise les liens vers les applications tierces (Firebase, Cloudflare, GitHub) et leurs tutos.",
      },
      {
        type: "add",
        title: "🙈 Fenêtre privée avant \"Préparer mon point\"",
        text: "Choisis ce que tu ne veux pas montrer avant de partager cet écran en visio avec un managé — mémorisé pour cette personne.",
        howTo: "Bouton \"🗒️ Préparer mon point\" sur une fiche Personne : coche ce qui doit rester masqué, ferme la fenêtre pour lancer le point filtré.",
      },
    ],
  },
  {
    date: "2 septembre 2026",
    items: [
      {
        type: "add",
        title: "☑️ Description et sous-étapes sur un Suivi",
        text: "Un Suivi peut désormais porter une description libre et une petite checklist, comme une Tâche.",
      },
    ],
  },
  {
    date: "2 septembre 2026",
    items: [
      {
        type: "add",
        title: "⌨️ Raccourci clavier personnalisé sur une Personne ou un Projet",
        text: "Choisis une touche, la combinaison rouvre directement cette fiche depuis n'importe quel écran.",
        howTo: "Sur une fiche Personne ou Projet, bouton \"⌨️ Assigner un raccourci\".",
      },
      {
        type: "add",
        title: "🎯 Mes objectifs",
        text: "Une ligne directrice personnelle, toujours au même endroit, à relire quand tu perds le fil.",
        howTo: "Depuis l'Accueil, bouton \"🎯 Mes objectifs\".",
      },
    ],
  },
  {
    date: "1er septembre 2026",
    items: [
      { title: "🔄 Reprendre où j'en étais", text: "Sur l'Accueil : les dernières fiches consultées, tous types confondus (Tâche, Suivi, Projet, Ressource, Information/Idée) — un clic pour rouvrir directement la bonne." },
      { title: "⏸️ En pause depuis un moment", text: "Sur l'Accueil : les Tâches en cours/en attente non retouchées depuis 5 jours — différent du retard, ça repère ce qui a été commencé puis oublié." },
      { title: "🔔 Alerte de démarrage (optionnelle)", text: "Une notification à l'ouverture de l'app s'il y a du retard ou des tâches en pause, une fois par jour maximum — à activer depuis le bandeau proposé sur l'Accueil. Fonctionne uniquement app ouverte, pas en tâche de fond." },
    ],
  },
  {
    date: "1er septembre 2026",
    items: [
      { title: "🎯 Focus du jour", text: "Sur l'Accueil : 3 tâches urgentes proposées automatiquement, modifiables d'un clic — remplace l'ancienne tuile « Aujourd'hui »." },
      { title: "☑️ Sous-étapes sur une Tâche", text: "Sur une fiche Tâche : une petite checklist libre pour découper une tâche en étapes très courtes, avec un compteur visible sur la carte Kanban." },
      { title: "🎉 Retour positif à la clôture", text: "Un petit message + une animation quand tu termines une Tâche, quel que soit le chemin (glisser-déposer, boutons, fiche détail)." },
    ],
  },
  {
    date: "1er septembre 2026",
    items: [
      { title: "🗓️ Créer une réunion depuis une Tâche ou un Suivi", text: "Un titre de réunion composé automatiquement, copiable en un clic, et un fichier .ics téléchargeable prêt pour Outlook — avec un lien de retour direct vers la fiche d'origine." },
    ],
  },
  {
    date: "1er septembre 2026",
    items: [
      { title: "🔎 Recherche dans le Guide", text: "Le Guide (❓ Aide → 📖 Ouvrir le guide complet) se cherche maintenant comme la loupe de l'Accueil." },
      { title: "🧩 Fonctions transverses (dans le Guide)", text: "Une nouvelle section qui explique canevas, revue hebdomadaire, journal de notes, aide à la demande, recettes, suggestions et filtre par casquette." },
    ],
  },
  {
    date: "1er septembre 2026",
    items: [
      { title: "🗒️ Journal de notes horodaté", text: "Sur presque toutes les fiches : ajoute une note, la date et l'heure se posent automatiquement — jamais d'édition, seulement des ajouts, comme l'Historique." },
      { title: "ⓘ Aide à la demande", text: "Un petit bouton ⓘ toujours disponible sur le canevas et la Revue hebdomadaire, pour un rappel du fonctionnement sans jamais fermer la fiche en cours." },
      { title: "Sens sur un Suivi créé depuis l'Inbox", text: "Qualifier un sujet de l'Inbox en Suivi demande maintenant directement le Sens (j'attends / je dois transmettre), comme partout ailleurs." },
    ],
  },
  {
    date: "31 août 2026",
    items: [
      { title: "🧩 Recettes de démarrage & suggestions de prochaine étape", text: "Des enchaînements tout prêts (« Nouveau projet transverse », etc.) et des propositions de créer la Tâche ou le Suivi logique après un canevas ou une Décision." },
      { title: "🗂️ Rubriques de l'Accueil repliables + auto-archivage à 15 jours", text: "Chaque bloc de l'Accueil peut se replier ; les Informations/Idées et « Récemment » de plus de 15 jours s'archivent tout seuls." },
    ],
  },
  {
    date: "31 août 2026",
    items: [
      { title: "🎭 Filtre par casquette", text: "Chips Toutes / Toi / Équipe / Projets / Manager / CSE sur l'Accueil et Pilotage, déduites automatiquement du projet ou de la personne concernée." },
      { title: "⏰ Rappel de rythme & aide au premier usage", text: "Un signal doux si l'app n'a pas été ouverte depuis un moment, et un bandeau d'explication la première fois sur les écrans clés." },
      { title: "⚙️ Accueil personnalisable", text: "Chaque section de l'Accueil peut être masquée ou réaffichée, via « ⚙️ Personnaliser l'accueil »." },
    ],
  },
  {
    date: "31 août 2026",
    items: [
      { title: "📖 Guide utilisateur intégré, hors ligne", text: "Un vrai guide dans l'app (❓ Aide → 📖 Ouvrir le guide complet), organisé autour de tes cas d'usage réels — consultable même sans connexion." },
    ],
  },
  {
    date: "Fin août 2026",
    items: [
      { title: "🏷️ Catégories de projet & sous-parties", text: "Un projet peut avoir une catégorie (icône assignée automatiquement) et des sous-parties suivies par l'équipe." },
      { title: "🎯 Objectifs & préparation EADP", text: "Des objectifs par personne, et un écran « Préparer l'EADP » qui rassemble notables, objectifs et un résumé copiable sur une période." },
      { title: "🤖 Bibliothèque de prompts IA", text: "Un onglet pour garder et retrouver tes prompts réutilisables, copiables en un clic." },
      { title: "…et une grosse passe d'ergonomie", text: "Kanban plein écran, historique repliable, boutons toujours visibles en bas de fiche, click-through partout dans les Projets." },
    ],
  },
];

// Total d'entrées tous groupes confondus — sert de référence à preferencesApi.seenWhatsNewCount
// (voir js/components/whatsNewBadge.js) pour savoir combien sont nouvelles pour ce compte. Un
// simple total plutôt qu'un identifiant par entrée : WHATS_NEW ne grandit jamais que par le haut
// (nouvelles entrées ajoutées en tête), donc la différence de compte suffit.
export const WHATS_NEW_TOTAL_COUNT = WHATS_NEW.reduce((sum, group) => sum + group.items.length, 0);

export function renderWhatsNew(container) {
  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>🆕 Nouveautés</h1>
        <!-- USE-UX-027 (LOT 9, "Guide et Nouveautés aux rôles proches, distinction non explicite") :
             sous-titre explicite retenu tel quel par l'audit ("Comment ça marche" / "Ce qui a
             changé") pour que les deux écrans se distinguent sans avoir à les ouvrir. -->
        <div class="subtitle">Ce qui a changé : ce qui a été ajouté à l'app, du plus récent au plus ancien</div>
      </div>
      <a href="#/dashboard" class="btn btn-secondary btn-sm">← Retour</a>
    </div>
    <div class="view" id="whatsnew-body"></div>
  `;

  const body = container.querySelector("#whatsnew-body");
  body.innerHTML = `
    <p class="item-meta" style="font-size:var(--font-size-md);margin-bottom:16px;">
      Pour retrouver facilement ce qui a changé, sans avoir à s'en souvenir. Fonctionne aussi
      hors connexion, comme le Guide.
    </p>
    ${WHATS_NEW.map(
      (group, i) => `
      <details id="whatsnew-group-${i}" ${i === 0 ? "open" : ""}>
        <summary class="section-title" style="cursor:pointer;">${escapeHtml(group.date)}</summary>
        <div class="card" style="margin-top:8px;margin-bottom:16px;">
          ${group.items
            .map(
              (item, j) => `
            <div class="item-row" style="display:block;${j === group.items.length - 1 ? "border-bottom:none;" : ""}">
              <div class="item-main">
                <div class="item-title">
                  ${item.type ? `<span class="badge" style="margin-right:6px;">${escapeHtml(WHATS_NEW_TYPE_LABELS[item.type] || WHATS_NEW_TYPE_LABELS.add)}</span>` : ""}
                  ${escapeHtml(item.title)}
                </div>
                <div class="item-meta">${escapeHtml(item.text)}</div>
                ${item.howTo ? `<div class="item-meta" style="margin-top:4px;"><strong>Comment l'utiliser :</strong> ${escapeHtml(item.howTo)}</div>` : ""}
                ${item.gain ? `<div class="item-meta" style="margin-top:2px;"><strong>Le gain :</strong> ${escapeHtml(item.gain)}</div>` : ""}
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      </details>
    `
    ).join("")}
  `;

  // Marque toutes les entrées comme vues dès l'ouverture de cette page — la pastille de
  // js/components/whatsNewBadge.js se remet à jour toute seule (abonnée à `preferences`).
  // Jamais bloquant : un souci réseau ne doit jamais empêcher de lire cette page.
  preferencesApi.setSeenWhatsNewCount(WHATS_NEW_TOTAL_COUNT).catch(() => {});
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
