// Capture express — cahier des charges §6.
// "Qu'est-ce que tu veux retenir ?" → Enregistrer. Terminé. Rien d'autre à décider
// à cet instant (Règle 1 : capturer doit être extrêmement rapide. Règle 2 : capturer
// et traiter sont deux choses différentes — la qualification se fait plus tard, dans
// l'Inbox).

import { openModal } from "./modal.js";
import { showToast } from "./toast.js";
import { capture } from "../domain/inbox.js";

export function openCaptureModal() {
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="capture-input">Qu'est-ce que tu veux retenir ?</label>
      <textarea id="capture-input" autofocus placeholder="Ex. Clément pense pouvoir terminer le pipeline vendredi."></textarea>
    </div>
  `;

  const { close, bodyEl } = openModal({
    title: "Capturer",
    body,
    dismissible: true,
    actions: [
      { label: "Annuler", variant: "ghost" },
      {
        label: "Enregistrer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          const textarea = bodyEl.querySelector("#capture-input");
          const value = textarea.value.trim();
          if (!value) {
            textarea.focus();
            return;
          }
          await capture(value, "manuel");
          close();
          showToast("Enregistré dans l'Inbox");
        },
      },
    ],
  });

  setTimeout(() => bodyEl.querySelector("#capture-input")?.focus(), 30);
}

export function mountCaptureFab() {
  if (document.querySelector(".fab")) return;
  const fab = document.createElement("button");
  fab.className = "fab";
  fab.setAttribute("aria-label", "Capturer");
  fab.textContent = "+";
  fab.addEventListener("click", openCaptureModal);
  document.body.appendChild(fab);
}
