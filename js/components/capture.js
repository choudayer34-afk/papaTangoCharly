// Capture express — cahier des charges §6.
// "Qu'est-ce que tu veux retenir ?" → Enregistrer. Terminé. Rien d'autre à décider
// à cet instant (Règle 1 : capturer doit être extrêmement rapide. Règle 2 : capturer
// et traiter sont deux choses différentes — la qualification se fait plus tard, dans
// l'Inbox).

import { openModal } from "./modal.js";
import { showToast } from "./toast.js";
import { capture } from "../domain/inbox.js";
import { openQualifyChoice } from "../views/inbox.js";

// "+ Préciser maintenant" (retour de Charles-Henri) : parfois le type et le rattachement sont
// déjà connus au moment même de la capture — plutôt que forcer un aller-retour par l'Inbox,
// un choix de type optionnel et replié par défaut permet de sauter directement sur la
// qualification, SANS changer le flux par défaut (Règle 1 : capturer doit rester extrêmement
// rapide) : sans ce choix, "Enregistrer" se comporte exactement comme avant.
const QUICK_TYPES = [
  { key: "task", emoji: "✅", label: "Action" },
  { key: "followup", emoji: "👀", label: "Suivi" },
  { key: "meeting", emoji: "📅", label: "Réunion" },
  { key: "decision", emoji: "🗳️", label: "Décision" },
  { key: "resource", emoji: "📎", label: "Ressource" },
  { key: "kept", emoji: "🧠", label: "Information" },
];

export function openCaptureModal() {
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="capture-input">Qu'est-ce que tu veux retenir ?</label>
      <textarea id="capture-input" autofocus placeholder="Ex. Clément pense pouvoir terminer le pipeline vendredi."></textarea>
    </div>
    <button type="button" id="capture-more-btn" class="btn btn-ghost btn-sm" style="padding-left:0;">+ Préciser maintenant (type, rattachement...)</button>
    <div id="capture-quick-types" class="chip-row" style="display:none;flex-wrap:wrap;margin-top:8px;"></div>
  `;

  const quickTypesEl = body.querySelector("#capture-quick-types");
  quickTypesEl.innerHTML = QUICK_TYPES.map((t) => `<button type="button" class="chip" data-key="${t.key}">${t.emoji} ${t.label}</button>`).join("");
  let selectedQuickType = null;
  body.querySelector("#capture-more-btn").addEventListener("click", (e) => {
    quickTypesEl.style.display = quickTypesEl.style.display === "none" ? "flex" : "none";
  });
  quickTypesEl.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const nowActive = chip.dataset.key !== selectedQuickType;
      quickTypesEl.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
      selectedQuickType = nowActive ? chip.dataset.key : null;
      chip.classList.toggle("active", nowActive);
    });
  });

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
          const item = await capture(value, "manuel");
          close();
          if (selectedQuickType) {
            // Le choix immédiat du type ouvre directement le bon formulaire de qualification
            // (même dispatcheur que l'Inbox, js/views/inbox.js) — la capture reste malgré
            // tout journalisée avant, donc rien n'est perdu si ce formulaire est annulé.
            openQualifyChoice(item, selectedQuickType);
          } else {
            showToast("Enregistré dans l'Inbox");
          }
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
