// "Nouveautés" — retour de Charles-Henri (01/09/2026) : "où est-ce que je retrouve tout les
// trucs qu'on a ajouté ?" — un problème de repérage/mémoire externe (voir doc de suivi,
// discussion TDAH permanence/repérage), distinct du Guide : le Guide explique COMMENT utiliser
// une fonction, ici on retrace QUAND et POURQUOI chaque fonction est arrivée, du plus récent
// au plus ancien, pour ne jamais avoir à s'en souvenir soi-même.
//
// Volontairement hors de ROUTES (même logique que le Guide, js/app.js) : une page de référence
// consultée ponctuellement depuis le bouton ❓ Aide, pas un onzième onglet permanent. Contenu
// rédigé à la main à chaque livraison — comme le Guide, rien ne le régénère automatiquement
// (voir doc de suivi, "Point d'attention").
//
// Regroupé par vague de livraison plutôt que par jour brut (plusieurs vagues le même jour) —
// seule la vague la plus récente est dépliée par défaut, pour ne pas rallonger l'écran (même
// logique que l'historique des fiches et les casquettes du Guide).

const WHATS_NEW = [
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
            <div class="item-row" style="${j === group.items.length - 1 ? "border-bottom:none;" : ""}">
              <div class="item-main">
                <div class="item-title">${escapeHtml(item.title)}</div>
                <div class="item-meta">${escapeHtml(item.text)}</div>
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
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
