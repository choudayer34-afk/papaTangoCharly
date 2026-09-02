// Modal générique — remplace les dizaines d'IDs de modale codés en dur qu'on trouve
// dans EnVie, et généralise le pattern promptChoice()/promptText() d'eProtec.
// Un seul composant, réutilisé pour la capture, la qualification, les formulaires, etc.

let activeOverlay = null;
let activeClose = null; // la fonction close() propre à la modale actuellement ouverte — voir closeModal() plus bas

/**
 * @param {Object} opts
 * @param {string} opts.title
 * @param {HTMLElement|string} opts.body - noeud DOM ou HTML à insérer dans le corps.
 * @param {Array<{label:string, variant?:string, onClick?:Function, closesModal?:boolean}>} opts.actions
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
      btn.className = "btn " + (action.variant ? "btn-" + action.variant : "btn-secondary");
      btn.textContent = action.label;
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
      if (e.target === overlay) close();
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
