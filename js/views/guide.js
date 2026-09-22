// Guide utilisateur — intégré à l'app (retour de Charles-Henri : "je veux pas que le guide
// soit chez toi mais accessible même hors ligne via l'appli"). Contrairement à la version
// précédente (une page hébergée hors code), ce guide vit dans le code de l'app : il est donc
// mis en cache par le service worker comme n'importe quel autre écran (voir sw.js) et reste
// consultable sans connexion, avec la palette/typo déjà chargées (aucune police externe,
// aucune requête réseau) — condition nécessaire pour qu'il fonctionne vraiment hors ligne.
//
// Volontairement hors de ROUTES (js/app.js) : une page de référence consultée ponctuellement
// depuis le bouton ❓ Aide, pas un onzième onglet permanent dans la navigation du bas.

import { closeModal } from "../components/modal.js";

// Liens contextuels `.guide-link` (voir `guideLinkHtml` plus bas) : ils peuvent être cliqués
// depuis N'IMPORTE QUELLE modale ouverte ailleurs dans l'app (Mes objectifs, fiche Personne,
// Management, création de Projet...). Sans ceci, la modale resterait affichée par-dessus le
// Guide fraîchement affiché en arrière-plan — son overlay vit dans document.body, indépendant
// du contenu de la route (js/components/modal.js), et rien dans js/app.js ne ferme les modales
// au changement de route. Un seul écouteur délégué, posé une fois à l'évaluation de ce module
// (importé par tous les écrans qui utilisent guideLinkHtml) plutôt que répété à chaque appelant.
document.addEventListener("click", (e) => {
  if (e.target.closest?.(".guide-link")) closeModal();
});

const HATS = [
  { id: "hat-toi", icon: "🧑‍💻", label: "Toi" },
  { id: "hat-equipe", icon: "👥", label: "Ton équipe" },
  { id: "hat-projets", icon: "📦", label: "Tes projets" },
  { id: "hat-manager", icon: "👔", label: "Ton manager" },
  { id: "hat-cse", icon: "🏛️", label: "CSE" },
];

const COMPASS = [
  { sit: "Une tâche à faire pour une échéance", hat: "Toi", target: "hat-toi", detail: "Capture → Tâche avec échéance → Kanban" },
  { sit: "Un mail de demande à traiter", hat: "Toi", target: "hat-toi", detail: "Capture rapide → Inbox → qualifier" },
  { sit: "Un collègue te demande un truc sur son projet", hat: "Toi", target: "hat-toi", detail: "Capture → Tâche, rattachée à son projet si possible" },
  { sit: "Ton chef te donne une info", hat: "Ton manager", target: "hat-manager", detail: "Information conservée, ou Décision si ça engage quelque chose" },
  { sit: "Un gros projet avec la marketing qui doit livrer des choses", hat: "Tes projets", target: "hat-projets", detail: "Projet + Suivi « waiting_on » sur la personne marketing" },
  { sit: "Faire le point avec un développeur", hat: "Ton équipe", target: "hat-equipe", detail: "Fiche personne → Préparer mon point" },
  { sit: "Préparer l'EADP de quelqu'un", hat: "Ton équipe", target: "hat-equipe", detail: "Notable + Objectifs → Préparer l'EADP" },
  { sit: "Savoir ce que tu dois faire aujourd'hui / cette semaine", hat: "Toi", target: "hat-toi", detail: "Dashboard (Aujourd'hui, 7 jours) + Calendrier" },
  { sit: "Préparer une réunion ou un projet CSE", hat: "CSE", target: "hat-cse", detail: "Catégorie « CSE » sur Projet/Réunion" },
];

// "🗓️ Selon le moment" (retour de Charles-Henri, 13/09/2026 : "les bonnes pratiques et les
// périodes type — préparer EADP, préparer suivi objectifs, préparer suivi, savoir quoi faire,
// suivre un projet et par où commencer") — même principe que LA BOUSSOLE ci-dessus, mais
// organisé par CADENCE (quand le faire) plutôt que par situation ponctuelle (quoi faire face à
// un événement) : les deux index pointent vers les mêmes fiches de détail plutôt que de
// dupliquer le contenu. `target` doit correspondre à un id posé sur une <details> de casquette
// (ouverte automatiquement) ou directement sur un cas d'usage précis (juste scrollé jusqu'à
// lui, sa <details> parente étant alors ouverte par `openTopic`).
const RITUALS = [
  { period: "Chaque matin (2 min)", sit: "Savoir ce qu'il y a à faire aujourd'hui", target: "hat-toi", detail: "Accueil : tuiles 🔴 En retard et 📅 Aujourd'hui, puis « 7 jours » si besoin." },
  { period: "Chaque semaine", sit: "Ne rien laisser filer, remettre à plat", target: "guide-retard", detail: "Revue hebdomadaire guidée (bouton 🧭 sur l'Accueil) : Inbox, retards, suivis à contrôler, projets sans action." },
  { period: "Avant un 1:1 avec un collaborateur", sit: "Préparer un point individuel", target: "usecase-prep-point", detail: "Sa fiche → « 🗒️ Préparer mon point »." },
  { period: "Avant ton propre point avec ton manager", sit: "Arriver avec un ordre du jour déjà prêt", target: "usecase-point-manager", detail: "Filtre « 👔 Mon manager » (onglet Équipe) → bouton dédié." },
  { period: "En fin de campagne", sit: "Préparer l'EADP d'un collaborateur", target: "usecase-eadp", detail: "Sa fiche → « 📋 Préparer l'EADP », après avoir noté du 👍/👎 et des objectifs au fil de l'année." },
  { period: "Régulièrement, sur la durée", sit: "Suivre l'avancement de tes propres objectifs", target: "usecase-mes-objectifs", detail: "Accueil → « 🎯 Mes objectifs » : statut, points de suivi datés, éléments liés." },
  { period: "Au lancement d'un projet", sit: "Suivre un projet, par où commencer", target: "usecase-nouveau-projet", detail: "Onglet Projets → + Projet, catégorie, puis sous-parties si besoin." },
];

// Sommaire (retour de Charles-Henri, 13/09/2026 : "voir les différentes rubriques du guide
// organisé") — un simple index de navigation, volontairement affiché EN DEHORS de
// `#guide-searchable` : il reste visible et cliquable même pendant une recherche, plutôt que
// d'être filtré comme le reste (ce n'est pas du contenu à chercher dedans, juste un plan).
const TOC = [
  ["🗓️ Selon le moment", "guide-rituals-title"],
  ["🧭 La boussole", "guide-compass-title"],
  ["✅ Tâche ou Suivi ?", "guide-taskfollow-title"],
  ["🧑‍💻 Toi", "hat-toi"],
  ["👥 Ton équipe", "hat-equipe"],
  ["📦 Tes projets", "hat-projets"],
  ["👔 Ton manager", "hat-manager"],
  ["🏛️ CSE", "hat-cse"],
  ["📑 Chaque onglet", "guide-tabs-title"],
  ["🧩 Fonctions transverses", "guide-topics-title"],
  ["🔴 Il y a du retard partout", "guide-retard"],
];

// Lien vers une rubrique précise du guide depuis n'importe quel autre écran (retour de
// Charles-Henri, 13/09/2026 : "des liens vers le guide pour indiquer à quoi ça peut servir" —
// mais explicitement PAS partout, seulement là où un doute est probable). Réutilise le même
// principe de lien profond que js/services/deeplink.js (format `#/route?param=...`), en plus
// simple : ici la cible est une rubrique du guide, pas une fiche à résoudre via resolveRef,
// donc pas besoin de passer par ce module. `renderGuide` lit ce paramètre lui-même au chargement
// (même pattern que js/views/prepMask.js) et ouvre/scrolle jusqu'à la bonne rubrique.
export function guideTopicHref(topicId) {
  return `#/guide?topic=${encodeURIComponent(topicId)}`;
}

export function guideLinkHtml(topicId, label = "📖 Voir dans le guide") {
  return `<a href="${guideTopicHref(topicId)}" class="guide-link">${label}</a>`;
}

// 8 → 5 icônes directes depuis la vague 24 (retour de Charles-Henri, sur la base de Material
// Design/Apple HIG : 3-5 destinations recommandées en barre du bas) — Projets et Calendrier
// deviennent des sous-onglets à l'intérieur de Pilotage (mêmes routes, juste une autre
// présentation) ; Ressources, Prompts, Guide, Nouveautés et Mémoire & TDAH rejoignent le
// nouvel onglet ☰ Plus. Voir claude/vague-24-declins-fiches-navigation.md pour le détail.
const TABS_REF = [
  ["🏠 Accueil", "Vue du jour : retards, échéances, projets, informations conservées.", "Tous les matins, en 2 minutes."],
  ["📥 Inbox", "Sas d'attente de tout ce que tu as capturé mais pas encore qualifié.", "Une fois par jour, ou pendant la Revue hebdomadaire."],
  ["📋 Pilotage", "Trois sous-onglets en haut de l'écran : Tâches (ton Kanban, triées par échéance), Projets (avancement, sous-parties, tout ce qui y est rattaché) et Calendrier (vue mois/semaine). Un seul onglet du bas pour les trois.", "Pour avancer sur ta liste du jour, faire un point d'étape projet, ou visualiser une période."],
  ["👥 Équipe", "Une fiche par personne : Suivis (attentes/transmissions), Objectifs, historique. Le filtre « 👔 Mon manager » y bascule vers ce que TOI tu dois remonter à ton propre manager.", "Avant un 1:1, pour noter un engagement pris à la volée, ou avant ton propre point avec ton manager."],
  ["☰ Plus", "Tout ce qui ne rentre pas dans les 4 autres onglets : Ressources (liens/emplacements sans duplication), Prompts IA (copiables en un clic), Guide, Nouveautés et Mémoire & TDAH.", "Quand tu cherches un lien déjà enregistré, un prompt réutilisable, ou une pause mémoire."],
];

// Mécanismes transverses (retour de Charles-Henri, 01/09/2026 : pouvoir chercher "comment
// utiliser les canevas, à quoi ça sert" et retrouver une vraie réponse) — les fonctions qui ne
// vivent pas dans un seul écran/casquette, et qui n'avaient donc pas leur place naturelle
// ailleurs dans ce guide. Ce guide restant un instantané non régénéré automatiquement (voir
// doc de suivi), ces entrées demandent une mise à jour manuelle si le comportement change.
const TOPICS_REF = [
  {
    title: "📋 Canevas piloté par données",
    text: "Une checklist toute prête pour une situation récurrente (Réunion, Point collaborateur, Projet, Communication) — enregistrée comme un modèle réutilisable, pas codée en dur pour chaque écran. Une Tâche/Réunion/Projet reçoit son canevas à la création ; tu coches les étapes au fur et à mesure, la date de la coche reste affichée. Certaines étapes précises (« Créer les actions », « Planifier les suivis », « Actions ») proposent aussitôt de créer la Tâche ou le Suivi qui suit. Il n'y a pas encore d'éditeur pour créer ses propres canevas — ces 4 modèles sont fixes pour l'instant. Un petit ⓘ à côté du titre du canevas redonne cette explication directement sur la fiche.",
  },
  {
    title: "🧭 Revue hebdomadaire guidée",
    text: "Bouton 🧭 sur l'Accueil : une seule modale qui recompose en une fois 7 catégories dispersées ailleurs — Inbox non qualifiée, Retards, Suivis à contrôler, Projets sans prochaine action, Équipe cette semaine, Management, Ressources non classées. Chaque ligne ouvre la vraie fiche pour la traiter. Rien n'est mémorisé comme « revue en cours » : chaque ouverture recalcule tout depuis les données actuelles.",
  },
  {
    title: "🗒️ Journal de notes horodaté",
    text: "Un bloc « Notes » sur presque toutes les fiches (Tâche, Suivi, Projet — y compris chaque sous-partie individuellement —, Réunion, Décision, Ressource, Personne, Information) : ajoute une note, la date et l'heure se posent automatiquement. Additif uniquement, comme l'Historique — pas d'édition ni de suppression d'une note existante ; si tu te trompes, ajoute une note suivante. Distinct du champ « Notes » de contexte sur Personne/Réunion, qui reste inchangé.",
  },
  {
    title: "ⓘ Aide à la demande",
    text: "Un petit bouton ⓘ toujours disponible (contrairement au bandeau d'aide au premier usage, qui disparaît pour toujours une fois fermé) — pour l'instant sur le canevas et sur la Revue hebdomadaire. Clique pour dérouler une explication courte, sans jamais fermer la fiche en cours.",
  },
  {
    title: "🧩 Recettes de démarrage",
    text: "Bouton « 🧩 Recettes » sur l'Accueil : enchaîne automatiquement des formulaires de création déjà existants pour deux cas récurrents — « Nouveau projet transverse » (projet puis suivi lié), « Plusieurs suivis pour la même personne » (suivis en série sans repasser par sa fiche à chaque fois).",
  },
  {
    title: "💡 Suggestions de prochaine étape",
    text: "Après avoir coché « Créer les actions »/« Planifier les suivis »/« Actions » sur un canevas, ou après avoir enregistré une Décision, une invite — jamais automatique, toujours refusable via « Plus tard » — propose de créer tout de suite la Tâche ou le Suivi logiquement lié.",
  },
  {
    title: "🎭 Filtre par casquette",
    text: "Chips Toutes / Toi / Équipe / Projets / Manager / CSE sur l'Accueil et Pilotage. La casquette n'est jamais saisie à la main : déduite du projet lié (catégorie contenant CSE → CSE, sinon → Projets) ou, pour un Suivi, du type de la personne visée (manager → Manager, collaborateur → Équipe).",
  },
  {
    title: "🗂️ Où classer / retrouver quelque chose ?",
    text: "Pas de vrais dossiers dans Pilotage — le classement se fait par type d'élément et par rattachement, pas par un emplacement à choisir. Un lien, un fichier ou un document externe → une Ressource (le type est détecté automatiquement), rattachée au Projet et/ou à la Tâche concernés plutôt que rangée à part. Une information à garder sans action à mener → Information depuis l'Inbox (🧠 Garder). Un sujet qui concerne une personne (tu attends quelque chose d'elle, ou tu dois lui dire quelque chose) → un Suivi sur sa fiche, jamais une Tâche. La catégorie d'un Projet (ex. Modernisation, CSE) sert de repère transverse — garde toujours la même orthographe d'une fois sur l'autre, sinon deux catégories presque identiques cohabitent sans se regrouper. Pour retrouver quelque chose ensuite, trois réflexes valent mieux qu'un rangement précis à retenir : la loupe 🔎 (recherche dans tout, tous types confondus), la fiche du Projet concerné (tout ce qui y est rattaché apparaît dessus), et « 🔄 Reprendre où j'en étais » sur l'Accueil pour ce que tu as consulté récemment.",
  },
  {
    title: "⌨️ Raccourcis clavier",
    text: "Ctrl+K ouvre la recherche globale, curseur posé directement dans le champ. Alt+N ouvre Capturer depuis n'importe quel écran. Alt+1 à Alt+5 vont directement sur l'onglet à cette position dans la barre du bas (1 = Accueil, 2 = Inbox, 3 = Pilotage, 4 = Équipe, 5 = Plus) — sans effet tant qu'une fiche est ouverte, pour ne jamais changer d'écran sous elle par erreur. Depuis la vague 24 (barre resserrée à 5 icônes), Projets/Calendrier et Ressources/Prompts/Guide/Nouveautés/Mémoire n'ont plus de raccourci dédié : ils se rejoignent au clic, depuis Pilotage ou depuis Plus. Ctrl+Entrée déclenche le bouton principal (Enregistrer, Créer...) de la fiche ouverte. Ctrl+Z rejoue le bouton « Annuler » du dernier toast affiché (ex. après un glisser-déposer de date sur le Calendrier) tant qu'il est encore visible — dans un champ de texte, Ctrl+Z reste l'annulation native du navigateur. Dans la fenêtre « Traiter » d'une capture Inbox : 1/2/3 choisissent directement Action/Suivi/Information, A déplie « Autre ». Dans la recherche : Alt+1 à Alt+8 basculent le filtre de type (Tâche, Projet, Personne, Suivi, Ressource, Réunion, Décision, Information) au lieu de changer d'onglet. Enfin, chaque fiche Personne et Projet propose un bouton « ⌨️ Assigner un raccourci » : choisis n'importe quelle lettre ou chiffre, la combinaison Ctrl+Alt+cette touche rouvrira directement cette fiche depuis n'importe quel écran — un espace de raccourcis entièrement séparé des précédents (jamais Ctrl+Alt sur les raccourcis fixes), donc aucune collision possible entre les deux. Ctrl+N et Ctrl+1…9, souvent utilisés ailleurs pour ce genre de raccourcis, sont réservés par tous les navigateurs (nouvelle fenêtre, changer d'onglet du navigateur) — c'est pour ça qu'ils n'apparaissent pas ici.",
  },
];

export function renderGuide(container) {
  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>📖 Guide</h1>
        <!-- USE-UX-027 (LOT 9, "Guide et Nouveautés aux rôles proches, distinction non explicite") :
             sous-titre explicite retenu tel quel par l'audit ("Comment ça marche" / "Ce qui a
             changé") pour que les deux écrans se distinguent sans avoir à les ouvrir. -->
        <div class="subtitle">Comment ça marche : ce que tu gagnes, casquette par casquette</div>
      </div>
      <a href="#/dashboard" class="btn btn-secondary btn-sm">← Retour</a>
    </div>
    <div class="view" id="guide-body"></div>
  `;

  const body = container.querySelector("#guide-body");
  body.innerHTML = `
    <p class="item-meta" style="font-size:var(--font-size-md);margin-bottom:16px;">
      Pas une liste de fonctions — organisé autour de ce qui t'arrive vraiment dans une
      semaine. Ce guide fonctionne aussi hors connexion, il vit dans l'app.
    </p>

    <div class="field" style="margin-bottom:8px;">
      <input id="guide-search" type="text" placeholder="🔎 Rechercher dans le guide — ex. « canevas », « revue hebdomadaire », « sens d'un suivi »" />
    </div>
    <div class="empty-state" id="guide-search-empty" style="display:none;padding:16px;margin-bottom:16px;">
      Aucun résultat. Essaie un autre mot — ex. « canevas », « note », « casquette », « retard ».
    </div>

    <div class="section-title" id="guide-toc-title" style="margin-top:0;">📚 Sommaire</div>
    <div class="card" id="guide-toc" style="margin-bottom:16px;"></div>

    <div id="guide-searchable">
    <div class="section-title" id="guide-rituals-title">🗓️ Selon le moment — les périodes types</div>
    <p class="item-meta" style="margin-bottom:8px;">
      Les bonnes pratiques à répéter, rangées par occasion plutôt que par écran — chaque ligne
      renvoie directement au bon endroit du guide.
    </p>
    <div class="card" id="guide-rituals" style="margin-bottom:16px;"></div>

    <div class="section-title" id="guide-compass-title">🧭 La boussole</div>
    <div class="card" id="guide-compass" style="margin-bottom:16px;"></div>

    <div class="section-title" id="guide-taskfollow-title">Tâche ou Suivi ? La question qui débloque tout</div>
    <p class="item-meta" style="margin-bottom:8px;">
      C'est très probablement la source de la confusion : deux choses qui se ressemblent
      mais ne se rangent pas au même endroit.
    </p>
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;">
      <div class="card" style="background:var(--color-primary-light);">
        <div class="item-title" style="margin-bottom:4px;">✅ Tâche — c'est toi qui dois faire quelque chose</div>
        <div>Vit dans le Kanban (« Pilotage »), avec un statut, une échéance, éventuellement rattachée à un projet.</div>
        <div class="item-meta" style="margin-top:8px;font-style:italic;">Ex. « Rédiger la spec de l'écran de saisie », « Répondre au mail RH avant vendredi ».</div>
      </div>
      <div class="card" style="background:var(--color-warning-light);">
        <div class="item-title" style="margin-bottom:4px;">👀 Suivi — ça concerne une autre personne</div>
        <div>Soit tu attends quelque chose d'elle (« waiting_on »), soit tu dois lui transmettre quelque chose (« à transmettre »). Vit sur sa fiche dans Équipe, pas dans le Kanban.</div>
        <div class="item-meta" style="margin-top:8px;font-style:italic;">Ex. « J'attends la maquette de Julien (marketing) pour le 12 », « Dire à Sarah qu'on décale le go-live ».</div>
      </div>
    </div>
    <p class="item-meta" style="margin-bottom:24px;">
      Une tâche n'a jamais de « personne assignée » — ce que fait ton équipe pour toi, ou ce
      que tu attends d'un collègue, ça passe par un Suivi sur sa fiche, pas par une Tâche.
    </p>

    <div id="guide-hats"></div>

    <div class="section-title" id="guide-tabs-title">Chaque onglet, en une phrase</div>
    <div class="card" id="guide-tabs" style="margin-bottom:16px;"></div>

    <div class="section-title" id="guide-topics-title">🧩 Fonctions transverses — comment ça marche, à quoi ça sert</div>
    <div id="guide-topics" style="margin-bottom:16px;"></div>

    <details id="guide-retard">
      <summary class="section-title" style="cursor:pointer;">🔴 Il y a du retard partout — par où commencer ?</summary>
      <div class="card" style="margin-top:8px;margin-bottom:16px;">
        <p style="margin-top:0;">Le réflexe naturel est de tout relire depuis le début — c'est justement ce qui rallonge l'Accueil et donne l'impression que l'outil échappe. La bonne méthode : ne jamais tout lire, seulement trier.</p>
        <div class="item-row"><div class="item-main"><div class="item-title">Chaque matin (2 min)</div><div class="item-meta">Clique la tuile 🔴 En retard sur l'Accueil — elle ouvre directement la liste exacte.</div></div></div>
        <div class="item-row"><div class="item-main"><div class="item-title">Dans le Kanban</div><div class="item-meta">Utilise le filtre « En retard » — il isole ce qui a dépassé son échéance, toutes colonnes confondues.</div></div></div>
        <div class="item-row"><div class="item-main"><div class="item-title">Une fois par semaine</div><div class="item-meta">Lance la Revue hebdomadaire guidée (bouton 🧭 sur l'Accueil) — elle fait défiler Inbox, Retards, Suivis à contrôler, Projets sans action, une ligne à la fois.</div></div></div>
        <div class="item-row" style="border-bottom:none;"><div class="item-main"><div class="item-title">Réflexe permanent</div><div class="item-meta">Laisse l'historique replié — il se replie tout seul au-delà de 6 entrées, pas besoin de le faire défiler.</div></div></div>
        <p class="item-meta" style="margin-bottom:0;margin-top:12px;">Le retard qui s'accumule n'est pas un échec de l'outil ni le tien — un signal que le rythme de revue n'a pas suivi le volume.</p>
      </div>
    </details>
    </div>
  `;

  // "Selon le moment" : même mécanique que la boussole juste en dessous, mais la puce affiche
  // la période plutôt que la casquette. Voir le commentaire sur RITUALS plus haut.
  const ritualsEl = body.querySelector("#guide-rituals");
  for (const row of RITUALS) {
    const el = document.createElement("div");
    el.className = "item-row";
    el.style.cursor = "pointer";
    el.innerHTML = `
      <div class="item-main">
        <div class="item-title">${escapeHtml(row.sit)}</div>
        <div class="item-meta">${escapeHtml(row.detail)}</div>
      </div>
      <span class="chip" style="pointer-events:none;">${escapeHtml(row.period)}</span>
    `;
    el.addEventListener("click", () => openTopic(row.target));
    ritualsEl.appendChild(el);
  }

  // Boussole : chaque ligne ouvre + scrolle vers la bonne casquette (les casquettes sont
  // repliées par défaut pour ne pas rallonger l'écran — même logique que l'historique des
  // fiches, retour de Charles-Henri sur les pages qui s'allongent).
  const compassEl = body.querySelector("#guide-compass");
  for (const row of COMPASS) {
    const el = document.createElement("div");
    el.className = "item-row";
    el.style.cursor = "pointer";
    el.innerHTML = `
      <div class="item-main">
        <div class="item-title">${escapeHtml(row.sit)}</div>
        <div class="item-meta">${escapeHtml(row.detail)}</div>
      </div>
      <span class="chip" style="pointer-events:none;">${escapeHtml(row.hat)}</span>
    `;
    el.addEventListener("click", () => openTopic(row.target));
    compassEl.appendChild(el);
  }

  // Sommaire : simple index cliquable, en dehors de la zone filtrée par la recherche (voir TOC
  // plus haut) — reste utilisable même pendant une recherche en cours.
  const tocEl = body.querySelector("#guide-toc");
  for (const [label, target] of TOC) {
    const el = document.createElement("div");
    el.className = "item-row";
    el.style.cursor = "pointer";
    el.innerHTML = `<div class="item-main"><div class="item-title">${label}</div></div>`;
    el.addEventListener("click", () => openTopic(target));
    tocEl.appendChild(el);
  }

  const hatsEl = body.querySelector("#guide-hats");
  hatsEl.appendChild(renderHatToi());
  hatsEl.appendChild(renderHatEquipe());
  hatsEl.appendChild(renderHatProjets());
  hatsEl.appendChild(renderHatManager());
  hatsEl.appendChild(renderHatCse());

  const tabsEl = body.querySelector("#guide-tabs");
  for (const [name, usage, when] of TABS_REF) {
    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
      <div class="item-main">
        <div class="item-title">${name}</div>
        <div class="item-meta">${usage}</div>
        <div class="item-meta" style="margin-top:2px;"><em>Quand l'ouvrir :</em> ${when}</div>
      </div>
    `;
    tabsEl.appendChild(row);
  }

  const topicsEl = body.querySelector("#guide-topics");
  for (const topic of TOPICS_REF) {
    const card = document.createElement("div");
    card.className = "card";
    card.style.marginBottom = "10px";
    card.innerHTML = `
      <div class="item-title" style="margin-bottom:4px;">${escapeHtml(topic.title)}</div>
      <div class="item-meta">${escapeHtml(topic.text)}</div>
    `;
    topicsEl.appendChild(card);
  }

  // Généralisation de l'ancien `openHat` (retour de Charles-Henri, 13/09/2026 : liens profonds
  // vers une rubrique précise depuis d'autres écrans, voir `guideTopicHref`/`guideLinkHtml`
  // plus haut) : la cible n'est plus forcément une <details> de casquette — ça peut aussi être
  // un simple titre de section (Sommaire) ou un cas d'usage précis niché DANS une casquette
  // repliée (RITUALS), auquel cas sa <details> parente est ouverte d'abord. Un bref flash
  // visuel (`.guide-highlight-flash`, styles/components.css) signale la ligne visée quand elle
  // n'est pas elle-même un dépliant qu'on voit s'ouvrir.
  function openTopic(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const parentDetails = el.closest("details");
    if (parentDetails) parentDetails.open = true;
    if (el.tagName === "DETAILS") el.open = true;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.add("guide-highlight-flash");
    setTimeout(() => el.classList.remove("guide-highlight-flash"), 1800);
  }

  // Lien profond `#/guide?topic=<id>` depuis un autre écran (voir `guideLinkHtml` plus haut) —
  // même pattern de lecture directe de `location.hash` que js/views/prepMask.js, plutôt que de
  // faire transiter ce paramètre par js/app.js (le guide n'est pas une fiche à résoudre via
  // resolveRef, ça n'a pas sa place dans js/services/deeplink.js). Jamais bloquant : un id
  // inconnu ou absent laisse simplement le guide s'afficher normalement, depuis le haut.
  const topicParam = new URLSearchParams(location.hash.split("?")[1] || "").get("topic");
  if (topicParam) openTopic(topicParam);

  // Recherche dans le guide (retour de Charles-Henri, 01/09/2026 : "une espèce de recherche
  // rapide comme la loupe sur l'accueil mais intégré à l'aide ici uniquement") — même logique
  // de correspondance simple (.toLowerCase().includes(...)) que js/components/search.js, pour
  // rester cohérent avec le reste de l'app plutôt que d'introduire une normalisation différente.
  // Granularité volontairement mixte : fin pour la boussole/les onglets/les fonctions
  // transverses (une ligne ou une carte à la fois), grossier pour chaque casquette et pour le
  // bloc retard (bloc entier montré/masqué, ouvert automatiquement s'il contient une
  // correspondance) — un dépliant entier n'a pas besoin d'être découpé phrase par phrase pour
  // qu'on retrouve "canevas" dedans.
  const searchInput = body.querySelector("#guide-search");
  const searchEmpty = body.querySelector("#guide-search-empty");
  const ritualsTitle = body.querySelector("#guide-rituals-title");
  const compassTitle = body.querySelector("#guide-compass-title");
  const tabsTitle = body.querySelector("#guide-tabs-title");
  const topicsTitle = body.querySelector("#guide-topics-title");
  const hatBlocks = Array.from(hatsEl.children);
  const hatDefaultOpen = new Map(hatBlocks.map((h) => [h, h.open]));
  const retardDetails = body.querySelector("#guide-retard");
  const retardDefaultOpen = retardDetails.open;

  function setTitleVisible(titleEl, containerEl) {
    const anyVisible = Array.from(containerEl.children).some((c) => c.style.display !== "none");
    titleEl.style.display = anyVisible ? "" : "none";
  }

  function resetSearch() {
    for (const row of [...ritualsEl.children, ...compassEl.children, ...tabsEl.children, ...topicsEl.children]) {
      row.style.display = "";
    }
    ritualsTitle.style.display = "";
    compassTitle.style.display = "";
    tabsTitle.style.display = "";
    topicsTitle.style.display = "";
    for (const h of hatBlocks) {
      h.style.display = "";
      h.open = hatDefaultOpen.get(h);
    }
    retardDetails.style.display = "";
    retardDetails.open = retardDefaultOpen;
    searchEmpty.style.display = "none";
  }

  // BUG corrigé (15/09/2026, audit performance) : aucun anti-rebond sur cette recherche —
  // chaque frappe reparcourait tout le Guide. Voir js/views/kanban.js, même correctif.
  let guideSearchDebounce = null;
  searchInput.addEventListener("input", () => {
    clearTimeout(guideSearchDebounce);
    guideSearchDebounce = setTimeout(runGuideSearch, 150);
  });

  function runGuideSearch() {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) {
      resetSearch();
      return;
    }

    let anyMatch = false;

    for (const row of ritualsEl.children) {
      const match = row.textContent.toLowerCase().includes(q);
      row.style.display = match ? "" : "none";
      anyMatch = anyMatch || match;
    }
    setTitleVisible(ritualsTitle, ritualsEl);

    for (const row of compassEl.children) {
      const match = row.textContent.toLowerCase().includes(q);
      row.style.display = match ? "" : "none";
      anyMatch = anyMatch || match;
    }
    setTitleVisible(compassTitle, compassEl);

    for (const row of tabsEl.children) {
      const match = row.textContent.toLowerCase().includes(q);
      row.style.display = match ? "" : "none";
      anyMatch = anyMatch || match;
    }
    setTitleVisible(tabsTitle, tabsEl);

    for (const card of topicsEl.children) {
      const match = card.textContent.toLowerCase().includes(q);
      card.style.display = match ? "" : "none";
      anyMatch = anyMatch || match;
    }
    setTitleVisible(topicsTitle, topicsEl);

    for (const h of hatBlocks) {
      const match = h.textContent.toLowerCase().includes(q);
      h.style.display = match ? "" : "none";
      h.open = match;
      anyMatch = anyMatch || match;
    }

    const retardMatch = retardDetails.textContent.toLowerCase().includes(q);
    retardDetails.style.display = retardMatch ? "" : "none";
    retardDetails.open = retardMatch;
    anyMatch = anyMatch || retardMatch;

    searchEmpty.style.display = anyMatch ? "none" : "";
  }

  return function cleanup() {};
}

function usecase(title, situation, steps, gain, caveat, id) {
  const div = document.createElement("div");
  div.className = "card";
  div.style.marginBottom = "12px";
  // `id` optionnel (retour de Charles-Henri, 13/09/2026) : seuls les cas d'usage ciblés par
  // RITUALS ou par un lien contextuel depuis un autre écran (`guideLinkHtml`) en ont un —
  // sert d'ancre à `openTopic` pour scroller/ouvrir jusqu'à CE cas d'usage précis plutôt que de
  // se contenter d'ouvrir toute la casquette.
  if (id) div.id = id;
  div.innerHTML = `
    <div class="item-title" style="margin-bottom:2px;">${escapeHtml(title)}</div>
    ${situation ? `<div class="item-meta" style="margin-bottom:10px;">${escapeHtml(situation)}</div>` : ""}
    <ol style="margin:0 0 10px;padding-left:20px;">
      ${steps.map((s) => `<li style="margin-bottom:6px;">${s}</li>`).join("")}
    </ol>
    <div style="display:inline-block;background:var(--color-success-bg);color:var(--color-success);padding:4px 12px;border-radius:var(--radius-pill);font-size:var(--font-size-sm);">Gain : ${gain}</div>
    ${caveat ? `<div style="margin-top:10px;padding:10px 14px;background:var(--color-danger-light);border-radius:var(--radius-sm);font-size:var(--font-size-sm);"><strong style="color:var(--color-danger);">Ce que l'app ne fait pas :</strong> ${caveat}</div>` : ""}
  `;
  return div;
}

function hatDetails(id, icon, title, intro) {
  const details = document.createElement("details");
  details.id = id;
  details.className = "card";
  details.style.marginBottom = "16px";
  const summary = document.createElement("summary");
  summary.className = "section-title";
  summary.style.cssText = "cursor:pointer;margin-top:0;";
  summary.textContent = `${icon} ${title}`;
  details.appendChild(summary);
  const introEl = document.createElement("p");
  introEl.className = "item-meta";
  introEl.style.margin = "8px 0 4px";
  introEl.textContent = intro;
  details.appendChild(introEl);
  return details;
}

function renderHatToi() {
  const details = hatDetails("hat-toi", "🧑‍💻", "Toi — l'exécution du quotidien", "Tout ce qui atterrit sur toi directement : une échéance à tenir, un mail à traiter, une demande verbale, savoir ce qu'il y a à faire aujourd'hui.");
  details.appendChild(
    usecase(
      "Une tâche à faire pour une échéance",
      "Tu sais ce que tu dois produire et pour quand.",
      [
        "Bouton <code>+</code> flottant → capture le texte brut, tout de suite.",
        "Optionnel : « + Préciser maintenant » → choisis ✅ Action pour qualifier directement.",
        "Renseigne l'échéance et, si ça concerne un projet existant, rattache-la.",
      ],
      "elle apparaît automatiquement dans le Kanban et dans « Aujourd'hui »/« 7 jours » du Dashboard."
    )
  );
  details.appendChild(
    usecase(
      "Un collègue te demande verbalement un truc sur son projet",
      "Ce n'est pas ton projet, mais on t'a demandé quelque chose à ce sujet.",
      [
        "Capture tout de suite — capturer doit être immédiat, qualifier peut attendre.",
        "Qualifie en ✅ Action si tu dois produire quelque chose ; rattache au projet du collègue s'il existe déjà.",
        "Si en réalité tu attends juste un retour de sa part, c'est un Suivi sur sa fiche, pas une Tâche.",
      ],
      "la demande verbale, qui d'habitude s'évapore, est tracée et retrouvable — y compris trois mois plus tard."
    )
  );
  details.appendChild(
    usecase(
      "Traiter un mail de demande",
      "Un mail te demande quelque chose et tu ne veux pas le traiter tout de suite.",
      [
        "Capture l'essentiel du mail (copier-coller l'objet + la demande suffit).",
        "Laisse-le dans l'Inbox — capturer et traiter sont deux choses différentes.",
        "Au moment de traiter l'Inbox, qualifie-le : Action, Suivi, Information, ou Archivé.",
      ],
      "ta boîte mail arrête d'être une deuxième todo-list parallèle."
    )
  );
  details.appendChild(
    usecase(
      "Savoir ce que tu dois faire aujourd'hui ou cette semaine",
      "Le matin, tu veux une vue claire sans tout relire.",
      [
        "Accueil : les tuiles 🔴 En retard et 📅 Aujourd'hui, cliquables pour voir la liste exacte.",
        "La rubrique pliable « À échéance dans les 7 jours » donne la semaine sans polluer le reste de l'écran.",
        "Onglet Calendrier si tu préfères une vue jour par jour / semaine.",
      ],
      "trois secondes pour répondre à « qu'est-ce qui compte aujourd'hui ».",
      "bloquer des créneaux dans Outlook. Pilotage ne pousse rien vers Outlook — seul le sens inverse existe (associer une réunion Outlook déjà créée à une tâche). Le geste reste : tu regardes Pilotage pour savoir <em>quoi</em> bloquer, puis tu crées toi-même le créneau dans Outlook."
    )
  );
  details.appendChild(
    usecase(
      "Suivre l'avancement de tes propres objectifs",
      "Tu veux ta propre ligne directrice, pas seulement celle de tes collaborateurs.",
      [
        "Accueil → « 🎯 Mes objectifs » → « + Nouvel objectif » : un titre, un projet lié si ça se rattache à l'un d'eux.",
        "Ajoute un point de suivi daté à chaque avancée réelle — pas une case à cocher, une vraie phrase datée, comme pour un objectif de collaborateur.",
        "Coche « Atteint » quand c'est fait, tague-le si utile, et lie les tâches/projets qui y contribuent depuis « 🔗 Éléments liés ».",
      ],
      "le même suivi dans la durée que celui que tu tiens déjà pour les autres, mais pour toi — plus un texte figé qu'on ne relit jamais.",
      "",
      "usecase-mes-objectifs"
    )
  );
  return details;
}

function renderHatEquipe() {
  const details = hatDetails("hat-equipe", "👥", "Manager de ton équipe (dev et autres)", "Suivre où en sont tes collaborateurs, leurs difficultés, préparer les points individuels, et in fine l'EADP.");
  details.appendChild(
    usecase(
      "Suivre où en est un développeur, ses difficultés",
      "Tu veux garder une mémoire de ce qui se dit et se décide avec chaque personne.",
      [
        "Onglet Équipe → sa fiche.",
        "Ajoute un Suivi à chaque engagement pris ou difficulté évoquée — trié automatiquement par date d'ajout, le plus récent en haut.",
        "Utilise le champ Notes pour le contexte durable (pas un engagement daté, juste ce qu'il faut savoir sur la personne).",
      ],
      "plus besoin de rouvrir tes mails ou ta mémoire avant un 1:1."
    )
  );
  details.appendChild(
    usecase(
      "Préparer un point individuel",
      "Tu as un 1:1 dans 10 minutes.",
      ["Fiche de la personne → bouton « 🗒️ Préparer mon point ».", "L'écran recompose tout seul : en retard de contrôle, à transmettre, à aborder, terminé récemment."],
      "zéro travail de préparation supplémentaire — une lecture recomposée de ce qui existe déjà.",
      "",
      "usecase-prep-point"
    )
  );
  details.appendChild(
    usecase(
      "Préparer l'EADP de quelqu'un",
      "Fin de campagne, tu dois ressortir les faits marquants de l'année.",
      [
        "Tout au long de l'année, en créant/modifiant un Suivi pour cette personne, coche 👍 Positif ou 👎 Négatif quand c'est notable.",
        "Note ses objectifs de campagne (+ Ajouter sous « Objectifs » sur sa fiche) et ajoute un point de suivi daté à chaque fois que vous en reparlez.",
        "Le jour J, bouton « 📋 Préparer l'EADP » → choisis la période → tout ressort trié, avec un résumé copiable.",
      ],
      "plus besoin de rouvrir onze mois d'historique la veille de l'entretien.",
      "d'export mis en forme ni de comparaison entre campagnes — juste la matière brute, propre et filtrée, à partir de laquelle tu rédiges toi-même (version volontairement simple).",
      "usecase-eadp"
    )
  );
  return details;
}

function renderHatProjets() {
  const details = hatDetails("hat-projets", "📦", "Piloter un projet transverse", "Ex. la Modernisation, où tu dépends d'autres équipes (marketing, dev) pour avancer, sans levier hiérarchique direct sur elles.");
  details.appendChild(
    usecase(
      "Monter un nouveau projet, par où commencer",
      "",
      [
        "Onglet Projets → + Projet. Donne-lui une catégorie (ex. « Modernisation ») — une icône lui est assignée automatiquement.",
        "Si le projet a des blocs qui avancent sans que tu aies d'action dessus, ajoute-les en 🧩 Sous-parties — un simple statut à trois états, pas une tâche.",
        "L'avancement affiché (%) se calcule automatiquement à partir des tâches rattachées.",
      ],
      "« Où en est Modernisation ? » a une réponse en un coup d'œil, sans réunion de statut.",
      "",
      "usecase-nouveau-projet"
    )
  );
  details.appendChild(
    usecase(
      "Faire réaliser des choses par le marketing (ou une équipe qui ne te reporte pas)",
      "Tu dépends d'eux, tu dois savoir où ça en est et relancer au bon moment.",
      [
        "Ajoute la personne marketing concernée dans Équipe si elle n'y est pas déjà.",
        "Crée un Suivi sur sa fiche, sens « waiting_on », rattaché à ce projet, avec une date de contrôle — c'est elle qui déclenche la relance dans le Dashboard.",
        "Depuis la fiche projet : Réunions pour les points de cadrage, Ressources pour les maquettes/specs échangées.",
      ],
      "tu sais exactement ce que tu attends de qui, et l'app te dit quand relancer plutôt que de compter sur ta mémoire."
    )
  );
  details.appendChild(
    usecase(
      "Cliquer d'un élément à l'autre sans perdre le fil",
      "",
      [
        "Depuis la fiche projet, chaque ligne (Tâche, Suivi, Réunion, Décision) est cliquable et ouvre sa fiche détaillée.",
        "En fermant cette fiche, tu reviens automatiquement sur la fiche projet.",
      ],
      "tu descends dans le détail d'un sujet et tu remontes sans perdre ta place."
    )
  );
  return details;
}

function renderHatManager() {
  const details = hatDetails("hat-manager", "👔", "Relation avec ton propre manager", "Ce que tu reçois de lui, et ce que tu dois lui faire remonter.");
  details.appendChild(
    usecase(
      "Ton chef te donne une info",
      "",
      [
        "Capture tout de suite, même sur le moment.",
        "Info à retenir sans action → qualifie en 🧠 Information : elle réapparaît dans « Informations & idées » sur l'Accueil.",
        "Ça découle d'un arbitrage ou change quelque chose → qualifie plutôt en 🗳️ Décision, avec le contexte.",
      ],
      "« qu'est-ce qu'on m'avait dit à ce sujet il y a trois mois ? » a enfin une réponse."
    )
  );
  details.appendChild(
    usecase(
      "Préparer ton propre point avec ton manager",
      "",
      [
        "Filtre « 👔 Mon manager » (dans l'onglet Équipe) : ajoute au fil de l'eau les sujets à discuter, décisions attendues, difficultés.",
        "Avant le point, bouton dédié pour composer Réalisé / En cours / Difficultés / Décisions attendues / Sujets à discuter / Prochaines étapes.",
      ],
      "tu arrives avec un ordre du jour déjà structuré, sans le refaire à la main.",
      "",
      "usecase-point-manager"
    )
  );
  return details;
}

function renderHatCse() {
  const details = hatDetails("hat-cse", "🏛️", "CSE", "Une casquette à part, avec ses propres réunions et projets — qui ne doit pas se mélanger visuellement avec le reste.");
  details.appendChild(
    usecase(
      "Séparer le CSE du reste dans l'onglet Projets",
      "",
      ["Donne à chaque projet CSE la catégorie « CSE » (créée une fois, réutilisée ensuite).", "Utilise le filtre par catégorie en haut de l'onglet Projets pour n'afficher que le CSE quand tu en as besoin."],
      "tes casquettes restent visuellement distinctes sans avoir besoin de deux outils différents."
    )
  );
  details.appendChild(
    usecase(
      "Préparer une réunion CSE",
      "",
      ["Capture ou création directe d'une Réunion, rattachée si besoin à un projet catégorie CSE.", "Active un canevas si le sujet s'y prête (Avant/Pendant/Après)."],
      "la préparation, l'ordre du jour et le compte-rendu vivent au même endroit, retrouvable ensuite."
    )
  );
  return details;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
