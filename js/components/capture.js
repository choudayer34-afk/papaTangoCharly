// Capture express — cahier des charges §6.
// "Qu'est-ce que tu veux retenir ?" → Enregistrer. Terminé. Rien d'autre à décider
// à cet instant (Règle 1 : capturer doit être extrêmement rapide. Règle 2 : capturer
// et traiter sont deux choses différentes — la qualification se fait plus tard, dans
// l'Inbox).

import { openModal } from "./modal.js";
import { showToast } from "./toast.js";
import { capture } from "../domain/inbox.js";
import { openQualifyChoice } from "../views/inbox.js";
import { saveDraft, getDraft, clearDraft } from "../services/draftStore.js";

// Reprise d'une saisie interrompue (piste TDAH du 02/09/2026, retour de Charles-Henri —
// exemples du yaourt/aspirateur et du café oublié : une interruption efface tout ce qui était
// en cours, sans repère extérieur pour le faire remonter). Le brouillon est sauvegardé
// automatiquement pendant la frappe (jamais un geste explicite) et restauré à la prochaine
// ouverture de Capturer — voir aussi le bandeau "✏️ Saisie laissée en cours" sur l'Accueil
// (js/views/dashboard.js), qui joue le rôle du signal extérieur (le camion de recyclage qui
// passe) plutôt que de compter sur Charles-Henri pour penser à revenir ici tout seul.
const DRAFT_KEY = "capture";

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

/**
 * @param {Object} [opts]
 * @param {Function} [opts.onClose] - appelé quand la modale se ferme, quel que soit le chemin
 *   (Enregistrer, Annuler, clic en dehors, Échap) — le brouillon, lui, n'est effacé que sur
 *   Enregistrer/Annuler (une interruption doit au contraire le préserver), mais un appelant qui
 *   affiche un état dépendant du brouillon (le bandeau "✏️ Saisie laissée en cours" de
 *   l'Accueil) a besoin d'être notifié dans tous les cas pour se rafraîchir.
 */
export function openCaptureModal(opts = {}) {
  const draft = getDraft(DRAFT_KEY);
  const hasDraft = !!(draft && draft.value && draft.value.trim());

  const body = document.createElement("div");
  body.innerHTML = `
    ${hasDraft ? `<div class="item-meta" style="margin-bottom:8px;">↩️ On a gardé ce que tu commençais à écrire — reprends-le ou efface-le pour repartir de zéro.</div>` : ""}
    <div class="field">
      <label for="capture-input">Qu'est-ce que tu veux retenir ?</label>
      <textarea id="capture-input" autofocus placeholder="Ex. Clément pense pouvoir terminer le pipeline vendredi.">${hasDraft ? escapeHtml(draft.value) : ""}</textarea>
    </div>
    <button type="button" id="capture-more-btn" class="btn btn-ghost btn-sm" style="padding-left:0;">+ Préciser maintenant (type, rattachement...)</button>
    <div id="capture-quick-types" class="chip-row" style="display:${hasDraft && draft.selectedQuickType ? "flex" : "none"};flex-wrap:wrap;margin-top:8px;"></div>
  `;

  const quickTypesEl = body.querySelector("#capture-quick-types");
  quickTypesEl.innerHTML = QUICK_TYPES.map(
    (t) => `<button type="button" class="chip${hasDraft && draft.selectedQuickType === t.key ? " active" : ""}" data-key="${t.key}">${t.emoji} ${t.label}</button>`
  ).join("");
  let selectedQuickType = (hasDraft && draft.selectedQuickType) || null;
  body.querySelector("#capture-more-btn").addEventListener("click", (e) => {
    quickTypesEl.style.display = quickTypesEl.style.display === "none" ? "flex" : "none";
  });

  const textareaEl = body.querySelector("#capture-input");
  function persistDraft() {
    const value = textareaEl.value;
    if (value.trim()) saveDraft(DRAFT_KEY, { value, selectedQuickType });
    else clearDraft(DRAFT_KEY);
  }
  // Sauvegarde automatique pendant la frappe (débattue à 400ms) — c'est tout l'enjeu de cette
  // piste : ne jamais dépendre d'un geste explicite ("Enregistrer le brouillon") que Charles-
  // Henri n'aurait justement pas le temps de faire avant d'être interrompu.
  let saveTimer = null;
  textareaEl.addEventListener("input", () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persistDraft, 400);
  });
  quickTypesEl.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const nowActive = chip.dataset.key !== selectedQuickType;
      quickTypesEl.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
      selectedQuickType = nowActive ? chip.dataset.key : null;
      chip.classList.toggle("active", nowActive);
      persistDraft();
    });
  });

  const { close, bodyEl } = openModal({
    title: "Capturer",
    body,
    dismissible: true,
    onClose: () => opts.onClose?.(),
    actions: [
      {
        label: "Annuler",
        variant: "ghost",
        onClick: () => {
          // Annuler est un choix explicite de ne pas garder ce texte — différent d'une
          // interruption (clic en dehors, Échap, changement d'onglet), qui elle doit laisser
          // le brouillon intact : ces fermetures-là n'effacent jamais le brouillon.
          clearDraft(DRAFT_KEY);
        },
      },
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
          clearDraft(DRAFT_KEY);
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

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
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
