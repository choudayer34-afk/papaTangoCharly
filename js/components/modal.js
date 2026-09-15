// Modal générique — remplace les dizaines d'IDs de modale codés en dur qu'on trouve
// dans EnVie, et généralise le pattern promptChoice()/promptText() d'eProtec.
// Un seul composant, réutilisé pour la capture, la qualification, les formulaires, etc.

let activeOverlay = null;
let activeClose = null; // la fonction close() propre à la modale actuellement ouverte — voir closeModal() plus bas

/**
 * @param {Object} opts
 * @param {string} opts.title
 * @param {HTMLElement|string} opts.body - noeud DOM ou HTML à insérer dans le corps.
 * @param {Array<{label:string, variant?:string, onClick?:Function, closesModal?:boolean, icon?:string, compact?:boolean}>} opts.actions
 *   `icon`/`compact` (retour de Charles-Henri, 06/09/2026 : "je ne vois pas le bouton
 *   sauvegarder [...] il faudrait sans doute les remplacer par des icônes") — réservés aux
 *   fiches à 5 actions (Tâche/Projet/Personne/Suivi) dont le texte cumulé dépasse la largeur
 *   d'un iPhone : `compact: true` + `icon` affiche l'icône ET le libellé sur un écran assez
 *   large, mais ne garde que l'icône en dessous de 480px (voir `.btn-compact` dans
 *   styles/components.css) — `title`/`aria-label` gardent le libellé complet accessible même
 *   icône seule. Les autres actions (non `compact`) sont inchangées, texte brut comme avant.
 * @param {boolean} [opts.dismissible=true]
 * @param {Function} [opts.onClose] - appelé une seule fois, quel que soit le chemin de
 *   fermeture (clic en dehors, Échap, ou n'importe quelle action) — utile pour un appelant qui
 *   doit rafraîchir un affichage derrière la modale sans avoir à dupliquer la logique sur
 *   chaque action (voir "✏️ Saisie laissée en cours", js/views/dashboard.js).
 * @returns {{close: Function, bodyEl: HTMLElement}}
 */
export function openModal({ title, body, actions = [], dismissible = true, onClose }) {
  closeModal(); // une seule modale à la fois

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const modal = document.createElement("div");
  modal.className = "modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");

  const heading = document.createElement("h2");
  heading.textContent = title;
  modal.appendChild(heading);

  const bodyEl = document.createElement("div");
  bodyEl.className = "modal-body";
  if (typeof body === "string") {
    bodyEl.innerHTML = body;
  } else if (body instanceof HTMLElement) {
    bodyEl.appendChild(body);
  }
  modal.appendChild(bodyEl);

  if (actions.length) {
    const actionsRow = document.createElement("div");
    actionsRow.className = "modal-actions";
    for (const action of actions) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn " + (action.variant ? "btn-" + action.variant : "btn-secondary") + (action.compact ? " btn-compact" : "");
      if (action.compact && action.icon) {
        btn.innerHTML = `<span class="btn-icon" aria-hidden="true">${action.icon}</span><span class="btn-label">${action.label}</span>`;
        btn.title = action.label;
        btn.setAttribute("aria-label", action.label);
      } else {
        btn.textContent = action.label;
      }
      // BUG corrigé (15/09/2026, retour de Charles-Henri : suivi créé en double dans "Ça a
      // besoin de toi", faussant l'indicateur) : une action `closesModal: false` (ex. "Créer"/
      // "Enregistrer" sur une fiche) garde la modale ouverte pendant que son `onClick` (souvent
      // async — écriture Firestore) s'exécute, sans jamais désactiver son propre bouton entre
      // temps. Un double clic ou un double tap pendant cette fenêtre (l'utilisateur ne voit
      // encore aucun changement à l'écran, donc clique une seconde fois en pensant que le
      // premier clic n'est pas parti) déclenchait deux fois `onClick` — donc deux fois
      // `createFollowUp` (ou l'équivalent Tâche/Projet/etc.), avec deux id générés séparément :
      // deux fiches strictement identiques, silencieusement. Une action qui ferme la modale
      // elle-même (`closesModal: false`) est désormais désactivée dès le premier clic et
      // réactivée seulement si la modale est encore là une fois `onClick` retourné (ex. un
      // garde-fou de validation type `if (!title) return;` qui n'a pas fermé la modale) — pour
      // ne jamais laisser l'utilisateur bloqué sur un bouton mort. Les actions par défaut
      // (`closesModal` absent ou `true`, ex. "Annuler"/"Fermer") ferment la modale de façon
      // synchrone comme avant, sans fenêtre où un double clic pourrait rejouer deux fois.
      btn.addEventListener("click", async () => {
        if (action.closesModal === false) {
          if (btn.disabled) return;
          btn.disabled = true;
          try {
            await action.onClick?.();
          } finally {
            if (overlay.isConnected) btn.disabled = false;
          }
        } else {
          action.onClick?.();
          close();
        }
      });
      actionsRow.appendChild(btn);
    }
    modal.appendChild(actionsRow);
  }

  overlay.appendChild(modal);
  if (dismissible) {
    overlay.addEventListener("click", (e) => {
      if (e.target !== overlay) return;
      // BUG corrigé (retour de Charles-Henri, vague 41, 09/09/2026 : "je clique en dehors de la
      // modale par erreur et ça me ferme la modale et je perds ma saisie") : un clic accidentel
      // en dehors (changement de fenêtre, clic à côté sur un grand écran) ne doit jamais faire
      // perdre une saisie en cours. Si la modale contient un champ modifiable (texte, date,
      // liste déroulante...), le clic en dehors ne la ferme plus — seule une action explicite
      // (bouton Fermer/Annuler, ou Échap) le fait. Les modales sans aucun champ (listes de
      // choix, confirmations, fiches en lecture seule) gardent le clic en dehors comme
      // raccourci de fermeture rapide, sans aucun risque de perte.
      // Correctif (13/09/2026, retour de Charles-Henri : "je suis parfois bloqué comme sur
      // administration") : le garde-fou ci-dessus visait les champs qu'on peut RENSEIGNER, pas
      // n'importe quel <input>/<select> — un champ marqué readonly/disabled (ex. le lien de
      // l'app affiché en lecture seule dans 🔧 Administration) ne peut par définition perdre
      // aucune saisie, il n'y en a pas. Le compter comme "modale à protéger" revenait à
      // supprimer le clic en dehors pour des modales purement informatives qui, en plus,
      // n'avaient pas toutes un bouton d'action explicite — la seule sortie restait alors la
      // touche Échap, jamais indiquée à l'écran. Voir aussi le bouton "Fermer" ajouté à
      // js/components/adminPanel.js#openAdminPanel pour ce cas précis.
      if (bodyEl.querySelector("input:not([readonly]):not([disabled]), textarea:not([readonly]):not([disabled]), select:not([disabled])")) {
        modal.classList.remove("modal-nudge");
        // Force le redémarrage de l'animation même si elle vient déjà de jouer (deux clics en
        // dehors rapprochés) — un retrait/ajout de classe en 2 temps plutôt qu'un simple
        // toggle, sinon le navigateur ne rejoue pas une animation déjà terminée sur la même
        // classe.
        void modal.offsetWidth;
        modal.classList.add("modal-nudge");
        return;
      }
      close();
    });
  }

  function onKeydown(e) {
    if (e.key === "Escape" && dismissible) close();
  }
  document.addEventListener("keydown", onKeydown);

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKeydown);
    overlay.remove();
    if (activeOverlay === overlay) activeOverlay = null;
    if (activeClose === close) activeClose = null;
    onClose?.();
  }

  document.body.appendChild(overlay);
  activeOverlay = overlay;
  activeClose = close;

  return { close, bodyEl };
}

// BUG corrigé (retour de Charles-Henri, vague 22 : "shift + un chiffre, par exemple 3, ça
// m'enregistre en Information alors que je suis en saisie") : cette fonction se contentait de
// retirer l'overlay du DOM et de réinitialiser `activeOverlay`, sans jamais appeler la vraie
// fonction close() de la modale en cours — celle qui retire son écouteur clavier local et
// invoke `onClose`. Or c'est ce closeModal() global (et non le `close` retourné par
// openModal()) que la quasi-totalité des appelants de l'app utilisent pour fermer une modale
// avant d'en ouvrir une autre (77 appels dans le code). Conséquence concrète : la qualification
// Inbox (js/views/inbox.js#openQualifyModal) pose un écouteur `document.addEventListener(
// "keydown", ...)` local pour les raccourcis 1/2/3/A, retiré via `onClose` — mais choisir un
// choix ("Suivi", "Tâche"...) ferme la modale avec ce closeModal() global avant d'ouvrir la
// modale suivante, donc `onClose` n'était JAMAIS appelé et l'écouteur restait attaché à
// `document` pour de bon. Résultat : taper "3" n'importe où ensuite dans l'app — y compris
// dans un champ de texte, "3" nécessitant Shift sur un clavier AZERTY — requalifiait
// silencieusement en arrière-plan l'item Inbox déjà traité en "🧠 Information", un fantôme de
// plus à chaque nouvelle qualification. Corrigé en centralisant la fermeture : closeModal()
// délègue désormais à la fonction close() de la modale active (déjà protégée par le flag
// `closed`, donc sûre même appelée deux fois) plutôt que de manipuler l'overlay à la main.
export function closeModal() {
  activeClose?.();
}

// Garde anti-double-clic générique (15/09/2026, retour de Charles-Henri : "refait une revue de
// code entière... anomalies d'usage ou d'enregistrement en silence") — même principe que la
// garde posée plus haut sur les actions `closesModal: false` d'`openModal()` (patch 0026 :
// un double-clic sur "Créer"/"Enregistrer" créait une fiche en double), mais pour les boutons
// d'ajout qui ne passent PAS par `openModal()` : "+" d'une checklist, d'un journal de notes,
// d'une sous-partie de projet, d'un point de suivi d'objectif, association d'une réunion
// Outlook, sélection d'un élément à lier... Tous partagent le même défaut trouvé en audit : le
// bouton n'est jamais désactivé pendant l'écriture (souvent asynchrone), donc un double-clic ou
// un double-Entrée déclenche deux fois l'ajout — un doublon silencieux dans un tableau existant
// plutôt qu'une fiche racine dupliquée, mais la même famille de bug.
/**
 * @param {HTMLElement} el - l'élément à désactiver pendant l'exécution (bouton, ou tout élément
 *   portant une propriété `disabled`).
 * @param {Function} handler - fonction (éventuellement async) à protéger contre un rejeu.
 * @returns {Function} un handler prêt à être passé à `addEventListener`.
 */
export function guardClick(el, handler) {
  return async (...args) => {
    if (el.disabled) return;
    el.disabled = true;
    try {
      return await handler(...args);
    } finally {
      // Ne réactive que si l'élément est toujours dans le document — s'il a disparu (ex. la
      // modale qui le contenait vient de se fermer), il n'y a rien à réactiver.
      if (el.isConnected) el.disabled = false;
    }
  };
}

/**
 * Petite confirmation réutilisable avant une suppression définitive — un seul endroit pour
 * ce pattern plutôt qu'un window.confirm() par fiche. Suit le même principe que les autres
 * modales imbriquées de l'app (voir kanban.js/projects.js) : `onCancel` permet à l'appelant
 * de rouvrir la fiche d'origine, puisque ouvrir cette confirmation l'a refermée.
 * @param {Object} opts
 * @param {string} [opts.title]
 * @param {string} opts.message
 * @param {Function} opts.onConfirm
 * @param {Function} [opts.onCancel]
 */
export function confirmDelete({ title = "Supprimer ?", message, onConfirm, onCancel }) {
  const body = document.createElement("div");
  body.textContent = message || "Cette action est irréversible.";
  openModal({
    title,
    body,
    actions: [
      { label: "Annuler", variant: "ghost", onClick: () => onCancel?.() },
      { label: "Supprimer", variant: "danger", onClick: onConfirm },
    ],
  });
}
