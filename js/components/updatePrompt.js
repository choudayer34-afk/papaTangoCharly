// Carte "Mise à jour disponible" — 14/10/2026, retour de Charles-Henri : l'application se
// rechargeait toute seule dès qu'une nouvelle version prenait le relais (js/app.js, ancien
// `controllerchange` → toast → location.reload()), ce qui faisait perdre une saisie en cours.
// Désormais on INFORME et on DEMANDE : "Mettre à jour maintenant" recharge (avec l'avertissement
// qu'une saisie non enregistrée peut être perdue), "Plus tard" ne recharge rien — la nouvelle
// version est déjà en cache et s'appliquera d'elle-même à la prochaine ouverture de l'application,
// ce que la carte et le message qui suit indiquent explicitement.
//
// Volontairement une carte flottante et NON une modale (js/components/modal.js) : openModal()
// ferme la fenêtre ouverte avant d'en ouvrir une autre, donc une modale de mise à jour aurait
// elle-même détruit la saisie qu'on cherche à protéger. Le focus n'est jamais déplacé non plus :
// on ne vole pas le curseur à quelqu'un qui est en train de taper.
import { showToast } from "./toast.js";

export const UPDATE_LATER_MESSAGE = "D'accord — la mise à jour s'appliquera à la prochaine ouverture de l'application.";

let currentCard = null;

/**
 * @param {Object} opts
 * @param {Function} opts.onUpdate - appelée sur "Mettre à jour maintenant" (recharge la page).
 * @returns {HTMLElement|null} la carte affichée (null si déjà affichée).
 */
export function showUpdatePrompt({ onUpdate }) {
  if (currentCard && currentCard.isConnected) return null;

  const card = document.createElement("div");
  card.className = "update-prompt";
  card.setAttribute("role", "alertdialog");
  card.setAttribute("aria-live", "polite");
  card.setAttribute("aria-labelledby", "update-prompt-title");

  const title = document.createElement("strong");
  title.id = "update-prompt-title";
  title.className = "update-prompt-title";
  title.textContent = "🔄 Une nouvelle version de Pilotage est disponible";

  const detail = document.createElement("p");
  detail.className = "update-prompt-text";
  detail.textContent =
    "Mettre à jour recharge l'application : une saisie en cours non enregistrée risque d'être perdue (les textes tapés dans une fenêtre de saisie sont conservés automatiquement). " +
    "Si vous choisissez « Plus tard », rien n'est rechargé : l'application se mettra à jour à sa prochaine ouverture.";

  const actions = document.createElement("div");
  actions.className = "update-prompt-actions";

  const laterBtn = document.createElement("button");
  laterBtn.type = "button";
  laterBtn.className = "btn btn-ghost update-prompt-later";
  laterBtn.textContent = "Plus tard";
  laterBtn.addEventListener("click", () => {
    card.remove();
    currentCard = null;
    showToast(UPDATE_LATER_MESSAGE, { duration: 6000 });
  });

  const nowBtn = document.createElement("button");
  nowBtn.type = "button";
  nowBtn.className = "btn btn-primary update-prompt-now";
  nowBtn.textContent = "Mettre à jour maintenant";
  nowBtn.addEventListener("click", () => {
    nowBtn.disabled = true;
    laterBtn.disabled = true;
    nowBtn.textContent = "Mise à jour…";
    onUpdate();
  });

  actions.append(laterBtn, nowBtn);
  card.append(title, detail, actions);
  document.body.appendChild(card);
  currentCard = card;
  return card;
}
