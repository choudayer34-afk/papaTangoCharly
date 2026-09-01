// Modal générique — remplace les dizaines d'IDs de modale codés en dur qu'on trouve
// dans EnVie, et généralise le pattern promptChoice()/promptText() d'eProtec.
// Un seul composant, réutilisé pour la capture, la qualification, les formulaires, etc.

let activeOverlay = null;

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
    onClose?.();
  }

  document.body.appendChild(overlay);
  activeOverlay = overlay;

  return { close, bodyEl };
}

export function closeModal() {
  activeOverlay?.remove();
  activeOverlay = null;
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
