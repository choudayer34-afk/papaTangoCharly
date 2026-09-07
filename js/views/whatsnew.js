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
        <div class="subtitle">Ce qui a été ajouté à l'app, du plus récent au plus ancien</div>
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
