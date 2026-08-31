// Suggestions de prochaine étape — piste UX du 31/08/2026 (retour de Charles-Henri : mieux se
// souvenir des enchaînements d'actions à réaliser). Jamais automatique : après une action clé
// bien identifiée (cocher "Créer les actions" sur un canevas, enregistrer une Décision...),
// une petite invite propose la suite logique typique — accepter ouvre tout de suite le bon
// formulaire (déjà lié via le fil conducteur, js/components/linkedItems.js), refuser revient
// simplement là où on était. Complète la Revue hebdomadaire (qui ne repasse qu'une fois par
// semaine) par un rappel au fil de l'eau, au moment où le contexte est encore frais.

import { openModal } from "./modal.js";

/**
 * @param {Object} opts
 * @param {string} [opts.title]
 * @param {string} opts.message
 * @param {string} opts.acceptLabel
 * @param {Function} opts.onAccept
 * @param {Function} [opts.onDecline] - appelé sur le clic explicite "Plus tard" — PAS sur
 *  Échap/clic hors modale (même convention que confirmDelete() dans modal.js) : dans ce cas la
 *  modale se ferme juste, sans rouvrir l'écran d'origine.
 */
export function suggestNextStep({ title = "Suite logique ?", message, acceptLabel, onAccept, onDecline }) {
  const body = document.createElement("div");
  body.textContent = message;
  openModal({
    title,
    body,
    actions: [
      { label: "Plus tard", variant: "ghost", onClick: () => onDecline?.() },
      { label: acceptLabel, variant: "primary", onClick: () => onAccept?.() },
    ],
  });
}
