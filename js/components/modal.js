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
      btn.addEventListener("click", () => {
        action.onClick?.();
        if (action.closesModal !== false) close();
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
      if (bodyEl.querySelector("input, textarea, select")) {
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
